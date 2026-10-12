import { env } from "cloudflare:workers";
import { allSchools, findSchool, publicSchoolDirectory } from "@/lib/schools";

type RecordRow = {
  meal_date: string;
  record_json: string;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const schoolId = Number(url.searchParams.get("schoolId"));
  const selectedDate = url.searchParams.get("date") || taipeiDate();
  const mealType = url.searchParams.get("mealType") === "vegetarian" ? "vegetarian" : "meat";
  const school = findSchool(schoolId);
  if (!school) return Response.json({ error: "找不到指定學校" }, { status: 404 });
  if (!env.DB) return Response.json({ error: "雲端資料庫尚未連接" }, { status: 503 });

  const query = await env.DB
    .prepare(
      "SELECT meal_date, record_json FROM official_meal_records WHERE school_id = ? ORDER BY meal_date",
    )
    .bind(schoolId)
    .all<RecordRow>();
  const records = Object.fromEntries(
    query.results.map((row) => [row.meal_date, JSON.parse(row.record_json)]),
  );
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
        "教育部校園食材登錄平臺的當日或歷史實際供餐公開紀錄；若同時出現葷、素主菜，本站依菜名的「素」字拆分主菜與副菜，其他分類列為共用。",
      catalogSchoolCount: allSchools().length,
    },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}

function taipeiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
