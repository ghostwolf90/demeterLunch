export type MaintenanceEvent = { id: number; action: string; title: string; body: string; severity: string; created_at: string };
export function parseMaintenanceInput(value: unknown) {
  const v = value as Record<string, unknown> | null;
  if (!v || !["save", "publish", "withdraw"].includes(String(v.action))) throw new Error("請選擇有效的公告操作。");
  if (!Number.isSafeInteger(v.revision) || Number(v.revision) < 0) throw new Error("請重新載入公告後再試。");
  const title = typeof v.title === "string" ? v.title.trim() : "";
  const body = typeof v.body === "string" ? v.body.trim() : "";
  const severity = String(v.severity);
  if (!["info", "warning", "outage"].includes(severity)) throw new Error("請選擇公告類型。");
  if (title.length > 80 || body.length > 2000 || (v.action !== "withdraw" && (!title || !body))) throw new Error("請填寫標題（最多 80 字）與內容（最多 2,000 字）。");
  return { action: String(v.action), revision: Number(v.revision), title, body, severity };
}
