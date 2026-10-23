import {
  accountDatabase,
  authRequired,
  forbiddenMutation,
  getAccountUser,
  isSameOriginMutation,
  privateJson,
} from "@/lib/account-auth";

const experiences = new Set([
  "unrecorded", "not_tried", "not_eaten", "seen", "smelled", "touched", "tasted", "ate_some", "ate_most",
  "finished", "ate_unknown", "unknown", "accepted", "liked",
]);
const reactionOptions = new Set([
  "loved", "liked", "okay", "less_liked", "disliked", "wants_more", "willing_retry",
  "avoid_next_time", "no_comment", "other",
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
    const childId = childIdFromUrl(request.url);
    if (childId === null) return privateJson({ error: "請指定孩子" }, { status: 400 });
    const child = await ownedChild(db, user.id, childId);
    if (childId !== null && !child) {
      return privateJson({ error: "找不到這位孩子", code: "CHILD_NOT_FOUND" }, { status: 404 });
    }
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
        schoolId: item.school_id,
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
    return privateJson({ error: "目前還無法顯示飲食紀錄，請稍後再試。" }, { status: 503 });
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
    return privateJson({ error: "請重新確認填寫內容。" }, { status: 400 });
  }
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const childId = requiredChildId(record.childId);
  const mealDate = typeof record.mealDate === "string" ? record.mealDate : "";
  const foodName = typeof record.foodName === "string" ? record.foodName.trim() : "";
  const experience = typeof record.experience === "string" && record.experience ? record.experience : "unrecorded";
  const mealType = typeof record.mealType === "string" ? record.mealType : "meat";
  const mealContext = typeof record.mealContext === "string" ? record.mealContext : "";
  const dishName = optionalText(record.dishName, 80);
  const reactions = validReactions(record.reactions);
  const childQuote = optionalText(record.childQuote, 160);
  const firstEncounter = optionalBoolean(record.firstEncounter);
  const preparation = optionalText(record.preparation, 80);
  const note = optionalText(record.note, 240);
  if (!isoDatePattern.test(mealDate) || !validDate(mealDate)) {
    return privateJson({ error: "供餐日期不正確" }, { status: 400 });
  }
  if (childId === null) {
    return privateJson({ error: "請選擇要記錄的孩子" }, { status: 400 });
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
  if (firstEncounter === undefined) {
    return privateJson({ error: "是否第一次吃的選項不正確" }, { status: 400 });
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

  if (!hasMemory({ experience, reactions, childQuote, note })) {
    return privateJson({ error: "留下一句原話、一點觀察或這次的感受就可以了。" }, { status: 400 });
  }

  try {
    const db = accountDatabase();
    const child = await ownedChild(db, user.id, childId);
    if (!child) {
      return privateJson({ error: "找不到這位孩子", code: "CHILD_NOT_FOUND" }, { status: 404 });
    }
    if (mealContext === "school_lunch" && (!child.school_id || Number(record.schoolId) !== child.school_id)) {
      return privateJson({ error: "請確認這是孩子就讀學校的午餐" }, { status: 400 });
    }
    const now = new Date().toISOString();
    const inserted = await db
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
        mealContext === "school_lunch" ? child.school_id : null,
        mealType,
        mealContext,
        dishName,
        foodName,
        experience,
        JSON.stringify(reactions),
        childQuote,
        firstEncounter === null ? null : firstEncounter ? 1 : 0,
        preparation,
        note,
        now,
      )
      .run();
    return privateJson({ ok: true, encounter: {
      id: Number(inserted.meta.last_row_id), mealDate, schoolId: mealContext === "school_lunch" ? child.school_id : null,
      mealType, mealContext, dishName, foodName, experience, reactions, childQuote, firstEncounter, preparation, note, createdAt: now,
    } }, { status: 201 });
  } catch (error) {
    console.error("Unable to save food encounter", error);
    return privateJson(
      { error: "目前無法儲存這筆飲食紀錄，請稍後再試。" },
      { status: 503 },
    );
  }
}

export async function PATCH(request: Request) {
  return mutateEncounter(request, false);
}

export async function DELETE(request: Request) {
  return mutateEncounter(request, true);
}

async function mutateEncounter(request: Request, deleting: boolean) {
  const user = await getAccountUser(request);
  if (!user) return authRequired();
  if (!isSameOriginMutation(request)) return forbiddenMutation();
  let record: Record<string, unknown>;
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    record = body as Record<string, unknown>;
  } catch {
    return privateJson({ error: "請重新確認填寫內容" }, { status: 400 });
  }
  const childId = requiredChildId(record.childId);
  const id = requiredChildId(record.id);
  if (!childId || !id) return privateJson({ error: "請指定孩子與紀錄" }, { status: 400 });
  try {
    const db = accountDatabase();
    if (!await ownedChild(db, user.id, childId)) {
      return privateJson({ error: "找不到這筆紀錄" }, { status: 404 });
    }
    const existing = await db.prepare(
      "SELECT id FROM food_encounters WHERE id = ? AND child_id = ? AND auth_user_id = ?",
    ).bind(id, childId, user.id).first<{ id: number }>();
    if (!existing) return privateJson({ error: "找不到這筆紀錄" }, { status: 404 });
    if (deleting) {
      await db.prepare("DELETE FROM food_encounters WHERE id = ? AND child_id = ? AND auth_user_id = ?")
        .bind(id, childId, user.id).run();
    } else {
      const childQuote = optionalText(record.childQuote, 160);
      const note = optionalText(record.note, 240);
      const experience = typeof record.experience === "string" ? record.experience : "unrecorded";
      const reactions = validReactions(record.reactions);
      if (childQuote === undefined || note === undefined || !experiences.has(experience) || reactions === undefined ||
          (reactions.includes("no_comment") && reactions.length > 1) ||
          !hasMemory({ experience, reactions, childQuote, note })) {
        return privateJson({ error: "請留下一句原話、一點觀察或這次的感受，並確認文字長度。" }, { status: 400 });
      }
      await db.prepare(`UPDATE food_encounters SET child_quote = ?, note = ?, experience = ?, reactions = ?
        WHERE id = ? AND child_id = ? AND auth_user_id = ?`)
        .bind(childQuote, note, experience, JSON.stringify(reactions), id, childId, user.id).run();
    }
    return privateJson({ ok: true });
  } catch (error) {
    console.error("Unable to update food encounter", error);
    return privateJson({ error: "目前無法更新紀錄，請稍後再試。" }, { status: 503 });
  }
}

function hasMemory(value: { experience: string; reactions: string[]; childQuote: string | null; note: string | null }) {
  return value.experience !== "unrecorded" || value.reactions.length > 0 || Boolean(value.childQuote || value.note);
}

function validDate(value: string) {
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

type AccountDb = ReturnType<typeof accountDatabase>;

async function ownedChild(db: AccountDb, authUserId: string, childId: number) {
  return db.prepare(
    "SELECT id, school_id FROM child_profiles WHERE auth_user_id = ? AND id = ? LIMIT 1",
  ).bind(authUserId, childId).first<ChildRow>();
}

function childIdFromUrl(value: string): number | null {
  return requiredChildId(new URL(value).searchParams.get("childId"));
}

function requiredChildId(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const childId = Number(value);
  return Number.isSafeInteger(childId) && childId > 0 ? childId : null;
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

function optionalBoolean(value: unknown): boolean | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === "boolean" ? value : undefined;
}
