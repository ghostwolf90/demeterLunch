import { env } from "cloudflare:workers";
import { accountDatabase, privateJson } from "@/lib/account-auth";
import { authorizeManualPublisher } from "@/lib/manual-publish-auth";
import {
  parseStoredTownMapManifest,
  parseTownMapEditorInput,
  townMapEditorCatalog,
  townMapManifestSummary,
  TOWN_MAP_MAX_BYTES,
  type TownMapRevision,
} from "@/lib/town-map-editor";

export const dynamic = "force-dynamic";
const PREVIEW_LIFETIME_MS = 30 * 60 * 1000;

function previewToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function tokenHash(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function authorize(request: Request) {
  try {
    await authorizeManualPublisher(request, env.MAINTENANCE_API_TOKEN);
    return { id: "operations-owner" };
  } catch {
    return privateJson({ error: "無法驗證後台資料連線。" }, { status: 403 });
  }
}

export async function GET(request: Request) {
  const user = await authorize(request);
  if (user instanceof Response) return user;
  try {
    const db = accountDatabase();
    const requestedRevision = new URL(request.url).searchParams.get("revision");
    if (requestedRevision !== null) {
      const revision = Number(requestedRevision);
      if (!Number.isSafeInteger(revision) || revision < 1) return privateJson({ error: "地圖版本無效。" }, { status: 400 });
      const row = await db.prepare(
        "SELECT id, action, manifest_json, summary_json, actor_id, created_at FROM town_map_revisions WHERE id = ?",
      ).bind(revision).first<TownMapRevision>();
      if (!row) return privateJson({ error: "找不到這個地圖版本。" }, { status: 404 });
      return privateJson({
        schemaVersion: 1,
        revision: row.id,
        action: row.action,
        manifest: parseStoredTownMapManifest(row.manifest_json),
        summary: JSON.parse(row.summary_json),
        createdAt: row.created_at,
      });
    }

    const [latest, published, history] = await Promise.all([
      db.prepare("SELECT id, action, manifest_json, summary_json, actor_id, created_at FROM town_map_revisions ORDER BY id DESC LIMIT 1").first<TownMapRevision>(),
      db.prepare("SELECT id, action, manifest_json, summary_json, actor_id, created_at FROM town_map_revisions WHERE action = 'publish' ORDER BY id DESC LIMIT 1").first<TownMapRevision>(),
      db.prepare("SELECT id, action, summary_json, created_at FROM town_map_revisions ORDER BY id DESC LIMIT 30").all<{ id: number; action: string; summary_json: string; created_at: string }>(),
    ]);
    return privateJson({
      schemaVersion: 1,
      revision: latest?.id || 0,
      publishedRevision: published?.id || 0,
      manifest: parseStoredTownMapManifest(latest?.manifest_json),
      catalog: townMapEditorCatalog(),
      history: history.results.map((row) => ({
        id: row.id,
        action: row.action,
        summary: JSON.parse(row.summary_json),
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("Town map editor state unavailable", error);
    return privateJson({ error: "地圖編輯資料暫時無法取得，請稍後重試。" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await authorize(request);
  if (user instanceof Response) return user;
  if (request.headers.get("origin") !== new URL(request.url).origin
    || !request.headers.get("content-type")?.startsWith("application/json")) {
    return privateJson({ error: "請從維護後台操作。" }, { status: 403 });
  }

  let input: ReturnType<typeof parseTownMapEditorInput>;
  try {
    if (Number(request.headers.get("content-length")) > TOWN_MAP_MAX_BYTES) throw new Error("地圖資料過大。");
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > TOWN_MAP_MAX_BYTES) throw new Error("地圖資料過大。");
    input = parseTownMapEditorInput(JSON.parse(raw));
  } catch (error) {
    return privateJson({ error: error instanceof Error ? error.message : "地圖資料格式無效。" }, { status: 400 });
  }

  try {
    const manifestJson = JSON.stringify(input.manifest);
    if (input.action === "preview" && input.focus) {
      const token = previewToken();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + PREVIEW_LIFETIME_MS).toISOString();
      const db = accountDatabase();
      await db.prepare("DELETE FROM town_map_previews WHERE expires_at <= ?").bind(now.toISOString()).run();
      await db.prepare(
        `INSERT INTO town_map_previews
         (token_hash, manifest_json, focus_city, focus_district, focus_placement_id, actor_id, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        await tokenHash(token), manifestJson, input.focus.city, input.focus.district, input.focus.placementId,
        user.id, expiresAt, now.toISOString(),
      ).run();
      return privateJson({ ok: true, previewToken: token, expiresAt, focus: input.focus });
    }
    const summaryJson = JSON.stringify(townMapManifestSummary(input.manifest));
    const result = await accountDatabase().prepare(
      `INSERT INTO town_map_revisions (action, manifest_json, summary_json, actor_id, created_at)
       SELECT ?, ?, ?, ?, ? WHERE (SELECT COALESCE(MAX(id), 0) FROM town_map_revisions) = ?`,
    ).bind(input.action, manifestJson, summaryJson, user.id, new Date().toISOString(), input.revision).run();
    if (!result.meta.changes) return privateJson({ error: "地圖已在其他視窗更新，請重新載入再操作。" }, { status: 409 });
    return privateJson({ ok: true, revision: Number(result.meta.last_row_id), summary: JSON.parse(summaryJson) });
  } catch (error) {
    console.error("Town map editor write failed", error);
    return privateJson({ error: "地圖未儲存，請稍後再試。" }, { status: 503 });
  }
}
