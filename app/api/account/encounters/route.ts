import {
  accountDatabase,
  authRequired,
  forbiddenMutation,
  getAccountUser,
  isSameOriginMutation,
  privateJson,
} from "@/lib/account-auth";

const experiences = new Set([
  "not_tried", "seen", "smelled", "touched", "tasted", "ate_some", "accepted", "liked",
]);
const reactionOptions = new Set([
  "liked", "okay", "disliked", "wants_more", "willing_retry", "avoid_next_time", "no_comment", "other",
]);
const mealTypes = new Set(["meat", "vegetarian"]);
const mealContexts = new Set(["school_lunch", "other"]);
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

type ChildRow = { id: number; school_id: number | null };

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
  if (!user) return authRequired();

  try {
    const db = accountDatabase();
    const child = await db
      .prepare("SELECT id, school_id FROM child_profiles WHERE auth_user_id = ? ORDER BY id LIMIT 1")
      .bind(user.id)
      .first<ChildRow>();
    if (!child) {
      return privateJson({ encounters: [], encounterCount: 0 });
    }
    const encounters = await db
      .prepare(
        `SELECT id, meal_date, school_id, meal_type, meal_context, dish_name, food_name, experience,
                reactions, child_quote, first_encounter, preparation, note, created_at
         FROM food_encounters
         WHERE auth_user_id = ? AND child_id = ?
         ORDER BY meal_date DESC, created_at DESC, id DESC`,
      )
      .bind(user.id, child.id)
      .all<EncounterRow>();
    return privateJson({
      encounters: encounters.results.map((item) => ({
        id: item.id,
        mealDate: item.meal_date,
        schoolId: item.school_id ?? child.school_id ?? null,
        mealType: item.meal_type === "vegetarian" ? "vegetarian" : "meat",
        mealContext: item.meal_context === "school_lunch" || item.meal_context === "other"
          ? item.meal_context
          : "unknown",
        dishName: item.dish_name,
        foodName: item.food_name,
        experience: item.experience,
        reactions: parseStoredReactions(item.reactions),
        childQuote: item.child_quote,
        firstEncounter: item.first_encounter === null ? null : item.first_encounter === 1,
        preparation: item.preparation,
        note: item.note,
        createdAt: item.created_at,
      })),
      encounterCount: encounters.results.length,
    });
  } catch (error) {
    console.error("Unable to load food encounters", error);
    return privateJson({ error: "午餐紀錄暫時無法讀取" }, { status: 503 });
  }
}

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
  const mealDate = typeof record.mealDate === "string" ? record.mealDate : "";
  const foodName = typeof record.foodName === "string" ? record.foodName.trim() : "";
  const experience = typeof record.experience === "string" ? record.experience : "";
  const mealType = typeof record.mealType === "string" ? record.mealType : "meat";
  const mealContext = typeof record.mealContext === "string" ? record.mealContext : "";
  const dishName = optionalText(record.dishName, 80);
  const reactions = validReactions(record.reactions);
  const childQuote = optionalText(record.childQuote, 160);
  const firstEncounter = record.firstEncounter === true;
  const preparation = optionalText(record.preparation, 80);
  const note = optionalText(record.note, 240);
  if (!isoDatePattern.test(mealDate)) {
    return privateJson({ error: "供餐日期不正確" }, { status: 400 });
  }
  if (!foodName || foodName.length > 80) {
    return privateJson({ error: "請選擇 1–80 個字的食物或菜色" }, { status: 400 });
  }
  if (!experiences.has(experience)) {
    return privateJson({ error: "請選擇孩子這次的食物經驗" }, { status: 400 });
  }
  if (reactions === undefined) {
    return privateJson({ error: "孩子感受的選項不正確" }, { status: 400 });
  }
  if (reactions.includes("no_comment") && reactions.length > 1) {
    return privateJson({ error: "「沒有特別說」不能和其他感受一起選擇" }, { status: 400 });
  }
  if (!mealTypes.has(mealType)) {
    return privateJson({ error: "午餐餐別不正確" }, { status: 400 });
  }
  if (!mealContexts.has(mealContext)) {
    return privateJson({ error: "請選擇食物是從哪裡遇到的" }, { status: 400 });
  }
  if (dishName === undefined || childQuote === undefined || preparation === undefined || note === undefined) {
    return privateJson({ error: "補充文字過長" }, { status: 400 });
  }
  if (mealContext === "school_lunch" && !dishName) {
    return privateJson({ error: "請選擇這筆食物來自哪一道午餐菜色" }, { status: 400 });
  }
  if (mealContext === "other" && dishName) {
    return privateJson({ error: "非學校午餐紀錄不應指定午餐菜色" }, { status: 400 });
  }

  try {
    const db = accountDatabase();
    const child = await db
      .prepare("SELECT id, school_id FROM child_profiles WHERE auth_user_id = ? ORDER BY id LIMIT 1")
      .bind(user.id)
      .first<ChildRow>();
    if (!child) {
      return privateJson({ error: "請先建立孩子資料", code: "CHILD_REQUIRED" }, { status: 409 });
    }
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO food_encounters
           (child_id, auth_user_id, meal_date, school_id, meal_type, meal_context, dish_name, food_name,
            experience, reactions, child_quote, first_encounter, preparation, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        child.id,
        user.id,
        mealDate,
        child.school_id,
        mealType,
        mealContext,
        dishName,
        foodName,
        experience,
        JSON.stringify(reactions),
        childQuote,
        firstEncounter ? 1 : 0,
        preparation,
        note,
        now,
      )
      .run();
    return privateJson({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Unable to save food encounter", error);
    return privateJson(
      { error: "食物紀錄暫時無法儲存" },
      { status: 503 },
    );
  }
}

function validReactions(value: unknown): string[] | undefined {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value) || value.length > reactionOptions.size) return undefined;
  const reactions = [...new Set(value)];
  return reactions.every(
    (item): item is string => typeof item === "string" && reactionOptions.has(item),
  ) ? reactions : undefined;
}

function parseStoredReactions(value: string | null): string[] {
  if (!value) return [];
  try {
    return validReactions(JSON.parse(value)) ?? [];
  } catch {
    return [];
  }
}

function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text.length <= maxLength ? text || null : undefined;
}
