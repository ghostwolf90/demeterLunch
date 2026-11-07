export const FLOWER_FESTIVAL_ID = "xinshe-flower-season";
const FLOWER_FESTIVAL_DESIGN_WIDTH = 2800;
const FLOWER_FESTIVAL_DESIGN_HEIGHT = 1800;
export const FLOWER_FESTIVAL_SCALE = 0.8;
export const FLOWER_FESTIVAL_WIDTH = Math.round(FLOWER_FESTIVAL_DESIGN_WIDTH * FLOWER_FESTIVAL_SCALE);
export const FLOWER_FESTIVAL_HEIGHT = Math.round(FLOWER_FESTIVAL_DESIGN_HEIGHT * FLOWER_FESTIVAL_SCALE);
export const FLOWER_FESTIVAL_CHUNK_SIZE = 320;
export const FLOWER_FESTIVAL_START_DATE = "2026-10-31";
export const FLOWER_FESTIVAL_END_DATE = "2026-11-22";

export function flowerFestivalPhaseForDate(dateKey) {
  const normalized = String(dateKey || "");
  if (normalized < FLOWER_FESTIVAL_START_DATE) return "upcoming";
  if (normalized > FLOWER_FESTIVAL_END_DATE) return "ended";
  return "open";
}

function scaleFestivalEntity(entity) {
  const scaled = { ...entity };
  for (const key of ["x", "y", "w", "h", "radius", "width"]) {
    if (Number.isFinite(scaled[key])) scaled[key] = Math.round(scaled[key] * FLOWER_FESTIVAL_SCALE);
  }
  return Object.freeze(scaled);
}

function scaleFestivalCollection(collection) {
  return Object.freeze(collection.map(scaleFestivalEntity));
}

const DESIGN_ENTRY = Object.freeze({ x: 230, y: 1600 });
export const FLOWER_FESTIVAL_ENTRY = scaleFestivalEntity(DESIGN_ENTRY);
const DESIGN_EXIT = Object.freeze({
  id: "festival-exit",
  kind: "exit",
  x: 142,
  y: 1650,
  label: "返回新社區",
  labelEn: "Return to Xinshe",
});
export const FLOWER_FESTIVAL_EXIT = scaleFestivalEntity(DESIGN_EXIT);

const DESIGN_ZONES = Object.freeze([
  { id: "welcome", label: "迎賓廣場", labelEn: "Welcome Plaza", x: 80, y: 1370, w: 680, h: 350 },
  { id: "castle", label: "甜點花城堡", labelEn: "Dessert Flower Castle", x: 1110, y: 790, w: 640, h: 560 },
  { id: "pastel-field", label: "粉白花海原野", labelEn: "Pastel Flower Fields", x: 350, y: 390, w: 940, h: 740 },
  { id: "sunset-field", label: "橘紅花浪區", labelEn: "Sunset Flower Waves", x: 1760, y: 430, w: 850, h: 650 },
  { id: "market", label: "菇香市集與野餐草地", labelEn: "Mushroom Market and Picnic Lawn", x: 1800, y: 1150, w: 850, h: 450 },
  { id: "overlook", label: "山景觀景台", labelEn: "Mountain Overlook", x: 1230, y: 130, w: 560, h: 380 },
]);
export const FLOWER_FESTIVAL_ZONES = scaleFestivalCollection(DESIGN_ZONES);

const DESIGN_PATHS = Object.freeze([
  {
    id: "main-loop",
    kind: "main",
    width: 118,
    points: Object.freeze([
      { x: 230, y: 1600 }, { x: 520, y: 1450 }, { x: 820, y: 1510 },
      { x: 1160, y: 1480 }, { x: 1510, y: 1500 }, { x: 1880, y: 1490 },
      { x: 2230, y: 1480 }, { x: 2520, y: 1350 }, { x: 2570, y: 1050 },
      { x: 2480, y: 760 }, { x: 2260, y: 520 }, { x: 1900, y: 350 },
      { x: 1510, y: 290 }, { x: 1120, y: 350 }, { x: 760, y: 480 },
      { x: 470, y: 700 }, { x: 300, y: 1010 }, { x: 230, y: 1300 },
      { x: 230, y: 1600 },
    ]),
  },
  {
    id: "castle-shortcut",
    kind: "shortcut",
    width: 82,
    points: Object.freeze([
      { x: 520, y: 1450 }, { x: 820, y: 1260 }, { x: 1120, y: 1120 },
      { x: 1420, y: 1040 }, { x: 1760, y: 1060 }, { x: 2200, y: 1390 },
    ]),
  },
  {
    id: "flower-shortcut",
    kind: "shortcut",
    width: 76,
    points: Object.freeze([
      { x: 470, y: 700 }, { x: 760, y: 790 }, { x: 1060, y: 920 },
      { x: 1420, y: 1040 }, { x: 1660, y: 800 }, { x: 1900, y: 350 },
    ]),
  },
]);
export const FLOWER_FESTIVAL_PATHS = Object.freeze(DESIGN_PATHS.map((path) => Object.freeze({
  ...path,
  width: Math.round(path.width * FLOWER_FESTIVAL_SCALE),
  points: Object.freeze(path.points.map(scaleFestivalEntity)),
})));

const DESIGN_WALKABLE_PLAZAS = Object.freeze([
  { kind: "rect", x: 80, y: 1370, w: 680, h: 350 },
  { kind: "circle", x: 1420, y: 1040, radius: 285 },
  { kind: "rect", x: 1800, y: 1160, w: 850, h: 430 },
  { kind: "rect", x: 1230, y: 160, w: 560, h: 310 },
]);
const WALKABLE_PLAZAS = scaleFestivalCollection(DESIGN_WALKABLE_PLAZAS);

const DESIGN_STAMPS = Object.freeze([
  { id: "welcome", kind: "stamp", x: 360, y: 1510, label: "迎賓花門章", labelEn: "Welcome Arch Stamp" },
  { id: "castle", kind: "stamp", x: 1420, y: 1260, label: "甜點花城堡章", labelEn: "Dessert Flower Castle Stamp" },
  { id: "pastel-field", kind: "stamp", x: 600, y: 650, label: "粉白花原章", labelEn: "Pastel Field Stamp" },
  { id: "sunset-field", kind: "stamp", x: 2290, y: 550, label: "橘紅花浪章", labelEn: "Sunset Flower Wave Stamp" },
  { id: "market", kind: "stamp", x: 2100, y: 1370, label: "菇香野餐章", labelEn: "Mushroom Picnic Stamp" },
  { id: "overlook", kind: "stamp", x: 1500, y: 330, label: "山景眺望章", labelEn: "Mountain Overlook Stamp" },
]);
export const FLOWER_FESTIVAL_STAMPS = scaleFestivalCollection(DESIGN_STAMPS);

const DESIGN_PHOTO_POINTS = Object.freeze([
  { id: "castle-photo", kind: "photo", x: 1415, y: 1315, label: "城堡全景拍照點", labelEn: "Castle panorama photo spot" },
  { id: "flower-photo", kind: "photo", x: 820, y: 805, label: "粉白花徑拍照點", labelEn: "Pastel flower path photo spot" },
  { id: "overlook-photo", kind: "photo", x: 1600, y: 270, label: "花海遠山拍照點", labelEn: "Flower fields and mountains photo spot" },
]);
export const FLOWER_FESTIVAL_PHOTO_POINTS = scaleFestivalCollection(DESIGN_PHOTO_POINTS);

const DESIGN_SPIRITS = Object.freeze([
  { id: "spirit-cosmos", kind: "spirit", x: 280, y: 1110, label: "粉風花精靈", labelEn: "Pink Breeze Flower Spirit", color: "#f49abb" },
  { id: "spirit-cloud", kind: "spirit", x: 1040, y: 430, label: "白雲花精靈", labelEn: "White Cloud Flower Spirit", color: "#fff7e8" },
  { id: "spirit-sunset", kind: "spirit", x: 2520, y: 880, label: "夕陽花精靈", labelEn: "Sunset Flower Spirit", color: "#ef7150" },
  { id: "spirit-mushroom", kind: "spirit", x: 2500, y: 1280, label: "菇傘花精靈", labelEn: "Mushroom Cap Flower Spirit", color: "#e6b067" },
  { id: "spirit-mountain", kind: "spirit", x: 1280, y: 360, label: "山嵐花精靈", labelEn: "Mountain Mist Flower Spirit", color: "#c9b2e5" },
]);
export const FLOWER_FESTIVAL_SPIRITS = scaleFestivalCollection(DESIGN_SPIRITS);

const DESIGN_SHUTTLES = Object.freeze([
  { id: "shuttle-welcome", kind: "shuttle", x: 560, y: 1540, label: "迎賓接駁點", labelEn: "Welcome shuttle stop" },
  { id: "shuttle-castle", kind: "shuttle", x: 1640, y: 1180, label: "城堡接駁點", labelEn: "Castle shuttle stop" },
  { id: "shuttle-market", kind: "shuttle", x: 2390, y: 1390, label: "市集接駁點", labelEn: "Market shuttle stop" },
  { id: "shuttle-overlook", kind: "shuttle", x: 1700, y: 330, label: "觀景台接駁點", labelEn: "Overlook shuttle stop" },
]);
export const FLOWER_FESTIVAL_SHUTTLES = scaleFestivalCollection(DESIGN_SHUTTLES);

const DESIGN_OBJECTS = Object.freeze([
  DESIGN_EXIT,
  ...DESIGN_STAMPS,
  ...DESIGN_PHOTO_POINTS,
  ...DESIGN_SPIRITS,
  ...DESIGN_SHUTTLES,
]);

export const FLOWER_FESTIVAL_OBJECTS = Object.freeze([
  FLOWER_FESTIVAL_EXIT,
  ...FLOWER_FESTIVAL_STAMPS,
  ...FLOWER_FESTIVAL_PHOTO_POINTS,
  ...FLOWER_FESTIVAL_SPIRITS,
  ...FLOWER_FESTIVAL_SHUTTLES,
]);

const DESIGN_BEDS = Object.freeze([
  { id: "pastel-west", x: 330, y: 400, w: 910, h: 720, palette: ["#fff8ed", "#f6c7dc", "#e8a9cf", "#c9b0e5"] },
  { id: "pastel-south", x: 520, y: 1030, w: 690, h: 330, palette: ["#fff9e9", "#f3b7ce", "#df9ac9", "#d2bde8"] },
  { id: "sunset-east", x: 1740, y: 430, w: 900, h: 650, palette: ["#f7b145", "#ed7949", "#df4e56", "#f08b9d"] },
  { id: "sunset-south", x: 1670, y: 930, w: 830, h: 250, palette: ["#f3a43d", "#ed6846", "#d94c58", "#f19a74"] },
]);
export const FLOWER_FESTIVAL_BEDS = scaleFestivalCollection(DESIGN_BEDS);

const DESIGN_SNACK_STALLS = Object.freeze([
  { id: "stall-mushroom", x: 1850, y: 1210, label: "香菇炊飯", labelEn: "Shiitake rice", color: "#d96955" },
  { id: "stall-rice", x: 1980, y: 1210, label: "米香小點", labelEn: "Puffed rice treats", color: "#e3b24f" },
  { id: "stall-taro", x: 2110, y: 1210, label: "芋香點心", labelEn: "Taro treats", color: "#9c79a8" },
  { id: "stall-tea", x: 2240, y: 1210, label: "山城茶飲", labelEn: "Mountain tea", color: "#60916a" },
  { id: "stall-fruit", x: 2370, y: 1210, label: "水果冰品", labelEn: "Fruit ice", color: "#d98383" },
  { id: "stall-bun", x: 2500, y: 1210, label: "田園包子", labelEn: "Garden buns", color: "#4d8293" },
]);
export const FLOWER_FESTIVAL_SNACK_STALLS = scaleFestivalCollection(DESIGN_SNACK_STALLS);

const DESIGN_LOCAL_NPCS = Object.freeze([
  {
    id: "festival-guide", name: "花芽", nameEn: "Huaya", role: "local-guide", roleLabel: "花海導覽員",
    roleLabelEn: "Flower field guide", x: 300, y: 1580, district: "新社區",
    dialogues: [
      "歡迎來散步！主環線會走過六區，兩條捷徑都能回到城堡廣場，不必一直走回頭路。",
      "園區地圖上的六枚花章可以自由收集；三處相機旗幟是遊戲內拍照點。",
      "這是好好吃飯的原創花季遊戲場景，取材自現場色彩與散步感受，不代表任何官方合作。",
    ],
  },
  {
    id: "festival-flower-grower", name: "春苗", nameEn: "Chunmiao", role: "flower-grower", roleLabel: "新社花農",
    roleLabelEn: "Xinshe flower grower", x: 720, y: 780, district: "新社區",
    dialogues: [
      "粉、白與淡紫花帶排在一起，遠看像一層一層的花浪；請留在寬步道上欣賞。",
      "花田的顏色、花期和長勢會受品種與天候影響，遊戲裡用像素色塊保留開闊感。",
      "花田是農作空間，散步時不跨進植栽區，也能讓下一位旅人看到完整花景。",
    ],
  },
  {
    id: "festival-mushroom-grower", name: "菇伯", nameEn: "Uncle Gu", role: "farmer", roleLabel: "新社菇農",
    roleLabelEn: "Xinshe mushroom grower", x: 2260, y: 1420, district: "新社區",
    dialogues: [
      "香菇是新社常見的農產特色；乾香菇香氣濃，鮮香菇口感柔嫩，料理前先依品項整理。",
      "晚餐可以把菇類和豆腐、雞肉或當季蔬菜搭成湯、燴菜或炊飯，再依家人的飲食需求調整。",
      "這裡分享的是一般食材知識，不代表孩子今天午餐用了新社香菇；學校食材仍以同日正式紀錄為準。",
    ],
  },
]);
export const FLOWER_FESTIVAL_LOCAL_NPCS = scaleFestivalCollection(DESIGN_LOCAL_NPCS);

export const FLOWER_FESTIVAL_PROMOTERS = Object.freeze([
  {
    id: "festival-promoter-blossom", name: "花舞", nameEn: "Blossom", role: "flower-ambassador",
    district: "西區", gender: "female", profileVariant: "pink", featuredResident: true,
    dialogues: [
      "2026 新社花海暨臺中國際花毯節從 10 月 31 日到 11 月 22 日，一共 23 天，記得在展期內到新社走走。",
      "午餐小鎮的入口已搬到新社區北側空地，看到粉色花門就能進入大型花海園區。",
      "遊戲園區是好好吃飯的原創像素場景，活動日期提醒不代表與主辦單位有官方合作。",
    ],
  },
  {
    id: "festival-promoter-cloud", name: "雲朵", nameEn: "Cloud", role: "flower-ambassador",
    district: "西屯區", gender: "female", profileVariant: "white", featuredResident: true,
    dialogues: [
      "2026 新社花海暨臺中國際花毯節從 10 月 31 日到 11 月 22 日，一共 23 天，記得在展期內到新社走走。",
      "主環線會串起粉白花田、甜點花城堡、菇香市集與觀景台，也有兩條捷徑和接駁點。",
      "11 月 22 日展期結束後，遊戲入口會自動休園，請把握開放日期前往。",
    ],
  },
  {
    id: "festival-promoter-sunset", name: "橘陽", nameEn: "Sunny", role: "flower-ambassador",
    district: "豐原區", gender: "female", profileVariant: "orange", featuredResident: true,
    dialogues: [
      "2026 新社花海暨臺中國際花毯節從 10 月 31 日到 11 月 22 日，一共 23 天，記得在展期內到新社走走。",
      "花海園區可以自由集六區花章、找花精靈，也能在三處遊戲拍照點停下來取景。",
      "進入園區不需要註冊；登入者完成六章後，花海散步家成就會同步到家庭帳號。",
    ],
  },
  {
    id: "festival-promoter-violet", name: "紫風", nameEn: "Violet", role: "flower-ambassador",
    district: "大里區", gender: "female", profileVariant: "violet", featuredResident: true,
    dialogues: [
      "2026 新社花海暨臺中國際花毯節從 10 月 31 日到 11 月 22 日，一共 23 天，記得在展期內到新社走走。",
      "到新社區找北側空地的粉色花門，靠近後按 Enter，手機則點 A 進入。",
      "遊戲園區只參考花田色彩與散步氛圍，沒有直接使用現場人物或照片。",
    ],
  },
]);

function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const progress = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + dx * progress), point.y - (start.y + dy * progress));
}

export function flowerFestivalPointWalkable(point) {
  if (!point || point.x < 18 || point.y < 18 || point.x > FLOWER_FESTIVAL_WIDTH - 18 || point.y > FLOWER_FESTIVAL_HEIGHT - 18) return false;
  if (WALKABLE_PLAZAS.some((plaza) => (
    plaza.kind === "circle"
      ? Math.hypot(point.x - plaza.x, point.y - plaza.y) <= plaza.radius
      : point.x >= plaza.x && point.x <= plaza.x + plaza.w && point.y >= plaza.y && point.y <= plaza.y + plaza.h
  ))) return true;
  return FLOWER_FESTIVAL_PATHS.some((path) => path.points.slice(1).some((end, index) => (
    pointToSegmentDistance(point, path.points[index], end) <= path.width / 2
  )));
}

function flowerFestivalSegmentWalkable(start, end) {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const samples = Math.max(1, Math.ceil(distance / 18));
  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples;
    if (!flowerFestivalPointWalkable({
      x: start.x + (end.x - start.x) * progress,
      y: start.y + (end.y - start.y) * progress,
    })) return false;
  }
  return true;
}

export function flowerFestivalWalkingRoute(start, end) {
  if (!flowerFestivalPointWalkable(start) || !flowerFestivalPointWalkable(end)) return [];
  const pathNodes = FLOWER_FESTIVAL_PATHS.flatMap((path) => path.points);
  const nodes = [start, end, ...pathNodes].filter((node, index, list) => (
    list.findIndex((candidate) => candidate.x === node.x && candidate.y === node.y) === index
  ));
  const adjacency = nodes.map(() => []);
  for (let first = 0; first < nodes.length; first += 1) {
    for (let second = first + 1; second < nodes.length; second += 1) {
      if (!flowerFestivalSegmentWalkable(nodes[first], nodes[second])) continue;
      const cost = Math.hypot(nodes[second].x - nodes[first].x, nodes[second].y - nodes[first].y);
      adjacency[first].push({ index: second, cost });
      adjacency[second].push({ index: first, cost });
    }
  }
  const distance = nodes.map(() => Number.POSITIVE_INFINITY);
  const previous = nodes.map(() => -1);
  const visited = new Set();
  distance[0] = 0;
  while (visited.size < nodes.length) {
    let current = -1;
    for (let index = 0; index < nodes.length; index += 1) {
      if (!visited.has(index) && (current < 0 || distance[index] < distance[current])) current = index;
    }
    if (current < 0 || !Number.isFinite(distance[current]) || current === 1) break;
    visited.add(current);
    for (const edge of adjacency[current]) {
      const nextDistance = distance[current] + edge.cost;
      if (nextDistance >= distance[edge.index]) continue;
      distance[edge.index] = nextDistance;
      previous[edge.index] = current;
    }
  }
  if (!Number.isFinite(distance[1])) return [];
  const route = [];
  for (let cursor = 1; cursor > 0; cursor = previous[cursor]) route.unshift(nodes[cursor]);
  return route;
}

export function clampFlowerFestivalPoint(point) {
  return {
    x: Math.max(18, Math.min(FLOWER_FESTIVAL_WIDTH - 18, Number(point?.x) || FLOWER_FESTIVAL_ENTRY.x)),
    y: Math.max(18, Math.min(FLOWER_FESTIVAL_HEIGHT - 18, Number(point?.y) || FLOWER_FESTIVAL_ENTRY.y)),
  };
}

export function captureFlowerFestivalReturnState(player, camera) {
  return {
    x: Number(player?.x) || 0,
    y: Number(player?.y) || 0,
    ridingBike: player?.ridingBike === true,
    cameraX: Number(camera?.x) || 0,
    cameraY: Number(camera?.y) || 0,
  };
}

export function flowerFestivalNearbyObject(point, radius = 62) {
  return FLOWER_FESTIVAL_OBJECTS
    .map((object) => ({ object, distance: Math.hypot(point.x - object.x, point.y - object.y) }))
    .filter((entry) => entry.distance <= radius)
    .sort((first, second) => first.distance - second.distance)[0]?.object || null;
}

export function nextFlowerFestivalShuttle(currentId) {
  const index = FLOWER_FESTIVAL_SHUTTLES.findIndex((stop) => stop.id === currentId);
  return FLOWER_FESTIVAL_SHUTTLES[(index + 1 + FLOWER_FESTIVAL_SHUTTLES.length) % FLOWER_FESTIVAL_SHUTTLES.length];
}

export function flowerFestivalVisibleChunks(camera, viewport) {
  const startColumn = Math.max(0, Math.floor(camera.x / FLOWER_FESTIVAL_CHUNK_SIZE));
  const endColumn = Math.min(
    Math.ceil(FLOWER_FESTIVAL_WIDTH / FLOWER_FESTIVAL_CHUNK_SIZE) - 1,
    Math.floor((camera.x + viewport.width) / FLOWER_FESTIVAL_CHUNK_SIZE),
  );
  const startRow = Math.max(0, Math.floor(camera.y / FLOWER_FESTIVAL_CHUNK_SIZE));
  const endRow = Math.min(
    Math.ceil(FLOWER_FESTIVAL_HEIGHT / FLOWER_FESTIVAL_CHUNK_SIZE) - 1,
    Math.floor((camera.y + viewport.height) / FLOWER_FESTIVAL_CHUNK_SIZE),
  );
  const chunks = [];
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = startColumn; column <= endColumn; column += 1) chunks.push(`${column}:${row}`);
  }
  return chunks;
}

function seededValue(x, y, salt = 0) {
  let value = Math.imul(Math.floor(x) + 0x9e3779b9, 0x85ebca6b)
    ^ Math.imul(Math.floor(y) + salt * 131, 0xc2b2ae35);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return (value >>> 0) / 4294967296;
}

export function flowerFestivalFlowerSample(x, y, bedId = "") {
  const salt = [...bedId].reduce((total, character) => total + character.charCodeAt(0), 0);
  return seededValue(x, y, salt);
}

function rectVisible(rect, camera, viewport, padding = 0) {
  return rect.x + rect.w >= camera.x - padding
    && rect.x <= camera.x + viewport.width + padding
    && rect.y + rect.h >= camera.y - padding
    && rect.y <= camera.y + viewport.height + padding;
}

function drawPixelFlower(context, x, y, color, detail) {
  context.fillStyle = "#4f7f4d";
  context.fillRect(x, y + 3, detail ? 2 : 1, detail ? 5 : 3);
  context.fillStyle = color;
  context.fillRect(x - (detail ? 2 : 1), y, detail ? 6 : 3, detail ? 4 : 2);
  if (detail) {
    context.fillStyle = "#f3c85b";
    context.fillRect(x, y + 1, 2, 2);
  }
}

function drawFlowerBeds(context, camera, viewport, reducedDetail) {
  const spacing = reducedDetail ? 30 : 20;
  DESIGN_BEDS.filter((bed) => rectVisible(bed, camera, viewport, 30)).forEach((bed) => {
    context.fillStyle = bed.palette[1];
    context.globalAlpha = 0.18;
    context.fillRect(bed.x, bed.y, bed.w, bed.h);
    context.globalAlpha = 1;
    const startX = bed.x + Math.max(0, Math.floor((camera.x - bed.x - spacing) / spacing)) * spacing;
    const endX = Math.min(bed.x + bed.w, camera.x + viewport.width + spacing);
    const startY = bed.y + Math.max(0, Math.floor((camera.y - bed.y - spacing) / spacing)) * spacing;
    const endY = Math.min(bed.y + bed.h, camera.y + viewport.height + spacing);
    for (let y = startY; y <= endY; y += spacing) {
      for (let x = startX; x <= endX; x += spacing) {
        const sample = flowerFestivalFlowerSample(x, y, bed.id);
        const offsetX = Math.round((sample - 0.5) * spacing * 0.58);
        const second = flowerFestivalFlowerSample(y, x, `${bed.id}-y`);
        const offsetY = Math.round((second - 0.5) * spacing * 0.52);
        const color = bed.palette[Math.floor(sample * bed.palette.length) % bed.palette.length];
        drawPixelFlower(context, x + offsetX, y + offsetY, color, !reducedDetail && sample > 0.28);
      }
    }
  });
}

function traceFestivalPath(context, path) {
  context.beginPath();
  context.moveTo(path.points[0].x, path.points[0].y);
  for (let index = 1; index < path.points.length; index += 1) {
    const previous = path.points[index - 1];
    const current = path.points[index];
    const next = path.points[index + 1];
    if (!next) context.lineTo(current.x, current.y);
    else context.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
    if (previous.x === current.x && previous.y === current.y) context.lineTo(current.x, current.y);
  }
}

function drawFestivalPaths(context) {
  DESIGN_PATHS.forEach((path) => {
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#958b7f";
    context.lineWidth = path.width + 12;
    traceFestivalPath(context, path);
    context.stroke();
    context.strokeStyle = path.kind === "main" ? "#d9cfbf" : "#e2d8c9";
    context.lineWidth = path.width;
    traceFestivalPath(context, path);
    context.stroke();
    context.strokeStyle = "rgba(255, 250, 234, 0.6)";
    context.lineWidth = 3;
    context.setLineDash(path.kind === "main" ? [18, 18] : [8, 16]);
    traceFestivalPath(context, path);
    context.stroke();
    context.setLineDash([]);
  });
}

function drawMountains(context, camera, viewport) {
  if (camera.y > 620) return;
  context.fillStyle = "#8eb38b";
  context.beginPath();
  context.moveTo(0, 300);
  for (let x = 0; x <= FLOWER_FESTIVAL_DESIGN_WIDTH; x += 140) {
    const peak = 90 + flowerFestivalFlowerSample(x, 71, "mountain") * 150;
    context.lineTo(x + 70, peak);
    context.lineTo(x + 140, 300);
  }
  context.lineTo(FLOWER_FESTIVAL_DESIGN_WIDTH, 390);
  context.lineTo(0, 390);
  context.closePath();
  context.fill();
  context.fillStyle = "rgba(58, 104, 73, 0.62)";
  context.beginPath();
  context.moveTo(0, 360);
  for (let x = 0; x <= FLOWER_FESTIVAL_DESIGN_WIDTH; x += 180) {
    const peak = 175 + flowerFestivalFlowerSample(x, 113, "ridge") * 125;
    context.lineTo(x + 90, peak);
    context.lineTo(x + 180, 360);
  }
  context.lineTo(FLOWER_FESTIVAL_DESIGN_WIDTH, 410);
  context.lineTo(0, 410);
  context.closePath();
  context.fill();
  const visibleLeft = Math.max(0, camera.x - 80);
  const visibleRight = Math.min(FLOWER_FESTIVAL_DESIGN_WIDTH, camera.x + viewport.width + 80);
  context.fillStyle = "rgba(236, 244, 223, 0.74)";
  for (let x = Math.floor(visibleLeft / 120) * 120; x < visibleRight; x += 120) {
    context.fillRect(x + 20, 325 + (x % 240 ? 8 : 0), 76, 8);
  }
}

function drawWelcomePlaza(context, t) {
  context.fillStyle = "#d7cab4";
  context.fillRect(80, 1370, 680, 350);
  context.fillStyle = "#f3d4e2";
  context.fillRect(110, 1430, 260, 22);
  context.fillStyle = "#c16185";
  context.fillRect(120, 1410, 18, 110);
  context.fillRect(340, 1410, 18, 110);
  context.fillRect(120, 1400, 238, 20);
  context.fillStyle = "#fff7e8";
  context.font = "bold 18px ui-monospace, monospace";
  context.textAlign = "center";
  context.fillText(t("新社花海季"), 239, 1442);
  context.fillStyle = "#284c53";
  context.fillRect(500, 1430, 170, 118);
  context.fillStyle = "#f5efdb";
  context.fillRect(510, 1440, 150, 89);
  context.fillStyle = "#6e9b73";
  context.fillRect(520, 1450, 130, 10);
  context.fillStyle = "#d96a75";
  context.fillRect(530, 1474, 90, 8);
  context.fillStyle = "#c8a66c";
  context.fillRect(530, 1494, 116, 8);
  context.fillStyle = "#284c53";
  context.font = "bold 11px ui-monospace, monospace";
  context.fillText(t("園區地圖"), 585, 1520);
  // A small horizon silhouette makes the main landmark visible as soon as the player enters.
  context.fillStyle = "#d8779f";
  context.fillRect(670, 1324, 84, 46);
  context.fillRect(692, 1288, 40, 38);
  context.fillStyle = "#f3bfd4";
  context.fillRect(683, 1308, 14, 18);
  context.fillRect(729, 1300, 14, 26);
  context.fillStyle = "#fff0dd";
  context.fillRect(704, 1338, 17, 32);
  context.fillStyle = "#6d4b5c";
  context.font = "bold 9px ui-monospace, monospace";
  context.fillText(t("遠眺城堡"), 712, 1388);
}

function drawCastle(context, t) {
  const x = 1420;
  const y = 980;
  context.fillStyle = "rgba(76, 49, 55, 0.22)";
  context.fillRect(x - 230, y + 180, 470, 22);
  context.fillStyle = "#f3b4cf";
  context.fillRect(x - 210, y - 70, 420, 250);
  context.fillStyle = "#4f7a55";
  context.fillRect(x - 190, y - 43, 380, 88);
  context.fillStyle = "#ec89b3";
  context.fillRect(x - 225, y - 88, 450, 32);
  for (let scallop = -190; scallop <= 190; scallop += 48) {
    context.fillRect(x + scallop, y - 60, 28, 20);
  }
  const towers = [
    { dx: -150, h: 150, w: 86, color: "#a8d5d4" },
    { dx: -60, h: 230, w: 106, color: "#f1adc9" },
    { dx: 55, h: 180, w: 92, color: "#d4c0e6" },
    { dx: 145, h: 135, w: 76, color: "#f0d16f" },
  ];
  towers.forEach((tower, index) => {
    context.fillStyle = tower.color;
    context.fillRect(x + tower.dx - tower.w / 2, y - 70 - tower.h, tower.w, tower.h);
    context.fillStyle = index % 2 ? "#d65772" : "#7f6997";
    context.fillRect(x + tower.dx - tower.w / 2 - 8, y - 82 - tower.h, tower.w + 16, 18);
    context.fillStyle = "#fff0dd";
    context.fillRect(x + tower.dx - 7, y - 35 - tower.h, 14, 20);
  });
  context.fillStyle = "#d65578";
  context.fillRect(x - 10, y - 342, 20, 40);
  context.fillStyle = "#f7d46f";
  context.fillRect(x - 6, y - 370, 12, 28);
  context.fillStyle = "#6e4d59";
  context.fillRect(x - 38, y + 80, 76, 100);
  context.fillStyle = "#b7ddea";
  context.fillRect(x - 31, y + 87, 62, 84);
  context.fillStyle = "#fff7e8";
  context.font = "bold 16px ui-monospace, monospace";
  context.textAlign = "center";
  context.fillText(t("甜點花城堡"), x, y + 28);
}

function drawSnackStalls(context, t) {
  DESIGN_SNACK_STALLS.forEach((stall) => {
    context.fillStyle = "rgba(47, 47, 38, 0.18)";
    context.fillRect(stall.x + 5, stall.y + 86, 108, 7);
    context.fillStyle = "#f5e4bd";
    context.fillRect(stall.x, stall.y + 26, 112, 62);
    for (let stripe = 0; stripe < 112; stripe += 16) {
      context.fillStyle = stripe % 32 ? "#fff3d9" : stall.color;
      context.fillRect(stall.x + stripe, stall.y + 8, Math.min(16, 112 - stripe), 22);
    }
    context.fillStyle = "#6f503d";
    context.fillRect(stall.x + 10, stall.y + 52, 92, 12);
    context.fillStyle = "#fff7e8";
    context.font = "bold 9px ui-monospace, monospace";
    context.textAlign = "center";
    context.fillText(t(stall.label), stall.x + 56, stall.y + 60);
  });
  context.fillStyle = "#76a76a";
  context.fillRect(1870, 1320, 690, 230);
  context.fillStyle = "#f1d775";
  context.fillRect(1940, 1395, 125, 70);
  context.fillStyle = "#e9b2c8";
  context.fillRect(2260, 1430, 150, 75);
}

function drawOverlook(context, t) {
  context.fillStyle = "#9a754d";
  context.fillRect(1230, 180, 560, 260);
  context.fillStyle = "#d4b986";
  context.fillRect(1250, 198, 520, 218);
  context.fillStyle = "#765338";
  for (let x = 1245; x <= 1775; x += 44) context.fillRect(x, 170, 8, 48);
  context.fillRect(1240, 170, 540, 10);
  context.fillStyle = "#315f67";
  context.fillRect(1435, 205, 130, 44);
  context.fillStyle = "#fff7e8";
  context.font = "bold 13px ui-monospace, monospace";
  context.textAlign = "center";
  context.fillText(t("山景觀景台"), 1500, 228);
}

function drawFestivalObject(context, object, collected, now, t) {
  const bob = Math.floor(now / 360 + object.x) % 2;
  if (object.kind === "stamp") {
    context.fillStyle = collected ? "#e9bf4e" : "#d86a82";
    context.fillRect(object.x - 15, object.y - 24 - bob, 30, 30);
    context.fillStyle = "#fff7e8";
    context.fillRect(object.x - 8, object.y - 17 - bob, 16, 16);
    context.fillStyle = collected ? "#705c2d" : "#8f3f59";
    context.fillRect(object.x - 4, object.y - 13 - bob, 8, 8);
  } else if (object.kind === "photo") {
    context.fillStyle = "#365d69";
    context.fillRect(object.x - 17, object.y - 18, 34, 24);
    context.fillStyle = "#fff7e8";
    context.fillRect(object.x - 10, object.y - 12, 20, 12);
    context.fillStyle = "#df6d82";
    context.fillRect(object.x - 4, object.y - 9, 8, 7);
    context.fillStyle = "#6a503f";
    context.fillRect(object.x - 2, object.y + 6, 4, 17);
  } else if (object.kind === "spirit") {
    if (collected) return;
    context.fillStyle = object.color;
    context.fillRect(object.x - 8, object.y - 18 - bob * 2, 16, 16);
    context.fillRect(object.x - 13, object.y - 13 - bob * 2, 26, 7);
    context.fillStyle = "#3c4d4e";
    context.fillRect(object.x - 5, object.y - 12 - bob * 2, 3, 3);
    context.fillRect(object.x + 3, object.y - 12 - bob * 2, 3, 3);
    context.fillStyle = "rgba(255,255,255,0.7)";
    context.fillRect(object.x - 17, object.y - 14 - bob * 2, 5, 8);
    context.fillRect(object.x + 12, object.y - 14 - bob * 2, 5, 8);
  } else if (object.kind === "shuttle") {
    context.fillStyle = "#4b8291";
    context.fillRect(object.x - 22, object.y - 26, 44, 30);
    context.fillStyle = "#f0c654";
    context.fillRect(object.x - 18, object.y - 22, 36, 8);
    context.fillStyle = "#fff7e8";
    context.fillRect(object.x - 13, object.y - 11, 26, 8);
    context.fillStyle = "#2c4650";
    context.fillRect(object.x - 14, object.y + 4, 8, 5);
    context.fillRect(object.x + 6, object.y + 4, 8, 5);
  } else if (object.kind === "exit") {
    context.fillStyle = "#396a65";
    context.fillRect(object.x - 28, object.y - 42, 56, 42);
    context.fillStyle = "#fff7e8";
    context.fillRect(object.x - 21, object.y - 34, 42, 20);
    context.fillStyle = "#396a65";
    context.font = "bold 9px ui-monospace, monospace";
    context.textAlign = "center";
    context.fillText("EXIT", object.x, object.y - 23);
  }
  if (object.kind !== "spirit" || !collected) {
    context.fillStyle = "rgba(255, 248, 231, 0.92)";
    context.font = "bold 9px ui-monospace, monospace";
    context.textAlign = "center";
    const label = t(object.label);
    const width = Math.min(170, Math.max(70, context.measureText(label).width + 12));
    context.fillRect(object.x - width / 2, object.y + 12, width, 17);
    context.fillStyle = "#1f4249";
    context.fillText(label, object.x, object.y + 21);
  }
}

function drawFestivalHud(context, viewport, progress, t) {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = "rgba(31, 66, 73, 0.91)";
  context.fillRect(14, 14, Math.min(330, viewport.width - 92), 64);
  context.fillStyle = "#fff7e8";
  context.font = "bold 13px ui-monospace, monospace";
  context.textAlign = "left";
  context.fillText(t("新社花海季｜原創遊戲活動"), 26, 34);
  context.font = "11px ui-monospace, monospace";
  context.fillText(`${t("六區集章")} ${progress.stamps}/6　${t("花精靈")} ${progress.spirits}/5　${t("拍照點")} ${progress.photos}/3`, 26, 56);
  context.fillStyle = "#f2c653";
  context.fillRect(26, 64, Math.max(8, 288 * (progress.stamps / 6)), 5);
}

export function drawFlowerFestivalScene({
  context,
  camera,
  viewport,
  now,
  reducedDetail = false,
  collectedStamps = new Set(),
  foundSpirits = new Set(),
  visitedPhotos = new Set(),
  drawActors = () => {},
  translate = (value) => value,
}) {
  const designCamera = {
    x: camera.x / FLOWER_FESTIVAL_SCALE,
    y: camera.y / FLOWER_FESTIVAL_SCALE,
  };
  const designViewport = {
    width: viewport.width / FLOWER_FESTIVAL_SCALE,
    height: viewport.height / FLOWER_FESTIVAL_SCALE,
  };
  context.imageSmoothingEnabled = false;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = "#b7d8e8";
  context.fillRect(0, 0, viewport.width, viewport.height);
  context.save();
  context.translate(-Math.round(camera.x), -Math.round(camera.y));
  context.scale(FLOWER_FESTIVAL_SCALE, FLOWER_FESTIVAL_SCALE);
  context.fillStyle = "#8fbd76";
  context.fillRect(designCamera.x - 2, designCamera.y - 2, designViewport.width + 4, designViewport.height + 4);
  drawMountains(context, designCamera, designViewport);
  drawFlowerBeds(context, designCamera, designViewport, reducedDetail);
  drawFestivalPaths(context);
  drawWelcomePlaza(context, translate);
  drawOverlook(context, translate);
  drawSnackStalls(context, translate);
  drawCastle(context, translate);
  DESIGN_OBJECTS.forEach((object) => {
    const rect = { x: object.x - 100, y: object.y - 70, w: 200, h: 130 };
    if (!rectVisible(rect, designCamera, designViewport, 20)) return;
    const collected = object.kind === "stamp"
      ? collectedStamps.has(object.id)
      : object.kind === "spirit"
        ? foundSpirits.has(object.id)
        : object.kind === "photo" && visitedPhotos.has(object.id);
    drawFestivalObject(context, object, collected, now, translate);
  });
  context.restore();
  context.save();
  context.translate(-Math.round(camera.x), -Math.round(camera.y));
  drawActors();
  context.restore();
  drawFestivalHud(context, viewport, {
    stamps: collectedStamps.size,
    spirits: foundSpirits.size,
    photos: visitedPhotos.size,
  }, translate);
}
