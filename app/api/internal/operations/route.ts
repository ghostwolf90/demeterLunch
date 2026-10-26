import { env } from "cloudflare:workers";
import { authorizeManualPublisher } from "@/lib/manual-publish-auth";
import { accountDatabase, privateJson } from "@/lib/account-auth";
import { parseMaintenanceInput, type MaintenanceEvent } from "@/lib/operations";
export const dynamic = "force-dynamic";
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
    const now = new Date();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    const dayStart = new Date(`${today}T00:00:00+08:00`).toISOString();
    const sevenDays = new Date(now.getTime() - 7 * 86400000).toISOString();
    const thirtyDays = new Date(now.getTime() - 30 * 86400000).toISOString();
    const [accounts, usage, trend, history, active, sources] = await Promise.all([
      db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS today,
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS week,
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS month,
        SUM(CASE WHEN plan != 'free' AND subscription_status IN ('active','trialing') THEN 1 ELSE 0 END) AS paid
        FROM parent_accounts`).bind(dayStart, sevenDays, thirtyDays).first(),
      db.prepare(`SELECT (SELECT COUNT(*) FROM child_profiles) AS children,
        (SELECT COUNT(*) FROM food_encounters) AS encounters,
        (SELECT COUNT(*) FROM food_encounters WHERE created_at >= ?) AS recentEncounters,
        (SELECT COUNT(DISTINCT auth_user_id) FROM account_sessions WHERE created_at >= ?) AS recentSignIns,
        (SELECT COUNT(DISTINCT auth_user_id) FROM food_encounters WHERE created_at >= ?) AS recordingFamilies`).bind(sevenDays, sevenDays, sevenDays).first(),
      db.prepare("SELECT substr(datetime(created_at, '+8 hours'), 1, 10) AS day, COUNT(*) AS count FROM parent_accounts WHERE created_at >= ? GROUP BY day ORDER BY day").bind(thirtyDays).all(),
      db.prepare("SELECT id, action, title, body, severity, created_at FROM maintenance_events ORDER BY id DESC LIMIT 30").all<MaintenanceEvent>(),
      db.prepare("SELECT id, action, title, body, severity, created_at FROM maintenance_events WHERE action IN ('publish','withdraw') ORDER BY id DESC LIMIT 1").first<MaintenanceEvent>(),
      db.prepare("SELECT MAX(meal_date) AS latestMealDate, MAX(updated_at) AS latestUpdate FROM official_meal_records").first(),
    ]);
    return privateJson({ accounts, usage, trend: trend.results, history: history.results, revision: history.results[0]?.id || 0,
      active: active?.action === "publish" ? active : null, sources, generatedAt: now.toISOString() });
  } catch (error) {
    console.error("Operations overview unavailable", error);
    return privateJson({ error: "營運資料暫時無法取得，請稍後重試。" }, { status: 503 });
  }
}
export async function POST(request: Request) {
  const user = await authorize(request);
  if (user instanceof Response) return user;
  if (request.headers.get("origin") !== new URL(request.url).origin || !request.headers.get("content-type")?.startsWith("application/json")) {
    return privateJson({ error: "請從維護後台操作。" }, { status: 403 });
  }
  let input;
  try {
    if (Number(request.headers.get("content-length")) > 16000) throw new Error("公告內容過長。");
    const raw = await request.text();
    if (raw.length > 16000) throw new Error("公告內容過長。");
    input = parseMaintenanceInput(JSON.parse(raw));
  } catch (error) { return privateJson({ error: error instanceof Error ? error.message : "公告格式無效。" }, { status: 400 }); }
  try {
    const result = await accountDatabase().prepare(`INSERT INTO maintenance_events (action, title, body, severity, actor_id, created_at)
      SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COALESCE(MAX(id), 0) FROM maintenance_events) = ?`)
      .bind(input.action, input.title, input.body, input.severity, user.id, new Date().toISOString(), input.revision).run();
    if (!result.meta.changes) return privateJson({ error: "公告已在其他視窗更新，請重新載入再操作。" }, { status: 409 });
    return privateJson({ ok: true });
  } catch (error) {
    console.error("Maintenance write failed", error);
    return privateJson({ error: "公告未儲存，請稍後再試。" }, { status: 503 });
  }
}
