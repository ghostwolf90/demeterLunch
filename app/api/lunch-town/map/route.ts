import { accountDatabase } from "@/lib/account-auth";
import { emptyTownMapManifest, parseStoredTownMapManifest, type TownMapRevision } from "@/lib/town-map-editor";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const row = await accountDatabase().prepare(
      "SELECT id, manifest_json, created_at FROM town_map_revisions WHERE action = 'publish' ORDER BY id DESC LIMIT 1",
    ).first<Pick<TownMapRevision, "id" | "manifest_json" | "created_at">>();
    return Response.json(
      {
        schemaVersion: 1,
        revision: row?.id || 0,
        publishedAt: row?.created_at || null,
        manifest: row ? parseStoredTownMapManifest(row.manifest_json) : emptyTownMapManifest(),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Published town map unavailable", error);
    return Response.json(
      { error: "午餐小鎮地圖設定暫時無法取得。" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
