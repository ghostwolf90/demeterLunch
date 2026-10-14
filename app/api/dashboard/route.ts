import { env } from "cloudflare:workers";
import { allSchools, findSchool, publicSchoolDirectory } from "@/lib/schools";

type RecordRow = {
  meal_date: string;
  record_json: string;
};

type PublicMealRecord = {
  source?: { url?: string };
  [key: string]: unknown;
};

type SchoolMealAsset = {
  records?: Record<string, PublicMealRecord>;
};

type SiteAssetsEnv = Cloudflare.Env & {
  ASSETS?: Fetcher;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const schoolId = Number(url.searchParams.get("schoolId"));
  const selectedDate = url.searchParams.get("date") || taipeiDate();
  const mealType = url.searchParams.get("mealType") === "vegetarian" ? "vegetarian" : "meat";
  const school = findSchool(schoolId);
  if (!school) return Response.json({ error: "找不到指定學校" }, { status: 404 });

  const publishedRecords = await loadPublishedRecords(request, schoolId);
  let databaseRecords: Record<string, PublicMealRecord> = {};
  if (env.DB) {
    const query = await env.DB
      .prepare(
        "SELECT meal_date, record_json FROM official_meal_records WHERE school_id = ? ORDER BY meal_date",
      )
      .bind(schoolId)
      .all<RecordRow>();
    databaseRecords = Object.fromEntries(
      query.results.map((row) => [row.meal_date, JSON.parse(row.record_json)]),
    );
  }
  // The deployed, reviewed snapshot is the publication baseline. Newer cloud
  // refreshes in D1 override the same school/date without hiding other dates.
  const records = { ...publishedRecords, ...databaseRecords };
  const dates = Object.keys(records).sort();
  const record = records[selectedDate] ?? null;
  const sourceUrl =
    record?.source?.url ||
    `https://fatraceschool.k12ea.gov.tw/frontend/search.html?school=${encodeURIComponent(schoolId)}&period=${encodeURIComponent(selectedDate)}`;
  const directory = publicSchoolDirectory();
  const schoolWithRecords = {
    ...school,
    sourceUrl: "https://fatraceschool.k12ea.gov.tw/frontend/search.html",
    recordCount: dates.length,
    recordDates: dates,
    dateRange: dates.length ? { start: dates[0], end: dates.at(-1) } : null,
    experience: schoolId === 193609 ? "complete" : "official_daily",
  };

  return Response.json(
    {
      viewMode: "officialDaily",
      school: schoolWithRecords,
      schoolDirectory: directory,
      requestedDate: selectedDate,
      selectedDate,
      record,
      records,
      isMissing: !record,
      availableDates: dates,
      dateRange: schoolWithRecords.dateRange,
      totalDays: dates.length,
      sourceUrl,
      mealType,
      mealTypeLabel: mealType === "vegetarian" ? "素食" : "葷食",
      dataNotice:
        "教育部校園食材登錄平臺的當日或歷史實際供餐公開紀錄；同日的主食、主菜中若同時出現有「素」字與未標示「素」的菜色，本站依菜名的「素」字拆分主食、主菜與副菜，其他分類列為共用。",
      catalogSchoolCount: allSchools().length,
    },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}

async function loadPublishedRecords(request: Request, schoolId: number) {
  const assets = (env as SiteAssetsEnv).ASSETS;
  if (!assets) return {};
  try {
    const assetUrl = new URL(
      `/data/school-meals/${encodeURIComponent(schoolId)}.json`,
      request.url,
    );
    const response = await assets.fetch(new Request(assetUrl));
    if (!response.ok) return {};
    const payload = (await response.json()) as SchoolMealAsset;
    return payload.records ?? {};
  } catch {
    return {};
  }
}

function taipeiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
