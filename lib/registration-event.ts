import { env } from "cloudflare:workers";
import { sessionTokenFromRequest } from "@/lib/account-auth";

const NAME = "demeter_registration_event";
const TTL = 600;

export async function registrationEventCookie(request: Request, session: string) {
  const issued = String(Date.now());
  const signature = await signatureFor(session, issued);
  return cookie(request, `${issued}.${signature}`, TTL);
}

export function clearRegistrationEventCookie(request: Request) {
  return cookie(request, "", 0);
}

export async function hasRegistrationEvent(request: Request) {
  const session = sessionTokenFromRequest(request);
  const value = (request.headers.get("cookie") || "").split(";")
    .map(part => part.trim()).find(part => part.startsWith(`${NAME}=`))?.slice(NAME.length + 1);
  if (!session || !value || !/^\d{13}\.[0-9a-f]{64}$/.test(value)) return false;
  const [issued, signature] = value.split(".");
  const age = Date.now() - Number(issued);
  if (age < 0 || age > TTL * 1000) return false;
  const expected = await signatureFor(session, issued);
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return difference === 0;
}

function cookie(request: Request, value: string, maxAge: number) {
  return `${NAME}=${value}; Path=/api/auth/registration-event; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}

async function signatureFor(session: string, issued: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.LINE_CHANNEL_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key,
    new TextEncoder().encode(`analytics-line-registration\n${session}\n${issued}`));
  return Array.from(new Uint8Array(signed), byte => byte.toString(16).padStart(2, "0")).join("");
}
