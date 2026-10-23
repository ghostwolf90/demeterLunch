import {
  MAX_NICKNAME_LENGTH,
  MAX_PARENT_NAME_LENGTH,
  normalizeOptionalProfileText,
} from "@/lib/account-profile";
import {
  accountDatabase,
  authRequired,
  forbiddenMutation,
  getAccountUser,
  isSameOriginMutation,
  privateJson,
} from "@/lib/account-auth";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const user = await getAccountUser(request);
  if (!user) return authRequired();
  if (!isSameOriginMutation(request)) return forbiddenMutation();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "請重新確認填寫內容。" }, { status: 400 });
  }
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const name = normalizeOptionalProfileText(record.name, MAX_PARENT_NAME_LENGTH);
  const nickname = normalizeOptionalProfileText(record.nickname, MAX_NICKNAME_LENGTH);
  if (!name) return privateJson({ error: "請填寫 1–40 個字的家長姓名" }, { status: 400 });
  if (nickname === null) return privateJson({ error: "家長暱稱最多 20 個字" }, { status: 400 });

  try {
    const result = await accountDatabase().prepare(
      `UPDATE parent_accounts
       SET display_name = ?, nickname = ?, updated_at = ?
       WHERE auth_user_id = ?`,
    ).bind(name, nickname || null, new Date().toISOString(), user.id).run();
    if (!result.meta.changes) {
      return privateJson({ error: "找不到家庭帳號" }, { status: 404 });
    }
    return privateJson({ ok: true });
  } catch (error) {
    console.error("Unable to update parent profile", error);
    return privateJson({ error: "目前無法儲存家長資料，請稍後再試。" }, { status: 503 });
  }
}
