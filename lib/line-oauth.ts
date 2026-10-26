// No provider tokens or profile data are persisted in browser storage.
export const LINE_CALLBACK_PATH = "/api/auth/line/callback";
export const LINE_OAUTH_COOKIE = "demeter_line_oauth";
export const LINE_OAUTH_TTL = 600;

export function randomOAuthValue() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64Url(bytes);
}

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function oauthDigest(value: string) {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

export function lineAuthorizationUrl(channelId: string, redirectUri: string, state: string, nonce: string, challenge: string) {
  const url = new URL("https://access.line.me/oauth2/v2.1/authorize");
  url.search = new URLSearchParams({
    response_type: "code", client_id: channelId, redirect_uri: redirectUri,
    state, nonce, scope: "openid", code_challenge: challenge, code_challenge_method: "S256",
    ui_locales: "zh-TW",
  }).toString();
  return url.toString();
}

export function oauthCookie(request: Request, value: string, clear = false) {
  return `${LINE_OAUTH_COOKIE}=${value}; Path=/api/auth/line; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : LINE_OAUTH_TTL}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}

export function oauthBrowserToken(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const value = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${LINE_OAUTH_COOKIE}=`))?.slice(LINE_OAUTH_COOKIE.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export async function verifiedLineSubject(options: {
  code: string; verifier: string; nonce: string; channelId: string; secret: string; redirectUri: string;
}, fetcher: typeof fetch = fetch) {
  const tokenResponse = await fetcher("https://api.line.me/oauth2/v2.1/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    signal: AbortSignal.timeout(10000),
    body: new URLSearchParams({
      grant_type: "authorization_code", code: options.code, code_verifier: options.verifier,
      client_id: options.channelId, client_secret: options.secret, redirect_uri: options.redirectUri,
    }),
  });
  if (!tokenResponse.ok) throw new Error("LINE token exchange failed");
  const token = await tokenResponse.json() as { id_token?: unknown };
  if (typeof token.id_token !== "string") throw new Error("Missing LINE ID token");
  // LINE verifies the signature, issuer, audience, expiry, and supplied nonce server-side.
  const verification = await fetcher("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    signal: AbortSignal.timeout(10000),
    body: new URLSearchParams({ id_token: token.id_token, client_id: options.channelId, nonce: options.nonce }),
  });
  if (!verification.ok) throw new Error("LINE ID token verification failed");
  const claims = await verification.json() as { sub?: unknown; aud?: unknown; iss?: unknown; exp?: unknown; nonce?: unknown };
  if (claims.aud !== options.channelId || claims.iss !== "https://access.line.me"
    || claims.nonce !== options.nonce || typeof claims.exp !== "number" || claims.exp <= Date.now() / 1000
    || typeof claims.sub !== "string" || !/^U[0-9a-f]{32}$/.test(claims.sub)) {
    throw new Error("Invalid LINE identity");
  }
  return claims.sub;
}
