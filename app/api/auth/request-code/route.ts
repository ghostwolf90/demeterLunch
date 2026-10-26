import {
  AUTH_CODE_TTL_MINUTES,
  accountDatabase,
  getAccountUser,
  digestSessionToken,
  sessionTokenFromRequest,
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
    return privateJson({ error: "請重新確認填寫內容。" }, { status: 400 });
  }
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const linking = record.purpose === "link_email";
  const user = await getAccountUser(request);
  if (linking && !user) return privateJson({ error: "請先登入家庭帳號，再綁定 Email。" }, { status: 401 });
  if (!linking && user) return privateJson({ error: "你已登入，請從家庭設定綁定 Email。" }, { status: 409 });
  const email = normalizeEmail(record.email);
  if (!email) {
    return privateJson({ error: "請輸入有效的 Email。" }, { status: 400 });
  }
  if (!linking && !isAdultBirthDate(record.birthDate)) {
    return privateJson(
      {
        error: "這項服務由成年家長或照顧者管理，請由年滿 18 歲的家長或照顧者註冊。",
        code: "ADULT_REQUIRED",
      },
      { status: 403 },
    );
  }
  if (!linking && record.caregiverConfirmed !== true) {
    return privateJson({ error: "請勾選確認你是孩子的成年家長或照顧者。" }, { status: 400 });
  }
  if (!emailAuthReady(request)) {
    return privateJson(
      { error: "目前無法寄送驗證碼，請稍後再試。", code: "EMAIL_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  if (linking && user?.email && user.email !== email) {
    return privateJson({ error: "這個家庭帳號已有登入 Email，目前不支援在此更換。" }, { status: 409 });
  }
  const db = accountDatabase();
  if (linking) {
    const owner = await db.prepare("SELECT auth_user_id FROM parent_accounts WHERE email_normalized = ? OR lower(email) = ? LIMIT 1")
      .bind(email, email).first<{ auth_user_id: string }>();
    if (owner && owner.auth_user_id !== user!.id) return privateJson({ error: "這個 Email 已屬於另一個家庭帳號，請登入原帳號後綁定 LINE；系統不會自動合併家庭資料。" }, { status: 409 });
  }
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
      { error: "驗證碼寄送次數較多，請稍後再試。", code: "RATE_LIMITED" },
      { status: 429, headers: { "retry-after": "900" } },
    );
  }

  const challengeId = crypto.randomUUID();
  const code = localAuthCode(request) || createVerificationCode();
  const expiresAt = new Date(now.getTime() + AUTH_CODE_TTL_MINUTES * 60 * 1000).toISOString();
  await db.prepare(
    `INSERT INTO email_auth_challenges
       (id, email, code_digest, request_key, attempts, eligibility_confirmed_at, created_at, expires_at, consumed_at, auth_user_id, session_digest)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?, NULL, ?, ?)`,
  ).bind(
    challengeId,
    email,
    await digestVerificationCode(challengeId, email, code),
    sourceKey,
    nowIso,
    nowIso,
    expiresAt,
    linking ? user!.id : null,
    linking ? await digestSessionToken(sessionTokenFromRequest(request)!) : null,
  ).run();

  try {
    await sendVerificationEmail(email, code, challengeId, request);
  } catch (error) {
    await db.prepare("DELETE FROM email_auth_challenges WHERE id = ?").bind(challengeId).run();
    console.error("Unable to send family account verification code", error);
    return privateJson(
      { error: "目前無法寄送驗證碼，請稍後再試。", code: "EMAIL_DELIVERY_FAILED" },
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
