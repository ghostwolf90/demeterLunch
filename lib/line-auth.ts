import { env } from "cloudflare:workers";
import { LINE_CALLBACK_PATH } from "./line-oauth";

export function lineConfiguration(request: Request) {
  const channelId = env.LINE_CHANNEL_ID?.trim();
  const secret = env.LINE_CHANNEL_SECRET?.trim();
  const redirectUri = env.LINE_REDIRECT_URI?.trim();
  if (!channelId || !secret || !redirectUri || !env.DB) return null;
  try {
    const callback = new URL(redirectUri);
    if (callback.protocol !== "https:" || callback.origin !== new URL(request.url).origin
      || callback.pathname !== LINE_CALLBACK_PATH || callback.search || callback.hash || callback.username || callback.password) return null;
  } catch { return null; }
  return { channelId, secret, redirectUri };
}
