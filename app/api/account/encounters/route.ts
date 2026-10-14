import {
  accountDatabase,
  authRequired,
  forbiddenMutation,
  getAccountUser,
  isSameOriginMutation,
  privateJson,
} from "@/lib/account-auth";

const experiences = new Set(["seen", "smelled", "touched", "tasted", "accepted", "liked"]);
const mealTypes = new Set(["meat", "vegetarian"]);
const mealContexts = new Set(["school_lunch", "other"]);
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

type ChildRow = { id: number; school_id: number | null };

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
  const mealDate = typeof record.mealDate === "string" ? record.mealDate : "";
  const foodName = typeof record.foodName === "string" ? record.foodName.trim() : "";
  const experience = typeof record.experience === "string" ? record.experience : "";
  const mealType = typeof record.mealType === "string" ? record.mealType : "meat";
  const mealContext = typeof record.mealContext === "string" ? record.mealContext : "";
  const dishName = optionalText(record.dishName, 80);
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
  if (!mealTypes.has(mealType)) {
    return privateJson({ error: "午餐餐別不正確" }, { status: 400 });
  }
  if (!mealContexts.has(mealContext)) {
    return privateJson({ error: "請選擇食物是從哪裡遇到的" }, { status: 400 });
  }
  if (dishName === undefined || preparation === undefined || note === undefined) {
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
           (child_id, auth_user_id, meal_date, school_id, meal_type, meal_context, dish_name, food_name, experience, preparation, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text.length <= maxLength ? text || null : undefined;
}
