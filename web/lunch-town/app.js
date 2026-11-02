const WIDTH = 960;
const HEIGHT = 640;
const DEFAULT_DATE = "2026-10-30";
const SHOWCASE_CITY = "臺中市";
const DISTRICT_GROUP_ORDER = ["海線", "城區", "山線", "屯區"];
const DISTRICT_DISPLAY_ORDER = [];
const DISTRICT_ZONES = {};
const DISTRICT_ZONE_WIDTH = 440;
const DISTRICT_ZONE_HEIGHT = 320;
const DISTRICT_ZONE_GAP_X = 34;
const DISTRICT_ZONE_GAP_Y = 34;
const DISTRICT_ZONE_ORIGIN_X = 28;
const DISTRICT_ZONE_ORIGIN_Y = 28;
const DISTRICT_GRID_COLUMNS = 8;
const DISTRICT_GRID_ROWS = 6;
const WORLD_WIDTH = DISTRICT_ZONE_ORIGIN_X * 2
  + DISTRICT_GRID_COLUMNS * DISTRICT_ZONE_WIDTH
  + (DISTRICT_GRID_COLUMNS - 1) * DISTRICT_ZONE_GAP_X;
const WORLD_HEIGHT = DISTRICT_ZONE_ORIGIN_Y * 2
  + DISTRICT_GRID_ROWS * DISTRICT_ZONE_HEIGHT
  + (DISTRICT_GRID_ROWS - 1) * DISTRICT_ZONE_GAP_Y;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const canvas = document.querySelector("#townCanvas");
const context = canvas.getContext("2d", { alpha: false });
const refs = {
  app: document.querySelector("#townApp"),
  date: document.querySelector("#mealDate"),
  loading: document.querySelector("#loadingScreen"),
  prompt: document.querySelector("#interactionPrompt"),
  schoolList: document.querySelector("#schoolList"),
  progress: document.querySelector("#visitProgress"),
  mobilePad: document.querySelector("#mobilePad"),
  dialog: document.querySelector("#mealDialog"),
  dialogClose: document.querySelector("#dialogClose"),
  dialogKicker: document.querySelector("#mealDialogKicker"),
  dialogTitle: document.querySelector("#mealDialogTitle"),
  dialogBody: document.querySelector("#mealDialogBody"),
  districtBadge: document.querySelector("#districtBadge"),
  districtFeature: document.querySelector("#districtFeature"),
  districtSource: document.querySelector("#districtSource"),
  npcDialogue: document.querySelector("#npcDialogue"),
  npcName: document.querySelector("#npcName"),
  npcRole: document.querySelector("#npcRole"),
  npcText: document.querySelector("#npcText"),
  npcNext: document.querySelector("#npcNext"),
  npcClose: document.querySelector("#npcClose"),
  announcement: document.querySelector("#townAnnouncement"),
};

const COLORS = {
  grass: "#6fa66d",
  grassAlt: "#79ad73",
  road: "#687779",
  roadEdge: "#d7c99e",
  roadLine: "#f0d36b",
  water: "#5c9fb0",
  waterLight: "#78b9c3",
  fence: "#f4e7c5",
  fenceDark: "#8a7458",
  ink: "#173443",
  paper: "#fff8e7",
  roof: "#c9593e",
  roofDark: "#873c35",
  wall: "#ead9aa",
  wallBlue: "#bed8d4",
  window: "#3d7185",
  track: "#ca6649",
  trackLine: "#f8e8cf",
  tree: "#3e7553",
  treeLight: "#5d9664",
  trunk: "#76513a",
  yellow: "#efc454",
};

const CAMPUS_THEMES = ["brick", "fence", "lamps", "hedge", "open", "mixed"];
const CAMPUS_FACILITIES = ["playground", "garden", "track", "court", "library", "garden"];
const CAMPUS_COLORS = ["#a8c888", "#9bc7a5", "#b6c99b", "#9dc3a5", "#b6c69a", "#9fc7b3"];

const CHARACTER_PROFILES = [
  { role: "student", skin: "#efbd91", hair: "#302623", hairStyle: "crop", outfit: "#447ea0", outfitDark: "#294f6d", accent: "#f2c657", expression: "happy", accessory: "backpack" },
  { role: "student", skin: "#d99a70", hair: "#241f20", hairStyle: "bob", outfit: "#d76248", outfitDark: "#873f3b", accent: "#f2cf6e", expression: "curious", accessory: "book" },
  { role: "student", skin: "#f0c6a0", hair: "#6f4633", hairStyle: "ponytail", outfit: "#648b58", outfitDark: "#365c48", accent: "#f5d66e", expression: "happy", accessory: "backpack" },
  { role: "student", skin: "#bb795b", hair: "#1e2527", hairStyle: "spiky", outfit: "#e2a33f", outfitDark: "#72523c", accent: "#487a96", expression: "determined", accessory: "book" },
  { role: "teacher", skin: "#e8b58b", hair: "#4e342d", hairStyle: "bun", outfit: "#8c6689", outfitDark: "#59445d", accent: "#f1d49b", expression: "kind", accessory: "book" },
  { role: "teacher", skin: "#c98864", hair: "#292526", hairStyle: "side-part", outfit: "#4f8090", outfitDark: "#2c4f5c", accent: "#d7b65a", expression: "calm", accessory: "glasses" },
  { role: "nutritionist", skin: "#e7b18a", hair: "#56382f", hairStyle: "ponytail", outfit: "#f0e8d5", outfitDark: "#52756b", accent: "#6e9e68", expression: "kind", accessory: "clipboard" },
  { role: "cook", skin: "#efbd98", hair: "#47352d", hairStyle: "chef", outfit: "#f2eee0", outfitDark: "#65747c", accent: "#d55a44", expression: "happy", accessory: "apron" },
  { role: "nurse", skin: "#d89a78", hair: "#352823", hairStyle: "bob", outfit: "#e8efe8", outfitDark: "#527d72", accent: "#d64d4d", expression: "kind", accessory: "medical" },
  { role: "crossing-guard", skin: "#bb785a", hair: "#252326", hairStyle: "cap", outfit: "#e28d37", outfitDark: "#354d59", accent: "#f4db54", expression: "determined", accessory: "flag" },
  { role: "gardener", skin: "#e5aa7c", hair: "#5b3e2e", hairStyle: "cap", outfit: "#5d8757", outfitDark: "#3c5c43", accent: "#d5b75b", expression: "calm", accessory: "watering-can" },
  { role: "librarian", skin: "#f0c29b", hair: "#714a38", hairStyle: "bob", outfit: "#a36982", outfitDark: "#61445e", accent: "#e8c25d", expression: "curious", accessory: "glasses" },
  { role: "parent", skin: "#d18c68", hair: "#302623", hairStyle: "wavy", outfit: "#507e9c", outfitDark: "#304f66", accent: "#e9b854", expression: "kind", accessory: "tote" },
  { role: "principal", skin: "#edbc92", hair: "#4b4644", hairStyle: "side-part", outfit: "#59667b", outfitDark: "#333b4b", accent: "#c85a48", expression: "calm", accessory: "tie" },
  { role: "vendor", skin: "#b97859", hair: "#2b2321", hairStyle: "curl", outfit: "#cf6549", outfitDark: "#743e39", accent: "#f0c95f", expression: "happy", accessory: "apron" },
];

const CHILD_NAMES = [
  "小晴", "阿禾", "米米", "樂樂", "小宇", "小葵", "小橙", "泡泡", "小樹", "芽芽",
  "小森", "朵朵", "星星", "小沐", "果果", "丸丸", "小麥", "小雨", "小風", "小溪",
  "小石", "小花", "小海", "小山", "小光", "小葉", "小米", "小桃", "小栗",
];
const DISTRICT_ADULTS = [
  { name: "晨露老師", role: "teacher" },
  { name: "米糰營養師", role: "nutritionist" },
  { name: "紅豆廚房阿姨", role: "cook" },
  { name: "青芽護理師", role: "nurse" },
  { name: "橘帽導護員", role: "crossing-guard" },
  { name: "樹叔園丁", role: "gardener" },
  { name: "書頁館員", role: "librarian" },
  { name: "林校長", role: "principal" },
];

const ROLE_LABELS = {
  student: "學生",
  teacher: "老師",
  nutritionist: "營養師",
  cook: "廚房人員",
  nurse: "護理師",
  "crossing-guard": "導護人員",
  gardener: "校園園丁",
  librarian: "圖書館員",
  parent: "家長",
  principal: "校長",
  vendor: "市場攤主",
};

const ROLE_DIALOGUES = {
  student: [
    "我每天先看看午餐有什麼，再決定最想先認識哪一道菜。",
    "遇到不熟悉的食物，我會先聞一聞、看一看，再試試一小口。",
    "今天我們班在猜，菜單裡哪一道用了當季蔬菜。",
    "我最喜歡和同學交換菜色的故事，但不會交換餐盤裡的食物喔。",
    "老師說吃飯慢一點，才有時間發現不同的味道和口感。",
  ],
  teacher: [
    "午餐前，我會提醒孩子洗手、排隊，也留意每個人的用餐狀況。",
    "我鼓勵孩子描述味道和口感，不用把食物分成『好』或『壞』。",
    "班上的飲食教育會配合當天菜單，但不會要求孩子勉強吃完。",
    "若孩子有飲食需求，我會依校方正式流程和家長、相關人員確認。",
  ],
  nutritionist: [
    "看菜單不能只看一道菜；主食、蛋白質、蔬菜和水果要一起理解。",
    "公開菜單沒有列出的欄位，我不會自行猜測成分或過敏原。",
    "菜色名稱相同，實際食材與作法也可能不同，要以當日紀錄為準。",
    "營養資料是理解餐點的線索，不是替孩子貼上分數或標籤。",
  ],
  cook: [
    "我正在確認今天的備料順序，讓每一道菜能準時送到餐桶。",
    "大量供餐要留意溫度、時間與器具清潔，每一步都不能省略。",
    "菜單可能因供貨或校方安排調整，最後仍以當天實際供餐為準。",
    "切菜大小和烹調時間會影響口感，孩子願意吃得舒服也很重要。",
  ],
  nurse: [
    "嚴重過敏不能只看菜名判斷，仍要向校方確認食材、製程與交叉接觸。",
    "沒有顯示提醒不等於安全，也不代表餐點一定不含特定過敏原。",
    "如果孩子用餐後不舒服，應立即告訴老師或校護，不要自己忍耐。",
    "健康照護需要真實的當日資料，不能拿別天或別校紀錄代替。",
  ],
  "crossing-guard": [
    "過街前先停、看、聽，等號誌和導護指示再通過。",
    "放學時間人多，走在行人動線裡，比趕快穿過馬路更重要。",
    "雨天視線比較差，雨傘不要遮住眼睛，也要留意轉彎車輛。",
  ],
  gardener: [
    "菜園裡的葉子每天都不一樣，觀察季節也是認識食物的方法。",
    "澆水要看土壤，不是每一盆都倒一樣多，照顧植物也需要觀察。",
    "落葉可以成為堆肥材料，校園裡也有食物循環的小故事。",
  ],
  librarian: [
    "圖書館有食物、農業和料理的書，能把午餐延伸成好多故事。",
    "讀產地故事時，也要分清楚歷史資料和今天實際使用的食材。",
    "想查一道菜，可以先從食材名稱、季節和料理方式開始找。",
  ],
  principal: [
    "學校午餐要兼顧供餐安全、教育意義和孩子實際的用餐感受。",
    "公開資訊若有異動，學校會依正式流程更新，不能用猜測補上空白。",
    "每所學校的校園空間與用餐文化都不同，重要的是讓孩子安心吃飯。",
    "家長若對當日供餐有疑問，可以循校方聯絡管道確認實際情況。",
  ],
};

const PLAYER_PROFILE = {
  role: "explorer",
  skin: "#efbd91",
  hair: "#263039",
  hairStyle: "side-part",
  outfit: "#e85e3f",
  outfitDark: "#2d4d68",
  accent: "#f0c454",
  expression: "determined",
  accessory: "satchel",
};

const state = {
  schools: [],
  districtThemes: new Map(),
  districtGroups: [],
  mapNote: "",
  date: DEFAULT_DATE,
  visited: new Set(),
  keys: new Set(),
  moveTarget: null,
  lastTime: performance.now(),
  lastPromptTarget: null,
  player: { x: WIDTH / 2, y: HEIGHT / 2 + 24, size: 16, direction: "down", step: 0, isMoving: false },
  camera: { x: 0, y: 0 },
  collisions: [],
  npcs: [],
  pets: [],
  dialogueNpc: null,
  dialogueStep: 0,
  activeDistrict: "",
  ready: false,
};

init();

async function init() {
  bindEvents();
  try {
    const [schools, account, themePayload] = await Promise.all([
      loadSchools(),
      loadAccountPreference(),
      loadDistrictThemes(),
    ]);
    configureDistrictThemes(themePayload);
    const themedDistricts = new Set(DISTRICT_DISPLAY_ORDER);
    state.schools = createSchoolLayouts(schools.filter(
      (school) => school.city === SHOWCASE_CITY && themedDistricts.has(school.district),
    ));
    if (!state.schools.length) throw new Error("找不到臺中市 29 區學校資料");
    const dates = [...new Set(state.schools.flatMap((school) => school.recordDates || []))].sort().reverse();
    state.date = dates.includes(DEFAULT_DATE) ? DEFAULT_DATE : dates[0] || DEFAULT_DATE;
    renderDates(dates);
    renderSchoolList();
    updateProgress();
    buildCollisions();
    createTownCharacters();
    const defaultSchool = state.schools.find((school) => Number(school.fatraceSchoolId) === Number(account?.defaultSchoolId));
    placePlayerAtGate(defaultSchool || state.schools.find((school) => school.district === "西區") || state.schools[0]);
    updateCamera(true);
    state.ready = true;
    refs.app.setAttribute("aria-busy", "false");
    refs.loading.classList.add("is-ready");
    canvas.focus({ preventScroll: true });
    announce(`臺中 29 區營養午餐小鎮已建立，共有 ${state.schools.length} 間學校與 ${state.npcs.length} 位小鎮角色。`);
  } catch (error) {
    console.error(error);
    refs.loading.querySelector("strong").textContent = "午餐小鎮暫時無法建立";
    refs.loading.querySelector("span:last-child").textContent = error instanceof Error ? error.message : "讀取資料時發生錯誤";
    refs.app.setAttribute("aria-busy", "false");
  }
  requestAnimationFrame(frame);
}

function bindEvents() {
  window.addEventListener("keydown", (event) => {
    const direction = directionForKey(event.key);
    if (direction) {
      event.preventDefault();
      state.keys.add(direction);
      state.moveTarget = null;
    }
    if (["Enter", " "].includes(event.key) && !refs.dialog.open) {
      event.preventDefault();
      if (state.dialogueNpc) advanceNpcDialogue();
      else interactWithNearbyTarget();
    }
    if (event.key === "Escape" && refs.dialog.open) refs.dialog.close();
    else if (event.key === "Escape" && state.dialogueNpc) closeNpcDialogue();
  });
  window.addEventListener("keyup", (event) => {
    const direction = directionForKey(event.key);
    if (direction) state.keys.delete(direction);
  });
  window.addEventListener("blur", () => state.keys.clear());
  canvas.addEventListener("pointerdown", (event) => {
    canvas.focus({ preventScroll: true });
    const point = canvasPoint(event);
    const npc = state.npcs.find((candidate) => Math.hypot(point.x - candidate.x, point.y - candidate.y) < 22);
    if (npc) {
      openNpcDialogue(npc);
      return;
    }
    const school = state.schools.find((candidate) => pointInRect(point, candidate.layout));
    if (school) {
      openSchool(school);
      return;
    }
    state.moveTarget = point;
  });
  refs.date.addEventListener("change", () => {
    state.date = refs.date.value;
    state.visited.clear();
    renderSchoolList();
    updateProgress();
    if (refs.dialog.open) refs.dialog.close();
    announce(`供餐日期已切換為 ${formatDate(state.date)}。`);
  });
  refs.dialogClose.addEventListener("click", () => refs.dialog.close());
  refs.dialog.addEventListener("click", (event) => {
    if (event.target === refs.dialog) refs.dialog.close();
  });
  refs.npcNext.addEventListener("click", advanceNpcDialogue);
  refs.npcClose.addEventListener("click", closeNpcDialogue);
  refs.mobilePad.querySelectorAll("button[data-direction]").forEach((button) => {
    const direction = button.dataset.direction;
    const start = (event) => {
      event.preventDefault();
      state.keys.add(direction);
      state.moveTarget = null;
    };
    const stop = (event) => {
      event.preventDefault();
      state.keys.delete(direction);
    };
    button.addEventListener("pointerdown", start);
    button.addEventListener("pointerup", stop);
    button.addEventListener("pointercancel", stop);
    button.addEventListener("pointerleave", stop);
  });
  refs.mobilePad.querySelector("[data-action='interact']").addEventListener("click", () => {
    if (state.dialogueNpc) advanceNpcDialogue();
    else interactWithNearbyTarget();
  });
}

async function loadSchools() {
  const endpoints = ["/data/schools.json", "/api/schools"];
  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`${endpoint} 回傳 ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.schools)) throw new Error("學校名冊格式不正確");
      return payload.schools;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("無法讀取學校名冊");
}

async function loadDistrictThemes() {
  const response = await fetch("./taichung-district-themes.json", {
    headers: { Accept: "application/json" },
    cache: "no-cache",
  });
  if (!response.ok) throw new Error(`行政區特色資料回傳 ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.districts) || payload.districts.length !== 29) {
    throw new Error("臺中 29 區特色資料格式不正確");
  }
  return payload;
}

function configureDistrictThemes(payload) {
  state.districtGroups = Array.isArray(payload.groups) ? payload.groups : [];
  state.mapNote = String(payload.mapNote || "");
  const occupiedGridCells = new Set();
  payload.districts.forEach((theme) => {
    const [column, row] = payload.cardinalGrid?.[theme.name] || theme.grid;
    if (!Number.isInteger(column) || !Number.isInteger(row)
      || column < 0 || column >= DISTRICT_GRID_COLUMNS
      || row < 0 || row >= DISTRICT_GRID_ROWS) {
      throw new Error(`${theme.name}的行政區方位座標不正確`);
    }
    const gridKey = `${column},${row}`;
    if (occupiedGridCells.has(gridKey)) throw new Error(`${theme.name}的行政區方位座標重複`);
    occupiedGridCells.add(gridKey);
    const zone = {
      x: DISTRICT_ZONE_ORIGIN_X + column * (DISTRICT_ZONE_WIDTH + DISTRICT_ZONE_GAP_X),
      y: DISTRICT_ZONE_ORIGIN_Y + row * (DISTRICT_ZONE_HEIGHT + DISTRICT_ZONE_GAP_Y),
      w: DISTRICT_ZONE_WIDTH,
      h: DISTRICT_ZONE_HEIGHT,
      color: theme.color,
      group: theme.group,
    };
    state.districtThemes.set(theme.name, theme);
    DISTRICT_DISPLAY_ORDER.push(theme.name);
    DISTRICT_ZONES[theme.name] = zone;
  });
}

async function loadAccountPreference() {
  try {
    const response = await fetch("/api/account", { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function renderDates(dates) {
  refs.date.innerHTML = "";
  dates.forEach((date) => {
    const option = document.createElement("option");
    option.value = date;
    option.textContent = formatDate(date);
    option.selected = date === state.date;
    refs.date.append(option);
  });
}

function renderSchoolList() {
  refs.schoolList.innerHTML = "";
  DISTRICT_GROUP_ORDER.forEach((groupName) => {
    const region = document.createElement("section");
    region.className = "school-region-group";
    const regionTitle = document.createElement("h3");
    const districtCount = DISTRICT_DISPLAY_ORDER.filter(
      (district) => state.districtThemes.get(district)?.group === groupName,
    ).length;
    regionTitle.textContent = `${groupName}・${districtCount} 區`;
    region.append(regionTitle);
    DISTRICT_DISPLAY_ORDER.filter(
      (district) => state.districtThemes.get(district)?.group === groupName,
    ).forEach((district) => {
      const districtSchools = state.schools.filter((school) => school.district === district);
      if (!districtSchools.length) return;
      const group = document.createElement("details");
      group.className = "school-district-group";
      group.open = district === state.activeDistrict;
      const title = document.createElement("summary");
      title.innerHTML = `<strong>${escapeHtml(district)}</strong><span>${districtSchools.length} 校</span>`;
      group.append(title);
      districtSchools.forEach((school) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `school-button${state.visited.has(String(school.fatraceSchoolId)) ? " is-visited" : ""}`;
        const available = (school.recordDates || []).includes(state.date);
        button.innerHTML = `
          <span class="school-number">${school.districtNumber}</span>
          <strong>${escapeHtml(school.name)}</strong>
          <span class="school-status">${available ? "有菜單" : "待公布"}</span>
        `;
        button.addEventListener("click", () => openSchool(school));
        group.append(button);
      });
      region.append(group);
    });
    refs.schoolList.append(region);
  });
}

function createSchoolLayouts(schools) {
  const results = [];
  DISTRICT_DISPLAY_ORDER.forEach((district) => {
    const zone = DISTRICT_ZONES[district];
    const districtSchools = schools
      .filter((school) => school.district === district)
      .sort((first, second) => String(first.name).localeCompare(String(second.name), "zh-Hant"));
    const columns = Math.min(districtSchools.length, 6, Math.max(1, Math.ceil(Math.sqrt(districtSchools.length * 1.6))));
    const rows = Math.max(1, Math.ceil(districtSchools.length / columns));
    const cellWidth = (zone.w - 32) / columns;
    const cellHeight = (zone.h - 92) / rows;
    const width = Math.min(150, Math.max(54, cellWidth - 12));
    const height = Math.min(92, Math.max(42, cellHeight - 10));
    districtSchools.forEach((school, districtIndex) => {
      const column = districtIndex % columns;
      const row = Math.floor(districtIndex / columns);
      const x = zone.x + 16 + column * cellWidth + (cellWidth - width) / 2;
      const y = zone.y + 78 + row * cellHeight + (cellHeight - height) / 2;
      const styleIndex = (districtIndex + DISTRICT_DISPLAY_ORDER.indexOf(district) * 2) % CAMPUS_THEMES.length;
      results.push({
        ...school,
        index: results.length,
        districtNumber: districtIndex + 1,
        layout: {
          x,
          y,
          w: width,
          h: height,
          gate: row % 2 === 0 ? "south" : "north",
          theme: CAMPUS_THEMES[styleIndex],
          facility: CAMPUS_FACILITIES[styleIndex],
          color: CAMPUS_COLORS[styleIndex],
          district,
          compact: true,
        },
      });
    });
  });
  return results;
}

function buildCollisions() {
  state.collisions = state.schools.flatMap((school) => [
    schoolBuildingRect(school),
    ...campusBoundaryRects(school.layout),
  ]);
}

function campusBoundaryRects(layout) {
  if (layout.compact || layout.theme === "open") return [];
  const thickness = 7;
  const gap = 44;
  const gateStart = layout.x + layout.w / 2 - gap / 2;
  const horizontal = layout.gate === "north" ? layout.y : layout.y + layout.h - thickness;
  return [
    { x: layout.x, y: layout.y, w: thickness, h: layout.h },
    { x: layout.x + layout.w - thickness, y: layout.y, w: thickness, h: layout.h },
    { x: layout.x, y: layout.gate === "south" ? layout.y : layout.y + layout.h - thickness, w: layout.w, h: thickness },
    { x: layout.x, y: horizontal, w: gateStart - layout.x, h: thickness },
    { x: gateStart + gap, y: horizontal, w: layout.x + layout.w - gateStart - gap, h: thickness },
  ];
}

function schoolBuildingRect(school) {
  const { x, y, w, h, gate, compact } = school.layout;
  if (compact) {
    const buildingWidth = Math.max(28, Math.min(70, w * 0.58));
    const buildingHeight = Math.max(18, Math.min(38, h * 0.48));
    return {
      x: x + (w - buildingWidth) / 2,
      y: gate === "south" ? y + 6 : y + h - buildingHeight - 6,
      w: buildingWidth,
      h: buildingHeight,
    };
  }
  return gate === "south"
    ? { x: x + 18, y: y + 16, w: 104, h: 52 }
    : { x: x + 18, y: y + h - 68, w: 104, h: 52 };
}

function createTownCharacters() {
  const identities = DISTRICT_DISPLAY_ORDER.flatMap((district, index) => {
    const adult = DISTRICT_ADULTS[index % DISTRICT_ADULTS.length];
    return [
      { district, name: CHILD_NAMES[index], role: "student" },
      { district, name: adult.name, role: adult.role },
    ];
  });
  const districtCounts = new Map();
  state.npcs = identities.map((identity, index) => {
    const districtIndex = districtCounts.get(identity.district) || 0;
    districtCounts.set(identity.district, districtIndex + 1);
    const profiles = CHARACTER_PROFILES.filter((profile) => profile.role === identity.role);
    const profile = profiles[districtIndex % profiles.length] || CHARACTER_PROFILES[0];
    const routes = districtNpcRoutes(identity.district);
    const route = routes[districtIndex % routes.length];
    return {
    ...profile,
    ...identity,
    route,
    segment: districtIndex % route.length,
    progress: (index * 0.17) % 1,
    speed: reducedMotion ? 0 : 18 + (index % 5) * 3,
    x: 0,
    y: 0,
    direction: "down",
    step: index,
    isMoving: !reducedMotion,
    dialogues: [
      state.districtThemes.get(identity.district)?.dialogue,
      ...(ROLE_DIALOGUES[identity.role] || ["今天的小鎮很熱鬧，慢慢走、仔細看看吧。"]),
    ].filter(Boolean),
    dialogueCursor: 0,
    };
  });
  state.pets = DISTRICT_DISPLAY_ORDER.map((district, index) => {
    const zone = DISTRICT_ZONES[district];
    return {
      x: zone.x + zone.w - 38,
      y: zone.y + zone.h - 30,
      color: index % 2 ? "#715544" : "#d98b45",
      phase: index * 0.7,
      kind: index % 2 ? "dog" : "cat",
    };
  });
}

function districtNpcRoutes(district) {
  const zone = DISTRICT_ZONES[district];
  const x1 = zone.x + 30;
  const x2 = zone.x + zone.w - 30;
  const y1 = zone.y + 68;
  const y2 = zone.y + zone.h - 24;
  return [
    [{ x: x1, y: y1 }, { x: x2, y: y1 }],
    [{ x: x2, y: y2 }, { x: x1, y: y2 }],
    [{ x: x1, y: y1 }, { x: x1, y: y2 }],
    [{ x: x2, y: y2 }, { x: x2, y: y1 }],
    [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ],
  ];
}

function frame(now) {
  const delta = Math.min(0.04, Math.max(0, (now - state.lastTime) / 1000));
  state.lastTime = now;
  if (state.ready && !refs.dialog.open && !state.dialogueNpc) {
    updatePlayer(delta);
    updateNpcs(delta);
  }
  if (state.ready) updateCamera(false, delta);
  drawTown(now);
  requestAnimationFrame(frame);
}

function updatePlayer(delta) {
  let dx = (state.keys.has("right") ? 1 : 0) - (state.keys.has("left") ? 1 : 0);
  let dy = (state.keys.has("down") ? 1 : 0) - (state.keys.has("up") ? 1 : 0);
  if (!dx && !dy && state.moveTarget) {
    const targetDx = state.moveTarget.x - state.player.x;
    const targetDy = state.moveTarget.y - state.player.y;
    const distance = Math.hypot(targetDx, targetDy);
    if (distance < 5) state.moveTarget = null;
    else {
      dx = targetDx / distance;
      dy = targetDy / distance;
    }
  }
  state.player.isMoving = Boolean(dx || dy);
  if (state.player.isMoving) {
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    const speed = 116;
    tryMovePlayer(dx * speed * delta, 0);
    tryMovePlayer(0, dy * speed * delta);
    if (Math.abs(dx) > Math.abs(dy)) state.player.direction = dx > 0 ? "right" : "left";
    else state.player.direction = dy > 0 ? "down" : "up";
    state.player.step += delta * 10;
  }
  updateNearbyPrompt();
}

function tryMovePlayer(dx, dy) {
  const next = { x: state.player.x + dx, y: state.player.y + dy };
  next.x = Math.max(12, Math.min(WORLD_WIDTH - 12, next.x));
  next.y = Math.max(12, Math.min(WORLD_HEIGHT - 12, next.y));
  const body = { x: next.x - 7, y: next.y - 7, w: 14, h: 14 };
  if (state.collisions.some((rect) => rectanglesOverlap(body, rect))) {
    state.moveTarget = null;
    return;
  }
  state.player.x = next.x;
  state.player.y = next.y;
}

function updateCamera(snap = false, delta = 0) {
  const targetX = Math.max(0, Math.min(WORLD_WIDTH - WIDTH, state.player.x - WIDTH / 2));
  const targetY = Math.max(0, Math.min(WORLD_HEIGHT - HEIGHT, state.player.y - HEIGHT / 2));
  const amount = snap || reducedMotion ? 1 : Math.min(1, delta * 8);
  state.camera.x += (targetX - state.camera.x) * amount;
  state.camera.y += (targetY - state.camera.y) * amount;
  const district = districtAtPoint(state.player);
  if (district !== state.activeDistrict) {
    state.activeDistrict = district;
    const theme = state.districtThemes.get(district);
    refs.districtBadge.textContent = theme ? `${theme.group}・${district}` : "臺中小鎮街道";
    refs.districtFeature.textContent = theme ? `${theme.featureLabel}｜${theme.tagline}` : state.mapNote;
    refs.districtSource.hidden = !theme?.sourceUrl;
    if (theme?.sourceUrl) {
      refs.districtSource.href = theme.sourceUrl;
      refs.districtSource.setAttribute("aria-label", `查看${district}特色的官方參考來源`);
    }
  }
}

function districtAtPoint(point) {
  return DISTRICT_DISPLAY_ORDER.find((district) => pointInRect(point, DISTRICT_ZONES[district])) || "";
}

function updateNpcs(delta) {
  state.npcs.forEach((npc) => {
    const from = npc.route[npc.segment % npc.route.length];
    const to = npc.route[(npc.segment + 1) % npc.route.length];
    const distance = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    npc.progress += npc.speed * delta / distance;
    if (npc.progress >= 1) {
      npc.progress %= 1;
      npc.segment = (npc.segment + 1) % npc.route.length;
    }
    const currentFrom = npc.route[npc.segment];
    const currentTo = npc.route[(npc.segment + 1) % npc.route.length];
    npc.x = currentFrom.x + (currentTo.x - currentFrom.x) * npc.progress;
    npc.y = currentFrom.y + (currentTo.y - currentFrom.y) * npc.progress;
    npc.direction = Math.abs(currentTo.x - currentFrom.x) > Math.abs(currentTo.y - currentFrom.y)
      ? (currentTo.x > currentFrom.x ? "right" : "left")
      : (currentTo.y > currentFrom.y ? "down" : "up");
    npc.step += delta * 6;
  });
}

function drawTown(now) {
  context.imageSmoothingEnabled = false;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = COLORS.water;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.save();
  context.translate(-Math.round(state.camera.x), -Math.round(state.camera.y));
  drawGround();
  drawWaterEdges(now);
  drawRoads();
  drawDistrictLabels();
  drawDistrictFeatures(now);
  drawTownSquare();
  state.schools.filter((school) => isVisibleRect(school.layout, 60)).forEach((school) => drawCampus(school, now));
  drawStreetDetails();
  const actors = [
    ...state.npcs.map((person) => ({ kind: "person", y: person.y, person })),
    ...state.pets.map((pet) => ({ kind: "pet", y: pet.y, pet })),
    { kind: "person", y: state.player.y, person: { ...PLAYER_PROFILE, ...state.player, player: true } },
  ].filter((actor) => {
    const subject = actor.person || actor.pet;
    return isVisibleRect({ x: subject.x - 30, y: subject.y - 45, w: 60, h: 70 }, 40);
  }).sort((first, second) => first.y - second.y);
  actors.forEach((actor) => {
    if (actor.kind === "person") drawPerson(actor.person);
    else drawPet(actor.pet, now);
  });
  drawNearbyNpcMarker();
  context.restore();
  drawCompass();
}

function drawGround() {
  context.fillStyle = COLORS.grass;
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  DISTRICT_DISPLAY_ORDER.filter((district) => isVisibleRect(DISTRICT_ZONES[district], 40)).forEach((district) => {
    const zone = DISTRICT_ZONES[district];
    context.fillStyle = zone.color;
    context.fillRect(zone.x, zone.y, zone.w, zone.h);
  });
  const startX = Math.max(0, Math.floor((state.camera.x - 32) / 32) * 32);
  const endX = Math.min(WORLD_WIDTH, state.camera.x + WIDTH + 32);
  const startY = Math.max(0, Math.floor((state.camera.y - 32) / 32) * 32);
  const endY = Math.min(WORLD_HEIGHT, state.camera.y + HEIGHT + 32);
  for (let y = startY; y < endY; y += 32) {
    for (let x = startX; x < endX; x += 32) {
      if ((x / 32 + y / 32) % 2 === 0) {
        context.fillStyle = COLORS.grassAlt;
        context.fillRect(x + 4, y + 4, 4, 4);
        context.fillRect(x + 20, y + 21, 3, 3);
      }
    }
  }
}

function drawWaterEdges(now) {
  context.fillStyle = COLORS.water;
  context.fillRect(0, 0, 12, WORLD_HEIGHT);
  context.fillRect(WORLD_WIDTH - 12, 0, 12, WORLD_HEIGHT);
  context.fillRect(0, 0, WORLD_WIDTH, 12);
  context.fillRect(0, WORLD_HEIGHT - 12, WORLD_WIDTH, 12);
  context.fillStyle = COLORS.waterLight;
  const offset = reducedMotion ? 0 : Math.floor(now / 260) % 12;
  for (let y = -12 + offset; y < WORLD_HEIGHT; y += 24) {
    context.fillRect(2, y, 6, 3);
    context.fillRect(WORLD_WIDTH - 8, y + 8, 6, 3);
  }
}

function drawRoads() {
  for (let column = 1; column < DISTRICT_GRID_COLUMNS; column += 1) {
    const x = DISTRICT_ZONE_ORIGIN_X + column * (DISTRICT_ZONE_WIDTH + DISTRICT_ZONE_GAP_X) - DISTRICT_ZONE_GAP_X / 2;
    context.fillStyle = COLORS.roadEdge;
    context.fillRect(x - 15, 0, 30, WORLD_HEIGHT);
    context.fillStyle = COLORS.road;
    context.fillRect(x - 10, 0, 20, WORLD_HEIGHT);
    context.fillStyle = COLORS.roadLine;
    for (let y = 18; y < WORLD_HEIGHT; y += 48) context.fillRect(x - 2, y, 4, 24);
  }
  for (let row = 1; row < DISTRICT_GRID_ROWS; row += 1) {
    const y = DISTRICT_ZONE_ORIGIN_Y + row * (DISTRICT_ZONE_HEIGHT + DISTRICT_ZONE_GAP_Y) - DISTRICT_ZONE_GAP_Y / 2;
    context.fillStyle = COLORS.roadEdge;
    context.fillRect(0, y - 15, WORLD_WIDTH, 30);
    context.fillStyle = COLORS.road;
    context.fillRect(0, y - 10, WORLD_WIDTH, 20);
    context.fillStyle = COLORS.roadLine;
    for (let x = 18; x < WORLD_WIDTH; x += 48) context.fillRect(x, y - 2, 24, 4);
  }
}

function drawTownSquare() {
  const x = DISTRICT_ZONE_ORIGIN_X + 1 * (DISTRICT_ZONE_WIDTH + DISTRICT_ZONE_GAP_X) + DISTRICT_ZONE_WIDTH / 2;
  const y = DISTRICT_ZONE_ORIGIN_Y + 4 * (DISTRICT_ZONE_HEIGHT + DISTRICT_ZONE_GAP_Y) + DISTRICT_ZONE_HEIGHT / 2;
  if (!isVisibleRect({ x: x - 120, y: y - 70, w: 240, h: 140 }, 30)) return;
  context.fillStyle = "#e5d7af";
  context.fillRect(x - 68, y - 50, 136, 100);
  context.fillStyle = "#c8b989";
  context.fillRect(x - 60, y - 42, 120, 84);
  context.fillStyle = COLORS.water;
  context.fillRect(x - 18, y - 21, 36, 36);
  context.fillStyle = COLORS.waterLight;
  context.fillRect(x - 12, y - 15, 24, 24);
  context.fillStyle = COLORS.paper;
  context.fillRect(x - 4, y - 34, 8, 20);
  drawMarketStall(x - 108, y - 34, "#d65d42");
  drawMarketStall(x + 72, y + 16, "#e9bd52");
}

function drawCompass() {
  const centerX = WIDTH - 52;
  const centerY = 54;
  context.fillStyle = "rgba(255, 248, 231, 0.94)";
  context.fillRect(centerX - 34, centerY - 38, 68, 76);
  context.strokeStyle = COLORS.ink;
  context.lineWidth = 2;
  context.strokeRect(centerX - 34, centerY - 38, 68, 76);
  context.fillStyle = COLORS.roof;
  context.beginPath();
  context.moveTo(centerX, centerY - 26);
  context.lineTo(centerX - 7, centerY - 10);
  context.lineTo(centerX + 7, centerY - 10);
  context.closePath();
  context.fill();
  context.fillStyle = COLORS.ink;
  context.font = "bold 14px ui-monospace, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("北", centerX, centerY + 2);
  context.font = "11px ui-monospace, monospace";
  context.fillText("西", centerX - 20, centerY + 22);
  context.fillText("南", centerX, centerY + 22);
  context.fillText("東", centerX + 20, centerY + 22);
}

function drawDistrictLabels() {
  DISTRICT_DISPLAY_ORDER.filter((district) => isVisibleRect(DISTRICT_ZONES[district], 30)).forEach((district) => {
    const zone = DISTRICT_ZONES[district];
    const theme = state.districtThemes.get(district);
    context.fillStyle = "rgba(255, 248, 231, 0.94)";
    context.fillRect(zone.x + 14, zone.y + 12, 286, 50);
    context.fillStyle = theme?.group === "海線" ? "#28737a" : theme?.group === "山線" ? "#3e7147" : theme?.group === "屯區" ? "#766028" : "#b15135";
    context.fillRect(zone.x + 14, zone.y + 12, 6, 50);
    context.fillStyle = COLORS.ink;
    context.font = "bold 15px ui-monospace, monospace";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(`${theme?.group || "臺中"}・${district}`, zone.x + 28, zone.y + 28);
    context.fillStyle = "#46606b";
    context.font = "11px ui-monospace, monospace";
    context.fillText(String(theme?.tagline || "").slice(0, 18), zone.x + 28, zone.y + 47);
  });
}

function drawDistrictFeatures(now) {
  DISTRICT_DISPLAY_ORDER.filter((district) => isVisibleRect(DISTRICT_ZONES[district], 30)).forEach((district) => {
    const zone = DISTRICT_ZONES[district];
    const theme = state.districtThemes.get(district);
    if (!theme) return;
    drawDistrictFeature(theme, zone.x + zone.w - 66, zone.y + 36, now);
  });
}

function drawDistrictFeature(theme, x, y, now) {
  const feature = theme.feature;
  context.save();
  context.translate(Math.round(x), Math.round(y));
  context.fillStyle = "rgba(20, 45, 55, 0.18)";
  context.fillRect(-30, 19, 60, 6);

  if (["coast", "harbor", "church-harbor", "wetland"].includes(feature)) {
    context.fillStyle = COLORS.water;
    context.fillRect(-30, 5, 60, 16);
    context.fillStyle = COLORS.waterLight;
    context.fillRect(-26, 9, 18, 3);
    context.fillRect(3, 15, 20, 3);
  }

  if (feature === "coast") {
    context.fillStyle = COLORS.paper;
    context.fillRect(-4, -14, 3, 22);
    context.fillStyle = "#d8663b";
    context.beginPath();
    context.moveTo(0, -13);
    context.lineTo(18, -2);
    context.lineTo(0, -2);
    context.fill();
    context.fillStyle = "#ead9aa";
    context.fillRect(-28, 18, 56, 5);
  } else if (["temple-taro", "temple-rail"].includes(feature)) {
    drawPixelTemple(0, -1);
    if (feature === "temple-taro") {
      context.fillStyle = "#7c5a93";
      context.fillRect(18, 8, 9, 9);
      context.fillStyle = "#648b58";
      context.fillRect(20, 3, 5, 5);
    } else {
      context.fillStyle = "#4c5358";
      context.fillRect(-28, 17, 56, 4);
      for (let rail = -24; rail < 28; rail += 10) context.fillRect(rail, 13, 3, 12);
    }
  } else if (feature === "rice" || feature === "wheat") {
    context.strokeStyle = feature === "rice" ? "#e5c75f" : "#d6a848";
    context.lineWidth = 3;
    for (let stalk = -24; stalk <= 24; stalk += 8) {
      context.beginPath();
      context.moveTo(stalk, 20);
      context.lineTo(stalk + (stalk % 3), -12 + Math.abs(stalk % 5));
      context.stroke();
      context.fillStyle = feature === "rice" ? "#f0d36b" : "#e6b94f";
      context.fillRect(stalk + 1, -10, 5, 7);
    }
  } else if (feature === "cinema") {
    context.fillStyle = "#3f5967";
    context.fillRect(-27, -16, 54, 38);
    context.fillStyle = "#fff1c6";
    context.fillRect(-20, -9, 40, 20);
    context.fillStyle = "#d8663b";
    context.beginPath();
    context.moveTo(-4, -5);
    context.lineTo(10, 1);
    context.lineTo(-4, 7);
    context.fill();
  } else if (feature === "wetland") {
    context.fillStyle = "#446d4b";
    for (let reed = -24; reed < 26; reed += 10) {
      context.fillRect(reed, -12, 3, 24);
      context.fillRect(reed - 2, -13, 7, 5);
    }
    context.fillStyle = COLORS.paper;
    context.fillRect(7, -15, 15, 4);
    context.fillRect(18, -11, 4, 5);
  } else if (feature === "harbor") {
    context.fillStyle = "#d8663b";
    context.fillRect(-20, -3, 40, 9);
    context.fillStyle = COLORS.paper;
    context.fillRect(-12, -11, 22, 9);
    context.fillStyle = COLORS.ink;
    context.fillRect(-4, -18, 3, 8);
  } else if (feature === "church-harbor") {
    context.fillStyle = COLORS.paper;
    context.fillRect(-18, -18, 36, 28);
    context.fillStyle = "#4d89a0";
    context.fillRect(-22, -18, 44, 5);
    context.fillStyle = COLORS.ink;
    context.fillRect(-2, -28, 4, 15);
    context.fillRect(-8, -24, 16, 4);
  } else if (feature === "station-watermelon") {
    context.fillStyle = COLORS.wall;
    context.fillRect(-27, -13, 34, 30);
    context.fillStyle = COLORS.roof;
    context.fillRect(-30, -18, 40, 7);
    context.fillStyle = COLORS.window;
    context.fillRect(-20, -5, 18, 8);
    context.fillStyle = "#3e7553";
    context.fillRect(13, 0, 17, 17);
    context.fillStyle = "#d65d42";
    context.fillRect(17, 4, 9, 9);
  } else if (feature === "old-town" || feature === "old-street") {
    for (let house = 0; house < 3; house += 1) {
      const hx = -28 + house * 20;
      context.fillStyle = house % 2 ? COLORS.wallBlue : COLORS.wall;
      context.fillRect(hx, -8 + house * 2, 17, 28 - house * 2);
      context.fillStyle = house % 2 ? "#d8663b" : "#8e5442";
      context.fillRect(hx - 2, -13 + house * 2, 21, 6);
      context.fillStyle = COLORS.window;
      context.fillRect(hx + 5, 1, 7, 7);
    }
    if (feature === "old-town") {
      context.fillStyle = COLORS.water;
      context.fillRect(-29, 18, 58, 5);
    }
  } else if (feature === "golden-garden") {
    context.fillStyle = COLORS.trunk;
    context.fillRect(-3, -1, 6, 23);
    context.fillStyle = "#e9bb42";
    context.fillRect(-24, -14, 48, 18);
    context.fillStyle = "#f2d86c";
    context.fillRect(-14, -23, 28, 14);
    context.fillRect(-27, 5, 6, 6);
    context.fillRect(18, 8, 5, 5);
  } else if (feature === "art") {
    context.fillStyle = COLORS.paper;
    context.fillRect(-27, -18, 36, 38);
    context.fillStyle = "#497e9a";
    context.fillRect(-20, -11, 22, 24);
    context.fillStyle = "#e6b94f";
    context.fillRect(-14, -5, 10, 10);
    context.fillStyle = "#d8663b";
    context.fillRect(15, -10, 8, 30);
    context.fillRect(9, 13, 20, 7);
  } else if (feature === "market") {
    drawMarketStall(-22, -12, "#d8663b");
    context.fillStyle = "#6fa66d";
    context.fillRect(-13, 7, 7, 7);
    context.fillStyle = "#efc454";
    context.fillRect(1, 7, 7, 7);
  } else if (feature === "opera") {
    context.strokeStyle = COLORS.paper;
    context.lineWidth = 7;
    for (let curve = -18; curve <= 18; curve += 18) {
      context.beginPath();
      context.arc(curve, 4, 17, Math.PI, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = "#9aa7a1";
    context.fillRect(-30, 17, 60, 6);
  } else if (feature === "hills") {
    context.fillStyle = "#3e7553";
    context.beginPath();
    context.moveTo(-30, 20);
    context.lineTo(-10, -18);
    context.lineTo(5, 20);
    context.fill();
    context.fillStyle = "#5d9664";
    context.beginPath();
    context.moveTo(-4, 20);
    context.lineTo(15, -10);
    context.lineTo(31, 20);
    context.fill();
  } else if (feature === "music-flower") {
    context.fillStyle = COLORS.ink;
    context.fillRect(-10, -20, 4, 27);
    context.fillRect(-6, -20, 17, 4);
    context.fillRect(7, -20, 4, 22);
    context.fillRect(-16, 4, 10, 8);
    context.fillRect(1, -1, 10, 8);
    drawTinyFlower(18, 11, "#d8667e");
    drawTinyFlower(-22, 15, "#f0c35a");
  } else if (["heritage-bike", "canal-bike", "bike", "dam-bike"].includes(feature)) {
    if (feature === "heritage-bike") {
      context.fillStyle = COLORS.wall;
      context.fillRect(-29, -17, 22, 27);
      context.fillStyle = COLORS.roof;
      context.fillRect(-31, -21, 26, 6);
    } else if (feature === "canal-bike") {
      context.fillStyle = COLORS.water;
      context.fillRect(-30, -18, 60, 11);
    } else if (feature === "dam-bike") {
      context.fillStyle = "#b7b7a5";
      context.fillRect(-30, -20, 60, 12);
      context.fillStyle = COLORS.water;
      context.fillRect(-30, -7, 60, 7);
    }
    drawTinyBike(feature === "heritage-bike" ? 10 : 0, 8);
  } else if (feature === "orchard" || feature === "loquat") {
    for (let tree = -20; tree <= 20; tree += 20) {
      context.fillStyle = COLORS.trunk;
      context.fillRect(tree - 2, 7, 5, 15);
      context.fillStyle = COLORS.tree;
      context.fillRect(tree - 11, -12, 22, 22);
      context.fillStyle = feature === "loquat" ? "#efa83b" : "#d96a45";
      context.fillRect(tree - 6, -5, 5, 5);
      context.fillRect(tree + 3, 1, 5, 5);
    }
  } else if (feature === "flower-mushroom") {
    drawTinyFlower(-20, 6, "#d8667e");
    drawTinyFlower(0, -4, "#f0c35a");
    drawTinyFlower(20, 8, "#8c6689");
    context.fillStyle = "#d8663b";
    context.fillRect(-10, 12, 20, 7);
    context.fillStyle = COLORS.paper;
    context.fillRect(-4, 18, 8, 7);
  } else if (feature === "atayal-spring") {
    context.fillStyle = "#b1523e";
    context.fillRect(-30, 5, 60, 17);
    context.fillStyle = COLORS.paper;
    for (let mark = -26; mark < 28; mark += 12) {
      context.fillRect(mark, 9, 6, 4);
      context.fillRect(mark + 5, 14, 6, 4);
    }
    context.fillStyle = COLORS.waterLight;
    context.fillRect(-19, -2, 38, 8);
    context.fillStyle = "rgba(255, 248, 231, 0.85)";
    const steam = reducedMotion ? 0 : Math.floor(now / 360) % 3;
    context.fillRect(-11, -18 - steam, 4, 12);
    context.fillRect(7, -15 - steam, 4, 10);
  } else if (feature === "transport") {
    context.fillStyle = "#4b6b7a";
    context.fillRect(-28, -12, 56, 30);
    context.fillStyle = COLORS.paper;
    context.fillRect(-20, -6, 40, 9);
    context.fillStyle = "#d8663b";
    context.fillRect(-28, 10, 56, 6);
    context.fillStyle = COLORS.ink;
    context.fillRect(-20, 18, 8, 5);
    context.fillRect(12, 18, 8, 5);
  } else if (feature === "history") {
    context.fillStyle = "#a45b42";
    context.fillRect(-28, -16, 56, 8);
    context.fillStyle = COLORS.wall;
    context.fillRect(-24, -8, 48, 30);
    context.fillStyle = "#7a513b";
    context.fillRect(-8, 0, 16, 22);
    context.fillStyle = COLORS.window;
    context.fillRect(-19, -2, 8, 8);
    context.fillRect(11, -2, 8, 8);
  } else if (feature === "mansion-fog") {
    context.fillStyle = COLORS.wall;
    context.fillRect(-28, -10, 56, 31);
    context.fillStyle = COLORS.roofDark;
    context.fillRect(-31, -17, 62, 8);
    context.fillStyle = COLORS.roof;
    context.fillRect(-24, -22, 48, 6);
    context.fillStyle = "rgba(255, 248, 231, 0.76)";
    context.fillRect(-34, 5, 24, 7);
    context.fillRect(12, -2, 22, 7);
  }
  context.restore();
}

function drawPixelTemple(x, y) {
  context.fillStyle = COLORS.wall;
  context.fillRect(x - 20, y - 7, 40, 27);
  context.fillStyle = COLORS.roofDark;
  context.fillRect(x - 27, y - 15, 54, 7);
  context.fillStyle = COLORS.roof;
  context.fillRect(x - 20, y - 20, 40, 7);
  context.fillStyle = "#7a513b";
  context.fillRect(x - 5, y + 2, 10, 18);
}

function drawTinyBike(x, y) {
  context.strokeStyle = COLORS.ink;
  context.lineWidth = 3;
  context.beginPath();
  context.arc(x - 14, y + 7, 8, 0, Math.PI * 2);
  context.arc(x + 14, y + 7, 8, 0, Math.PI * 2);
  context.moveTo(x - 14, y + 7);
  context.lineTo(x - 3, y - 6);
  context.lineTo(x + 5, y + 7);
  context.lineTo(x - 14, y + 7);
  context.moveTo(x - 3, y - 6);
  context.lineTo(x + 14, y + 7);
  context.stroke();
}

function drawTinyFlower(x, y, color) {
  context.fillStyle = "#3e7553";
  context.fillRect(x - 1, y, 3, 16);
  context.fillStyle = color;
  context.fillRect(x - 7, y - 6, 14, 11);
  context.fillStyle = COLORS.yellow;
  context.fillRect(x - 2, y - 2, 5, 5);
}

function drawMarketStall(x, y, color) {
  context.fillStyle = "#6d4b38";
  context.fillRect(x, y + 12, 42, 24);
  context.fillStyle = color;
  context.fillRect(x - 4, y + 4, 50, 12);
  context.fillStyle = COLORS.paper;
  for (let stripe = 0; stripe < 4; stripe += 1) context.fillRect(x + stripe * 12, y + 4, 6, 12);
}

function drawCampus(school, now) {
  const layout = school.layout;
  if (layout.compact) {
    drawCompactCampus(school, now);
    return;
  }
  context.fillStyle = layout.color;
  context.fillRect(layout.x, layout.y, layout.w, layout.h);
  drawCampusBoundary(layout);
  const building = schoolBuildingRect(school);
  drawSchoolBuilding(building, school.index, layout.gate);
  drawCampusPath(layout, building);
  drawFacility(layout, school.index, now);
  drawSchoolSign(school);
}

function drawCompactCampus(school, now) {
  const { layout } = school;
  const building = schoolBuildingRect(school);
  context.fillStyle = layout.color;
  context.fillRect(layout.x, layout.y, layout.w, layout.h);
  context.strokeStyle = layout.theme === "hedge" ? COLORS.tree : layout.theme === "brick" ? "#a45842" : COLORS.fence;
  context.lineWidth = 3;
  context.strokeRect(layout.x + 1.5, layout.y + 1.5, layout.w - 3, layout.h - 3);

  if (layout.w >= 70 && layout.h >= 54) {
    const facilityX = layout.x + layout.w - 17;
    const facilityY = layout.gate === "south" ? layout.y + layout.h - 21 : layout.y + 16;
    if (layout.facility === "track") {
      context.strokeStyle = COLORS.track;
      context.lineWidth = 5;
      context.beginPath();
      context.ellipse(facilityX, facilityY, 10, 14, 0, 0, Math.PI * 2);
      context.stroke();
    } else if (layout.facility === "garden") {
      context.fillStyle = "#805b3d";
      context.fillRect(facilityX - 9, facilityY - 8, 18, 16);
      context.fillStyle = COLORS.treeLight;
      context.fillRect(facilityX - 6, facilityY - 11, 4, 6);
      context.fillRect(facilityX + 3, facilityY - 11, 4, 6);
    } else if (layout.facility === "playground") {
      context.fillStyle = COLORS.yellow;
      context.fillRect(facilityX - 9, facilityY - 8, 18, 5);
      context.fillStyle = COLORS.window;
      context.fillRect(facilityX + 3, facilityY - 3, 5, 12);
    } else {
      context.fillStyle = layout.facility === "court" ? "#5f9380" : "#d6c999";
      context.fillRect(facilityX - 10, facilityY - 10, 20, 20);
      context.strokeStyle = COLORS.paper;
      context.lineWidth = 1;
      context.strokeRect(facilityX - 7.5, facilityY - 7.5, 15, 15);
    }
  }

  context.fillStyle = school.index % 2 ? COLORS.wallBlue : COLORS.wall;
  context.fillRect(building.x, building.y, building.w, building.h);
  context.fillStyle = school.index % 3 === 0 ? "#416b82" : COLORS.roof;
  if (school.index % 3 === 1) {
    context.beginPath();
    context.moveTo(building.x - 3, building.y);
    context.lineTo(building.x + building.w / 2, building.y - 9);
    context.lineTo(building.x + building.w + 3, building.y);
    context.fill();
  } else {
    context.fillRect(building.x - 3, building.y - 6, building.w + 6, 8);
  }
  context.fillStyle = COLORS.window;
  const windows = Math.max(1, Math.floor((building.w - 10) / 12));
  for (let windowIndex = 0; windowIndex < windows; windowIndex += 1) {
    context.fillRect(building.x + 6 + windowIndex * 12, building.y + 6, 7, 6);
  }
  context.fillStyle = "#76513a";
  context.fillRect(building.x + building.w / 2 - 3, building.y + building.h - 9, 6, 9);

  const gateX = layout.x + layout.w / 2;
  const gateY = layout.gate === "south" ? layout.y + layout.h : layout.y;
  context.strokeStyle = "#eee4c8";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(gateX, gateY);
  context.lineTo(gateX, layout.gate === "south" ? building.y + building.h : building.y);
  context.stroke();

  context.fillStyle = COLORS.ink;
  context.fillRect(layout.x + 4, layout.y + layout.h - 16, 20, 12);
  context.fillStyle = COLORS.paper;
  context.font = "bold 9px ui-monospace, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(school.districtNumber).padStart(2, "0"), layout.x + 14, layout.y + layout.h - 10);

  if (!reducedMotion && now && school.index % 13 === 0) {
    context.fillStyle = COLORS.yellow;
    context.fillRect(layout.x + layout.w - 8, layout.y + 6 + Math.floor(now / 500) % 2, 4, 4);
  }
}

function drawCampusBoundary(layout) {
  const gapStart = layout.x + layout.w / 2 - 22;
  const gapEnd = gapStart + 44;
  if (layout.theme === "open") {
    drawLamp(layout.x + 16, layout.y + 16);
    drawLamp(layout.x + layout.w - 16, layout.y + 16);
    drawLamp(layout.x + 16, layout.y + layout.h - 16);
    drawLamp(layout.x + layout.w - 16, layout.y + layout.h - 16);
    return;
  }
  if (layout.theme === "hedge") {
    context.fillStyle = COLORS.tree;
    for (let x = layout.x; x < layout.x + layout.w; x += 14) {
      const inGate = x >= gapStart && x <= gapEnd;
      if (!(layout.gate === "north" && inGate)) context.fillRect(x, layout.y, 10, 8);
      if (!(layout.gate === "south" && inGate)) context.fillRect(x, layout.y + layout.h - 8, 10, 8);
    }
    for (let y = layout.y; y < layout.y + layout.h; y += 14) {
      context.fillRect(layout.x, y, 8, 10);
      context.fillRect(layout.x + layout.w - 8, y, 8, 10);
    }
    return;
  }
  const boundaryColor = layout.theme === "brick" || layout.theme === "mixed" ? "#a45842" : COLORS.fence;
  context.fillStyle = boundaryColor;
  const edgeY = layout.gate === "south" ? layout.y + layout.h - 5 : layout.y;
  context.fillRect(layout.x, layout.y, layout.w, 5);
  context.fillRect(layout.x, layout.y + layout.h - 5, layout.w, 5);
  context.fillStyle = layout.color;
  context.fillRect(gapStart, edgeY - 1, 44, 7);
  context.fillRect(layout.x, layout.y, 5, layout.h);
  context.fillRect(layout.x + layout.w - 5, layout.y, 5, layout.h);
  if (["lamps", "open"].includes(layout.theme)) {
    drawLamp(layout.x + 14, layout.y + 14);
    drawLamp(layout.x + layout.w - 14, layout.y + layout.h - 14);
  }
  if (layout.theme === "mixed") {
    context.fillStyle = COLORS.fence;
    for (let y = layout.y + 16; y < layout.y + layout.h - 16; y += 18) context.fillRect(layout.x + layout.w - 7, y, 9, 4);
  }
}

function drawSchoolBuilding(rect, index, gate) {
  const roofY = gate === "south" ? rect.y - 10 : rect.y + rect.h - 2;
  context.fillStyle = index % 2 ? COLORS.wallBlue : COLORS.wall;
  context.fillRect(rect.x, rect.y, rect.w, rect.h);
  context.fillStyle = COLORS.roofDark;
  context.fillRect(rect.x - 5, roofY, rect.w + 10, 14);
  context.fillStyle = COLORS.roof;
  context.fillRect(rect.x, roofY - 6, rect.w, 10);
  context.fillStyle = COLORS.window;
  const windowY = rect.y + 18;
  for (let x = rect.x + 12; x < rect.x + rect.w - 10; x += 28) context.fillRect(x, windowY, 16, 12);
  context.fillStyle = "#76513a";
  const doorX = rect.x + rect.w / 2 - 9;
  const doorY = gate === "south" ? rect.y + rect.h - 22 : rect.y;
  context.fillRect(doorX, doorY, 18, 22);
  if (index === 1 || index === 4) {
    context.fillStyle = COLORS.paper;
    context.fillRect(rect.x + rect.w / 2 - 18, rect.y + 8, 36, 20);
    context.fillStyle = COLORS.ink;
    context.fillRect(rect.x + rect.w / 2 - 2, rect.y + 11, 4, 7);
    context.fillRect(rect.x + rect.w / 2, rect.y + 17, 7, 3);
  }
}

function drawCampusPath(layout, building) {
  const gateX = layout.x + layout.w / 2;
  const gateY = layout.gate === "south" ? layout.y + layout.h : layout.y;
  const doorX = building.x + building.w / 2;
  const doorY = layout.gate === "south" ? building.y + building.h : building.y;
  context.strokeStyle = "#eee4c8";
  context.lineWidth = 14;
  context.beginPath();
  context.moveTo(gateX, gateY);
  context.lineTo(gateX, (gateY + doorY) / 2);
  context.lineTo(doorX, doorY);
  context.stroke();
}

function drawFacility(layout, index, now) {
  if (layout.facility === "track") {
    const cx = layout.x + layout.w - 62;
    const cy = layout.y + layout.h / 2;
    context.strokeStyle = COLORS.track;
    context.lineWidth = 18;
    context.beginPath();
    context.ellipse(cx, cy, 36, 50, 0, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = COLORS.trackLine;
    context.lineWidth = 2;
    for (const inset of [0, 7, 14]) {
      context.beginPath();
      context.ellipse(cx, cy, 24 + inset, 38 + inset, 0, 0, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = "#70a56c";
    context.fillRect(cx - 14, cy - 32, 28, 64);
    return;
  }
  if (layout.facility === "playground") {
    const baseX = layout.x + layout.w - 62;
    const baseY = layout.y + layout.h / 2;
    context.fillStyle = "#dfb85e";
    context.fillRect(baseX - 28, baseY - 28, 56, 56);
    context.fillStyle = "#487b9a";
    context.fillRect(baseX - 20, baseY - 20, 16, 24);
    context.fillStyle = "#d45f3f";
    context.fillRect(baseX - 15, baseY - 25, 6, 40);
    context.fillStyle = COLORS.yellow;
    context.fillRect(baseX - 4, baseY + 2, 28, 7);
    return;
  }
  if (layout.facility === "court") {
    context.fillStyle = "#5f9380";
    context.fillRect(layout.x + layout.w - 112, layout.y + 36, 88, 74);
    context.strokeStyle = COLORS.paper;
    context.lineWidth = 3;
    context.strokeRect(layout.x + layout.w - 104, layout.y + 44, 72, 58);
    context.beginPath();
    context.moveTo(layout.x + layout.w - 68, layout.y + 44);
    context.lineTo(layout.x + layout.w - 68, layout.y + 102);
    context.stroke();
    return;
  }
  if (layout.facility === "library") {
    const baseX = layout.x + layout.w - 108;
    const baseY = layout.y + 38;
    context.fillStyle = "#dfd1ac";
    context.fillRect(baseX, baseY, 78, 68);
    context.fillStyle = "#416b82";
    context.fillRect(baseX + 12, baseY + 12, 54, 10);
    context.fillStyle = "#9b6848";
    context.fillRect(baseX + 16, baseY + 38, 46, 8);
    context.fillRect(baseX + 35, baseY + 28, 8, 34);
    context.fillStyle = COLORS.paper;
    for (let book = 0; book < 5; book += 1) context.fillRect(baseX + 16 + book * 10, baseY + 14, 5, 6);
    return;
  }
  const startX = layout.x + layout.w - 96;
  const startY = layout.y + 38;
  for (let bed = 0; bed < 3; bed += 1) {
    context.fillStyle = "#805b3d";
    context.fillRect(startX, startY + bed * 22, 68, 14);
    context.fillStyle = bed % 2 ? "#7cae58" : "#4f8d54";
    for (let plant = 0; plant < 5; plant += 1) context.fillRect(startX + 5 + plant * 13, startY - 3 + bed * 22, 6, 7);
  }
  if (!reducedMotion && index === 5) {
    context.fillStyle = COLORS.yellow;
    context.fillRect(startX + 72, startY + Math.floor(now / 420) % 3, 6, 6);
  }
}

function drawSchoolSign(school) {
  const { layout } = school;
  const gateX = layout.x + layout.w / 2;
  const gateY = layout.gate === "south" ? layout.y + layout.h - 22 : layout.y + 8;
  context.fillStyle = COLORS.ink;
  context.fillRect(gateX - 44, gateY, 88, 18);
  context.fillStyle = COLORS.paper;
  context.font = "bold 12px ui-monospace, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(school.name).slice(0, 6), gateX, gateY + 9);
}

function drawStreetDetails() {
  DISTRICT_DISPLAY_ORDER.filter((district) => isVisibleRect(DISTRICT_ZONES[district], 40)).forEach((district) => {
    const zone = DISTRICT_ZONES[district];
    drawTree(zone.x + 316, zone.y + 50);
    drawTree(zone.x + zone.w - 24, zone.y + 54);
    drawLamp(zone.x + 22, zone.y + zone.h - 16);
    drawLamp(zone.x + zone.w - 22, zone.y + zone.h - 16);
    context.fillStyle = "#a2714e";
    context.fillRect(zone.x + zone.w - 92, zone.y + 48, 38, 7);
  });
}

function drawTree(x, y) {
  context.fillStyle = COLORS.trunk;
  context.fillRect(x - 4, y, 8, 18);
  context.fillStyle = COLORS.tree;
  context.fillRect(x - 14, y - 18, 28, 22);
  context.fillStyle = COLORS.treeLight;
  context.fillRect(x - 8, y - 26, 18, 18);
}

function drawLamp(x, y) {
  context.fillStyle = COLORS.ink;
  context.fillRect(x - 2, y - 14, 4, 18);
  context.fillStyle = COLORS.yellow;
  context.fillRect(x - 5, y - 20, 10, 8);
}

function drawPerson(person) {
  const { x, y, direction, step, player = false } = person;
  const frame = person.isMoving && !reducedMotion ? Math.floor(step) % 4 : 0;
  const gait = [0, 1, 0, -1][frame];
  const bob = person.isMoving && !reducedMotion && frame % 2 ? 1 : 0;
  const legSwing = gait * 2;
  const armSwing = -legSwing;
  context.save();
  context.translate(Math.round(x), Math.round(y - bob));
  if (direction === "left") context.scale(-1, 1);
  context.fillStyle = "rgba(20, 45, 55, 0.22)";
  context.fillRect(-9, 12, 19, 5);

  drawCharacterBackAccessory(person, direction);

  context.fillStyle = person.outfitDark;
  context.fillRect(-6 + legSwing, 5, 5, 8);
  context.fillRect(2 - legSwing, 5, 5, 8);
  context.fillStyle = "#26333b";
  context.fillRect(-7 + legSwing, 11, 6, 4);
  context.fillRect(2 - legSwing, 11, 6, 4);

  context.fillStyle = person.skin;
  context.fillRect(-11, -5 + armSwing, 4, 10);
  context.fillRect(7, -5 - armSwing, 4, 10);
  context.fillStyle = person.outfit;
  context.fillRect(-11, -6 + armSwing, 4, 5);
  context.fillRect(7, -6 - armSwing, 4, 5);
  context.fillRect(-8, -8, 16, 14);
  context.fillStyle = person.outfitDark;
  context.fillRect(-8, 3, 16, 3);

  context.fillStyle = person.accent;
  if (person.role === "student") {
    context.fillRect(-5, -7, 10, 2);
    context.fillRect(-1, -5, 2, 3);
  } else if (["teacher", "principal", "librarian"].includes(person.role)) {
    context.fillRect(-3, -8, 6, 2);
  }

  context.fillStyle = person.skin;
  context.fillRect(-3, -11, 6, 4);
  context.fillRect(-7, -22, 14, 12);
  if (["left", "right"].includes(direction)) context.fillRect(6, -19, 3, 5);
  drawCharacterHair(person, direction);
  drawCharacterFace(person, direction);
  drawCharacterAccessory(person, direction, armSwing, player);
  context.restore();
}

function drawCharacterBackAccessory(person, direction) {
  if (!['backpack', 'satchel'].includes(person.accessory)) return;
  const visibleFromBack = direction === "up";
  context.fillStyle = person.accent;
  if (visibleFromBack) {
    context.fillRect(-8, -7, 16, 12);
    context.fillStyle = person.outfitDark;
    context.fillRect(-5, 0, 10, 2);
  } else if (["left", "right"].includes(direction)) {
    context.fillRect(-10, -5, 5, 11);
  }
}

function drawCharacterHair(person, direction) {
  context.fillStyle = person.hair;
  if (person.hairStyle === "chef") {
    context.fillStyle = COLORS.paper;
    context.fillRect(-7, -28, 14, 5);
    context.fillRect(-5, -31, 5, 4);
    context.fillRect(1, -30, 5, 3);
    context.fillRect(-7, -24, 14, 3);
    return;
  }
  if (person.hairStyle === "cap") {
    context.fillRect(-7, -24, 14, 4);
    context.fillStyle = person.accent;
    context.fillRect(-8, -27, 16, 5);
    if (direction === "down" || direction === "right" || direction === "left") context.fillRect(5, -23, 6, 2);
    return;
  }
  context.fillRect(-7, -25, 14, 6);
  if (direction === "up") context.fillRect(-7, -21, 14, 10);
  if (person.hairStyle === "bob") {
    context.fillRect(-8, -22, 3, 11);
    context.fillRect(5, -22, 3, 11);
  } else if (person.hairStyle === "ponytail") {
    context.fillRect(5, -22, 4, 10);
    context.fillRect(7, -15, 5, 6);
  } else if (person.hairStyle === "bun") {
    context.fillRect(-3, -29, 7, 5);
    context.fillRect(-8, -21, 3, 7);
  } else if (person.hairStyle === "spiky") {
    context.fillRect(-9, -24, 3, 4);
    context.fillRect(-3, -28, 3, 5);
    context.fillRect(4, -27, 3, 5);
  } else if (person.hairStyle === "side-part") {
    context.fillRect(-8, -23, 5, 7);
    context.fillRect(-3, -23, 7, 3);
  } else if (person.hairStyle === "wavy" || person.hairStyle === "curl") {
    context.fillRect(-9, -22, 4, 6);
    context.fillRect(5, -22, 4, 6);
    if (person.hairStyle === "curl") context.fillRect(-7, -17, 3, 5);
  }
}

function drawCharacterFace(person, direction) {
  if (direction === "up") return;
  context.fillStyle = "#243238";
  if (direction === "down") {
    context.fillRect(-4, -18, 2, 2);
    context.fillRect(3, -18, 2, 2);
    if (person.expression === "happy" || person.expression === "kind") {
      context.fillRect(-2, -14, 2, 1);
      context.fillRect(0, -13, 3, 1);
    } else if (person.expression === "curious") {
      context.fillRect(-4, -19, 2, 1);
      context.fillRect(-1, -14, 3, 1);
    } else {
      context.fillRect(-2, -14, 4, 1);
    }
  } else {
    context.fillRect(3, -18, 2, 2);
    context.fillRect(5, -14, 2, 1);
  }
}

function drawCharacterAccessory(person, direction, armSwing, player) {
  if (person.accessory === "book") {
    context.fillStyle = person.accent;
    context.fillRect(8, -2 - armSwing, 7, 8);
    context.fillStyle = COLORS.paper;
    context.fillRect(9, -1 - armSwing, 5, 2);
  } else if (person.accessory === "clipboard") {
    context.fillStyle = "#8a6747";
    context.fillRect(7, -5 - armSwing, 9, 12);
    context.fillStyle = COLORS.paper;
    context.fillRect(9, -3 - armSwing, 5, 7);
    context.fillStyle = person.accent;
    context.fillRect(10, -1 - armSwing, 3, 1);
  } else if (person.accessory === "apron") {
    context.fillStyle = COLORS.paper;
    context.fillRect(-5, -5, 10, 10);
    context.fillStyle = person.accent;
    context.fillRect(-2, -3, 4, 2);
  } else if (person.accessory === "medical") {
    context.fillStyle = person.accent;
    context.fillRect(-1, -5, 3, 8);
    context.fillRect(-4, -2, 9, 3);
  } else if (person.accessory === "flag") {
    context.fillStyle = "#5a4738";
    context.fillRect(11, -11, 2, 18);
    context.fillStyle = person.accent;
    context.fillRect(13, -11, 9, 6);
    context.fillStyle = COLORS.paper;
    context.fillRect(-7, -3, 14, 3);
  } else if (person.accessory === "watering-can") {
    context.fillStyle = "#4e8791";
    context.fillRect(9, 0, 9, 7);
    context.fillRect(17, 2, 5, 2);
  } else if (person.accessory === "glasses" && direction !== "up") {
    context.strokeStyle = "#28343a";
    context.lineWidth = 1;
    context.strokeRect(-6, -20, 5, 4);
    if (direction === "down") context.strokeRect(2, -20, 5, 4);
  } else if (person.accessory === "tie") {
    context.fillStyle = person.accent;
    context.fillRect(-1, -6, 3, 6);
    context.fillRect(-2, 0, 5, 3);
  } else if (person.accessory === "tote") {
    context.strokeStyle = person.accent;
    context.lineWidth = 2;
    context.strokeRect(8, 0, 8, 8);
  } else if (player && person.accessory === "satchel") {
    context.strokeStyle = person.accent;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-6, -7);
    context.lineTo(6, 4);
    context.stroke();
    context.fillStyle = person.accent;
    context.fillRect(4, 1, 7, 7);
  }
}

function drawPet(pet, now) {
  const wag = reducedMotion ? 0 : Math.floor(now / 260 + pet.phase) % 2 * 3;
  context.fillStyle = "rgba(20, 45, 55, 0.18)";
  context.fillRect(pet.x - 8, pet.y + 5, 17, 4);
  context.fillStyle = pet.color;
  context.fillRect(pet.x - 7, pet.y - 4, 14, 9);
  context.fillRect(pet.x + 5, pet.y - 9, 8, 8);
  context.fillRect(pet.x - 11 - wag, pet.y - 6, 5, 3);
  if (pet.kind === "cat") {
    context.fillRect(pet.x + 5, pet.y - 12, 3, 4);
    context.fillRect(pet.x + 10, pet.y - 12, 3, 4);
  } else {
    context.fillStyle = "#4a3831";
    context.fillRect(pet.x + 5, pet.y - 10, 3, 6);
  }
  context.fillStyle = COLORS.ink;
  context.fillRect(pet.x + 10, pet.y - 6, 2, 2);
}

function updateNearbyPrompt() {
  if (state.dialogueNpc) return;
  const npc = nearbyNpc();
  const school = nearbySchool();
  const target = npc ? `npc:${npc.name}` : school ? `school:${school.fatraceSchoolId}` : "";
  if (target === state.lastPromptTarget) return;
  state.lastPromptTarget = target;
  refs.prompt.hidden = !target;
  refs.prompt.textContent = npc
    ? `按 Enter 與 ${npc.name}（${ROLE_LABELS[npc.role]}）對話`
    : school
      ? `按 Enter 查看 ${school.name} ${formatDate(state.date)} 午餐`
      : "";
}

function nearbyNpc() {
  return state.npcs
    .map((npc) => ({ npc, distance: Math.hypot(state.player.x - npc.x, state.player.y - npc.y) }))
    .filter((item) => item.distance < 42)
    .sort((first, second) => first.distance - second.distance)[0]?.npc || null;
}

function nearbySchool() {
  return state.schools.find((school) => {
    const point = schoolGatePoint(school);
    return Math.hypot(state.player.x - point.x, state.player.y - point.y) < 58;
  }) || null;
}

function interactWithNearbyTarget() {
  const npc = nearbyNpc();
  if (npc) {
    openNpcDialogue(npc);
    return;
  }
  const school = nearbySchool();
  if (school) openSchool(school);
  else announce("請先走近人物或學校校門，也可以直接點選畫面中的人物或學校。");
}

function openNpcDialogue(npc) {
  state.keys.clear();
  state.moveTarget = null;
  state.dialogueNpc = npc;
  state.dialogueStep = 0;
  refs.prompt.hidden = true;
  refs.npcDialogue.hidden = false;
  renderNpcDialogue();
  announce(`${npc.name}（${ROLE_LABELS[npc.role]}）開始對話。`);
}

function renderNpcDialogue() {
  const npc = state.dialogueNpc;
  if (!npc) return;
  const index = (npc.dialogueCursor + state.dialogueStep) % npc.dialogues.length;
  refs.npcName.textContent = npc.name;
  refs.npcRole.textContent = `${npc.district}・${ROLE_LABELS[npc.role]}`;
  refs.npcText.textContent = npc.dialogues[index];
  refs.npcNext.textContent = state.dialogueStep >= 1 ? "結束對話" : "再聊一句";
}

function advanceNpcDialogue() {
  const npc = state.dialogueNpc;
  if (!npc) return;
  if (state.dialogueStep >= 1) {
    npc.dialogueCursor = (npc.dialogueCursor + 2) % npc.dialogues.length;
    closeNpcDialogue();
    return;
  }
  state.dialogueStep += 1;
  renderNpcDialogue();
}

function closeNpcDialogue() {
  state.dialogueNpc = null;
  state.dialogueStep = 0;
  refs.npcDialogue.hidden = true;
  state.lastPromptTarget = null;
  updateNearbyPrompt();
  canvas.focus({ preventScroll: true });
}

function drawNearbyNpcMarker() {
  if (state.dialogueNpc) return;
  const npc = nearbyNpc();
  if (!npc) return;
  context.fillStyle = COLORS.paper;
  context.fillRect(Math.round(npc.x) - 7, Math.round(npc.y) - 43, 14, 14);
  context.fillStyle = COLORS.ink;
  context.font = "bold 12px ui-monospace, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("!", Math.round(npc.x), Math.round(npc.y) - 36);
}

async function openSchool(school) {
  if (state.dialogueNpc) closeNpcDialogue();
  const id = String(school.fatraceSchoolId);
  state.visited.add(id);
  renderSchoolList();
  updateProgress();
  refs.dialogKicker.textContent = `${school.city}・${school.district}・${formatDate(state.date)}`;
  refs.dialogTitle.textContent = school.name;
  refs.dialogBody.innerHTML = '<p class="empty-meal">正在讀取學校午餐資料…</p>';
  if (!refs.dialog.open) refs.dialog.showModal();
  announce(`正在查看 ${school.name} 午餐。`);
  try {
    const dashboard = await loadSchoolMeal(school, state.date);
    renderMeal(dashboard, school);
  } catch (error) {
    console.warn(error);
    refs.dialogBody.innerHTML = '<p class="empty-meal">目前無法讀取這間學校的午餐資料，請稍後再試。</p>';
  }
}

async function loadSchoolMeal(school, date) {
  const endpoint = `/api/dashboard?schoolId=${encodeURIComponent(school.fatraceSchoolId)}&date=${encodeURIComponent(date)}&mealType=meat`;
  try {
    const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`午餐 API 回傳 ${response.status}`);
    const payload = await response.json();
    return { record: payload.record ?? payload.officialRecord ?? null, sourceUrl: payload.sourceUrl || payload.record?.source?.url || "" };
  } catch (apiError) {
    const response = await fetch(`/data/school-meals/${encodeURIComponent(school.fatraceSchoolId)}.json`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw apiError;
    const payload = await response.json();
    const record = payload.records?.[date] || null;
    return { record, sourceUrl: record?.source?.url || school.sourceUrl || "" };
  }
}

function renderMeal(dashboard, school) {
  const record = dashboard.record;
  if (!record || record.status !== "available") {
    refs.dialogBody.innerHTML = `
      <p class="empty-meal">${formatDate(state.date)} 尚未取得這間學校的公開午餐資料。這不代表學校沒有供餐，請以校方公告為準。</p>
      ${dashboard.sourceUrl ? `<a class="source-link" href="${escapeAttribute(dashboard.sourceUrl)}" target="_blank" rel="noreferrer">查看官方資料來源</a>` : ""}
    `;
    return;
  }
  const meals = record.meals || [];
  const dishes = meals.flatMap((meal) => meal.dishes || []);
  const nutrition = meals.find((meal) => meal.nutrition)?.nutrition || {};
  refs.dialogBody.innerHTML = `
    <div class="meal-summary">
      <span>共 ${dishes.length} 道菜</span>
      <span>${nutrition.caloriesKcal ? `官方紀錄熱量 ${escapeHtml(nutrition.caloriesKcal)} kcal` : "官方未提供熱量"}</span>
    </div>
    <ul class="dish-list">
      ${dishes.map((dish) => `
        <li><strong>${escapeHtml(dish.name || "未命名菜色")}</strong><small>${escapeHtml(dish.category || "午餐菜色")}</small></li>
      `).join("")}
    </ul>
    <p class="data-note">菜色與營養欄位來自校方公開紀錄；不從菜名推測過敏原或整餐營養安全。</p>
    ${dashboard.sourceUrl ? `<a class="source-link" href="${escapeAttribute(dashboard.sourceUrl)}" target="_blank" rel="noreferrer">查看官方資料來源</a>` : ""}
  `;
  announce(`${school.name} ${formatDate(state.date)} 共公布 ${dishes.length} 道菜。`);
}

function placePlayerAtGate(school) {
  const gate = schoolGatePoint(school);
  state.player.x = gate.x;
  state.player.y = gate.y + (school.layout.gate === "south" ? 34 : -34);
  state.player.direction = school.layout.gate === "south" ? "up" : "down";
}

function schoolGatePoint(school) {
  const { x, y, w, h, gate } = school.layout;
  return { x: x + w / 2, y: gate === "south" ? y + h : y };
}

function updateProgress() {
  refs.progress.textContent = `${state.visited.size} / ${state.schools.length}`;
}

function canvasPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * WIDTH / bounds.width + state.camera.x,
    y: (event.clientY - bounds.top) * HEIGHT / bounds.height + state.camera.y,
  };
}

function directionForKey(key) {
  const normalized = String(key).toLowerCase();
  if (["arrowup", "w"].includes(normalized)) return "up";
  if (["arrowdown", "s"].includes(normalized)) return "down";
  if (["arrowleft", "a"].includes(normalized)) return "left";
  if (["arrowright", "d"].includes(normalized)) return "right";
  return null;
}

function pointInRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function rectanglesOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function isVisibleRect(rect, padding = 0) {
  return rect.x + rect.w >= state.camera.x - padding
    && rect.x <= state.camera.x + WIDTH + padding
    && rect.y + rect.h >= state.camera.y - padding
    && rect.y <= state.camera.y + HEIGHT + padding;
}

function formatDate(date) {
  const [year, month, day] = String(date).split("-");
  return `${year} 年 ${Number(month)} 月 ${Number(day)} 日`;
}

function announce(message) {
  refs.announcement.textContent = "";
  requestAnimationFrame(() => {
    refs.announcement.textContent = message;
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
