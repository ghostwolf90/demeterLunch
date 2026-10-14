import {
  accountDatabase,
  getAccountUser,
  privateJson,
} from "@/lib/account-auth";

type ChildRow = {
  id: number;
  nickname: string;
  grade_group: string;
  school_id: number | null;
  created_at: string;
  updated_at: string;
};

type EncounterRow = {
  id: number;
  meal_date: string;
  school_id: number | null;
  meal_type: string;
  meal_context: string;
  dish_name: string | null;
  food_name: string;
  experience: string;
  preparation: string | null;
  note: string | null;
  created_at: string;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAccountUser(request);
  if (!user) {
    return privateJson({ authenticated: false, user: null, child: null, encounters: [] });
  }

  try {
    const db = accountDatabase();
    const child = await db
      .prepare(
        `SELECT id, nickname, grade_group, school_id, created_at, updated_at
         FROM child_profiles
         WHERE auth_user_id = ?
         ORDER BY id
         LIMIT 1`,
      )
      .bind(user.id)
      .first<ChildRow>();
    const encounters = child
      ? await db
          .prepare(
            `SELECT id, meal_date, school_id, meal_type, meal_context, dish_name, food_name, experience, preparation, note, created_at
             FROM food_encounters
             WHERE auth_user_id = ? AND child_id = ?
             ORDER BY created_at DESC, id DESC
             LIMIT 12`,
          )
          .bind(user.id, child.id)
          .all<EncounterRow>()
      : { results: [] as EncounterRow[] };

    return privateJson({
      authenticated: true,
      user,
      plan: "free",
      child: child
        ? {
            id: child.id,
            nickname: child.nickname,
            gradeGroup: child.grade_group,
            schoolId: child.school_id,
            createdAt: child.created_at,
            updatedAt: child.updated_at,
          }
        : null,
      encounters: encounters.results.map((item) => ({
        id: item.id,
        mealDate: item.meal_date,
        schoolId: item.school_id ?? child?.school_id ?? null,
        mealType: item.meal_type === "vegetarian" ? "vegetarian" : "meat",
        mealContext: item.meal_context === "school_lunch" || item.meal_context === "other"
          ? item.meal_context
          : "unknown",
        dishName: item.dish_name,
        foodName: item.food_name,
        experience: item.experience,
        preparation: item.preparation,
        note: item.note,
        createdAt: item.created_at,
      })),
    });
  } catch (error) {
    console.error("Unable to load private account data", error);
    return privateJson(
      {
        error: "帳號資料暫時無法讀取",
        code: "ACCOUNT_UNAVAILABLE",
      },
      { status: 503 },
    );
  }
}
