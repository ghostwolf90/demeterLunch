import { accountDatabase, getAccountUser, isAdultBirthDate, privateJson, digestSessionToken, sessionTokenFromRequest } from "@/lib/account-auth";
import { lineConfiguration } from "@/lib/line-auth";
import { lineAuthorizationUrl, oauthCookie, oauthDigest, randomOAuthValue, LINE_OAUTH_TTL } from "@/lib/line-oauth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return privateJson({ error: "請從好好吃飯網站重新開始登入。" }, { status: 403 });
  }
  const config = lineConfiguration(request);
  if (!config) return privateJson({ error: "LINE 登入尚未開放，請先使用 Email 登入。" }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return privateJson({ error: "請重新確認填寫內容。" }, { status: 400 }); }
  if (!body || typeof body !== "object") return privateJson({ error: "請重新確認填寫內容。" }, { status: 400 });
  const user = await getAccountUser(request);
  if (body.mode !== "login" && body.mode !== "link") return privateJson({ error: "請重新選擇登入方式。" }, { status: 400 });
  const linking = body.mode === "link";
  if (linking && !user) return privateJson({ error: "請先登入原本的家庭帳號，再綁定 LINE。" }, { status: 401 });
  if (!linking && user) return privateJson({ error: "目前已登入，請從家庭設定綁定 LINE。" }, { status: 409 });
  if (!linking && (!isAdultBirthDate(body.birthDate) || body.caregiverConfirmed !== true)) {
    return privateJson({ error: "請填寫成年照顧者出生日期，並勾選照顧者確認。" }, { status: 400 });
  }
  const state = randomOAuthValue();
  const browser = randomOAuthValue();
  const nonce = randomOAuthValue();
  const verifier = randomOAuthValue();
  const now = new Date();
  const db = accountDatabase();
  await db.batch([
    db.prepare("DELETE FROM oauth_challenges WHERE expires_at <= ?").bind(now.toISOString()),
    db.prepare(`INSERT INTO oauth_challenges
      (state_digest, browser_digest, nonce, code_verifier, auth_user_id, session_digest, eligibility_confirmed_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(await oauthDigest(state), await oauthDigest(browser), nonce, verifier, linking ? user!.id : null,
        linking ? await digestSessionToken(sessionTokenFromRequest(request)!) : null,
        now.toISOString(), new Date(now.getTime() + LINE_OAUTH_TTL * 1000).toISOString()),
  ]);
  return privateJson({ url: lineAuthorizationUrl(config.channelId, config.redirectUri, state, nonce, await oauthDigest(verifier)) },
    { headers: { "set-cookie": oauthCookie(request, browser) } });
}
