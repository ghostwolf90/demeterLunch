import { accountDatabase, privateJson } from "@/lib/account-auth";
import type { MaintenanceEvent } from "@/lib/operations";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const row = await accountDatabase().prepare("SELECT id, action, title, body, severity, created_at FROM maintenance_events WHERE action IN ('publish', 'withdraw') ORDER BY id DESC LIMIT 1").first<MaintenanceEvent>();
    return privateJson({ announcement: row?.action === "publish" ? row : null });
  } catch {
    return privateJson({ error: "公告暫時無法取得" }, { status: 503 });
  }
}
