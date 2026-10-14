import {
  AUTH_CODE_TTL_MINUTES,
  accountDatabase,
  createVerificationCode,
  digestVerificationCode,
  emailAuthReady,
  forbiddenMutation,
  isAdultBirthDate,
  isSameOriginMutation,
  localAuthCode,
  maskEmail,
  normalizeEmail,
  privateJson,
  requestKey,
  sendVerificationEmail,
} from "@/lib/account-auth";

type CountRow = { count: number | string };

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return forbiddenMutation();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "資料格式不正確" }, { status: 400 });
  }
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const email = normalizeEmail(record.email);
  if (!email) {
    return privateJson({ error: "請輸入有效的 Email" }, { status: 400 });
  }
  if (!isAdultBirthDate(record.birthDate)) {
    return privateJson(
      {
        error: "這項服務由成年家長或照顧者管理，請由成年家長協助註冊",
        code: "ADULT_REQUIRED",
      },
      { status: 403 },
    );
  }
  if (record.caregiverConfirmed !== true) {
    return privateJson({ error: "請確認您是孩子的成年家長或照顧者" }, { status: 400 });
  }
  if (!emailAuthReady(request)) {
    return privateJson(
      { error: "Email 登入正在完成寄信設定，請稍後再試", code: "EMAIL_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const db = accountDatabase();
  const now = new Date();
  const nowIso = now.toISOString();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const sourceKey = await requestKey(request);
  const [emailCount, sourceCount] = await Promise.all([
    db.prepare(
      "SELECT COUNT(*) AS count FROM email_auth_challenges WHERE email = ? AND created_at >= ?",
    ).bind(email, fifteenMinutesAgo).first<CountRow>(),
    db.prepare(
      "SELECT COUNT(*) AS count FROM email_auth_challenges WHERE request_key = ? AND created_at >= ?",
    ).bind(sourceKey, oneHourAgo).first<CountRow>(),
  ]);
  if (Number(emailCount?.count || 0) >= 3 || Number(sourceCount?.count || 0) >= 12) {
    return privateJson(
      { error: "驗證碼要求太頻繁，請稍後再試", code: "RATE_LIMITED" },
      { status: 429, headers: { "retry-after": "900" } },
    );
  }

  const challengeId = crypto.randomUUID();
  const code = localAuthCode(request) || createVerificationCode();
  const expiresAt = new Date(now.getTime() + AUTH_CODE_TTL_MINUTES * 60 * 1000).toISOString();
  await db.prepare(
    `INSERT INTO email_auth_challenges
       (id, email, code_digest, request_key, attempts, eligibility_confirmed_at, created_at, expires_at, consumed_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?, NULL)`,
  ).bind(
    challengeId,
    email,
    await digestVerificationCode(challengeId, email, code),
    sourceKey,
    nowIso,
    nowIso,
    expiresAt,
  ).run();

  try {
    await sendVerificationEmail(email, code, challengeId, request);
  } catch (error) {
    await db.prepare("DELETE FROM email_auth_challenges WHERE id = ?").bind(challengeId).run();
    console.error("Unable to send family account verification code", error);
    return privateJson(
      { error: "驗證信暫時無法寄出，請稍後再試", code: "EMAIL_DELIVERY_FAILED" },
      { status: 503 },
    );
  }

  return privateJson({
    ok: true,
    challengeId,
    maskedEmail: maskEmail(email),
    expiresInMinutes: AUTH_CODE_TTL_MINUTES,
  });
}
