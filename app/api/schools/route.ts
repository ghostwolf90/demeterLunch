import { enabledCityNames } from "@/lib/city-visibility";
import { publicSchoolDirectory } from "@/lib/schools";

export async function GET() {
  try {
    const visibleCities = await enabledCityNames();
    return Response.json(
      { schemaVersion: 1, schools: publicSchoolDirectory(visibleCities) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Public school directory unavailable", error);
    return Response.json(
      { error: "學校名冊暫時無法取得，請稍後重試。" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
