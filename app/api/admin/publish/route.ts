import { env } from "cloudflare:workers";
import {
  toPublicRecord,
  validateReviewedRecordForImport,
} from "@/lib/fatrace";
import {
  authorizeManualPublisher,
  ManualPublishAuthError,
} from "@/lib/manual-publish-auth";
import { validateManualPublishBatchCounts } from "@/lib/manual-publish-bundle";
import {
  parseJsonPreservingLargeIntegers,
  sha256Hex,
  stableStringify,
} from "@/lib/json-transport";
import { findSchool } from "@/lib/schools";

export const dynamic = "force-dynamic";

const PROJECT_ID = "appgprj_6abdf96b7f608191942ee50447a69129";
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const VALID_STATUSES = new Set(["available", "no_meal", "not_published"]);

type JsonObject = Record<string, unknown>;
type ExistingRow = { school_id: number; content_hash: string };
type PreparedRecord = {
  schoolId: number;
  status: string;
  contentHash: string;
  fetchedAt: string;
  reviewedAt: string;
  sourceUrl: string;
  reviewed: JsonObject;
  publicRecord: JsonObject;
};

export async function POST(request: Request) {
  try {
    await authorizeManualPublisher(request, env.MANUAL_PUBLISH_TOKEN);
  } catch (error) {
    if (error instanceof ManualPublishAuthError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("無法驗證手動發佈憑證", 403);
  }
  if (!env.DB || !env.BUCKET) {
    return jsonError("Site 儲存空間尚未連接", 503);
  }

  let bundle: JsonObject;
  try {
    bundle = await readJsonBody(request);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "發佈包無效", 400);
  }

  try {
    const prepared = await validateBundle(bundle);
    const existing = await env.DB
      .prepare(
        "SELECT school_id, content_hash FROM official_meal_records WHERE meal_date = ?",
      )
      .bind(prepared.mealDate)
      .all<ExistingRow>();
    const existingHashes = new Map(
      existing.results.map((row) => [Number(row.school_id), row.content_hash]),
    );
    const created = prepared.records.filter(
      (record) => !existingHashes.has(record.schoolId),
    ).length;
    const updated = prepared.records.filter((record) => {
      const hash = existingHashes.get(record.schoolId);
      return Boolean(hash && hash !== record.contentHash);
    }).length;
    const unchanged = prepared.records.length - created - updated;

    const uploadedAt = new Date().toISOString();
    const bundleKey = `manual-publish/${prepared.mealDate}/${crypto.randomUUID()}.json`;
    await env.BUCKET.put(bundleKey, JSON.stringify(bundle), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      customMetadata: {
        mealDate: prepared.mealDate,
        submittedSchools: String(prepared.schoolCount),
        reviewedRecords: String(prepared.records.length),
        method: "owner-manual-publish",
      },
    });

    const statements = prepared.records.map((record) =>
      env.DB!.prepare(
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
      ).bind(
        record.schoolId,
        prepared.mealDate,
        record.status,
        record.contentHash,
        record.fetchedAt,
        record.reviewedAt,
        record.sourceUrl,
        bundleKey,
        JSON.stringify(record.publicRecord),
        uploadedAt,
      ),
    );
    for (let index = 0; index < statements.length; index += 50) {
      await env.DB.batch(statements.slice(index, index + 50));
    }

    const verified = await env.DB
      .prepare("SELECT COUNT(*) AS count FROM official_meal_records WHERE meal_date = ?")
      .bind(prepared.mealDate)
      .first<{ count: number }>();
    return Response.json(
      {
        status: "published",
        mealDate: prepared.mealDate,
        submittedSchools: prepared.schoolCount,
        reviewedRecords: prepared.records.length,
        notPublished: prepared.notPublished,
        created,
        updated,
        unchanged,
        verifiedRecords: Number(verified?.count || 0),
        publishedAt: uploadedAt,
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Manual meal publication failed", error);
    const message = error instanceof Error ? error.message : "發佈包驗證失敗";
    const validationFailure = /不一致|無效|缺少|重複|不可發佈|不得|尚未|必須|不正確/.test(message);
    return jsonError(
      validationFailure ? message : "Site 寫入失敗，既有資料已保留",
      validationFailure ? 400 : 500,
    );
  }
}

async function readJsonBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new Error("發佈包超過 12 MiB 上限");
  }
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > MAX_BODY_BYTES) {
    throw new Error("發佈包超過 12 MiB 上限");
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(buffer));
  } catch {
    throw new Error("發佈包不是有效 JSON");
  }
  return objectValue(value, "發佈包");
}

async function validateBundle(bundle: JsonObject) {
  if (
    bundle.schemaVersion !== 1
    || bundle.kind !== "demeter-reviewed-school-meals"
    || bundle.projectId !== PROJECT_ID
  ) {
    throw new Error("發佈包版本、類型或 Site project_id 不正確");
  }
  const mealDate = String(bundle.mealDate || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mealDate)) {
    throw new Error("發佈日期格式必須是 YYYY-MM-DD");
  }
  const summary = objectValue(bundle.reportSummary, "reportSummary");
  const results = listValue(bundle.results, "results");
  const records = listValue(bundle.records, "records");
  const counts = validateManualPublishBatchCounts(
    summary,
    results.length,
    records.length,
  );

  const resultStatuses = new Map<number, string>();
  for (const value of results) {
    const result = objectValue(value, "results[]");
    const schoolId = integerValue(result.schoolId, "results[].schoolId");
    const status = String(result.status || "");
    const school = findSchool(schoolId);
    if (!school || resultStatuses.has(schoolId)) {
      throw new Error(`results 包含無效或重複學校代碼：${schoolId}`);
    }
    if (!VALID_STATUSES.has(status) || result.school !== school.name) {
      throw new Error(`results 的學校名稱或狀態不一致：${schoolId}`);
    }
    resultStatuses.set(schoolId, status);
  }
  const preparedRecords: PreparedRecord[] = [];
  const recordIds = new Set<number>();
  for (const value of records) {
    const envelope = objectValue(value, "records[]");
    const envelopeSchoolId = integerValue(envelope.schoolId, "records[].schoolId");
    const recordJson = stringValue(envelope.recordJson, "records[].recordJson");
    const recordSha256 = stringValue(envelope.recordSha256, "records[].recordSha256");
    const fingerprintJson = stringValue(
      envelope.fingerprintJson,
      "records[].fingerprintJson",
    );
    if (
      !/^[a-f0-9]{64}$/.test(recordSha256)
      || await sha256Hex(recordJson) !== recordSha256
    ) {
      throw new Error(`reviewed 紀錄傳輸雜湊不一致：${envelopeSchoolId}`);
    }
    const recordObject = parseJsonPreservingLargeIntegers(
      recordJson,
      "records[].recordJson",
    );
    const schoolObject = objectValue(recordObject.school, "records[].school");
    const schoolId = integerValue(schoolObject.fatraceSchoolId, "school.fatraceSchoolId");
    if (schoolId !== envelopeSchoolId) {
      throw new Error(`records 的學校代碼不一致：${envelopeSchoolId}`);
    }
    const school = findSchool(schoolId);
    if (!school || recordIds.has(schoolId)) {
      throw new Error(`records 包含無效或重複學校代碼：${schoolId}`);
    }
    const expectedStatus = resultStatuses.get(schoolId);
    if (!expectedStatus || expectedStatus === "not_published" || recordObject.status !== expectedStatus) {
      throw new Error(`reviewed 紀錄與抓取報告狀態不一致：${schoolId}`);
    }
    const reviewed = await validateReviewedRecordForImport(recordObject, school, mealDate);
    const fingerprint = parseJsonPreservingLargeIntegers(
      fingerprintJson,
      "records[].fingerprintJson",
    );
    const fingerprintFromRecord = {
      school: reviewed.school,
      mealDate: reviewed.mealDate,
      status: reviewed.status,
      noMealReasons: reviewed.noMealReasons,
      services: reviewed.services,
    };
    if (
      stableStringify(fingerprint) !== stableStringify(fingerprintFromRecord)
      || await sha256Hex(fingerprintJson) !== reviewed.contentHash
    ) {
      throw new Error(`reviewed 紀錄內容雜湊不一致：${schoolId}`);
    }
    const review = objectValue(reviewed.review, "review");
    const source = objectValue(reviewed.source, "source");
    preparedRecords.push({
      schoolId,
      status: String(reviewed.status),
      contentHash: String(reviewed.contentHash),
      fetchedAt: String(reviewed.fetchedAt),
      reviewedAt: String(review.reviewedAt),
      sourceUrl: String(source.url),
      reviewed,
      publicRecord: toPublicRecord(reviewed),
    });
    recordIds.add(schoolId);
  }
  for (const [schoolId, status] of resultStatuses) {
    if ((status === "available" || status === "no_meal") && !recordIds.has(schoolId)) {
      throw new Error(`發佈包缺少 reviewed 紀錄：${schoolId}`);
    }
  }
  return {
    mealDate,
    schoolCount: counts.schools,
    records: preparedRecords,
    notPublished: counts.notPublished,
  };
}

function objectValue(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} 必須是物件`);
  }
  return value as JsonObject;
}

function listValue(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} 必須是陣列`);
  return value;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) throw new Error(`${label} 必須是字串`);
  return value;
}

function integerValue(value: unknown, label: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error(`${label} 必須是非負整數`);
  }
  return result;
}

function jsonError(error: string, status: number) {
  return Response.json(
    { status: "error", error },
    { status, headers: { "cache-control": "private, no-store" } },
  );
}
