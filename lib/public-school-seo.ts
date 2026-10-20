import { env } from "cloudflare:workers";
import { allSchools, findSchool, type School } from "@/lib/schools";

export const SITE_ORIGIN = "https://haohaofood.cc";

type RecordRow = { meal_date: string; record_json: string };

export type PublicIngredient = {
  name?: string;
  standardName?: string;
  productName?: string;
};

export type PublicDish = {
  name?: string;
  category?: string;
  ingredients?: PublicIngredient[];
};

export type PublicMeal = {
  serviceLabel?: string;
  menuTypeName?: string;
  kitchenName?: string;
  uploadedAt?: string;
  nutrition?: {
    caloriesKcal?: string | number;
    wholeGrainsServings?: string | number;
    proteinServings?: string | number;
    vegetablesServings?: string | number;
    fruitServings?: string | number;
    milkServings?: string | number;
  };
  dishes?: PublicDish[];
};

export type PublicMealRecord = {
  mealDate?: string;
  status?: string;
  fetchedAt?: string;
  reviewedAt?: string;
  noMealReasons?: string[];
  source?: { name?: string; url?: string; scope?: string };
  review?: { reviewedAt?: string };
  meals?: PublicMeal[];
  services?: Array<{ label?: string; meals?: PublicMeal[] }>;
  schoolMenu?: unknown;
};

type SchoolMealAsset = {
  experience?: "complete" | "official_daily";
  records?: Record<string, PublicMealRecord>;
};
type SeoSchoolManifest = { schemaVersion?: number; schoolIds?: number[] };
type SiteAssetsEnv = Cloudflare.Env & { ASSETS?: Fetcher };

export type PublicSchoolPageData = {
  school: School;
  records: Record<string, PublicMealRecord>;
  dates: string[];
  today: string;
  todayRecord: PublicMealRecord | null;
  latestPublishedRecord: PublicMealRecord | null;
  displayRecord: PublicMealRecord | null;
  hasWeeklyMenu: boolean;
};

export async function loadIndexableSchools(request: Request): Promise<School[]> {
  const assets = (env as SiteAssetsEnv).ASSETS;
  if (!assets) return [];
  try {
    const response = await assets.fetch(
      new Request(new URL("/data/seo-schools.json", request.url)),
    );
    if (!response.ok) return [];
    const payload = (await response.json()) as SeoSchoolManifest;
    const ids = new Set(
      (payload.schoolIds ?? []).filter((value) => Number.isInteger(value) && value > 0),
    );
    return allSchools().filter((school) => ids.has(school.fatraceSchoolId));
  } catch {
    return [];
  }
}

export async function loadPublicSchoolPageData(
  request: Request,
  schoolId: number,
): Promise<PublicSchoolPageData | null> {
  const school = findSchool(schoolId);
  if (!school) return null;

  const [publishedAsset, databaseRecords] = await Promise.all([
    loadPublishedAsset(request, schoolId),
    loadDatabaseRecords(schoolId),
  ]);
  const publishedRecords = publishedAsset.records ?? {};
  const records = { ...publishedRecords };
  for (const [mealDate, databaseRecord] of Object.entries(databaseRecords)) {
    records[mealDate] = {
      ...databaseRecord,
      ...(publishedRecords[mealDate]?.schoolMenu
        ? { schoolMenu: publishedRecords[mealDate].schoolMenu }
        : {}),
    };
  }
  const dates = Object.keys(records)
    .filter(isIsoDate)
    .sort()
    .reverse()
    .slice(0, 20);
  if (!dates.length) return null;

  const recentRecords = Object.fromEntries(dates.map((date) => [date, records[date]]));
  const today = taipeiDate();
  const todayRecord = recentRecords[today] ?? null;
  const latestPublishedRecord =
    dates
      .map((date) => recentRecords[date])
      .find((record) => record?.status === "available") ?? null;

  return {
    school,
    records: recentRecords,
    dates,
    today,
    todayRecord,
    latestPublishedRecord,
    displayRecord: todayRecord?.status === "available" ? todayRecord : latestPublishedRecord,
    hasWeeklyMenu:
      publishedAsset.experience === "complete" ||
      Object.values(recentRecords).some((record) => record?.schoolMenu != null),
  };
}

async function loadPublishedAsset(request: Request, schoolId: number) {
  const assets = (env as SiteAssetsEnv).ASSETS;
  if (!assets) return {} as SchoolMealAsset;
  try {
    const response = await assets.fetch(
      new Request(
        new URL(`/data/school-meals/${encodeURIComponent(schoolId)}.json`, request.url),
      ),
    );
    if (!response.ok) return {} as SchoolMealAsset;
    return (await response.json()) as SchoolMealAsset;
  } catch {
    return {} as SchoolMealAsset;
  }
}

async function loadDatabaseRecords(schoolId: number) {
  if (!env.DB) return {};
  try {
    const query = await env.DB
      .prepare(
        `SELECT meal_date, record_json
           FROM official_meal_records
          WHERE school_id = ?
          ORDER BY meal_date DESC
          LIMIT 20`,
      )
      .bind(schoolId)
      .all<RecordRow>();
    return Object.fromEntries(
      query.results.flatMap((row) => {
        try {
          return [[row.meal_date, JSON.parse(row.record_json) as PublicMealRecord]];
        } catch {
          return [];
        }
      }),
    );
  } catch {
    return {};
  }
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function taipeiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function safeExternalUrl(value: unknown) {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

export function formatMealDate(value: string) {
  if (!isIsoDate(value)) return value;
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T12:00:00+08:00`));
}

export function formatTimestamp(value: string | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

export function publicHtmlHeaders(maxAge = 300) {
  return {
    "content-type": "text/html; charset=utf-8",
    "cache-control": `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
  };
}
