import {
  accountDatabase,
  authRequired,
  forbiddenMutation,
  getAccountUser,
  isSameOriginMutation,
  privateJson,
} from "@/lib/account-auth";
import { findSchool } from "@/lib/schools";
import { accountPlanDetails } from "@/lib/account-plan";
import {
  MAX_NICKNAME_LENGTH,
  normalizeOptionalProfileText,
} from "@/lib/account-profile";
import { normalizeAllergenCodes } from "@/lib/allergens";

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
    return privateJson({ error: "請重新確認填寫內容。" }, { status: 400 });
  }

  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const childId = optionalChildId(record.childId);
  const nickname = normalizeOptionalProfileText(record.nickname, MAX_NICKNAME_LENGTH);
  const gradeGroup = typeof record.gradeGroup === "string" ? record.gradeGroup : "not_set";
  const schoolId = Number(record.schoolId);
  const allergenCodes = normalizeAllergenCodes(record.allergenCodes);
  const onboarding = record.onboarding === true;
  if (record.childId !== null && record.childId !== undefined && record.childId !== "" && childId === null) {
    return privateJson({ error: "孩子資料有誤，請重新確認。" }, { status: 400 });
  }
  if (!nickname) return privateJson({ error: "請填寫 1–20 個字的孩子暱稱" }, { status: 400 });
  if (!gradeGroups.has(gradeGroup)) {
    return privateJson({ error: "年級資料不正確" }, { status: 400 });
  }
  if (!Number.isInteger(schoolId) || !findSchool(schoolId)) {
    return privateJson({ error: "請選擇孩子就讀的國小" }, { status: 400 });
  }
  if (allergenCodes === null) {
    return privateJson({ error: "需要留意的食物資料不正確" }, { status: 400 });
  }

  try {
    const db = accountDatabase();
    const now = new Date().toISOString();
    await db.prepare(
        `INSERT INTO parent_accounts
          (auth_user_id, email, email_normalized, display_name, plan, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'free', ?, ?)
         ON CONFLICT(auth_user_id) DO UPDATE SET
           email = excluded.email,
           email_normalized = excluded.email_normalized,
           display_name = excluded.display_name,
           updated_at = excluded.updated_at`,
      ).bind(user.id, user.email, user.email, user.displayName, now, now)
      .run();

    if (childId !== null) {
      const result = await db.prepare(
        `UPDATE child_profiles
         SET nickname = ?, grade_group = ?, school_id = ?, allergen_codes = ?, updated_at = ?
         WHERE id = ? AND auth_user_id = ?`,
      ).bind(nickname, gradeGroup, schoolId, JSON.stringify(allergenCodes), now, childId, user.id).run();
      if (!result.meta.changes) {
        return privateJson({ error: "找不到這位孩子", code: "CHILD_NOT_FOUND" }, { status: 404 });
      }
      return privateJson({ ok: true, childId });
    }

    const account = await db
      .prepare("SELECT plan, onboarding_status FROM parent_accounts WHERE auth_user_id = ? LIMIT 1")
      .bind(user.id)
      .first<{ plan: string; onboarding_status: string }>();
    const plan = accountPlanDetails(account?.plan);
    if (onboarding && account?.onboarding_status !== "pending") {
      const existingChild = await firstOwnedChild(db, user.id);
      if (existingChild) {
        return privateJson({
          ok: true,
          childId: existingChild.id,
          reused: true,
          onboardingCompleted: false,
        });
      }
      return privateJson(
        { error: "首次設定狀態已更新，請重新整理家庭帳號。", code: "ONBOARDING_NOT_PENDING" },
        { status: 409 },
      );
    }

    const insert = onboarding
      ? db.prepare(
          `INSERT INTO child_profiles
             (auth_user_id, name, nickname, grade_group, school_id, allergen_codes, created_at, updated_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?
           WHERE (SELECT onboarding_status FROM parent_accounts WHERE auth_user_id = ?) = 'pending'
             AND NOT EXISTS (SELECT 1 FROM child_profiles WHERE auth_user_id = ?)
             AND (SELECT COUNT(*) FROM child_profiles WHERE auth_user_id = ?) < ?`,
        ).bind(
          user.id,
          null,
          nickname,
          gradeGroup,
          schoolId,
          JSON.stringify(allergenCodes),
          now,
          now,
          user.id,
          user.id,
          user.id,
          plan.childLimit,
        )
      : db.prepare(
          `INSERT INTO child_profiles
             (auth_user_id, name, nickname, grade_group, school_id, allergen_codes, created_at, updated_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?
           WHERE (SELECT COUNT(*) FROM child_profiles WHERE auth_user_id = ?) < ?`,
        ).bind(
          user.id,
          null,
          nickname,
          gradeGroup,
          schoolId,
          JSON.stringify(allergenCodes),
          now,
          now,
          user.id,
          plan.childLimit,
        );
    const [result, onboardingResult] = await db.batch([
      insert,
      db.prepare(
        `UPDATE parent_accounts
         SET onboarding_status = 'completed', updated_at = ?
         WHERE auth_user_id = ?
           AND onboarding_status = 'pending'
           AND EXISTS (SELECT 1 FROM child_profiles WHERE auth_user_id = ?)`,
      ).bind(now, user.id, user.id),
    ]);
    if (!result.meta.changes) {
      const existingChild = onboarding ? await firstOwnedChild(db, user.id) : null;
      if (existingChild) {
        return privateJson({
          ok: true,
          childId: existingChild.id,
          reused: true,
          onboardingCompleted: onboardingResult.meta.changes === 1,
        });
      }
      return privateJson({
        error: plan.id === "free"
          ? "目前的免費家庭帳號最多可建立 1 位孩子；其他家庭功能若有調整，將另行公告。"
          : "家庭方案最多可建立 3 位孩子。",
        code: "CHILD_LIMIT_REACHED",
        plan: plan.id,
        childLimit: plan.childLimit,
      }, { status: 409 });
    }
    return privateJson({
      ok: true,
      childId: Number(result.meta.last_row_id),
      onboardingCompleted: onboardingResult.meta.changes === 1,
    }, { status: 201 });
  } catch (error) {
    console.error("Unable to save child profile", error);
    return privateJson(
      { error: "目前無法儲存孩子資料，請稍後再試。" },
      { status: 503 },
    );
  }
}

async function firstOwnedChild(db: D1Database, authUserId: string) {
  return db.prepare(
    "SELECT id FROM child_profiles WHERE auth_user_id = ? ORDER BY id LIMIT 1",
  ).bind(authUserId).first<{ id: number }>();
}

function optionalChildId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const childId = Number(value);
  return Number.isInteger(childId) && childId > 0 ? childId : null;
}
