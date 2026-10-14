import {
  accountDatabase,
  authUserIdForEmail,
  createSession,
  digestVerificationCode,
  forbiddenMutation,
  isSameOriginMutation,
  privateJson,
  sessionCookie,
} from "@/lib/account-auth";

type ChallengeRow = {
  id: string;
  email: string;
  code_digest: string;
  attempts: number;
  eligibility_confirmed_at: string;
  expires_at: string;
  consumed_at: string | null;
};

type AccountRow = { auth_user_id: string };

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
  const challengeId = typeof record.challengeId === "string" ? record.challengeId.trim() : "";
  const code = typeof record.code === "string" ? record.code.trim() : "";
  if (!/^[0-9a-f-]{30,50}$/i.test(challengeId) || !/^\d{6}$/.test(code)) {
    return privateJson({ error: "請輸入六位數驗證碼" }, { status: 400 });
  }

  const db = accountDatabase();
  const challenge = await db.prepare(
    `SELECT id, email, code_digest, attempts, eligibility_confirmed_at, expires_at, consumed_at
     FROM email_auth_challenges
     WHERE id = ?
     LIMIT 1`,
  ).bind(challengeId).first<ChallengeRow>();
  const now = new Date().toISOString();
  if (!challenge || challenge.consumed_at || challenge.expires_at <= now) {
    return privateJson(
      { error: "驗證碼已失效，請重新取得", code: "CODE_EXPIRED" },
      { status: 410 },
    );
  }
  if (challenge.attempts >= 5) {
    return privateJson(
      { error: "驗證次數過多，請重新取得驗證碼", code: "CODE_LOCKED" },
      { status: 429 },
    );
  }

  const providedDigest = await digestVerificationCode(challenge.id, challenge.email, code);
  if (!safeEqualHex(providedDigest, challenge.code_digest)) {
    await db.prepare(
      "UPDATE email_auth_challenges SET attempts = attempts + 1 WHERE id = ? AND consumed_at IS NULL",
    ).bind(challenge.id).run();
    return privateJson(
      { error: "驗證碼不正確，請再確認一次", code: "CODE_INVALID" },
      { status: 400 },
    );
  }

  const existing = await db.prepare(
    `SELECT auth_user_id
     FROM parent_accounts
     WHERE email_normalized = ? OR lower(email) = ?
     ORDER BY created_at
     LIMIT 1`,
  ).bind(challenge.email, challenge.email).first<AccountRow>();
  const authUserId = existing?.auth_user_id || await authUserIdForEmail(challenge.email);
  const session = await createSession();

  await db.batch([
    db.prepare(
      `INSERT INTO parent_accounts
         (auth_user_id, email, email_normalized, display_name, plan, adult_verified_at, caregiver_confirmed_at, created_at, updated_at)
       VALUES (?, ?, ?, '家長', 'free', ?, ?, ?, ?)
       ON CONFLICT(auth_user_id) DO UPDATE SET
         email = excluded.email,
         email_normalized = excluded.email_normalized,
         adult_verified_at = COALESCE(parent_accounts.adult_verified_at, excluded.adult_verified_at),
         caregiver_confirmed_at = excluded.caregiver_confirmed_at,
         updated_at = excluded.updated_at`,
    ).bind(
      authUserId,
      challenge.email,
      challenge.email,
      challenge.eligibility_confirmed_at,
      challenge.eligibility_confirmed_at,
      now,
      now,
    ),
    db.prepare(
      "UPDATE email_auth_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL",
    ).bind(now, challenge.id),
    db.prepare("DELETE FROM account_sessions WHERE expires_at <= ?").bind(now),
    db.prepare(
      `INSERT INTO account_sessions (token_digest, auth_user_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
    ).bind(session.tokenDigest, authUserId, session.createdAt, session.expiresAt),
  ]);

  return privateJson(
    { ok: true },
    { headers: { "set-cookie": sessionCookie(request, session.token) } },
  );
}

function safeEqualHex(first: string, second: string) {
  if (first.length !== second.length) return false;
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) {
    difference |= first.charCodeAt(index) ^ second.charCodeAt(index);
  }
  return difference === 0;
}
