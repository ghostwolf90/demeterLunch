import cityVisibility from "@/data/reference/city-visibility.json";
import cityServiceCatalog from "@/data/reference/city-service-catalog.json";
import { accountDatabase } from "@/lib/account-auth";

type StoredCityVisibility = {
  city: string;
  enabled: number | boolean;
  updated_at: string;
};

export type CityVisibilitySetting = {
  name: string;
  enabled: boolean;
  schoolCount: number;
  mealUnitCount: number;
  collectionEnabled: boolean;
  canEnable: boolean;
  source: "default" | "database";
  updatedAt: string | null;
};

const defaultVisibility = new Map(
  cityVisibility.cities.map((city) => [city.name, city.enabled === true]),
);

export function cityVisibilityCatalog(): CityVisibilitySetting[] {
  return cityServiceCatalog.cities.map((city) => ({
    name: city.name,
    schoolCount: city.schoolCount,
    mealUnitCount: city.mealUnitCount,
    collectionEnabled: city.collectionEnabled === true,
    canEnable: city.collectionEnabled === true,
    enabled: city.collectionEnabled === true && defaultVisibility.get(city.name) === true,
    source: "default",
    updatedAt: null,
  }));
}

export async function loadCityVisibilitySettings(): Promise<CityVisibilitySetting[]> {
  const catalog = cityVisibilityCatalog();
  const knownCities = new Set(catalog.map((city) => city.name));
  const rows = await accountDatabase()
    .prepare("SELECT city, enabled, updated_at FROM city_visibility_settings ORDER BY city")
    .all<StoredCityVisibility>();
  const overrides = new Map(
    rows.results
      .filter((row) => knownCities.has(row.city))
      .map((row) => [row.city, row]),
  );
  return catalog.map((city) => {
    const override = overrides.get(city.name);
    return override
      ? {
          ...city,
          enabled: city.canEnable && Number(override.enabled) === 1,
          source: "database" as const,
          updatedAt: override.updated_at,
        }
      : city;
  });
}

export async function enabledCityNames() {
  return new Set(
    (await loadCityVisibilitySettings())
      .filter((city) => city.enabled)
      .map((city) => city.name),
  );
}

export function parseCityVisibilityInput(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("縣市設定格式無效。");
  const input = value as Record<string, unknown>;
  const city = typeof input.city === "string" ? input.city.trim() : "";
  if (!city || !cityVisibilityCatalog().some((item) => item.name === city)) {
    throw new Error("學校名冊沒有這個縣市。");
  }
  if (typeof input.enabled !== "boolean") throw new Error("縣市開關必須是布林值。");
  const setting = cityVisibilityCatalog().find((item) => item.name === city);
  if (input.enabled && !setting?.canEnable) {
    throw new Error("這個縣市尚未完成午餐資料來源核對，不能開啟。");
  }
  return { city, enabled: input.enabled };
}

export async function saveCityVisibilitySetting(
  city: string,
  enabled: boolean,
  actorId: string,
) {
  const setting = cityVisibilityCatalog().find((item) => item.name === city);
  if (!setting || (enabled && !setting.canEnable)) {
    throw new Error("這個縣市尚未完成午餐資料來源核對，不能開啟。");
  }
  const updatedAt = new Date().toISOString();
  await accountDatabase()
    .prepare(
      `INSERT INTO city_visibility_settings (city, enabled, updated_by, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(city) DO UPDATE SET
         enabled = excluded.enabled,
         updated_by = excluded.updated_by,
         updated_at = excluded.updated_at`,
    )
    .bind(city, enabled ? 1 : 0, actorId, updatedAt)
    .run();
  return loadCityVisibilitySettings();
}
