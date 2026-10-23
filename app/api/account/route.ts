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

type AccountPreferenceRow = {
  default_school_id: number | null;
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
  reactions: string | null;
  child_quote: string | null;
  first_encounter: number | null;
  preparation: string | null;
  note: string | null;
  created_at: string;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAccountUser(request);
  if (!user) {
    return privateJson({
      authenticated: false,
      user: null,
      child: null,
      defaultSchoolId: null,
      encounters: [],
    });
  }

  try {
    const db = accountDatabase();
    const [accountPreferences, child] = await Promise.all([
      db
      .prepare("SELECT default_school_id FROM parent_accounts WHERE auth_user_id = ? LIMIT 1")
      .bind(user.id)
      .first<AccountPreferenceRow>(),
      db
      .prepare(
        `SELECT id, nickname, grade_group, school_id, created_at, updated_at
         FROM child_profiles
         WHERE auth_user_id = ?
         ORDER BY id
         LIMIT 1`,
      )
      .bind(user.id)
      .first<ChildRow>(),
    ]);
    const [encounters, encounterCount] = child
      ? await Promise.all([
          db
            .prepare(
              `SELECT id, meal_date, school_id, meal_type, meal_context, dish_name, food_name, experience,
                      reactions, child_quote, first_encounter, preparation, note, created_at
               FROM food_encounters
               WHERE auth_user_id = ? AND child_id = ?
               ORDER BY meal_date DESC, created_at DESC, id DESC
               LIMIT 5`,
            )
            .bind(user.id, child.id)
            .all<EncounterRow>(),
          db
            .prepare(
              `SELECT COUNT(*) AS count
               FROM food_encounters
               WHERE auth_user_id = ? AND child_id = ?`,
            )
            .bind(user.id, child.id)
            .first<{ count: number }>(),
        ])
      : [{ results: [] as EncounterRow[] }, { count: 0 }];

    return privateJson({
      authenticated: true,
      user,
      plan: "free",
      defaultSchoolId: accountPreferences?.default_school_id ?? null,
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
        reactions: parseReactions(item.reactions),
        childQuote: item.child_quote,
        firstEncounter: item.first_encounter === null ? null : item.first_encounter === 1,
        preparation: item.preparation,
        note: item.note,
        createdAt: item.created_at,
      })),
      encounterCount: encounterCount?.count ?? 0,
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

function parseReactions(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
