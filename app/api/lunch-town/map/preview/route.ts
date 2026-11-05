import { accountDatabase } from "@/lib/account-auth";
import { parseStoredTownMapManifest } from "@/lib/town-map-editor";

export const dynamic = "force-dynamic";

type TownMapPreviewRow = {
  manifest_json: string;
  focus_city: string;
  focus_district: string;
  focus_placement_id: string | null;
  expires_at: string;
};

const responseHeaders = {
  "cache-control": "private, no-store",
  "referrer-policy": "no-referrer",
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: responseHeaders });
}

async function tokenHash(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin
    || !request.headers.get("content-type")?.startsWith("application/json")) {
    return json({ error: "預覽請求無效。" }, 403);
  }
  let token = "";
  try {
    if (Number(request.headers.get("content-length")) > 2_000) throw new Error();
    const raw = await request.text();
    if (raw.length > 2_000) throw new Error();
    token = String(JSON.parse(raw)?.token || "");
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error();
  } catch {
    return json({ error: "預覽連結無效。" }, 400);
  }

  try {
    const row = await accountDatabase().prepare(
      `SELECT manifest_json, focus_city, focus_district, focus_placement_id, expires_at
       FROM town_map_previews WHERE token_hash = ?`,
    ).bind(await tokenHash(token)).first<TownMapPreviewRow>();
    if (!row) return json({ error: "找不到這份地圖預覽。" }, 404);
    if (row.expires_at <= new Date().toISOString()) return json({ error: "這份地圖預覽已過期，請回後台重新測試。" }, 410);
    return json({
      schemaVersion: 1,
      preview: true,
      expiresAt: row.expires_at,
      focus: { city: row.focus_city, district: row.focus_district, placementId: row.focus_placement_id },
      manifest: parseStoredTownMapManifest(row.manifest_json),
    });
  } catch (error) {
    console.error("Town map preview unavailable", error);
    return json({ error: "地圖預覽暫時無法取得。" }, 503);
  }
}
