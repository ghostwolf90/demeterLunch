import { env } from "cloudflare:workers";
import { privateJson } from "@/lib/account-auth";
import {
  loadCityVisibilitySettings,
  parseCityVisibilityInput,
  saveCityVisibilitySetting,
} from "@/lib/city-visibility";
import { authorizeManualPublisher } from "@/lib/manual-publish-auth";

export const dynamic = "force-dynamic";

async function authorize(request: Request) {
  try {
    await authorizeManualPublisher(request, env.MAINTENANCE_API_TOKEN);
    return { id: "operations-owner" };
  } catch {
    return privateJson({ error: "無法驗證後台資料連線。" }, { status: 403 });
  }
}

export async function GET(request: Request) {
  const user = await authorize(request);
  if (user instanceof Response) return user;
  try {
    return privateJson({ schemaVersion: 1, cities: await loadCityVisibilitySettings() });
  } catch (error) {
    console.error("City visibility settings unavailable", error);
    return privateJson({ error: "縣市設定暫時無法取得，請稍後重試。" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await authorize(request);
  if (user instanceof Response) return user;
  if (
    request.headers.get("origin") !== new URL(request.url).origin ||
    !request.headers.get("content-type")?.startsWith("application/json")
  ) {
    return privateJson({ error: "請從維護後台操作。" }, { status: 403 });
  }
  let input: ReturnType<typeof parseCityVisibilityInput>;
  try {
    if (Number(request.headers.get("content-length")) > 2048) throw new Error("縣市設定內容過長。");
    const raw = await request.text();
    if (raw.length > 2048) throw new Error("縣市設定內容過長。");
    input = parseCityVisibilityInput(JSON.parse(raw));
  } catch (error) {
    return privateJson(
      { error: error instanceof Error ? error.message : "縣市設定格式無效。" },
      { status: 400 },
    );
  }
  try {
    const cities = await saveCityVisibilitySetting(input.city, input.enabled, user.id);
    return privateJson({ schemaVersion: 1, cities });
  } catch (error) {
    console.error("City visibility setting write failed", error);
    return privateJson({ error: "縣市設定未儲存，請稍後再試。" }, { status: 503 });
  }
}
