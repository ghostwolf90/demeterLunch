import type { School } from "@/lib/schools";

const API_ROOT = "https://fatraceschool.k12ea.gov.tw";
const PUBLIC_SEARCH_URL = `${API_ROOT}/frontend/search.html`;
const USER_AGENT =
  "DemeterLunchCollector/0.3 (+https://zhongxin-lunch-2026.laibit.chatgpt.site; personal non-commercial school lunch archive)";
const MAX_JSON_BYTES = 8 * 1024 * 1024;

type JsonObject = Record<string, unknown>;

export type CollectionStatus = "available" | "no_meal" | "not_published";

export type CollectedSchoolMeal = {
  raw: JsonObject;
  candidate: JsonObject & {
    status: CollectionStatus;
    contentHash: string;
    mealDate: string;
    school: School;
  };
};

export class FatraceError extends Error {}

export class FatraceClient {
  private lastRequestAt = 0;

  constructor(
    private readonly options: {
      intervalMs?: number;
      timeoutMs?: number;
      retries?: number;
      includeIngredients?: boolean;
    } = {},
  ) {}

  async collect(school: School, mealDate: string): Promise<CollectedSchoolMeal> {
    requireIsoDate(mealDate);
    const fetchedAt = new Date().toISOString();
    const schoolResponse = await this.get(`/school/${school.fatraceSchoolId}`);
    const officialSchool = expectObject(schoolResponse.data, "school.data");
    if (positiveInt(officialSchool.SchoolId, "SchoolId") !== school.fatraceSchoolId) {
      throw new FatraceError(`學校代碼 ${school.fatraceSchoolId} 的官方回應代碼不一致`);
    }
    const officialName = cleanText(officialSchool.SchoolName);
    if (officialName !== school.fullName) {
      throw new FatraceError(
        `學校代碼 ${school.fatraceSchoolId} 預期為 ${school.fullName}，官方回應為 ${officialName || "空白"}`,
      );
    }

    const baseParams = { SchoolId: school.fatraceSchoolId, period: mealDate };
    const serviceResponse = await this.get("/offering/service", baseParams);
    const services = expectList(serviceResponse.data, "offering/service.data");
    const lunchServices = services.filter(
      (value) => isObject(value) && cleanText(value.label) === "午餐",
    );
    const kitchenResponse = await this.get("/offered/kitchen", baseParams);
    const kitchens = expectList(kitchenResponse.data, "offered/kitchen.data").map(
      (value) => expectObject(value, "offered/kitchen.data[]"),
    );

    const rawLunchServices: JsonObject[] = [];
    const normalizedServices: JsonObject[] = [];
    const noMealRows: JsonObject[] = [];
    let mealCount = 0;

    for (const serviceValue of lunchServices) {
      const service = expectObject(serviceValue, "offering/service.data[]");
      const serviceId = positiveInt(service.ServiceId, "ServiceId");
      const serviceLabel = cleanText(service.label) || "午餐";
      const noMenuResponse = await this.get("/nomenudatelist", {
        schoolId: school.fatraceSchoolId,
        period: mealDate,
        menuType: serviceId,
      });
      const noMenuDates = expectList(noMenuResponse.data, "nomenudatelist.data");
      for (const row of noMenuDates) {
        if (isObject(row) && coversDate(row, mealDate)) noMealRows.push(row);
      }

      const rawMealQueries: JsonObject[] = [];
      const normalizedMeals: JsonObject[] = [];
      const seenBatchIds = new Set<number>();
      const kitchenQueries: Array<JsonObject | null> = kitchens.length ? kitchens : [null];
      for (const kitchen of kitchenQueries) {
        const query: Record<string, string | number> = {
          ...baseParams,
          MenuType: serviceId,
        };
        if (kitchen) query.KitchenId = positiveInt(kitchen.KitchenId, "KitchenId");
        const mealResponse = await this.get("/offered/meal", query);
        const meals = expectList(mealResponse.data, "offered/meal.data");
        const rawMeals: JsonObject[] = [];
        for (const mealValue of meals) {
          const meal = expectObject(mealValue, "offered/meal.data[]");
          const batchId = positiveInt(meal.BatchDataId, "BatchDataId");
          if (seenBatchIds.has(batchId)) continue;
          seenBatchIds.add(batchId);
          const dishResponse = await this.get("/dish", { BatchDataId: batchId });
          const dishes = expectList(dishResponse.data, "dish.data");
          const rawDishes: JsonObject[] = [];
          const normalizedDishes: JsonObject[] = [];
          for (const dishValue of dishes) {
            const dish = expectObject(dishValue, "dish.data[]");
            const dishId = getDishId(dish);
            if (cleanText(dish.DishName) === "調味料") {
              rawDishes.push({ dish, ingredients: null });
              continue;
            }
            let ingredientResponse: JsonObject | null = null;
            let ingredients: unknown[] = [];
            if (this.options.includeIngredients !== false) {
              ingredientResponse = await this.get("/ingredient", {
                BatchDataId: batchId,
                DishId: dishId,
              });
              ingredients = expectList(ingredientResponse.data, "ingredient.data");
            }
            rawDishes.push({ dish, ingredients: ingredientResponse });
            normalizedDishes.push(normalizeDish(dish, ingredients));
          }
          rawMeals.push({ meal, dishes: rawDishes });
          normalizedMeals.push(normalizeMeal(meal, normalizedDishes));
        }
        rawMealQueries.push({ kitchen, meals: mealResponse, details: rawMeals });
      }
      mealCount += normalizedMeals.length;
      rawLunchServices.push({
        service,
        noMenuDates: noMenuResponse,
        mealQueries: rawMealQueries,
      });
      normalizedServices.push({
        serviceId,
        label: serviceLabel,
        meals: normalizedMeals,
      });
    }

    const status: CollectionStatus = mealCount
      ? "available"
      : noMealRows.length
        ? "no_meal"
        : "not_published";
    const sourceUrl = `${PUBLIC_SEARCH_URL}?${new URLSearchParams({
      school: String(school.fatraceSchoolId),
      period: mealDate,
    })}`;
    const raw: JsonObject = {
      schemaVersion: 1,
      recordType: "official-daily-meal-raw",
      school,
      mealDate,
      fetchedAt,
      source: {
        name: "教育部校園食材登錄平臺公開查詢頁",
        url: sourceUrl,
        apiRoot: API_ROOT,
      },
      responses: {
        school: schoolResponse,
        services: serviceResponse,
        kitchens: kitchenResponse,
        lunchServices: rawLunchServices,
      },
    };
    const candidate: CollectedSchoolMeal["candidate"] = {
      schemaVersion: 1,
      recordType: "official-daily-meal-record",
      school,
      mealDate,
      status,
      fetchedAt,
      source: {
        name: "教育部校園食材登錄平臺公開查詢頁",
        url: sourceUrl,
        scope: "當日或歷史實際供餐公開紀錄；不是未來預定菜單",
      },
      noMealReasons: noMealRows.map(normalizeNoMeal),
      services: normalizedServices,
      review: {
        status: "pending",
        note: "候選資料尚未完成結構驗證，不會取代既有有效紀錄。",
      },
      contentHash: "",
    };
    candidate.contentHash = await candidateFingerprint(candidate);
    return { raw, candidate };
  }

  private async get(
    path: string,
    params?: Record<string, string | number>,
  ): Promise<JsonObject> {
    const url = new URL(path, API_ROOT);
    for (const [key, value] of Object.entries(params ?? {})) {
      url.searchParams.set(key, String(value));
    }
    const retries = Math.max(0, this.options.retries ?? 2);
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      await this.waitForInterval();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 20_000);
      try {
        const response = await fetch(url, {
          headers: { Accept: "application/json", "User-Agent": USER_AGENT },
          signal: controller.signal,
        });
        this.lastRequestAt = Date.now();
        if (!response.ok) {
          if (response.status !== 429 && response.status < 500) {
            throw new FatraceError(`官方接口 HTTP ${response.status}：${path}`);
          }
          const retryAfter = Number(response.headers.get("retry-after"));
          if (attempt >= retries) {
            throw new FatraceError(`官方接口 HTTP ${response.status}：${path}`);
          }
          await sleep(Number.isFinite(retryAfter) ? Math.min(60_000, retryAfter * 1000) : 2 ** attempt * 1000);
          continue;
        }
        const contentLength = Number(response.headers.get("content-length"));
        if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
          throw new FatraceError(`官方接口回應超過大小限制：${path}`);
        }
        const text = await response.text();
        if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
          throw new FatraceError(`官方接口回應超過大小限制：${path}`);
        }
        const payload = JSON.parse(text) as unknown;
        const object = expectObject(payload, `${path}.root`);
        if (![1, "1", true].includes(object.result as 1 | "1" | true)) {
          throw new FatraceError(
            `官方接口拒絕查詢 ${path}：${cleanText(object.message) || "未知錯誤"}`,
          );
        }
        if (!("data" in object)) throw new FatraceError(`官方接口缺少 data：${path}`);
        return object;
      } catch (error) {
        lastError = error;
        this.lastRequestAt = Date.now();
        if (error instanceof FatraceError || attempt >= retries) throw error;
        await sleep(2 ** attempt * 1000);
      } finally {
        clearTimeout(timer);
      }
    }
    throw new FatraceError(`官方接口查詢失敗：${path}：${String(lastError)}`);
  }

  private async waitForInterval() {
    const interval = Math.max(0, this.options.intervalMs ?? 1_200);
    const remaining = interval - (Date.now() - this.lastRequestAt);
    if (remaining > 0) await sleep(remaining);
  }
}

export async function reviewCandidate(candidate: CollectedSchoolMeal["candidate"]) {
  if (!['available', 'no_meal'].includes(candidate.status)) {
    throw new FatraceError(`只有 available 或 no_meal 可以完成校讀：${candidate.status}`);
  }
  validateCandidate(candidate);
  return {
    ...candidate,
    review: {
      status: "reviewed",
      reviewedAt: new Date().toISOString(),
      reviewedBy: "Demeter 雲端結構驗證與來源核對",
      method: "official-structured-record-validation",
      note: "已核對官方學校代碼、學校名稱、供餐日期、批次、菜色與食材欄位；不以舊資料冒充同日紀錄。",
    },
  };
}

export function toPublicRecord(reviewed: JsonObject) {
  const services = expectList(reviewed.services, "services");
  const meals: JsonObject[] = services.flatMap((serviceValue) => {
    const service = expectObject(serviceValue, "services[]");
    return expectList(service.meals, "services[].meals").map((mealValue) => {
      const meal = expectObject(mealValue, "services[].meals[]");
      return {
        serviceId: service.serviceId,
        serviceLabel: service.label,
        ...meal,
      };
    });
  });
  const dishes = meals.flatMap((meal) => expectList(meal.dishes, "meal.dishes"));
  const ingredients = dishes.flatMap((dishValue) => {
    const dish = expectObject(dishValue, "dish");
    return expectList(dish.ingredients, "dish.ingredients");
  });
  return {
    mealDate: reviewed.mealDate,
    status: reviewed.status,
    fetchedAt: reviewed.fetchedAt,
    source: reviewed.source,
    review: reviewed.review,
    noMealReasons: reviewed.noMealReasons,
    meals,
    summary: {
      mealCount: meals.length,
      dishCount: dishes.length,
      ingredientCount: ingredients.length,
      certifiedIngredientCount: ingredients.filter((value) => {
        const ingredient = expectObject(value, "ingredient");
        return expectList(ingredient.certifications, "ingredient.certifications").length > 0;
      }).length,
    },
  };
}

function validateCandidate(candidate: CollectedSchoolMeal["candidate"]) {
  requireIsoDate(candidate.mealDate);
  const services = expectList(candidate.services, "services");
  let mealCount = 0;
  const batches = new Set<string>();
  for (const serviceValue of services) {
    const service = expectObject(serviceValue, "services[]");
    positiveInt(service.serviceId, "serviceId");
    if (!cleanText(service.label)) throw new FatraceError("供餐服務名稱不得空白");
    for (const mealValue of expectList(service.meals, "services[].meals")) {
      const meal = expectObject(mealValue, "meal");
      const batchId = cleanText(meal.batchDataId);
      if (!batchId || batches.has(batchId)) throw new FatraceError("供餐批次缺漏或重複");
      batches.add(batchId);
      if (cleanText(meal.menuDate)?.replaceAll("/", "-") !== candidate.mealDate) {
        throw new FatraceError("供餐批次日期與查詢日期不一致");
      }
      const dishes = expectList(meal.dishes, "meal.dishes");
      if (!dishes.length) throw new FatraceError("已發布的供餐批次沒有菜色");
      for (const dishValue of dishes) {
        const dish = expectObject(dishValue, "dish");
        if (!cleanText(dish.name) || !cleanText(dish.category)) {
          throw new FatraceError("菜色名稱或分類不完整");
        }
        for (const ingredientValue of expectList(dish.ingredients, "dish.ingredients")) {
          const ingredient = expectObject(ingredientValue, "ingredient");
          if (!cleanText(ingredient.name)) throw new FatraceError("食材名稱不得空白");
          expectList(ingredient.certifications, "ingredient.certifications");
        }
      }
      mealCount += 1;
    }
  }
  if (candidate.status === "available" && !mealCount) {
    throw new FatraceError("available 紀錄必須包含餐次");
  }
  if (candidate.status === "no_meal" && mealCount) {
    throw new FatraceError("no_meal 紀錄不應包含餐次");
  }
}

async function candidateFingerprint(candidate: JsonObject) {
  const stable = stableStringify({
    school: candidate.school,
    mealDate: candidate.mealDate,
    status: candidate.status,
    noMealReasons: candidate.noMealReasons,
    services: candidate.services,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stable));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizeMeal(meal: JsonObject, dishes: JsonObject[]): JsonObject {
  return {
    batchDataId: clean(meal.BatchDataId),
    menuDate: clean(meal.MenuDate),
    menuType: clean(meal.MenuType),
    menuTypeName: clean(meal.MenuTypeName),
    kitchenId: clean(meal.KitchenId),
    kitchenName: clean(meal.KitchenName),
    uploadedAt: clean(meal.UploadDateTime),
    nutrition: {
      caloriesKcal: clean(meal.Calorie),
      wholeGrainsServings: clean(meal.TypeGrains),
      proteinServings: clean(meal.TypeMeatBeans),
      vegetablesServings: clean(meal.TypeVegetable),
      oilsNutsServings: clean(meal.TypeOil),
      fruitServings: clean(meal.TypeFruit),
      milkServings: clean(meal.TypeMilk),
    },
    dishes,
  };
}

function normalizeDish(dish: JsonObject, ingredients: unknown[]): JsonObject {
  const dishId = getDishId(dish);
  return {
    dishId,
    batchDataId: clean(dish.BatchDataId),
    dishBatchDataId: clean(dish.DishBatchDataId),
    name: clean(dish.DishName),
    category: clean(dish.DishType),
    imageUrl: Number(dish.DishId || 0) > 0
      ? `${API_ROOT}/dish/pic/${dishId}`
      : clean(dish.DishShowName),
    ingredients: ingredients.filter(isObject).map(normalizeIngredient),
  };
}

function normalizeIngredient(ingredient: JsonObject): JsonObject {
  const certifications = Array.isArray(ingredient.Certification)
    ? ingredient.Certification
    : [];
  return {
    name: clean(ingredient.IngredientName),
    standardName: clean(ingredient.standardIngredientName),
    productName: clean(ingredient.ProductName),
    manufacturer: clean(ingredient.Manufacturer),
    origin: clean(ingredient.IngredientSourceNameList),
    supplierName: clean(ingredient.SupplierName),
    stockDate: clean(ingredient.StockDate),
    certifications: certifications.filter(isObject).flatMap((item) => {
      const name = clean(item.SourceCertification);
      const id = clean(item.CertificationId);
      return name || id ? [{ name, id }] : [];
    }),
  };
}

function normalizeNoMeal(item: JsonObject): JsonObject {
  return {
    startDate: clean(item.startdate),
    endDate: clean(item.enddate),
    mealType: clean(item.menutypeName),
    reason: clean(item.nomenutypeName),
    note: clean(item.note),
    updatedAt: clean(item.updateDateTime),
  };
}

function coversDate(item: JsonObject, mealDate: string) {
  const start = cleanText(item.startdate);
  const end = cleanText(item.enddate);
  return Boolean(start && end && start <= mealDate && mealDate <= end);
}

function getDishId(dish: JsonObject) {
  for (const key of ["DishId", "DishBatchDataId"]) {
    const value = Number(dish[key] || 0);
    if (Number.isSafeInteger(value) && value > 0) return value;
  }
  throw new FatraceError("菜色缺少 DishId 與 DishBatchDataId");
}

function positiveInt(value: unknown, label: string) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result <= 0) {
    throw new FatraceError(`${label} 必須是正整數`);
  }
  return result;
}

function clean(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "boolean") return value;
  const text = String(value).trim();
  return text || null;
}

function cleanText(value: unknown) {
  const cleaned = clean(value);
  return cleaned === null ? null : String(cleaned);
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function expectObject(value: unknown, label: string): JsonObject {
  if (!isObject(value)) throw new FatraceError(`${label} 必須是物件`);
  return value;
}

function expectList(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new FatraceError(`${label} 必須是陣列`);
  return value;
}

function requireIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new FatraceError(`日期格式必須是 YYYY-MM-DD：${value}`);
  }
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
