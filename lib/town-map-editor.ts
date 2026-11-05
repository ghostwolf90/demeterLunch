import neighborCountyThemes from "@/web/lunch-town/neighbor-county-themes.json";
import taichungDistrictThemes from "@/web/lunch-town/taichung-district-themes.json";

export const TOWN_MAP_SCHEMA_VERSION = 1;
export const TOWN_MAP_MAX_BYTES = 160_000;
export const TOWN_MAP_MAX_PLACEMENTS = 120;
export const TOWN_MAP_MAX_NPCS = 60;

const ALLOWED_VENUE_TYPES = Object.freeze([
  "landmark",
  "convenience-store",
  "snack-shop",
  "restaurant",
  "grocery-store",
  "park",
  "townhouse",
  "apartment",
]);

const VENUE_TYPE_LABELS: Record<string, string> = Object.freeze({
  landmark: "地方地標",
  "convenience-store": "便利商店",
  "snack-shop": "小吃店",
  restaurant: "餐廳",
  "grocery-store": "雜貨店",
  park: "小公園",
  townhouse: "透天住宅",
  apartment: "公寓住宅",
});

const ALLOWED_NPC_ROLES = Object.freeze([
  "student",
  "parent",
  "teacher",
  "office-worker",
  "senior",
  "community-resident",
  "vendor",
  "delivery-worker",
]);

const NPC_ROLE_LABELS: Record<string, string> = Object.freeze({
  student: "學生",
  parent: "家長",
  teacher: "老師",
  "office-worker": "上班族",
  senior: "長者",
  "community-resident": "社區居民",
  vendor: "店員",
  "delivery-worker": "送貨員",
});

const PLACEMENT_LANE = Object.freeze({ x: 0.035, y: 0.735, w: 0.615, h: 0.225 });

type RawDistrict = { name?: unknown };
type RawCounty = { id?: unknown; name?: unknown; districts?: RawDistrict[] };

const CITY_DISTRICTS = new Map<string, string[]>([
  [
    "臺中市",
    ((taichungDistrictThemes as { districts?: RawDistrict[] }).districts || [])
      .map((district) => String(district.name || "").trim())
      .filter(Boolean),
  ],
  ...((neighborCountyThemes as { counties?: RawCounty[] }).counties || []).map((county) => [
    String(county.name || "").trim(),
    (county.districts || []).map((district) => String(district.name || "").trim()).filter(Boolean),
  ] as [string, string[]]),
]);

const COUNTY_IDS = new Map<string, string>(
  ((neighborCountyThemes as { counties?: RawCounty[] }).counties || []).map((county) => [
    String(county.name || "").trim(),
    String(county.id || "").trim(),
  ]),
);

export type TownMapPlacement = {
  id: string;
  city: string;
  district: string;
  type: string;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type TownMapNpc = {
  id: string;
  city: string;
  district: string;
  name: string;
  nameEn: string;
  role: string;
  gender: "female" | "male";
  primaryVenueId: string;
};

export type TownMapManifest = {
  schemaVersion: 1;
  placements: TownMapPlacement[];
  npcs: TownMapNpc[];
};

export type TownMapRevision = {
  id: number;
  action: string;
  manifest_json: string;
  summary_json: string;
  actor_id: string;
  created_at: string;
};

export function emptyTownMapManifest(): TownMapManifest {
  return { schemaVersion: TOWN_MAP_SCHEMA_VERSION, placements: [], npcs: [] };
}

export function townMapEditorCatalog() {
  return {
    schemaVersion: TOWN_MAP_SCHEMA_VERSION,
    worldUnitSize: { width: 560, height: 360 },
    placementLane: PLACEMENT_LANE,
    cities: [...CITY_DISTRICTS.entries()].map(([name, districts]) => ({
      name,
      countyId: COUNTY_IDS.get(name) || "taichung",
      districts,
    })),
    venueTypes: ALLOWED_VENUE_TYPES.map((value) => ({ value, label: VENUE_TYPE_LABELS[value] })),
    npcRoles: ALLOWED_NPC_ROLES.map((value) => ({ value, label: NPC_ROLE_LABELS[value] })),
  };
}

export function parseTownMapManifest(value: unknown): TownMapManifest {
  const input = record(value, "地圖資料格式無效。");
  if (Number(input.schemaVersion) !== TOWN_MAP_SCHEMA_VERSION) throw new Error("地圖資料版本不支援，請重新載入後再試。");
  if (!Array.isArray(input.placements) || !Array.isArray(input.npcs)) throw new Error("地圖建築與 NPC 必須是清單。");
  if (input.placements.length > TOWN_MAP_MAX_PLACEMENTS) throw new Error(`建築最多 ${TOWN_MAP_MAX_PLACEMENTS} 個。`);
  if (input.npcs.length > TOWN_MAP_MAX_NPCS) throw new Error(`NPC 最多 ${TOWN_MAP_MAX_NPCS} 位。`);

  const placementIds = new Set<string>();
  const districtPlacementCounts = new Map<string, number>();
  const placements = input.placements.map((raw, index) => {
    const item = record(raw, `第 ${index + 1} 個建築格式無效。`);
    const id = slug(item.id, `第 ${index + 1} 個建築缺少有效編號。`);
    if (placementIds.has(id)) throw new Error(`建築編號 ${id} 重複。`);
    placementIds.add(id);
    const { city, district } = location(item, `建築 ${id}`);
    const type = String(item.type || "");
    if (!ALLOWED_VENUE_TYPES.includes(type)) throw new Error(`建築 ${id} 使用不支援的模板。`);
    const label = boundedText(item.label, 40, `建築 ${id} 必須填寫中文名稱。`);
    const labelEn = boundedText(item.labelEn, 60, `建築 ${id} 必須填寫英文名稱。`);
    const description = optionalText(item.description, 240);
    const descriptionEn = optionalText(item.descriptionEn, 360);
    if (Boolean(description) !== Boolean(descriptionEn)) throw new Error(`建築 ${id} 的中英文說明必須同時填寫。`);
    const x = decimal(item.x, `建築 ${id} 的水平位置無效。`);
    const y = decimal(item.y, `建築 ${id} 的垂直位置無效。`);
    const w = decimal(item.w, `建築 ${id} 的寬度無效。`);
    const h = decimal(item.h, `建築 ${id} 的高度無效。`);
    if (w < 0.075 || w > 0.28 || h < 0.075 || h > 0.2) throw new Error(`建築 ${id} 的尺寸超出可用範圍。`);
    if (x < PLACEMENT_LANE.x || y < PLACEMENT_LANE.y
      || x + w > PLACEMENT_LANE.x + PLACEMENT_LANE.w
      || y + h > PLACEMENT_LANE.y + PLACEMENT_LANE.h) {
      throw new Error(`建築 ${id} 必須放在行政區底部的編輯街廓內。`);
    }
    const districtKey = `${city}:${district}`;
    const count = (districtPlacementCounts.get(districtKey) || 0) + 1;
    if (count > 3) throw new Error(`${city}${district}最多放置 3 個自訂建築。`);
    districtPlacementCounts.set(districtKey, count);
    return { id, city, district, type, label, labelEn, description, descriptionEn, x, y, w, h };
  });

  for (let first = 0; first < placements.length; first += 1) {
    for (let second = first + 1; second < placements.length; second += 1) {
      const a = placements[first];
      const b = placements[second];
      if (a.city === b.city && a.district === b.district && rectanglesOverlap(a, b, 0.008)) {
        throw new Error(`${a.label}與${b.label}重疊，請保留通行間距。`);
      }
    }
  }

  const placementById = new Map(placements.map((placement) => [placement.id, placement]));
  const npcIds = new Set<string>();
  const districtNpcCounts = new Map<string, number>();
  const npcs = input.npcs.map((raw, index) => {
    const item = record(raw, `第 ${index + 1} 位 NPC 格式無效。`);
    const id = slug(item.id, `第 ${index + 1} 位 NPC 缺少有效編號。`);
    if (npcIds.has(id)) throw new Error(`NPC 編號 ${id} 重複。`);
    npcIds.add(id);
    const { city, district } = location(item, `NPC ${id}`);
    const name = boundedText(item.name, 30, `NPC ${id} 必須填寫中文名稱。`);
    const nameEn = boundedText(item.nameEn, 50, `NPC ${id} 必須填寫英文名稱。`);
    const role = String(item.role || "");
    if (!ALLOWED_NPC_ROLES.includes(role)) throw new Error(`NPC ${name} 使用不支援的身分。`);
    const gender = String(item.gender || "");
    if (gender !== "female" && gender !== "male") throw new Error(`NPC ${name} 必須設定角色外型。`);
    const primaryVenueId = slug(item.primaryVenueId, `NPC ${name} 必須選擇主要場所。`);
    const venue = placementById.get(primaryVenueId);
    if (!venue || venue.city !== city || venue.district !== district) throw new Error(`NPC ${name} 的主要場所必須位於同一行政區。`);
    const districtKey = `${city}:${district}`;
    const count = (districtNpcCounts.get(districtKey) || 0) + 1;
    if (count > 3) throw new Error(`${city}${district}最多新增 3 位 NPC。`);
    districtNpcCounts.set(districtKey, count);
    return { id, city, district, name, nameEn, role, gender, primaryVenueId } as TownMapNpc;
  });

  return { schemaVersion: TOWN_MAP_SCHEMA_VERSION, placements, npcs };
}

export function townMapManifestSummary(manifest: TownMapManifest) {
  const districts = new Set([
    ...manifest.placements.map((item) => `${item.city}${item.district}`),
    ...manifest.npcs.map((item) => `${item.city}${item.district}`),
  ]);
  return { placementCount: manifest.placements.length, npcCount: manifest.npcs.length, districtCount: districts.size };
}

export function parseTownMapEditorInput(value: unknown) {
  const input = record(value, "地圖操作格式無效。");
  const action = String(input.action || "");
  if (action !== "save" && action !== "publish" && action !== "preview") throw new Error("請選擇儲存草稿、測試或發布地圖。");
  if (!Number.isSafeInteger(input.revision) || Number(input.revision) < 0) throw new Error("請重新載入地圖版本後再試。");
  const manifest = parseTownMapManifest(input.manifest);
  let focus: { city: string; district: string; placementId: string | null } | null = null;
  if (action === "preview") {
    const rawFocus = record(input.focus, "請選擇要測試的行政區。");
    const previewLocation = location(rawFocus, "預覽位置");
    const placementId = rawFocus.placementId ? slug(rawFocus.placementId, "預覽建築編號無效。") : null;
    if (placementId && !manifest.placements.some((placement) => (
      placement.id === placementId && placement.city === previewLocation.city && placement.district === previewLocation.district
    ))) throw new Error("預覽建築不在所選行政區內。");
    focus = { ...previewLocation, placementId };
  }
  return { action, revision: Number(input.revision), manifest, focus };
}

export function parseStoredTownMapManifest(value: string | null | undefined) {
  if (!value) return emptyTownMapManifest();
  return parseTownMapManifest(JSON.parse(value));
}

function location(item: Record<string, unknown>, subject: string) {
  const city = String(item.city || "").trim();
  const district = String(item.district || "").trim();
  const districts = CITY_DISTRICTS.get(city);
  if (!districts || !districts.includes(district)) throw new Error(`${subject}的縣市或行政區無效。`);
  return { city, district };
}

function rectanglesOverlap(a: TownMapPlacement, b: TownMapPlacement, gap: number) {
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x
    && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
}

function record(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function slug(value: unknown, message: string) {
  const result = String(value || "").trim();
  if (!/^[a-z0-9][a-z0-9-]{2,47}$/.test(result)) throw new Error(message);
  return result;
}

function boundedText(value: unknown, maximum: number, message: string) {
  const result = String(value || "").trim();
  if (!result || result.length > maximum || /[\u0000-\u001f\u007f]/.test(result)) throw new Error(message);
  return result;
}

function optionalText(value: unknown, maximum: number) {
  const result = String(value || "").trim();
  if (result.length > maximum || /[\u0000-\u001f\u007f]/.test(result)) throw new Error("建築說明包含無效內容或過長。");
  return result;
}

function decimal(value: unknown, message: string) {
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(message);
  return Math.round(result * 10_000) / 10_000;
}
