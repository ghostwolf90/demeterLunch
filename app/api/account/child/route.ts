import {
  accountDatabase,
  authRequired,
  forbiddenMutation,
  getAccountUser,
  isSameOriginMutation,
  privateJson,
} from "@/lib/account-auth";
import { findSchool } from "@/lib/schools";

const gradeGroups = new Set(["elementary_lower", "elementary_upper", "not_set"]);

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
  const nickname = typeof record.nickname === "string" ? record.nickname.trim() : "";
  const gradeGroup = typeof record.gradeGroup === "string" ? record.gradeGroup : "not_set";
  const schoolId = Number(record.schoolId);
  if (!nickname || nickname.length > 20) {
    return privateJson({ error: "請填寫 1–20 個字的孩子暱稱" }, { status: 400 });
  }
  if (!gradeGroups.has(gradeGroup)) {
    return privateJson({ error: "年級資料不正確" }, { status: 400 });
  }
  if (!Number.isInteger(schoolId) || !findSchool(schoolId)) {
    return privateJson({ error: "請選擇孩子就讀的國小" }, { status: 400 });
  }

  try {
    const db = accountDatabase();
    const now = new Date().toISOString();
    await db.batch([
      db.prepare(
        `INSERT INTO parent_accounts
          (auth_user_id, email, email_normalized, display_name, plan, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'free', ?, ?)
         ON CONFLICT(auth_user_id) DO UPDATE SET
           email = excluded.email,
           email_normalized = excluded.email_normalized,
           display_name = excluded.display_name,
           updated_at = excluded.updated_at`,
      ).bind(user.id, user.email, user.email, user.displayName, now, now),
      db.prepare(
        `INSERT INTO child_profiles
           (auth_user_id, nickname, grade_group, school_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(auth_user_id) DO UPDATE SET
           nickname = excluded.nickname,
           grade_group = excluded.grade_group,
           school_id = excluded.school_id,
           updated_at = excluded.updated_at`,
      ).bind(user.id, nickname, gradeGroup, schoolId, now, now),
    ]);
    return privateJson({ ok: true });
  } catch (error) {
    console.error("Unable to save child profile", error);
    return privateJson(
      { error: "孩子資料暫時無法儲存" },
      { status: 503 },
    );
  }
}
