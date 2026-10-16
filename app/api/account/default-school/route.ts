import {
  accountDatabase,
  authRequired,
  forbiddenMutation,
  getAccountUser,
  isSameOriginMutation,
  privateJson,
} from "@/lib/account-auth";
import { findSchool } from "@/lib/schools";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const user = await getAccountUser(request);
  if (!user) return authRequired();
  if (!isSameOriginMutation(request)) return forbiddenMutation();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "資料格式不正確" }, { status: 400 });
  }
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const schoolId = Number(record.schoolId);
  if (!Number.isInteger(schoolId) || !findSchool(schoolId)) {
    return privateJson({ error: "請選擇有效的國小" }, { status: 400 });
  }

  try {
    await accountDatabase()
      .prepare("UPDATE parent_accounts SET default_school_id = ?, updated_at = ? WHERE auth_user_id = ?")
      .bind(schoolId, new Date().toISOString(), user.id)
      .run();
    return privateJson({ ok: true, defaultSchoolId: schoolId });
  } catch (error) {
    console.error("Unable to save default school", error);
    return privateJson({ error: "預設學校暫時無法儲存" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const user = await getAccountUser(request);
  if (!user) return authRequired();
  if (!isSameOriginMutation(request)) return forbiddenMutation();

  try {
    await accountDatabase()
      .prepare("UPDATE parent_accounts SET default_school_id = NULL, updated_at = ? WHERE auth_user_id = ?")
      .bind(new Date().toISOString(), user.id)
      .run();
    return privateJson({ ok: true, defaultSchoolId: null });
  } catch (error) {
    console.error("Unable to clear default school", error);
    return privateJson({ error: "預設學校暫時無法取消" }, { status: 503 });
  }
}
