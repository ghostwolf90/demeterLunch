import {
  accountDatabase,
  authRequired,
  forbiddenMutation,
  getAccountUser,
  isSameOriginMutation,
  privateJson,
} from "@/lib/account-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getAccountUser(request);
  if (!user) return authRequired();
  if (!isSameOriginMutation(request)) return forbiddenMutation();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "請重新確認操作內容。" }, { status: 400 });
  }
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const action = record.action;
  if (action !== "start" && action !== "skip") {
    return privateJson({ error: "首次設定操作不正確。" }, { status: 400 });
  }

  try {
    const db = accountDatabase();
    const now = new Date().toISOString();
    if (action === "start") {
      const result = await db.prepare(
        `UPDATE parent_accounts
         SET onboarding_started_at = ?, updated_at = ?
         WHERE auth_user_id = ?
           AND onboarding_status = 'pending'
           AND onboarding_started_at IS NULL`,
      ).bind(now, now, user.id).run();
      return privateJson({ ok: true, status: "pending", shouldTrack: result.meta.changes === 1 });
    }

    const result = await db.prepare(
      `UPDATE parent_accounts
       SET onboarding_status = 'skipped', updated_at = ?
       WHERE auth_user_id = ? AND onboarding_status = 'pending'`,
    ).bind(now, user.id).run();
    return privateJson({ ok: true, status: "skipped", shouldTrack: result.meta.changes === 1 });
  } catch (error) {
    console.error("Unable to update account onboarding", error);
    return privateJson(
      { error: "目前無法更新首次設定狀態，請稍後再試。" },
      { status: 503 },
    );
  }
}
