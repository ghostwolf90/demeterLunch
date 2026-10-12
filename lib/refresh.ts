import { FatraceClient, reviewCandidate, toPublicRecord } from "@/lib/fatrace";
import { allSchools, findSchool, schoolsForGroup, type School } from "@/lib/schools";
import {
  deliverTelegramEvent,
  formatDailySummary,
  formatJobFinished,
  formatJobProblem,
  formatJobStarted,
  type TelegramDelivery,
} from "@/lib/telegram";

export type SiteEnv = Cloudflare.Env & {
  FATRACE_COLLECTION_PAUSED?: string;
  MCP_OWNER_EMAIL?: string;
  MCP_OWNER_USER_ID?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
};

type RefreshResult = {
  schoolId: number;
  school: string;
  status: "available" | "no_meal" | "not_published" | "failed";
  saveStatus: "created" | "updated" | "unchanged" | "preserved" | "not_written";
  error?: string;
};

type JobRow = {
  job_key: string;
  kind: string;
  meal_date: string;
  group_id: number | null;
  cursor: number;
  total: number;
  status: string;
  school_ids_json: string | null;
  available_count: number;
  no_meal_count: number;
  not_published_count: number;
  failed_count: number;
  started_at: string;
  updated_at: string;
  finished_at: string | null;
};

export async function refreshSchoolGroup(
  env: SiteEnv,
  input: { group: number; meal_date?: string; max_schools?: number },
) {
  const group = Number(input.group);
  if (![1, 2, 3].includes(group)) throw new Error("group 必須是 1、2 或 3");
  const mealDate = input.meal_date || taipeiDate();
  requireIsoDate(mealDate);
  const maxSchools = boundedChunkSize(input.max_schools);
  const schools = schoolsForGroup(group);
  if (collectionPaused(env)) {
    return pausedJobResult(`main:${mealDate}:${group}`, mealDate, "main", group, schools.length);
  }
  return runJob(env, {
    jobKey: `main:${mealDate}:${group}`,
    kind: "main",
    mealDate,
    groupId: group,
    schools,
    maxSchools,
    lockName: `refresh-group-${group}`,
  });
}

export async function retryIncompleteSchools(
  env: SiteEnv,
  input: { meal_date?: string; max_schools?: number },
) {
  const mealDate = input.meal_date || taipeiDate();
  requireIsoDate(mealDate);
  const jobKey = `retry:${mealDate}`;
  if (collectionPaused(env)) {
    return pausedJobResult(jobKey, mealDate, "retry", null, allSchools().length);
  }
  const db = requireDb(env);
  const existing = await db
    .prepare("SELECT * FROM refresh_jobs WHERE job_key = ?")
    .bind(jobKey)
    .first<JobRow>();
  let schoolIds: number[];
  if (existing?.school_ids_json) {
    schoolIds = JSON.parse(existing.school_ids_json) as number[];
  } else {
    const rows = await db
      .prepare(
        `SELECT a.school_id, a.status
           FROM refresh_attempts a
           JOIN (
             SELECT school_id, MAX(id) AS latest_id
             FROM refresh_attempts
             WHERE meal_date = ?
             GROUP BY school_id
           ) latest ON latest.latest_id = a.id
          ORDER BY a.school_id`,
      )
      .bind(mealDate)
      .all<{ school_id: number; status: RefreshResult["status"] }>();
    const latestStatuses = new Map(
      rows.results.map((row) => [Number(row.school_id), row.status]),
    );
    schoolIds = allSchools()
      .filter((school) => {
        const status = latestStatuses.get(school.fatraceSchoolId);
        return !status || status === "failed" || status === "not_published";
      })
      .map((school) => school.fatraceSchoolId);
  }
  const schools = schoolIds.flatMap((schoolId) => {
    const school = findSchool(schoolId);
    return school ? [school] : [];
  });
  if (!schools.length && !existing) {
    const notifications = await notifyEmptyRetry(env, mealDate);
    return {
      jobKey,
      mealDate,
      kind: "retry",
      status: "complete",
      message: "沒有需要補抓的學校。",
      processed: [],
      cursor: 0,
      total: 0,
      remaining: 0,
      notifications,
    };
  }
  return runJob(env, {
    jobKey,
    kind: "retry",
    mealDate,
    groupId: null,
    schools,
    maxSchools: boundedChunkSize(input.max_schools),
    lockName: "refresh-retry",
    schoolIds,
  });
}

export async function getRefreshStatus(env: SiteEnv, mealDate = taipeiDate()) {
  requireIsoDate(mealDate);
  const db = requireDb(env);
  const jobs = await db
    .prepare(
      `SELECT job_key, kind, meal_date, group_id, cursor, total, status,
              available_count, no_meal_count, not_published_count, failed_count,
              started_at, updated_at, finished_at
         FROM refresh_jobs
        WHERE meal_date = ?
        ORDER BY kind, group_id`,
    )
    .bind(mealDate)
    .all();
  const latestAttempts = await loadLatestAttempts(db, mealDate);
  const notifications = await db
    .prepare(
      `SELECT event_key, job_key, event_type, status, attempts,
              telegram_message_id, last_error, sent_at, updated_at
         FROM telegram_notifications
        WHERE meal_date = ?
        ORDER BY created_at, event_key`,
    )
    .bind(mealDate)
    .all();
  return {
    mealDate,
    summary: latestAttempts.summary,
    jobs: jobs.results,
    latestAttempts: latestAttempts.rows,
    notifications: notifications.results,
  };
}

async function runJob(
  env: SiteEnv,
  options: {
    jobKey: string;
    kind: "main" | "retry";
    mealDate: string;
    groupId: number | null;
    schools: School[];
    maxSchools: number;
    lockName: string;
    schoolIds?: number[];
  },
) {
  const db = requireDb(env);
  const bucket = requireBucket(env);
  const ownerToken = crypto.randomUUID();
  const lock = await acquireLock(db, options.lockName, ownerToken);
  if (!lock) {
    return {
      jobKey: options.jobKey,
      mealDate: options.mealDate,
      kind: options.kind,
      status: "locked",
      message: "同一批次仍在執行；本次沒有向來源網站發出請求。",
      processed: [],
    };
  }

  const notifications: TelegramDelivery[] = [];
  try {
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT OR IGNORE INTO refresh_jobs (
           job_key, kind, meal_date, group_id, cursor, total, status,
           school_ids_json, available_count, no_meal_count,
           not_published_count, failed_count, started_at, updated_at
         ) VALUES (?, ?, ?, ?, 0, ?, 'running', ?, 0, 0, 0, 0, ?, ?)`,
      )
      .bind(
        options.jobKey,
        options.kind,
        options.mealDate,
        options.groupId,
        options.schools.length,
        options.schoolIds ? JSON.stringify(options.schoolIds) : null,
        now,
        now,
      )
      .run();
    let job = await loadJob(db, options.jobKey);
    notifications.push(await notifyJobStarted(env, job));
    if (job.status === "complete") {
      notifications.push(await notifyJobFinished(env, job));
      if (job.kind === "retry") notifications.push(await notifyDailySummary(env, job.meal_date));
      return jobResult(job, [], notifications);
    }

    const selected = options.schools.slice(job.cursor, job.cursor + options.maxSchools);
    const processed: RefreshResult[] = [];
    // Three schedules may overlap. A 3.6 second per-request interval keeps the
    // combined upstream rate near one request per 1.2 seconds.
    const client = new FatraceClient({
      intervalMs: 3_600,
      timeoutMs: 20_000,
      retries: 2,
      includeIngredients: true,
    });

    for (const school of selected) {
      const result = await collectAndStore(db, bucket, client, school, options.mealDate);
      processed.push(result);
      await saveAttempt(db, options.jobKey, options.mealDate, result);
      if (result.status === "failed") {
        notifications.push(await notifySchoolProblem(env, job, result));
      }
      job = advanceJob(job, result);
      await persistJob(db, job);
      await renewLock(db, options.lockName, ownerToken);
    }
    if (job.status === "complete") {
      notifications.push(await notifyJobFinished(env, job));
      if (job.kind === "retry") notifications.push(await notifyDailySummary(env, job.meal_date));
    }
    return jobResult(job, processed, notifications);
  } catch (error) {
    await deliverTelegramEvent(env, {
      eventKey: `problem:${options.jobKey}:fatal`,
      jobKey: options.jobKey,
      mealDate: options.mealDate,
      eventType: "problem",
      message: formatJobProblem({
        mealDate: options.mealDate,
        label: jobLabel(options.kind, options.groupId),
        school: "整批工作",
        error: error instanceof Error ? error.message : String(error),
      }),
    });
    throw error;
  } finally {
    await releaseLock(db, options.lockName, ownerToken);
  }
}

async function collectAndStore(
  db: D1Database,
  bucket: R2Bucket,
  client: FatraceClient,
  school: School,
  mealDate: string,
): Promise<RefreshResult> {
  try {
    const { raw, candidate } = await client.collect(school, mealDate);
    if (candidate.status === "not_published") {
      return {
        schoolId: school.fatraceSchoolId,
        school: school.name,
        status: "not_published",
        saveStatus: "not_written",
      };
    }
    const existing = await db
      .prepare(
        "SELECT status, content_hash FROM official_meal_records WHERE school_id = ? AND meal_date = ?",
      )
      .bind(school.fatraceSchoolId, mealDate)
      .first<{ status: string; content_hash: string }>();
    if (existing?.content_hash === candidate.contentHash) {
      return {
        schoolId: school.fatraceSchoolId,
        school: school.name,
        status: candidate.status,
        saveStatus: "unchanged",
      };
    }

    const reviewed = await reviewCandidate(candidate);
    const publicRecord = toPublicRecord(reviewed);
    const rawKey = `raw/fatrace-daily/${mealDate}/${school.fatraceSchoolId}.json`;
    const reviewedKey = `reviewed/schools/fatrace/${school.fatraceSchoolId}/${mealDate}.json`;
    await bucket.put(rawKey, JSON.stringify(raw), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      customMetadata: { schoolId: String(school.fatraceSchoolId), mealDate },
    });
    await bucket.put(reviewedKey, JSON.stringify(reviewed), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      customMetadata: {
        schoolId: String(school.fatraceSchoolId),
        mealDate,
        contentHash: candidate.contentHash,
      },
    });
    const updatedAt = new Date().toISOString();
    const reviewedPayload = reviewed as Record<string, unknown>;
    const review = reviewedPayload.review as Record<string, unknown>;
    const source = reviewedPayload.source as Record<string, unknown>;
    await db
      .prepare(
        `INSERT INTO official_meal_records (
           school_id, meal_date, status, content_hash, fetched_at, reviewed_at,
           source_url, r2_key, record_json, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(school_id, meal_date) DO UPDATE SET
           status = excluded.status,
           content_hash = excluded.content_hash,
           fetched_at = excluded.fetched_at,
           reviewed_at = excluded.reviewed_at,
           source_url = excluded.source_url,
           r2_key = excluded.r2_key,
           record_json = excluded.record_json,
           updated_at = excluded.updated_at`,
      )
      .bind(
        school.fatraceSchoolId,
        mealDate,
        candidate.status,
        candidate.contentHash,
        String(candidate.fetchedAt),
        String(review.reviewedAt),
        String(source.url),
        reviewedKey,
        JSON.stringify(publicRecord),
        updatedAt,
      )
      .run();
    return {
      schoolId: school.fatraceSchoolId,
      school: school.name,
      status: candidate.status,
      saveStatus: existing ? "updated" : "created",
    };
  } catch (error) {
    return {
      schoolId: school.fatraceSchoolId,
      school: school.name,
      status: "failed",
      saveStatus: "not_written",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function saveAttempt(
  db: D1Database,
  jobKey: string,
  mealDate: string,
  result: RefreshResult,
) {
  await db
    .prepare(
      `INSERT INTO refresh_attempts (
         job_key, meal_date, school_id, status, save_status, error, checked_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      jobKey,
      mealDate,
      result.schoolId,
      result.status,
      result.saveStatus,
      result.error ?? null,
      new Date().toISOString(),
    )
    .run();
}

function advanceJob(job: JobRow, result: RefreshResult): JobRow {
  const cursor = job.cursor + 1;
  const complete = cursor >= job.total;
  return {
    ...job,
    cursor,
    status: complete ? "complete" : "running",
    available_count: job.available_count + Number(result.status === "available"),
    no_meal_count: job.no_meal_count + Number(result.status === "no_meal"),
    not_published_count:
      job.not_published_count + Number(result.status === "not_published"),
    failed_count: job.failed_count + Number(result.status === "failed"),
    updated_at: new Date().toISOString(),
    finished_at: complete ? new Date().toISOString() : null,
  };
}

async function persistJob(db: D1Database, job: JobRow) {
  await db
    .prepare(
      `UPDATE refresh_jobs
          SET cursor = ?, status = ?, available_count = ?, no_meal_count = ?,
              not_published_count = ?, failed_count = ?, updated_at = ?, finished_at = ?
        WHERE job_key = ?`,
    )
    .bind(
      job.cursor,
      job.status,
      job.available_count,
      job.no_meal_count,
      job.not_published_count,
      job.failed_count,
      job.updated_at,
      job.finished_at,
      job.job_key,
    )
    .run();
}

async function loadJob(db: D1Database, jobKey: string) {
  const job = await db
    .prepare("SELECT * FROM refresh_jobs WHERE job_key = ?")
    .bind(jobKey)
    .first<JobRow>();
  if (!job) throw new Error(`找不到抓取工作：${jobKey}`);
  return job;
}

function jobResult(
  job: JobRow,
  processed: RefreshResult[],
  notifications: TelegramDelivery[] = [],
) {
  return {
    jobKey: job.job_key,
    kind: job.kind,
    mealDate: job.meal_date,
    group: job.group_id,
    status: job.status,
    cursor: job.cursor,
    total: job.total,
    remaining: Math.max(0, job.total - job.cursor),
    summary: {
      available: job.available_count,
      noMeal: job.no_meal_count,
      notPublished: job.not_published_count,
      failed: job.failed_count,
    },
    processed,
    notifications,
    nextAction:
      job.status === "complete"
        ? "這批已完成。"
        : "請再次呼叫相同工具與參數，系統會從下一間學校繼續。",
  };
}

async function notifyJobStarted(env: SiteEnv, job: JobRow) {
  return deliverTelegramEvent(env, {
    eventKey: `started:${job.job_key}`,
    jobKey: job.job_key,
    mealDate: job.meal_date,
    eventType: "started",
    message: formatJobStarted({
      mealDate: job.meal_date,
      label: jobLabel(job.kind, job.group_id),
      total: job.total,
    }),
  });
}

async function notifySchoolProblem(env: SiteEnv, job: JobRow, result: RefreshResult) {
  return deliverTelegramEvent(env, {
    eventKey: `problem:${job.job_key}:${result.schoolId}`,
    jobKey: job.job_key,
    mealDate: job.meal_date,
    eventType: "problem",
    message: formatJobProblem({
      mealDate: job.meal_date,
      label: jobLabel(job.kind, job.group_id),
      school: result.school,
      error: result.error,
    }),
  });
}

async function notifyJobFinished(env: SiteEnv, job: JobRow) {
  return deliverTelegramEvent(env, {
    eventKey: `finished:${job.job_key}`,
    jobKey: job.job_key,
    mealDate: job.meal_date,
    eventType: "finished",
    message: formatJobFinished({
      mealDate: job.meal_date,
      label: jobLabel(job.kind, job.group_id),
      total: job.total,
      available: job.available_count,
      noMeal: job.no_meal_count,
      notPublished: job.not_published_count,
      failed: job.failed_count,
    }),
  });
}

async function notifyDailySummary(env: SiteEnv, mealDate: string) {
  const db = requireDb(env);
  const latest = await loadLatestAttempts(db, mealDate);
  return deliverTelegramEvent(env, {
    eventKey: `daily-summary:${mealDate}`,
    jobKey: `retry:${mealDate}`,
    mealDate,
    eventType: "daily_summary",
    message: formatDailySummary({
      mealDate,
      checked: latest.summary.checked,
      expected: allSchools().length,
      available: latest.summary.available,
      noMeal: latest.summary.noMeal,
      notPublished: latest.summary.notPublished,
      failed: latest.summary.failed,
    }),
  });
}

async function notifyEmptyRetry(env: SiteEnv, mealDate: string) {
  const jobKey = `retry:${mealDate}`;
  const started = await deliverTelegramEvent(env, {
    eventKey: `started:${jobKey}`,
    jobKey,
    mealDate,
    eventType: "started",
    message: formatJobStarted({ mealDate, label: "15:30 下午補抓", total: 0 }),
  });
  const finished = await deliverTelegramEvent(env, {
    eventKey: `finished:${jobKey}`,
    jobKey,
    mealDate,
    eventType: "finished",
    message: formatJobFinished({
      mealDate,
      label: "15:30 下午補抓",
      total: 0,
      available: 0,
      noMeal: 0,
      notPublished: 0,
      failed: 0,
    }),
  });
  const summary = await notifyDailySummary(env, mealDate);
  return [started, finished, summary];
}

async function loadLatestAttempts(db: D1Database, mealDate: string) {
  const result = await db
    .prepare(
      `SELECT a.school_id, a.status, a.save_status, a.error, a.checked_at
         FROM refresh_attempts a
         JOIN (
           SELECT school_id, MAX(id) AS latest_id
           FROM refresh_attempts
           WHERE meal_date = ?
           GROUP BY school_id
         ) latest ON latest.latest_id = a.id
        ORDER BY a.school_id`,
    )
    .bind(mealDate)
    .all();
  const summary = {
    checked: result.results.length,
    available: 0,
    noMeal: 0,
    notPublished: 0,
    failed: 0,
  };
  for (const row of result.results as Array<Record<string, unknown>>) {
    if (row.status === "available") summary.available += 1;
    else if (row.status === "no_meal") summary.noMeal += 1;
    else if (row.status === "not_published") summary.notPublished += 1;
    else if (row.status === "failed") summary.failed += 1;
  }
  return { rows: result.results, summary };
}

function jobLabel(kind: string, groupId: number | null) {
  return kind === "retry" ? "15:30 下午補抓" : `第 ${groupId} 批（81 校）`;
}

function collectionPaused(env: SiteEnv) {
  return env.FATRACE_COLLECTION_PAUSED?.trim().toLowerCase() === "true";
}

function pausedJobResult(
  jobKey: string,
  mealDate: string,
  kind: "main" | "retry",
  group: number | null,
  total: number,
) {
  return {
    jobKey,
    kind,
    mealDate,
    group,
    status: "paused",
    cursor: 0,
    total,
    remaining: 0,
    deferred: total,
    processed: [],
    message:
      "官方來源目前拒絕 Site 雲端執行環境連線；本次安全暫停，未向來源網站送出請求。",
  };
}

async function acquireLock(db: D1Database, lockName: string, ownerToken: string) {
  const now = new Date().toISOString();
  const leaseUntil = new Date(Date.now() + 12 * 60_000).toISOString();
  await db
    .prepare(
      "INSERT OR IGNORE INTO refresh_locks (lock_name, owner_token, lease_until, updated_at) VALUES (?, NULL, NULL, ?)",
    )
    .bind(lockName, now)
    .run();
  const result = await db
    .prepare(
      `UPDATE refresh_locks
          SET owner_token = ?, lease_until = ?, updated_at = ?
        WHERE lock_name = ?
          AND (owner_token IS NULL OR lease_until < ? OR owner_token = ?)`,
    )
    .bind(ownerToken, leaseUntil, now, lockName, now, ownerToken)
    .run();
  return Number(result.meta.changes || 0) > 0;
}

async function renewLock(db: D1Database, lockName: string, ownerToken: string) {
  await db
    .prepare(
      "UPDATE refresh_locks SET lease_until = ?, updated_at = ? WHERE lock_name = ? AND owner_token = ?",
    )
    .bind(
      new Date(Date.now() + 12 * 60_000).toISOString(),
      new Date().toISOString(),
      lockName,
      ownerToken,
    )
    .run();
}

async function releaseLock(db: D1Database, lockName: string, ownerToken: string) {
  await db
    .prepare(
      "UPDATE refresh_locks SET owner_token = NULL, lease_until = NULL, updated_at = ? WHERE lock_name = ? AND owner_token = ?",
    )
    .bind(new Date().toISOString(), lockName, ownerToken)
    .run();
}

function requireDb(env: SiteEnv) {
  if (!env.DB) throw new Error("D1 資料庫尚未連接");
  return env.DB;
}

function requireBucket(env: SiteEnv) {
  if (!env.BUCKET) throw new Error("R2 reviewed JSON 儲存空間尚未連接");
  return env.BUCKET;
}

function boundedChunkSize(value: number | undefined) {
  const size = Number(value ?? 2);
  if (!Number.isInteger(size) || size < 1 || size > 3) {
    throw new Error("max_schools 必須是 1 到 3 的整數");
  }
  return size;
}

function taipeiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function requireIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`日期格式必須是 YYYY-MM-DD：${value}`);
  }
}
