import {
  accountDatabase,
  clearSessionCookie,
  digestSessionToken,
  forbiddenMutation,
  isSameOriginMutation,
  privateJson,
  sessionTokenFromRequest,
} from "@/lib/account-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return forbiddenMutation();
  const token = sessionTokenFromRequest(request);
  if (token && token.length <= 180) {
    await accountDatabase()
      .prepare("DELETE FROM account_sessions WHERE token_digest = ?")
      .bind(await digestSessionToken(token))
      .run();
  }
  return privateJson(
    { ok: true },
    { headers: { "set-cookie": clearSessionCookie(request) } },
  );
}
