import { env } from "cloudflare:workers";

export type AccountUser = {
  id: string;
  email: string;
  displayName: string;
};

type SessionUserRow = {
  auth_user_id: string;
  email: string;
  display_name: string | null;
};

export const SESSION_COOKIE = "demeter_family_session";
export const AUTH_CODE_TTL_MINUTES = 10;
export const AUTH_SESSION_TTL_DAYS = 30;

export async function getAccountUser(request: Request): Promise<AccountUser | null> {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!token || token.length > 180) return null;

  try {
    const row = await accountDatabase()
      .prepare(
        `SELECT p.auth_user_id, p.email, p.display_name
         FROM account_sessions AS s
         JOIN parent_accounts AS p ON p.auth_user_id = s.auth_user_id
         WHERE s.token_digest = ? AND s.expires_at > ?
         LIMIT 1`,
      )
      .bind(await digestSessionToken(token), new Date().toISOString())
      .first<SessionUserRow>();
    if (!row?.email) return null;
    return {
      id: row.auth_user_id,
      email: row.email,
      displayName: row.display_name?.trim() || "家長",
    };
  } catch (error) {
    console.error("Unable to resolve family session", error);
    return null;
  }
}

export function accountDatabase(): D1Database {
  if (!env.DB) throw new Error("帳號資料庫尚未連接");
  return env.DB;
}

export function emailAuthReady(request: Request) {
  return Boolean(
    env.EMAIL_AUTH_SECRET?.trim()
      && (
        localAuthCode(request)
          || (env.RESEND_API_KEY?.trim() && env.AUTH_EMAIL_FROM?.trim())
      ),
  );
}

export function localAuthCode(request: Request) {
  const hostname = new URL(request.url).hostname;
  const devCode = env.EMAIL_AUTH_DEV_CODE?.trim();
  return (hostname === "127.0.0.1" || hostname === "localhost") && /^\d{6}$/.test(devCode || "")
    ? devCode as string
    : null;
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || /[\u0000-\u0020\u007f]/.test(email)) return null;
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return null;
  return email;
}

export function isAdultBirthDate(value: unknown, now = new Date()): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
      || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day
      || year < 1900
  ) return false;

  const todayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const today = Object.fromEntries(
    todayParts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
  const adultCutoff = `${today.year - 18}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;
  return value <= adultCutoff;
}

export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"•".repeat(Math.max(2, Math.min(6, name.length - visible.length)))}@${domain}`;
}

export function createVerificationCode() {
  const maximum = 0x100000000;
  const ceiling = maximum - (maximum % 1_000_000);
  const values = new Uint32Array(1);
  do crypto.getRandomValues(values); while (values[0] >= ceiling);
  return String(values[0] % 1_000_000).padStart(6, "0");
}

export async function digestVerificationCode(
  challengeId: string,
  email: string,
  code: string,
) {
  return hmacHex(`code\n${challengeId}\n${email}\n${code}`);
}

export async function requestKey(request: Request) {
  const forwarded = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]
    || "unknown";
  return hmacHex(`request\n${forwarded.trim()}`);
}

export async function authUserIdForEmail(email: string) {
  return `email_${(await hmacHex(`user\n${email}`)).slice(0, 40)}`;
}

export async function createSession() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = bytesToBase64Url(bytes);
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + AUTH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  return {
    token,
    tokenDigest: await digestSessionToken(token),
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function digestSessionToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return bytesToHex(new Uint8Array(digest));
}

export function sessionTokenFromRequest(request: Request) {
  return readCookie(request.headers.get("cookie"), SESSION_COOKIE);
}

export function sessionCookie(request: Request, token: string) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${AUTH_SESSION_TTL_DAYS * 24 * 60 * 60}${secure}`;
}

export function clearSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export async function sendVerificationEmail(email: string, code: string, challengeId: string, request: Request) {
  if (localAuthCode(request)) return;
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.AUTH_EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error("Email delivery is not configured");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "idempotency-key": `demeter-${challengeId}`,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "好好吃飯登入驗證碼",
      text: `您的好好吃飯登入驗證碼是 ${code}。驗證碼將在 ${AUTH_CODE_TTL_MINUTES} 分鐘後失效。若不是您本人操作，請忽略這封信。`,
      html: `<div style="font-family:system-ui,sans-serif;color:#153447;line-height:1.7"><h1 style="font-size:22px">好好吃飯</h1><p>您的登入驗證碼是：</p><p style="font-size:32px;font-weight:800;letter-spacing:.18em">${code}</p><p>驗證碼將在 ${AUTH_CODE_TTL_MINUTES} 分鐘後失效。若不是您本人操作，請忽略這封信。</p></div>`,
    }),
  });
  if (!response.ok) {
    console.error("Verification email delivery failed", response.status);
    throw new Error("Unable to deliver verification email");
  }
}

export function isSameOriginMutation(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function privateJson(
  body: unknown,
  init: ResponseInit & { status?: number } = {},
) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "private, no-store");
  headers.set("vary", "Cookie");
  return Response.json(body, { ...init, headers });
}

export function authRequired() {
  return privateJson(
    { error: "請先免費登入後再使用這項功能", code: "AUTH_REQUIRED" },
    { status: 401 },
  );
}

export function forbiddenMutation() {
  return privateJson(
    { error: "無法驗證這次操作的來源", code: "INVALID_ORIGIN" },
    { status: 403 },
  );
}

function readCookie(cookieHeader: string | null, name: string) {
  for (const part of cookieHeader?.split(";") || []) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) return rawValue.join("=");
  }
  return null;
}

async function hmacHex(value: string) {
  const secret = env.EMAIL_AUTH_SECRET?.trim();
  if (!secret) throw new Error("Email authentication secret is not configured");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}
