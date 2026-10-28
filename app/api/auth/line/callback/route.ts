import { clearRegistrationEventCookie, registrationEventCookie } from "@/lib/registration-event";
import { accountDatabase, createSession, digestSessionToken, getAccountUser, sessionCookie, sessionTokenFromRequest } from "@/lib/account-auth";
import { lineConfiguration } from "@/lib/line-auth";
import { oauthBrowserToken, oauthCookie, oauthDigest, verifiedLineSubject } from "@/lib/line-oauth";

type Challenge = {
  nonce: string; code_verifier: string; auth_user_id: string | null;
  session_digest: string | null; eligibility_confirmed_at: string;
};
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const finish = (status: string, session?: string, registration?: string) => {
    const headers = new Headers({
      location: `/?account=1&line=${status}`, "cache-control": "private, no-store",
      "referrer-policy": "no-referrer",
    });
    headers.append("set-cookie", oauthCookie(request, "", true));
    headers.append("set-cookie", registration || clearRegistrationEventCookie(request));
    if (session) headers.append("set-cookie", sessionCookie(request, session));
    return new Response(null, { status: 303, headers });
  };
  const config = lineConfiguration(request);
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  const browser = oauthBrowserToken(request);
  if (!config || !browser || !/^[A-Za-z0-9_-]{43}$/.test(state)) return finish("expired");
  try {
    const db = accountDatabase();
    // Atomically consume the challenge before any exchange: retries cannot replay it.
    const challenge = await db.prepare(`DELETE FROM oauth_challenges
      WHERE state_digest = ? AND browser_digest = ? AND expires_at > ?
      RETURNING nonce, code_verifier, auth_user_id, session_digest, eligibility_confirmed_at`)
      .bind(await oauthDigest(state), await oauthDigest(browser), new Date().toISOString()).first<Challenge>();
    if (!challenge) return finish("expired");
    const user = await getAccountUser(request);
    if (challenge.auth_user_id) {
      const sessionToken = sessionTokenFromRequest(request);
      if (!user || user.id !== challenge.auth_user_id || !sessionToken
        || await digestSessionToken(sessionToken) !== challenge.session_digest) return finish("expired");
    } else if (user) return finish("expired");
    if (url.searchParams.has("error")) return finish("cancelled");
    const code = url.searchParams.get("code");
    if (!code || code.length > 2048) return finish("failed");
    const subject = await verifiedLineSubject({ code, verifier: challenge.code_verifier,
      nonce: challenge.nonce, ...config });
    const identity = await db.prepare("SELECT auth_user_id FROM account_identities WHERE provider = 'line' AND subject = ?")
      .bind(subject).first<{ auth_user_id: string }>();
    const now = new Date().toISOString();
    if (challenge.auth_user_id) {
      if (identity && identity.auth_user_id !== challenge.auth_user_id) return finish("conflict");
      const existingLink = await db.prepare("SELECT subject FROM account_identities WHERE provider = 'line' AND auth_user_id = ?")
        .bind(challenge.auth_user_id).first<{ subject: string }>();
      if (existingLink && existingLink.subject !== subject) return finish("conflict");
      if (!identity) await db.prepare(`INSERT INTO account_identities (provider, subject, auth_user_id, created_at)
        VALUES ('line', ?, ?, ?)`)
        .bind(subject, challenge.auth_user_id, now).run();
      return finish("linked");
    }
    const accountId = identity?.auth_user_id || `line_${crypto.randomUUID()}`;
    const session = await createSession();
    const statements: D1PreparedStatement[] = [];
    if (!identity) {
      statements.push(db.prepare(`INSERT INTO parent_accounts
        (auth_user_id, display_name, plan, subscription_status, onboarding_status,
         adult_verified_at, caregiver_confirmed_at, created_at, updated_at)
        VALUES (?, '家長', 'free', 'inactive', 'pending', ?, ?, ?, ?)`)
        .bind(accountId, challenge.eligibility_confirmed_at, challenge.eligibility_confirmed_at, now, now));
      statements.push(db.prepare(`INSERT INTO account_identities (provider, subject, auth_user_id, created_at)
        VALUES ('line', ?, ?, ?)`).bind(subject, accountId, now));
    }
    statements.push(db.prepare("DELETE FROM account_sessions WHERE expires_at <= ?").bind(now));
    statements.push(db.prepare(`INSERT INTO account_sessions (token_digest, auth_user_id, created_at, expires_at)
      VALUES (?, ?, ?, ?)`).bind(session.tokenDigest, accountId, session.createdAt, session.expiresAt));
    await db.batch(statements);
    return finish("success", session.token, !identity ? await registrationEventCookie(request, session.token) : undefined);
  } catch {
    // Do not log callback codes, provider tokens, secrets, or identity claims.
    console.error("LINE authentication could not be completed");
    return finish("failed");
  }
}
