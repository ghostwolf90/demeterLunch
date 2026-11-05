const DESKTOP_VIEWPORT = { width: 960, height: 640 };
const MOBILE_VIEWPORT = { width: 480, height: 600 };
const mobileLayoutQuery = window.matchMedia("(max-width: 680px)");
let WIDTH = mobileLayoutQuery.matches ? MOBILE_VIEWPORT.width : DESKTOP_VIEWPORT.width;
let HEIGHT = mobileLayoutQuery.matches ? MOBILE_VIEWPORT.height : DESKTOP_VIEWPORT.height;
const SHOWCASE_CITY = "臺中市";
const DISTRICT_GROUP_ORDER = ["海線", "城區", "山線", "屯區"];
const DISTRICT_DISPLAY_ORDER = [];
const DISTRICT_ZONES = {};
const DISTRICT_ZONE_WIDTH = 560;
const DISTRICT_ZONE_HEIGHT = 360;
const DISTRICT_ZONE_GAP_X = 34;
const DISTRICT_ZONE_GAP_Y = 34;
const WEST_COAST_WIDTH = 320;
const WEST_COAST_LAND_GAP = 40;
const EAST_MOUNTAIN_WIDTH = 500;
const COASTAL_TETRAPOD_COUNT = 48;
const DISTRICT_ZONE_ORIGIN_X = WEST_COAST_WIDTH + WEST_COAST_LAND_GAP;
const NORTH_COUNTY_HEIGHT = 1440;
const SOUTH_COUNTY_HEIGHT = 1680;
const NEIGHBOR_COUNTY_DISTRICT_COLUMNS = 6;
const NEIGHBOR_COUNTY_MARGIN_X = 54;
const NEIGHBOR_COUNTY_HEADER_HEIGHT = 74;
const NEIGHBOR_COUNTY_FOOTER_HEIGHT = 42;
const NEIGHBOR_COUNTY_ZONE_GAP = 40;
const BORDER_RIVER_WIDTH = 112;
const BORDER_LAND_BUFFER = 38;
const PLAYER_TERRAIN_PADDING = 10;
const BOUNDARY_BRIDGE_PASSAGE_HALF_WIDTH = 20;
const RIVER_FLOW_LANE_OFFSETS = Object.freeze([-34, -14, 14, 34]);
const RIVER_FLOW_CHEVRON_SPACING = 132;
const MAX_NIGHT_DARKNESS = 0.4;
const DISTRICT_ZONE_ORIGIN_Y = NORTH_COUNTY_HEIGHT + BORDER_RIVER_WIDTH + BORDER_LAND_BUFFER;
const DISTRICT_GRID_COLUMNS = 8;
const DISTRICT_GRID_ROWS = 6;
const DISTRICT_GRID_WIDTH = DISTRICT_GRID_COLUMNS * DISTRICT_ZONE_WIDTH
  + (DISTRICT_GRID_COLUMNS - 1) * DISTRICT_ZONE_GAP_X;
const DISTRICT_GRID_HEIGHT = DISTRICT_GRID_ROWS * DISTRICT_ZONE_HEIGHT
  + (DISTRICT_GRID_ROWS - 1) * DISTRICT_ZONE_GAP_Y;
const EAST_MOUNTAIN_START_X = DISTRICT_ZONE_ORIGIN_X + DISTRICT_GRID_WIDTH;
const WORLD_WIDTH = EAST_MOUNTAIN_START_X + EAST_MOUNTAIN_WIDTH;
const TAICHUNG_SOUTH_EDGE_Y = DISTRICT_ZONE_ORIGIN_Y + DISTRICT_GRID_HEIGHT;
const NORTH_BORDER_RIVER_Y = NORTH_COUNTY_HEIGHT + BORDER_RIVER_WIDTH / 2;
const SOUTH_BORDER_RIVER_Y = TAICHUNG_SOUTH_EDGE_Y + BORDER_LAND_BUFFER + BORDER_RIVER_WIDTH / 2;
const SOUTH_COUNTY_START_Y = SOUTH_BORDER_RIVER_Y + BORDER_RIVER_WIDTH / 2 + BORDER_LAND_BUFFER;
const WORLD_HEIGHT = SOUTH_COUNTY_START_Y + SOUTH_COUNTY_HEIGHT;
const COASTAL_ROAD_START_X = DISTRICT_ZONE_ORIGIN_X - 22;
const EASTERN_ROAD_END_X = EAST_MOUNTAIN_START_X - 18;
const COASTAL_HARBOR_Y = DISTRICT_ZONE_ORIGIN_Y
  + 2 * (DISTRICT_ZONE_HEIGHT + DISTRICT_ZONE_GAP_Y)
  + 92;
const NORTH_BOUNDARY_BRIDGE_X = DISTRICT_ZONE_ORIGIN_X
  + 3 * (DISTRICT_ZONE_WIDTH + DISTRICT_ZONE_GAP_X)
  - DISTRICT_ZONE_GAP_X / 2;
const SOUTH_BOUNDARY_BRIDGE_X = DISTRICT_ZONE_ORIGIN_X
  + 5 * (DISTRICT_ZONE_WIDTH + DISTRICT_ZONE_GAP_X)
  - DISTRICT_ZONE_GAP_X / 2;
const NEIGHBOR_COUNTIES = Object.freeze([
  {
    id: "miaoli", name: "苗栗縣", side: "north", color: "#82a86f",
    x: COASTAL_ROAD_START_X, y: 24, w: EASTERN_ROAD_END_X - COASTAL_ROAD_START_X,
    h: NORTH_COUNTY_HEIGHT - 48, bridgeX: NORTH_BOUNDARY_BRIDGE_X, riverY: NORTH_BORDER_RIVER_Y,
  },
  {
    id: "changhua", name: "彰化縣", side: "south", color: "#a7aa70",
    x: COASTAL_ROAD_START_X, y: SOUTH_COUNTY_START_Y + 24, w: EASTERN_ROAD_END_X - COASTAL_ROAD_START_X,
    h: SOUTH_COUNTY_HEIGHT - 48, bridgeX: SOUTH_BOUNDARY_BRIDGE_X, riverY: SOUTH_BORDER_RIVER_Y,
  },
]);
const NEIGHBOR_COUNTY_CITIES = new Set(NEIGHBOR_COUNTIES.map((county) => county.name));
const NEIGHBOR_COUNTY_CIVIC_INFO = Object.freeze({
  miaoli: {
    seatDistrict: "苗栗市",
    campusGrid: [2, 3],
    hallName: "苗栗縣政府",
    councilName: "苗栗縣議會",
    magistrateName: "鍾東錦",
    governmentSourceUrl: "https://www.miaoli.gov.tw/",
    magistrateSourceUrl: "https://www.miaoli.gov.tw/cp.aspx?n=265",
  },
  changhua: {
    seatDistrict: "彰化市",
    campusGrid: [4, 0],
    hallName: "彰化縣政府",
    councilName: "彰化縣議會",
    magistrateName: "王惠美",
    governmentSourceUrl: "https://www.chcg.gov.tw/",
    magistrateSourceUrl: "https://www.chcg.gov.tw/ch2/intro-magistrate.aspx",
  },
});
const NEIGHBOR_COUNTY_NPC_TARGETS = Object.freeze({ miaoli: 28, changhua: 34 });
const MIN_ACTIVE_TOWN_NPCS = 6;
const MAX_ACTIVE_TOWN_NPCS = 10;
const BACKGROUND_NPC_UPDATE_SECONDS = 2;
const NEIGHBOR_CIVIC_ROLES = new Set([
  "county-magistrate", "county-civil-servant", "county-supervisor", "county-councilor", "township-officer",
]);
const BOUNDARY_BRIDGES = Object.freeze([
  { id: "miaoli-iron-bridge", countyId: "miaoli", x: NORTH_BOUNDARY_BRIDGE_X, riverY: NORTH_BORDER_RIVER_Y, material: "iron" },
  { id: "changhua-concrete-bridge", countyId: "changhua", x: SOUTH_BOUNDARY_BRIDGE_X, riverY: SOUTH_BORDER_RIVER_Y, material: "concrete" },
]);
const RIVERBANK_PATH_OFFSET = BORDER_RIVER_WIDTH / 2 + 34;
const RIVERBANK_LEISURE_ROLES = new Set([
  "parent", "community-resident", "office-worker", "senior", "teacher", "cook",
  "nurse", "high-school-student", "university-student", "college-volunteer",
]);
let riverbankLeisureSiteCache = null;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const PLAYER_AVATAR_STORAGE_KEY = "lunchTownPlayerAvatar";
const LEGACY_PLAYER_STYLE_STORAGE_KEY = "lunchTownPlayerStyle";
const TAICHUNG_TIME_ZONE = "Asia/Taipei";
const ENVIRONMENT_REFRESH_MS = 15_000;
const RAIN_BLOCK_MINUTES = 180;
const TOWN_EVENT_INITIAL_DELAY_MS = 120_000;
const TOWN_EVENT_COOLDOWN_MS = 240_000;
const TOWN_EVENT_COOLDOWN_STEP_MS = 45_000;
const TOWN_EVENT_AUTO_DISMISS_MS = 30_000;
const NPC_OFFSCREEN_VENUE_ID = "__candidate_offscreen__";
const CANDIDATE_APPEARANCE_RULES = Object.freeze({
  "何欣純": { cycleSeconds: 120, visibleSeconds: 120, initialDelaySeconds: 0 },
  "江啟臣": { cycleSeconds: 120, visibleSeconds: 18, initialDelaySeconds: 45 },
});

const canvas = document.querySelector("#townCanvas");
canvas.width = WIDTH;
canvas.height = HEIGHT;
const context = canvas.getContext("2d", { alpha: false });
const refs = {
  app: document.querySelector("#townApp"),
  gameCard: document.querySelector("#gameCard"),
  gameScreen: document.querySelector("#gameScreen"),
  dateDisplay: document.querySelector("#mealDateDisplay"),
  townOptions: document.querySelector(".town-options"),
  loading: document.querySelector("#loadingScreen"),
  loadingTitle: document.querySelector("#loadingTitle"),
  loadingStep: document.querySelector("#loadingStep"),
  loadingProgress: document.querySelector("#loadingProgress"),
  loadingProgressBar: document.querySelector("#loadingProgressBar"),
  loadingPercent: document.querySelector("#loadingPercent"),
  mapPreviewBanner: document.querySelector("#mapPreviewBanner"),
  mapPreviewStatus: document.querySelector("#mapPreviewStatus"),
  prompt: document.querySelector("#interactionPrompt"),
  schoolList: document.querySelector("#schoolList"),
  schoolSearch: document.querySelector("#schoolSearch"),
  schoolSearchStatus: document.querySelector("#schoolSearchStatus"),
  progress: document.querySelector("#visitProgress"),
  schoolFinder: document.querySelector(".achievement-school-finder"),
  accountAction: document.querySelector("#townAccountAction"),
  achievementAccountCard: document.querySelector("#achievementAccountCard"),
  achievementAccountEyebrow: document.querySelector("#achievementAccountEyebrow"),
  achievementAccountTitle: document.querySelector("#achievementAccountTitle"),
  achievementAccountText: document.querySelector("#achievementAccountText"),
  achievementAccountLink: document.querySelector("#achievementAccountLink"),
  achievementProgress: document.querySelector("#achievementProgress"),
  achievementProgressBar: document.querySelector("#achievementProgressBar"),
  achievementMeter: document.querySelector(".achievement-meter"),
  achievementStatus: document.querySelector("#achievementStatus"),
  achievementExpandAll: document.querySelector("#achievementExpandAll"),
  achievementCollapseAll: document.querySelector("#achievementCollapseAll"),
  achievementList: document.querySelector("#achievementList"),
  achievementToast: document.querySelector("#achievementToast"),
  achievementToastKicker: document.querySelector("#achievementToastKicker"),
  achievementToastTitle: document.querySelector("#achievementToastTitle"),
  dailyQuestDate: document.querySelector("#dailyQuestDate"),
  dailyCoinBalance: document.querySelector("#dailyCoinBalance"),
  dailyQuestProgress: document.querySelector("#dailyQuestProgress"),
  dailyQuestStatus: document.querySelector("#dailyQuestStatus"),
  dailyQuestList: document.querySelector("#dailyQuestList"),
  mobilePad: document.querySelector("#mobilePad"),
  mobileExploreButton: document.querySelector("#mobileExploreButton"),
  fullscreenToggle: document.querySelector("#fullscreenToggle"),
  questPanel: document.querySelector("#questPanel"),
  questPanelClose: document.querySelector("#questPanelClose"),
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
  npcSource: document.querySelector("#npcSource"),
  npcText: document.querySelector("#npcText"),
  npcNext: document.querySelector("#npcNext"),
  npcClose: document.querySelector("#npcClose"),
  speechLayer: document.querySelector("#speechLayer"),
  comicBubble: document.querySelector("#comicBubble"),
  comicSpeaker: document.querySelector("#comicSpeaker"),
  comicText: document.querySelector("#comicText"),
  townEventPanel: document.querySelector("#townEventPanel"),
  townEventTitle: document.querySelector("#townEventTitle"),
  townEventText: document.querySelector("#townEventText"),
  townEventChoices: document.querySelector("#townEventChoices"),
  townEventSource: document.querySelector("#townEventSource"),
  townEventContinue: document.querySelector("#townEventContinue"),
  musicToggle: document.querySelector("#musicToggle"),
  environmentStatus: document.querySelector("#environmentStatus"),
  dailyStoryCard: document.querySelector("#dailyStoryCard"),
  dailyStoryDate: document.querySelector("#dailyStoryDate"),
  dailyStoryTitle: document.querySelector("#dailyStoryTitle"),
  dailyStoryText: document.querySelector("#dailyStoryText"),
  dailyStoryChoices: document.querySelector("#dailyStoryChoices"),
  dailyStoryResult: document.querySelector("#dailyStoryResult"),
  announcement: document.querySelector("#townAnnouncement"),
  playerAvatarButtons: [...document.querySelectorAll("[data-player-avatar]")],
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

const ORIGINAL_CONVENIENCE_BRANDS = [
  { name: "日曜便利", shortLabel: "日曜便利", style: "sunrise", wall: "#f2ddaa", roof: "#d86445", accent: "#287a83" },
  { name: "青葉商店", shortLabel: "青葉商店", style: "leaf", wall: "#d9e4c2", roof: "#3d765a", accent: "#e7bd4f" },
  { name: "福星小站", shortLabel: "福星小站", style: "star", wall: "#d6e2e3", roof: "#3e6387", accent: "#e6a53f" },
];
const SERVICE_VENUE_TYPES = ["police-station", "fire-station", "hospital"];
const COMMUNITY_VENUE_TYPES = ["restaurant", "park", "department-store", "grocery-store"];
const OUTFIT_COLOR_PALETTES = [
  { outfit: "#4c7898", outfitDark: "#2d4c65", accent: "#edc15d" },
  { outfit: "#a84f61", outfitDark: "#623b4b", accent: "#f0c86a" },
  { outfit: "#5f8556", outfitDark: "#395944", accent: "#e8bd56" },
  { outfit: "#7d5d92", outfitDark: "#4d3f64", accent: "#e9c566" },
  { outfit: "#b66543", outfitDark: "#704038", accent: "#efd26f" },
  { outfit: "#347f7b", outfitDark: "#2e5558", accent: "#e8bc58" },
  { outfit: "#6b708e", outfitDark: "#42475d", accent: "#e3a957" },
  { outfit: "#a65d7d", outfitDark: "#633c56", accent: "#f0d175" },
  { outfit: "#517564", outfitDark: "#354f46", accent: "#e7b449" },
  { outfit: "#92574a", outfitDark: "#593c37", accent: "#e8c168" },
];
const LIGHT_UNIFORM_PALETTES = [
  { outfit: "#f1ead9", outfitDark: "#4f756c", accent: "#6f9b68" },
  { outfit: "#e8eff0", outfitDark: "#4f6f85", accent: "#d1635a" },
  { outfit: "#f3e5d7", outfitDark: "#7b655a", accent: "#d98b45" },
  { outfit: "#e7eee2", outfitDark: "#537b62", accent: "#507fa1" },
];
const NPC_PERSONALITIES = [
  { id: "chatty", label: "健談", turnCount: 4, greeting: "嗨，正好遇見你。" },
  { id: "reserved", label: "慢熟", turnCount: 2, greeting: "你好。" },
  { id: "cheerful", label: "樂觀", turnCount: 3, greeting: "今天街上很有精神呢。" },
  { id: "practical", label: "務實", turnCount: 3, greeting: "我正照著清單把事情一件件辦完。" },
  { id: "curious", label: "好奇", turnCount: 4, greeting: "你有沒有發現街上今天有點不一樣？" },
  { id: "calm", label: "沉穩", turnCount: 3, greeting: "慢慢來，今天還有時間。" },
];
const DAILY_TOPIC_IDS = [
  "weather", "errands", "work-school", "family", "shopping", "cooking",
  "lunch", "neighborhood", "transport", "rest", "animals", "seasonal",
];
const CONVERSATION_MEMORY_LIMIT = 8;
const CONVERSATION_MEMORY_WINDOW_MS = 10 * 60 * 1000;
const MOBILE_COARSE_UPDATE_SECONDS = 1;
const PLAYER_WALK_SPEED = 116;
const PLAYER_BIKE_SPEED = 272;
const BIKE_SPEED_MULTIPLIER = 3;
const BIKE_ELIGIBLE_ROLES = new Set([
  "teacher", "nutritionist", "nurse", "gardener", "librarian", "parent",
  "community-resident", "university-student", "office-worker", "principal",
  "vendor", "sanitation-worker", "delivery-worker", "college-volunteer",
  "mayor", "borough-chief", "city-councilor", "candidate", "explorer",
  "county-magistrate", "county-civil-servant", "county-supervisor", "county-councilor",
  "township-officer", "local-guide", "railway-worker", "hospitality-worker",
  "agricultural-technician", "garden-shop-worker", "produce-market-worker",
]);
const RESIDENTIAL_VENUE_TYPES = new Set(["player-home", "townhouse", "apartment"]);
const CIVIC_AFTER_HOURS_ROLES = new Set(["mayor", "civil-servant", "city-supervisor"]);
const EVENING_SHOPPING_ROLES = new Set([
  "parent", "community-resident", "high-school-student", "university-student",
  "office-worker", "civil-servant", "city-supervisor", "teacher", "nutritionist",
  "cook", "nurse", "senior", "college-volunteer",
]);
const PLAYER_HOME_STAGE = Object.freeze({
  id: "starter-townhouse",
  label: "起步透天小屋",
  rooms: 2,
  renovationPaths: ["庭院與植栽", "房間與廚房", "外觀與屋頂"],
});
const OUTDOOR_ACTIVITIES = new Set([
  "waiting", "queuing", "resting", "greeting", "watching-birds", "feeding-birds",
  "exercising", "sweeping", "stocking", "school-pickup", "delivery", "listening", "cycling",
  "fishing", "barbecuing", "farming", "harvesting", "patrolling", "guiding", "maintaining",
  "inspecting-paddy", "releasing-water", "mending-ridge", "sorting-produce", "tending-grapes",
  "tending-flowers", "checking-irrigation", "tending-oysters", "repairing-rail", "serving-market",
]);
const ROLE_DESTINATION_PREFERENCES = {
  "coffee-lover": ["snack-shop", "landmark", "convenience-store", "park"],
  "floral-designer": ["park", "museum", "landmark", "grocery-store"],
  "fitness-coach": ["stadium", "park", "convenience-store"],
  student: ["school", "park", "stadium", "museum", "convenience-store", "snack-shop", "landmark"],
  teacher: ["school", "museum", "landmark", "convenience-store", "grocery-store"],
  nutritionist: ["school", "hospital", "grocery-store", "snack-shop"],
  cook: ["school", "restaurant", "grocery-store", "snack-shop"],
  nurse: ["school", "hospital", "convenience-store"],
  principal: ["school", "landmark", "police-station"],
  parent: ["school", "park", "department-store", "convenience-store", "snack-shop"],
  "high-school-student": ["school", "stadium", "museum", "convenience-store", "landmark", "park"],
  "university-student": ["museum", "landmark", "park", "convenience-store", "restaurant", "school"],
  "office-worker": ["office-building", "convenience-store", "restaurant", "department-store", "snack-shop"],
  "civil-servant": ["office-building", "restaurant", "park", "convenience-store"],
  "city-supervisor": ["office-building", "restaurant", "park", "school"],
  senior: ["park", "hospital", "museum", "landmark", "grocery-store"],
  "police-officer": ["police-station", "school", "convenience-store", "park"],
  firefighter: ["fire-station", "school", "hospital", "restaurant"],
  doctor: ["hospital", "school", "convenience-store", "landmark"],
  "sanitation-worker": ["park", "school", "landmark", "grocery-store"],
  "delivery-worker": ["convenience-store", "grocery-store", "restaurant", "school"],
  mayor: ["school", "landmark", "park", "snack-shop"],
  "borough-chief": ["park", "school", "police-station", "convenience-store"],
  "city-councilor": ["landmark", "school", "snack-shop", "park"],
  candidate: ["snack-shop", "park", "landmark", "convenience-store", "grocery-store"],
  "county-magistrate": ["county-government", "school", "landmark", "park"],
  "county-civil-servant": ["county-government", "township-office", "school", "park"],
  "county-supervisor": ["county-government", "township-office", "school"],
  "county-councilor": ["county-council", "school", "landmark", "park"],
  "township-officer": ["township-office", "school", "park"],
  farmer: ["farm", "township-office", "school", "grocery-store"],
  "fruit-farmer": ["farm", "township-office", "school"],
  "flower-grower": ["farm", "park", "township-office"],
  woodcarver: ["workshop", "landmark", "school"],
  "local-guide": ["landmark", "school", "park"],
  "forest-ranger": ["visitor-center", "landmark", "park"],
  "railway-worker": ["railway", "landmark", "township-office"],
  "hospitality-worker": ["landmark", "restaurant", "township-office"],
  fisher: ["harbor", "township-office", "school"],
  "oyster-farmer": ["harbor", "farm", "township-office"],
  "irrigation-worker": ["farm", "township-office", "park"],
  "rice-farmer": ["farm", "township-office", "grocery-store"],
  "vegetable-farmer": ["farm", "grocery-store", "township-office"],
  "grape-grower": ["farm", "grocery-store", "township-office"],
  "agricultural-technician": ["agriculture-office", "farm", "township-office"],
  "railway-maintainer": ["railway", "township-office", "landmark"],
  "sugar-rail-worker": ["railway", "landmark", "township-office"],
  "garden-shop-worker": ["farm", "park", "township-office"],
  "produce-market-worker": ["grocery-store", "farm", "township-office"],
};

const ROLE_OUTFIT_STYLES = {
  "coffee-lover": ["leather-jacket"],
  "floral-designer": ["ivory-dress"],
  "fitness-coach": ["athletic-set"],
  student: ["school-uniform", "school-cardigan", "sporty"],
  teacher: ["cardigan", "blazer"],
  nutritionist: ["lab-coat"],
  cook: ["kitchen-uniform"],
  nurse: ["medical-coat"],
  "crossing-guard": ["safety-vest"],
  gardener: ["overalls"],
  librarian: ["cardigan"],
  parent: ["casual-layered", "fashionable"],
  "college-volunteer": ["casual-layered"],
  "community-resident": ["fashionable"],
  "high-school-student": ["school-uniform", "school-cardigan"],
  "university-student": ["casual-layered", "cardigan"],
  "office-worker": ["blazer", "formal-bow"],
  "civil-servant": ["blazer", "cardigan"],
  "city-supervisor": ["civic-suit", "blazer"],
  senior: ["senior-knit"],
  mayor: ["civic-suit"],
  "borough-chief": ["civic-suit"],
  "city-councilor": ["civic-suit"],
  candidate: ["civic-suit"],
  principal: ["blazer"],
  vendor: ["shop-apron"],
  "police-officer": ["police-uniform"],
  firefighter: ["fire-uniform"],
  doctor: ["medical-coat"],
  "sanitation-worker": ["safety-vest"],
  "delivery-worker": ["casual-layered"],
  explorer: ["adventurer"],
  "county-magistrate": ["civic-suit"],
  "county-civil-servant": ["blazer", "cardigan"],
  "county-supervisor": ["civic-suit", "blazer"],
  "county-councilor": ["civic-suit"],
  "township-officer": ["blazer", "cardigan"],
  farmer: ["overalls"],
  "fruit-farmer": ["overalls"],
  "flower-grower": ["overalls"],
  woodcarver: ["shop-apron"],
  "local-guide": ["casual-layered", "cardigan"],
  "forest-ranger": ["adventurer", "safety-vest"],
  "railway-worker": ["safety-vest"],
  "hospitality-worker": ["blazer", "cardigan"],
  fisher: ["overalls", "safety-vest"],
  "oyster-farmer": ["overalls"],
  "irrigation-worker": ["safety-vest", "overalls"],
  "rice-farmer": ["overalls"],
  "vegetable-farmer": ["overalls"],
  "grape-grower": ["overalls"],
  "agricultural-technician": ["safety-vest", "cardigan"],
  "railway-maintainer": ["safety-vest"],
  "sugar-rail-worker": ["safety-vest", "overalls"],
  "garden-shop-worker": ["shop-apron", "overalls"],
  "produce-market-worker": ["shop-apron", "overalls"],
};

const CHARACTER_PROFILES = [
  { role: "student", gender: "male", ageGroup: "child", skin: "#efbd91", hair: "#302623", hairStyle: "crop", outfit: "#447ea0", outfitDark: "#294f6d", accent: "#f2c657", expression: "cheerful", accessory: "backpack" },
  { role: "student", gender: "female", ageGroup: "child", skin: "#d99a70", hair: "#241f20", hairStyle: "twin-tail", outfit: "#d76248", outfitDark: "#873f3b", accent: "#f2cf6e", expression: "curious", accessory: "book", bodyStyle: "feminine" },
  { role: "student", gender: "female", ageGroup: "child", skin: "#f0c6a0", hair: "#6f4633", hairStyle: "braid", hairAccent: "#a36a4d", outfit: "#648b58", outfitDark: "#365c48", accent: "#f5d66e", expression: "cheerful", accessory: "backpack", bodyStyle: "feminine" },
  { role: "student", gender: "male", ageGroup: "child", skin: "#bb795b", hair: "#1e2527", hairStyle: "spiky", outfit: "#e2a33f", outfitDark: "#72523c", accent: "#487a96", expression: "focused", accessory: "book" },
  { role: "teacher", gender: "female", skin: "#e8b58b", hair: "#4e342d", hairStyle: "bun", outfit: "#8c6689", outfitDark: "#59445d", accent: "#f1d49b", expression: "gentle", accessory: "book", bodyStyle: "feminine" },
  { role: "teacher", gender: "male", skin: "#c98864", hair: "#292526", hairStyle: "side-part", outfit: "#4f8090", outfitDark: "#2c4f5c", accent: "#d7b65a", expression: "thoughtful", accessory: "glasses" },
  { role: "nutritionist", gender: "female", skin: "#e7b18a", hair: "#56382f", hairStyle: "ponytail", outfit: "#f0e8d5", outfitDark: "#52756b", accent: "#6e9e68", expression: "kind", accessory: "clipboard", bodyStyle: "feminine" },
  { role: "nutritionist", gender: "male", skin: "#c98765", hair: "#2d2928", hairStyle: "side-part", outfit: "#e9e4d6", outfitDark: "#446a64", accent: "#7aa16b", expression: "calm", accessory: "clipboard" },
  { role: "cook", gender: "female", skin: "#efbd98", hair: "#47352d", hairStyle: "chef", outfit: "#f2eee0", outfitDark: "#65747c", accent: "#d55a44", expression: "cheerful", accessory: "apron", bodyStyle: "feminine" },
  { role: "nurse", gender: "female", skin: "#d89a78", hair: "#352823", hairStyle: "shoulder-length", outfit: "#e8efe8", outfitDark: "#527d72", accent: "#d64d4d", expression: "gentle", accessory: "medical", bodyStyle: "feminine" },
  { role: "crossing-guard", gender: "male", skin: "#bb785a", hair: "#252326", hairStyle: "cap", outfit: "#e28d37", outfitDark: "#354d59", accent: "#f4db54", expression: "determined", accessory: "flag" },
  { role: "gardener", gender: "male", skin: "#e5aa7c", hair: "#5b3e2e", hairStyle: "cap", outfit: "#5d8757", outfitDark: "#3c5c43", accent: "#d5b75b", expression: "calm", accessory: "watering-can" },
  { role: "librarian", gender: "female", skin: "#f0c29b", hair: "#714a38", hairStyle: "bob", outfit: "#a36982", outfitDark: "#61445e", accent: "#e8c25d", expression: "curious", accessory: "glasses", bodyStyle: "feminine" },
  { role: "parent", gender: "male", skin: "#d18c68", hair: "#302623", hairStyle: "short-wave", outfit: "#507e9c", outfitDark: "#304f66", accent: "#e9b854", expression: "thoughtful", accessory: "tote" },
  { role: "parent", gender: "female", variant: "glam", skin: "#e1a37e", hair: "#3a252b", hairStyle: "long-wavy", outfit: "#a7435d", outfitDark: "#633044", accent: "#f1c96c", expression: "confident", accessory: "tote", bodyStyle: "feminine", makeup: true },
  { role: "teacher", gender: "female", variant: "glam", skin: "#efba94", hair: "#5b3432", hairStyle: "long-wavy", outfit: "#76558d", outfitDark: "#49385f", accent: "#f0c978", expression: "confident", accessory: "book", bodyStyle: "feminine", makeup: true },
  { role: "college-volunteer", gender: "female", skin: "#d99673", hair: "#28242a", hairStyle: "high-ponytail", outfit: "#d96058", outfitDark: "#75404d", accent: "#f2cc67", expression: "happy", accessory: "tote", bodyStyle: "feminine", makeup: true },
  { role: "community-resident", gender: "female", skin: "#edb58c", hair: "#56352f", hairStyle: "curl", outfit: "#2f7b78", outfitDark: "#285052", accent: "#e6bf65", expression: "confident", accessory: "glasses", bodyStyle: "feminine", makeup: true },
  { role: "high-school-student", gender: "female", ageGroup: "teen", skin: "#e8aa86", hair: "#352830", hairStyle: "high-ponytail", outfit: "#6d6aa7", outfitDark: "#3d416c", accent: "#f0cc68", expression: "cheerful", accessory: "backpack", bodyStyle: "feminine" },
  { role: "high-school-student", gender: "female", ageGroup: "teen", skin: "#d18a69", hair: "#261f25", hairStyle: "shoulder-length", outfit: "#497d8f", outfitDark: "#2f4f64", accent: "#e5b95b", expression: "thoughtful", accessory: "book", bodyStyle: "feminine" },
  { role: "high-school-student", gender: "male", ageGroup: "teen", skin: "#efbb91", hair: "#2a292c", hairStyle: "crop", outfit: "#456f9f", outfitDark: "#2f4665", accent: "#e7bd59", expression: "determined", accessory: "backpack" },
  { role: "high-school-student", gender: "male", ageGroup: "teen", skin: "#b97759", hair: "#1f2529", hairStyle: "spiky", outfit: "#667f55", outfitDark: "#3f523e", accent: "#e9c15e", expression: "happy", accessory: "book" },
  { role: "university-student", gender: "female", skin: "#f0b994", hair: "#4c2d35", hairStyle: "long-wavy", outfit: "#c65367", outfitDark: "#6b3d59", accent: "#efd066", expression: "confident", accessory: "tote", bodyStyle: "feminine", makeup: true },
  { role: "university-student", gender: "female", skin: "#c98465", hair: "#27232b", hairStyle: "high-ponytail", outfit: "#4f8390", outfitDark: "#315760", accent: "#e7bf61", expression: "happy", accessory: "book", bodyStyle: "feminine" },
  { role: "university-student", gender: "male", skin: "#e7aa82", hair: "#302a28", hairStyle: "side-part", outfit: "#4e7198", outfitDark: "#344b67", accent: "#e8bb55", expression: "calm", accessory: "backpack" },
  { role: "university-student", gender: "male", skin: "#b9785c", hair: "#202629", hairStyle: "spiky", outfit: "#a65d43", outfitDark: "#633e38", accent: "#e9c35d", expression: "happy", accessory: "book" },
  { role: "office-worker", gender: "female", skin: "#e9ad88", hair: "#3b2930", hairStyle: "long-wavy", outfit: "#8b4f78", outfitDark: "#4d3857", accent: "#e7c36a", expression: "confident", accessory: "briefcase", bodyStyle: "feminine", makeup: true },
  { role: "office-worker", gender: "female", variant: "formal-black", outfitStyle: "formal-bow", skin: "#efb995", hair: "#34262a", hairStyle: "long-wavy", hairAccent: "#65414a", outfit: "#24272d", outfitDark: "#55525c", accent: "#fff5e6", expression: "confident", accessory: "bow-briefcase", bodyStyle: "feminine", makeup: true },
  { role: "office-worker", gender: "male", skin: "#c98564", hair: "#292628", hairStyle: "side-part", outfit: "#52647c", outfitDark: "#333c50", accent: "#d6a950", expression: "focused", accessory: "briefcase" },
  { role: "civil-servant", gender: "female", skin: "#e6ad88", hair: "#3e2d35", hairStyle: "shoulder-length", outfit: "#607e8e", outfitDark: "#3a5361", accent: "#e6bc62", expression: "focused", accessory: "folder", bodyStyle: "feminine" },
  { role: "civil-servant", gender: "male", skin: "#c98767", hair: "#2d2928", hairStyle: "side-part", outfit: "#557466", outfitDark: "#354c44", accent: "#e6b957", expression: "calm", accessory: "clipboard" },
  { role: "city-supervisor", gender: "female", skin: "#efb58f", hair: "#433039", hairStyle: "bun", outfit: "#845d7b", outfitDark: "#4e3f58", accent: "#edc769", expression: "confident", accessory: "folder", bodyStyle: "feminine" },
  { role: "city-supervisor", gender: "male", skin: "#c98565", hair: "#302b29", hairStyle: "side-part", outfit: "#4f667e", outfitDark: "#303f52", accent: "#e7bb58", expression: "thoughtful", accessory: "briefcase" },
  { role: "senior", gender: "female", ageGroup: "senior", skin: "#e5b28e", hair: "#d8d3c7", hairStyle: "bun", outfit: "#8d657e", outfitDark: "#594756", accent: "#e5bf68", expression: "gentle", accessory: "cane", bodyStyle: "feminine" },
  { role: "senior", gender: "male", ageGroup: "senior", skin: "#c88b6d", hair: "#c9c6bd", hairStyle: "short-wave", outfit: "#68775b", outfitDark: "#414d42", accent: "#d6ad58", expression: "thoughtful", accessory: "cane" },
  { role: "mayor", gender: "female", skin: "#e5a987", hair: "#3d2b34", hairStyle: "long-wavy", outfit: "#7a4d77", outfitDark: "#45384f", accent: "#e8c566", expression: "confident", accessory: "folder", bodyStyle: "feminine", makeup: true },
  { role: "borough-chief", gender: "male", skin: "#c48464", hair: "#44342d", hairStyle: "side-part", outfit: "#497467", outfitDark: "#334e48", accent: "#ebbd59", expression: "kind", accessory: "clipboard" },
  { role: "city-councilor", gender: "female", skin: "#efb792", hair: "#29232b", hairStyle: "high-ponytail", outfit: "#b1495e", outfitDark: "#663748", accent: "#f1c967", expression: "confident", accessory: "folder", bodyStyle: "feminine", makeup: true },
  { role: "candidate", gender: "female", skin: "#eab18c", hair: "#4a2d35", hairStyle: "long-wavy", outfit: "#8b537f", outfitDark: "#503a59", accent: "#efc35d", expression: "determined", accessory: "sash", bodyStyle: "feminine", makeup: true },
  { role: "candidate", gender: "male", skin: "#d69573", hair: "#2d2928", hairStyle: "side-part", outfit: "#4c6691", outfitDark: "#303f5c", accent: "#e9bd50", expression: "determined", accessory: "sash" },
  { role: "principal", gender: "male", skin: "#edbc92", hair: "#4b4644", hairStyle: "side-part", outfit: "#59667b", outfitDark: "#333b4b", accent: "#c85a48", expression: "calm", accessory: "tie" },
  { role: "vendor", gender: "male", skin: "#b97859", hair: "#2b2321", hairStyle: "curl", outfit: "#cf6549", outfitDark: "#743e39", accent: "#f0c95f", expression: "happy", accessory: "apron" },
  { role: "police-officer", gender: "female", skin: "#e8ae87", hair: "#35282d", hairStyle: "ponytail", outfit: "#456c8b", outfitDark: "#293f5c", accent: "#e8bd55", expression: "focused", accessory: "radio", bodyStyle: "feminine" },
  { role: "police-officer", gender: "male", skin: "#c98667", hair: "#25272b", hairStyle: "cap", outfit: "#3e6688", outfitDark: "#263d58", accent: "#e8bd55", expression: "calm", accessory: "radio" },
  { role: "firefighter", gender: "female", skin: "#efb792", hair: "#49302c", hairStyle: "short-wave", outfit: "#c75b3f", outfitDark: "#6e3c35", accent: "#f2cf57", expression: "determined", accessory: "helmet", bodyStyle: "feminine" },
  { role: "firefighter", gender: "male", skin: "#b9785b", hair: "#262628", hairStyle: "crop", outfit: "#b94f3b", outfitDark: "#65362f", accent: "#f2cf57", expression: "determined", accessory: "helmet" },
  { role: "doctor", gender: "female", skin: "#e9ad89", hair: "#3c2a31", hairStyle: "bun", outfit: "#edf0e7", outfitDark: "#4b7780", accent: "#d55757", expression: "gentle", accessory: "medical", bodyStyle: "feminine" },
  { role: "doctor", gender: "male", skin: "#cb8969", hair: "#2b2929", hairStyle: "side-part", outfit: "#e9eee9", outfitDark: "#476f78", accent: "#d55757", expression: "thoughtful", accessory: "medical" },
  { role: "sanitation-worker", gender: "female", skin: "#e8ac83", hair: "#4a302b", hairStyle: "cap", outfit: "#df963d", outfitDark: "#3f5e58", accent: "#f2d558", expression: "cheerful", accessory: "broom", bodyStyle: "feminine" },
  { role: "sanitation-worker", gender: "male", skin: "#c88768", hair: "#292729", hairStyle: "cap", outfit: "#d98a38", outfitDark: "#385451", accent: "#f2d558", expression: "calm", accessory: "broom" },
  { role: "delivery-worker", gender: "female", skin: "#edb38b", hair: "#3a2930", hairStyle: "ponytail", outfit: "#4e8090", outfitDark: "#30515e", accent: "#edc35b", expression: "focused", accessory: "package", bodyStyle: "feminine" },
  { role: "delivery-worker", gender: "male", skin: "#c98566", hair: "#292728", hairStyle: "crop", outfit: "#547a91", outfitDark: "#334d60", accent: "#edc35b", expression: "cheerful", accessory: "package" },
  // Three original adult residents inspired by the supplied fashion references.
  { role: "coffee-lover", gender: "female", ageGroup: "adult", preservePalette: true, skin: "#e9b89d", hair: "#24282e", hairStyle: "bob", hairAccent: "#49515b", eyeColor: "#63767b", outfitStyle: "leather-jacket", outfit: "#292d35", outfitDark: "#171d25", accent: "#c7d2d8", shoeColor: "#242b33", expression: "confident", accessory: "coffee-cup", bodyStyle: "feminine", makeup: true },
  { role: "floral-designer", gender: "female", ageGroup: "adult", preservePalette: true, skin: "#f0c6aa", hair: "#dfc998", hairStyle: "bob", hairAccent: "#f7e5bd", hairClip: "#66b9c9", eyeColor: "#4b7e9c", outfitStyle: "ivory-dress", outfit: "#f4efdf", outfitDark: "#d8d0bd", accent: "#66b9c9", shoeColor: "#a98a70", expression: "gentle", accessory: "butterfly-pin", bodyStyle: "feminine" },
  { role: "fitness-coach", gender: "female", ageGroup: "adult", preservePalette: true, skin: "#e9b58e", hair: "#c79649", hairStyle: "long-high-ponytail", hairAccent: "#ebc575", outfitStyle: "athletic-set", outfit: "#f0ece0", outfitDark: "#252b33", accent: "#6aaac1", shoeColor: "#ecefe9", expression: "cheerful", accessory: "water-bottle", bodyStyle: "feminine" },
];

const CHILD_NAMES = [
  "小晴", "阿禾", "米米", "樂樂", "小宇", "小葵", "小橙", "泡泡", "小樹", "芽芽",
  "小森", "朵朵", "星星", "小沐", "果果", "丸丸", "小麥", "小雨", "小風", "小溪",
  "小石", "小花", "小海", "小山", "小光", "小葉", "小米", "小桃", "小栗",
];
const DISTRICT_ADULTS = [
  { name: "晨露老師", role: "teacher", gender: "female" },
  { name: "米糰營養師", role: "nutritionist", gender: "male" },
  { name: "紅豆廚房阿姨", role: "cook", gender: "female" },
  { name: "青芽護理師", role: "nurse", gender: "female" },
  { name: "橘帽導護員", role: "crossing-guard", gender: "male" },
  { name: "樹叔園丁", role: "gardener", gender: "male" },
  { name: "書頁館員", role: "librarian", gender: "female" },
  { name: "林校長", role: "principal", gender: "male" },
];
const OCCASIONAL_TOWN_NPCS = [
  { district: "西區", name: "采寧媽媽", role: "parent", gender: "female", profileVariant: "glam" },
  { district: "北區", name: "若庭老師", role: "teacher", gender: "female", profileVariant: "glam" },
  { district: "南區", name: "芊羽學姊", role: "college-volunteer", gender: "female" },
  { district: "西屯區", name: "映彤姐", role: "community-resident", gender: "female" },
  { district: "大雅區", name: "瑄寧媽媽", role: "parent", gender: "female", profileVariant: "glam" },
  { district: "豐原區", name: "語安老師", role: "teacher", gender: "female", profileVariant: "glam" },
  { district: "大里區", name: "思妤學姊", role: "college-volunteer", gender: "female" },
  { district: "清水區", name: "筱晴姐", role: "community-resident", gender: "female" },
  { district: "北屯區", name: "佳蓉媽媽", role: "parent", gender: "female", profileVariant: "glam" },
];

const TOWN_SERVICE_NPCS = [
  { district: "中區", name: "美芳清潔員", role: "sanitation-worker", gender: "female" },
  { district: "西區", name: "建國清潔員", role: "sanitation-worker", gender: "male" },
  { district: "豐原區", name: "淑惠清潔員", role: "sanitation-worker", gender: "female" },
  { district: "西屯區", name: "志強清潔員", role: "sanitation-worker", gender: "male" },
  { district: "北區", name: "怡君送貨員", role: "delivery-worker", gender: "female" },
  { district: "南區", name: "俊豪送貨員", role: "delivery-worker", gender: "male" },
  { district: "北屯區", name: "佩芸送貨員", role: "delivery-worker", gender: "female" },
  { district: "大里區", name: "家銘送貨員", role: "delivery-worker", gender: "male" },
];

// 市府街區的日常工作角色不對應現實中的特定公務員。
const CITY_HALL_NPCS = [
  { district: "西屯區", name: "怡安承辦", role: "civil-servant", gender: "female", homeVenueId: "civic-center" },
  { district: "西屯區", name: "柏翰承辦", role: "civil-servant", gender: "male", homeVenueId: "civic-center" },
  { district: "西屯區", name: "佳蓉承辦", role: "civil-servant", gender: "female", homeVenueId: "civic-center" },
  { district: "西屯區", name: "志偉承辦", role: "civil-servant", gender: "male", homeVenueId: "civic-center" },
  { district: "西屯區", name: "雅婷科長", role: "city-supervisor", gender: "female", homeVenueId: "civic-center" },
  { district: "西屯區", name: "建宏處長", role: "city-supervisor", gender: "male", homeVenueId: "civic-center" },
];

const SERVICE_STAFF_NAMES = {
  "police-officer": {
    female: ["雅琪警員", "育寧警員", "嘉真警員", "舒涵警員", "佩君警員"],
    male: ["志宏警員", "柏勳警員", "家豪警員", "俊毅警員", "承恩警員"],
  },
  firefighter: {
    female: ["沛晴消防員", "宜庭消防員", "佳穎消防員", "安瑄消防員", "子晴消防員"],
    male: ["冠宇消防員", "哲維消防員", "明翰消防員", "柏廷消防員", "彥廷消防員"],
  },
  doctor: {
    female: ["雨潔醫師", "婉庭醫師", "欣儀醫師", "佳芸醫師", "品妤醫師"],
    male: ["柏翰醫師", "昱辰醫師", "家維醫師", "彥廷醫師", "承澤醫師"],
  },
};

const DIVERSE_TOWN_NPCS = [
  { district: "北區", name: "靜宜同學", role: "high-school-student", gender: "female" },
  { district: "南區", name: "小恩同學", role: "high-school-student", gender: "female" },
  { district: "大雅區", name: "羽柔同學", role: "high-school-student", gender: "female" },
  { district: "東區", name: "子豪同學", role: "high-school-student", gender: "male" },
  { district: "太平區", name: "阿澤同學", role: "high-school-student", gender: "male" },
  { district: "清水區", name: "柏宇同學", role: "high-school-student", gender: "male" },
  { district: "西區", name: "佩珊學姊", role: "university-student", gender: "female" },
  { district: "南屯區", name: "予晴學姊", role: "university-student", gender: "female" },
  { district: "豐原區", name: "欣妍學姊", role: "university-student", gender: "female" },
  { district: "西屯區", name: "建宇學長", role: "university-student", gender: "male" },
  { district: "北屯區", name: "宇辰學長", role: "university-student", gender: "male" },
  { district: "大里區", name: "冠廷學長", role: "university-student", gender: "male" },
  { district: "中區", name: "雅雯姐", role: "office-worker", gender: "female" },
  { district: "梧棲區", name: "佳琪姐", role: "office-worker", gender: "female" },
  { district: "西屯區", name: "芷妍姐", role: "office-worker", gender: "female", profileVariant: "formal-black" },
  { district: "烏日區", name: "志明哥", role: "office-worker", gender: "male" },
  { district: "沙鹿區", name: "俊凱哥", role: "office-worker", gender: "male" },
  { district: "后里區", name: "桂花奶奶", role: "senior", gender: "female" },
  { district: "霧峰區", name: "美代阿嬤", role: "senior", gender: "female" },
  { district: "東勢區", name: "文山爺爺", role: "senior", gender: "male" },
  { district: "和平區", name: "清泉阿公", role: "senior", gender: "male" },
];

// Keep these residents at the end of the spawn list so existing looks/routes stay stable.
const FEATURED_RESIDENT_NPCS = [
  { district: "梧棲區", name: "海音", role: "coffee-lover", gender: "female", featuredResident: true },
  { district: "西區", name: "沐白", role: "floral-designer", gender: "female", featuredResident: true },
  { district: "北屯區", name: "晴夏", role: "fitness-coach", gender: "female", featuredResident: true },
];

const CIVIC_TOWN_NPCS = [
  { district: "西屯區", name: "盧秀燕", role: "mayor", gender: "female", homeVenueId: "civic-center", sourceUrl: "https://www.taichung.gov.tw/8868/9942/9986/9989/1173576" },
  { district: "西區", name: "林哲雄", role: "borough-chief", gender: "male", sourceUrl: "https://www.west.taichung.gov.tw/media/205632/672610524328.pdf" },
  { district: "西屯區", name: "陳淑華", role: "city-councilor", gender: "female", sourceUrl: "https://www.tccc.gov.tw/wb_introduction02.asp?cno=28&uno=" },
  {
    district: "大里區", name: "何欣純", role: "candidate", gender: "female",
    sourceUrl: "https://web.cec.gov.tw/central/article/65213", campaignSourceUrl: "https://a-chun.tw/",
    campaignAppeal: "我是何欣純，正在爭取你的支持；請看看我的公開資料，也歡迎投票支持我。",
  },
  {
    district: "豐原區", name: "江啟臣", role: "candidate", gender: "male",
    sourceUrl: "https://web.cec.gov.tw/central/article/65213", campaignSourceUrl: "https://taichungway.tw/",
    campaignAppeal: "我是江啟臣，正在爭取你的支持；請看看我的公開資料，也歡迎投票支持我。",
  },
];

const NEIGHBOR_BASE_ROLE_BY_DISTRICT = Object.freeze({
  "竹南鎮": ["fisher", "male", "vendor"],
  "頭份市": ["office-worker", "female", "office-worker"],
  "三灣鄉": ["fruit-farmer", "female", "gardener"],
  "南庄鄉": ["local-guide", "female", "community-resident"],
  "後龍鎮": ["fisher", "female", "vendor"],
  "造橋鄉": ["farmer", "male", "gardener"],
  "頭屋鄉": ["farmer", "female", "gardener"],
  "獅潭鄉": ["forest-ranger", "male", "crossing-guard"],
  "西湖鄉": ["farmer", "female", "gardener"],
  "苗栗市": ["county-civil-servant", "female", "civil-servant"],
  "公館鄉": ["farmer", "male", "gardener"],
  "泰安鄉": ["forest-ranger", "female", "crossing-guard"],
  "通霄鎮": ["fisher", "male", "vendor"],
  "銅鑼鄉": ["local-guide", "male", "community-resident"],
  "大湖鄉": ["fruit-farmer", "female", "gardener"],
  "苑裡鎮": ["farmer", "male", "gardener"],
  "三義鄉": ["woodcarver", "female", "vendor"],
  "卓蘭鎮": ["fruit-farmer", "male", "gardener"],
  "伸港鄉": ["fisher", "female", "vendor"],
  "線西鄉": ["fisher", "male", "vendor"],
  "和美鎮": ["rice-farmer", "female", "gardener"],
  "彰化市": ["railway-maintainer", "male", "delivery-worker"],
  "芬園鄉": ["rice-farmer", "male", "gardener"],
  "鹿港鎮": ["local-guide", "female", "community-resident"],
  "福興鄉": ["rice-farmer", "female", "gardener"],
  "秀水鄉": ["rice-farmer", "male", "gardener"],
  "花壇鄉": ["vegetable-farmer", "female", "gardener"],
  "埔鹽鄉": ["rice-farmer", "male", "gardener"],
  "大村鄉": ["grape-grower", "female", "gardener"],
  "員林市": ["agricultural-technician", "male", "civil-servant"],
  "芳苑鄉": ["oyster-farmer", "female", "vendor"],
  "二林鎮": ["vegetable-farmer", "male", "gardener"],
  "溪湖鎮": ["sugar-rail-worker", "female", "delivery-worker"],
  "埔心鄉": ["rice-farmer", "female", "gardener"],
  "永靖鄉": ["flower-grower", "male", "gardener"],
  "社頭鄉": ["rice-farmer", "female", "gardener"],
  "大城鄉": ["vegetable-farmer", "male", "gardener"],
  "竹塘鄉": ["vegetable-farmer", "female", "gardener"],
  "埤頭鄉": ["rice-farmer", "male", "gardener"],
  "北斗鎮": ["produce-market-worker", "female", "vendor"],
  "田尾鄉": ["garden-shop-worker", "female", "gardener"],
  "田中鎮": ["rice-farmer", "male", "gardener"],
  "溪州鄉": ["irrigation-worker", "female", "sanitation-worker"],
  "二水鄉": ["irrigation-worker", "male", "sanitation-worker"],
});

const NEIGHBOR_EXTRA_NPCS = Object.freeze([
  { countyId: "miaoli", district: "苗栗市", name: "鍾東錦", role: "county-magistrate", gender: "male", profileBaseRole: "mayor", workVenueId: "miaoli-county-government", sourceUrl: "https://www.miaoli.gov.tw/cp.aspx?n=265" },
  { countyId: "miaoli", district: "苗栗市", role: "county-civil-servant", gender: "male", profileBaseRole: "civil-servant", workVenueId: "miaoli-county-government" },
  { countyId: "miaoli", district: "苗栗市", role: "county-civil-servant", gender: "female", profileBaseRole: "civil-servant", workVenueId: "miaoli-county-government" },
  { countyId: "miaoli", district: "苗栗市", role: "county-supervisor", gender: "female", profileBaseRole: "city-supervisor", workVenueId: "miaoli-county-government" },
  { countyId: "miaoli", district: "苗栗市", role: "county-councilor", gender: "male", profileBaseRole: "city-councilor", workVenueId: "miaoli-county-council" },
  { countyId: "miaoli", district: "苗栗市", role: "police-officer", gender: "female", profileBaseRole: "police-officer", workVenueId: "miaoli-public-safety" },
  { countyId: "miaoli", district: "苗栗市", role: "firefighter", gender: "male", profileBaseRole: "firefighter", workVenueId: "miaoli-fire-service" },
  { countyId: "miaoli", district: "苗栗市", role: "teacher", gender: "female", profileBaseRole: "teacher" },
  { countyId: "miaoli", district: "三義鄉", role: "railway-worker", gender: "male", profileBaseRole: "delivery-worker" },
  { countyId: "miaoli", district: "泰安鄉", role: "hospitality-worker", gender: "female", profileBaseRole: "office-worker" },
  { countyId: "changhua", district: "彰化市", name: "王惠美", role: "county-magistrate", gender: "female", profileBaseRole: "mayor", workVenueId: "changhua-county-government", sourceUrl: "https://www.chcg.gov.tw/ch2/intro-magistrate.aspx" },
  { countyId: "changhua", district: "彰化市", role: "county-civil-servant", gender: "female", profileBaseRole: "civil-servant", workVenueId: "changhua-county-government" },
  { countyId: "changhua", district: "彰化市", role: "county-civil-servant", gender: "male", profileBaseRole: "civil-servant", workVenueId: "changhua-county-government" },
  { countyId: "changhua", district: "彰化市", role: "county-supervisor", gender: "male", profileBaseRole: "city-supervisor", workVenueId: "changhua-county-government" },
  { countyId: "changhua", district: "彰化市", role: "county-councilor", gender: "female", profileBaseRole: "city-councilor", workVenueId: "changhua-county-council" },
  { countyId: "changhua", district: "彰化市", role: "police-officer", gender: "male", profileBaseRole: "police-officer", workVenueId: "changhua-public-safety" },
  { countyId: "changhua", district: "彰化市", role: "firefighter", gender: "female", profileBaseRole: "firefighter", workVenueId: "changhua-fire-service" },
  { countyId: "changhua", district: "彰化市", role: "teacher", gender: "male", profileBaseRole: "teacher" },
]);

const VENUE_TYPES = [
  "landmark", "convenience-store", "snack-shop", "police-station", "fire-station", "hospital",
  "county-government", "county-council", "township-office", "agriculture-office",
  ...COMMUNITY_VENUE_TYPES, "player-home", "townhouse", "apartment",
];
const VENUE_LABELS = {
  landmark: "地標",
  "convenience-store": "便利商店",
  "snack-shop": "小吃店",
  "police-station": "警察局",
  "fire-station": "消防局",
  hospital: "醫院",
  restaurant: "餐廳",
  park: "公園",
  "department-store": "百貨公司",
  "grocery-store": "雜貨店",
  "office-building": "市政辦公區",
  stadium: "棒球場",
  museum: "美術館",
  "player-home": "我的家",
  townhouse: "透天住宅",
  apartment: "公寓住宅",
  "county-government": "縣政府",
  "agriculture-office": "農業處",
  "county-council": "縣議會",
  "township-office": "鄉鎮市公所",
};

const LANDMARK_HUB_DEFINITIONS = [
  {
    id: "harbor-outlet", district: "梧棲區", type: "department-store", hubKind: "harbor-outlet", grid: [1, 1],
    label: "臺中港灣購物聚落", shortLabel: "港灣購物聚落",
    description: "以臺中港區與海線購物日常為靈感的共享街廓，設有商店、餐飲、港景步道與候車空間。",
    sourceUrl: "https://travel.taichung.gov.tw/zh-tw/Attractions/Intro/1511/",
  },
  {
    id: "waternan-central-park", district: "西屯區", type: "park", hubKind: "central-park", grid: [1, 3],
    label: "水湳中央公園與臺中綠美圖", shortLabel: "中央公園・綠美圖",
    description: "大面積公園串連步道、草地、親子活動與文化場館；居民會來散步、運動、野餐、看鳥或參觀。",
    sourceUrl: "https://tgm.taichung.gov.tw/zh/about",
  },
  {
    id: "civic-center", district: "西屯區", type: "office-building", hubKind: "civic-center", grid: [1, 4],
    label: "臺灣大道市政與辦公街區", shortLabel: "市政辦公街區",
    description: "以臺灣大道市政中心為核心的辦公街廓，包含市民廣場、通勤人潮、午休動線與公共服務。",
    sourceUrl: "https://www.taichung.gov.tw/8868/9942/10167/586342/",
  },
  {
    id: "intercontinental-stadium", district: "北屯區", type: "stadium", hubKind: "stadium", grid: [4, 2],
    label: "臺中洲際棒球場", shortLabel: "洲際棒球場",
    description: "球場周邊會出現練球、散步、補給與賽事前後的人潮，沒有活動時則維持較安靜的社區運動氣氛。",
    sourceUrl: "https://travel.taichung.gov.tw/zh-tw/Attractions/Intro/149/",
  },
  {
    id: "lalaport-taichung", district: "東區", type: "department-store", hubKind: "lalaport", grid: [6, 3],
    label: "LaLaport 台中", shortLabel: "LaLaport 台中",
    description: "由南北館、空中連通橋與戶外廣場組成的購物街廓，NPC 會在這裡購物、用餐、等人與送貨。",
    sourceUrl: "https://www.mitsui-shopping-park.com.tw/lalaport/taichung/tw/index.html",
  },
  {
    id: "city-general-hospital", district: "南區", type: "hospital", hubKind: "hospital", grid: [3, 5],
    label: "臺中城市綜合醫院", shortLabel: "城市綜合醫院",
    description: "小鎮原創的區域醫院場景，設有門診、復健花園與救護車動線；名稱不對應現實中的特定醫療院所。",
  },
  {
    id: "asia-modern-museum", district: "霧峰區", type: "museum", hubKind: "asia-museum", grid: [7, 5],
    label: "亞洲大學現代美術館", shortLabel: "現代美術館",
    description: "以清水混凝土、三角幾何與校園草地構成的藝文街廓，學生、遊客與居民會停留看展或散步。",
    sourceUrl: "https://travel.taichung.gov.tw/zh-tw/Tourist/Tour/1127/",
  },
];

const ROLE_LABELS = {
  "coffee-lover": "咖啡愛好者",
  "floral-designer": "花藝設計師",
  "fitness-coach": "運動教練",
  student: "國小學生",
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
  "college-volunteer": "大學生志工",
  "community-resident": "社區居民",
  "high-school-student": "高中生",
  "university-student": "大學生",
  "office-worker": "上班族",
  "civil-servant": "市府承辦人",
  "city-supervisor": "市府主管",
  senior: "長者",
  mayor: "臺中市長",
  "borough-chief": "里長",
  "city-councilor": "臺中市議員",
  candidate: "臺中市長候選人",
  "police-officer": "警察",
  firefighter: "消防員",
  doctor: "醫師",
  "sanitation-worker": "街區清潔人員",
  "delivery-worker": "送貨人員",
  "county-magistrate": "縣長",
  "county-civil-servant": "縣府承辦人",
  "county-supervisor": "縣府主管",
  "county-councilor": "縣議員",
  "township-officer": "鄉鎮市公所人員",
  farmer: "農夫",
  "fruit-farmer": "果農",
  "flower-grower": "花農與苗木栽培員",
  woodcarver: "木雕師",
  "local-guide": "地方文化導覽員",
  "forest-ranger": "山林巡護員",
  "railway-worker": "鐵道工作人員",
  "hospitality-worker": "溫泉旅宿人員",
  fisher: "漁港工作者",
  "oyster-farmer": "蚵農",
  "irrigation-worker": "水圳巡查員",
  "rice-farmer": "稻農",
  "vegetable-farmer": "蔬菜農",
  "grape-grower": "葡萄果農",
  "agricultural-technician": "農業技術員",
  "railway-maintainer": "鐵道維修員",
  "sugar-rail-worker": "糖廠小火車人員",
  "garden-shop-worker": "園藝店員",
  "produce-market-worker": "果菜市場人員",
};

const ROLE_DIALOGUES = {
  "coffee-lover": [
    "我是海音。喜歡穿著皮衣，在海風裡找一家可以慢慢坐的店。",
    "咖啡是散步的小樂趣，正餐還是要好好吃，水也別忘了喝。",
    "今天想先逛梧棲街區，再看看晚餐能不能多搭一樣蔬菜。",
    "如果你也不趕時間，就一起慢慢看海邊的光吧。",
  ],
  "floral-designer": [
    "我是沐白，正在找花藝配色的靈感。這枚藍色髮夾是我最喜歡的小點綴。",
    "白色洋裝配上小小蝴蝶別針，去街角散步也像替日常留一點儀式感。",
    "餐桌上放一朵花，慢慢吃一頓飯，平常的一天也可以很舒服。",
    "我喜歡看當季蔬果的顏色，找靈感，也想想今晚煮什麼。",
  ],
  "fitness-coach": [
    "我是晴夏。把馬尾綁好、帶上水壺，今天也用舒服的步調動一動吧。",
    "運動不是為了抵銷吃過的食物；好好吃飯、休息和活動都值得照顧。",
    "我喜歡在北屯的公園散步和伸展，累了就停下來休息。",
    "出門活動記得補充水分。今天走一小段，也是一個很好的開始。",
  ],
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
  parent: [
    "我會先看看孩子中午吃了什麼，晚餐再換一種主菜和蔬菜搭配。",
    "我們家由我陪孩子安排每天的餐桌，簡單、吃得下，比追求完美更重要。",
    "孩子提到不熟悉的菜色時，我會先聽他描述味道，不急著替他下結論。",
  ],
  "college-volunteer": [
    "我在大學參加食農教育志工，今天來陪孩子認識當季蔬菜。",
    "做活動前要先查清楚資料來源，不能把別天的菜單當成今天的餐點。",
    "孩子的問題常常很有創意，我也會回學校再查資料、下次帶答案來。",
  ],
  "community-resident": [
    "我常來小鎮散步，也會留意市場裡有哪些當季食材。",
    "每個家庭的飲食習慣都不同，互相分享經驗時也要尊重彼此選擇。",
    "今天的校園很有活力，記得慢慢走，和遇見的人聊聊。",
  ],
  "high-school-student": [
    "我放學後會來雜貨店補文具，再順路看看今天國小菜單有什麼。",
    "社團正在整理食農主題報告，我來公園記錄街區裡的植物。",
    "我會先完成今天的課業，再和同學在餐廳碰面，不會一直在街上繞圈。",
  ],
  "university-student": [
    "我正在做校園午餐資料整理，等一下要去餐廳訪談店家如何安排當季食材。",
    "今天的志工行程是先到學校，再去雜貨店核對活動材料清單。",
    "我在公園休息一下，下一站要把整理好的食農資料送到校園。",
  ],
  "office-worker": [
    "午休時間有限，我先去餐廳用餐，之後還要回公司處理下午的工作。",
    "下班前順路到雜貨店採買，晚餐會避開和孩子午餐重複的主菜。",
    "我正在百貨公司辦事，完成清單後就會直接回家，不會在街上閒晃。",
  ],
  "civil-servant": [
    "我先到服務櫃檯確認案件資料，內容完整後才能依流程送下一關。",
    "上午要整理居民反映，午休後再和承辦單位確認進度。",
    "市政資料要留下來源與日期，不能用印象補上還沒確認的內容。",
    "我剛從會議室回來，現在要把決議整理成居民看得懂的說明。",
  ],
  "city-supervisor": [
    "我正在確認跨局處工作的責任與時程，不能只留下口號而沒有追蹤。",
    "居民提出的問題會先分流，再由權責單位回覆並留下處理紀錄。",
    "午餐資訊牽涉教育、健康與公開資料，需要不同單位一起把流程說清楚。",
  ],
  senior: [
    "我固定到公園散步，走完一圈再去雜貨店買今天需要的食材。",
    "下午要接孫子放學，我會先確認校門附近的時間和動線。",
    "慢慢走比較安全，每一站都有要辦的事，不趕時間也不亂穿越道路。",
  ],
  "police-officer": [
    "我依巡邏任務跨區查看校園、商店和人行動線，抵達每一站都有明確勤務。",
    "遇到緊急狀況先確保自身安全，再撥打正確電話並說清楚地點。",
    "放學時段我會特別留意路口與校門，完成勤務後再回警察局紀錄。",
  ],
  firefighter: [
    "今天要到不同街區檢查消防通道，確認完畢才會前往下一個地點。",
    "商店和公共場所的出入口不能堆放物品，保持暢通是日常防災的一部分。",
    "我剛完成校園防災宣導，下一站要回消防局整理器材。",
  ],
  doctor: [
    "我會依照院內與社區健康行程往返，不會把公開菜名當成醫療判斷。",
    "若有嚴重過敏或不適，應由醫療人員依個別狀況評估，不要只靠網路資訊。",
    "今天到校園進行健康衛教，結束後會返回醫院照顧病人。",
  ],
  "sanitation-worker": [
    "我先把落葉集中起來，等等還要繞到公園看看垃圾桶。",
    "早上的街道最安靜，掃地時常會看到麻雀在旁邊等著找食物。",
    "大家把通道留乾淨，推車、輪椅和放學的孩子都會比較好走。",
  ],
  "delivery-worker": [
    "這一箱先送到店家，下一站是學校旁邊的雜貨店。",
    "卸貨時我會把車停好，不擋住行人和店家的出入口。",
    "今天的箱子有點多，我照著路線一站一站送，比較不會漏掉。",
  ],
  mayor: [
    "我正在了解各區家長如何使用午餐資訊，下一站會到校園聽取現場需求。",
    "市府跨局處工作需要可核實的資料，我先到街區蒐集使用者遇到的問題。",
  ],
  "borough-chief": [
    "里辦公處會整理居民反映，我現在去公園查看步行動線，再回辦公處記錄。",
    "家長提出的校園周邊問題要轉給權責單位，我會先確認地點與實際情況。",
  ],
  "city-councilor": [
    "議會監督需要看預算與執行資料，我正在整理家長關心的午餐資訊透明度。",
    "我會把街區蒐集到的問題帶回議會研究，不能只靠口號判斷執行成果。",
  ],
  candidate: [
    "我正在跨區走訪並向居民問候，也會蒐集家長對校園午餐的意見。",
    "今天會走訪市場、小吃店與公共空間；你可以比較每位候選人的公開資料再自行判斷。",
  ],
  "county-magistrate": [
    "縣政行程會走進校園、農村和街區，現場問題要留下可追蹤的處理紀錄。",
    "學校午餐、農業與公共服務需要不同單位協作，不能只靠一句口號。",
  ],
  "county-civil-servant": [
    "我先核對居民提供的地點與資料，再交由權責單位處理。",
    "縣府公開資料要標明日期與來源，還沒確認的內容不能自行補上。",
  ],
  "county-supervisor": [
    "我正在確認跨處室工作的期限與負責人，完成後還要追蹤實際結果。",
    "農業、教育與交通問題常會連在一起，需要把現場情況整理清楚。",
  ],
  "county-councilor": [
    "議會監督要看預算、執行紀錄與居民實際遇到的問題。",
    "我會把街區蒐集到的意見帶回議會研究，也會查核縣府公開資料。",
  ],
  "township-officer": [
    "公所最常處理居民身邊的事情，我會先確認地點再協助轉介。",
    "今天要巡查學校周邊和農路，回公所後再整理處理進度。",
  ],
  farmer: [
    "農田每天都要看水分、土壤和天氣，不能只照固定時間工作。",
    "我介紹的是地方農業日常，不代表今天學校午餐一定使用這裡的食材。",
  ],
  "fruit-farmer": [
    "果園會依季節修枝、疏果與採收，每一段時間的工作都不一樣。",
    "產地故事可以幫助認識食物，但學校當日食材仍要看正式供餐紀錄。",
  ],
  "flower-grower": [
    "花田和苗圃要依品種調整日照與澆水，整理完還要準備出貨。",
    "田尾的園藝不只有鮮花，也有苗木、盆栽與庭園植物。",
  ],
  woodcarver: [
    "木材紋理不同，下刀方向與力道也要跟著調整。",
    "工作室會先把工具收好再開放參觀，雕刻區不能隨意碰觸。",
  ],
  "local-guide": [
    "導覽會分清楚史料、地方記憶與今天看到的現況。",
    "走老街或文化園區時，也要把居民的日常通道留出來。",
  ],
  "forest-ranger": [
    "山區先看天候與步道公告，不進入封閉路段，也不離開安全步道。",
    "巡護除了看步道，也會留意水土、植物和野生動物的變化。",
  ],
  "railway-worker": [
    "軌道與月台周邊有作業範圍，參觀時要留在開放動線內。",
    "老車站和車庫保存了交通記憶，維修紀錄也要一項項確認。",
  ],
  "hospitality-worker": [
    "山區旅宿會留意熱水、步道資訊與晚間安全，讓旅客安心休息。",
    "溫泉區也有居民生活，遊客要遵守開放範圍並保持安靜。",
  ],
  fisher: [
    "漁港工作會看潮汐、風勢和作業區域，岸邊通道不能被堵住。",
    "我介紹的是地方漁業生活，不會把港口漁獲說成今天學校使用的食材。",
  ],
  "oyster-farmer": [
    "潮間帶工作要配合潮汐，牛車和蚵田都有固定安全動線。",
    "遊客留在開放步道，我們依作業規範進入蚵田照顧養殖設施。",
  ],
  "irrigation-worker": [
    "我沿水圳檢查水流、閘門和田間分水，確保通道沒有阻塞。",
    "水圳不是遊戲水池，巡查人員會走工作路線，玩家要留在步道上。",
  ],
  "rice-farmer": [
    "水田要巡水位、看秧苗，也要把田埂缺口一段段補好。",
    "今天巡田、放水與整田埂都有固定順序，作物來源仍以正式供餐紀錄為準。",
  ],
  "vegetable-farmer": [
    "菜園會依作物分畦管理，採收後還要分類、裝箱與留下生產紀錄。",
    "二林、竹塘與大城的田區各有節奏，農路和作業通道要保持暢通。",
  ],
  "grape-grower": [
    "葡萄棚要巡查枝蔓、果串與遮雨設施，採收後再送到集貨場分級。",
    "大村與溪湖一帶的葡萄產業很有特色，但不代表今天學校一定使用這批水果。",
  ],
  "agricultural-technician": [
    "我往返農田、農會與農業處，協助記錄產銷、病蟲害與田間問題。",
    "農業輔導要先看現場與可核實資料，不能把推測寫成產地事實。",
  ],
  "railway-maintainer": [
    "扇形車庫與轉車台有維修作業範圍，參觀請留在開放動線。",
    "我會逐項檢查軌道、機車與轉車台，完成後再填寫維修紀錄。",
  ],
  "sugar-rail-worker": [
    "溪湖糖廠的小火車、倉庫和軌道都有固定檢查行程。",
    "小火車作業區不能穿越；遊客從開放步道看，工作人員走維修路線。",
  ],
  "garden-shop-worker": [
    "田尾的盆栽、苗木和花卉要分區澆水，傍晚還要整理花市與店面。",
    "公路花園的自行車道與園藝店相連，騎車時也要禮讓散步的人。",
  ],
  "produce-market-worker": [
    "果菜進場後要分級、裝箱與核對來源，市場通道不能堆滿貨物。",
    "北斗的市場是農產品集散的一站，今天校園食材仍要看學校正式紀錄。",
  ],
};

const ROLE_LOCAL_SPECIALTIES = Object.freeze({
  "rice-farmer": "水田巡查、放水與田埂整理",
  "vegetable-farmer": "菜園管理、蔬果分級與裝箱",
  "grape-grower": "葡萄棚管理、採收與集貨",
  "flower-grower": "花田、苗木與出貨整理",
  "agricultural-technician": "農業產銷、田間輔導與市場管理",
  "irrigation-worker": "水圳、抽水站與田間分水巡查",
  "oyster-farmer": "潮間帶蚵棚與海牛車作業",
  fisher: "漁港、沿海聚落與作業通道",
  "railway-maintainer": "扇形車庫、機車與轉車台維修",
  "sugar-rail-worker": "糖廠小火車、倉庫與軌道維護",
  "local-guide": "老街、傳統街屋與工藝導覽",
  "garden-shop-worker": "花卉市場、溫室與盆栽照護",
  "produce-market-worker": "果菜分級、裝箱與市場通道管理",
});

const ROLE_WORK_ACTIVITIES = Object.freeze({
  "rice-farmer": ["inspecting-paddy", "releasing-water", "mending-ridge"],
  "vegetable-farmer": ["farming", "harvesting", "sorting-produce"],
  "grape-grower": ["tending-grapes", "harvesting", "sorting-produce"],
  "flower-grower": ["tending-flowers", "harvesting", "sorting-produce"],
  "agricultural-technician": ["patrolling", "checking-irrigation", "serving-market"],
  "irrigation-worker": ["checking-irrigation", "maintaining", "patrolling"],
  "oyster-farmer": ["tending-oysters", "maintaining", "harvesting"],
  fisher: ["maintaining", "patrolling", "sorting-produce"],
  "railway-maintainer": ["repairing-rail", "maintaining", "patrolling"],
  "sugar-rail-worker": ["repairing-rail", "maintaining", "patrolling"],
  "local-guide": ["guiding", "greeting", "patrolling"],
  "garden-shop-worker": ["tending-flowers", "stocking", "serving-market"],
  "produce-market-worker": ["sorting-produce", "stocking", "serving-market"],
});

const DAILY_STORY_TEMPLATES = [
  {
    id: "lunch-board",
    title: "街角的午餐公告",
    text: "{district}的居民正在交換今天的午餐消息，{name}想把資訊整理得更容易看懂。",
    actorRoles: ["student", "parent", "teacher", "nutritionist"],
    choices: [
      { id: "read-with-child", label: "陪孩子一起看今天的菜單", venueType: "convenience-store", outcome: "你陪{name}把菜名一項項讀完，街角多了一段關於午餐的溫柔對話。" },
      { id: "share-dinner-note", label: "幫居民整理晚餐靈感", venueType: "grocery-store", outcome: "你把不重複的晚餐方向寫在公告旁，經過的家長開始交換自己的做法。" },
    ],
  },
  {
    id: "food-garden",
    title: "菜園今天需要幫手",
    text: "{district}的食農小菜園正忙著整理，{name}想在下一段行程前完成一件事。",
    actorRoles: ["student", "gardener", "teacher", "college-volunteer"],
    choices: [
      { id: "tend-garden", label: "先幫忙整理菜園", venueType: "park", outcome: "你和{name}整理好菜床，今天經過公園的人會多停下來看看植物。" },
      { id: "deliver-produce", label: "先把採收送到街區店家", venueType: "snack-shop", outcome: "你幫{name}把採收送到店家，老闆決定在今天的對話裡多介紹一種當季食材。" },
    ],
  },
  {
    id: "community-table",
    title: "公園裡的一張長桌",
    text: "{district}的居民想辦一場小小的食物分享，{name}正在想今天要怎麼安排。",
    actorRoles: ["parent", "senior", "community-resident", "university-student"],
    choices: [
      { id: "park-table", label: "把長桌留在公園樹下", venueType: "park", outcome: "你和{name}把桌子放到樹蔭下，散步的居民陸續停下來聊起今天吃了什麼。" },
      { id: "arcade-backup", label: "先準備騎樓雨備位置", venueType: "convenience-store", outcome: "你陪{name}確認了騎樓動線；即使稍後出現陣雨，活動也能平穩繼續。" },
    ],
  },
];

const WEEKEND_STORY_TEMPLATE = {
  id: "weekend-market",
  title: "週末市場開張了",
  text: "學校今天休息，{district}的孩子、老師和家長改到市場走走；{name}正準備開始今天的行程。",
  actorRoles: ["student", "parent", "teacher", "senior"],
  choices: [
    { id: "help-market-stall", label: "幫忙整理市場攤位", venueType: "snack-shop", outcome: "你和{name}把攤位整理好，市場的居民開始分享各自熟悉的食材與吃法。" },
    { id: "find-seasonal-food", label: "陪孩子找一種當季食物", venueType: "grocery-store", outcome: "你陪{name}沿著市場慢慢找，今天的故事多了一段認識當季食物的旅程。" },
  ],
};

const RAIN_STORY_TEMPLATE = {
  id: "rainy-umbrella",
  title: "騎樓下的雨傘任務",
  text: "短暫陣雨落在{district}，居民陸續躲進騎樓，{name}還在等一把傘。",
  actorRoles: ["student", "parent", "senior", "teacher"],
  choices: [
    { id: "deliver-umbrella", label: "親自把雨傘送過去", givesUmbrella: true, outcome: "你把傘交給{name}，他可以安心走完今天剩下的行程，也記住了這次幫忙。" },
    { id: "leave-at-arcade", label: "請騎樓店家代為保管", venueType: "convenience-store", outcome: "你和店家說好暗號，{name}先在騎樓避雨，稍後會到店裡取傘。" },
  ],
};

const WEEKEND_MARKET_ROLES = new Set([
  "student", "teacher", "nutritionist", "cook", "principal", "parent",
  "high-school-student", "university-student", "senior", "community-resident",
]);
const RAIN_DUTY_ROLES = new Set(["police-officer", "firefighter", "doctor", "crossing-guard"]);

const PLAYER_AVATAR_LABELS = Object.freeze({
  haiyin: "海音",
  mubai: "沐白",
  qingxia: "晴夏",
  xiangye: "向野",
  qingchuan: "青川",
  yueyang: "岳陽",
});

const PLAYER_AVATARS = Object.freeze({
  haiyin: {
    ...CHARACTER_PROFILES.find((profile) => profile.role === "coffee-lover"),
    role: "explorer",
  },
  mubai: {
    ...CHARACTER_PROFILES.find((profile) => profile.role === "floral-designer"),
    role: "explorer",
  },
  qingxia: {
    ...CHARACTER_PROFILES.find((profile) => profile.role === "fitness-coach"),
    role: "explorer",
  },
  xiangye: {
    role: "explorer", skin: "#efbd91", hair: "#263039", hairStyle: "side-part",
    outfitStyle: "adventurer", outfit: "#d9673f", outfitDark: "#304f67", accent: "#f0c454",
    expression: "determined", accessory: "satchel",
  },
  qingchuan: {
    role: "explorer", skin: "#d99a73", hair: "#503a31", hairStyle: "short-wave",
    outfitStyle: "cardigan", outfit: "#e7ddc7", outfitDark: "#58705c", accent: "#c58a4f",
    expression: "thoughtful", accessory: "book",
  },
  yueyang: {
    role: "explorer", skin: "#c98766", hair: "#242a2e", hairStyle: "crop",
    outfitStyle: "athletic-set", outfit: "#5a8494", outfitDark: "#293e58", accent: "#e9bd58",
    expression: "cheerful", accessory: "water-bottle",
  },
});

const state = {
  schools: [],
  neighborSchools: [],
  districtThemes: new Map(),
  neighborCountyThemes: new Map(),
  neighborDistrictThemes: new Map(),
  neighborWorkZones: [],
  townMapManifest: { schemaVersion: 1, placements: [], npcs: [] },
  townMapPreview: { active: false, focus: null, expiresAt: null, error: "" },
  activeNpcIds: new Set(),
  districtGroups: [],
  mapNote: "",
  date: "",
  visited: new Set(),
  keys: new Set(),
  moveTarget: null,
  pendingBikeStationId: "",
  lastTime: performance.now(),
  lastFrameAt: performance.now(),
  frameRequestId: 0,
  frameErrorReported: false,
  lastPromptTarget: null,
  player: {
    x: WIDTH / 2, y: HEIGHT / 2 + 24, size: 16, direction: "down", step: 0, isMoving: false, ridingBike: false,
    homeVenueId: "player-home",
  },
  camera: { x: 0, y: 0 },
  venues: [],
  bikeStations: [],
  npcs: [],
  pets: [],
  birds: [],
  dialogueNpc: null,
  dialogueStep: 0,
  dialogueLines: [],
  dialogueTopicId: "",
  ambientConversation: null,
  comicBubbleFadeTimer: null,
  conversationMemory: [],
  nextConversationAt: performance.now() + 4_000,
  townRumors: [],
  townMoment: null,
  nextTownMomentAt: performance.now() + 12_000,
  townMomentSequence: 0,
  townEvent: null,
  nextTownEventAt: performance.now() + TOWN_EVENT_INITIAL_DELAY_MS,
  townEventSequence: 0,
  activeDistrict: "",
  analyticsVisitedDistricts: new Set(),
  environment: null,
  environmentUpdatedAt: Number.NEGATIVE_INFINITY,
  environmentStatusKey: "",
  isWeekend: false,
  dailyStory: null,
  schoolQuery: "",
  schoolListRendered: false,
  canvasVisible: true,
  ready: false,
  immersiveMode: false,
  nativeFullscreen: false,
  playerAvatarId: loadPlayerAvatarPreference(),
  achievements: {
    loaded: false,
    authenticated: false,
    account: null,
    achievements: [],
    summary: { unlocked: 0, reached: 0, total: 19 },
  },
  achievementLoadPromise: null,
  achievementWriteQueue: Promise.resolve(),
  achievementEventMemory: new Set(),
  achievementToastTimer: 0,
  dailyQuests: {
    loaded: false,
    authenticated: false,
    account: null,
    date: "",
    coinBalance: 0,
    tasks: [],
    summary: { completed: 0, total: 3, bonusCoins: 15, bonusAwarded: false },
    rerollAvailable: false,
  },
  dailyQuestLoadPromise: null,
  dailyQuestWriteQueue: Promise.resolve(),
  dailyQuestEventMemory: new Set(),
  dailyQuestSessionId: typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  dailyQuestEventSequence: 0,
  dailyWalkPending: 0,
  dailyBridgeSides: new Map(),
};

const townMusic = {
  context: null,
  master: null,
  timer: null,
  phrase: 0,
  enabled: false,
  generation: 0,
};

init();

async function init() {
  bindEvents();
  try {
    setLoadingProgress(8, "正在連接小鎮資料…");
    await nextPaint();
    const accountPromise = loadAccountPreference().then((account) => {
      syncTownAccountUI(account);
      return account;
    });
    state.achievementLoadPromise = loadTownAchievements();
    state.dailyQuestLoadPromise = loadTownDailyQuests();
    const [schools, themePayload, neighborCountyPayload, townMapManifest] = await Promise.all([
      loadSchools(),
      loadDistrictThemes(),
      loadNeighborCountyThemes(),
      loadTownMapManifest(),
    ]);
    setLoadingProgress(38, "學校與行政區資料已到齊，正在鋪設街道…");
    await nextPaint();
    configureDistrictThemes(themePayload);
    configureNeighborCountyThemes(neighborCountyPayload);
    state.townMapManifest = townMapManifest;
    syncTownMapPreviewUi();
    updateTownEnvironment(performance.now(), true);
    state.isWeekend = isTaichungWeekend(state.environment.clock);
    const themedDistricts = new Set(DISTRICT_DISPLAY_ORDER);
    state.schools = createSchoolLayouts(schools.filter(
      (school) => school.city === SHOWCASE_CITY && themedDistricts.has(school.district),
    ));
    const neighborSourceSchools = schools.filter((school) => NEIGHBOR_COUNTY_CITIES.has(school.city));
    state.neighborSchools = createNeighborSchoolLayouts(neighborSourceSchools);
    if (!state.schools.length) throw new Error("找不到臺中市 29 區學校資料");
    if (state.neighborSchools.length !== neighborSourceSchools.length) throw new Error("苗栗與彰化國小地圖名冊不完整");
    syncCurrentMealDate(state.environment);
    updateProgress();
    setLoadingProgress(58, "正在放置公園、地標、醫院與商場…");
    createTownVenues();
    applyTownMapPlacements();
    createBikeStations();
    await nextPaint();
    await Promise.race([
      accountPromise,
      new Promise((resolve) => window.setTimeout(() => resolve(null), 650)),
    ]);
    placePlayerAtHome();
    placePlayerAtTownMapPreview();
    updateCamera(true);
    setLoadingProgress(76, "正在安排居民、職務與日常行程…");
    createTownCharacters();
    buildTownRelationships();
    await nextPaint();
    setLoadingProgress(91, "正在讓鳥群、故事與街區活動就位…");
    createTownBirds();
    setupDailyStory();
    renderDailyStory();
    setLoadingProgress(100, "小鎮準備好了，出發探索吧！");
    await nextPaint();
    state.ready = true;
    refs.app.setAttribute("aria-busy", "false");
    refs.loading.classList.add("is-ready");
    scheduleSchoolListRender();
    canvas.focus({ preventScroll: true });
    if (state.activeDistrict) state.analyticsVisitedDistricts.add(state.activeDistrict);
    trackTownEvent("lunch_town_viewed", {
      district: state.activeDistrict,
      menu_date: state.date,
      player_style: state.playerAvatarId,
    });
    void state.achievementLoadPromise.then(() => {
      void recordAchievementEvent("town_visit", state.environment?.dateKey || state.date);
      if (state.activeDistrict) void recordAchievementEvent("district_visit", state.activeDistrict);
    });
    announce(`午餐小鎮已建立，臺中、苗栗與彰化共 ${state.schools.length + state.neighborSchools.length} 間午餐學校，並有 ${state.venues.length} 處建築、${state.bikeStations.length} 處 YouBike 站與 ${state.npcs.length} 位跨區行動角色。`);
  } catch (error) {
    console.error(error);
    refs.loadingTitle.textContent = "午餐小鎮暫時無法建立";
    refs.loadingStep.textContent = error instanceof Error ? error.message : "讀取資料時發生錯誤";
    refs.app.setAttribute("aria-busy", "false");
  }
  scheduleTownFrame();
}

function setLoadingProgress(percent, message) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  refs.loadingStep.textContent = message;
  refs.loadingProgressBar.style.width = `${value}%`;
  refs.loadingProgress.setAttribute("aria-valuenow", String(value));
  refs.loadingPercent.textContent = `${value}%`;
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function scheduleSchoolListRender() {
  const render = () => {
    if (!state.schoolListRendered) renderSchoolList();
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(render, { timeout: 2800 });
  else window.setTimeout(render, 900);
}

function bindEvents() {
  window.addEventListener("keydown", (event) => {
    const isFormControl = event.target instanceof HTMLElement
      && Boolean(event.target.closest("input, select, textarea"));
    if (event.key === "Escape" && refs.dialog.open) {
      refs.dialog.close();
      return;
    }
    if (event.key === "Escape" && state.dialogueNpc) {
      closeNpcDialogue();
      return;
    }
    if (event.key === "Escape" && state.townEvent) {
      finishTownEvent();
      return;
    }
    if (event.key === "Escape" && refs.questPanel.classList.contains("is-open")) {
      setQuestPanelOpen(false, true);
      return;
    }
    if (event.key === "Escape" && state.immersiveMode && !fullscreenElement()) {
      setImmersiveMode(false);
      return;
    }
    if (isFormControl) return;
    const direction = directionForKey(event.key);
    if (direction) {
      event.preventDefault();
      state.keys.add(direction);
      state.moveTarget = null;
      state.pendingBikeStationId = "";
      ensureTownFrameRunning();
    }
    if (["Enter", " "].includes(event.key) && !refs.dialog.open) {
      event.preventDefault();
      if (state.dialogueNpc) advanceNpcDialogue();
      else interactWithNearbyTarget();
    }
  });
  window.addEventListener("keyup", (event) => {
    const direction = directionForKey(event.key);
    if (direction) state.keys.delete(direction);
  });
  window.addEventListener("blur", () => state.keys.clear());
  canvas.addEventListener("pointerdown", (event) => {
    canvas.focus({ preventScroll: true });
    ensureTownFrameRunning();
    if (state.townEvent) {
      announce("請先在街區事件面板選擇如何回應。 ");
      return;
    }
    const point = canvasPoint(event);
    state.pendingBikeStationId = "";
    const npcRadius = canvasWorldUnitsForCssPixels(mobileLayoutQuery.matches ? 28 : 22);
    const hitPadding = canvasWorldUnitsForCssPixels(mobileLayoutQuery.matches ? 14 : 4);
    if (nearbyTownMoment(point)) {
      resolveTownMoment();
      return;
    }
    const bikeStation = state.bikeStations.find((candidate) => pointInExpandedRect(point, bikeStationHitRect(candidate), hitPadding));
    if (bikeStation) {
      const accessPoint = bikeStationAccessPoint(bikeStation);
      if (Math.hypot(state.player.x - accessPoint.x, state.player.y - accessPoint.y) < 72) {
        interactWithBikeStation(bikeStation, "map_click");
      } else {
        state.pendingBikeStationId = bikeStation.id;
        state.moveTarget = accessPoint;
        announce(`正前往${bikeStation.label}，抵達後會自動${state.player.ridingBike ? "還車" : "租車"}。`);
      }
      return;
    }
    const npc = state.npcs
      .filter((candidate) => !candidate.insideVenueId && !candidate.ridingBike)
      .map((candidate) => ({ candidate, distance: Math.hypot(point.x - candidate.x, point.y - candidate.y) }))
      .filter((item) => item.distance < npcRadius)
      .sort((first, second) => first.distance - second.distance)[0]?.candidate;
    if (npc) {
      openNpcDialogue(npc, "map_click");
      return;
    }
    const school = state.schools.find((candidate) => pointInExpandedRect(point, candidate.layout, hitPadding));
    if (school) {
      openSchool(school, "map_click");
      return;
    }
    const neighborSchool = state.neighborSchools.find((candidate) => pointInExpandedRect(point, candidate.layout, hitPadding));
    if (neighborSchool) {
      openNeighborSchool(neighborSchool, "map_click");
      return;
    }
    const venue = venueAtPoint(point, hitPadding);
    if (venue) {
      openVenue(venue, "map_click");
      return;
    }
    state.moveTarget = point;
  });
  refs.dialogClose.addEventListener("click", () => refs.dialog.close());
  refs.dialogBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-daily-dish]");
    if (!button) return;
    refs.dialogBody.querySelectorAll("button[data-daily-dish]").forEach((candidate) => {
      candidate.setAttribute("aria-pressed", String(candidate === button));
      candidate.textContent = candidate === button ? "已選這一道" : "今天想吃";
    });
    void recordDailyQuestEvent("dish_pick", button.dataset.dailyDish, 1);
    announce(townText(`已選擇${button.dataset.dishName || "這道菜"}作為今天感興趣的菜色。`));
  });
  refs.dialog.addEventListener("click", (event) => {
    if (event.target === refs.dialog) refs.dialog.close();
  });
  refs.npcNext.addEventListener("click", advanceNpcDialogue);
  refs.npcClose.addEventListener("click", closeNpcDialogue);
  refs.townEventChoices.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-event-choice]");
    if (button) chooseTownEventAction(button.dataset.eventChoice);
  });
  refs.townEventContinue.addEventListener("click", finishTownEvent);
  refs.mobilePad.querySelectorAll("button[data-direction]").forEach((button) => {
    const direction = button.dataset.direction;
    const start = (event) => {
      event.preventDefault();
      state.keys.add(direction);
      state.moveTarget = null;
      state.pendingBikeStationId = "";
      ensureTownFrameRunning();
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
  refs.mobileExploreButton.addEventListener("click", () => {
    setQuestPanelOpen(!refs.questPanel.classList.contains("is-open"));
  });
  refs.fullscreenToggle.addEventListener("click", toggleImmersiveMode);
  refs.gameScreen.addEventListener("selectstart", (event) => event.preventDefault());
  refs.gameScreen.addEventListener("contextmenu", (event) => {
    if (event.target instanceof Element && event.target.closest("button, canvas")) {
      event.preventDefault();
    }
  });
  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
  refs.questPanelClose.addEventListener("click", () => setQuestPanelOpen(false, true));
  refs.achievementExpandAll.addEventListener("click", () => setAchievementCategoriesExpanded(true));
  refs.achievementCollapseAll.addEventListener("click", () => setAchievementCategoriesExpanded(false));
  refs.dailyQuestList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-daily-reroll]");
    if (button) void rerollDailyQuest(button.dataset.dailyReroll);
  });
  refs.schoolSearch.addEventListener("input", () => {
    state.schoolQuery = refs.schoolSearch.value.trim();
    renderSchoolList();
  });
  refs.schoolFinder.addEventListener("toggle", () => {
    if (refs.schoolFinder.open && !state.schoolListRendered) renderSchoolList();
  });
  window.addEventListener("accountpanelchange", (event) => {
    syncTownAccountUI(event.detail?.account);
    state.dailyQuestEventMemory.clear();
    state.dailyBridgeSides.clear();
    state.dailyWalkPending = 0;
    state.achievementLoadPromise = loadTownAchievements();
    state.dailyQuestLoadPromise = loadTownDailyQuests();
  });
  mobileLayoutQuery.addEventListener("change", () => {
    configureCanvasViewport();
    syncTownOptionsDisclosure();
  });
  if ("IntersectionObserver" in window) {
    const canvasObserver = new IntersectionObserver((entries) => {
      state.canvasVisible = entries[0]?.isIntersecting ?? true;
      state.lastTime = performance.now();
      if (!state.canvasVisible) state.keys.clear();
    }, { rootMargin: "120px" });
    canvasObserver.observe(canvas);
  }
  refs.playerAvatarButtons.forEach((button) => {
    button.addEventListener("click", () => setPlayerAvatar(button.dataset.playerAvatar));
  });
  refs.dailyStoryChoices.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-story-choice]");
    if (button) chooseDailyStory(button.dataset.storyChoice);
  });
  refs.musicToggle.addEventListener("click", toggleTownMusic);
  document.addEventListener("visibilitychange", () => {
    state.keys.clear();
    state.lastTime = performance.now();
    if (townMusic.context && townMusic.enabled) {
      if (document.hidden) townMusic.context.suspend();
      else townMusic.context.resume();
    }
  });
  syncTownOptionsDisclosure();
  syncPlayerAvatarButtons();
}

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

async function toggleImmersiveMode() {
  if (state.immersiveMode) {
    const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;
    if (fullscreenElement() && exitFullscreen) {
      try {
        await exitFullscreen.call(document);
      } catch {
        setImmersiveMode(false);
      }
    } else {
      setImmersiveMode(false);
    }
    return;
  }

  setQuestPanelOpen(false);
  const fullscreenTarget = document.documentElement;
  const requestFullscreen = fullscreenTarget.requestFullscreen || fullscreenTarget.webkitRequestFullscreen;
  if (requestFullscreen) {
    try {
      const request = fullscreenTarget.requestFullscreen
        ? requestFullscreen.call(fullscreenTarget, { navigationUI: "hide" })
        : requestFullscreen.call(fullscreenTarget);
      setImmersiveMode(true);
      await request;
      state.nativeFullscreen = true;
      return;
    } catch {
      state.nativeFullscreen = false;
    }
  }
  setImmersiveMode(true);
}

function handleFullscreenChange() {
  if (fullscreenElement()) {
    state.nativeFullscreen = true;
    setImmersiveMode(true);
  } else if (state.nativeFullscreen) {
    state.nativeFullscreen = false;
    setImmersiveMode(false);
  }
}

function setImmersiveMode(active) {
  state.immersiveMode = active;
  refs.gameCard.classList.toggle("is-immersive", active);
  document.body.classList.toggle("town-immersive", active);
  refs.fullscreenToggle.setAttribute("aria-pressed", String(active));
  refs.fullscreenToggle.setAttribute("aria-label", active ? "離開全螢幕模式" : "進入全螢幕模式");
  refs.fullscreenToggle.innerHTML = active
    ? '<span aria-hidden="true">×</span><span>離開</span>'
    : '<span aria-hidden="true">⛶</span><span>全螢幕</span>';
  state.keys.clear();
  state.moveTarget = null;
  state.pendingBikeStationId = "";
  window.requestAnimationFrame(() => {
    updateCamera(true);
    canvas.focus({ preventScroll: true });
  });
  announce(active ? "已進入全螢幕遊戲模式。" : "已離開全螢幕遊戲模式。");
}

function syncTownOptionsDisclosure() {
  if (mobileLayoutQuery.matches) refs.townOptions.removeAttribute("open");
  else refs.townOptions.setAttribute("open", "");
}

function configureCanvasViewport() {
  const viewport = mobileLayoutQuery.matches ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT;
  if (WIDTH === viewport.width && HEIGHT === viewport.height) return;
  WIDTH = viewport.width;
  HEIGHT = viewport.height;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  if (!mobileLayoutQuery.matches) setQuestPanelOpen(false);
  state.lastPromptTarget = null;
  updateCamera(true);
  updateNearbyPrompt();
}

function setQuestPanelOpen(open, restoreFocus = false) {
  if (!mobileLayoutQuery.matches && open) return;
  refs.questPanel.classList.toggle("is-open", open);
  refs.mobileExploreButton.setAttribute("aria-expanded", String(open));
  if (open) {
    state.keys.clear();
    state.moveTarget = null;
    state.pendingBikeStationId = "";
    refs.questPanel.focus({ preventScroll: true });
    announce("已開啟每日任務與臺中小鎮成就手冊。");
  } else if (restoreFocus) {
    refs.mobileExploreButton.focus({ preventScroll: true });
  }
}

async function toggleTownMusic() {
  if (townMusic.enabled) {
    stopTownMusic();
    trackTownEvent("lunch_town_music_toggled", { enabled: "off" });
    return;
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    announce("這個瀏覽器目前無法播放小鎮背景音樂。");
    return;
  }
  townMusic.context = new AudioContextClass();
  townMusic.master = townMusic.context.createGain();
  townMusic.master.gain.setValueAtTime(0.0001, townMusic.context.currentTime);
  townMusic.master.gain.exponentialRampToValueAtTime(0.12, townMusic.context.currentTime + 0.8);
  townMusic.master.connect(townMusic.context.destination);
  townMusic.enabled = true;
  townMusic.generation += 1;
  townMusic.phrase = 0;
  refs.musicToggle.setAttribute("aria-pressed", "true");
  refs.musicToggle.setAttribute("aria-label", "關閉小鎮背景音樂");
  refs.musicToggle.textContent = "♫ 音樂：開";
  await townMusic.context.resume();
  trackTownEvent("lunch_town_music_toggled", { enabled: "on" });
  scheduleTownMusic(townMusic.generation);
  announce("已開啟原創像素小鎮背景音樂。");
}

function stopTownMusic() {
  townMusic.enabled = false;
  townMusic.generation += 1;
  window.clearTimeout(townMusic.timer);
  refs.musicToggle.setAttribute("aria-pressed", "false");
  refs.musicToggle.setAttribute("aria-label", "開啟小鎮背景音樂");
  refs.musicToggle.textContent = "♫ 音樂：關";
  const audioContext = townMusic.context;
  const master = townMusic.master;
  if (audioContext && master) {
    const now = audioContext.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    window.setTimeout(() => audioContext.close(), 420);
  }
  townMusic.context = null;
  townMusic.master = null;
  announce("已關閉小鎮背景音樂。");
}

function scheduleTownMusic(generation) {
  if (!townMusic.enabled || generation !== townMusic.generation || !townMusic.context) return;
  const progressions = [
    [261.63, 329.63, 392.0],
    [220.0, 261.63, 329.63],
    [174.61, 220.0, 293.66],
    [196.0, 246.94, 329.63],
  ];
  const melodies = [
    [659.25, 523.25, 587.33],
    [493.88, 440.0, 523.25],
    [392.0, 440.0, 349.23],
    [493.88, 587.33, 523.25],
  ];
  const phraseIndex = townMusic.phrase % progressions.length;
  const start = townMusic.context.currentTime + 0.08;
  progressions[phraseIndex].forEach((frequency, index) => {
    playTownTone(frequency / 2, start + index * 0.12, 4.8 - index * 0.2, "sine", 0.07);
  });
  melodies[phraseIndex].forEach((frequency, index) => {
    playTownTone(frequency, start + 1.0 + index * 1.05, 1.7, index % 2 ? "sine" : "triangle", 0.045);
  });
  townMusic.phrase += 1;
  townMusic.timer = window.setTimeout(() => scheduleTownMusic(generation), 6100);
}

function playTownTone(frequency, start, duration, type, volume) {
  const audioContext = townMusic.context;
  if (!audioContext || !townMusic.master) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(townMusic.master);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

function loadPlayerAvatarPreference() {
  try {
    const value = localStorage.getItem(PLAYER_AVATAR_STORAGE_KEY);
    if (PLAYER_AVATARS[value]) return value;
    return localStorage.getItem(LEGACY_PLAYER_STYLE_STORAGE_KEY) === "male" ? "xiangye" : "qingxia";
  } catch {
    return "qingxia";
  }
}

function setPlayerAvatar(avatarId) {
  if (!PLAYER_AVATARS[avatarId]) return;
  const changed = state.playerAvatarId !== avatarId;
  state.playerAvatarId = avatarId;
  try {
    localStorage.setItem(PLAYER_AVATAR_STORAGE_KEY, avatarId);
  } catch {
    // 外型偏好即使無法寫入裝置，仍可在本次遊玩中切換。
  }
  syncPlayerAvatarButtons();
  if (changed) trackTownEvent("lunch_town_player_style_changed", { player_style: avatarId });
  announce(`玩家已切換為${PLAYER_AVATAR_LABELS[avatarId]}造型。`);
  canvas.focus({ preventScroll: true });
}

function syncPlayerAvatarButtons() {
  refs.playerAvatarButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.playerAvatar === state.playerAvatarId));
  });
}

async function loadSchools() {
  const endpoints = ["/data/schools.json", "/api/schools"];
  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store" });
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

async function loadNeighborCountyThemes() {
  const response = await fetch("./neighbor-county-themes.json?v=20261105-player-civic", {
    headers: { Accept: "application/json" },
    cache: "no-cache",
  });
  if (!response.ok) throw new Error(`鄰近縣市特色資料回傳 ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.counties) || payload.counties.length !== 2) {
    throw new Error("苗栗與彰化特色資料格式不正確");
  }
  return payload;
}

async function loadTownMapManifest() {
  const previewToken = takeTownMapPreviewToken();
  if (previewToken) {
    try {
      const response = await fetch("/api/lunch-town/map/preview", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ token: previewToken }),
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `地圖預覽回傳 ${response.status}`);
      const manifest = validatedTownMapManifest(payload?.manifest);
      state.townMapPreview = {
        active: true,
        focus: payload?.focus || null,
        expiresAt: payload?.expiresAt || null,
        error: "",
      };
      return manifest;
    } catch (error) {
      state.townMapPreview.error = error instanceof Error ? error.message : "草稿預覽無法載入。";
      console.warn("午餐小鎮草稿預覽無法載入，改用正式地圖", error);
    }
  }
  return loadPublishedTownMapManifest();
}

function takeTownMapPreviewToken() {
  const token = String(window.__lunchTownMapPreviewToken || new URLSearchParams(window.location.hash.slice(1)).get("map-preview") || "");
  delete window.__lunchTownMapPreviewToken;
  if (window.location.hash) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : "";
}

function validatedTownMapManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.placements) || !Array.isArray(manifest.npcs)) {
    throw new Error("地圖設定格式不正確");
  }
  return manifest;
}

async function loadPublishedTownMapManifest() {
  try {
    const response = await fetch("/api/lunch-town/map", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`地圖設定回傳 ${response.status}`);
    const payload = await response.json();
    return validatedTownMapManifest(payload?.manifest);
  } catch (error) {
    console.warn("午餐小鎮將使用內建地圖設定", error);
    return { schemaVersion: 1, placements: [], npcs: [] };
  }
}

function syncTownMapPreviewUi() {
  if (!refs.mapPreviewBanner || !refs.mapPreviewStatus) return;
  refs.mapPreviewBanner.hidden = !state.townMapPreview.active && !state.townMapPreview.error;
  refs.mapPreviewBanner.classList.toggle("is-error", Boolean(state.townMapPreview.error));
  if (state.townMapPreview.active) {
    const focus = state.townMapPreview.focus;
    refs.mapPreviewStatus.textContent = focus
      ? `${townText(focus.city)}・${townText(focus.district)}｜${townText("不會變更正式地圖，也不會記錄任務、成就或分析事件。")}`
      : townText("不會變更正式地圖，也不會記錄任務、成就或分析事件。");
  } else {
    refs.mapPreviewStatus.textContent = `${townText("草稿預覽無法載入，現在顯示正式地圖。")} ${state.townMapPreview.error}`.trim();
  }
}

function configureDistrictThemes(payload) {
  state.districtGroups = Array.isArray(payload.groups) ? payload.groups : [];
  state.mapNote = String(payload.mapNote || "");
  const occupiedGridCells = new Set();
  payload.districts.forEach((theme) => {
    if (!Array.isArray(theme.landmarks) || !theme.landmarks.length
      || theme.landmarks.some((landmark) => !landmark.name || !landmark.style)
      || !theme.snackShop?.name || !theme.snackShop?.specialty) {
      throw new Error(`${theme.name}的地標或小吃資料不完整`);
    }
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

function configureNeighborCountyThemes(payload) {
  for (const countyTheme of payload.counties) {
    const county = neighborCountyById(countyTheme.id);
    if (!county || county.name !== countyTheme.name) throw new Error(`${countyTheme.name || countyTheme.id}縣市資料不正確`);
    const rows = Number(countyTheme.rows);
    if (!Number.isInteger(rows) || rows < 1) throw new Error(`${county.name}行政區列數不正確`);
    const expectedDistrictCount = county.id === "miaoli" ? 18 : 26;
    if (!Array.isArray(countyTheme.districts) || countyTheme.districts.length !== expectedDistrictCount) {
      throw new Error(`${county.name}行政區數量不正確`);
    }
    const occupied = new Set();
    const { cellWidth, cellHeight } = neighborCountyGridMetrics(county, rows);
    countyTheme.districts.forEach((districtTheme) => {
      const [column, row] = districtTheme.grid || [];
      if (!Number.isInteger(column) || !Number.isInteger(row)
        || column < 0 || column >= NEIGHBOR_COUNTY_DISTRICT_COLUMNS
        || row < 0 || row >= rows) {
        throw new Error(`${districtTheme.name}行政區方位座標不正確`);
      }
      const gridKey = `${column},${row}`;
      if (occupied.has(gridKey)) throw new Error(`${districtTheme.name}行政區方位座標重複`);
      occupied.add(gridKey);
      const zone = {
        x: county.x + NEIGHBOR_COUNTY_MARGIN_X + column * cellWidth + NEIGHBOR_COUNTY_ZONE_GAP / 2,
        y: county.y + NEIGHBOR_COUNTY_HEADER_HEIGHT + row * cellHeight + NEIGHBOR_COUNTY_ZONE_GAP / 2,
        w: cellWidth - NEIGHBOR_COUNTY_ZONE_GAP,
        h: cellHeight - NEIGHBOR_COUNTY_ZONE_GAP,
        color: districtTheme.color,
        countyId: county.id,
        countyName: county.name,
        terrain: districtTheme.terrain,
      };
      state.neighborDistrictThemes.set(districtTheme.name, { ...districtTheme, zone, county });
    });
    state.neighborCountyThemes.set(county.id, countyTheme);
  }
}

function neighborCountyGridMetrics(county, rows) {
  const left = county.x + NEIGHBOR_COUNTY_MARGIN_X;
  const top = county.y + NEIGHBOR_COUNTY_HEADER_HEIGHT;
  const usableWidth = county.w - NEIGHBOR_COUNTY_MARGIN_X * 2;
  const usableHeight = county.h - NEIGHBOR_COUNTY_HEADER_HEIGHT - NEIGHBOR_COUNTY_FOOTER_HEIGHT;
  return {
    left,
    top,
    right: left + usableWidth,
    bottom: top + usableHeight,
    cellWidth: usableWidth / NEIGHBOR_COUNTY_DISTRICT_COLUMNS,
    cellHeight: usableHeight / rows,
  };
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

function syncTownAccountUI(account) {
  const authenticated = account?.authenticated === true;
  refs.accountAction.classList.toggle("is-authenticated", authenticated);
}

async function loadTownDailyQuests() {
  refs.dailyQuestStatus.textContent = "正在讀取每日任務…";
  try {
    const response = await fetch("/api/account/town-daily-quests", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`每日任務 API 回傳 ${response.status}`);
    const payload = await response.json();
    applyTownDailyQuestPayload(payload);
    return payload;
  } catch (error) {
    console.warn("Unable to load town daily quests", error);
    state.dailyQuests.loaded = true;
    refs.dailyQuestStatus.textContent = "每日任務暫時無法連線，仍可繼續探索；稍後重新載入即可同步。";
    return null;
  }
}

function applyTownDailyQuestPayload(payload) {
  state.dailyQuests = {
    loaded: true,
    authenticated: payload?.authenticated === true,
    account: payload?.account || null,
    date: String(payload?.date || ""),
    coinBalance: Math.max(0, Number(payload?.coinBalance) || 0),
    tasks: Array.isArray(payload?.tasks) ? payload.tasks : [],
    summary: payload?.summary || { completed: 0, total: 3, bonusCoins: 15, bonusAwarded: false },
    rerollAvailable: payload?.rerollAvailable === true,
  };
  syncTownAccountUI({ authenticated: state.dailyQuests.authenticated });
  renderTownDailyQuests();
}

function renderTownDailyQuests() {
  const quests = state.dailyQuests;
  const authenticated = quests.authenticated;
  const completed = Number(quests.summary.completed) || 0;
  const total = Number(quests.summary.total) || 3;
  refs.dailyQuestDate.textContent = quests.date ? formatDate(quests.date) : "今日任務";
  refs.dailyCoinBalance.textContent = String(quests.coinBalance);
  refs.dailyQuestProgress.textContent = `${completed} / ${total}`;
  refs.dailyQuestStatus.textContent = authenticated
    ? townText(`今日已完成 ${completed} / ${total} 題，金幣餘額 ${quests.coinBalance}。`)
    : townText("登入後才會保存任務進度與金幣；目前可以先預覽今天的三題。");
  refs.dailyQuestList.innerHTML = quests.tasks.map((task) => {
    const taskComplete = task.completed === true;
    const requirements = Array.isArray(task.requirements) ? task.requirements : [];
    return `
      <article class="daily-quest-card${taskComplete ? " is-complete" : ""}">
        <header>
          <span class="daily-quest-card-icon" aria-hidden="true">${escapeHtml(task.icon || "任")}</span>
          <div class="daily-quest-card-title">
            <small>${escapeHtml(townText(task.categoryLabel || "每日任務"))}</small>
            <strong>${escapeHtml(townText(task.title || "每日任務"))}</strong>
          </div>
          <span class="daily-quest-reward">${taskComplete ? `✓ ${townText("已完成")}` : `+${Number(task.rewardCoins) || 0} ${townText("金幣")}`}</span>
        </header>
        <p>${escapeHtml(townText(task.description || ""))}</p>
        <div class="daily-quest-requirements">
          ${requirements.map((item) => `
            <div class="daily-quest-requirement${Number(item.progress) >= Number(item.target) ? " is-complete" : ""}">
              <span>${escapeHtml(townText(item.label || "任務步驟"))}</span>
              <span>${Number(item.progress) || 0} / ${Number(item.target) || 1}</span>
            </div>
          `).join("")}
        </div>
        ${authenticated && quests.rerollAvailable && !taskComplete
          ? `<button class="daily-quest-reroll" type="button" data-daily-reroll="${escapeAttribute(task.id)}">${escapeHtml(townText("免費更換這一題"))}</button>`
          : ""}
      </article>
    `;
  }).join("");
}

function dailyQuestInstance(prefix) {
  state.dailyQuestEventSequence += 1;
  return `${prefix}:${state.dailyQuestSessionId}:${state.dailyQuestEventSequence}`.replace(/[^a-zA-Z0-9:_-]/g, "-").slice(0, 120);
}

async function recordDailyQuestEvent(eventType, subjectId, value = 1, eventKey = `${eventType}:${subjectId}`) {
  if (state.townMapPreview.active) return;
  if (!state.dailyQuests.loaded && state.dailyQuestLoadPromise) await state.dailyQuestLoadPromise;
  if (!state.dailyQuests.authenticated) return;
  const safeEventKey = String(eventKey).replace(/[^a-zA-Z0-9:_-]/g, "-").slice(0, 120);
  if (state.dailyQuestEventMemory.has(safeEventKey)) return;
  state.dailyQuestEventMemory.add(safeEventKey);
  state.dailyQuestWriteQueue = state.dailyQuestWriteQueue.then(async () => {
    try {
      const response = await fetch("/api/account/town-daily-quests", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ eventType, subjectId: String(subjectId), value, eventKey: safeEventKey }),
      });
      if (response.status === 401) {
        state.dailyQuestEventMemory.delete(safeEventKey);
        await loadTownDailyQuests();
        return;
      }
      if (!response.ok) throw new Error(`每日任務 API 回傳 ${response.status}`);
      const payload = await response.json();
      applyTownDailyQuestPayload(payload);
      for (const item of Array.isArray(payload.newlyRewarded) ? payload.newlyRewarded : []) {
        showTownToast("每日任務完成", `${townText(item.title)} +${Number(item.rewardCoins) || 0} ${townText("金幣")}`);
        trackTownEvent("lunch_town_daily_quest_completed", { task_id: item.id, category: item.category });
      }
      if (payload.allClearRewarded) {
        showTownToast("今日三題全完成", `${townText("額外獲得")} ${Number(payload.summary?.bonusCoins) || 15} ${townText("金幣")}`);
        trackTownEvent("lunch_town_daily_all_clear", { task_date: payload.date });
      }
    } catch (error) {
      state.dailyQuestEventMemory.delete(safeEventKey);
      console.warn("Unable to save town daily quest event", error);
      refs.dailyQuestStatus.textContent = "這次任務進度尚未同步，稍後再操作一次即可重試。";
    }
  });
  await state.dailyQuestWriteQueue;
}

async function rerollDailyQuest(taskId) {
  if (!state.dailyQuests.authenticated || !state.dailyQuests.rerollAvailable) return;
  refs.dailyQuestList.querySelectorAll("button[data-daily-reroll]").forEach((button) => { button.disabled = true; });
  try {
    const response = await fetch("/api/account/town-daily-quests", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ action: "reroll", taskId }),
    });
    if (!response.ok) throw new Error(`每日任務 API 回傳 ${response.status}`);
    const payload = await response.json();
    applyTownDailyQuestPayload(payload);
    announce("已免費更換一題每日任務，今天不能再次更換。");
  } catch (error) {
    console.warn("Unable to reroll town daily quest", error);
    refs.dailyQuestStatus.textContent = "目前無法更換任務，請稍後再試。";
    renderTownDailyQuests();
  }
}

async function loadTownAchievements() {
  refs.achievementStatus.textContent = "正在讀取成就…";
  try {
    const response = await fetch("/api/account/town-achievements", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`成就 API 回傳 ${response.status}`);
    const payload = await response.json();
    applyTownAchievementPayload(payload);
    return payload;
  } catch (error) {
    console.warn("Unable to load town achievements", error);
    state.achievements.loaded = true;
    refs.achievementAccountCard.classList.remove("is-loading");
    refs.achievementStatus.textContent = "成就手冊暫時無法連線，遊戲仍可繼續；稍後重新載入即可同步。";
    return null;
  }
}

function applyTownAchievementPayload(payload) {
  state.achievements = {
    loaded: true,
    authenticated: payload?.authenticated === true,
    account: payload?.account || null,
    achievements: Array.isArray(payload?.achievements) ? payload.achievements : [],
    summary: payload?.summary || { unlocked: 0, reached: 0, total: 19 },
  };
  syncTownAccountUI({ authenticated: state.achievements.authenticated });
  renderTownAchievements();
}

function renderTownAchievements() {
  const achievementState = state.achievements;
  const authenticated = achievementState.authenticated;
  const displayName = achievementState.account?.displayName || "家庭帳號";
  refs.achievementAccountCard.classList.remove("is-loading");
  refs.achievementAccountCard.classList.toggle("is-authenticated", authenticated);
  refs.achievementAccountEyebrow.textContent = authenticated ? "已綁定家庭帳號" : "未註冊時只供預覽";
  refs.achievementAccountTitle.textContent = authenticated ? `${displayName}的任務與成就` : "免費註冊，讓每次探索都算數";
  refs.achievementAccountText.textContent = authenticated
    ? "每日任務、金幣與成就已安全綁定帳號，可在其他裝置接著遊玩。"
    : "登入前不會保存任務、金幣或成就；免費建立家庭帳號後即可跨裝置保留。";
  refs.achievementAccountLink.textContent = authenticated ? "家庭帳號設定" : "登入／免費註冊・保存進度";
  refs.achievementAccountLink.setAttribute("aria-haspopup", "dialog");

  const total = Math.max(1, Number(achievementState.summary.total) || achievementState.achievements.length || 19);
  const unlocked = Number(achievementState.summary.unlocked) || 0;
  refs.achievementProgress.textContent = `${unlocked} / ${total}`;
  refs.achievementProgressBar.style.width = `${Math.min(100, unlocked / total * 100)}%`;
  refs.achievementMeter.setAttribute("aria-valuemax", String(total));
  refs.achievementMeter.setAttribute("aria-valuenow", String(unlocked));
  refs.achievementStatus.textContent = authenticated
    ? `已保存 ${unlocked} 項成就；完成條件後會自動解鎖。`
    : "先看看想挑戰的目標；登入後才會開始永久累積。";

  const renderedCategories = [...refs.achievementList.querySelectorAll("details[data-achievement-category]")];
  const hadRenderedCategories = renderedCategories.length > 0;
  const expandedCategories = new Set(
    renderedCategories.filter((category) => category.open).map((category) => category.dataset.achievementCategory),
  );
  const categoryOrder = ["return", "explore", "civic", "community"];
  refs.achievementList.innerHTML = categoryOrder.map((category) => {
    const items = achievementState.achievements.filter((item) => item.category === category);
    if (!items.length) return "";
    const categoryUnlocked = items.filter((item) => item.unlocked).length;
    const open = !hadRenderedCategories || expandedCategories.has(category);
    return `
      <details class="achievement-category" data-achievement-category="${escapeHtml(category)}"${open ? " open" : ""}>
        <summary class="achievement-category-heading">
          <span>${escapeHtml(items[0].categoryLabel)}</span>
          <small>${categoryUnlocked} / ${items.length}</small>
        </summary>
        <div class="achievement-category-items">
          ${items.map((item) => `
            <article class="achievement-card${item.unlocked ? " is-unlocked" : ""}${item.reached ? " is-reached" : ""}">
              <span class="achievement-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>
              <div class="achievement-copy">
                <strong>${escapeHtml(item.title)}</strong>
                <small>${escapeHtml(item.description)}</small>
              </div>
              <span class="achievement-count">${item.unlocked ? "已解鎖" : `${Number(item.progress) || 0} / ${item.target}`}</span>
            </article>
          `).join("")}
        </div>
      </details>
    `;
  }).join("");
  const hasCategories = refs.achievementList.childElementCount > 0;
  refs.achievementExpandAll.disabled = !hasCategories;
  refs.achievementCollapseAll.disabled = !hasCategories;
}

function setAchievementCategoriesExpanded(expanded) {
  const categories = [...refs.achievementList.querySelectorAll("details[data-achievement-category]")];
  for (const category of categories) category.open = expanded;
  refs.announcement.textContent = expanded ? "已展開所有成就分類。" : "已收起所有成就分類。";
}

function townAchievementInstance(prefix) {
  const id = typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.round(performance.now())}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${id}`;
}

async function recordAchievementEvent(eventType, subjectId) {
  if (state.townMapPreview.active) return;
  if (!state.achievements.loaded && state.achievementLoadPromise) await state.achievementLoadPromise;
  if (!state.achievements.authenticated) return;
  const memoryKey = `${eventType}:${subjectId}`;
  if (state.achievementEventMemory.has(memoryKey)) return;
  state.achievementEventMemory.add(memoryKey);
  state.achievementWriteQueue = state.achievementWriteQueue.then(async () => {
    try {
      const response = await fetch("/api/account/town-achievements", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ city: "taichung", eventType, subjectId: String(subjectId) }),
      });
      if (response.status === 401) {
        state.achievementEventMemory.delete(memoryKey);
        await loadTownAchievements();
        return;
      }
      if (!response.ok) throw new Error(`成就 API 回傳 ${response.status}`);
      const payload = await response.json();
      applyTownAchievementPayload(payload);
      const newlyUnlocked = Array.isArray(payload.newlyUnlocked) ? payload.newlyUnlocked : [];
      for (const item of newlyUnlocked) {
        showAchievementUnlock(item.title);
        trackTownEvent("lunch_town_achievement_unlocked", { achievement_id: item.id, city: item.city });
      }
    } catch (error) {
      state.achievementEventMemory.delete(memoryKey);
      console.warn("Unable to save town achievement event", error);
      refs.achievementStatus.textContent = "這次成就進度尚未同步，稍後再操作一次即可重試。";
    }
  });
  await state.achievementWriteQueue;
}

function showAchievementUnlock(title) {
  showTownToast("成就解鎖", title);
}

function showTownToast(kicker, title) {
  window.clearTimeout(state.achievementToastTimer);
  refs.achievementToastKicker.textContent = townText(kicker);
  refs.achievementToastTitle.textContent = townText(title);
  refs.achievementToast.hidden = false;
  state.achievementToastTimer = window.setTimeout(() => {
    refs.achievementToast.hidden = true;
  }, 4200);
  announce(`${townText(kicker)}: ${townText(title)}`);
}

function syncDateDisplay() {
  refs.dateDisplay.textContent = formatDate(state.date);
}

function syncCurrentMealDate(environment = state.environment) {
  const nextDate = environment?.dateKey || townMealDateKey(environment?.clock);
  if (!nextDate || state.date === nextDate) {
    if (state.date) syncDateDisplay();
    return;
  }
  const hadPreviousDate = Boolean(state.date);
  state.date = nextDate;
  syncDateDisplay();
  if (!state.ready) return;
  state.isWeekend = isTaichungWeekend(environment.clock);
  state.visited.clear();
  refreshSchoolListIfRendered();
  updateProgress();
  if (refs.dialog.open) refs.dialog.close();
  setupDailyStory();
  renderDailyStory();
  if (hadPreviousDate) announce(`臺中日期已更新，供餐日期同步為 ${formatDate(state.date)}。`);
}

function renderSchoolList() {
  state.schoolListRendered = true;
  refs.schoolList.innerHTML = "";
  const fragment = document.createDocumentFragment();
  const normalizedQuery = state.schoolQuery.toLocaleLowerCase("zh-Hant");
  let resultCount = 0;
  DISTRICT_GROUP_ORDER.forEach((groupName) => {
    const region = document.createElement("section");
    region.className = "school-region-group";
    const regionTitle = document.createElement("h3");
    const districts = DISTRICT_DISPLAY_ORDER.filter(
      (district) => state.districtThemes.get(district)?.group === groupName,
    ).map((district) => ({
      district,
      schools: state.schools.filter((school) => {
        if (school.district !== district) return false;
        if (!normalizedQuery) return true;
        return `${school.name} ${school.district}`.toLocaleLowerCase("zh-Hant").includes(normalizedQuery);
      }),
    })).filter((entry) => entry.schools.length);
    if (!districts.length) return;
    regionTitle.textContent = `${groupName}・${districts.length} 區`;
    region.append(regionTitle);
    districts.forEach(({ district, schools: districtSchools }) => {
      if (!districtSchools.length) return;
      resultCount += districtSchools.length;
      const group = document.createElement("details");
      group.className = "school-district-group";
      group.open = Boolean(normalizedQuery) || district === state.activeDistrict;
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
        button.addEventListener("click", () => openSchool(school, "school_list"));
        group.append(button);
      });
      region.append(group);
    });
    fragment.append(region);
  });
  refs.schoolList.append(fragment);
  refs.schoolSearchStatus.textContent = normalizedQuery
    ? `找到 ${resultCount} 間學校`
    : `共 ${state.schools.length} 間學校，可輸入名稱快速尋找`;
  refs.dailyStoryCard.hidden = Boolean(normalizedQuery);
  if (!resultCount) {
    const empty = document.createElement("p");
    empty.className = "school-search-empty";
    empty.textContent = "找不到相符學校，請改用學校名稱或行政區搜尋。";
    refs.schoolList.append(empty);
  }
}

function refreshSchoolListIfRendered() {
  if (state.schoolListRendered) renderSchoolList();
}

function townMapPlacementsForDistrict(city, district) {
  return (state.townMapManifest?.placements || []).filter((placement) => (
    placement.city === city && placement.district === district
  ));
}

function townMapEditorLaneHeight(city, district) {
  return townMapPlacementsForDistrict(city, district).length ? 92 : 0;
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
    const townStripWidth = 180;
    const schoolAreaWidth = zone.w - townStripWidth;
    const cellWidth = (schoolAreaWidth - 32) / columns;
    const cellHeight = (zone.h - 92 - townMapEditorLaneHeight(SHOWCASE_CITY, district)) / rows;
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

function createNeighborSchoolLayouts(schools) {
  const results = [];
  state.neighborDistrictThemes.forEach((districtTheme, district) => {
    const zone = districtTheme.zone;
    const districtSchools = schools
      .filter((school) => school.city === districtTheme.county.name && school.district === district)
      .sort((first, second) => String(first.name).localeCompare(String(second.name), "zh-Hant"));
    const columns = Math.min(districtSchools.length, 6, Math.max(1, Math.ceil(Math.sqrt(districtSchools.length * 1.6))));
    const rows = Math.max(1, Math.ceil(districtSchools.length / columns));
    const landscapeWidth = neighborDistrictLandscapeWidth(districtTheme);
    const schoolAreaWidth = zone.w - landscapeWidth;
    const cellWidth = (schoolAreaWidth - 32) / columns;
    const cellHeight = (zone.h - 92 - townMapEditorLaneHeight(districtTheme.county.name, district)) / rows;
    const width = Math.min(150, Math.max(54, cellWidth - 12));
    const height = Math.min(92, Math.max(42, cellHeight - 10));
    districtSchools.forEach((school, districtIndex) => {
      const column = districtIndex % columns;
      const row = Math.floor(districtIndex / columns);
      const x = zone.x + 16 + column * cellWidth + (cellWidth - width) / 2;
      const y = zone.y + 78 + row * cellHeight + (cellHeight - height) / 2;
      const styleIndex = (districtIndex + results.length + district.length) % CAMPUS_THEMES.length;
      results.push({
        ...school,
        index: 1_000 + results.length,
        districtNumber: districtIndex + 1,
        mapScope: "neighbor-county",
        layout: {
          x,
          y,
          w: width,
          h: height,
          gate: row % 2 === 0 ? "south" : "north",
          theme: CAMPUS_THEMES[styleIndex],
          facility: CAMPUS_FACILITIES[styleIndex],
          color: districtTheme.county.id === "miaoli" ? "#9fbd88" : "#c1bd7a",
          district,
          compact: true,
          neighborCounty: true,
        },
      });
    });
  });
  return results;
}

function isNeighborFarmTerrain(terrain = "") {
  return /farm|plain|flower|sugar|orchard/.test(terrain);
}

function neighborDistrictLandscapeWidth(theme) {
  const { zone, terrain } = theme;
  if (isNeighborFarmTerrain(terrain)) return Math.max(220, zone.w * 0.4);
  return Math.min(180, Math.max(132, zone.w * 0.24));
}

function neighborFarmlandGeometry(theme) {
  const { zone } = theme;
  const landscapeWidth = neighborDistrictLandscapeWidth(theme);
  const fieldStartX = zone.x + zone.w - landscapeWidth + 12;
  const fieldTop = zone.y + 60;
  return {
    fieldStartX,
    fieldTop,
    fieldWidth: zone.x + zone.w - fieldStartX - 12,
    fieldHeight: zone.h - 72,
    columns: 3,
    rows: 3,
    gap: 8,
  };
}

function neighborPaddyParcels(theme) {
  if (!isNeighborFarmTerrain(theme.terrain)) return [];
  const geometry = neighborFarmlandGeometry(theme);
  const parcels = [];
  for (let row = 0; row < geometry.rows; row += 1) {
    for (let column = 0; column < geometry.columns; column += 1) {
      parcels.push({
        x: geometry.fieldStartX + column * geometry.fieldWidth / geometry.columns + geometry.gap / 2,
        y: geometry.fieldTop + row * geometry.fieldHeight / geometry.rows + geometry.gap / 2,
        w: geometry.fieldWidth / geometry.columns - geometry.gap,
        h: geometry.fieldHeight / geometry.rows - geometry.gap,
        row,
        column,
      });
    }
  }
  return parcels;
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

function createNeighborNpcIdentities() {
  const identities = [];
  for (const countyTheme of state.neighborCountyThemes.values()) {
    countyTheme.districts.forEach((districtTheme) => {
      const [role, gender, profileBaseRole] = NEIGHBOR_BASE_ROLE_BY_DISTRICT[districtTheme.name]
        || ["community-resident", "female", "community-resident"];
      identities.push({
        countyId: countyTheme.id,
        countyName: countyTheme.name,
        district: districtTheme.name,
        workProfile: districtTheme.workProfile || "community",
        role,
        gender,
        profileBaseRole,
      });
    });
  }
  identities.push(...NEIGHBOR_EXTRA_NPCS.map((identity) => ({
    ...identity,
    countyName: state.neighborCountyThemes.get(identity.countyId)?.name || "",
  })));
  const duplicateCounts = new Map();
  identities.forEach((identity) => {
    if (identity.name) return;
    const key = `${identity.district}:${identity.role}`;
    const count = (duplicateCounts.get(key) || 0) + 1;
    duplicateCounts.set(key, count);
    identity.name = `${identity.district}・${ROLE_LABELS[identity.role]}${count > 1 ? ` ${count}` : ""}`;
  });
  assignNeighborCivicResidences(identities);
  return identities;
}

function assignNeighborCivicResidences(identities) {
  const residenceUse = new Map();
  identities.filter((identity) => NEIGHBOR_CIVIC_ROLES.has(identity.role)).forEach((identity) => {
    const residences = ["a", "b"]
      .map((suffix) => state.venues.find((venue) => venue.id === `${identity.countyId}-civic-apartment-${suffix}`))
      .filter(Boolean);
    if (!residences.length) return;
    const residence = residences.slice().sort((first, second) => (
      (residenceUse.get(first.id) || 0) - (residenceUse.get(second.id) || 0)
    ))[0];
    const unitIndex = (residenceUse.get(residence.id) || 0) + 1;
    residenceUse.set(residence.id, unitIndex);
    identity.residenceVenueId = residence.id;
    identity.residenceUnitId = `${residence.id}-unit-${String(unitIndex).padStart(2, "0")}`;
    identity.residenceLabel = `${residence.label}｜${Math.floor((unitIndex - 1) / 4) + 2}樓${((unitIndex - 1) % 4) + 1}室`;
  });
}

function neighborHomeStop(identity, index) {
  const residence = identity.residenceVenueId
    ? state.venues.find((venue) => venue.id === identity.residenceVenueId)
    : null;
  if (residence) return {
    ...venueScheduleStop(residence, identity.role, index),
    label: identity.residenceLabel || residence.label,
    reason: `回到${identity.residenceLabel || residence.label}休息、整理家務或準備晚餐`,
    activity: "at-home",
    dwellSeconds: 7 + index % 5,
  };
  const theme = state.neighborDistrictThemes.get(identity.district);
  const zone = theme?.zone;
  return {
    x: zone ? zone.x + 38 + index % 3 * 20 : 40,
    y: zone ? zone.y + zone.h - 24 : 40,
    district: identity.district,
    label: `${identity.district}生活街區住家`,
    reason: `回到${identity.district}生活街區住家休息、整理家務或準備晚餐`,
    activity: "at-home",
    dwellSeconds: 7 + index % 5,
    venueId: `${identity.countyId}-${identity.district}-residence`,
    virtualResidence: true,
  };
}

function neighborLandmarkStop(identity, index, activity = "guiding") {
  const countyTheme = state.neighborCountyThemes.get(identity.countyId);
  const theme = state.neighborDistrictThemes.get(identity.district);
  const landmarks = countyTheme?.landmarks.filter((landmark) => landmark.district === identity.district) || [];
  const landmark = landmarks[index % Math.max(1, landmarks.length)];
  const landmarkIndex = Math.max(0, landmarks.indexOf(landmark));
  return {
    x: theme ? theme.zone.x + theme.zone.w - 70 - landmarkIndex * 126 : 40,
    y: theme ? theme.zone.y + 92 : 40,
    district: identity.district,
    label: landmark?.name || `${identity.district}地方景觀`,
    reason: landmark ? `在${landmark.name}依工作行程進行巡查與服務` : `在${identity.district}整理地方工作`,
    activity,
    dwellSeconds: 9 + index % 6,
    outdoorVenue: true,
  };
}

function neighborFarmWorkStop(identity, index) {
  const theme = state.neighborDistrictThemes.get(identity.district);
  const parcels = theme ? neighborPaddyParcels(theme) : [];
  const parcel = parcels[index % Math.max(1, parcels.length)];
  const zone = theme?.zone;
  return {
    x: parcel ? parcel.x + parcel.w / 2 : zone ? zone.x + zone.w - 62 : 40,
    y: parcel ? parcel.y + parcel.h / 2 : zone ? zone.y + zone.h / 2 : 40,
    district: identity.district,
    label: `${identity.district}農業工作區`,
    reason: `${ROLE_LABELS[identity.role]}依季節整理田區、作物與生產紀錄`,
    activity: identity.role === "irrigation-worker" ? "maintaining" : identity.role === "fruit-farmer" ? "harvesting" : "farming",
    dwellSeconds: 10 + index % 7,
    outdoorVenue: true,
  };
}

function neighborWorkZonesForIdentity(identity) {
  const direct = state.neighborWorkZones.filter((zone) => (
    zone.countyId === identity.countyId
    && zone.district === identity.district
    && (zone.roles || []).includes(identity.role)
  ));
  if (direct.length || identity.role !== "agricultural-technician") return direct;
  return state.neighborWorkZones.filter((zone) => (
    zone.countyId === identity.countyId
    && (zone.roles || []).includes("agricultural-technician")
  ));
}

function neighborWorkZoneStop(identity, index, preferredZone = null) {
  const zones = neighborWorkZonesForIdentity(identity);
  const zone = preferredZone || zones[index % Math.max(1, zones.length)];
  if (!zone) return neighborFarmWorkStop(identity, index);
  const activities = ROLE_WORK_ACTIVITIES[identity.role] || ["working"];
  const activity = activities[index % activities.length];
  return {
    x: zone.x + zone.w / 2,
    y: zone.y + zone.h - 8,
    district: zone.district,
    label: zone.name,
    reason: `在${zone.name}進行${ROLE_LOCAL_SPECIALTIES[identity.role] || "地方工作"}`,
    activity,
    dwellSeconds: 11 + index % 7,
    outdoorVenue: true,
    workZoneId: zone.id,
    restrictedWorkZone: zone.restricted,
  };
}

function neighborAgricultureOfficeStop(identity, index) {
  const office = state.venues.find((venue) => venue.id === "changhua-agriculture-office");
  return office ? {
    ...venueScheduleStop(office, identity.role, index),
    reason: "在彰化縣政府農業處整理產銷、果菜與花卉市場的田間輔導紀錄",
  } : neighborWorkZoneStop(identity, index);
}

function neighborWorkStop(identity, index) {
  const defaultCivicWorkplaceId = identity.role === "county-councilor"
    ? `${identity.countyId}-county-council`
    : NEIGHBOR_CIVIC_ROLES.has(identity.role) ? `${identity.countyId}-county-government` : "";
  const workplaceId = identity.workVenueId || defaultCivicWorkplaceId;
  const workplace = workplaceId ? state.venues.find((venue) => venue.id === workplaceId) : null;
  if (workplace) return venueScheduleStop(workplace, identity.role, index);
  if (identity.role === "agricultural-technician") return neighborAgricultureOfficeStop(identity, index);
  if (neighborWorkZonesForIdentity(identity).length) return neighborWorkZoneStop(identity, index);
  if (["farmer", "fruit-farmer", "flower-grower", "irrigation-worker", "oyster-farmer"].includes(identity.role)) {
    return neighborFarmWorkStop(identity, index);
  }
  if (["woodcarver", "local-guide", "forest-ranger", "railway-worker", "hospitality-worker", "fisher"].includes(identity.role)) {
    const activity = identity.role === "forest-ranger" ? "patrolling"
      : identity.role === "railway-worker" ? "maintaining" : identity.role === "local-guide" ? "guiding" : "waiting";
    return neighborLandmarkStop(identity, index, activity);
  }
  if (identity.role === "teacher") {
    const schools = state.neighborSchools.filter((school) => school.city === identity.countyName && school.district === identity.district);
    const school = schools[index % Math.max(1, schools.length)];
    if (school) return {
      ...schoolGatePoint(school), district: identity.district, label: school.name,
      reason: reasonAtSchool(identity.role), activity: "waiting", dwellSeconds: 8 + index % 5,
    };
  }
  const office = state.venues.find((venue) => venue.id === `${identity.countyId}-${identity.district}-township-office`);
  return office ? venueScheduleStop(office, identity.role, index) : neighborHomeStop(identity, index);
}

function neighborDayPeriod(environment = state.environment) {
  const hour = Number(environment?.clock?.hour ?? 12);
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 16) return "midday";
  if (hour >= 16 && hour < 23) return "evening";
  return "late-night";
}

function neighborBridgeTripStops(identity, index) {
  const bridge = BOUNDARY_BRIDGES.find((candidate) => candidate.countyId === identity.countyId);
  if (!bridge) return [];
  const taichungDistrict = identity.countyId === "miaoli" ? "后里區" : "烏日區";
  const destination = DISTRICT_ZONES[taichungDistrict];
  if (!destination) return [];
  const countySide = identity.countyId === "miaoli" ? -1 : 1;
  return [
    {
      x: bridge.x, y: bridge.riverY + countySide * (BORDER_RIVER_WIDTH / 2 + 28),
      district: identity.district, label: `${identity.countyName}跨縣橋入口`,
      reason: `依行程準備跨橋前往臺中市`, activity: "walking", dwellSeconds: 1, outdoorVenue: true,
    },
    {
      x: bridge.x, y: bridge.riverY - countySide * (BORDER_RIVER_WIDTH / 2 + 28),
      district: taichungDistrict, label: `${taichungDistrict}橋頭`,
      reason: `跨橋到臺中市交流、辦事或休憩`, activity: "greeting", dwellSeconds: 6 + index % 4, outdoorVenue: true,
    },
  ];
}

function createNeighborNpcTimeSchedule(identity, index) {
  const home = neighborHomeStop(identity, index);
  const work = neighborWorkStop(identity, index);
  const office = state.venues.find((venue) => venue.id === `${identity.countyId}-${identity.district}-township-office`);
  const community = office && office.id !== identity.homeVenueId
    ? venueScheduleStop(office, identity.role, index + 17)
    : neighborLandmarkStop(identity, index + 1, "waiting");
  const workZones = neighborWorkZonesForIdentity(identity);
  const secondWork = workZones.length > 1 ? neighborWorkZoneStop(identity, index + 1, workZones[(index + 1) % workZones.length]) : work;
  const canCross = hashText(`${identity.countyId}-${identity.district}-${identity.role}-bridge`) % 3 === 0;
  const bridgeStops = canCross ? neighborBridgeTripStops(identity, index) : [];
  const midday = identity.role === "agricultural-technician"
    ? [neighborAgricultureOfficeStop(identity, index), secondWork, community]
    : [work, secondWork, community];
  const evening = bridgeStops.length
    ? [community, ...bridgeStops, ...bridgeStops.slice().reverse(), { ...home, dwellSeconds: 12 + index % 5 }]
    : [work, community, { ...home, dwellSeconds: 12 + index % 5 }];
  return {
    morning: [home, work],
    midday,
    evening,
    "late-night": [home, { ...home, dwellSeconds: 12 * 60 * 60 }],
    canCross,
  };
}

function createNeighborNpcSchedule(identity, index) {
  const schedules = createNeighborNpcTimeSchedule(identity, index);
  return schedules[neighborDayPeriod()] || schedules.midday;
}

function createNeighborNpcCharacter(identity, index, lookIndex) {
  const baseRole = identity.profileBaseRole || identity.role;
  const roleProfiles = CHARACTER_PROFILES.filter((profile) => profile.role === baseRole);
  const genderProfiles = roleProfiles.filter((profile) => profile.gender === identity.gender);
  const profile = varyOutfitColors(genderProfiles[0] || roleProfiles[0] || CHARACTER_PROFILES[0], identity, lookIndex);
  const timeSchedule = createNeighborNpcTimeSchedule(identity, index);
  const currentPeriod = neighborDayPeriod();
  const daytimeSchedule = timeSchedule[currentPeriod] || timeSchedule.midday;
  const allRoutineStops = ["morning", "midday", "evening", "late-night"]
    .flatMap((period) => timeSchedule[period] || []);
  const home = neighborHomeStop(identity, index);
  const primaryWorkStop = [...(timeSchedule.morning || []), ...(timeSchedule.midday || [])]
    .find((stop) => (stop.workZoneId || stop.venueId) && !stop.virtualResidence);
  const afterHours = NEIGHBOR_CIVIC_ROLES.has(identity.role) && civicAfterHoursPeriod(state.environment) !== "daytime";
  const schedule = afterHours ? createNeighborCivicAfterHoursSchedule(identity, index) : daytimeSchedule;
  const start = schedule[0];
  return {
    ...profile,
    ...identity,
    lookIndex,
    schedule,
    segment: 0,
    progress: 0,
    dwellRemaining: reducedMotion ? Number.POSITIVE_INFINITY : afterHours ? start.dwellSeconds : index % 3 * 0.8,
    currentReason: start.reason,
    speed: reducedMotion ? 0 : npcWalkingSpeed(profile.ageGroup, identity.role, lookIndex),
    x: start.x,
    y: start.y,
    direction: "down",
    step: lookIndex,
    isMoving: false,
    personality: NPC_PERSONALITIES[hashText(`${identity.name}-personality`) % NPC_PERSONALITIES.length],
    mood: ["平靜", "有精神", "有點忙", "放鬆"][hashText(`${identity.name}-mood`) % 4],
    activity: start.activity || "waiting",
    riverbankSiteId: "",
    relationships: new Map(),
    coarseElapsed: 0,
    emote: "",
    emoteUntil: 0,
    bikePreference: false,
    ridingBike: false,
    eveningExcursion: null,
    eveningVisitedDate: "",
    civicDaySchedule: NEIGHBOR_CIVIC_ROLES.has(identity.role) ? timeSchedule.midday : null,
    neighborCivicAfterHoursKey: afterHours ? `${state.environment?.dateKey || "after-hours"}:${civicAfterHoursPeriod(state.environment)}` : "",
    appearanceRule: null,
    appearanceElapsed: 0,
    insideVenueId: afterHours ? start.venueId : "",
    mobilityMode: "county-local",
    homeCounty: identity.countyName,
    homeDistrict: identity.district,
    workplaceId: primaryWorkStop?.workZoneId || primaryWorkStop?.venueId || "",
    frequentPlaceIds: [...new Set(allRoutineStops.map((stop) => stop.workZoneId || stop.venueId || stop.label).filter(Boolean))],
    localSpecialty: ROLE_LOCAL_SPECIALTIES[identity.role] || state.neighborDistrictThemes.get(identity.district)?.featureLabel || "地方生活",
    timeSchedule,
    neighborRoutineKey: currentPeriod,
    canCrossCountyBridge: timeSchedule.canCross,
    bridgeDestinations: timeSchedule.canCross ? ["臺中市"] : [],
    specialWorkZoneIds: neighborWorkZonesForIdentity(identity).map((zone) => zone.id),
    residenceVenueId: home.venueId,
    residenceUnitId: identity.residenceUnitId || "",
    residenceLabel: identity.residenceLabel || home.label,
    dialogues: ROLE_DIALOGUES[identity.role] || ["今天的小鎮很熱鬧，慢慢走、仔細看看吧。"],
    dialogueCursor: 0,
  };
}

function appendNeighborCountyCharacters() {
  const identities = createNeighborNpcIdentities();
  const countyCounts = new Map();
  identities.forEach((identity, index) => {
    const countyIndex = countyCounts.get(identity.countyId) || 0;
    countyCounts.set(identity.countyId, countyIndex + 1);
    state.npcs.push(createNeighborNpcCharacter(identity, countyIndex, state.npcs.length));
  });
  Object.entries(NEIGHBOR_COUNTY_NPC_TARGETS).forEach(([countyId, expected]) => {
    if ((countyCounts.get(countyId) || 0) !== expected) throw new Error(`${countyId} NPC 數量不完整`);
  });
}

function createTownCharacters() {
  const editorNpcs = state.townMapManifest?.npcs || [];
  const serviceStaff = DISTRICT_DISPLAY_ORDER.map((district, index) => {
    const serviceType = SERVICE_VENUE_TYPES[index % SERVICE_VENUE_TYPES.length];
    const role = serviceType === "police-station" ? "police-officer" : serviceType === "fire-station" ? "firefighter" : "doctor";
    const gender = index % 2 === 0 ? "female" : "male";
    const names = SERVICE_STAFF_NAMES[role][gender];
    return {
      district,
      name: names[Math.floor(index / 2) % names.length],
      role,
      gender,
      homeVenueId: `${district}-${serviceType}`,
    };
  });
  const identities = DISTRICT_DISPLAY_ORDER.flatMap((district, index) => {
    const adult = DISTRICT_ADULTS[index % DISTRICT_ADULTS.length];
    return [
      { district, name: CHILD_NAMES[index], role: "student", gender: index % 2 === 0 ? "female" : "male" },
      { district, name: adult.name, role: adult.role, gender: adult.gender },
    ];
  }).concat(
    OCCASIONAL_TOWN_NPCS,
    DIVERSE_TOWN_NPCS,
    TOWN_SERVICE_NPCS,
    CITY_HALL_NPCS,
    CIVIC_TOWN_NPCS,
    serviceStaff,
    FEATURED_RESIDENT_NPCS,
    editorNpcs.length
      ? editorNpcs.filter((npc) => npc.city === SHOWCASE_CITY).map(townMapNpcIdentity)
      : [],
  );
  assignNpcResidences(identities);
  const districtCounts = new Map();
  state.npcs = identities.map((identity, index) => {
    const districtIndex = districtCounts.get(identity.district) || 0;
    districtCounts.set(identity.district, districtIndex + 1);
    const roleProfiles = CHARACTER_PROFILES.filter((profile) => profile.role === identity.role);
    const genderProfiles = roleProfiles.filter((profile) => profile.gender === identity.gender);
    const variantProfile = identity.profileVariant
      ? genderProfiles.find((profile) => profile.variant === identity.profileVariant)
      : null;
    const profiles = variantProfile ? [variantProfile] : genderProfiles.length ? genderProfiles : roleProfiles;
    const profile = varyOutfitColors(
      profiles[districtIndex % profiles.length] || CHARACTER_PROFILES[0],
      identity,
      index,
    );
    const bikePreference = npcPrefersBike(identity);
    const daytimeSchedule = createNpcSchedule(identity, districtIndex);
    const startsAtAssignedCivicPost = ["mayor", "civil-servant", "city-supervisor"].includes(identity.role);
    const initialAfterHoursSchedule = startsAtAssignedCivicPost
      && civicAfterHoursPeriod(state.environment) !== "daytime"
      ? createCivicAfterHoursSchedule(identity, districtIndex, state.environment)
      : [];
    const schedule = initialAfterHoursSchedule.length ? initialAfterHoursSchedule : daytimeSchedule;
    const segment = identity.role === "candidate" || startsAtAssignedCivicPost ? 0 : (index + districtIndex) % schedule.length;
    const start = schedule[segment];
    const appearanceRule = CANDIDATE_APPEARANCE_RULES[identity.name] || null;
    const appearanceElapsed = appearanceRule
      ? (appearanceRule.cycleSeconds - appearanceRule.initialDelaySeconds) % appearanceRule.cycleSeconds
      : 0;
    const startsOffscreen = Boolean(appearanceRule && appearanceElapsed >= appearanceRule.visibleSeconds);
    return {
      ...profile,
      ...identity,
      lookIndex: index,
      schedule,
      segment,
      progress: 0,
      dwellRemaining: reducedMotion
        ? Number.POSITIVE_INFINITY
        : identity.role === "candidate" ? 0 : (index % 3) * 0.9,
      currentReason: start.reason,
      speed: reducedMotion ? 0 : npcWalkingSpeed(profile.ageGroup, identity.role, index),
      x: start.x,
      y: start.y,
      direction: "down",
      step: index,
      isMoving: false,
      personality: NPC_PERSONALITIES[hashText(`${identity.name}-personality`) % NPC_PERSONALITIES.length],
      mood: ["平靜", "有精神", "有點忙", "放鬆"][hashText(`${identity.name}-mood`) % 4],
      activity: start.activity || "waiting",
      riverbankSiteId: start.riverbankSiteId || "",
      relationships: new Map(),
      coarseElapsed: 0,
      emote: "",
      emoteUntil: 0,
      bikePreference,
      ridingBike: false,
      eveningExcursion: null,
      eveningVisitedDate: "",
      civicDaySchedule: startsAtAssignedCivicPost ? daytimeSchedule : null,
      civicAfterHoursRoutineKey: initialAfterHoursSchedule.length
        ? `${state.environment?.dateKey || "after-hours"}:${civicAfterHoursPeriod(state.environment)}`
        : "",
      appearanceRule,
      appearanceElapsed,
      // 候選人從各自不同的起始行政區街面出發，避免一載入就集中在同一區或躲在室內。
      // 減少動態時人物會停留，因此仍維持可見。
      insideVenueId: startsOffscreen
        ? NPC_OFFSCREEN_VENUE_ID
        : (identity.role === "candidate" ? "" : (reducedMotion || start.outdoorVenue ? "" : (start.venueId || ""))),
      mobilityMode: mobilityModeFor(identity, districtIndex),
      dialogues: [
        identity.campaignAppeal,
        state.districtThemes.get(identity.district)?.dialogue,
        ...(ROLE_DIALOGUES[identity.role] || ["今天的小鎮很熱鬧，慢慢走、仔細看看吧。"]),
      ].filter(Boolean),
      dialogueCursor: 0,
    };
  });
  appendNeighborCountyCharacters();
  if (editorNpcs.some((npc) => npc.city !== SHOWCASE_CITY)) appendTownMapNeighborCharacters();
  state.pets = DISTRICT_DISPLAY_ORDER.map((district, index) => {
    const zone = DISTRICT_ZONES[district];
    const kind = index % 2 ? "dog" : "cat";
    const owner = kind === "dog" ? dogWalkerForDistrict(district, index) : null;
    if (owner) {
      owner.hasLeashedDog = true;
      owner.bikePreference = false;
    }
    return {
      x: owner ? owner.x + 16 : zone.x + zone.w - 38,
      y: owner ? owner.y + 7 : zone.y + zone.h - 30,
      color: index % 2 ? "#715544" : "#d98b45",
      phase: index * 0.7,
      kind,
      ownerName: owner?.name || "",
      ownerLookIndex: owner?.lookIndex ?? -1,
      hidden: Boolean(owner?.insideVenueId),
      district,
      homeDistrict: district,
      target: null,
      speed: 7 + index % 4,
      dwellRemaining: 1 + index % 4,
      decisionSeed: hashText(`${district}-${index}`),
      direction: "left",
      coarseElapsed: 0,
    };
  });
}

function assignNpcResidences(identities) {
  const residences = state.venues.filter((venue) => ["townhouse", "apartment"].includes(venue.type));
  const residenceUse = new Map();
  identities.forEach((identity, identityIndex) => {
    const localResidences = residences.filter((venue) => venue.district === identity.district);
    const candidates = (localResidences.length ? localResidences : residences).slice().sort((first, second) => {
      const firstDistance = districtGridDistance(identity.district, first.district);
      const secondDistance = districtGridDistance(identity.district, second.district);
      if (firstDistance !== secondDistance) return firstDistance - secondDistance;
      const firstLoad = (residenceUse.get(first.id) || 0) / Math.max(1, first.residentCapacity || 4);
      const secondLoad = (residenceUse.get(second.id) || 0) / Math.max(1, second.residentCapacity || 4);
      if (firstLoad !== secondLoad) return firstLoad - secondLoad;
      return hashText(`${identity.name}-${first.id}-${identityIndex}`)
        - hashText(`${identity.name}-${second.id}-${identityIndex}`);
    });
    const residence = candidates[0];
    if (!residence) return;
    const unitIndex = (residenceUse.get(residence.id) || 0) + 1;
    residenceUse.set(residence.id, unitIndex);
    identity.residenceVenueId = residence.id;
    identity.residenceUnitId = `${residence.id}-unit-${String(unitIndex).padStart(2, "0")}`;
    identity.residenceLabel = residence.type === "apartment"
      ? `${residence.label} ${Math.floor((unitIndex - 1) / 4) + 2}樓${((unitIndex - 1) % 4) + 1}室`
      : `${residence.label} ${unitIndex}號住家`;
  });
}

function dogWalkerForDistrict(district, index) {
  const preferredRoles = new Set([
    "parent", "community-resident", "senior", "office-worker", "teacher",
    "nutritionist", "cook", "nurse", "gardener", "librarian", "principal", "vendor",
  ]);
  const residents = state.npcs.filter((npc) => npc.district === district
    && npc.ageGroup !== "child" && npc.ageGroup !== "teen"
    && !["candidate", "mayor", "police-officer", "firefighter", "doctor"].includes(npc.role));
  const preferred = residents.filter((npc) => preferredRoles.has(npc.role));
  const pool = preferred.length ? preferred : residents;
  return pool[index % Math.max(1, pool.length)] || null;
}

function buildTownRelationships() {
  const studentRoles = new Set(["student", "high-school-student", "university-student"]);
  const relationshipDistricts = [...DISTRICT_DISPLAY_ORDER, ...state.neighborDistrictThemes.keys()];
  relationshipDistricts.forEach((district) => {
    const residents = state.npcs.filter((npc) => npc.district === district);
    const parents = residents.filter((npc) => npc.role === "parent");
    const children = residents.filter((npc) => npc.role === "student");
    parents.forEach((parent, index) => {
      const child = children[index % Math.max(1, children.length)];
      if (child) setNpcRelationship(parent, child, "parent-child");
    });
    const students = residents.filter((npc) => studentRoles.has(npc.role));
    for (let first = 0; first < students.length; first += 1) {
      for (let second = first + 1; second < students.length; second += 1) {
        setNpcRelationship(students[first], students[second], "classmates");
      }
    }
    for (let first = 0; first < residents.length; first += 1) {
      for (let second = first + 1; second < residents.length; second += 1) {
        const firstNpc = residents[first];
        const secondNpc = residents[second];
        if (firstNpc.relationships.has(secondNpc.name)) continue;
        if (firstNpc.role === secondNpc.role || shareWorkplace(firstNpc.role, secondNpc.role)) {
          setNpcRelationship(firstNpc, secondNpc, "coworkers");
        } else if ((first + second) % 3 !== 0) {
          setNpcRelationship(firstNpc, secondNpc, "neighbors");
        }
      }
    }
  });
}

function shareWorkplace(firstRole, secondRole) {
  const schoolRoles = new Set(["teacher", "nutritionist", "cook", "nurse", "principal", "gardener", "librarian", "crossing-guard"]);
  const publicSafetyRoles = new Set(["police-officer", "firefighter", "doctor"]);
  return (schoolRoles.has(firstRole) && schoolRoles.has(secondRole))
    || (publicSafetyRoles.has(firstRole) && publicSafetyRoles.has(secondRole));
}

function setNpcRelationship(first, second, relationship) {
  first.relationships.set(second.name, relationship);
  second.relationships.set(first.name, relationship);
}

function relationshipBetween(first, second) {
  if (!first || !second) return "visitor";
  return first.relationships?.get(second.name)
    || second.relationships?.get(first.name)
    || (first.district === second.district ? "neighbors" : "new-acquaintances");
}

function relationshipLabel(relationship) {
  return {
    "parent-child": "家人",
    classmates: "同學",
    coworkers: "同事",
    neighbors: "鄰居",
    "new-acquaintances": "剛認識",
    visitor: "第一次見面",
  }[relationship] || "居民";
}

function createTownBirds() {
  state.birds = DISTRICT_DISPLAY_ORDER.flatMap((district, districtIndex) => {
    const zone = DISTRICT_ZONES[district];
    return [
      {
        species: "sparrow",
        label: "麻雀",
        district,
        x: zone.x + 78 + districtIndex % 4 * 18,
        y: zone.y + zone.h - 46,
        altitude: 0,
        target: null,
        speed: 22 + districtIndex % 5,
        phase: districtIndex * 0.83,
        decisionSeed: hashText(`sparrow-${district}`),
        coarseElapsed: 0,
      },
      {
        species: "bulbul",
        label: "白頭翁",
        district,
        x: zone.x + zone.w - 92,
        y: zone.y + 68,
        altitude: 10,
        target: null,
        speed: 26 + districtIndex % 4,
        phase: districtIndex * 0.61,
        decisionSeed: hashText(`bulbul-${district}`),
        coarseElapsed: 0,
      },
    ];
  });
}

function varyOutfitColors(profile, identity, index) {
  if (profile.preservePalette) return { ...profile };
  if (identity.name === "何欣純") {
    return { ...profile, outfit: "#e8aebd", outfitDark: "#925f72", accent: "#f8d8df" };
  }
  if (identity.name === "江啟臣") {
    return { ...profile, outfit: "#29466f", outfitDark: "#172b4d", accent: "#c84e52" };
  }
  const whiteUniformRoles = new Set(["nutritionist", "cook", "nurse", "doctor"]);
  const palettes = whiteUniformRoles.has(identity.role) ? LIGHT_UNIFORM_PALETTES : OUTFIT_COLOR_PALETTES;
  const palette = palettes[(hashText(`${identity.name}-${identity.district}`) + index) % palettes.length];
  if (["police-officer", "firefighter"].includes(identity.role)) {
    const serviceOffset = index % 3;
    return {
      ...profile,
      outfit: identity.role === "police-officer" ? ["#3e6688", "#496f88", "#385d7c"][serviceOffset] : ["#b94f3b", "#c15b3f", "#a84a3b"][serviceOffset],
      outfitDark: identity.role === "police-officer" ? "#263d58" : "#63352f",
      accent: ["#f0c654", "#efb94e", "#f4d36a"][serviceOffset],
    };
  }
  return { ...profile, ...palette };
}

function hashText(value) {
  return [...String(value)].reduce((hash, character) => (hash * 31 + character.codePointAt(0)) >>> 0, 2166136261);
}

function lotsIntersect(first, second, padding = 0) {
  return first.x < second.x + second.w + padding
    && first.x + first.w + padding > second.x
    && first.y < second.y + second.h + padding
    && first.y + first.h + padding > second.y;
}

function openTownhouseLot(district) {
  const zone = DISTRICT_ZONES[district];
  const occupied = state.schools
    .filter((school) => school.district === district)
    .map((school) => school.layout);
  occupied.push({ x: zone.x + 254, y: zone.y + zone.h - 66, w: 124, h: 64 });
  const candidates = [76, 140, 204, 268].flatMap((offsetY) => (
    [18, 112, 206].map((offsetX) => ({
      x: zone.x + offsetX,
      y: zone.y + offsetY,
      w: 82,
      h: 50,
    }))
  ));
  const openLots = candidates.filter((candidate) => (
    !occupied.some((item) => lotsIntersect(candidate, item, 5))
  ));
  return openLots[hashText(`${district}-residential-lot`) % Math.max(1, openLots.length)] || null;
}

function createResidentialVenues() {
  const hubDistricts = new Set(LANDMARK_HUB_DEFINITIONS.map((definition) => definition.district));
  return DISTRICT_DISPLAY_ORDER.flatMap((district, index) => {
    if (hubDistricts.has(district)) return [];
    const zone = DISTRICT_ZONES[district];
    const venues = [{
      id: `${district}-apartment`,
      district,
      type: "apartment",
      label: `${district.replace("區", "")}生活公寓`,
      shortLabel: "生活公寓",
      description: `${district}居民日常生活的公寓住宅，傍晚會有人返家、休息或準備晚餐。`,
      x: zone.x + 306,
      y: zone.y + 12,
      w: 70,
      h: 58,
      residentCapacity: 8,
    }];
    const townhouseLot = openTownhouseLot(district);
    if (townhouseLot) {
      venues.push({
        id: `${district}-townhouse`,
        district,
        type: "townhouse",
        label: `${district.replace("區", "")}巷弄透天`,
        shortLabel: "巷弄透天",
        description: `${district}街坊的連棟透天住宅，居民會從這裡出門辦事，也會在一天結束後回家。`,
        ...townhouseLot,
        residentCapacity: 4 + index % 3,
      });
    }
    return venues;
  });
}

function createCivicNeighborhoodVenues(civicCenter) {
  if (!civicCenter) return [];
  const { x, y, w, h, district } = civicCenter;
  const southBlockY = y + DISTRICT_ZONE_HEIGHT + DISTRICT_ZONE_GAP_Y;
  const southBlock = {
    id: "civic-south-neighborhood",
    parentHubId: civicCenter.id,
    district,
    type: "landmark",
    hubKind: "civic-neighborhood",
    label: "市政南生活街區",
    shortLabel: "市政南生活街區",
    description: "市府南側道路另一邊的住宅生活街區，設有公寓、連棟住家、便利商店、巷道與夜間照明。",
    x,
    y: southBlockY,
    w,
    h,
  };
  return [
    southBlock,
    {
      id: "civic-south-apartment-a",
      parentHubId: civicCenter.id,
      district,
      type: "apartment",
      label: "市政南苑 A 棟",
      shortLabel: "南苑 A 棟",
      description: "市府南側的住宅公寓，住戶可以步行上班，也會在傍晚回家準備晚餐。",
      x: x + 12,
      y: y + h - 80,
      w: 64,
      h: 58,
      residentCapacity: 12,
    },
    {
      id: "civic-south-townhouses",
      parentHubId: civicCenter.id,
      district,
      type: "townhouse",
      label: "市政南巷連棟住家",
      shortLabel: "南巷住家",
      description: "靠近市府的連棟透天住家，巷口常有居民下班、散步或互相打招呼。",
      x: x + 84,
      y: y + h - 66,
      w: 82,
      h: 50,
      residentCapacity: 6,
    },
    {
      id: "civic-south-convenience",
      parentHubId: civicCenter.id,
      district,
      type: "convenience-store",
      label: "日日便利・市政南門市",
      shortLabel: "日日便利",
      description: "服務市府員工與附近住戶的原創便利商店，可補充飲水、日用品與簡單餐食。",
      brand: ORIGINAL_CONVENIENCE_BRANDS[2],
      x: x + w - 166,
      y: y + h - 66,
      w: 82,
      h: 50,
    },
    {
      id: "civic-south-apartment-b",
      parentHubId: civicCenter.id,
      district,
      type: "apartment",
      label: "市政南苑 B 棟",
      shortLabel: "南苑 B 棟",
      description: "面向市政中心的住宅公寓，住戶會從這裡出門辦事、通勤或前往附近商店。",
      x: x + w - 76,
      y: y + h - 80,
      w: 64,
      h: 58,
      residentCapacity: 12,
    },
    {
      id: "civic-south-apartment-c",
      parentHubId: southBlock.id,
      district,
      type: "apartment",
      label: "市政晴庭公寓",
      shortLabel: "晴庭公寓",
      description: "市政南生活街區的住宅公寓，夜裡可看見住戶返家後亮起的窗燈。",
      x: southBlock.x + 16,
      y: southBlock.y + 34,
      w: 68,
      h: 82,
      residentCapacity: 16,
    },
    {
      id: "civic-south-apartment-d",
      parentHubId: southBlock.id,
      district,
      type: "apartment",
      label: "市政綠景公寓",
      shortLabel: "綠景公寓",
      description: "靠近生活步道的公寓住宅，住戶下班後會在這裡休息或準備晚餐。",
      x: southBlock.x + southBlock.w - 84,
      y: southBlock.y + 34,
      w: 68,
      h: 82,
      residentCapacity: 16,
    },
    {
      id: "civic-south-townhouses-east",
      parentHubId: southBlock.id,
      district,
      type: "townhouse",
      label: "市政南街東排住家",
      shortLabel: "東排住家",
      description: "面向巷道的連棟住家，傍晚後會有居民返家、散步或到附近採買。",
      x: southBlock.x + 101,
      y: southBlock.y + 39,
      w: 82,
      h: 50,
      residentCapacity: 7,
    },
    {
      id: "civic-south-townhouses-west",
      parentHubId: southBlock.id,
      district,
      type: "townhouse",
      label: "市政南街西排住家",
      shortLabel: "西排住家",
      description: "有前廊與小庭院的連棟住家，讓市府南側不只有辦公空間，也有真實的夜間生活。",
      x: southBlock.x + 201,
      y: southBlock.y + 39,
      w: 82,
      h: 50,
      residentCapacity: 7,
    },
    {
      id: "civic-south-courtyard-homes",
      parentHubId: southBlock.id,
      district,
      type: "townhouse",
      label: "南苑庭院住家",
      shortLabel: "庭院住家",
      description: "生活街區內側的庭院住家，夜間以住戶休息與鄰里活動為主。",
      x: southBlock.x + 70,
      y: southBlock.y + 148,
      w: 94,
      h: 54,
      residentCapacity: 8,
    },
    {
      id: "civic-south-night-convenience",
      parentHubId: southBlock.id,
      district,
      type: "convenience-store",
      label: "福星小站・市政生活店",
      shortLabel: "福星小站",
      description: "服務附近住戶與下班人潮的原創便利商店，夜間仍提供簡單餐食、飲水與日用品。",
      brand: ORIGINAL_CONVENIENCE_BRANDS[2],
      x: southBlock.x + southBlock.w - 180,
      y: southBlock.y + 148,
      w: 96,
      h: 54,
    },
  ];
}

function neighborCivicCampusBounds(countyTheme) {
  const county = neighborCountyById(countyTheme.id);
  const civic = NEIGHBOR_COUNTY_CIVIC_INFO[countyTheme.id];
  if (!county || !civic?.campusGrid) return null;
  const [column, row] = civic.campusGrid;
  const metrics = neighborCountyGridMetrics(county, countyTheme.rows);
  return {
    x: metrics.left + column * metrics.cellWidth + NEIGHBOR_COUNTY_ZONE_GAP / 2,
    y: metrics.top + row * metrics.cellHeight + NEIGHBOR_COUNTY_ZONE_GAP / 2,
    w: metrics.cellWidth - NEIGHBOR_COUNTY_ZONE_GAP,
    h: metrics.cellHeight - NEIGHBOR_COUNTY_ZONE_GAP,
  };
}

function createNeighborCountyVenues() {
  return [...state.neighborCountyThemes.values()].flatMap((countyTheme) => {
    const county = neighborCountyById(countyTheme.id);
    const civic = NEIGHBOR_COUNTY_CIVIC_INFO[countyTheme.id];
    if (!county || !civic) return [];
    const districtOffices = countyTheme.districts.map((districtTheme) => {
      const configured = state.neighborDistrictThemes.get(districtTheme.name);
      if (!configured) return null;
      const { zone } = configured;
      return {
        id: `${countyTheme.id}-${districtTheme.name}-township-office`,
        countyId: countyTheme.id,
        district: districtTheme.name,
        type: "township-office",
        label: `${districtTheme.name}公所`,
        shortLabel: "公所",
        description: `${districtTheme.name}居民辦理地方公共服務的行政據點，公所人員也會前往學校、農路與街區巡查。`,
        sourceUrl: civic.governmentSourceUrl,
        x: zone.x + 158,
        y: zone.y + 10,
        w: 112,
        h: 40,
        neighborVenue: true,
      };
    }).filter(Boolean);
    const seat = state.neighborDistrictThemes.get(civic.seatDistrict)?.zone;
    const campus = neighborCivicCampusBounds(countyTheme);
    if (!seat || !campus) return districtOffices;
    const civicPrefix = countyTheme.name.replace(/縣$/, "");
    const campusVenue = (venue) => ({
      countyId: countyTheme.id,
      district: civic.seatDistrict,
      neighborVenue: true,
      civicCampus: true,
      ...venue,
    });
    return [
      ...districtOffices,
      campusVenue({
        id: `${countyTheme.id}-county-government`, type: "county-government",
        label: civic.hallName, shortLabel: "縣政府",
        description: `${countyTheme.name}的縣政服務中心，包含公共服務、教育、農業、交通與其他縣政協作。`,
        sourceUrl: civic.governmentSourceUrl,
        x: campus.x + 18, y: campus.y + 16, w: 330, h: 96,
      }),
      campusVenue({
        id: `${countyTheme.id}-county-council`, type: "county-council",
        label: civic.councilName, shortLabel: "縣議會",
        description: `${countyTheme.name}議會審議縣政預算、法規與施政報告，也接受居民關心的公共議題。`,
        sourceUrl: civic.governmentSourceUrl,
        x: campus.x + 370, y: campus.y + 20, w: 178, h: 76,
      }),
      campusVenue({
        id: `${countyTheme.id}-civic-apartment-a`, type: "apartment",
        label: `${civicPrefix}縣政生活公寓 A棟`, shortLabel: "縣政公寓 A",
        description: "提供縣府與縣議會工作人員使用的生活住宅，每位角色都有獨立登記的住家單位。",
        x: campus.x + 18, y: campus.y + 138, w: 142, h: 64, residentCapacity: 8,
      }),
      campusVenue({
        id: `${countyTheme.id}-civic-apartment-b`, type: "apartment",
        label: `${civicPrefix}縣政生活公寓 B棟`, shortLabel: "縣政公寓 B",
        description: "鄰近縣府園區的住宅，縣長與縣府員工下班後會返家或先到附近採買。",
        x: campus.x + 174, y: campus.y + 138, w: 142, h: 64, residentCapacity: 8,
      }),
      campusVenue({
        id: `${countyTheme.id}-public-safety`, type: "police-station",
        label: `${countyTheme.name}警察局`, shortLabel: "警察局",
        description: `${countyTheme.name}公共安全與校園周邊巡邏的勤務據點。`,
        sourceUrl: civic.governmentSourceUrl,
        x: campus.x + 430, y: campus.y + 132, w: 78, h: 56,
      }),
      campusVenue({
        id: `${countyTheme.id}-fire-service`, type: "fire-station",
        label: `${countyTheme.name}消防局`, shortLabel: "消防局",
        description: `${countyTheme.name}消防、救災與緊急救護的整備據點。`,
        sourceUrl: civic.governmentSourceUrl,
        x: campus.x + 520, y: campus.y + 132, w: 78, h: 56,
      }),
      campusVenue({
        id: `${countyTheme.id}-civic-convenience`, type: "convenience-store",
        label: `${civicPrefix}縣政生活店`, shortLabel: "縣政生活店",
        description: "服務縣政園區與附近住戶的生活商店，提供晚餐、飲水與日用品補給。",
        brand: ORIGINAL_CONVENIENCE_BRANDS[countyTheme.id === "miaoli" ? 0 : 1],
        x: campus.x + 610, y: campus.y + 132, w: 104, h: 56,
      }),
      ...(countyTheme.id === "changhua" ? [campusVenue({
        id: "changhua-agriculture-office", type: "agriculture-office",
        label: "彰化縣政府農業處", shortLabel: "農業處",
        description: "辦理稻米、農業產銷、果菜與花卉市場等業務；農業技術員會從這裡前往各地工作區。",
        sourceUrl: "https://www.chcg.gov.tw/DTO/agriculture/01intro/intro03.aspx",
        x: campus.x + 560, y: campus.y + 20, w: 154, h: 76,
      })] : []),
    ];
  });
}

function createNeighborWorkZones() {
  const zones = [];
  state.neighborCountyThemes.forEach((countyTheme) => {
    const districtCounts = new Map();
    (countyTheme.workZones || []).forEach((spec) => {
      const theme = state.neighborDistrictThemes.get(spec.district);
      if (!theme) return;
      const slot = districtCounts.get(spec.district) || 0;
      districtCounts.set(spec.district, slot + 1);
      const landscapeWidth = neighborDistrictLandscapeWidth(theme);
      const width = Math.max(118, Math.min(178, landscapeWidth - 22));
      const height = slot > 0 ? 48 : 56;
      zones.push({
        ...spec,
        countyId: countyTheme.id,
        countyName: countyTheme.name,
        x: theme.zone.x + theme.zone.w - width - 12,
        y: theme.zone.y + 94 + slot * 62,
        w: width,
        h: height,
        districtSlot: slot,
        restricted: spec.restricted === true,
      });
    });
  });
  return zones;
}

function configurePlayerHome(venues) {
  const starter = venues.find((venue) => venue.district === "西區" && venue.type === "townhouse")
    || venues.find((venue) => venue.district === "西區" && venue.type === "apartment");
  if (!starter) return venues;
  Object.assign(starter, {
    id: "player-home",
    type: "player-home",
    label: "我的家",
    shortLabel: "我的家",
    description: "這是玩家在臺中午餐小鎮的起步住所，也是每次進入小鎮的出發點。",
    homeStage: PLAYER_HOME_STAGE,
    residentCapacity: 1,
  });
  return venues;
}

function createTownVenues() {
  const districtVenues = DISTRICT_DISPLAY_ORDER.flatMap((district, index) => {
    const zone = DISTRICT_ZONES[district];
    const theme = state.districtThemes.get(district);
    const stripX = zone.x + zone.w - 172;
    const convenience = ORIGINAL_CONVENIENCE_BRANDS[index % ORIGINAL_CONVENIENCE_BRANDS.length];
    const serviceType = SERVICE_VENUE_TYPES[index % SERVICE_VENUE_TYPES.length];
    const communityType = COMMUNITY_VENUE_TYPES[index % COMMUNITY_VENUE_TYPES.length];
    const landmarks = theme.landmarks.slice(0, 2).map((landmark, landmarkIndex) => ({
      id: `${district}-landmark-${landmarkIndex}`,
      district,
      type: "landmark",
      label: landmark.name,
      shortLabel: landmark.shortLabel || landmark.name,
      description: `${district}的代表地標，可在街區裡停留參觀。`,
      sourceUrl: landmark.sourceUrl || theme.sourceUrl,
      landmarkStyle: landmark.style,
      x: stripX + landmarkIndex * 82,
      y: zone.y + 76,
      w: theme.landmarks.length > 1 ? 76 : 158,
      h: 56,
    }));
    return [
      ...landmarks,
      {
        id: `${district}-convenience`, district, type: "convenience-store",
        label: convenience.name, shortLabel: convenience.shortLabel,
        description: "原創便利商店，提供飲水、日用品與簡單補給。",
        brand: convenience, x: stripX, y: zone.y + 154, w: 158, h: 48,
      },
      {
        id: `${district}-snack`, district, type: "snack-shop",
        label: theme.snackShop.name, shortLabel: theme.snackShop.name,
        description: `${district}街區的${theme.snackShop.specialty}小吃意象；店名與人物為遊戲世界設定。`,
        specialty: theme.snackShop.specialty,
        sourceUrl: "https://travel.taichung.gov.tw/zh-tw/experience/gourmet-guide",
        x: stripX, y: zone.y + 220, w: 158, h: 46,
      },
      {
        id: `${district}-${serviceType}`, district, type: serviceType,
        label: `${district.replace("區", "")} ${VENUE_LABELS[serviceType]}`,
        shortLabel: VENUE_LABELS[serviceType],
        description: `${district}的公共服務據點，值勤人員會依任務跨區移動。`,
        x: stripX, y: zone.y + 286, w: 76, h: 48,
      },
      {
        id: `${district}-${communityType}`, district, type: communityType,
        label: VENUE_LABELS[communityType], shortLabel: VENUE_LABELS[communityType],
        description: `${district}居民日常使用的${VENUE_LABELS[communityType]}。`,
        x: stripX + 82, y: zone.y + 286, w: 76, h: 48,
      },
    ];
  });
  const landmarkHubs = LANDMARK_HUB_DEFINITIONS.map((definition) => {
    const [column, row] = definition.grid;
    return {
      ...definition,
      x: DISTRICT_ZONE_ORIGIN_X + column * (DISTRICT_ZONE_WIDTH + DISTRICT_ZONE_GAP_X) + 28,
      y: DISTRICT_ZONE_ORIGIN_Y + row * (DISTRICT_ZONE_HEIGHT + DISTRICT_ZONE_GAP_Y) + 42,
      w: DISTRICT_ZONE_WIDTH - 56,
      h: DISTRICT_ZONE_HEIGHT - 76,
    };
  });
  const residentialVenues = configurePlayerHome(createResidentialVenues());
  const civicCenter = landmarkHubs.find((venue) => venue.id === "civic-center");
  const civicNeighborhood = createCivicNeighborhoodVenues(civicCenter);
  const neighborCountyVenues = createNeighborCountyVenues();
  state.venues = [...districtVenues, ...residentialVenues, ...landmarkHubs, ...civicNeighborhood, ...neighborCountyVenues];
  state.neighborWorkZones = createNeighborWorkZones();
}

function applyTownMapPlacements() {
  const additions = (state.townMapManifest?.placements || []).map((placement) => {
    const zone = districtZoneForName(placement.district);
    if (!zone) return null;
    return {
      id: `town-map-${placement.id}`,
      townMapPlacementId: placement.id,
      editorManaged: true,
      city: placement.city,
      district: placement.district,
      type: placement.type,
      label: placement.label,
      labelEn: placement.labelEn,
      shortLabel: placement.label,
      shortLabelEn: placement.labelEn,
      description: placement.description || `${placement.label}是午餐小鎮編輯器新增的街區場所。`,
      descriptionEn: placement.descriptionEn || `${placement.labelEn} is a neighborhood venue added with the Lunch Town editor.`,
      landmarkStyle: placement.type === "landmark" ? "history" : undefined,
      residentCapacity: placement.type === "apartment" ? 12 : placement.type === "townhouse" ? 6 : undefined,
      x: zone.x + placement.x * zone.w,
      y: zone.y + placement.y * zone.h,
      w: placement.w * zone.w,
      h: placement.h * zone.h,
    };
  }).filter(Boolean);
  state.venues.push(...additions);
}

function townMapNpcIdentity(npc) {
  return {
    district: npc.district,
    name: npc.name,
    nameEn: npc.nameEn,
    role: npc.role,
    gender: npc.gender,
    homeVenueId: `town-map-${npc.primaryVenueId}`,
    editorManaged: true,
    townMapNpcId: npc.id,
  };
}

function appendTownMapNeighborCharacters() {
  const neighborNpcs = (state.townMapManifest?.npcs || []).filter((npc) => npc.city !== SHOWCASE_CITY);
  neighborNpcs.forEach((npc, index) => {
    const countyId = npc.city === "苗栗縣" ? "miaoli" : npc.city === "彰化縣" ? "changhua" : "";
    if (!countyId || !state.neighborDistrictThemes.has(npc.district)) return;
    const identity = {
      ...townMapNpcIdentity(npc),
      countyId,
      countyName: npc.city,
      profileBaseRole: npc.role,
    };
    state.npcs.push(createNeighborNpcCharacter(identity, index + 80, state.npcs.length));
  });
}

function createBikeStations() {
  state.bikeStations = DISTRICT_DISPLAY_ORDER.map((district, index) => {
    const zone = DISTRICT_ZONES[district];
    return {
      id: `${district}-youbike`,
      district,
      label: `${district} YouBike 站`,
      x: zone.x + zone.w - 300,
      y: zone.y + zone.h - 48,
      w: 112,
      h: 32,
      dockCount: 6,
      bikeCount: 4 + index % 3,
    };
  });
}

function bikeStationAccessPoint(station) {
  return { x: station.x + station.w / 2, y: station.y + station.h + 10 };
}

function bikeStationHitRect(station) {
  return { x: station.x, y: station.y - 38, w: station.w, h: station.h + 42 };
}

function npcPrefersBike(identity) {
  return BIKE_ELIGIBLE_ROLES.has(identity.role) && hashText(`${identity.name}-${identity.district}-bike`) % 3 === 0;
}

function bikeStationStop(district, action, role) {
  const station = state.bikeStations.find((item) => item.district === district);
  if (!station) return streetStop(district, 0, role);
  return {
    ...bikeStationAccessPoint(station),
    district,
    label: station.label,
    reason: action === "rent"
      ? `在${station.label}借用 YouBike，準備沿道路前往下一站`
      : `抵達${station.label}並把 YouBike 歸還到車柱`,
    activity: "waiting",
    dwellSeconds: action === "rent" ? 2 : 1,
    bikeStationId: station.id,
    bikeAction: action,
  };
}

function createNpcSchedule(identity, districtIndex) {
  if (["mayor", "civil-servant", "city-supervisor"].includes(identity.role)) {
    const civicSchedule = createCivicCenterSchedule(identity, districtIndex);
    if (civicSchedule.length) return addResidentialStops(identity, civicSchedule, districtIndex, true);
  }
  const mode = mobilityModeFor(identity, districtIndex);
  const seed = hashText(`${identity.name}-${identity.district}-${districtIndex}`);
  const routeDistricts = chooseNpcDistrictRoute(identity, mode, seed);
  const destinations = routeDistricts.map((district, stopIndex) => (
    chooseRoleDestination(identity, district, seed + stopIndex * 17, districtIndex)
  ));
  const schedule = [];
  const bikePreferred = npcPrefersBike(identity);
  destinations.forEach((destination, destinationIndex) => {
    const previous = destinations[(destinationIndex + destinations.length - 1) % destinations.length];
    if (destinationIndex > 0 && previous.district !== destination.district) {
      createCrossDistrictWaypoints(previous.district, destination.district, identity.role, bikePreferred)
        .forEach((point) => schedule.push(point));
    }
    schedule.push(destination);
  });
  const routine = schedule.length ? schedule : [streetStop(identity.district, districtIndex, identity.role)];
  const riverbankLeisureExcursion = createRiverbankLeisureExcursion(identity, districtIndex, seed, mode);
  const neighboringCountyExcursion = createNeighborCountyExcursion(identity, districtIndex, seed, mode);
  return addResidentialStops(
    identity,
    [...routine, ...riverbankLeisureExcursion, ...neighboringCountyExcursion],
    districtIndex,
  );
}

function createRiverbankLeisureExcursion(identity, districtIndex, seed, mode) {
  if (!RIVERBANK_LEISURE_ROLES.has(identity.role)) return [];
  const visitKey = hashText(`${identity.name}-${identity.district}-${districtIndex}-riverbank`);
  if (mode !== "citywide" && (visitKey + districtIndex) % 4 !== 0) return [];
  if (mode === "citywide" && (visitKey + seed) % 3 !== 0) return [];
  const sites = riverbankLeisureSites();
  const activity = visitKey % 3 === 0 ? "barbecuing" : "fishing";
  const matchingSites = sites.filter((site) => site.activity === activity);
  const site = matchingSites[(visitKey + districtIndex) % matchingSites.length];
  if (!site) return [];
  return [{
    x: site.stopX,
    y: site.stopY,
    district: site.district,
    label: site.label,
    reason: activity === "fishing"
      ? "到河濱安全平台釣魚並觀察水流"
      : "到河岸指定休憩區使用烤肉台，結束後收拾火源與垃圾",
    activity,
    dwellSeconds: 14 + visitKey % 9,
    outdoorVenue: true,
    riverbankSiteId: site.id,
    facing: site.bankSide > 0 ? "up" : "down",
  }];
}

function neighborCountyForNpc(identity, districtIndex, seed, mode) {
  const northGateDistricts = new Set(["大安區", "大甲區", "后里區"]);
  const southGateDistricts = new Set(["烏日區", "南區", "大里區", "霧峰區"]);
  const visitKey = hashText(`${identity.name}-${identity.district}-${districtIndex}-neighbor-county`);
  if (northGateDistricts.has(identity.district) && visitKey % 3 === 0) return neighborCountyById("miaoli");
  if (southGateDistricts.has(identity.district) && visitKey % 3 === 0) return neighborCountyById("changhua");
  if (mode === "citywide" && (visitKey + seed) % 11 === 0) {
    return NEIGHBOR_COUNTIES[(visitKey + districtIndex) % NEIGHBOR_COUNTIES.length];
  }
  return null;
}

function neighborCountyStop(county, identity, index) {
  const districtThemes = [...state.neighborDistrictThemes.values()]
    .filter((theme) => theme.county.id === county.id);
  const visitKey = hashText(`${identity.name}-${identity.district}-${county.id}-${index}`);
  const districtTheme = districtThemes[visitKey % districtThemes.length];
  const zone = districtTheme?.zone;
  return {
    x: zone ? zone.x + zone.w / 2 : county.bridgeX,
    y: zone ? zone.y + zone.h - 18 : county.y + county.h / 2,
    district: districtTheme?.name || county.name,
    label: districtTheme?.name || county.name,
    reason: districtTheme ? `到${districtTheme.name}散步，看看當地學校與景觀` : "沿縣界橋前往鄰近縣市散步",
    activity: "waiting",
    dwellSeconds: 8 + (hashText(`${identity.name}-${index}`) % 6),
  };
}

function createNeighborCountyExcursion(identity, districtIndex, seed, mode) {
  const county = neighborCountyForNpc(identity, districtIndex, seed, mode);
  if (!county) return [];
  const bridge = BOUNDARY_BRIDGES.find((item) => item.countyId === county.id);
  if (!bridge) return [];
  const direction = county.side === "north" ? -1 : 1;
  const taichungApproach = bridge.riverY - direction * (BORDER_RIVER_WIDTH / 2 + 24);
  const countyApproach = bridge.riverY + direction * (BORDER_RIVER_WIDTH / 2 + 24);
  const crossingLabel = bridge.material === "iron" ? "縣界鐵橋" : "縣界水泥橋";
  const waypoint = (y, district = "") => ({
    x: bridge.x,
    y,
    district,
    label: crossingLabel,
    reason: "沿縣界橋前往鄰近縣市散步",
    dwellSeconds: 0,
    waypoint: true,
  });
  return [
    waypoint(taichungApproach),
    waypoint(bridge.riverY),
    waypoint(countyApproach, county.name),
    neighborCountyStop(county, identity, districtIndex),
    waypoint(countyApproach, county.name),
    waypoint(bridge.riverY),
    waypoint(taichungApproach),
  ];
}

function addResidentialStops(identity, schedule, districtIndex, startsAtWork = false) {
  if (!identity.residenceVenueId) return schedule;
  const residence = state.venues.find((venue) => venue.id === identity.residenceVenueId);
  if (!residence) return schedule;
  if (startsAtWork) {
    return [
      ...schedule,
      venueScheduleStop(residence, identity.role, districtIndex + 19),
    ];
  }
  return [
    venueScheduleStop(residence, identity.role, districtIndex),
    ...schedule,
    venueScheduleStop(residence, identity.role, districtIndex + 19),
  ];
}

function createCivicCenterSchedule(identity, districtIndex) {
  const civicCenter = state.venues.find((venue) => venue.id === "civic-center");
  if (!civicCenter) return [];
  const schedule = [0, 5, 11, 17].map((offset) => (
    venueScheduleStop(civicCenter, identity.role, districtIndex + offset)
  ));
  if (identity.role === "mayor") {
    const centralPark = state.venues.find((venue) => venue.id === "waternan-central-park");
    if (centralPark) schedule[2] = venueScheduleStop(centralPark, identity.role, districtIndex + 11);
  }
  return schedule;
}

function civicAfterHoursPeriod(environment = state.environment) {
  const hour = Number(environment?.clock?.hour ?? 12);
  if (hour >= 23 || hour < 7) return "late-night";
  if (hour >= 18) return "evening";
  return "daytime";
}

function civicAfterHoursRetailVenue(identity, districtIndex, dateKey) {
  const localConvenience = state.venues.find((venue) => venue.id === "civic-south-night-convenience");
  const choices = [localConvenience, ...eveningShoppingVenues()].filter(Boolean);
  if (!choices.length) return null;
  return choices[hashText(`${dateKey}-${identity.name}-${districtIndex}-civic-after-hours`) % choices.length];
}

function createCivicAfterHoursSchedule(identity, districtIndex, environment = state.environment) {
  if (!CIVIC_AFTER_HOURS_ROLES.has(identity.role) || !identity.residenceVenueId) return [];
  const residence = state.venues.find((venue) => venue.id === identity.residenceVenueId);
  if (!residence) return [];
  const dateKey = environment?.dateKey || "after-hours";
  const period = civicAfterHoursPeriod(environment);
  const homeStop = {
    ...venueScheduleStop(residence, identity.role, districtIndex + 53),
    reason: `已回到${residence.label}，今晚不再返回市府辦公區`,
    activity: "at-home",
    dwellSeconds: 12 * 60 * 60,
  };
  if (period === "late-night" || hashText(`${dateKey}-${identity.name}-stay-home`) % 3 !== 0) {
    return [homeStop];
  }
  const retailVenue = civicAfterHoursRetailVenue(identity, districtIndex, dateKey);
  if (!retailVenue) return [homeStop];
  return [
    {
      ...venueScheduleStop(retailVenue, identity.role, districtIndex + 41),
      reason: `下班後到${retailVenue.label}買晚餐、日用品或逛逛，再回家休息`,
      activity: "shopping",
      dwellSeconds: 16 + districtIndex % 8,
    },
    homeStop,
  ];
}

function transitionCivicAfterHoursRoutine(npc, districtIndex) {
  if (!CIVIC_AFTER_HOURS_ROLES.has(npc.role)) return false;
  const environment = state.environment;
  const period = civicAfterHoursPeriod(environment);
  if (period === "daytime") {
    if (!npc.civicAfterHoursRoutineKey || !npc.civicDaySchedule?.length) return false;
    npc.schedule = npc.civicDaySchedule;
    const homeIndex = npc.schedule.findIndex((stop) => stop.venueId === npc.residenceVenueId);
    npc.segment = homeIndex >= 0 ? homeIndex : npc.schedule.length - 1;
    npc.progress = 0;
    npc.dwellRemaining = 0;
    npc.insideVenueId = "";
    npc.ridingBike = false;
    npc.eveningExcursion = null;
    npc.civicAfterHoursRoutineKey = "";
    npc.currentReason = "早上從住家出發，前往市府辦公區上班";
    return false;
  }
  const dateKey = environment?.dateKey || "after-hours";
  const routineKey = `${dateKey}:${period}`;
  if (npc.civicAfterHoursRoutineKey === routineKey) return true;
  const plannedStops = createCivicAfterHoursSchedule(npc, districtIndex, environment);
  if (!plannedStops.length) return true;
  const currentDistrict = districtAtPoint(npc) || npc.district;
  const origin = {
    x: npc.x,
    y: npc.y,
    district: currentDistrict,
    label: "市府下班出發點",
    reason: "辦公時間已結束，離開市府辦公區安排晚間生活",
    activity: "walking",
    dwellSeconds: 0,
    outdoorVenue: true,
  };
  const schedule = [origin];
  let previousDistrict = currentDistrict;
  plannedStops.forEach((stop) => {
    if (previousDistrict !== stop.district) {
      createCrossDistrictWaypoints(previousDistrict, stop.district, npc.role, false)
        .forEach((point) => schedule.push(point));
    }
    schedule.push(stop);
    previousDistrict = stop.district;
  });
  npc.schedule = schedule;
  npc.segment = 0;
  npc.progress = 0;
  npc.dwellRemaining = 0;
  npc.insideVenueId = "";
  npc.ridingBike = false;
  npc.eveningExcursion = null;
  npc.eveningVisitedDate = dateKey;
  npc.civicAfterHoursRoutineKey = routineKey;
  npc.currentReason = period === "late-night"
    ? `市府已下班，正在回到${npc.residenceLabel || "住家"}休息`
    : "市府已下班，正在回家或安排晚間採買";
  return true;
}

function createNeighborCivicAfterHoursSchedule(identity, districtIndex, environment = state.environment) {
  const home = {
    ...neighborHomeStop(identity, districtIndex),
    dwellSeconds: 12 * 60 * 60,
  };
  if (civicAfterHoursPeriod(environment) === "late-night") return [home];
  const dateKey = environment?.dateKey || "after-hours";
  const retailVenue = state.venues.find((venue) => venue.id === `${identity.countyId}-civic-convenience`);
  if (!retailVenue || hashText(`${dateKey}-${identity.name}-county-shopping`) % 3 !== 0) return [home];
  return [{
    ...venueScheduleStop(retailVenue, identity.role, districtIndex + 41),
    reason: `下班後到${retailVenue.label}買晚餐與日用品，再回住家休息`,
    activity: "shopping",
    dwellSeconds: 14 + districtIndex % 7,
  }, home];
}

function transitionNeighborCivicAfterHoursRoutine(npc, districtIndex) {
  if (!npc.countyId || !NEIGHBOR_CIVIC_ROLES.has(npc.role)) return false;
  const period = civicAfterHoursPeriod(state.environment);
  if (period === "daytime") {
    if (!npc.neighborCivicAfterHoursKey || !npc.civicDaySchedule?.length) return false;
    npc.schedule = npc.civicDaySchedule;
    npc.segment = 0;
    npc.progress = 0;
    npc.dwellRemaining = 0;
    npc.insideVenueId = "";
    npc.neighborCivicAfterHoursKey = "";
    npc.currentReason = "縣府開始辦公，從住家前往辦公大樓服務居民";
    return false;
  }
  const dateKey = state.environment?.dateKey || "after-hours";
  const routineKey = `${dateKey}:${period}`;
  if (npc.neighborCivicAfterHoursKey === routineKey) return true;
  const origin = {
    x: npc.x, y: npc.y, district: districtAtPoint(npc) || npc.district,
    label: "縣府下班出發點", reason: "辦公時間已結束，離開縣政園區安排晚間生活", activity: "walking",
    dwellSeconds: 0, outdoorVenue: true,
  };
  npc.schedule = [origin, ...createNeighborCivicAfterHoursSchedule(npc, districtIndex, state.environment)];
  npc.segment = 0;
  npc.progress = 0;
  npc.dwellRemaining = 0;
  npc.insideVenueId = "";
  npc.ridingBike = false;
  npc.neighborCivicAfterHoursKey = routineKey;
  npc.currentReason = period === "late-night"
    ? `縣府已下班，正在回到${npc.residenceLabel || `${npc.district}住家`}休息`
    : "縣府已下班，正在回家或安排晚間採買";
  return true;
}

function transitionNeighborTimeRoutine(npc) {
  if (!npc.countyId || NEIGHBOR_CIVIC_ROLES.has(npc.role) || !npc.timeSchedule) return false;
  const period = neighborDayPeriod();
  if (npc.neighborRoutineKey === period || !npc.timeSchedule[period]?.length) return false;
  npc.schedule = npc.timeSchedule[period];
  npc.segment = 0;
  npc.progress = 0;
  npc.dwellRemaining = 0;
  npc.insideVenueId = "";
  npc.ridingBike = false;
  npc.eveningExcursion = null;
  npc.neighborRoutineKey = period;
  npc.currentReason = period === "late-night"
    ? `深夜回到${npc.homeDistrict}住家休息`
    : `開始${period === "morning" ? "上午" : period === "midday" ? "午間" : "傍晚"}的在地行程`;
  return true;
}

function mobilityModeFor(identity, districtIndex) {
  if (identity.featuredResident) return "neighborhood";
  if (["candidate", "mayor", "city-councilor", "police-officer", "firefighter", "doctor"].includes(identity.role)) return "citywide";
  if (identity.role === "student") return districtIndex % 2 ? "nearby" : "neighborhood";
  return ["neighborhood", "nearby", "citywide"][(hashText(identity.name) + districtIndex) % 3];
}

function chooseNpcDistrictRoute(identity, mode, seed) {
  const homeIndex = DISTRICT_DISPLAY_ORDER.indexOf(identity.district);
  if (mode === "neighborhood") return [identity.district, identity.district, identity.district];
  const nearby = DISTRICT_DISPLAY_ORDER.filter((district) => district !== identity.district && districtGridDistance(identity.district, district) <= 2);
  const citywide = DISTRICT_DISPLAY_ORDER.filter((district) => district !== identity.district);
  const pool = mode === "nearby" && nearby.length ? nearby : citywide;
  const count = identity.role === "candidate" ? 6 : mode === "citywide" ? 4 : 2;
  // 每位候選人的首站固定為資料中設定的不同起始行政區；跨區走訪從第二站才開始。
  const route = [identity.district];
  for (let offset = 0; route.length < count; offset += 1) {
    const district = pool[(seed + homeIndex * 7 + offset * 11) % pool.length];
    if (!route.includes(district)) route.push(district);
  }
  route.push(identity.district);
  return route;
}

function districtGridDistance(firstDistrict, secondDistrict) {
  const first = DISTRICT_ZONES[firstDistrict];
  const second = DISTRICT_ZONES[secondDistrict];
  if (!first || !second) return Number.POSITIVE_INFINITY;
  const firstColumn = Math.round((first.x - DISTRICT_ZONE_ORIGIN_X) / (DISTRICT_ZONE_WIDTH + DISTRICT_ZONE_GAP_X));
  const firstRow = Math.round((first.y - DISTRICT_ZONE_ORIGIN_Y) / (DISTRICT_ZONE_HEIGHT + DISTRICT_ZONE_GAP_Y));
  const secondColumn = Math.round((second.x - DISTRICT_ZONE_ORIGIN_X) / (DISTRICT_ZONE_WIDTH + DISTRICT_ZONE_GAP_X));
  const secondRow = Math.round((second.y - DISTRICT_ZONE_ORIGIN_Y) / (DISTRICT_ZONE_HEIGHT + DISTRICT_ZONE_GAP_Y));
  return Math.abs(firstColumn - secondColumn) + Math.abs(firstRow - secondRow);
}

function chooseRoleDestination(identity, district, seed, districtIndex) {
  if (identity.homeVenueId && district === identity.district) {
    const homeVenue = state.venues.find((venue) => venue.id === identity.homeVenueId);
    if (homeVenue) return venueScheduleStop(homeVenue, identity.role, districtIndex);
  }
  if (state.isWeekend && WEEKEND_MARKET_ROLES.has(identity.role) && (seed + districtIndex) % 3 !== 0) {
    return weekendMarketStop(district, districtIndex, identity.role);
  }
  const featuredVenues = state.venues.filter((venue) => venue.district === district
    && venue.hubKind && hubSupportsRole(venue, identity.role));
  if (featuredVenues.length && (seed + districtIndex) % 3 !== 0) {
    return venueScheduleStop(featuredVenues[seed % featuredVenues.length], identity.role, districtIndex);
  }
  const preferences = ROLE_DESTINATION_PREFERENCES[identity.role] || ["landmark", "convenience-store", "park", "snack-shop"];
  for (let preferenceIndex = 0; preferenceIndex < preferences.length; preferenceIndex += 1) {
    const type = preferences[(seed + preferenceIndex) % preferences.length];
    if (type === "school") {
      const schools = state.schools.filter((school) => school.district === district);
      const school = schools[(seed + districtIndex) % Math.max(1, schools.length)];
      if (school) {
        const gate = schoolGatePoint(school);
        return {
          ...gate,
          district,
          label: school.name,
          reason: reasonAtSchool(identity.role),
          activity: activityForDestination(identity.role, "school", seed),
          dwellSeconds: 5 + seed % 5,
        };
      }
    }
    const venues = state.venues.filter((venue) => venue.district === district && venue.type === type);
    const venue = venues[seed % Math.max(1, venues.length)];
    if (venue) return venueScheduleStop(venue, identity.role, districtIndex);
  }
  return streetStop(district, districtIndex, identity.role);
}

function hubSupportsRole(venue, role) {
  const visitorsByHub = {
    "central-park": ["student", "parent", "senior", "community-resident", "sanitation-worker", "mayor", "borough-chief", "candidate"],
    "harbor-outlet": ["parent", "student", "office-worker", "delivery-worker", "vendor", "community-resident", "candidate"],
    "civic-center": ["office-worker", "civil-servant", "city-supervisor", "mayor", "borough-chief", "city-councilor", "candidate", "delivery-worker", "community-resident"],
    stadium: ["student", "high-school-student", "parent", "senior", "community-resident", "vendor", "sanitation-worker"],
    lalaport: ["student", "parent", "office-worker", "university-student", "delivery-worker", "vendor", "community-resident"],
    hospital: ["doctor", "nurse", "senior", "parent", "delivery-worker", "community-resident"],
    "asia-museum": ["student", "teacher", "university-student", "senior", "parent", "community-resident"],
  };
  return (visitorsByHub[venue.hubKind] || []).includes(role);
}

function venueScheduleStop(venue, role, index) {
  const visitorX = venue.hubKind
    ? venue.x + 46 + (hashText(`${venue.id}-${role}-${index}`) % Math.max(1, venue.w - 92))
    : venue.x + venue.w / 2;
  const visitorY = venue.hubKind
    ? venue.y + 72 + (hashText(`${role}-${venue.id}-${index}-y`) % Math.max(1, venue.h - 112))
    : venue.y + venue.h + 13;
  return {
    x: visitorX,
    y: visitorY,
    district: venue.district,
    venueId: venue.id,
    label: venue.label,
    reason: reasonAtVenue(role, venue.type, venue.label),
    activity: activityForDestination(role, venue.type, index + venue.label.length),
    dwellSeconds: RESIDENTIAL_VENUE_TYPES.has(venue.type) ? 9 + (index % 5) : 5 + (index + venue.label.length) % 6,
    outdoorVenue: Boolean(venue.hubKind),
  };
}

function weekendMarketStop(district, index, role) {
  const zone = DISTRICT_ZONES[district];
  return {
    x: zone.x + zone.w - 224 + index % 3 * 24,
    y: zone.y + 62,
    district,
    label: `${district}週末市場`,
    reason: ["student", "high-school-student"].includes(role)
      ? "學校休息，和家人到週末市場認識食材"
      : "週末到市場採買、用餐並和居民交流",
    activity: role === "delivery-worker" ? "delivery" : role === "vendor" ? "stocking" : "shopping",
    dwellSeconds: 7 + index % 5,
    weekendMarket: true,
  };
}

function streetStop(district, index, role) {
  const zone = DISTRICT_ZONES[district];
  return {
    x: zone.x + 42 + index % 4 * 38,
    y: zone.y + zone.h - 22,
    district,
    label: `${district}街區步道`,
    reason: reasonOnStreet(role),
    activity: role === "sanitation-worker" ? "sweeping" : role === "delivery-worker" ? "delivery" : "waiting",
    dwellSeconds: 3 + index % 4,
  };
}

function activityForDestination(role, venueType, seed = 0) {
  if (role === "sanitation-worker") return venueType === "park" ? "sweeping" : "waiting";
  if (role === "delivery-worker") return "delivery";
  if (role === "vendor") return "stocking";
  if (RESIDENTIAL_VENUE_TYPES.has(venueType)) return "at-home";
  if (venueType === "school") {
    if (role === "parent") return "school-pickup";
    if (["student", "high-school-student"].includes(role)) return seed % 2 ? "greeting" : "waiting";
    return "waiting";
  }
  if (role === "fitness-coach" && ["park", "stadium"].includes(venueType)) return "exercising";
  if (venueType === "park") {
    if (role === "senior") return seed % 2 ? "exercising" : "resting";
    if (["student", "community-resident", "parent"].includes(role)) return seed % 2 ? "feeding-birds" : "watching-birds";
    return "resting";
  }
  if (venueType === "stadium") return seed % 2 ? "exercising" : "resting";
  if (venueType === "museum") return seed % 2 ? "waiting" : "resting";
  if (venueType === "office-building") return seed % 3 === 0 ? "queuing" : "waiting";
  if (["restaurant", "snack-shop", "convenience-store", "grocery-store"].includes(venueType)) {
    return seed % 3 === 0 ? "queuing" : "shopping";
  }
  return seed % 2 ? "waiting" : "resting";
}

function createCrossDistrictWaypoints(fromDistrict, toDistrict, role, useBike = false) {
  const from = DISTRICT_ZONES[fromDistrict];
  const to = DISTRICT_ZONES[toDistrict];
  const fromCenter = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
  const toCenter = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  const fromAnchor = {
    x: toCenter.x >= fromCenter.x ? from.x + from.w + DISTRICT_ZONE_GAP_X / 2 : from.x - DISTRICT_ZONE_GAP_X / 2,
    y: toCenter.y >= fromCenter.y ? from.y + from.h + DISTRICT_ZONE_GAP_Y / 2 : from.y - DISTRICT_ZONE_GAP_Y / 2,
  };
  const toAnchor = {
    x: fromCenter.x <= toCenter.x ? to.x - DISTRICT_ZONE_GAP_X / 2 : to.x + to.w + DISTRICT_ZONE_GAP_X / 2,
    y: fromCenter.y <= toCenter.y ? to.y - DISTRICT_ZONE_GAP_Y / 2 : to.y + to.h + DISTRICT_ZONE_GAP_Y / 2,
  };
  const roadWaypoints = [fromAnchor, { x: fromAnchor.x, y: toAnchor.y }, toAnchor].map((point) => ({
    x: Math.max(14, Math.min(WORLD_WIDTH - 14, point.x)),
    y: Math.max(14, Math.min(WORLD_HEIGHT - 14, point.y)),
    district: "",
    label: `${toDistrict}方向道路`,
    reason: reasonOnStreet(role),
    dwellSeconds: 0,
    waypoint: true,
    bikeRoute: useBike,
  }));
  if (!useBike) return roadWaypoints;
  return [
    bikeStationStop(fromDistrict, "rent", role),
    ...roadWaypoints,
    bikeStationStop(toDistrict, "return", role),
  ];
}

function npcWalkingSpeed(ageGroup, role, index) {
  if (ageGroup === "senior") return 12 + index % 3;
  if (ageGroup === "child") return 15 + index % 3;
  if (ageGroup === "teen") return 16 + index % 3;
  if (["mayor", "borough-chief", "city-councilor", "candidate", "civil-servant", "city-supervisor",
    "county-magistrate", "county-civil-servant", "county-supervisor", "county-councilor", "township-officer"].includes(role)) return 14 + index % 2;
  return 15 + index % 4;
}

function reasonAtSchool(role) {
  const reasons = {
    student: "準時到校，準備上課與午餐時間",
    teacher: "到校查看班級與用餐安排",
    nutritionist: "核對校方菜單與供餐資料",
    cook: "確認備料與送餐時間",
    nurse: "查看健康照護與過敏通報流程",
    "crossing-guard": "依時段維護校門通行安全",
    gardener: "照顧校園菜園與植栽",
    librarian: "整理食農教育書籍",
    principal: "巡視校園與供餐動線",
    parent: "依約到校了解孩子的用餐情況",
    "college-volunteer": "協助校園食農教育活動",
    "high-school-student": "完成校際服務學習行程",
    "university-student": "進行校園食農志工服務",
    "civil-servant": "到校確認市府與校園協作事項",
    "city-supervisor": "了解跨局處校園服務的執行情形",
    mayor: "聽取校園午餐與教育現場需求",
    "borough-chief": "確認里內校園周邊問題",
    "city-councilor": "了解午餐預算與執行情況",
    candidate: "蒐集家長對校園午餐的意見",
    "police-officer": "執行校園周邊安全巡查",
    firefighter: "進行校園消防通道與防災宣導",
    doctor: "進行校園健康衛教行程",
    "sanitation-worker": "整理校門周邊落葉與回收物",
    "delivery-worker": "依清單送達校園物資",
    "county-magistrate": "聽取校園午餐、教育與通學環境的現場需求",
    "county-civil-servant": "到校確認縣府與校園協作事項",
    "county-supervisor": "了解縣府跨處室校園服務的執行情形",
    "county-councilor": "了解午餐預算、校園需求與執行情況",
    "township-officer": "確認公所轄內校園周邊與公共服務問題",
  };
  return reasons[role] || "依行程到校辦理事情";
}

function reasonAtVenue(role, venueType, venueName = "") {
  const label = venueName || VENUE_LABELS[venueType] || "街區設施";
  if (RESIDENTIAL_VENUE_TYPES.has(venueType)) return `回到${label}休息、整理家務並準備下一段行程`;
  if (role === "police-officer") return venueType === "police-station" ? "回警察局整理巡邏勤務紀錄" : `巡查${label}周邊安全與人行動線`;
  if (role === "firefighter") return venueType === "fire-station" ? "返回消防局整備器材" : `前往${label}檢查消防通道與防災設備`;
  if (role === "doctor") return venueType === "hospital" ? "返回醫院照顧病人與完成紀錄" : `依社區健康行程前往${label}`;
  if (role === "sanitation-worker") return venueType === "park" ? "整理公園步道與落葉" : `清理${label}周邊並保持通道暢通`;
  if (role === "delivery-worker") return `依配送清單把物資送到${label}`;
  if (role === "civil-servant") return venueType === "office-building" ? `在${label}整理案件、服務居民並回覆進度` : `依公務行程前往${label}確認資料`;
  if (role === "city-supervisor") return venueType === "office-building" ? `在${label}主持會議並追蹤跨局處工作` : `前往${label}了解公共服務執行情形`;
  if (role === "county-magistrate") return `到${label}了解縣政服務與居民實際需求`;
  if (role === "county-civil-servant") return `在${label}整理案件、服務居民並回覆處理進度`;
  if (role === "county-supervisor") return `在${label}確認跨處室工作的責任與時程`;
  if (role === "county-councilor") return `到${label}了解預算、執行紀錄與居民關心的議題`;
  if (role === "township-officer") return `在${label}辦理地方公共服務並整理巡查紀錄`;
  if (role === "candidate") return `跨區走訪${label}，向居民問候並聽取意見`;
  if (role === "office-worker") return label === "餐廳" ? "利用午休時間用餐" : `完成下班前的${label}行程`;
  if (role === "senior") return label === "公園" ? "依日常習慣散步休息" : `採買生活所需並在${label}稍作休息`;
  if (role === "student") return `放學後由熟悉的路線前往${label}`;
  if (["high-school-student", "university-student"].includes(role)) return `為課業或社團任務前往${label}`;
  if (["mayor", "borough-chief", "city-councilor", "candidate"].includes(role)) return `到${label}聽取居民的實際需求`;
  return `依工作或生活安排前往${label}`;
}

function reasonOnStreet(role) {
  if (role === "crossing-guard") return "按時巡查路口與行人動線";
  if (["mayor", "borough-chief", "city-councilor", "candidate"].includes(role)) return "走訪街區並記錄居民反映";
  if (role === "police-officer") return "依勤務路線跨區巡邏並確認街道安全";
  if (role === "firefighter") return "前往下一處防災與消防設備任務";
  if (role === "doctor") return "依醫療與社區健康行程前往下一站";
  if (role === "sanitation-worker") return "沿街整理落葉、回收物與人行空間";
  if (role === "delivery-worker") return "依配送順序前往下一個收貨地點";
  if (role === "civil-servant") return "依市府行程前往服務櫃檯、會議室或下一個訪查地點";
  if (role === "city-supervisor") return "前往下一場會議並確認跨局處工作進度";
  if (role === "senior") return "沿熟悉步道安全返家";
  if (["student", "high-school-student"].includes(role)) return "依放學路線前往下一站";
  return "按照今天的行程前往下一個目的地";
}

function taichungClockParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("zh-TW", {
    timeZone: TAICHUNG_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function townEnvironmentAt(date = new Date()) {
  const clock = taichungClockParts(date);
  const minuteOfDay = clock.hour * 60 + clock.minute;
  const dawnStart = 5 * 60;
  const dayStart = 6 * 60 + 30;
  const duskStart = 17 * 60 + 30;
  const nightStart = 19 * 60;
  let darkness = 0;
  let phase = "白天";
  let phaseProgress = 0;
  if (minuteOfDay < dawnStart || minuteOfDay >= nightStart) {
    darkness = MAX_NIGHT_DARKNESS;
    phase = "夜晚";
  } else if (minuteOfDay < dayStart) {
    phaseProgress = (minuteOfDay - dawnStart) / (dayStart - dawnStart);
    darkness = (1 - phaseProgress) * MAX_NIGHT_DARKNESS;
    phase = "黎明";
  } else if (minuteOfDay >= duskStart) {
    phaseProgress = (minuteOfDay - duskStart) / (nightStart - duskStart);
    darkness = phaseProgress * MAX_NIGHT_DARKNESS;
    phase = "黃昏";
  }

  const dateKey = `${clock.year}-${String(clock.month).padStart(2, "0")}-${String(clock.day).padStart(2, "0")}`;
  const rainBlock = Math.floor(minuteOfDay / RAIN_BLOCK_MINUTES);
  const minuteInBlock = minuteOfDay % RAIN_BLOCK_MINUTES;
  const rainSeed = hashText(`${dateKey}-${rainBlock}-taichung-shower`);
  const rainDuration = 18 + ((rainSeed >>> 8) % 19);
  const rainStart = 12 + ((rainSeed >>> 16) % Math.max(1, RAIN_BLOCK_MINUTES - rainDuration - 24));
  const rainElapsed = minuteInBlock - rainStart;
  const isRaining = rainSeed % 5 === 0 && rainElapsed >= 0 && rainElapsed < rainDuration;
  const rainIntensity = isRaining
    ? 0.34 + Math.sin(Math.PI * rainElapsed / rainDuration) * 0.66
    : 0;
  const isNight = phase === "夜晚";

  return {
    clock,
    dateKey,
    timeLabel: `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`,
    phase,
    phaseProgress,
    darkness,
    isNight,
    isRaining,
    rainIntensity,
  };
}

function updateTownEnvironment(now, force = false) {
  if (!force && now - state.environmentUpdatedAt < ENVIRONMENT_REFRESH_MS) return;
  const wasRaining = Boolean(state.environment?.isRaining);
  state.environment = townEnvironmentAt(new Date());
  state.environmentUpdatedAt = now;
  const environment = state.environment;
  syncCurrentMealDate(environment);
  const condition = `${environment.phase}${environment.isRaining ? "・短暫陣雨" : ""}`;
  const statusKey = `${environment.timeLabel}-${condition}`;
  if (statusKey === state.environmentStatusKey) return;
  state.environmentStatusKey = statusKey;
  refs.environmentStatus.classList.toggle("is-night", environment.isNight);
  refs.environmentStatus.classList.toggle("is-dawn", environment.phase === "黎明");
  refs.environmentStatus.classList.toggle("is-dusk", environment.phase === "黃昏");
  refs.environmentStatus.classList.toggle("is-raining", environment.isRaining);
  const phaseIcon = { 黎明: "◒", 白天: "☀", 黃昏: "◓", 夜晚: "☾" }[environment.phase] || "☀";
  refs.environmentStatus.querySelector("span").textContent = environment.isRaining ? "☂" : phaseIcon;
  refs.environmentStatus.querySelector("small").textContent = `${environment.timeLabel}・${condition}`;
  if (state.ready && !wasRaining && environment.isRaining && !state.dailyStory?.choiceId) {
    setupDailyStory();
    renderDailyStory();
    announce("短暫陣雨來了，居民正往騎樓移動，今日街區故事也出現了新的幫忙機會。");
  }
}

function taichungWeekdayIndex(clock) {
  return new Date(Date.UTC(clock.year, clock.month - 1, clock.day)).getUTCDay();
}

function townMealDateKey(clock = taichungClockParts()) {
  return `${clock.year}-${String(clock.month).padStart(2, "0")}-${String(clock.day).padStart(2, "0")}`;
}

function isTaichungWeekend(clock) {
  return [0, 6].includes(taichungWeekdayIndex(clock));
}

function dailyStoryCopy(value, story) {
  return String(value || "")
    .replaceAll("{district}", story.district)
    .replaceAll("{name}", story.actor ? npcDisplayName(story.actor) : townText("一位居民"));
}

function setupDailyStory() {
  const environment = state.environment || townEnvironmentAt();
  const district = state.activeDistrict || "西區";
  const seed = hashText(`${environment.dateKey}-${district}-daily-story`);
  const template = environment.isRaining
    ? RAIN_STORY_TEMPLATE
    : state.isWeekend
      ? WEEKEND_STORY_TEMPLATE
      : DAILY_STORY_TEMPLATES[seed % DAILY_STORY_TEMPLATES.length];
  const districtActors = state.npcs.filter((npc) => npc.district === district && template.actorRoles.includes(npc.role));
  const actors = districtActors.length ? districtActors : state.npcs.filter((npc) => template.actorRoles.includes(npc.role));
  const actor = actors[seed % Math.max(1, actors.length)] || state.npcs[0];
  state.dailyStory = {
    ...template,
    district,
    actor,
    dateKey: environment.dateKey,
    choiceId: "",
    outcome: "",
  };
}

function renderDailyStory() {
  const story = state.dailyStory;
  if (!story) return;
  const clock = state.environment.clock;
  const weekdays = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
  refs.dailyStoryDate.textContent = `${clock.month} 月 ${clock.day} 日・${weekdays[taichungWeekdayIndex(clock)]}・${story.district}`;
  refs.dailyStoryTitle.textContent = story.title;
  refs.dailyStoryText.textContent = dailyStoryCopy(story.text, story);
  refs.dailyStoryChoices.innerHTML = story.choices.map((choice) => `
    <button type="button" data-story-choice="${escapeAttribute(choice.id)}" ${story.choiceId ? "disabled" : ""}>
      ${escapeHtml(choice.label)}
    </button>
  `).join("");
  refs.dailyStoryResult.hidden = !story.outcome;
  refs.dailyStoryResult.textContent = story.outcome;
}

function storyVenueForChoice(story, choice) {
  if (!choice.venueType) return null;
  const preferred = state.venues.find((venue) => venue.district === story.district && venue.type === choice.venueType);
  if (preferred) return preferred;
  return state.venues.find((venue) => venue.district === story.district
    && ["convenience-store", "snack-shop", "landmark"].includes(venue.type)) || null;
}

function chooseDailyStory(choiceId) {
  const story = state.dailyStory;
  if (!story || story.choiceId) return;
  const choice = story.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) return;
  const outcome = dailyStoryCopy(choice.outcome, story);
  const venue = storyVenueForChoice(story, choice);
  story.choiceId = choice.id;
  story.outcome = outcome;
  if (story.actor) {
    story.actor.storyReason = outcome;
    story.actor.currentReason = outcome;
    story.actor.hasUmbrella = Boolean(choice.givesUmbrella);
    story.actor.storyVenueId = venue?.id || "";
    story.actor.dialogues = [outcome, ...story.actor.dialogues];
  }
  addTownRumor(story.district, story.id, outcome);
  renderDailyStory();
  trackTownEvent("lunch_town_story_choice", {
    district: story.district,
    story_type: story.id,
    choice_id: choice.id,
  });
  void recordAchievementEvent("daily_story", story.dateKey);
  announce(`${story.title}：${outcome}`);
}

function scheduleTownFrame() {
  if (!state.frameRequestId) state.frameRequestId = requestAnimationFrame(frame);
}

function ensureTownFrameRunning() {
  const stale = performance.now() - state.lastFrameAt > 250;
  if (stale && state.frameRequestId) cancelAnimationFrame(state.frameRequestId);
  if (stale) state.frameRequestId = 0;
  scheduleTownFrame();
}

function frame(now) {
  state.frameRequestId = 0;
  state.lastFrameAt = now;
  try {
    if (document.hidden || !state.canvasVisible) {
      state.lastTime = now;
      return;
    }
    const delta = Math.min(0.04, Math.max(0, (now - state.lastTime) / 1000));
    state.lastTime = now;
    updateTownEnvironment(now);
    if (state.ready && !refs.dialog.open && !state.dialogueNpc) {
      updatePlayer(delta);
      updateNpcs(delta);
      updatePets(delta);
      updateBirds(delta);
      updateTownMoment(now);
      updateTownEvent(now, delta);
      updateAmbientConversation(now);
    }
    if (state.ready) updateCamera(false, delta);
    drawTown(now, state.environment);
    renderComicBubble();
    state.frameErrorReported = false;
  } catch (error) {
    console.error("Lunch Town frame recovered after an update error", error);
    state.lastTime = now;
    state.moveTarget = null;
    state.pendingBikeStationId = "";
    if (!state.frameErrorReported) {
      state.frameErrorReported = true;
      announce("小鎮已自動略過一次畫面更新；請再按方向鍵即可繼續移動。");
    }
  } finally {
    scheduleTownFrame();
  }
}

function updatePlayer(delta) {
  const previousX = state.player.x;
  const previousY = state.player.y;
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
  const requestedMovement = Boolean(dx || dy);
  state.player.isMoving = requestedMovement;
  if (requestedMovement) {
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    const speed = state.player.ridingBike ? PLAYER_BIKE_SPEED : PLAYER_WALK_SPEED;
    const movedX = tryMovePlayer(dx * speed * delta, 0);
    const movedY = tryMovePlayer(0, dy * speed * delta);
    state.player.isMoving = movedX || movedY;
    if (state.moveTarget && !state.player.isMoving) state.moveTarget = null;
    if (state.player.isMoving) {
      if (Math.abs(dx) > Math.abs(dy)) state.player.direction = dx > 0 ? "right" : "left";
      else state.player.direction = dy > 0 ? "down" : "up";
      state.player.step += delta * (state.player.ridingBike ? 18 : 10);
    }
  }
  if (!state.player.ridingBike) {
    accumulateDailyWalkDistance(Math.hypot(state.player.x - previousX, state.player.y - previousY));
  }
  if (state.pendingBikeStationId) {
    const station = state.bikeStations.find((item) => item.id === state.pendingBikeStationId);
    const accessPoint = station ? bikeStationAccessPoint(station) : null;
    if (!station || !accessPoint) {
      state.pendingBikeStationId = "";
    } else if (Math.hypot(state.player.x - accessPoint.x, state.player.y - accessPoint.y) < 54) {
      state.pendingBikeStationId = "";
      state.moveTarget = null;
      interactWithBikeStation(station, "map_arrival");
    }
  }
  updateNearbyPrompt();
  observeDailyQuestWorld();
}

function accumulateDailyWalkDistance(distance) {
  if (!Number.isFinite(distance) || distance <= 0) return;
  state.dailyWalkPending += distance;
  while (state.dailyWalkPending >= 50) {
    state.dailyWalkPending -= 50;
    const eventKey = dailyQuestInstance("walk");
    void recordDailyQuestEvent("walk_distance", "walkable", 50, eventKey);
  }
}

function observeDailyQuestWorld() {
  const school = nearbySchool();
  if (school) void recordDailyQuestEvent("school_gate", String(school.fatraceSchoolId));

  const nearbyRole = state.npcs
    .filter((npc) => !npc.insideVenueId && ["cook", "nutritionist"].includes(npc.role))
    .find((npc) => Math.hypot(state.player.x - npc.x, state.player.y - npc.y) < 54);
  if (nearbyRole) void recordDailyQuestEvent("role_observe", nearbyRole.role);

  const nearbyDog = state.pets.find((pet) => (
    pet.kind === "dog" && !pet.hidden && Math.hypot(state.player.x - pet.x, state.player.y - pet.y) < 58
  ));
  if (nearbyDog) void recordDailyQuestEvent("dog_observe", "leashed-dog");

  observeDailyBridgeCrossing();
  observeDailyMapCheckpoints();
}

function observeDailyBridgeCrossing() {
  for (const bridge of BOUNDARY_BRIDGES) {
    if (Math.abs(state.player.x - bridge.x) > 62) continue;
    const riverDistance = Math.abs(state.player.y - bridge.riverY);
    if (riverDistance <= BORDER_RIVER_WIDTH / 2 + 22) continue;
    const side = state.player.y < bridge.riverY ? "north" : "south";
    const previousSide = state.dailyBridgeSides.get(bridge.id);
    state.dailyBridgeSides.set(bridge.id, side);
    if (previousSide && previousSide !== side) {
      const checkpoint = bridge.countyId === "miaoli" ? "bridge-north" : "bridge-south";
      void recordDailyQuestEvent("checkpoint_visit", checkpoint);
    }
  }
}

function observeDailyMapCheckpoints() {
  const coastDistance = state.player.x - coastlineXAt(state.player.y);
  if (coastDistance >= PLAYER_TERRAIN_PADDING && coastDistance <= 72) {
    void recordDailyQuestEvent("checkpoint_visit", "coast");
  }
  const mountainDistance = EAST_MOUNTAIN_START_X - state.player.x;
  if (mountainDistance >= PLAYER_TERRAIN_PADDING && mountainDistance <= 72) {
    void recordDailyQuestEvent("checkpoint_visit", "mountain");
  }
  const nearRiverbank = BOUNDARY_BRIDGES.some((bridge) => {
    const distance = Math.abs(state.player.y - boundaryRiverYAt(state.player.x, bridge));
    return Math.abs(state.player.x - bridge.x) > 90
      && distance >= BORDER_RIVER_WIDTH / 2 + PLAYER_TERRAIN_PADDING
      && distance <= BORDER_RIVER_WIDTH / 2 + 48;
  });
  if (nearRiverbank) void recordDailyQuestEvent("checkpoint_visit", "riverbank");

  for (const county of NEIGHBOR_COUNTIES) {
    const signX = county.bridgeX + (county.side === "north" ? 92 : -258) + 83;
    const signY = (county.side === "north" ? county.y + county.h - 104 : county.y + 8) + 48;
    if (Math.hypot(state.player.x - signX, state.player.y - signY) < 92) {
      void recordDailyQuestEvent("checkpoint_visit", `${county.id}-sign`);
    }
  }
}

function tryMovePlayer(dx, dy) {
  const next = { x: state.player.x + dx, y: state.player.y + dy };
  next.x = Math.max(12, Math.min(WORLD_WIDTH - 12, next.x));
  next.y = Math.max(12, Math.min(WORLD_HEIGHT - 12, next.y));
  const nextBlocked = isBlockedTownTerrain(next);
  const currentBlocked = isBlockedTownTerrain(state.player);
  const currentBlockDepth = currentBlocked ? blockedTerrainEscapeDepth(state.player) : 0;
  const nextBlockDepth = nextBlocked ? blockedTerrainEscapeDepth(next) : 0;
  const canEscapeBlockedTerrain = currentBlocked && nextBlockDepth < currentBlockDepth;
  if ((next.x === state.player.x && next.y === state.player.y)
    || (nextBlocked && !canEscapeBlockedTerrain)) return false;
  state.player.x = next.x;
  state.player.y = next.y;
  return true;
}

function pointIsOnBoundaryBridge(point, bridge) {
  return Math.abs(point.x - bridge.x) <= BOUNDARY_BRIDGE_PASSAGE_HALF_WIDTH
    && Math.abs(point.y - bridge.riverY) <= BORDER_RIVER_WIDTH / 2 + 30;
}

function isBlockedTownTerrain(point) {
  if (point.x - PLAYER_TERRAIN_PADDING <= coastlineXAt(point.y)) return true;
  if (point.x + PLAYER_TERRAIN_PADDING >= EAST_MOUNTAIN_START_X) return true;
  if (state.neighborWorkZones.some((zone) => zone.restricted && pointInExpandedRect(point, zone, PLAYER_TERRAIN_PADDING))) return true;
  // Administrative-area scenery shares land with schools, public facilities,
  // attractions and farms. Keep those blocks walkable instead of treating an
  // entire hill or field backdrop as one oversized collision rectangle.
  return BOUNDARY_BRIDGES.some((bridge) => (
    !pointIsOnBoundaryBridge(point, bridge)
    && Math.abs(point.y - boundaryRiverYAt(point.x, bridge))
      <= BORDER_RIVER_WIDTH / 2 + PLAYER_TERRAIN_PADDING
  ));
}

function pointDepthInsideRect(point, rect) {
  if (!pointInRect(point, rect)) return 0;
  return Math.max(0, Math.min(
    point.x - rect.x,
    rect.x + rect.w - point.x,
    point.y - rect.y,
    rect.y + rect.h - point.y,
  ));
}

function blockedTerrainEscapeDepth(point) {
  const depths = [
    Math.max(0, coastlineXAt(point.y) + PLAYER_TERRAIN_PADDING - point.x),
    Math.max(0, point.x + PLAYER_TERRAIN_PADDING - EAST_MOUNTAIN_START_X),
  ];
  state.neighborWorkZones.filter((zone) => zone.restricted).forEach((zone) => {
    depths.push(pointDepthInsideRect(point, {
      x: zone.x - PLAYER_TERRAIN_PADDING,
      y: zone.y - PLAYER_TERRAIN_PADDING,
      w: zone.w + PLAYER_TERRAIN_PADDING * 2,
      h: zone.h + PLAYER_TERRAIN_PADDING * 2,
    }));
  });
  BOUNDARY_BRIDGES.forEach((bridge) => {
    if (pointIsOnBoundaryBridge(point, bridge)) return;
    depths.push(Math.max(
      0,
      BORDER_RIVER_WIDTH / 2 + PLAYER_TERRAIN_PADDING
        - Math.abs(point.y - boundaryRiverYAt(point.x, bridge)),
    ));
  });
  return Math.max(...depths);
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
    if (state.ready && district && !state.analyticsVisitedDistricts.has(district)) {
      state.analyticsVisitedDistricts.add(district);
      trackTownEvent("lunch_town_district_entered", { district });
    }
    if (state.ready && state.districtThemes.has(district)) void recordAchievementEvent("district_visit", district);
    const theme = state.districtThemes.get(district);
    const neighborDistrictTheme = state.neighborDistrictThemes.get(district);
    const neighborCounty = neighborDistrictTheme?.county || NEIGHBOR_COUNTIES.find((county) => county.name === district);
    const neighborCountyTheme = neighborCounty ? state.neighborCountyThemes.get(neighborCounty.id) : null;
    const neighborDistrictSchools = neighborDistrictTheme
      ? state.neighborSchools.filter((school) => school.city === neighborCounty.name && school.district === district)
      : [];
    const neighborAvailableCount = neighborDistrictSchools.filter(schoolHasCurrentMeal).length;
    const neighborMealStatus = neighborAvailableCount
      ? townText(`今日 ${neighborAvailableCount}/${neighborDistrictSchools.length} 校有午餐資料`)
      : townText("各校當日午餐可查詢");
    refs.districtBadge.textContent = theme
      ? `${theme.group}・${district}`
      : neighborDistrictTheme
        ? `${townText(neighborCounty.name)}・${townText(district)}`
      : neighborCounty
        ? townText(neighborCounty.name)
        : "臺中小鎮街道";
    refs.districtFeature.textContent = theme
      ? `${theme.featureLabel}｜${theme.tagline}`
      : neighborDistrictTheme
        ? `${townText(neighborDistrictTheme.featureLabel)}｜${neighborMealStatus}`
      : neighborCounty
        ? townText("校園已放入地圖｜各校當日午餐可查詢")
        : state.mapNote;
    const sourceUrl = theme?.sourceUrl || neighborCountyTheme?.sourceUrl || "";
    refs.districtSource.hidden = !sourceUrl;
    if (sourceUrl) {
      refs.districtSource.href = sourceUrl;
      refs.districtSource.setAttribute("aria-label", townText(`查看${district}特色的官方參考來源`));
    }
  }
}

function districtAtPoint(point) {
  return DISTRICT_DISPLAY_ORDER.find((district) => pointInRect(point, DISTRICT_ZONES[district]))
    || state.venues.find((venue) => venue.hubKind && pointInRect(point, venue))?.district
    || neighborCountyDistrictAtPoint(point)?.name
    || neighborCountyAtPoint(point)?.name
    || "";
}

function districtZoneForName(district) {
  return DISTRICT_ZONES[district] || state.neighborDistrictThemes.get(district)?.zone || null;
}

function neighborCountyDistrictAtPoint(point) {
  return [...state.neighborDistrictThemes.values()].find((theme) => pointInRect(point, theme.zone)) || null;
}

function shouldUseCoarseMobileUpdate(entity, entityDistrict) {
  if (!mobileLayoutQuery.matches || entityDistrict === state.activeDistrict) return false;
  const visible = isVisibleRect({ x: entity.x - 30, y: entity.y - 45, w: 60, h: 70 }, 72);
  return !visible;
}

function npcSimulationId(npc, index) {
  return Number.isFinite(npc.lookIndex) ? npc.lookIndex : index;
}

function refreshActiveNpcSimulationSet() {
  const ranked = state.npcs.map((npc, index) => ({
    npc,
    id: npcSimulationId(npc, index),
    visible: !npc.insideVenueId && isVisibleRect({ x: npc.x - 30, y: npc.y - 45, w: 60, h: 70 }, 96),
    distance: Math.hypot(npc.x - state.player.x, npc.y - state.player.y),
  })).sort((first, second) => (
    Number(second.visible) - Number(first.visible) || first.distance - second.distance
  ));
  const chosen = ranked.filter((entry) => entry.visible).slice(0, MAX_ACTIVE_TOWN_NPCS);
  if (chosen.length < MIN_ACTIVE_TOWN_NPCS) {
    const chosenIds = new Set(chosen.map((entry) => entry.id));
    ranked.forEach((entry) => {
      if (chosen.length < MIN_ACTIVE_TOWN_NPCS && !chosenIds.has(entry.id)) {
        chosen.push(entry);
        chosenIds.add(entry.id);
      }
    });
  }
  state.activeNpcIds = new Set(chosen.map((entry) => entry.id));
  state.npcs.forEach((npc, index) => {
    npc.backgroundSimulated = !state.activeNpcIds.has(npcSimulationId(npc, index));
  });
}

function updateNpcAppearance(npc, delta) {
  const rule = npc.appearanceRule;
  if (!rule || rule.visibleSeconds >= rule.cycleSeconds) return false;
  if (state.dialogueNpc === npc || npc.isSocializing || npc.isInTownMoment || npc.storyVenueId) {
    if (npc.insideVenueId === NPC_OFFSCREEN_VENUE_ID) npc.insideVenueId = "";
    return false;
  }
  npc.appearanceElapsed = (npc.appearanceElapsed + delta) % rule.cycleSeconds;
  if (npc.appearanceElapsed < rule.visibleSeconds) {
    if (npc.insideVenueId === NPC_OFFSCREEN_VENUE_ID) npc.insideVenueId = "";
    return false;
  }
  npc.isMoving = false;
  npc.ridingBike = false;
  npc.insideVenueId = NPC_OFFSCREEN_VENUE_ID;
  return true;
}

function segmentUsesBike(npc, from, to) {
  if (!npc.bikePreference || npc.hasLeashedDog || reducedMotion) return false;
  if (state.environment?.isRaining && !npc.ridingBike) return false;
  return from?.bikeAction === "rent"
    || from?.bikeRoute
    || to?.bikeRoute
    || to?.bikeAction === "return";
}

function eveningShoppingVenues() {
  return state.venues.filter((venue) => (
    venue.type === "department-store" || ["lalaport", "harbor-outlet"].includes(venue.hubKind)
  ));
}

function chooseEveningShoppingVenue(npc, currentDistrict, dateKey, index) {
  const venues = eveningShoppingVenues();
  if (!venues.length) return null;
  const iconic = venues.filter((venue) => ["lalaport", "harbor-outlet"].includes(venue.hubKind));
  const nearby = venues
    .filter((venue) => !iconic.includes(venue))
    .sort((first, second) => districtGridDistance(currentDistrict, first.district)
      - districtGridDistance(currentDistrict, second.district))
    .slice(0, 2);
  const choices = [...iconic, ...nearby];
  return choices[hashText(`${dateKey}-${npc.name}-${index}-evening-place`) % choices.length];
}

function maybeStartEveningShoppingTrip(npc, index) {
  const environment = state.environment;
  const hour = Number(environment?.clock?.hour ?? 12);
  const dateKey = environment?.dateKey || "";
  if (hour < 18 || hour >= 23 || !dateKey) return;
  if (!EVENING_SHOPPING_ROLES.has(npc.role) || npc.eveningExcursion || npc.eveningVisitedDate === dateKey) return;
  if (npc.hasLeashedDog || npc.isCollapsed || npc.isSocializing || npc.isInTownMoment || npc.storyVenueId) return;
  if (npc.insideVenueId === NPC_OFFSCREEN_VENUE_ID || environment.isRaining || reducedMotion) return;
  if (hashText(`${dateKey}-${npc.name}-evening-trip`) % 2 !== 0) {
    npc.eveningVisitedDate = dateKey;
    return;
  }
  const currentDistrict = districtAtPoint(npc) || npc.district;
  const destination = chooseEveningShoppingVenue(npc, currentDistrict, dateKey, index);
  if (!destination) return;
  const origin = {
    x: npc.x,
    y: npc.y,
    district: currentDistrict,
    label: `${currentDistrict}原行程`,
    reason: npc.currentReason,
    activity: npc.activity,
    dwellSeconds: 0,
  };
  const useBike = npc.bikePreference && !npc.hasLeashedDog;
  const outbound = currentDistrict === destination.district
    ? []
    : createCrossDistrictWaypoints(currentDistrict, destination.district, npc.role, useBike);
  const inbound = currentDistrict === destination.district
    ? []
    : createCrossDistrictWaypoints(destination.district, currentDistrict, npc.role, useBike);
  const shoppingStop = {
    ...venueScheduleStop(destination, npc.role, index + 31),
    reason: `晚上到${destination.label}用餐、逛逛商店或和人碰面`,
    activity: "shopping",
    dwellSeconds: 14 + index % 7,
  };
  const returnStop = {
    ...origin,
    label: `${currentDistrict}返回原行程`,
    reason: `結束${destination.label}的晚間行程，回到原本活動位置`,
  };
  const excursionSchedule = [origin, ...outbound, shoppingStop, ...inbound, returnStop];
  npc.eveningExcursion = {
    destinationLabel: destination.label,
    returnIndex: excursionSchedule.length - 1,
    routineSchedule: npc.schedule,
    routineSegment: npc.segment,
    routineProgress: npc.progress,
    routineDwellRemaining: npc.dwellRemaining,
  };
  npc.eveningVisitedDate = dateKey;
  npc.schedule = excursionSchedule;
  npc.segment = 0;
  npc.progress = 0;
  npc.dwellRemaining = 0;
  npc.insideVenueId = "";
  npc.currentReason = `準備前往${destination.label}安排晚間休閒行程`;
}

function finishEveningShoppingTrip(npc) {
  const excursion = npc.eveningExcursion;
  if (!excursion) return;
  npc.schedule = excursion.routineSchedule;
  npc.segment = excursion.routineSegment;
  npc.progress = excursion.routineProgress;
  npc.dwellRemaining = Math.max(1.5, excursion.routineDwellRemaining || 0);
  npc.currentReason = `逛完${excursion.destinationLabel}，已回到原本行程`;
  npc.activity = "waiting";
  npc.ridingBike = false;
  npc.insideVenueId = "";
  npc.eveningExcursion = null;
}

function updateNpcs(delta) {
  refreshActiveNpcSimulationSet();
  state.npcs.forEach((npc, index) => {
    let npcDelta = delta;
    const npcDistrict = districtAtPoint(npc) || npc.schedule[npc.segment % npc.schedule.length]?.district || npc.district;
    if (npc.backgroundSimulated) {
      npc.coarseElapsed = (npc.coarseElapsed || 0) + delta;
      if (npc.coarseElapsed < BACKGROUND_NPC_UPDATE_SECONDS) return;
      npcDelta = npc.coarseElapsed;
      npc.coarseElapsed = 0;
    } else {
      // 畫面內角色必須逐影格移動；捨棄離鏡期間不足一個粗更新週期的餘量，避免重新入鏡時跳位。
      npc.coarseElapsed = 0;
    }
    if (updateNpcAppearance(npc, npcDelta)) return;
    if (npc.isCollapsed || npc.isSocializing || npc.isInTownMoment) {
      npc.isMoving = false;
      npc.ridingBike = false;
      npc.insideVenueId = "";
      return;
    }
    if (npc.storyVenueId) {
      npc.activity = "waiting";
      npc.insideVenueId = "";
      npc.currentReason = npc.storyReason;
      npc.isMoving = false;
      npc.ridingBike = false;
      return;
    }
    transitionNeighborTimeRoutine(npc);
    const civicAfterHours = transitionNeighborCivicAfterHoursRoutine(npc, index)
      || transitionCivicAfterHoursRoutine(npc, index);
    if (!civicAfterHours && !CIVIC_AFTER_HOURS_ROLES.has(npc.role) && !NEIGHBOR_CIVIC_ROLES.has(npc.role)) {
      maybeStartEveningShoppingTrip(npc, index);
    }
    if (!civicAfterHours && state.environment?.isRaining && !npc.hasUmbrella && !RAIN_DUTY_ROLES.has(npc.role) && index % 3 !== 0) {
      const shelter = rainShelterForNpc(npc, index);
      if (shelter) {
        npc.x = shelter.x + shelter.w / 2 + index % 3 * 10 - 10;
        npc.y = shelter.y + shelter.h + 12;
        npc.activity = "waiting";
        npc.insideVenueId = index % 3 === 0 ? shelter.id : "";
        npc.currentReason = `在${shelter.label}騎樓下避雨，等雨勢變小再繼續行程`;
        npc.isMoving = false;
        npc.ridingBike = false;
        return;
      }
    }
    if (npc.dwellRemaining > 0) {
      npc.dwellRemaining = Math.max(0, npc.dwellRemaining - npcDelta);
      npc.isMoving = false;
      npc.ridingBike = false;
      const stop = npc.schedule[npc.segment % npc.schedule.length];
      if (stop?.bikeAction) {
        npc.activity = "waiting";
        npc.insideVenueId = "";
        npc.currentReason = stop.reason;
        return;
      }
      npc.activity = contextualActivityForNpc(npc, stop, index);
      npc.riverbankSiteId = stop?.riverbankSiteId || "";
      npc.insideVenueId = stop?.outdoorVenue || OUTDOOR_ACTIVITIES.has(npc.activity) ? "" : (stop?.venueId || "");
      if (stop && OUTDOOR_ACTIVITIES.has(npc.activity)) {
        npc.x = stop.x + (index % 3 - 1) * 12;
        npc.y = stop.y + (npc.activity === "queuing" ? index % 3 * 8 : 0);
      }
      if (stop?.facing) npc.direction = stop.facing;
      npc.currentReason = activityReason(npc.activity, stop?.label || npc.district, npc.currentReason);
      if (npc.hasLeashedDog && !npc.insideVenueId) {
        npc.currentReason = `牽著狗在${stop?.label || npc.district}散步並短暫停留`;
      }
      return;
    }
    npc.insideVenueId = "";
    const from = npc.schedule[npc.segment % npc.schedule.length];
    const to = npc.schedule[(npc.segment + 1) % npc.schedule.length];
    const distance = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const ridingBike = segmentUsesBike(npc, from, to);
    npc.ridingBike = ridingBike;
    npc.progress += npc.speed * (ridingBike ? BIKE_SPEED_MULTIPLIER : 1) * npcDelta / distance;
    if (npc.progress >= 1) {
      const arrivedByBike = npc.ridingBike;
      npc.segment = (npc.segment + 1) % npc.schedule.length;
      npc.progress = 0;
      npc.x = to.x;
      npc.y = to.y;
      npc.dwellRemaining = to.dwellSeconds;
      npc.currentReason = to.reason;
      npc.activity = contextualActivityForNpc(npc, to, index);
      npc.riverbankSiteId = to.riverbankSiteId || "";
      npc.isMoving = false;
      npc.ridingBike = arrivedByBike && to.bikeAction !== "return";
      npc.insideVenueId = to?.outdoorVenue || OUTDOOR_ACTIVITIES.has(npc.activity) ? "" : (to.venueId || "");
      if (npc.eveningExcursion && npc.segment === npc.eveningExcursion.returnIndex) {
        finishEveningShoppingTrip(npc);
      }
      return;
    }
    const currentFrom = npc.schedule[npc.segment];
    const currentTo = npc.schedule[(npc.segment + 1) % npc.schedule.length];
    npc.x = currentFrom.x + (currentTo.x - currentFrom.x) * npc.progress;
    npc.y = currentFrom.y + (currentTo.y - currentFrom.y) * npc.progress;
    npc.currentReason = ridingBike
      ? `從 YouBike 站借車，正沿道路騎往${currentTo.label}`
      : npc.hasLeashedDog
        ? `牽著狗散步，正前往${currentTo.label}`
        : `前往${currentTo.label}：${currentTo.reason}`;
    npc.activity = ridingBike ? "cycling" : "walking";
    npc.riverbankSiteId = "";
    npc.isMoving = true;
    npc.direction = Math.abs(currentTo.x - currentFrom.x) > Math.abs(currentTo.y - currentFrom.y)
      ? (currentTo.x > currentFrom.x ? "right" : "left")
      : (currentTo.y > currentFrom.y ? "down" : "up");
    npc.step += npcDelta * (ridingBike ? 10 : 6);
  });
}

function contextualActivityForNpc(npc, stop, index) {
  const base = stop?.activity || "waiting";
  const hour = Number(state.environment?.clock?.hour ?? 12);
  const mealRush = (hour >= 11 && hour < 13) || (hour >= 17 && hour < 19);
  if (stop?.riverbankSiteId) {
    if (hour < 7 || hour >= 21 || state.environment?.isRaining) return "resting";
    return base;
  }
  if (npc.role === "sanitation-worker") return "sweeping";
  if (npc.role === "delivery-worker") return "delivery";
  if (stop?.venueId?.includes("school") || stop?.label?.includes("國小")) {
    if (npc.role === "parent" && hour >= 14) return "school-pickup";
    if (["student", "high-school-student"].includes(npc.role) && hour >= 14) return "greeting";
  }
  if (mealRush && stop?.venueId && ["restaurant", "snack", "convenience"].some((token) => stop.venueId.includes(token))) {
    return index % 3 ? "queuing" : "stocking";
  }
  if (stop?.venueId === "waternan-central-park") {
    if (hour < 9 || hour >= 17) return index % 2 ? "exercising" : "watching-birds";
    if (hour >= 11 && hour < 14) return index % 2 ? "resting" : "greeting";
  }
  if (["harbor-outlet", "lalaport-taichung"].includes(stop?.venueId)) {
    return mealRush ? "queuing" : index % 2 ? "shopping" : "waiting";
  }
  if (stop?.venueId === "civic-center") return hour >= 11 && hour < 14 ? "resting" : "waiting";
  if (stop?.venueId === "intercontinental-stadium") return "exercising";
  if (stop?.venueId === "asia-modern-museum") return index % 2 ? "resting" : "greeting";
  if (base === "resting" && npc.role === "senior") return index % 2 ? "exercising" : "resting";
  return base;
}

function activityReason(activity, location, fallback) {
  return {
    waiting: `在${location}等人，順便看看街上的動靜`,
    queuing: `在${location}排隊，準備買今天需要的東西`,
    resting: `在${location}坐著休息，稍後再繼續行程`,
    greeting: `在${location}和熟人打招呼`,
    "watching-birds": `在${location}看麻雀和白頭翁活動`,
    "feeding-birds": `在${location}附近觀察鳥群覓食`,
    exercising: `在${location}伸展、散步並稍作休息`,
    sweeping: `整理${location}周邊的落葉與通道`,
    stocking: `在${location}補貨並核對清單`,
    "school-pickup": `在${location}等孩子放學`,
    delivery: `把清單上的物資送到${location}`,
    shopping: `在${location}逛逛商店並採買需要的東西`,
    listening: `停下腳步聽對方把話說完`,
    "at-home": `回到${location}休息、整理家務或準備晚餐`,
    fishing: `在${location}的安全平台釣魚，釣線朝向河道但人留在護欄內`,
    barbecuing: `在${location}使用指定烤肉台休憩，並把垃圾與火源收拾好`,
    "inspecting-paddy": `在${location}巡田，查看水位與稻作狀況`,
    "releasing-water": `在${location}依灌溉安排放水並確認田間分水`,
    "mending-ridge": `在${location}整理田埂與農路邊緣`,
    "sorting-produce": `在${location}分級、裝箱並核對農產品紀錄`,
    "tending-grapes": `在${location}整理葡萄棚、枝蔓與果串`,
    "tending-flowers": `在${location}澆灌花卉、苗木並整理出貨區`,
    "checking-irrigation": `在${location}巡查水圳、閘門與抽水設施`,
    "tending-oysters": `在${location}依潮汐照顧蚵棚，沿專用工作路線移動`,
    "repairing-rail": `在${location}檢查軌道、機車與作業設備`,
    "serving-market": `在${location}整理市場、接待訪客並保持通道暢通`,
  }[activity] || fallback;
}

function rainShelterForNpc(npc, index) {
  const district = districtAtPoint(npc) || npc.district;
  const shelters = state.venues.filter((venue) => venue.district === district
    && ["convenience-store", "snack-shop", "restaurant"].includes(venue.type));
  return shelters[index % Math.max(1, shelters.length)] || null;
}

function updatePets(delta) {
  state.pets.forEach((pet, index) => {
    let petDelta = delta;
    if (shouldUseCoarseMobileUpdate(pet, pet.district)) {
      pet.coarseElapsed = (pet.coarseElapsed || 0) + delta;
      if (pet.coarseElapsed < MOBILE_COARSE_UPDATE_SECONDS) return;
      petDelta = pet.coarseElapsed;
      pet.coarseElapsed = 0;
    } else {
      pet.coarseElapsed = 0;
    }
    if (pet.kind === "dog") {
      updateLeashedDog(pet, petDelta, index);
      return;
    }
    if (pet.dwellRemaining > 0) {
      pet.dwellRemaining = Math.max(0, pet.dwellRemaining - petDelta);
      return;
    }
    if (!pet.target) pet.target = choosePetTarget(pet, index);
    const dx = pet.target.x - pet.x;
    const dy = pet.target.y - pet.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 3) {
      pet.x = pet.target.x;
      pet.y = pet.target.y;
      pet.district = pet.target.district;
      pet.target = null;
      pet.dwellRemaining = 2 + pet.decisionSeed % 5;
      return;
    }
    pet.x += dx / distance * pet.speed * petDelta;
    pet.y += dy / distance * pet.speed * petDelta;
    pet.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    pet.phase += petDelta * 4;
  });
}

function dogOwnerFor(pet) {
  return state.npcs.find((npc) => npc.name === pet.ownerName)
    || state.npcs.find((npc) => npc.lookIndex === pet.ownerLookIndex)
    || null;
}

function updateLeashedDog(pet, delta, index) {
  const owner = dogOwnerFor(pet);
  if (!owner) {
    pet.hidden = true;
    return;
  }
  pet.district = districtAtPoint(owner) || owner.district;
  const ownerUnavailable = Boolean(owner.insideVenueId || owner.isCollapsed);
  pet.hidden = ownerUnavailable;
  const offsets = {
    left: { x: 17, y: 7 },
    right: { x: -17, y: 7 },
    up: { x: index % 2 ? 15 : -15, y: 10 },
    down: { x: index % 2 ? -15 : 15, y: 7 },
  };
  const offset = offsets[owner.direction] || offsets.down;
  const targetX = owner.x + offset.x;
  const targetY = owner.y + offset.y;
  if (ownerUnavailable || reducedMotion) {
    pet.x = targetX;
    pet.y = targetY;
    return;
  }
  const dx = targetX - pet.x;
  const dy = targetY - pet.y;
  const distance = Math.hypot(dx, dy);
  if (distance > 52) {
    pet.x = targetX;
    pet.y = targetY;
  } else if (distance > 0.5) {
    const step = Math.min(distance, Math.max(28, owner.speed * 1.45) * delta);
    pet.x += dx / distance * step;
    pet.y += dy / distance * step;
  }
  pet.direction = Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? "right" : "left")
    : owner.direction === "left" ? "left" : "right";
  pet.phase += delta * (owner.isMoving ? 5 : 1.5);
}

function choosePetTarget(pet, index) {
  pet.decisionSeed = (pet.decisionSeed * 1664525 + 1013904223) >>> 0;
  const takesLongWalk = pet.decisionSeed % 5 === 0;
  const candidates = takesLongWalk
    ? DISTRICT_DISPLAY_ORDER.filter((district) => district !== pet.district && districtGridDistance(pet.district, district) <= 3)
    : [pet.district];
  const district = candidates[pet.decisionSeed % candidates.length] || pet.homeDistrict;
  const zone = DISTRICT_ZONES[district];
  return {
    district,
    x: zone.x + 24 + (pet.decisionSeed % Math.max(1, zone.w - 210)),
    y: zone.y + 82 + ((pet.decisionSeed >>> 8) % Math.max(1, zone.h - 118)),
    index,
  };
}

function updateBirds(delta) {
  state.birds.forEach((bird, index) => {
    let birdDelta = delta;
    if (shouldUseCoarseMobileUpdate(bird, bird.district)) {
      bird.coarseElapsed = (bird.coarseElapsed || 0) + delta;
      if (bird.coarseElapsed < MOBILE_COARSE_UPDATE_SECONDS) return;
      birdDelta = bird.coarseElapsed;
      bird.coarseElapsed = 0;
    } else {
      bird.coarseElapsed = 0;
    }
    const nearestNpc = bird.district === state.activeDistrict
      ? state.npcs.find((npc) => !npc.insideVenueId && Math.hypot(npc.x - bird.x, npc.y - bird.y) < 24)
      : null;
    const startled = bird.species === "sparrow"
      && (Math.hypot(state.player.x - bird.x, state.player.y - bird.y) < 46 || nearestNpc);
    if (startled) {
      const awayX = bird.x - (nearestNpc?.x ?? state.player.x);
      const awayY = bird.y - (nearestNpc?.y ?? state.player.y);
      const length = Math.hypot(awayX, awayY) || 1;
      const zone = DISTRICT_ZONES[bird.district];
      bird.target = {
        x: Math.max(zone.x + 28, Math.min(zone.x + zone.w - 28, bird.x + awayX / length * 70)),
        y: Math.max(zone.y + 28, Math.min(zone.y + zone.h - 28, bird.y + awayY / length * 55)),
        altitude: 16,
      };
    }
    if (!bird.target) bird.target = chooseBirdTarget(bird, index);
    const dx = bird.target.x - bird.x;
    const dy = bird.target.y - bird.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 3) {
      bird.x = bird.target.x;
      bird.y = bird.target.y;
      bird.altitude = bird.target.altitude;
      bird.target = null;
      return;
    }
    const movement = Math.min(distance, bird.speed * birdDelta);
    bird.x += dx / distance * movement;
    bird.y += dy / distance * movement;
    bird.altitude += (bird.target.altitude - bird.altitude) * Math.min(1, birdDelta * 4);
    bird.direction = dx < 0 ? "left" : "right";
    bird.phase += birdDelta * 7;
  });
}

function chooseBirdTarget(bird, index) {
  bird.decisionSeed = (bird.decisionSeed * 1664525 + 1013904223) >>> 0;
  const zone = DISTRICT_ZONES[bird.district];
  const horizontalRange = Math.max(80, zone.w - 130);
  const verticalRange = Math.max(70, zone.h - 130);
  const isBulbul = bird.species === "bulbul";
  return {
    x: zone.x + 54 + bird.decisionSeed % horizontalRange,
    y: zone.y + 52 + (bird.decisionSeed >>> 9) % verticalRange,
    altitude: isBulbul ? 8 + (bird.decisionSeed + index) % 16 : bird.decisionSeed % 5 === 0 ? 8 : 0,
  };
}

function updateAmbientConversation(now) {
  if (state.townEvent || state.dialogueNpc || refs.dialog.open) {
    endAmbientConversation(now, 5_000);
    return;
  }
  const conversation = state.ambientConversation;
  if (conversation) {
    if (state.player.isMoving) {
      endAmbientConversation(now, 6_000);
      return;
    }
    const turn = conversation.turns[conversation.turnIndex];
    const listener = turn.speaker === conversation.first ? conversation.second : conversation.first;
    turn.speaker.direction = listener.x < turn.speaker.x ? "left" : "right";
    listener.direction = turn.speaker.x < listener.x ? "left" : "right";
    turn.speaker.activity = "greeting";
    listener.activity = "listening";
    if (now >= conversation.visibleAfter) {
      turn.speaker.emote = turn.emote || "smile";
      turn.speaker.emoteUntil = conversation.nextTurnAt;
    }
    if (now >= conversation.nextTurnAt) {
      conversation.turnIndex += 1;
      if (conversation.turnIndex >= conversation.turns.length) {
        endAmbientConversation(now, 7_000 + conversation.seed % 5_000);
      } else {
        conversation.visibleAfter = now + (reducedMotion ? 80 : 220);
        conversation.nextTurnAt = now + 2_700 + conversation.turnIndex % 2 * 350;
      }
    }
    return;
  }
  if (now < state.nextConversationAt || !state.activeDistrict) return;
  const pair = findConversationPair();
  if (!pair) {
    state.nextConversationAt = now + 4_000;
    return;
  }
  startAmbientConversation(pair[0], pair[1], now);
}

function findConversationPair() {
  pruneConversationMemory(performance.now());
  const nearby = state.npcs.filter((npc) => !npc.insideVenueId
    && !npc.ridingBike
    && !npc.isCollapsed
    && (districtAtPoint(npc) || npc.district) === state.activeDistrict
    && Math.abs(npc.x - state.player.x) < WIDTH * 0.7
    && Math.abs(npc.y - state.player.y) < HEIGHT * 0.7);
  const candidates = [];
  for (let firstIndex = 0; firstIndex < nearby.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < nearby.length; secondIndex += 1) {
      const first = nearby[firstIndex];
      const second = nearby[secondIndex];
      const pairKey = [first.name, second.name].sort().join("|");
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      if (distance <= 180 && !state.conversationMemory.some((memory) => memory.pairKey === pairKey)) {
        const relationship = relationshipBetween(first, second);
        const relationshipPriority = ["parent-child", "classmates", "coworkers", "neighbors"].indexOf(relationship);
        candidates.push({ first, second, pairKey, distance, relationshipPriority: relationshipPriority < 0 ? 5 : relationshipPriority });
      }
    }
  }
  candidates.sort((a, b) => a.relationshipPriority - b.relationshipPriority || a.distance - b.distance);
  return candidates.length ? [candidates[0].first, candidates[0].second] : null;
}

function startAmbientConversation(first, second, now) {
  const pairKey = [first.name, second.name].sort().join("|");
  const context = buildConversationContext(first, second, now);
  const turns = conversationTurns(first, second, context);
  const seed = hashText(`${pairKey}-${context.topicId}-${state.conversationMemory.length}`);
  first.isSocializing = true;
  second.isSocializing = true;
  first.insideVenueId = "";
  second.insideVenueId = "";
  state.ambientConversation = {
    first,
    second,
    turns,
    pairKey,
    topicId: context.topicId,
    relationship: context.relationship,
    turnIndex: 0,
    visibleAfter: now + (reducedMotion ? 80 : 220),
    nextTurnAt: now + 2_900,
    seed,
  };
}

function endAmbientConversation(now = performance.now(), delay = 7_000) {
  if (state.ambientConversation) {
    const conversation = state.ambientConversation;
    conversation.first.isSocializing = false;
    conversation.second.isSocializing = false;
    conversation.first.activity = "waiting";
    conversation.second.activity = "waiting";
    rememberConversation({
      pairKey: conversation.pairKey,
      topicId: conversation.topicId,
      relationship: conversation.relationship,
      endedAt: now,
    });
  }
  state.ambientConversation = null;
  state.nextConversationAt = Math.max(state.nextConversationAt, now + delay);
}

function buildConversationContext(first, second, now = performance.now()) {
  pruneConversationMemory(now);
  const relationship = relationshipBetween(first, second);
  const hour = Number(state.environment?.clock?.hour ?? 12);
  const location = nearestLocationLabel(first);
  const recentTopics = new Set(state.conversationMemory.map((memory) => memory.topicId));
  const topicId = selectConversationTopic(first, second, recentTopics, now);
  return {
    topicId,
    relationship,
    relationshipLabel: relationshipLabel(relationship),
    location,
    hour,
    timeLabel: hour < 10 ? "早上" : hour < 14 ? "中午" : hour < 18 ? "下午" : "晚上",
    isRaining: Boolean(state.environment?.isRaining),
    firstActivity: first.activity || "waiting",
    secondActivity: second.activity || "waiting",
    rumor: latestTownRumor(first.district),
  };
}

function selectConversationTopic(first, second, recentTopics, now) {
  if ([first.role, second.role].includes("candidate")) return "civic-campaign";
  const rumor = latestTownRumor(first.district, now);
  const pool = [
    ...DAILY_TOPIC_IDS,
    "errands", "family", "shopping", "neighborhood", "rest", "animals",
    "cooking", "lunch",
    ...(state.environment?.isRaining ? ["weather", "weather", "weather"] : []),
    ...(rumor ? ["town-news", "town-news"] : []),
  ];
  const available = pool.filter((topicId) => !recentTopics.has(topicId));
  const choices = available.length ? available : pool;
  return choices[hashText(`${first.name}-${second.name}-${Math.floor(now / 10_000)}`) % choices.length];
}

function conversationTurns(first, second, context) {
  const people = [first, second];
  const candidate = people.find((npc) => npc.role === "candidate");
  const other = candidate === first ? second : first;
  if (candidate) {
    return [
      { speaker: candidate, text: candidate.campaignAppeal },
      { speaker: other, text: "謝謝你來說明。我會比較每位候選人的公開資料，再自己做決定。" },
      { speaker: candidate, text: "沒問題，也請記得在投票日前查核選舉委員會的正式資訊。" },
    ];
  }
  const turns = buildDailyTopicTurns(context.topicId, first, second, context);
  const familiar = ["parent-child", "classmates", "coworkers", "neighbors"].includes(context.relationship);
  const requestedLength = Math.round((first.personality.turnCount + second.personality.turnCount) / 2);
  const turnCount = Math.max(2, Math.min(familiar ? 4 : 2, requestedLength));
  return turns.slice(0, turnCount);
}

function buildDailyTopicTurns(topicId, first, second, context) {
  const familiarGreeting = context.relationship === "parent-child"
    ? "你今天走得還順利嗎？"
    : context.relationship === "classmates"
      ? "你也剛走到這裡啊。"
      : context.relationship === "coworkers"
        ? "剛才那一站忙完了嗎？"
        : context.relationship === "neighbors"
          ? "今天又在街角遇見你了。"
          : first.personality.greeting;
  const topicTurns = {
    weather: [
      { speaker: first, text: context.isRaining ? "這場雨來得真快，我剛才還在想衣服有沒有收。" : `${context.timeLabel}的風很舒服，走路沒有那麼趕。`, emote: "note" },
      { speaker: second, text: context.isRaining ? "我先在騎樓等等，雨小一點再把事情辦完。" : "是啊，太陽不刺眼時，街上會多好幾個散步的人。" },
      { speaker: first, text: "不過傘還是帶著比較安心，天氣說變就變。" },
      { speaker: second, text: "慢慢走就好，別為了躲雨急著穿過馬路。" },
    ],
    errands: [
      { speaker: first, text: `${familiarGreeting}我還要去${context.location}辦一件小事。` },
      { speaker: second, text: "我也是照著清單走，買完東西就準備回家。" },
      { speaker: first, text: "差點忘了還要領包裹，幸好剛才想起來。", emote: "question" },
      { speaker: second, text: "先記在手機上吧，不然聊著聊著又會忘記。" },
    ],
    "work-school": [
      { speaker: first, text: `${familiarGreeting}今天的工作和課程還順利嗎？` },
      { speaker: second, text: "前面有點忙，現在總算能停一下、喝口水。" },
      { speaker: first, text: roleDailyWorkLine(first) },
      { speaker: second, text: "把眼前這件做好就行，剩下的等休息過再處理。" },
    ],
    family: [
      { speaker: first, text: context.relationship === "parent-child" ? "書包背好，我們先慢慢走回家。" : "我家裡的人剛傳訊息問我幾點回去。" },
      { speaker: second, text: context.relationship === "parent-child" ? "好，我還想跟你說今天班上發生的事。" : "有人等你回去的感覺很好，路上不用趕。" },
      { speaker: first, text: "晚一點大家會一起吃飯，現在先把手上的事情辦完。" },
      { speaker: second, text: "那我不耽誤你，改天再慢慢聊。" },
    ],
    shopping: [
      { speaker: first, text: "我只想買兩樣東西，結果站在架子前又多看了半天。", emote: "question" },
      { speaker: second, text: "我會先看家裡還剩什麼，免得同一樣買了兩次。" },
      { speaker: first, text: "今天的青菜看起來不錯，我想挑一小把就好。" },
      { speaker: second, text: "買吃得完的量最剛好，冰箱也不會塞滿。" },
    ],
    cooking: [
      { speaker: first, text: "我晚上想煮一道簡單的湯，你覺得先炒香還是直接煮？" },
      { speaker: second, text: "如果趕時間就直接煮，味道清爽；有空再慢慢炒香。" },
      { speaker: first, text: "那我加一點豆腐和蔬菜，冰箱裡剛好都有。" },
      { speaker: second, text: "很好啊，調味先少一點，最後再試味道。" },
    ],
    lunch: [
      { speaker: first, text: "你今天中午吃到哪一道，回家還會想再提起？" },
      { speaker: second, text: "我記得蔬菜脆脆的，還有一道菜聞起來很香。" },
      { speaker: first, text: "晚餐換一種主菜和作法，吃起來就不會太像。" },
      { speaker: second, text: "不需要每餐都完美，大家坐下來好好吃就很好。" },
    ],
    neighborhood: [
      { speaker: first, text: `${familiarGreeting}最近${context.location}附近好像多了幾張椅子。` },
      { speaker: second, text: "我也注意到了，長輩和等孩子的家長都會坐一下。" },
      { speaker: first, text: "轉角的落葉今天也整理得很乾淨，走起來舒服多了。" },
      { speaker: second, text: "小地方慢慢變好，住在這裡的人最容易感覺到。" },
    ],
    transport: [
      { speaker: first, text: "剛才那班車差一點沒趕上，還好司機有看到我。" },
      { speaker: second, text: "下次早一點出門吧，為了趕車跑過路口太危險。" },
      { speaker: first, text: "你說得對，我寧可等下一班，也不要一路慌慌張張。" },
      { speaker: second, text: "而且慢一點，還能看看街上今天有什麼不同。" },
    ],
    rest: [
      { speaker: first, text: "我想先坐一下，今天走的路比想像中多。" },
      { speaker: second, text: "那邊有樹蔭，休息幾分鐘再走也不遲。" },
      { speaker: first, text: "喝口水、看看人來人往，心情也會慢下來。", emote: "note" },
      { speaker: second, text: "對，事情做不完沒關係，先把自己照顧好。" },
    ],
    animals: [
      { speaker: first, text: "你看，那幾隻麻雀又跳到店門旁邊了。", emote: "note" },
      { speaker: second, text: "走近一點牠們就飛開，白頭翁倒比較常停在樹上。" },
      { speaker: first, text: "我喜歡看牠們忙來忙去，但不會拿人吃的東西亂餵。" },
      { speaker: second, text: "安靜看就很好，留一點距離也不會嚇到牠們。" },
    ],
    seasonal: [
      { speaker: first, text: "最近天色變得比較早，傍晚一下就涼了。" },
      { speaker: second, text: "市場裡的食材也慢慢換季，攤位看起來不太一樣。" },
      { speaker: first, text: "我想挑一樣平常比較少煮的，回家試試簡單作法。" },
      { speaker: second, text: "先買少量就好，喜歡的話下次再多準備一點。" },
    ],
    "town-news": [
      { speaker: first, text: context.rumor?.text || "剛才街上有人互相幫忙，大家都鬆了一口氣。" },
      { speaker: second, text: "我有看到，遇到事情願意停下來幫忙，小鎮就會不一樣。" },
      { speaker: first, text: "而且大家都先顧安全，沒有讓現場變得更亂。" },
      { speaker: second, text: "等等遇到其他鄰居，我也會把正確做法說清楚。" },
    ],
  };
  return topicTurns[topicId] || topicTurns.neighborhood;
}

function roleDailyWorkLine(npc) {
  const lines = {
    teacher: "我剛把明天要用的材料排好，終於可以喘口氣。",
    nutritionist: "今天先把資料核對清楚，其他問題明天再繼續。",
    cook: "備料告一段落，等等還要確認器具都收好了。",
    "police-officer": "這一段巡查結束，回去還要把時間和地點記下來。",
    firefighter: "器材檢查完一輪，少一樣都得重新確認。",
    doctor: "剛結束社區行程，回院前先喝口水。",
    "sanitation-worker": "前面落葉比較多，我掃完這段就能休息一下。",
    "delivery-worker": "最後兩箱送完，我就可以回去整理明天的路線。",
  };
  return lines[npc.role] || "今天最忙的部分已經過了，剩下的慢慢完成就好。";
}

function nearestLocationLabel(npc) {
  const venue = state.venues
    .filter((item) => item.district === (districtAtPoint(npc) || npc.district))
    .map((item) => ({ item, distance: Math.hypot(npc.x - (item.x + item.w / 2), npc.y - (item.y + item.h / 2)) }))
    .sort((first, second) => first.distance - second.distance)[0];
  return venue?.distance < 180 ? venue.item.label : `${districtAtPoint(npc) || npc.district}街角`;
}

function rememberConversation(memory) {
  if (!memory?.pairKey || !memory?.topicId) return;
  state.conversationMemory = state.conversationMemory
    .filter((item) => !(item.pairKey === memory.pairKey && item.topicId === memory.topicId));
  state.conversationMemory.push(memory);
  state.conversationMemory = state.conversationMemory.slice(-CONVERSATION_MEMORY_LIMIT);
}

function pruneConversationMemory(now = performance.now()) {
  state.conversationMemory = state.conversationMemory
    .filter((memory) => now - memory.endedAt < CONVERSATION_MEMORY_WINDOW_MS)
    .slice(-CONVERSATION_MEMORY_LIMIT);
}

function latestTownRumor(district, now = performance.now()) {
  state.townRumors = state.townRumors.filter((rumor) => rumor.expiresAt > now);
  return [...state.townRumors].reverse().find((rumor) => rumor.district === district) || null;
}

function addTownRumor(district, topicId, text, now = performance.now()) {
  state.townRumors.push({ district, topicId, text, expiresAt: now + CONVERSATION_MEMORY_WINDOW_MS });
  state.townRumors = state.townRumors.slice(-6);
}

const LOW_STAKES_TOWN_MOMENTS = [
  {
    id: "lost-bottle",
    roles: ["student", "high-school-student"],
    activity: "waiting",
    text: "我的水壺好像忘在剛才坐過的地方了。",
    prompt: "陪他沿原路找水壺",
    resolvedText: "你陪我沿原路找，真的在椅子旁邊，謝謝你！",
    rumor: "剛才有人陪孩子沿原路找回水壺，附近居民都提醒彼此離開前再看一眼。",
  },
  {
    id: "directions",
    roles: ["community-resident", "office-worker", "university-student"],
    activity: "waiting",
    text: "不好意思，我在找最近的公園入口，地圖看得有點亂。",
    prompt: "陪他確認街區方向",
    resolvedText: "原來沿著這條路直走就到了，我記住那棵大樹當地標。",
    rumor: "街角有人耐心幫忙指路，還用容易辨認的地標說明方向。",
  },
  {
    id: "carry-bag",
    roles: ["senior"],
    activity: "resting",
    text: "這袋東西比想像中重，我先放下來喘口氣。",
    prompt: "幫忙拿到旁邊休息處",
    resolvedText: "放在椅子旁就好，謝謝你陪我慢慢走，不用趕。",
    rumor: "有居民陪長者把東西移到休息處，沒有催促，也先問清楚要放哪裡。",
  },
  {
    id: "find-parent",
    roles: ["student"],
    activity: "waiting",
    text: "我剛才還看得到家人，轉個身就找不到了。",
    prompt: "陪孩子找附近工作人員",
    resolvedText: "我們在原地附近找到導護員，已經聯絡到家人了。",
    rumor: "孩子一時找不到家人，居民陪他留在安全處並找工作人員協助聯絡。",
  },
  {
    id: "delivery-stop",
    roles: ["delivery-worker"],
    activity: "delivery",
    text: "這幾箱要送到兩間店，我正在核對哪一箱先卸。",
    prompt: "一起查看箱子上的店名",
    resolvedText: "店名和順序都對上了，這樣就不會擋在門口太久。",
    rumor: "送貨人員和居民一起核對店名，很快整理好卸貨順序並保持通道暢通。",
  },
  {
    id: "missing-ingredient",
    roles: ["cook", "vendor"],
    activity: "stocking",
    text: "原本要用的一樣食材剛好不夠，我得看看今天能不能換個簡單做法。",
    prompt: "陪他核對現有食材",
    resolvedText: "現有的材料也能調整作法，最後還是以今天實際供應為準。",
    rumor: "店家發現食材不足後重新核對庫存，調整了作法，也清楚說明實際供應內容。",
  },
  {
    id: "park-cleanup",
    roles: ["sanitation-worker", "gardener"],
    activity: "sweeping",
    text: "風把落葉吹回步道上了，我想先把主要通道整理出來。",
    prompt: "幫忙指出人走得最多的位置",
    resolvedText: "先整理這一段最有用，推車和散步的人都比較好通過。",
    rumor: "公園先整理了最常使用的步道，散步、推車和輪椅通行都更順暢。",
  },
  {
    id: "school-dismissal",
    roles: ["parent", "teacher", "crossing-guard"],
    activity: "school-pickup",
    text: "放學人潮快到了，我們先把校門前的通道留出來。",
    prompt: "協助提醒大家留出通道",
    resolvedText: "通道留好了，家長慢慢等，孩子出校門也看得更清楚。",
    rumor: "放學前大家一起留出校門通道，接送的人潮沒有擠成一團。",
  },
];

function updateTownMoment(now) {
  const moment = state.townMoment;
  if (moment) {
    if (now >= moment.expiresAt) finishTownMoment(now);
    return;
  }
  if (state.townEvent || state.dialogueNpc || state.ambientConversation || refs.dialog.open
    || now < state.nextTownMomentAt || !state.activeDistrict) return;
  startTownMoment(now);
}

function startTownMoment(now) {
  const definitions = LOW_STAKES_TOWN_MOMENTS.length;
  for (let offset = 0; offset < definitions; offset += 1) {
    const definition = LOW_STAKES_TOWN_MOMENTS[(state.townMomentSequence + offset) % definitions];
    const actors = state.npcs.filter((npc) => !npc.insideVenueId
      && !npc.ridingBike
      && !npc.isCollapsed
      && definition.roles.includes(npc.role)
      && (districtAtPoint(npc) || npc.district) === state.activeDistrict);
    if (!actors.length) continue;
    const actor = actors[hashText(`${definition.id}-${state.activeDistrict}`) % actors.length];
    actor.isInTownMoment = true;
    actor.activity = definition.activity;
    actor.isMoving = false;
    actor.insideVenueId = "";
    actor.emote = "question";
    actor.emoteUntil = now + 18_000;
    state.townMomentSequence += offset + 1;
    state.townMoment = {
      ...definition,
      actor,
      district: state.activeDistrict,
      achievementSubjectId: townAchievementInstance(`moment-${definition.id}`),
      resolved: false,
      expiresAt: now + 18_000,
      bubble: { speaker: actor, text: definition.text },
    };
    state.lastPromptTarget = null;
    updateNearbyPrompt();
    announce(`${npcDisplayName(actor)}需要一點幫忙：${definition.text}`);
    return;
  }
  state.nextTownMomentAt = now + 8_000;
}

function nearbyTownMoment(point = state.player) {
  const moment = state.townMoment;
  if (!moment || moment.resolved) return null;
  return Math.hypot(point.x - moment.actor.x, point.y - moment.actor.y) < 48 ? moment : null;
}

function resolveTownMoment() {
  const moment = state.townMoment;
  if (!moment || moment.resolved) return;
  moment.resolved = true;
  moment.actor.emote = "smile";
  moment.actor.emoteUntil = performance.now() + 5_000;
  moment.bubble = { speaker: moment.actor, text: moment.resolvedText };
  moment.expiresAt = performance.now() + 5_500;
  addTownRumor(moment.district, moment.id, moment.rumor);
  void recordAchievementEvent("town_moment", moment.achievementSubjectId);
  announce(`${moment.actor.name}：${moment.resolvedText}`);
}

function finishTownMoment(now = performance.now()) {
  if (state.townMoment?.actor) {
    state.townMoment.actor.isInTownMoment = false;
    state.townMoment.actor.activity = "waiting";
  }
  state.townMoment = null;
  state.nextTownMomentAt = now + 28_000 + state.townMomentSequence % 4 * 4_000;
  state.lastPromptTarget = null;
  if (state.ready) updateNearbyPrompt();
}

function updateTownEvent(now, delta) {
  const event = state.townEvent;
  if (!event) {
    if (now >= state.nextTownEventAt && state.activeDistrict && !state.ambientConversation) startTownEvent(now);
    return;
  }
  if (!event.resolved && now - event.startedAt >= TOWN_EVENT_AUTO_DISMISS_MS) {
    dismissTownEvent(now);
    return;
  }
  if (event.type === "theft" && !event.resolved && event.actor) {
    event.actor.x += event.actor.runDirection * 34 * delta;
    event.actor.step += delta * 9;
    event.actor.isMoving = true;
    const zone = districtZoneForName(event.district);
    if (!zone) {
      dismissTownEvent(now);
      return;
    }
    if (event.actor.x < zone.x + 38 || event.actor.x > zone.x + zone.w - 38) event.actor.runDirection *= -1;
    event.actor.direction = event.actor.runDirection > 0 ? "right" : "left";
  }
}

function startTownEvent(now) {
  finishTownMoment(now);
  endAmbientConversation(now, 8_000);
  const type = state.townEventSequence % 2 === 0 ? "theft" : "medical";
  state.townEventSequence += 1;
  const district = state.activeDistrict;
  const zone = districtZoneForName(district);
  if (!zone) {
    state.nextTownEventAt = now + 8_000;
    return;
  }
  if (type === "theft") {
    const profile = CHARACTER_PROFILES.find((item) => item.role === "office-worker" && item.gender === "male") || CHARACTER_PROFILES[0];
    state.townEvent = {
      type,
      district,
      achievementSubjectId: townAchievementInstance("theft"),
      title: "街角傳來失竊呼喊",
      text: "店家發現物品被拿走，一名可疑人物正沿街離開。你要怎麼幫忙？先保護自己，不要冒險追逐或攔人。",
      sourceUrl: "https://www.npa.gov.tw/ch/app/artwebsite/view?module=artwebsite&id=1048&serno=e3ad2889-4dee-41cf-aef8-9b9d26dc6950",
      choices: [
        { id: "call-110", label: "撥 110 說明地點" },
        { id: "observe", label: "記住方向與特徵" },
        { id: "chase", label: "自己追上去" },
      ],
      actor: {
        ...profile,
        name: "可疑人物",
        role: "office-worker",
        x: zone.x + Math.min(zone.w - 80, Math.max(80, state.player.x - zone.x + 80)),
        y: zone.y + Math.min(zone.h - 45, Math.max(90, state.player.y - zone.y)),
        direction: "right",
        runDirection: 1,
        step: 0,
        isMoving: true,
        eventActor: true,
      },
      resolved: false,
      startedAt: now,
    };
  } else {
    const possibleVictims = state.npcs.filter((npc) => !npc.insideVenueId
      && !npc.ridingBike
      && !["mayor", "borough-chief", "city-councilor", "candidate", "police-officer", "firefighter", "doctor"].includes(npc.role)
      && (districtAtPoint(npc) || npc.district) === district);
    const victim = possibleVictims[hashText(`${district}-${state.townEventSequence}`) % Math.max(1, possibleVictims.length)];
    if (!victim) {
      state.nextTownEventAt = now + 5_000;
      return;
    }
    victim.isCollapsed = true;
    victim.isSocializing = false;
    state.townEvent = {
      type,
      district,
      achievementSubjectId: townAchievementInstance("medical"),
      victim,
      title: "有人突然倒下",
      text: `${npcDisplayName(victim)}突然失去反應。請先確認現場安全、呼叫他人協助，不要自行餵食或餵水。你要怎麼做？`,
      sourceUrl: "https://www.nfa.gov.tw/cht/index.php?code=list&ids=68",
      choices: [
        { id: "call-119", label: "撥 119 並說明位置" },
        { id: "get-aed", label: "請人拿 AED、疏散空間" },
        { id: "wait", label: "先在旁邊等待" },
      ],
      resolved: false,
      startedAt: now,
    };
  }
  renderTownEvent();
  announce(`${state.townEvent.title}。${state.townEvent.text}`);
}

function renderTownEvent() {
  const event = state.townEvent;
  refs.townEventPanel.hidden = !event;
  if (!event) return;
  refs.townEventTitle.textContent = event.title;
  refs.townEventText.textContent = event.result || event.text;
  refs.townEventChoices.hidden = event.resolved;
  refs.townEventChoices.innerHTML = event.resolved ? "" : event.choices.map((choice) => (
    `<button type="button" data-event-choice="${choice.id}">${escapeHtml(choice.label)}</button>`
  )).join("");
  refs.townEventSource.hidden = !event.sourceUrl;
  refs.townEventSource.href = event.sourceUrl || "#";
  refs.townEventContinue.hidden = !event.resolved;
}

function chooseTownEventAction(choiceId) {
  const event = state.townEvent;
  if (!event || event.resolved) return;
  const choice = event.choices.find((item) => item.id === choiceId);
  if (!choice) return;
  const isMedical = event.type === "medical";
  const responderRole = isMedical ? "firefighter" : "police-officer";
  const responderProfile = CHARACTER_PROFILES.find((item) => item.role === responderRole) || CHARACTER_PROFILES[0];
  const subject = event.victim || event.actor;
  event.responder = {
    ...responderProfile,
    name: isMedical ? "到場救護員" : "到場警察",
    role: responderRole,
    x: subject.x + 24,
    y: subject.y + 3,
    direction: "left",
    step: 0,
    isMoving: false,
    eventActor: true,
  };
  if (choiceId === "call-110") {
    event.result = "你先到安全處撥打 110，說清楚地點、移動方向與現場狀況。警察依通報方向攔下可疑人物、帶回查證，並提醒不要自行追逐或攔人。";
    event.bubble = { speaker: event.responder, text: "謝謝你提供位置和方向，我們已攔下對方並依法查證。" };
  } else if (choiceId === "observe") {
    event.result = "你在安全距離記住方向、衣著與時間，店家同時撥打 110。警察到場後，你只陳述親眼看到的事。";
    event.bubble = { speaker: event.responder, text: "請只說親眼看到的內容，不要猜測身分。" };
  } else if (choiceId === "chase") {
    event.result = "追逐可能讓自己和路人陷入危險。附近店家已撥打 110；你停在安全處，改為記住方向與特徵。";
    event.bubble = { speaker: event.responder, text: "安全第一，不要追逐或自行攔人。" };
  } else if (choiceId === "call-119") {
    event.result = "你撥打 119，說清楚位置與對方沒有反應；同時請旁人取 AED、保持通道。救護員到場後接手評估與急救。";
    event.bubble = { speaker: event.responder, text: "做得好，保持通道暢通，讓我們接手。" };
  } else if (choiceId === "get-aed") {
    event.result = "你請人撥 119，自己去取 AED 並請圍觀者退開。若患者沒有正常呼吸，依 119 派遣員與 AED 語音指示進行 CPR 與電擊評估。";
    event.bubble = { speaker: event.responder, text: "AED 已到，請跟著語音與派遣員指示。" };
  } else {
    event.result = "只等待會錯過重要時間。另一位居民立即撥打 119 並取來 AED；你依提醒退開，讓救護通道保持暢通。";
    event.bubble = { speaker: event.responder, text: "遇到失去反應的人，要立刻求援，不要只等待。" };
  }
  event.resolved = true;
  if (event.type === "medical" && ["call-119", "get-aed"].includes(choiceId)) {
    void recordAchievementEvent("medical_rescue", event.achievementSubjectId);
  } else if (event.type === "theft" && ["call-110", "observe"].includes(choiceId)) {
    void recordAchievementEvent("theft_assist", event.achievementSubjectId);
  }
  if (event.actor) event.actor.isMoving = false;
  addTownRumor(
    event.district,
    event.type,
    event.type === "medical"
      ? "剛才有人突然失去反應，居民立刻求援、保持通道並由救護人員接手。"
      : "剛才店家通報失竊，居民保持安全距離並把親眼看到的方向提供給警方。",
  );
  renderTownEvent();
  announce(event.result);
}

function clearTownEvent(now, announcement) {
  const event = state.townEvent;
  if (!event) return;
  if (event.victim) event.victim.isCollapsed = false;
  state.townEvent = null;
  refs.townEventPanel.hidden = true;
  refs.townEventChoices.innerHTML = "";
  state.nextTownEventAt = now
    + TOWN_EVENT_COOLDOWN_MS
    + state.townEventSequence % 3 * TOWN_EVENT_COOLDOWN_STEP_MS;
  state.lastPromptTarget = null;
  if (state.ready) updateNearbyPrompt();
  canvas.focus({ preventScroll: true });
  announce(announcement);
}

function dismissTownEvent(now) {
  const event = state.townEvent;
  if (!event || event.resolved) return;
  clearTownEvent(now, "剛才的街區事件已自行結束，可以繼續探索小鎮。");
}

function finishTownEvent() {
  clearTownEvent(performance.now(), "街區事件已告一段落，可以繼續探索小鎮。 ");
}

function renderComicBubble() {
  let bubble = null;
  if (state.townEvent?.bubble) bubble = state.townEvent.bubble;
  else if (state.townMoment?.bubble) bubble = state.townMoment.bubble;
  else if (state.ambientConversation) bubble = state.ambientConversation.turns[state.ambientConversation.turnIndex];
  if (state.ambientConversation && performance.now() < state.ambientConversation.visibleAfter) bubble = null;
  if (!bubble?.speaker || bubble.speaker.insideVenueId) {
    hideComicBubble();
    return;
  }
  const canvasRect = canvas.getBoundingClientRect();
  const layerRect = refs.speechLayer.getBoundingClientRect();
  const canvasX = (bubble.speaker.x - state.camera.x) / WIDTH * canvasRect.width;
  const canvasY = (bubble.speaker.y - state.camera.y - 38) / HEIGHT * canvasRect.height;
  const speakerIsVisible = canvasX >= 16
    && canvasX <= canvasRect.width - 16
    && canvasY >= 38
    && canvasY <= canvasRect.height - 10;
  const isMovingAwayFromMoment = state.townMoment?.bubble === bubble
    && state.player.isMoving
    && Math.hypot(bubble.speaker.x - state.player.x, bubble.speaker.y - state.player.y) > 96;
  if (isMovingAwayFromMoment) state.townMoment.bubbleDismissed = true;
  if (!speakerIsVisible || state.townMoment?.bubbleDismissed) {
    hideComicBubble();
    return;
  }
  const left = Math.max(72, Math.min(layerRect.width - 72, canvasRect.left - layerRect.left + canvasX));
  const top = Math.max(76, Math.min(layerRect.height - 40, canvasRect.top - layerRect.top + canvasY));
  refs.comicSpeaker.textContent = npcDisplayName(bubble.speaker);
  refs.comicText.textContent = bubble.text;
  refs.comicBubble.style.left = `${left}px`;
  refs.comicBubble.style.top = `${top}px`;
  showComicBubble();
}

function hideComicBubble() {
  if (refs.comicBubble.hidden || refs.comicBubble.classList.contains("is-fading")) return;
  if (reducedMotion) {
    refs.comicBubble.hidden = true;
    return;
  }
  refs.comicBubble.classList.add("is-fading");
  state.comicBubbleFadeTimer = window.setTimeout(() => {
    if (refs.comicBubble.classList.contains("is-fading")) refs.comicBubble.hidden = true;
    state.comicBubbleFadeTimer = null;
  }, 240);
}

function showComicBubble() {
  if (state.comicBubbleFadeTimer) {
    window.clearTimeout(state.comicBubbleFadeTimer);
    state.comicBubbleFadeTimer = null;
  }
  const wasHidden = refs.comicBubble.hidden;
  refs.comicBubble.hidden = false;
  refs.comicBubble.classList.remove("is-fading");
  if (wasHidden) refs.comicBubble.getBoundingClientRect();
}

function drawTown(now, environment = townEnvironmentAt()) {
  context.imageSmoothingEnabled = false;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = COLORS.water;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.save();
  context.translate(-Math.round(state.camera.x), -Math.round(state.camera.y));
  drawGround();
  drawNeighborCountyGrounds();
  drawChanghuaRidgeConnection();
  drawWesternCoast(now);
  drawEasternMountainRange(now);
  drawBoundaryRivers(now);
  drawRiverbankLandscapes(now);
  drawMapEdges(now);
  drawRoads(now);
  drawBoundaryBridges();
  drawNeighborWorkZones(now, environment);
  drawNeighborCountyDetails(now);
  drawDistrictLabels();
  drawTownSquare();
  drawTownVenues(now);
  drawWeekendMarkets();
  state.schools.filter((school) => isVisibleRect(school.layout, 60)).forEach((school) => drawCampus(school, now));
  state.neighborSchools.filter((school) => isVisibleRect(school.layout, 60)).forEach((school) => drawCampus(school, now));
  drawStreetDetails(now, environment);
  drawBikeStations();
  const actors = [
    ...state.npcs.filter((person) => !person.insideVenueId && !person.backgroundSimulated).map((person) => ({ kind: "person", y: person.y, person })),
    ...state.pets.filter((pet) => !pet.hidden).map((pet) => ({ kind: "pet", y: pet.y, pet })),
    ...state.birds.map((bird) => ({ kind: "bird", y: bird.y, bird })),
    ...(state.townEvent?.actor ? [{ kind: "person", y: state.townEvent.actor.y, person: state.townEvent.actor }] : []),
    ...(state.townEvent?.responder ? [{ kind: "person", y: state.townEvent.responder.y, person: state.townEvent.responder }] : []),
    { kind: "person", y: state.player.y, person: { ...PLAYER_AVATARS[state.playerAvatarId], ...state.player, player: true } },
  ].filter((actor) => {
    const subject = actor.person || actor.pet || actor.bird;
    return isVisibleRect({ x: subject.x - 30, y: subject.y - 45, w: 60, h: 70 }, 40);
  }).sort((first, second) => first.y - second.y);
  drawDogLeashes();
  actors.forEach((actor) => {
    if (actor.kind === "person") drawPerson(actor.person, now);
    else if (actor.kind === "pet") drawPet(actor.pet, now);
    else drawBird(actor.bird, now);
  });
  drawNearbyNpcMarker();
  context.restore();
  drawAtmosphereOverlay(environment);
  drawStreetLightGlows(environment, now);
  drawRain(environment, now);
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

function townText(value) {
  return window.LunchI18n?.t(value) || String(value ?? "");
}

function townUsesEnglish() {
  return document.documentElement.lang.toLowerCase().startsWith("en");
}

function npcDisplayName(npc) {
  if (townUsesEnglish() && npc?.nameEn) return npc.nameEn;
  return townText(npc?.name || "");
}

function venueDisplayLabel(venue, short = false) {
  if (townUsesEnglish()) {
    const english = short ? venue?.shortLabelEn || venue?.labelEn : venue?.labelEn;
    if (english) return english;
  }
  return townText((short ? venue?.shortLabel : venue?.label) || venue?.label || "");
}

function venueDisplayDescription(venue) {
  if (townUsesEnglish() && venue?.descriptionEn) return venue.descriptionEn;
  return venue?.description || `${venueDisplayLabel(venue)}是街區居民會使用的場所。`;
}

function npcRoleLabel(npc) {
  return townText(ROLE_LABELS[npc?.role] || npc?.role || "居民");
}

function neighborCountyById(id) {
  return NEIGHBOR_COUNTIES.find((county) => county.id === id) || null;
}

function neighborCountyAtPoint(point) {
  return NEIGHBOR_COUNTIES.find((county) => pointInRect(point, county)) || null;
}

function drawNeighborCountyGrounds() {
  NEIGHBOR_COUNTIES.filter((county) => isVisibleRect(county, 40)).forEach((county) => {
    context.fillStyle = county.color;
    context.fillRect(county.x, county.y, county.w, county.h);
    drawNeighborCountyBackdrop(county);
    [...state.neighborDistrictThemes.values()]
      .filter((theme) => theme.county.id === county.id && isVisibleRect(theme.zone, 40))
      .forEach((theme) => drawNeighborDistrictTerrain(theme));
  });
}

function drawNeighborCountyBackdrop(county) {
  if (county.id === "miaoli") {
    const mountainStartX = county.x + county.w * 0.6;
    context.fillStyle = "rgba(52, 92, 63, 0.32)";
    context.fillRect(mountainStartX, county.y, county.x + county.w - mountainStartX, county.h);
    for (let y = county.y + 70; y < county.y + county.h; y += 82) {
      for (let x = mountainStartX + 30; x < county.x + county.w; x += 78) {
        context.fillStyle = (Math.floor((x + y) / 78) % 2) ? "rgba(42, 84, 58, 0.46)" : "rgba(64, 108, 67, 0.48)";
        context.beginPath();
        context.moveTo(x - 44, y + 44);
        context.lineTo(x, y - 24);
        context.lineTo(x + 44, y + 44);
        context.fill();
      }
    }
    return;
  }

  context.strokeStyle = "rgba(139, 126, 62, 0.2)";
  context.lineWidth = 2;
  for (let x = county.x + 36; x < county.x + county.w; x += 76) {
    context.beginPath();
    context.moveTo(x, county.y + 22);
    context.lineTo(x, county.y + county.h - 22);
    context.stroke();
  }
  for (let y = county.y + 46; y < county.y + county.h; y += 72) {
    context.beginPath();
    context.moveTo(county.x + 24, y);
    context.lineTo(county.x + county.w - 24, y);
    context.stroke();
  }
  context.strokeStyle = "rgba(80, 156, 174, 0.42)";
  context.lineWidth = 8;
  for (let canal = 0; canal < 3; canal += 1) {
    const canalY = county.y + 260 + canal * 430;
    context.beginPath();
    context.moveTo(county.x + 16, canalY);
    context.quadraticCurveTo(county.x + county.w / 2, canalY + 34, county.x + county.w - 18, canalY - 12);
    context.stroke();
  }
}

function drawNeighborDistrictTerrain(theme) {
  const { zone, terrain } = theme;
  context.fillStyle = zone.color;
  context.fillRect(zone.x, zone.y, zone.w, zone.h);
  context.strokeStyle = "rgba(55, 76, 58, 0.24)";
  context.lineWidth = 1;
  context.strokeRect(zone.x + 1, zone.y + 1, zone.w - 2, zone.h - 2);

  if (isNeighborFarmTerrain(terrain)) {
    const landscapeWidth = neighborDistrictLandscapeWidth(theme);
    context.fillStyle = theme.county.id === "changhua"
      ? "rgba(218, 207, 165, 0.24)"
      : "rgba(216, 205, 164, 0.18)";
    context.fillRect(zone.x + 7, zone.y + 54, zone.w - landscapeWidth - 14, zone.h - 62);
    drawNeighborFarmland(theme);
  }

  if (/hill|mountain|ridge/.test(terrain)) {
    const peakCount = terrain === "high-mountain" ? 6 : 4;
    const ridgeStartX = zone.x + zone.w * 0.67;
    context.fillStyle = "rgba(48, 91, 61, 0.2)";
    context.fillRect(ridgeStartX, zone.y + 48, zone.x + zone.w - ridgeStartX, zone.h - 56);
    for (let peak = 0; peak < peakCount; peak += 1) {
      const peakX = zone.x + zone.w - 28 - peak * 38;
      const peakY = zone.y + 46 + (peak % 2) * 18;
      const height = terrain === "high-mountain" ? 58 + peak * 5 : 40 + peak * 4;
      context.fillStyle = peak % 2 ? "rgba(48, 96, 64, 0.62)" : "rgba(66, 116, 70, 0.65)";
      context.beginPath();
      context.moveTo(peakX - 28, peakY + height);
      context.lineTo(peakX, peakY);
      context.lineTo(peakX + 28, peakY + height);
      context.fill();
      if (terrain === "high-mountain" && peak < 2) {
        context.fillStyle = "rgba(245, 244, 224, 0.82)";
        context.beginPath();
        context.moveTo(peakX - 7, peakY + 10);
        context.lineTo(peakX, peakY);
        context.lineTo(peakX + 8, peakY + 11);
        context.fill();
      }
    }
  }

  if (terrain.includes("coast")) {
    context.fillStyle = "rgba(93, 161, 174, 0.35)";
    context.fillRect(zone.x + 5, zone.y + 6, 13, zone.h - 12);
    context.fillStyle = "rgba(236, 213, 145, 0.58)";
    context.fillRect(zone.x + 18, zone.y + 6, 9, zone.h - 12);
  }

  if (terrain.includes("river")) {
    context.strokeStyle = "rgba(86, 159, 178, 0.65)";
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(zone.x + 12, zone.y + zone.h - 30);
    context.quadraticCurveTo(zone.x + zone.w / 2, zone.y + zone.h - 54, zone.x + zone.w - 10, zone.y + zone.h - 26);
    context.stroke();
  }
}

function drawNeighborFarmland(theme) {
  const { zone, terrain } = theme;
  const geometry = neighborFarmlandGeometry(theme);
  const fieldSeed = hashText(`${theme.county.id}-${theme.name}-${terrain}-fields`);
  const fieldColors = terrain === "flower-field" || terrain === "garden-farm"
    ? ["#bdad69", "#c89e72", "#a6b06a", "#c7ad6c"]
    : ["#839f78", "#91a76f", "#a69f62", "#78978a"];

  context.fillStyle = "#8a7852";
  context.fillRect(
    geometry.fieldStartX - 5,
    geometry.fieldTop - 5,
    geometry.fieldWidth + 10,
    geometry.fieldHeight + 10,
  );
  neighborPaddyParcels(theme).forEach((parcel, parcelIndex) => {
    const stage = Math.abs(fieldSeed + parcelIndex * 7) % fieldColors.length;
    context.fillStyle = fieldColors[stage];
    context.fillRect(parcel.x, parcel.y, parcel.w, parcel.h);
    context.fillStyle = "rgba(178, 212, 204, 0.16)";
    for (let waterY = parcel.y + 7; waterY < parcel.y + parcel.h - 4; waterY += 13) {
      context.fillRect(parcel.x + 5, waterY, Math.max(4, parcel.w - 10), 2);
    }
    drawFieldCrops(parcel, terrain, fieldSeed + parcelIndex * 13);
    context.strokeStyle = "rgba(91, 78, 48, 0.62)";
    context.lineWidth = 2;
    context.strokeRect(parcel.x + 1, parcel.y + 1, parcel.w - 2, parcel.h - 2);
  });

  context.strokeStyle = "rgba(67, 132, 151, 0.88)";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(geometry.fieldStartX - 8, geometry.fieldTop - 4);
  context.lineTo(geometry.fieldStartX - 8, geometry.fieldTop + geometry.fieldHeight + 4);
  context.stroke();
  context.strokeStyle = "rgba(192, 226, 219, 0.62)";
  context.lineWidth = 1;
  context.stroke();
}

function drawFieldCrops(parcel, terrain, seed) {
  if (/flower|garden/.test(terrain)) {
    const colors = ["#e76868", "#efc54d", "#d284b4", "#ed9452"];
    for (let y = parcel.y + 9; y < parcel.y + parcel.h - 4; y += 11) {
      for (let x = parcel.x + 8; x < parcel.x + parcel.w - 4; x += 12) {
        context.fillStyle = colors[Math.abs(seed + Math.floor(x + y)) % colors.length];
        context.fillRect(x, y, 4, 4);
      }
    }
    return;
  }
  if (terrain.includes("orchard")) {
    for (let y = parcel.y + 12; y < parcel.y + parcel.h - 5; y += 16) {
      for (let x = parcel.x + 11; x < parcel.x + parcel.w - 5; x += 17) {
        context.fillStyle = "#70553a";
        context.fillRect(x, y, 2, 6);
        context.fillStyle = (seed + Math.floor(x + y)) % 2 ? "#47754f" : "#598352";
        context.fillRect(x - 4, y - 4, 10, 7);
      }
    }
    return;
  }
  if (terrain.includes("sugar")) {
    context.fillStyle = "rgba(63, 111, 64, 0.86)";
    for (let x = parcel.x + 7; x < parcel.x + parcel.w - 4; x += 8) {
      context.fillRect(x, parcel.y + 7, 3, Math.max(5, parcel.h - 14));
    }
    return;
  }
  drawRiceSeedlings(parcel, seed);
}

function drawRiceSeedlings(parcel, seed) {
  const offset = Math.abs(seed) % 4;
  context.fillStyle = "rgba(43, 91, 57, 0.84)";
  for (let y = parcel.y + 9 + offset; y < parcel.y + parcel.h - 5; y += 12) {
    for (let x = parcel.x + 8 + offset; x < parcel.x + parcel.w - 5; x += 12) {
      context.fillRect(x, y, 2, 6);
      context.fillRect(x - 2, y + 2, 3, 2);
      context.fillRect(x + 1, y + 1, 3, 2);
    }
  }
}

function drawChanghuaRidgeConnection() {
  const ridgeDistricts = ["彰化市", "芬園鄉", "花壇鄉", "社頭鄉", "田中鎮", "二水鄉"]
    .map((district) => state.neighborDistrictThemes.get(district))
    .filter(Boolean)
    .sort((first, second) => first.zone.y - second.zone.y);
  if (!ridgeDistricts.length) return;
  context.save();
  context.strokeStyle = "rgba(49, 91, 58, 0.48)";
  context.lineWidth = 34;
  context.lineJoin = "round";
  context.beginPath();
  ridgeDistricts.forEach((theme, index) => {
    const x = theme.zone.x + theme.zone.w - 34;
    const y = theme.zone.y + theme.zone.h / 2;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  context.strokeStyle = "rgba(108, 139, 79, 0.54)";
  context.lineWidth = 8;
  context.stroke();
  context.restore();
}

function drawNeighborWorkZones(now, environment) {
  state.neighborWorkZones.filter((zone) => isVisibleRect(zone, 50)).forEach((zone) => {
    drawNeighborWorkZone(zone, now, environment);
  });
}

function drawNeighborWorkZone(zone, now, environment) {
  const { x, y, w, h, type } = zone;
  context.save();
  context.fillStyle = "rgba(36, 54, 48, 0.2)";
  context.fillRect(x + 3, y + 4, w, h);
  context.fillStyle = "#a8ac72";
  context.fillRect(x, y, w, h);

  if (type === "rice-paddy") drawRiceWorkZone(zone);
  else if (["vegetable-field", "produce-coop"].includes(type)) drawVegetableWorkZone(zone, type === "produce-coop");
  else if (type === "grape-packing-yard") drawGrapeWorkZone(zone);
  else if (["nursery-field", "horticulture-market", "lit-flower-route"].includes(type)) drawHorticultureWorkZone(zone, environment);
  else if (type === "tidal-oyster-field") drawTidalOysterWorkZone(zone, now);
  else if (["wanggong-harbor", "harbor-village"].includes(type)) drawHarborWorkZone(zone, type === "wanggong-harbor");
  else if (type === "railway-yard") drawRailWorkZone(zone, false);
  else if (type === "sugar-rail-yard") drawRailWorkZone(zone, true);
  else if (type === "craft-quarter") drawCraftWorkZone(zone);
  else if (["produce-market", "agriculture-service"].includes(type)) drawAgricultureServiceWorkZone(zone, type);
  else if (type === "irrigation-network") drawIrrigationWorkZone(zone);

  context.fillStyle = zone.restricted ? "rgba(104, 50, 40, 0.93)" : "rgba(31, 53, 57, 0.9)";
  context.fillRect(x, y + h - 13, w, 13);
  context.fillStyle = COLORS.paper;
  context.font = `bold ${fitSchoolLabelFont(townText(zone.name), w - 8, 8, 6)}px ui-monospace, monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(townText(zone.name), x + w / 2, y + h - 6, w - 8);
  if (zone.restricted) {
    context.fillStyle = "#f2ca65";
    context.fillRect(x + w - 14, y + 3, 9, 9);
    context.fillStyle = "#6b352d";
    context.fillRect(x + w - 11, y + 5, 3, 5);
  }
  context.restore();
}

function drawRiceWorkZone({ x, y, w, h }) {
  context.fillStyle = "#72a2a0";
  context.fillRect(x + 4, y + 4, w - 8, h - 21);
  context.fillStyle = "#806a43";
  context.fillRect(x + w / 2 - 2, y + 4, 5, h - 21);
  context.fillRect(x + 4, y + 20, w - 8, 4);
  context.fillStyle = "#3f7750";
  for (let cropY = y + 9; cropY < y + h - 18; cropY += 11) {
    for (let cropX = x + 10; cropX < x + w - 8; cropX += 15) context.fillRect(cropX, cropY, 2, 6);
  }
  context.fillStyle = "#c9ba78";
  context.fillRect(x + 7, y + 4, 10, 9);
  context.fillStyle = "#466f77";
  context.fillRect(x + 10, y + 7, 4, 8);
}

function drawVegetableWorkZone({ x, y, w, h }, withWarehouse) {
  context.fillStyle = "#7d9d65";
  context.fillRect(x + 4, y + 4, w - 8, h - 21);
  context.fillStyle = "#456e47";
  for (let row = 0; row < 4; row += 1) {
    const rowY = y + 9 + row * 8;
    for (let cropX = x + 9; cropX < x + w - (withWarehouse ? 48 : 7); cropX += 11) context.fillRect(cropX, rowY, 5, 4);
  }
  context.fillStyle = "#b77845";
  context.fillRect(x + w - 44, y + 25, 13, 9);
  context.fillRect(x + w - 28, y + 25, 13, 9);
  if (withWarehouse) {
    context.fillStyle = "#d5c99e";
    context.fillRect(x + w - 52, y + 6, 45, 18);
    context.fillStyle = "#8b5842";
    context.fillRect(x + w - 55, y + 3, 51, 6);
  }
}

function drawGrapeWorkZone({ x, y, w, h }) {
  context.fillStyle = "#9a9564";
  context.fillRect(x + 4, y + 4, w - 8, h - 21);
  context.strokeStyle = "#6e563c";
  context.lineWidth = 2;
  for (let postX = x + 9; postX < x + w - 48; postX += 18) {
    context.beginPath(); context.moveTo(postX, y + 7); context.lineTo(postX, y + h - 17); context.stroke();
  }
  context.strokeStyle = "#3e7048";
  for (let lineY = y + 10; lineY < y + h - 18; lineY += 9) {
    context.beginPath(); context.moveTo(x + 7, lineY); context.lineTo(x + w - 48, lineY); context.stroke();
  }
  context.fillStyle = "#704a79";
  for (let grapeX = x + 15; grapeX < x + w - 50; grapeX += 25) context.fillRect(grapeX, y + 14, 5, 7);
  context.fillStyle = "#d2c392";
  context.fillRect(x + w - 43, y + 7, 35, 25);
  context.fillStyle = "#9a5b45";
  context.fillRect(x + w - 46, y + 4, 41, 6);
  context.fillStyle = "#af7546";
  context.fillRect(x + w - 36, y + 22, 10, 10);
}

function drawHorticultureWorkZone({ x, y, w, h, type }, environment) {
  context.fillStyle = "#809b68";
  context.fillRect(x + 4, y + 4, w - 8, h - 21);
  if (type === "horticulture-market") {
    context.fillStyle = "rgba(230, 239, 217, 0.82)";
    context.fillRect(x + 8, y + 6, 52, 25);
    context.strokeStyle = "#6c8873";
    context.strokeRect(x + 8, y + 6, 52, 25);
    context.fillStyle = "#d6c78d";
    context.fillRect(x + w - 52, y + 8, 44, 23);
    context.fillStyle = "#9d5c46";
    context.fillRect(x + w - 55, y + 5, 50, 6);
  }
  context.strokeStyle = "#d8cda7";
  context.lineWidth = type === "lit-flower-route" ? 6 : 2;
  context.beginPath(); context.moveTo(x + 8, y + h - 22); context.lineTo(x + w - 8, y + 8); context.stroke();
  const colors = ["#e7666d", "#edc04c", "#bd7cad", "#ef8d4e"];
  for (let flower = 0; flower < 10; flower += 1) {
    context.fillStyle = colors[flower % colors.length];
    context.fillRect(x + 10 + flower * (w - 22) / 10, y + 11 + (flower % 3) * 7, 4, 4);
  }
  if (type === "lit-flower-route" && environment?.isNight) {
    context.fillStyle = "rgba(255, 226, 120, 0.9)";
    for (let light = 0; light < 5; light += 1) context.fillRect(x + 12 + light * 30, y + 6, 4, 10);
  }
}

function drawTidalOysterWorkZone({ x, y, w, h }, now) {
  context.fillStyle = "#71979b";
  context.fillRect(x + 4, y + 4, w - 8, h - 21);
  context.fillStyle = "#756a55";
  for (let poleX = x + 16; poleX < x + w - 14; poleX += 19) {
    context.fillRect(poleX, y + 8, 3, 22);
    context.fillRect(poleX - 5, y + 16, 13, 2);
  }
  context.fillStyle = "#d5c294";
  context.fillRect(x + 5, y + h - 25, w - 10, 5);
  const cartX = x + 25 + (reducedMotion ? 0 : (Math.sin(now / 1300) + 1) * 12);
  context.fillStyle = "#745644";
  context.fillRect(cartX, y + 23, 18, 7);
  context.fillRect(cartX + 2, y + 30, 4, 4);
  context.fillRect(cartX + 13, y + 30, 4, 4);
  context.fillStyle = "#8c7050";
  context.fillRect(cartX - 8, y + 23, 7, 5);
}

function drawHarborWorkZone({ x, y, w, h }, detailed) {
  context.fillStyle = "#6e9faa";
  context.fillRect(x + 4, y + 18, w - 8, h - 35);
  context.fillStyle = "#c9b88b";
  context.fillRect(x + 4, y + 14, w - 8, 5);
  context.fillStyle = "#e5e1cf";
  context.fillRect(x + w - 28, y + 3, 9, 23);
  context.fillStyle = "#d25b4c";
  context.fillRect(x + w - 30, y + 2, 13, 5);
  context.fillStyle = "#c66b45";
  context.fillRect(x + 18, y + 23, 25, 5);
  context.fillStyle = "#f0e7c9";
  context.fillRect(x + 24, y + 16, 11, 7);
  if (detailed) {
    context.fillStyle = "#48745b";
    for (let tree = 0; tree < 4; tree += 1) context.fillRect(x + 55 + tree * 12, y + 8 + tree % 2 * 3, 8, 10);
  }
}

function drawRailWorkZone({ x, y, w, h }, sugar) {
  context.fillStyle = "#747b73";
  context.fillRect(x + 4, y + 4, w - 8, h - 21);
  context.strokeStyle = "#454b4c";
  context.lineWidth = 2;
  if (sugar) {
    context.fillStyle = "#8f5540";
    context.fillRect(x + 12, y + 3, 9, 30);
    context.fillStyle = "#d4c49a";
    context.fillRect(x + 29, y + 9, 45, 22);
    context.fillStyle = "#935943";
    context.fillRect(x + 26, y + 6, 51, 6);
    for (let railY = y + 28; railY <= y + 32; railY += 4) {
      context.beginPath(); context.moveTo(x + 5, railY); context.lineTo(x + w - 5, railY); context.stroke();
    }
    context.fillStyle = "#bd8a43";
    context.fillRect(x + w - 47, y + 20, 26, 9);
  } else {
    const cx = x + w / 2;
    const cy = y + 22;
    context.beginPath(); context.arc(cx, cy, 14, 0, Math.PI * 2); context.stroke();
    for (let rail = -2; rail <= 2; rail += 1) {
      context.beginPath(); context.moveTo(cx, cy); context.lineTo(cx + rail * 22, y + 4); context.stroke();
    }
    context.fillStyle = "#cfbd92";
    context.fillRect(x + 8, y + 5, 30, 22);
    context.fillStyle = "#9b5d46";
    context.fillRect(x + 5, y + 2, 36, 6);
  }
}

function drawCraftWorkZone({ x, y, w, h }) {
  context.fillStyle = "#c7b681";
  context.fillRect(x + 4, y + 4, w - 8, h - 21);
  context.fillStyle = "#9b5c47";
  context.fillRect(x + 8, y + 4, 5, 25);
  context.fillRect(x + 31, y + 4, 5, 25);
  context.fillRect(x + 8, y + 4, 28, 5);
  for (let shop = 0; shop < 3; shop += 1) {
    const shopX = x + 50 + shop * 34;
    context.fillStyle = shop % 2 ? "#d5c28f" : "#dfcd99";
    context.fillRect(shopX, y + 10, 30, 20);
    context.fillStyle = shop % 2 ? "#657d83" : "#9b5944";
    context.fillRect(shopX - 2, y + 7, 34, 5);
  }
  context.fillStyle = "#e1d5af";
  context.fillRect(x + 42, y + 31, w - 49, 5);
}

function drawAgricultureServiceWorkZone({ x, y, w, h }, type) {
  context.fillStyle = "#d3c69b";
  context.fillRect(x + 9, y + 7, w - 18, h - 25);
  context.fillStyle = type === "produce-market" ? "#9e6047" : "#587985";
  context.fillRect(x + 6, y + 4, w - 12, 7);
  context.fillStyle = "#6a8b77";
  for (let windowX = x + 18; windowX < x + w - 12; windowX += 28) context.fillRect(windowX, y + 14, 12, 8);
  context.fillStyle = "#b77b48";
  context.fillRect(x + 12, y + h - 24, 12, 8);
  context.fillRect(x + 28, y + h - 24, 12, 8);
}

function drawIrrigationWorkZone({ x, y, w, h }) {
  context.fillStyle = "#83966c";
  context.fillRect(x + 4, y + 4, w - 8, h - 21);
  context.fillStyle = "#588c9a";
  context.fillRect(x + 5, y + 20, w - 10, 10);
  context.fillStyle = "#c4b789";
  context.fillRect(x + 5, y + 15, w - 10, 5);
  context.fillRect(x + 5, y + 30, w - 10, 5);
  context.fillStyle = "#d0c39c";
  context.fillRect(x + w - 42, y + 6, 32, 14);
  context.fillStyle = "#596c70";
  context.fillRect(x + w - 32, y + 10, 10, 10);
  context.fillStyle = "#8a593f";
  context.fillRect(x + 18, y + 14, 4, 18);
  context.fillRect(x + 14, y + 19, 12, 3);
}

function boundaryRiverYAt(x, bridge) {
  return bridge.riverY
    + Math.sin((x - bridge.x) / 218) * 18
    + Math.sin((x - bridge.x) / 73) * 5;
}

function boundaryRiverBounds(bridge) {
  return {
    startX: Math.max(0, coastlineXAt(bridge.riverY) - 36),
    endX: Math.min(WORLD_WIDTH, EAST_MOUNTAIN_START_X + 172),
  };
}

function boundaryRiverPath(bridge) {
  const path = new Path2D();
  const { startX, endX } = boundaryRiverBounds(bridge);
  for (let x = startX; x <= endX; x += 42) {
    const y = boundaryRiverYAt(x, bridge);
    if (x === startX) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.lineTo(endX, boundaryRiverYAt(endX, bridge));
  return path;
}

function drawBoundaryRiverCurrents(now, bridge, path) {
  const { startX, endX } = boundaryRiverBounds(bridge);
  const flowDistance = reducedMotion ? 0 : now * 0.055;
  context.save();
  context.lineCap = "square";
  RIVER_FLOW_LANE_OFFSETS.forEach((laneOffset, laneIndex) => {
    context.save();
    context.translate(0, laneOffset);
    context.strokeStyle = laneIndex % 2
      ? "rgba(188, 235, 235, 0.62)"
      : "rgba(127, 199, 211, 0.58)";
    context.lineWidth = laneIndex % 2 ? 3 : 2;
    context.setLineDash(laneIndex % 2 ? [26, 22] : [14, 18]);
    context.lineDashOffset = flowDistance * (1 + laneIndex * 0.12);
    context.stroke(path);
    context.restore();
  });
  context.setLineDash([]);

  const visibleStartX = Math.max(startX + 24, state.camera.x - 80);
  const visibleEndX = Math.min(endX - 24, state.camera.x + WIDTH + 80);
  const flowTravel = reducedMotion ? 0 : flowDistance % RIVER_FLOW_CHEVRON_SPACING;
  const firstChevronX = Math.floor((visibleStartX + flowTravel) / RIVER_FLOW_CHEVRON_SPACING)
    * RIVER_FLOW_CHEVRON_SPACING;
  let chevronIndex = Math.floor(firstChevronX / RIVER_FLOW_CHEVRON_SPACING);
  for (
    let anchorX = firstChevronX;
    anchorX <= visibleEndX + RIVER_FLOW_CHEVRON_SPACING;
    anchorX += RIVER_FLOW_CHEVRON_SPACING
  ) {
    const x = anchorX - flowTravel;
    if (x < visibleStartX || x > visibleEndX) {
      chevronIndex += 1;
      continue;
    }
    const laneOffset = RIVER_FLOW_LANE_OFFSETS[Math.abs(chevronIndex) % RIVER_FLOW_LANE_OFFSETS.length];
    const y = boundaryRiverYAt(x, bridge) + laneOffset;
    const angle = Math.atan2(
      boundaryRiverYAt(x + 5, bridge) - boundaryRiverYAt(x - 5, bridge),
      10,
    );
    context.save();
    context.translate(Math.round(x), Math.round(y));
    context.rotate(angle);
    context.strokeStyle = chevronIndex % 2
      ? "rgba(226, 249, 244, 0.88)"
      : "rgba(176, 228, 232, 0.82)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(11, -5);
    context.lineTo(2, 0);
    context.lineTo(11, 5);
    context.moveTo(2, 0);
    context.lineTo(19, 0);
    context.stroke();
    context.restore();
    chevronIndex += 1;
  }
  context.restore();
}

function drawBoundaryRivers(now) {
  BOUNDARY_BRIDGES.forEach((bridge) => {
    if (!isVisibleRect({ x: 0, y: bridge.riverY - 90, w: WORLD_WIDTH, h: 180 }, 20)) return;
    const path = boundaryRiverPath(bridge);
    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#c8b98b";
    context.lineWidth = BORDER_RIVER_WIDTH + 22;
    context.stroke(path);
    const waterGradient = context.createLinearGradient(
      0,
      bridge.riverY - BORDER_RIVER_WIDTH / 2,
      0,
      bridge.riverY + BORDER_RIVER_WIDTH / 2,
    );
    waterGradient.addColorStop(0, "#397b94");
    waterGradient.addColorStop(0.22, "#4d9bb0");
    waterGradient.addColorStop(0.5, "#5aaabd");
    waterGradient.addColorStop(0.78, "#478fa7");
    waterGradient.addColorStop(1, "#356f8b");
    context.strokeStyle = waterGradient;
    context.lineWidth = BORDER_RIVER_WIDTH;
    context.stroke(path);
    context.strokeStyle = "rgba(39, 111, 132, 0.38)";
    context.lineWidth = 18;
    context.setLineDash([54, 20]);
    context.lineDashOffset = reducedMotion ? 0 : now * 0.018;
    context.stroke(path);
    context.setLineDash([]);
    drawBoundaryRiverCurrents(now, bridge, path);
    context.restore();
  });
}

function taichungRiverbankSide(bridge) {
  return bridge.countyId === "miaoli" ? 1 : -1;
}

function riverbankYAt(x, bridge, bankSide = taichungRiverbankSide(bridge)) {
  return boundaryRiverYAt(x, bridge) + bankSide * RIVERBANK_PATH_OFFSET;
}

function riverbankLeisureSites() {
  if (riverbankLeisureSiteCache) return riverbankLeisureSiteCache;
  const specifications = [
    {
      bridge: BOUNDARY_BRIDGES[0], district: "后里區", prefix: "北界",
      fishingX: BOUNDARY_BRIDGES[0].x - 430, barbecueX: BOUNDARY_BRIDGES[0].x + 560,
    },
    {
      bridge: BOUNDARY_BRIDGES[1], district: "烏日區", prefix: "南界",
      fishingX: BOUNDARY_BRIDGES[1].x + 430, barbecueX: BOUNDARY_BRIDGES[1].x - 560,
    },
  ];
  riverbankLeisureSiteCache = Object.freeze(specifications.flatMap((specification) => {
    const { bridge, district, prefix } = specification;
    const bankSide = taichungRiverbankSide(bridge);
    const fishingY = boundaryRiverYAt(specification.fishingX, bridge)
      + bankSide * (BORDER_RIVER_WIDTH / 2 + 16);
    const barbecuePathY = riverbankYAt(specification.barbecueX, bridge, bankSide);
    return [
      Object.freeze({
        id: `${bridge.countyId}-fishing-deck`, bridgeId: bridge.id, activity: "fishing",
        x: specification.fishingX, y: fishingY, stopX: specification.fishingX,
        stopY: fishingY, bankSide, district, label: `${prefix}河濱釣魚平台`,
      }),
      Object.freeze({
        id: `${bridge.countyId}-barbecue-area`, bridgeId: bridge.id, activity: "barbecuing",
        x: specification.barbecueX, y: barbecuePathY + bankSide * 16,
        stopX: specification.barbecueX - 28, stopY: barbecuePathY + bankSide * 16,
        bankSide, district, label: `${prefix}河岸休憩區`,
      }),
    ];
  }));
  return riverbankLeisureSiteCache;
}

function riverbankLeisureSiteById(id) {
  return riverbankLeisureSites().find((site) => site.id === id) || null;
}

function riverbankFixturePositions() {
  const fixtures = [];
  BOUNDARY_BRIDGES.forEach((bridge, bridgeIndex) => {
    if (!isVisibleRect({ x: 0, y: bridge.riverY - 130, w: WORLD_WIDTH, h: 260 }, 30)) return;
    const { startX, endX } = boundaryRiverBounds(bridge);
    const visibleStartX = Math.max(startX + 90, state.camera.x - 100);
    const visibleEndX = Math.min(endX - 90, state.camera.x + WIDTH + 100);
    const nearbySites = riverbankLeisureSites().filter((site) => site.bridgeId === bridge.id);
    for (let x = Math.floor(visibleStartX / 260) * 260; x <= visibleEndX; x += 260) {
      if (Math.abs(x - bridge.x) < 130 || nearbySites.some((site) => Math.abs(site.x - x) < 110)) continue;
      const fixtureIndex = Math.floor(x / 260) + bridgeIndex;
      fixtures.push({
        kind: fixtureIndex % 2 ? "bench" : "lamp",
        x,
        y: riverbankYAt(x, bridge),
        bankSide: taichungRiverbankSide(bridge),
      });
    }
  });
  return fixtures;
}

function drawRiverbankLandscapes(now) {
  BOUNDARY_BRIDGES.forEach((bridge) => drawRiverbankLevee(bridge));
  riverbankFixturePositions().forEach((fixture) => {
    if (fixture.kind === "lamp") drawLamp(fixture.x, fixture.y + fixture.bankSide * 7);
    else drawRiverbankBench(fixture.x, fixture.y + fixture.bankSide * 8);
  });
  riverbankLeisureSites().forEach((site) => {
    if (!isVisibleRect({ x: site.x - 90, y: site.y - 80, w: 180, h: 160 }, 40)) return;
    if (site.activity === "fishing") drawRiverbankFishingDeck(site);
    else drawRiverbankBarbecueArea(site, now);
  });
}

function drawRiverbankLevee(bridge) {
  if (!isVisibleRect({ x: 0, y: bridge.riverY - 140, w: WORLD_WIDTH, h: 280 }, 20)) return;
  const path = boundaryRiverPath(bridge);
  const bankSide = taichungRiverbankSide(bridge);
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.translate(0, bankSide * RIVERBANK_PATH_OFFSET);
  context.strokeStyle = "#527557";
  context.lineWidth = 48;
  context.stroke(path);
  context.strokeStyle = "#7f9d68";
  context.lineWidth = 42;
  context.stroke(path);
  context.strokeStyle = "#a99f88";
  context.lineWidth = 14;
  context.stroke(path);
  context.strokeStyle = "#e1d4ad";
  context.lineWidth = 2;
  context.setLineDash([20, 14]);
  context.stroke(path);
  context.restore();

  context.save();
  context.translate(0, bankSide * (BORDER_RIVER_WIDTH / 2 + 8));
  context.strokeStyle = "#6d7572";
  context.lineWidth = 11;
  context.stroke(path);
  context.strokeStyle = "#aeb3a8";
  context.lineWidth = 3;
  context.stroke(path);
  context.restore();
}

function drawRiverbankBench(x, y) {
  context.fillStyle = "rgba(28, 54, 48, 0.2)";
  context.fillRect(Math.round(x - 23), Math.round(y + 8), 46, 5);
  context.fillStyle = "#8f5e3c";
  context.fillRect(Math.round(x - 20), Math.round(y - 3), 40, 7);
  context.fillRect(Math.round(x - 20), Math.round(y - 12), 40, 6);
  context.fillStyle = "#48534e";
  context.fillRect(Math.round(x - 16), Math.round(y + 4), 4, 10);
  context.fillRect(Math.round(x + 12), Math.round(y + 4), 4, 10);
}

function drawRiverbankFishingDeck(site) {
  const bridge = BOUNDARY_BRIDGES.find((item) => item.id === site.bridgeId);
  if (!bridge) return;
  const riverEdgeY = boundaryRiverYAt(site.x, bridge)
    + site.bankSide * (BORDER_RIVER_WIDTH / 2 + 7);
  const pathY = riverbankYAt(site.x, bridge, site.bankSide);
  const top = Math.min(riverEdgeY, pathY);
  const height = Math.abs(pathY - riverEdgeY);
  context.fillStyle = "rgba(25, 49, 52, 0.24)";
  context.fillRect(Math.round(site.x - 36), Math.round(top + 5), 72, Math.round(height + 7));
  context.fillStyle = "#9d7348";
  context.fillRect(Math.round(site.x - 34), Math.round(top), 68, Math.round(height + 5));
  context.fillStyle = "#c79a5c";
  for (let y = top + 4; y < top + height; y += 9) {
    context.fillRect(Math.round(site.x - 32), Math.round(y), 64, 3);
  }
  context.fillStyle = "#5c5143";
  context.fillRect(Math.round(site.x - 36), Math.round(top), 5, Math.round(height + 5));
  context.fillRect(Math.round(site.x + 31), Math.round(top), 5, Math.round(height + 5));
  const signY = pathY + site.bankSide * 25;
  drawRiverbankSiteSign(site.x, signY, "釣魚平台");
}

function drawRiverbankBarbecueArea(site, now) {
  const active = state.npcs.some((npc) => (
    !npc.insideVenueId && npc.riverbankSiteId === site.id && npc.activity === "barbecuing"
  ));
  context.fillStyle = "rgba(28, 53, 46, 0.2)";
  context.fillRect(Math.round(site.x - 74), Math.round(site.y - 31), 148, 66);
  context.fillStyle = "#c8b98d";
  context.fillRect(Math.round(site.x - 72), Math.round(site.y - 34), 144, 62);
  context.fillStyle = "#9b6b43";
  context.fillRect(Math.round(site.x - 60), Math.round(site.y - 14), 50, 8);
  context.fillRect(Math.round(site.x - 48), Math.round(site.y - 6), 5, 20);
  context.fillRect(Math.round(site.x - 21), Math.round(site.y - 6), 5, 20);
  context.fillStyle = "#3e4845";
  context.fillRect(Math.round(site.x + 12), Math.round(site.y - 15), 34, 14);
  context.fillRect(Math.round(site.x + 17), Math.round(site.y - 1), 5, 17);
  context.fillRect(Math.round(site.x + 37), Math.round(site.y - 1), 5, 17);
  context.fillStyle = active ? "#e46c32" : "#6a665e";
  context.fillRect(Math.round(site.x + 18), Math.round(site.y - 19), 8, 5);
  context.fillStyle = active ? "#f3b23d" : "#837d72";
  context.fillRect(Math.round(site.x + 29), Math.round(site.y - 18), 9, 4);
  if (active) {
    const smoke = reducedMotion ? 0 : Math.floor(now / 360) % 3;
    context.fillStyle = "rgba(226, 230, 217, 0.7)";
    context.fillRect(Math.round(site.x + 25 + smoke * 2), Math.round(site.y - 29 - smoke * 3), 7, 6);
    context.fillRect(Math.round(site.x + 33 - smoke), Math.round(site.y - 38 - smoke * 2), 6, 5);
  }
  context.fillStyle = "#49675e";
  context.fillRect(Math.round(site.x + 55), Math.round(site.y - 6), 12, 24);
  context.fillStyle = "#6b91a1";
  context.fillRect(Math.round(site.x + 50), Math.round(site.y + 10), 9, 9);
  drawRiverbankSiteSign(site.x - 10, site.y + site.bankSide * 42, "指定休憩區");
}

function drawRiverbankSiteSign(x, y, label) {
  context.fillStyle = "#58645d";
  context.fillRect(Math.round(x - 2), Math.round(y - 1), 4, 25);
  context.fillStyle = "#f1e3b7";
  context.fillRect(Math.round(x - 43), Math.round(y - 19), 86, 20);
  context.strokeStyle = "#58645d";
  context.lineWidth = 2;
  context.strokeRect(Math.round(x - 43), Math.round(y - 19), 86, 20);
  context.fillStyle = COLORS.navy;
  context.font = "bold 10px ui-monospace, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(townText(label), Math.round(x), Math.round(y - 9), 80);
}

function drawNeighborCountyRoads() {
  BOUNDARY_BRIDGES.forEach((bridge) => {
    const county = neighborCountyById(bridge.countyId);
    const countyTheme = state.neighborCountyThemes.get(bridge.countyId);
    if (!county || !countyTheme) return;
    const metrics = neighborCountyGridMetrics(county, countyTheme.rows);
    const riverEdgeY = bridge.riverY + (county.side === "north" ? -1 : 1) * (BORDER_RIVER_WIDTH / 2 + 24);
    const entryY = county.side === "north" ? metrics.bottom : metrics.top;
    const nearestBoundary = Math.max(1, Math.min(
      NEIGHBOR_COUNTY_DISTRICT_COLUMNS - 1,
      Math.round((bridge.x - metrics.left) / metrics.cellWidth),
    ));
    const entryX = metrics.left + nearestBoundary * metrics.cellWidth;
    const path = new Path2D();
    path.moveTo(bridge.x, riverEdgeY);
    path.lineTo(bridge.x, entryY);
    path.lineTo(entryX, entryY);
    strokeRoadPath(path);

    for (let column = 1; column < NEIGHBOR_COUNTY_DISTRICT_COLUMNS; column += 1) {
      const x = metrics.left + column * metrics.cellWidth;
      const route = new Path2D();
      route.moveTo(x, metrics.top);
      route.lineTo(x, metrics.bottom);
      strokeRoadPath(route);
    }
    for (let row = 1; row < countyTheme.rows; row += 1) {
      const y = metrics.top + row * metrics.cellHeight;
      const route = new Path2D();
      route.moveTo(metrics.left, y);
      route.lineTo(metrics.right, y);
      strokeRoadPath(route);
    }
  });
}

function neighborCountyDistrictRoutes(countyId) {
  const themes = [...state.neighborDistrictThemes.values()]
    .filter((theme) => theme.county.id === countyId);
  const routes = [];
  const seen = new Set();
  const connectGroups = (coordinateIndex) => {
    const groups = new Map();
    themes.forEach((theme) => {
      const groupKey = theme.grid[coordinateIndex];
      const group = groups.get(groupKey) || [];
      group.push(theme);
      groups.set(groupKey, group);
    });
    groups.forEach((group) => {
      group.sort((first, second) => first.grid[1 - coordinateIndex] - second.grid[1 - coordinateIndex]);
      for (let index = 1; index < group.length; index += 1) {
        const first = group[index - 1];
        const second = group[index];
        const key = [first.name, second.name].sort().join("|");
        if (!seen.has(key)) routes.push([first, second]);
        seen.add(key);
      }
    });
  };
  connectGroups(0);
  connectGroups(1);
  return routes;
}

function drawBoundaryBridges() {
  BOUNDARY_BRIDGES.forEach((bridge) => {
    const bridgeLength = BORDER_RIVER_WIDTH + 56;
    if (!isVisibleRect({ x: bridge.x - 50, y: bridge.riverY - bridgeLength / 2, w: 100, h: bridgeLength }, 24)) return;
    context.save();
    context.translate(Math.round(bridge.x), Math.round(bridge.riverY));
    context.fillStyle = "rgba(23, 50, 58, 0.28)";
    context.fillRect(-34, -bridgeLength / 2 + 6, 68, bridgeLength);
    if (bridge.material === "iron") drawIronBoundaryBridge(bridgeLength);
    else drawConcreteBoundaryBridge(bridgeLength);
    context.restore();
  });
}

function drawIronBoundaryBridge(length) {
  context.fillStyle = "#4d5960";
  context.fillRect(-25, -length / 2, 50, length);
  context.fillStyle = "#7d8584";
  context.fillRect(-18, -length / 2, 36, length);
  context.fillStyle = COLORS.roadLine;
  for (let y = -length / 2 + 12; y < length / 2; y += 24) context.fillRect(-2, y, 4, 12);
  context.strokeStyle = "#9f4d3f";
  context.lineWidth = 6;
  for (const side of [-1, 1]) {
    const railX = side * 30;
    context.beginPath();
    context.moveTo(railX, -length / 2);
    for (let y = -length / 2; y <= length / 2; y += 26) {
      context.lineTo(railX + side * (Math.floor((y + length / 2) / 26) % 2 ? 10 : 0), y);
    }
    context.stroke();
  }
  context.fillStyle = "#d7b45b";
  context.fillRect(-36, -length / 2 - 5, 72, 8);
  context.fillRect(-36, length / 2 - 3, 72, 8);
}

function drawConcreteBoundaryBridge(length) {
  context.fillStyle = "#b9b7aa";
  context.fillRect(-31, -length / 2, 62, length);
  context.fillStyle = "#6f7979";
  context.fillRect(-22, -length / 2, 44, length);
  context.fillStyle = "#e7d27a";
  for (let y = -length / 2 + 10; y < length / 2; y += 28) context.fillRect(-2, y, 4, 14);
  context.fillStyle = "#d7d2bd";
  context.fillRect(-34, -length / 2, 7, length);
  context.fillRect(27, -length / 2, 7, length);
  context.fillStyle = "#8b8a80";
  for (let y = -length / 2 + 30; y < length / 2; y += 54) context.fillRect(-42, y, 84, 8);
}

function drawNeighborCountyDetails(now) {
  NEIGHBOR_COUNTIES.filter((county) => isVisibleRect(county, 60)).forEach((county, index) => {
    const countyTheme = state.neighborCountyThemes.get(county.id);
    if (!countyTheme) return;
    const countySchools = state.neighborSchools.filter((school) => school.city === county.name);
    const schoolCount = countySchools.length;
    const availableCount = countySchools.filter(schoolHasCurrentMeal).length;
    const labelX = county.x + 24;
    const labelY = county.y + 8;
    context.fillStyle = "rgba(255, 248, 231, 0.94)";
    context.fillRect(labelX, labelY, 520, 64);
    context.fillStyle = county.side === "north" ? "#436d4d" : "#79662e";
    context.fillRect(labelX, labelY, 7, 64);
    context.fillStyle = COLORS.ink;
    context.font = "bold 17px ui-monospace, monospace";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(`${townText(county.name)}・${townText(countyTheme.title)}`, labelX + 18, labelY + 16, 490);
    context.fillStyle = "#516873";
    context.font = "10px ui-monospace, monospace";
    context.fillText(townText(countyTheme.tagline), labelX + 18, labelY + 35, 490);
    const countyStatus = availableCount
      ? townText(`${schoolCount} 所國小已放入地圖｜今日 ${availableCount} 校已有午餐資料`)
      : townText(`${schoolCount} 所國小已放入地圖｜各校當日午餐開放查詢`);
    context.fillText(countyStatus, labelX + 18, labelY + 53, 490);

    countyTheme.districts.forEach((districtTheme) => {
      const configured = state.neighborDistrictThemes.get(districtTheme.name);
      if (!configured || !isVisibleRect(configured.zone, 40)) return;
      drawNeighborDistrictLabel(configured);
      const landmarks = countyTheme.landmarks.filter((landmark) => landmark.district === districtTheme.name);
      landmarks.forEach((landmark, landmarkIndex) => drawNeighborCountyLandmark(configured, landmark, landmarkIndex));
    });
    const signLabel = availableCount === schoolCount
      ? "當日午餐已更新"
      : "學校午餐查詢";
    drawLunchInfoSign(
      county.bridgeX + (county.side === "north" ? 92 : -258),
      county.side === "north" ? county.y + county.h - 104 : county.y + 8,
      now,
      index,
      signLabel,
    );
  });
}

function drawNeighborDistrictLabel(theme) {
  const { zone } = theme;
  const districtSchools = state.neighborSchools.filter((school) => school.district === theme.name && school.city === theme.county.name);
  const schoolCount = districtSchools.length;
  const availableCount = districtSchools.filter(schoolHasCurrentMeal).length;
  context.fillStyle = "rgba(255, 248, 226, 0.9)";
  context.fillRect(zone.x + 8, zone.y + 8, 142, 40);
  context.fillStyle = theme.county.id === "miaoli" ? "#345f48" : "#6d5c2d";
  context.fillRect(zone.x + 8, zone.y + 8, 5, 40);
  context.fillStyle = COLORS.ink;
  context.font = "bold 12px ui-monospace, monospace";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(townText(theme.name), zone.x + 20, zone.y + 21, 124);
  context.fillStyle = "#53696d";
  context.font = "9px ui-monospace, monospace";
  const status = availableCount
    ? `${townText(theme.featureLabel)}・${availableCount}/${schoolCount} ${townText("午餐")}`
    : `${townText(theme.featureLabel)}・${schoolCount} ${townText("學校")}`;
  context.fillText(status, zone.x + 20, zone.y + 39, 124);
}

function drawNeighborCountyLandmark(theme, landmark, index) {
  const scale = 1.32;
  const x = theme.zone.x + theme.zone.w - 70 - index * 126;
  const y = theme.zone.y + 34;
  drawPixelCountyLandmark(landmark.style, x, y, scale);
  const label = townText(landmark.name);
  context.fillStyle = "rgba(31, 53, 57, 0.9)";
  context.fillRect(x - 58, y + 32, 116, 18);
  context.fillStyle = COLORS.paper;
  context.font = `bold ${fitSchoolLabelFont(label, 108, 9, 7)}px ui-monospace, monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, x, y + 41, 108);
}

function drawPixelCountyLandmark(style, x, y, scale = 1) {
  context.save();
  context.translate(Math.round(x), Math.round(y));
  context.scale(scale, scale);
  context.fillStyle = "rgba(24, 45, 50, 0.18)";
  context.fillRect(-27, 20, 54, 5);
  if (style === "hakka-roundhouse") {
    context.fillStyle = "#b46a45";
    context.fillRect(-25, -12, 50, 31);
    context.fillStyle = "#e8d5a4";
    context.fillRect(-18, -7, 36, 23);
    context.fillStyle = "#6e4b39";
    context.fillRect(-7, 1, 14, 18);
    context.fillStyle = "#7294a4";
    context.fillRect(-22, -18, 44, 7);
  } else if (style === "rail-station") {
    context.fillStyle = "#d8bf89";
    context.fillRect(-24, -8, 48, 27);
    context.fillStyle = "#78513c";
    context.fillRect(-29, -15, 58, 8);
    context.fillStyle = "#4e7581";
    context.fillRect(-18, -2, 9, 9);
    context.fillRect(9, -2, 9, 9);
    context.fillStyle = "#4d5558";
    context.fillRect(-31, 19, 62, 3);
  } else if (style === "broken-bridge") {
    context.fillStyle = "#ad7252";
    context.fillRect(-26, -10, 9, 31);
    context.fillRect(-4, -18, 9, 39);
    context.fillRect(18, -7, 9, 28);
    context.fillRect(-24, -16, 24, 8);
  } else if (style === "strawberry-field") {
    context.fillStyle = "#75543c";
    context.fillRect(-27, 2, 54, 18);
    for (let berry = 0; berry < 7; berry += 1) {
      const berryX = -23 + berry * 8;
      context.fillStyle = "#d94e45";
      context.fillRect(berryX, 5 + (berry % 2) * 6, 6, 7);
      context.fillStyle = "#4e8b52";
      context.fillRect(berryX + 1, 2 + (berry % 2) * 6, 4, 3);
    }
  } else if (style === "old-street") {
    for (let shop = 0; shop < 3; shop += 1) {
      const shopX = -27 + shop * 18;
      context.fillStyle = shop % 2 ? "#d5c28f" : "#e0cf9e";
      context.fillRect(shopX, -5 + shop % 2 * 3, 17, 25);
      context.fillStyle = shop % 2 ? "#567684" : "#a75843";
      context.fillRect(shopX - 2, -10 + shop % 2 * 3, 21, 6);
      context.fillStyle = "#754c35";
      context.fillRect(shopX + 6, 7, 6, 13);
    }
  } else if (style === "hot-spring") {
    context.fillStyle = "#75b7be";
    context.fillRect(-25, 5, 50, 15);
    context.fillStyle = "#d7cfb4";
    context.fillRect(-27, 2, 54, 5);
    context.strokeStyle = "rgba(255, 255, 245, 0.86)";
    context.lineWidth = 3;
    for (let steam = -12; steam <= 12; steam += 12) {
      context.beginPath();
      context.moveTo(steam, 1);
      context.quadraticCurveTo(steam - 5, -8, steam + 2, -16);
      context.stroke();
    }
  } else if (style === "buddha") {
    context.fillStyle = "#c99d3d";
    context.fillRect(-10, -8, 20, 27);
    context.fillRect(-18, 5, 36, 14);
    context.fillRect(-8, -19, 16, 13);
    context.fillStyle = "#e3c459";
    context.fillRect(-24, 19, 48, 4);
  } else if (style === "fan-railhouse") {
    context.strokeStyle = "#5c6061";
    context.lineWidth = 3;
    for (let rail = -2; rail <= 2; rail += 1) {
      context.beginPath();
      context.moveTo(0, 18);
      context.lineTo(rail * 12, -13);
      context.stroke();
    }
    context.fillStyle = "#a85e45";
    context.fillRect(-27, -16, 54, 8);
    context.fillStyle = "#d9c394";
    context.fillRect(-23, -8, 46, 12);
  } else if (style === "flower-garden") {
    for (let flower = 0; flower < 7; flower += 1) {
      drawTinyFlower(-24 + flower * 8, -2 + (flower % 2) * 8, ["#e96d76", "#e9bd52", "#c988b4"][flower % 3]);
    }
  } else if (style === "harbor") {
    context.fillStyle = "#6fabb8";
    context.fillRect(-27, 8, 54, 12);
    context.fillStyle = "#f2eee0";
    context.fillRect(10, -15, 9, 26);
    context.fillStyle = "#d85c48";
    context.fillRect(8, -19, 13, 6);
    context.fillStyle = "#cc8a42";
    context.fillRect(-22, 2, 23, 8);
  } else if (style === "reservoir") {
    context.fillStyle = "#5f8b62";
    context.fillRect(-27, -9, 54, 9);
    context.fillStyle = "#6fabb8";
    context.fillRect(-27, 0, 54, 20);
    context.fillStyle = "#d1c8a8";
    context.fillRect(-30, 3, 8, 17);
    context.fillStyle = "rgba(235, 248, 236, 0.7)";
    context.fillRect(-10, 6, 25, 3);
  } else if (style === "cultural-center") {
    context.fillStyle = "#d8c89f";
    context.fillRect(-26, -5, 52, 25);
    context.fillStyle = "#8b5542";
    context.fillRect(-29, -12, 58, 8);
    context.fillStyle = "#527786";
    context.fillRect(-18, 2, 11, 9);
    context.fillRect(7, 2, 11, 9);
    context.fillStyle = "#6b4c3c";
    context.fillRect(-5, 6, 10, 14);
  } else if (style === "visitor-center") {
    context.fillStyle = "#e0d5b6";
    context.fillRect(-25, -4, 50, 24);
    context.fillStyle = "#55786d";
    context.fillRect(-29, -11, 58, 8);
    context.fillStyle = "#668d9a";
    context.fillRect(-17, 2, 12, 9);
    context.fillStyle = "#825b43";
    context.fillRect(8, 6, 9, 14);
    context.fillStyle = "#d9ad49";
    context.fillRect(22, -18, 3, 19);
    context.fillRect(25, -18, 8, 6);
  } else if (style === "vineyard") {
    context.fillStyle = "#796045";
    context.fillRect(-27, 17, 54, 3);
    for (let vine = 0; vine < 5; vine += 1) {
      const vineX = -23 + vine * 11;
      context.fillStyle = "#4f754e";
      context.fillRect(vineX, -5, 4, 22);
      context.fillRect(vineX - 3, -2, 10, 4);
      context.fillStyle = "#70528a";
      context.fillRect(vineX - 1, 4, 6, 7);
    }
  } else if (style === "wetland") {
    context.fillStyle = "#72a6ae";
    context.fillRect(-27, 7, 54, 13);
    context.fillStyle = "#71905f";
    for (let reed = -22; reed <= 22; reed += 11) {
      context.fillRect(reed, -4 + Math.abs(reed % 3), 3, 18);
      context.fillStyle = "#a4864c";
      context.fillRect(reed - 1, -6 + Math.abs(reed % 3), 5, 5);
      context.fillStyle = "#71905f";
    }
  } else if (style === "canal") {
    context.fillStyle = "#c2b99e";
    context.fillRect(-29, -2, 58, 22);
    context.fillStyle = "#6fa5b1";
    context.fillRect(-24, 3, 48, 12);
    context.fillStyle = "rgba(238, 248, 238, 0.72)";
    context.fillRect(-18, 7, 15, 3);
    context.fillRect(7, 10, 12, 2);
  } else if (style === "sugar-factory") {
    context.fillStyle = "#c9bea0";
    context.fillRect(-27, -1, 45, 21);
    context.fillStyle = "#a65d43";
    context.fillRect(-30, -7, 51, 7);
    context.fillStyle = "#8d6f58";
    context.fillRect(13, -20, 9, 40);
    context.fillStyle = "#6b8490";
    context.fillRect(-20, 5, 10, 8);
    context.fillRect(-5, 5, 10, 8);
  }
  context.restore();
}

function drawLunchInfoSign(x, y, now, index, label = "學校午餐查詢") {
  const light = reducedMotion ? 1 : (Math.floor(now / 900) + index) % 2;
  context.fillStyle = "rgba(30, 54, 58, 0.22)";
  context.fillRect(x + 5, y + 8, 166, 82);
  context.fillStyle = "#6d5138";
  context.fillRect(x + 18, y + 62, 8, 34);
  context.fillRect(x + 140, y + 62, 8, 34);
  context.fillStyle = "#d9efe4";
  context.fillRect(x, y + 10, 166, 62);
  context.fillStyle = "#4d7d67";
  context.fillRect(x, y + 10, 166, 8);
  context.fillRect(x, y + 64, 166, 8);
  context.fillStyle = COLORS.ink;
  context.font = "bold 11px ui-monospace, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(townText(label), x + 83, y + 42, 142);
  context.fillStyle = light ? "#f0c34e" : "#d99f3d";
  context.fillRect(x + 12, y + 1, 10, 9);
  context.fillRect(x + 144, y + 1, 10, 9);
}

function coastlineXAt(y) {
  return WEST_COAST_WIDTH - 34
    + Math.sin(y / 238) * 22
    + Math.sin(y / 71) * 7;
}

function traceCoastline(offset = 0, startY = 0, endY = WORLD_HEIGHT) {
  context.beginPath();
  for (let y = startY; y <= endY; y += 28) {
    const x = coastlineXAt(y) + offset;
    if (y === startY) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  if ((endY - startY) % 28 !== 0) context.lineTo(coastlineXAt(endY) + offset, endY);
}

function fillCoastalBand(startY, endY, innerOffset, outerOffset, color) {
  context.beginPath();
  for (let y = startY; y <= endY; y += 24) {
    const x = coastlineXAt(y) + innerOffset;
    if (y === startY) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.lineTo(coastlineXAt(endY) + outerOffset, endY);
  for (let y = endY; y >= startY; y -= 24) {
    context.lineTo(coastlineXAt(y) + outerOffset, y);
  }
  context.closePath();
  context.fillStyle = color;
  context.fill();
}

function drawWesternCoast(now) {
  context.save();
  context.fillStyle = "#4f93aa";
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(coastlineXAt(0), 0);
  for (let y = 28; y <= WORLD_HEIGHT; y += 28) context.lineTo(coastlineXAt(y), y);
  context.lineTo(0, WORLD_HEIGHT);
  context.closePath();
  context.fill();

  context.fillStyle = "#3f839f";
  context.fillRect(0, 0, 88, WORLD_HEIGHT);
  const waveOffset = reducedMotion ? 0 : Math.floor(now / 150) % 22;
  const visibleStartY = Math.max(20, Math.floor((state.camera.y - 40) / 48) * 48);
  const visibleEndY = Math.min(WORLD_HEIGHT, state.camera.y + HEIGHT + 40);
  context.fillStyle = "rgba(184, 229, 229, 0.68)";
  for (let y = visibleStartY; y < visibleEndY; y += 48) {
    const coastX = coastlineXAt(y);
    for (let x = 24 + (y / 48 % 2) * 18 - waveOffset; x < coastX - 22; x += 72) {
      context.fillRect(Math.round(x), y, 30, 3);
      context.fillRect(Math.round(x + 8), y + 5, 15, 2);
    }
  }

  fillCoastalBand(54, NORTH_COUNTY_HEIGHT - 30, 0, 56, "#e4cc91");
  fillCoastalBand(DISTRICT_ZONE_ORIGIN_Y + 1480, TAICHUNG_SOUTH_EDGE_Y - 54, 0, 48, "#ddc184");
  fillCoastalBand(SOUTH_COUNTY_START_Y + 54, WORLD_HEIGHT - 54, 0, 48, "#e2c98d");
  fillCoastalBand(DISTRICT_ZONE_ORIGIN_Y + 600, DISTRICT_ZONE_ORIGIN_Y + 762, 4, 30, "#91b78a");

  context.strokeStyle = "rgba(237, 247, 231, 0.88)";
  context.lineWidth = 6;
  context.setLineDash([18, 13]);
  context.lineDashOffset = -waveOffset;
  traceCoastline(1);
  context.stroke();
  context.setLineDash([]);

  context.strokeStyle = "#cab98d";
  context.lineWidth = 13;
  traceCoastline(62);
  context.stroke();
  context.strokeStyle = "#7f8d7b";
  context.lineWidth = 4;
  traceCoastline(62);
  context.stroke();

  for (let index = 0; index < COASTAL_TETRAPOD_COUNT; index += 1) {
    const y = 38 + index * (WORLD_HEIGHT - 76) / (COASTAL_TETRAPOD_COUNT - 1);
    if (Math.abs(y - COASTAL_HARBOR_Y) < 174) continue;
    const beach = isCoastalBeachY(y);
    if (beach && index % 3 !== 0) continue;
    drawTetrapod(coastlineXAt(y) - 10 - index % 2 * 7, y, index * 0.83, beach ? 0.72 : 0.9);
  }

  drawFishingHarbor(now);
  context.restore();
}

function isCoastalBeachY(y) {
  return (y > 54 && y < NORTH_COUNTY_HEIGHT - 30)
    || (y > DISTRICT_ZONE_ORIGIN_Y + 1480 && y < TAICHUNG_SOUTH_EDGE_Y - 54)
    || (y > SOUTH_COUNTY_START_Y + 54 && y < WORLD_HEIGHT - 54);
}

function drawTetrapod(x, y, rotation = 0, scale = 1) {
  context.save();
  context.translate(Math.round(x), Math.round(y));
  context.rotate(rotation);
  context.scale(scale, scale);
  context.fillStyle = "rgba(39, 67, 73, 0.22)";
  context.fillRect(-9, 4, 19, 5);
  context.fillStyle = "#aaa99e";
  context.fillRect(-8, -3, 16, 7);
  context.fillRect(-3, -10, 6, 20);
  context.fillRect(-11, -1, 6, 5);
  context.fillRect(5, -1, 6, 5);
  context.fillStyle = "#ceccbc";
  context.fillRect(-5, -6, 5, 7);
  context.fillRect(-7, -2, 7, 3);
  context.restore();
}

function drawFishingHarbor(now) {
  const y = COASTAL_HARBOR_Y;
  const coastX = coastlineXAt(y);
  const pulse = reducedMotion ? 0 : Math.floor(now / 320) % 5;

  context.fillStyle = "#3d7f99";
  context.fillRect(62, y - 126, Math.max(0, coastX - 44), 252);
  context.fillStyle = "rgba(137, 203, 211, 0.62)";
  for (let lane = -92; lane <= 94; lane += 46) {
    context.fillRect(88 + pulse, y + lane, Math.max(28, coastX - 142), 3);
  }

  drawHarborArm(coastX + 30, y - 132, 74, y - 132, 48, y - 56);
  drawHarborArm(coastX + 24, y + 132, 86, y + 132, 58, y + 58);
  context.fillStyle = "#a9aa9f";
  context.fillRect(132, y - 80, 118, 14);
  context.fillRect(176, y + 32, 96, 14);
  context.fillStyle = "#d5cfb5";
  context.fillRect(136, y - 77, 108, 7);
  context.fillRect(180, y + 35, 86, 7);

  drawFishingBoat(106, y - 34, "#f2d46c", false, pulse);
  drawFishingBoat(164, y + 78, "#df6c4f", true, -pulse);
  drawFishingBoat(226, y - 10, "#f5efe0", false, pulse);

  const marketX = Math.round(coastX + 18);
  context.fillStyle = "rgba(25, 54, 61, 0.2)";
  context.fillRect(marketX + 5, y - 12, 68, 56);
  context.fillStyle = "#d9d6c3";
  context.fillRect(marketX, y - 18, 68, 54);
  context.fillStyle = "#397b88";
  context.fillRect(marketX - 4, y - 24, 76, 9);
  context.fillStyle = "#edf4e8";
  context.fillRect(marketX + 8, y - 6, 18, 14);
  context.fillRect(marketX + 36, y - 6, 22, 14);
  context.fillStyle = "#bb5945";
  context.fillRect(marketX + 28, y + 17, 12, 19);

  context.fillStyle = "#ece5cf";
  context.fillRect(48, y - 74, 7, 30);
  context.fillStyle = "#d45442";
  context.fillRect(45, y - 84, 13, 11);
  context.fillStyle = "#f2d15f";
  context.fillRect(46, y - 88, 11, 4);

  for (let block = 0; block < 7; block += 1) {
    drawTetrapod(62 + block * 19, y - 139 + block % 2 * 4, block * 0.7, 0.75);
    drawTetrapod(72 + block * 20, y + 140 - block % 2 * 4, block * 0.61, 0.75);
  }
}

function drawHarborArm(startX, startY, cornerX, cornerY, endX, endY) {
  const path = new Path2D();
  path.moveTo(startX, startY);
  path.lineTo(cornerX, cornerY);
  path.lineTo(endX, endY);
  context.lineCap = "square";
  context.lineJoin = "miter";
  context.strokeStyle = "#747d79";
  context.lineWidth = 22;
  context.stroke(path);
  context.strokeStyle = "#c4c2b4";
  context.lineWidth = 13;
  context.stroke(path);
}

function drawFishingBoat(x, y, hull, flipped = false, bob = 0) {
  context.save();
  context.translate(Math.round(x), Math.round(y + bob));
  context.scale(flipped ? -1 : 1, 1);
  context.fillStyle = "rgba(24, 58, 67, 0.28)";
  context.fillRect(-18, 9, 42, 4);
  context.fillStyle = hull;
  context.beginPath();
  context.moveTo(-21, 2);
  context.lineTo(23, 2);
  context.lineTo(14, 12);
  context.lineTo(-14, 12);
  context.closePath();
  context.fill();
  context.fillStyle = "#f4f0df";
  context.fillRect(-4, -8, 18, 10);
  context.fillStyle = "#376f82";
  context.fillRect(1, -5, 8, 5);
  context.fillStyle = "#563f34";
  context.fillRect(-8, -17, 3, 19);
  context.fillStyle = "#e1ad48";
  context.fillRect(-5, -16, 14, 3);
  context.restore();
}

function drawEasternMountainRange(now) {
  context.save();
  context.fillStyle = "#416f4e";
  context.fillRect(EAST_MOUNTAIN_START_X, 0, EAST_MOUNTAIN_WIDTH, WORLD_HEIGHT);

  context.fillStyle = "#5d8958";
  context.beginPath();
  context.moveTo(EAST_MOUNTAIN_START_X + 4, 0);
  for (let y = 0; y <= WORLD_HEIGHT; y += 72) {
    const x = EAST_MOUNTAIN_START_X + 34 + Math.sin(y / 177) * 24 + Math.sin(y / 59) * 8;
    context.lineTo(x, y);
  }
  context.lineTo(EAST_MOUNTAIN_START_X + 184, WORLD_HEIGHT);
  context.lineTo(EAST_MOUNTAIN_START_X + 184, 0);
  context.closePath();
  context.fill();

  context.strokeStyle = "#315b43";
  context.lineWidth = 9;
  for (let ridge = 0; ridge < 3; ridge += 1) {
    context.beginPath();
    for (let y = -30; y <= WORLD_HEIGHT + 30; y += 54) {
      const x = EAST_MOUNTAIN_START_X + 108 + ridge * 112
        + Math.sin(y / (118 + ridge * 27) + ridge) * (24 + ridge * 7);
      if (y === -30) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }

  const visibleStartY = Math.max(-90, Math.floor((state.camera.y - 120) / 190) * 190);
  const visibleEndY = Math.min(WORLD_HEIGHT + 120, state.camera.y + HEIGHT + 140);
  for (let y = visibleStartY; y < visibleEndY; y += 190) {
    const row = Math.floor(y / 190);
    drawMountainPeak(EAST_MOUNTAIN_START_X + 120, y + 96, 126, row * 0.41, now);
    drawMountainPeak(EAST_MOUNTAIN_START_X + 274, y + 28, 154, row * 0.67 + 1.2, now);
    drawMountainPeak(EAST_MOUNTAIN_START_X + 420, y + 118, 118, row * 0.53 + 2.1, now);
  }

  context.fillStyle = "#2f6045";
  for (let y = 36; y < WORLD_HEIGHT; y += 64) {
    const footX = EAST_MOUNTAIN_START_X + 32 + Math.sin(y / 177) * 24;
    drawTinyConifer(footX + 18 + y % 3 * 7, y, 0.9);
    drawTinyConifer(EAST_MOUNTAIN_START_X + 82 + y % 5 * 5, y + 27, 0.72);
  }
  context.restore();
}

function drawMountainPeak(x, y, size, phase, now) {
  const breathe = reducedMotion ? 0 : Math.round(Math.sin(now / 1300 + phase) * 2);
  context.save();
  context.translate(Math.round(x), Math.round(y + breathe));
  context.fillStyle = "rgba(24, 51, 39, 0.22)";
  context.beginPath();
  context.moveTo(-size * 0.54, size * 0.4 + 9);
  context.lineTo(4, -size * 0.48 + 9);
  context.lineTo(size * 0.58, size * 0.4 + 9);
  context.closePath();
  context.fill();
  context.fillStyle = "#365f43";
  context.beginPath();
  context.moveTo(-size * 0.56, size * 0.4);
  context.lineTo(0, -size * 0.5);
  context.lineTo(size * 0.58, size * 0.4);
  context.closePath();
  context.fill();
  context.fillStyle = "#6f9661";
  context.beginPath();
  context.moveTo(-size * 0.56, size * 0.4);
  context.lineTo(0, -size * 0.5);
  context.lineTo(-size * 0.02, size * 0.4);
  context.closePath();
  context.fill();
  context.fillStyle = "#9b9b82";
  context.beginPath();
  context.moveTo(-size * 0.12, -size * 0.3);
  context.lineTo(0, -size * 0.5);
  context.lineTo(size * 0.14, -size * 0.28);
  context.lineTo(size * 0.04, -size * 0.2);
  context.closePath();
  context.fill();
  context.restore();
}

function drawTinyConifer(x, y, scale = 1) {
  context.save();
  context.translate(Math.round(x), Math.round(y));
  context.scale(scale, scale);
  context.fillStyle = "#6b5038";
  context.fillRect(-2, 6, 4, 9);
  context.fillStyle = "#28543c";
  context.beginPath();
  context.moveTo(0, -14);
  context.lineTo(-10, 8);
  context.lineTo(10, 8);
  context.closePath();
  context.fill();
  context.fillStyle = "#477a50";
  context.beginPath();
  context.moveTo(0, -8);
  context.lineTo(-7, 4);
  context.lineTo(1, 4);
  context.closePath();
  context.fill();
  context.restore();
}

function drawMapEdges(now) {
  context.fillStyle = COLORS.water;
  context.fillRect(0, 0, 12, WORLD_HEIGHT);
  context.fillRect(0, 0, WEST_COAST_WIDTH, 12);
  context.fillRect(0, WORLD_HEIGHT - 12, WEST_COAST_WIDTH, 12);
  context.fillStyle = "#284d39";
  context.fillRect(WORLD_WIDTH - 14, 0, 14, WORLD_HEIGHT);
  context.fillStyle = COLORS.waterLight;
  const offset = reducedMotion ? 0 : Math.floor(now / 260) % 12;
  for (let y = -12 + offset; y < WORLD_HEIGHT; y += 24) {
    context.fillRect(2, y, 6, 3);
  }
  context.fillStyle = "#5c8b5b";
  for (let y = 8; y < WORLD_HEIGHT; y += 26) {
    context.fillRect(WORLD_WIDTH - 11, y, 7, 5);
  }
}

function drawRoads(now) {
  for (let column = 1; column < DISTRICT_GRID_COLUMNS; column += 1) {
    const x = DISTRICT_ZONE_ORIGIN_X + column * (DISTRICT_ZONE_WIDTH + DISTRICT_ZONE_GAP_X) - DISTRICT_ZONE_GAP_X / 2;
    const path = new Path2D();
    path.moveTo(x, DISTRICT_ZONE_ORIGIN_Y);
    if ([3, 6].includes(column)) {
      for (let y = DISTRICT_ZONE_ORIGIN_Y; y < TAICHUNG_SOUTH_EDGE_Y; y += 230) {
        const endY = Math.min(TAICHUNG_SOUTH_EDGE_Y, y + 230);
        const bend = ((column + Math.floor((y - DISTRICT_ZONE_ORIGIN_Y) / 230)) % 2 ? 1 : -1) * (column === 3 ? 15 : 9);
        path.quadraticCurveTo(x + bend, y + (endY - y) / 2, x, endY);
      }
    } else {
      path.lineTo(x, TAICHUNG_SOUTH_EDGE_Y);
    }
    strokeRoadPath(path);
  }
  drawNeighborCountyRoads();
  for (let row = 1; row < DISTRICT_GRID_ROWS; row += 1) {
    const y = DISTRICT_ZONE_ORIGIN_Y + row * (DISTRICT_ZONE_HEIGHT + DISTRICT_ZONE_GAP_Y) - DISTRICT_ZONE_GAP_Y / 2;
    const path = new Path2D();
    path.moveTo(COASTAL_ROAD_START_X, y);
    if ([2, 5].includes(row)) {
      for (let x = COASTAL_ROAD_START_X; x < EASTERN_ROAD_END_X; x += 260) {
        const endX = Math.min(EASTERN_ROAD_END_X, x + 260);
        const bend = ((row + Math.floor(x / 260)) % 2 ? 1 : -1) * (row === 2 ? 11 : 7);
        path.quadraticCurveTo(x + (endX - x) / 2, y + bend, endX, y);
      }
    } else {
      path.lineTo(EASTERN_ROAD_END_X, y);
    }
    strokeRoadPath(path);
  }
  [
    { column: 2, row: 2 },
    { column: 5, row: 4 },
    { column: 6, row: 1 },
  ].forEach((location, index) => {
    const x = DISTRICT_ZONE_ORIGIN_X + location.column * (DISTRICT_ZONE_WIDTH + DISTRICT_ZONE_GAP_X) - DISTRICT_ZONE_GAP_X / 2;
    const y = DISTRICT_ZONE_ORIGIN_Y + location.row * (DISTRICT_ZONE_HEIGHT + DISTRICT_ZONE_GAP_Y) - DISTRICT_ZONE_GAP_Y / 2;
    if (isVisibleRect({ x: x - 45, y: y - 45, w: 90, h: 90 }, 30)) drawRoundabout(x, y, now, index);
  });
}

function strokeRoadPath(path) {
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = COLORS.roadEdge;
  context.lineWidth = 30;
  context.stroke(path);
  context.strokeStyle = COLORS.road;
  context.lineWidth = 20;
  context.stroke(path);
  context.strokeStyle = COLORS.roadLine;
  context.lineWidth = 3;
  context.setLineDash([22, 22]);
  context.stroke(path);
  context.restore();
}

function drawRoundabout(x, y, now, index) {
  context.fillStyle = COLORS.roadEdge;
  context.beginPath();
  context.arc(x, y, 38, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = COLORS.road;
  context.beginPath();
  context.arc(x, y, 32, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = COLORS.roadLine;
  context.lineWidth = 2;
  context.setLineDash([8, 7]);
  context.beginPath();
  context.arc(x, y, 24, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = index % 2 ? "#8db477" : "#86aa70";
  context.beginPath();
  context.arc(x, y, 13, 0, Math.PI * 2);
  context.fill();
  drawTree(x, y - 4, now, index + 0.5, 0.62);
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

function drawTownVenues(now) {
  state.venues.filter((venue) => isVisibleRect(venue, 40)).forEach((venue, index) => {
    drawVenue(venue, now, index);
  });
}

function drawBikeStations() {
  state.bikeStations
    .filter((station) => isVisibleRect({ x: station.x - 12, y: station.y - 38, w: station.w + 24, h: 82 }, 30))
    .forEach((station, index) => drawBikeStation(station, index));
}

function drawBikeStation(station, index) {
  const { x, y, w, h } = station;
  context.save();
  context.fillStyle = "rgba(20, 45, 55, 0.18)";
  context.fillRect(x + 3, y + h, w, 4);
  context.fillStyle = "#d9d2b5";
  context.fillRect(x, y, w, h);
  context.fillStyle = "#5d973f";
  context.fillRect(x, y, w, 5);
  context.fillStyle = "#e9b936";
  context.fillRect(x, y + 5, w, 3);
  context.fillStyle = "#728486";
  for (let dock = 0; dock < station.dockCount; dock += 1) {
    const dockX = x + 10 + dock * 14;
    context.fillRect(dockX, y + 12, 3, 15);
    context.fillRect(dockX - 2, y + 25, 7, 3);
  }
  context.fillStyle = "#e9b936";
  context.fillRect(x + w - 22, y - 24, 6, 33);
  context.fillStyle = "#5d973f";
  context.fillRect(x + w - 50, y - 36, 52, 18);
  context.fillStyle = "#fff8e7";
  context.font = "bold 7px ui-monospace, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("YouBike 2.0", x + w - 24, y - 27);
  context.fillStyle = COLORS.ink;
  context.font = "bold 7px ui-monospace, monospace";
  context.fillText("公共自行車租賃站", x + 55, y + h - 3);
  const parked = Math.min(4, station.bikeCount);
  for (let bike = 0; bike < parked; bike += 1) {
    drawParkedBike(x + 13 + bike * 18, y + 17 + (index % 2), bike % 2 === 1);
  }
  context.restore();
}

function drawParkedBike(x, y, flipped = false) {
  context.save();
  context.translate(Math.round(x), Math.round(y));
  context.scale(flipped ? -0.7 : 0.7, 0.7);
  context.strokeStyle = "#4d853c";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(-6, 5, 4, 0, Math.PI * 2);
  context.arc(7, 5, 4, 0, Math.PI * 2);
  context.moveTo(-6, 5);
  context.lineTo(-1, -1);
  context.lineTo(3, 5);
  context.lineTo(-6, 5);
  context.moveTo(-1, -1);
  context.lineTo(7, 5);
  context.moveTo(3, 5);
  context.lineTo(6, -3);
  context.lineTo(9, -3);
  context.stroke();
  context.restore();
}

function drawWeekendMarkets() {
  if (!state.isWeekend) return;
  DISTRICT_DISPLAY_ORDER.filter((district) => isVisibleRect(DISTRICT_ZONES[district], 40)).forEach((district, index) => {
    const zone = DISTRICT_ZONES[district];
    const x = zone.x + zone.w - 278;
    const y = zone.y + 28;
    drawMarketStall(x, y, index % 2 ? "#e3a54c" : "#d8663b");
    drawMarketStall(x + 58, y + 3, index % 2 ? "#d8663b" : "#4f8790");
    context.fillStyle = COLORS.ink;
    context.fillRect(x + 11, y + 39, 78, 14);
    context.fillStyle = COLORS.paper;
    context.font = "bold 9px ui-monospace, monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("週末市場", x + 50, y + 46);
  });
}

function residentialWindowColor(seed = 0) {
  const hour = Number(state.environment?.clock?.hour ?? 12);
  const litAtNight = Number(state.environment?.darkness || 0) > 0.08 && (hour + seed) % 3 !== 0;
  return litAtNight ? "#ffe58f" : COLORS.window;
}

function drawTownhouse(venue) {
  const { x, y, w, h } = venue;
  const unitWidth = Math.floor(w / 3);
  const walls = ["#ead9aa", "#c9ddd4", "#e7cfb3"];
  const roofs = ["#c95f48", "#537b8f", "#a7574e"];
  for (let unit = 0; unit < 3; unit += 1) {
    const unitX = x + unit * unitWidth;
    const width = unit === 2 ? w - unitWidth * 2 : unitWidth;
    context.fillStyle = walls[unit];
    context.fillRect(unitX, y + 9, width, h - 9);
    context.fillStyle = roofs[unit];
    context.fillRect(unitX - 2, y + 5 + unit % 2 * 3, width + 4, 8);
    context.fillStyle = residentialWindowColor(unit);
    context.fillRect(unitX + 5, y + 20, 8, 8);
    context.fillStyle = "#76513a";
    context.fillRect(unitX + width - 10, y + h - 15, 7, 15);
  }
}

function drawApartment(venue) {
  const { x, y, w, h } = venue;
  context.fillStyle = "#d8d6c9";
  context.fillRect(x, y + 5, w, h - 5);
  context.fillStyle = "#657d88";
  context.fillRect(x - 3, y + 3, w + 6, 7);
  for (let floor = 0; floor < 3; floor += 1) {
    for (let column = 0; column < 3; column += 1) {
      context.fillStyle = residentialWindowColor(floor * 3 + column);
      context.fillRect(x + 8 + column * 20, y + 15 + floor * 12, 10, 7);
    }
    context.fillStyle = "#84979a";
    context.fillRect(x + 5, y + 24 + floor * 12, w - 10, 2);
  }
  context.fillStyle = "#4a5d64";
  context.fillRect(x + w / 2 - 6, y + h - 15, 12, 15);
}

function drawPlayerHome(venue) {
  const { x, y, w, h } = venue;
  context.fillStyle = "#8eb67b";
  context.fillRect(x, y, w, h);
  context.fillStyle = "#f0dfb5";
  context.fillRect(x + 10, y + 15, w - 24, h - 15);
  context.fillStyle = "#c85d46";
  context.fillRect(x + 6, y + 9, w - 16, 9);
  context.fillStyle = residentialWindowColor(1);
  context.fillRect(x + 17, y + 25, 12, 10);
  context.fillStyle = "#6f513f";
  context.fillRect(x + w - 30, y + h - 19, 10, 19);
  context.fillStyle = "#f2c657";
  context.fillRect(x + w - 27, y + h - 11, 3, 3);
  context.fillStyle = "#537b62";
  context.fillRect(x + w - 12, y + h - 14, 4, 14);
  context.fillStyle = COLORS.paper;
  context.fillRect(x + w - 17, y + h - 19, 14, 8);
  context.fillStyle = COLORS.ink;
  context.font = "bold 6px ui-monospace, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("HOME", x + w - 10, y + h - 15);
}

function drawCountyGovernmentVenue(venue) {
  const { x, y, w, h, type } = venue;
  const isCouncil = type === "county-council";
  const isLocalOffice = type === "township-office";
  const isLargeCountyHall = type === "county-government" && venue.civicCampus;
  if (venue.civicCampus) {
    context.fillStyle = "#d8cda7";
    context.fillRect(x - 8, y + h - 3, w + 16, 14);
    context.fillStyle = "#8da57e";
    for (let treeX = x + 18; treeX < x + w - 12; treeX += 58) {
      context.fillRect(treeX, y + h + 4, 5, 8);
      context.fillRect(treeX - 3, y + h, 11, 6);
    }
  }
  context.fillStyle = isCouncil ? "#ded2b5" : isLocalOffice ? "#d9ddcf" : "#d8d9d3";
  context.fillRect(x, y + 6, w, h - 6);
  context.fillStyle = isCouncil ? "#8a5546" : isLocalOffice ? "#4f786c" : "#4d7182";
  context.fillRect(x - 3, y + 3, w + 6, 8);
  if (isLargeCountyHall) {
    context.fillStyle = "#c7c9c3";
    context.fillRect(x + 20, y + 14, w - 40, h - 22);
    context.fillStyle = "#edf0e9";
    context.fillRect(x + 34, y + 19, w - 68, 12);
  } else {
    context.fillStyle = "#eef2e8";
    context.fillRect(x + 8, y + 15, w - 16, 8);
  }
  context.fillStyle = "#557887";
  const windowTop = isLargeCountyHall ? y + 38 : y + 17;
  const windowRows = isLargeCountyHall ? 3 : 1;
  for (let row = 0; row < windowRows; row += 1) {
    for (let windowX = x + 14; windowX < x + w - 14; windowX += 22) {
      context.fillStyle = residentialWindowColor(row + Math.floor((windowX - x) / 22));
      context.fillRect(windowX, windowTop + row * 15, 11, 7);
    }
  }
  if (isLargeCountyHall) {
    context.fillStyle = "#f0ede2";
    context.fillRect(x + w / 2 - 34, y + h - 38, 68, 38);
    context.fillStyle = "#6d7d7f";
    for (let pillar = -24; pillar <= 24; pillar += 16) context.fillRect(x + w / 2 + pillar, y + h - 33, 5, 33);
    context.fillStyle = "#4d7182";
    context.fillRect(x + w / 2 - 40, y + h - 42, 80, 8);
  }
  context.fillStyle = "#6a5142";
  context.fillRect(x + w / 2 - 6, y + h - (isLargeCountyHall ? 24 : 12), 12, isLargeCountyHall ? 24 : 12);
  context.fillStyle = "#f0c75e";
  context.fillRect(x + w - 18, y - 8, 3, 18);
  context.fillStyle = "#dd5b49";
  context.fillRect(x + w - 15, y - 8, 13, 7);
}

function drawVenue(venue, now, index) {
  const { x, y, w, h, type } = venue;
  if (venue.hubKind) {
    drawLandmarkHub(venue, now, index);
    drawVenueLabel(venue, now, index);
    return;
  }
  context.fillStyle = "rgba(20, 45, 55, 0.18)";
  context.fillRect(x + 5, y + h, w, 5);
  if (type === "player-home") {
    drawPlayerHome(venue);
  } else if (type === "townhouse") {
    drawTownhouse(venue);
  } else if (type === "apartment") {
    drawApartment(venue);
  } else if (type === "landmark") {
    context.fillStyle = "#d8d1b7";
    context.fillRect(x, y, w, h);
    context.fillStyle = "#b8ac87";
    context.fillRect(x + 4, y + h - 8, w - 8, 5);
    context.save();
    context.translate(x + w / 2, y + h / 2 + 5);
    context.scale(w < 100 ? 0.62 : 0.78, 0.72);
    drawDistrictFeature({ feature: venue.landmarkStyle }, 0, 0, now);
    context.restore();
  } else if (type === "convenience-store") {
    drawConvenienceStore(venue);
  } else if (type === "snack-shop") {
    drawSnackShop(venue);
  } else if (["police-station", "fire-station", "hospital"].includes(type)) {
    drawServiceVenue(venue);
  } else if (["county-government", "county-council", "township-office"].includes(type)) {
    drawCountyGovernmentVenue(venue);
  } else if (type === "park") {
    context.fillStyle = "#8fc082";
    context.fillRect(x, y, w, h);
    drawTree(x + 14, y + 17, now, index * 0.8);
    drawTree(x + w - 15, y + 15, now, index * 0.8 + 1.2);
    context.fillStyle = "#a66f48";
    context.fillRect(x + 29, y + 22, 28, 5);
    context.fillRect(x + 33, y + 27, 4, 7);
    context.fillRect(x + 49, y + 27, 4, 7);
    context.fillStyle = COLORS.trackLine;
    context.fillRect(x + 34, y + 9, 18, 4);
  } else {
    context.fillStyle = type === "department-store" ? "#d6d4c9" : type === "restaurant" ? "#ead9aa" : "#d9c48e";
    context.fillRect(x, y, w, h);
    context.fillStyle = type === "department-store" ? "#557b8b" : COLORS.roof;
    context.fillRect(x - 3, y, w + 6, 8);
    if (type === "restaurant") {
      for (let stripe = 0; stripe < w; stripe += 16) {
        context.fillStyle = stripe % 32 ? COLORS.paper : COLORS.roof;
        context.fillRect(x + stripe, y + 8, Math.min(16, w - stripe), 8);
      }
      context.fillStyle = COLORS.window;
      context.fillRect(x + 9, y + 19, 20, 12);
      context.fillRect(x + w - 30, y + 19, 20, 12);
    } else if (type === "department-store") {
      context.fillStyle = COLORS.window;
      for (let row = 0; row < 2; row += 1) {
        for (let column = 0; column < 4; column += 1) {
          context.fillRect(x + 8 + column * 18, y + 13 + row * 14, 11, 8);
        }
      }
    } else {
      context.fillStyle = "#5f8a72";
      context.fillRect(x + 7, y + 17, w - 14, 12);
      context.fillStyle = COLORS.yellow;
      context.fillRect(x + 12, y + 20, 12, 7);
      context.fillStyle = "#cf6648";
      context.fillRect(x + 29, y + 20, 12, 7);
      context.fillStyle = "#87a85e";
      context.fillRect(x + 46, y + 20, 12, 7);
    }
    context.fillStyle = COLORS.ink;
    context.fillRect(x + w / 2 - 5, y + h - 13, 10, 13);
  }
  if (["convenience-store", "snack-shop", "restaurant"].includes(type)) drawArcadeShelter(venue);
  if (!RESIDENTIAL_VENUE_TYPES.has(type)) drawVenueOccupancy(venue);
  drawVenueLabel(venue, now, index);
}

function drawLandmarkHub(venue, now, index) {
  const drawers = {
    "central-park": drawCentralParkHub,
    "harbor-outlet": drawHarborOutletHub,
    "civic-center": drawCivicCenterHub,
    "civic-neighborhood": drawCivicNeighborhoodHub,
    stadium: drawStadiumHub,
    lalaport: drawLalaportHub,
    hospital: drawHospitalHub,
    "asia-museum": drawAsiaMuseumHub,
  };
  context.save();
  context.fillStyle = "rgba(20, 45, 55, 0.22)";
  context.fillRect(venue.x + 7, venue.y + venue.h, venue.w, 7);
  (drawers[venue.hubKind] || drawCentralParkHub)(venue, now, index);
  context.restore();
}

function centralParkLampPositions({ x, y, w, h }) {
  return [
    { x: x + 70, y: y + h - 48 },
    { x: x + 145, y: y + h - 105 },
    { x: x + 245, y: y + h - 132 },
    { x: x + 335, y: y + h - 170 },
    { x: x + w - 125, y: y + 118 },
    { x: x + w - 52, y: y + 62 },
  ];
}

function drawCentralParkHub({ x, y, w, h }, now, index) {
  context.fillStyle = "#78ae76";
  context.fillRect(x, y, w, h);
  context.strokeStyle = "#e5d8ad";
  context.lineWidth = 13;
  context.beginPath();
  context.moveTo(x + 12, y + h - 36);
  context.bezierCurveTo(x + 130, y + 120, x + 210, y + h - 32, x + w - 18, y + 36);
  context.stroke();
  context.fillStyle = COLORS.water;
  context.fillRect(x + 42, y + 58, 104, 65);
  context.fillStyle = COLORS.waterLight;
  context.fillRect(x + 52, y + 70, 55, 5);
  context.fillRect(x + 84, y + 101, 48, 5);
  context.fillStyle = "#e4e9df";
  context.fillRect(x + w - 182, y + 42, 146, 78);
  context.fillStyle = "#b8d6cc";
  context.fillRect(x + w - 168, y + 54, 54, 50);
  context.fillRect(x + w - 102, y + 54, 52, 50);
  context.fillStyle = "#496f7b";
  context.fillRect(x + w - 116, y + 70, 14, 50);
  context.fillStyle = COLORS.ink;
  context.font = "bold 9px ui-monospace, monospace";
  context.textAlign = "center";
  context.fillText("臺中綠美圖", x + w - 109, y + 36);
  for (let tree = 0; tree < 10; tree += 1) {
    const tx = x + 25 + (tree * 47) % (w - 45);
    const ty = y + 34 + (tree * 71) % (h - 54);
    if (tx > x + w - 200 && ty < y + 138) continue;
    drawTree(tx, ty, now, index + tree * 0.4);
  }
  centralParkLampPositions({ x, y, w, h }).forEach((lamp) => drawLamp(lamp.x, lamp.y));
  context.fillStyle = "#9c6748";
  context.fillRect(x + 183, y + h - 58, 48, 6);
  context.fillRect(x + 189, y + h - 52, 5, 10);
  context.fillRect(x + 219, y + h - 52, 5, 10);
}

function drawHarborOutletHub({ x, y, w, h }) {
  context.fillStyle = "#d8d4bf";
  context.fillRect(x, y, w, h);
  context.fillStyle = COLORS.water;
  context.fillRect(x + w - 92, y, 92, h);
  context.fillStyle = COLORS.waterLight;
  for (let wave = 0; wave < 5; wave += 1) context.fillRect(x + w - 78 + wave % 2 * 17, y + 24 + wave * 49, 46, 4);
  const blocks = [
    { bx: x + 28, by: y + 36, bw: 142, bh: 72, color: "#eee7d5" },
    { bx: x + 188, by: y + 28, bw: 150, bh: 84, color: "#e4e9e3" },
    { bx: x + 54, by: y + 148, bw: 125, bh: 70, color: "#efe0c3" },
    { bx: x + 202, by: y + 150, bw: 150, bh: 70, color: "#dde7e3" },
  ];
  blocks.forEach((block, blockIndex) => {
    context.fillStyle = block.color;
    context.fillRect(block.bx, block.by, block.bw, block.bh);
    context.fillStyle = blockIndex % 2 ? "#4f8090" : "#cf6548";
    context.fillRect(block.bx - 4, block.by, block.bw + 8, 9);
    context.fillStyle = COLORS.window;
    for (let windowX = block.bx + 12; windowX < block.bx + block.bw - 12; windowX += 30) {
      context.fillRect(windowX, block.by + 22, 18, 14);
    }
  });
  context.fillStyle = "#70513e";
  context.fillRect(x + w - 116, y + 28, 10, h - 50);
  context.fillRect(x + w - 126, y + 42, 31, 7);
  context.fillRect(x + w - 126, y + h - 55, 31, 7);
  drawMarketStall(x + 364, y + 176, "#dfaf48");
}

function drawCivicCenterHub({ x, y, w, h }, now) {
  context.fillStyle = "#cfc9b3";
  context.fillRect(x, y, w, h);
  context.fillStyle = "#7fa37c";
  context.fillRect(x + 22, y + 28, w - 44, h - 56);
  context.fillStyle = "#dcd7c8";
  context.fillRect(x + 74, y + 38, 114, 152);
  context.fillRect(x + w - 188, y + 38, 114, 152);
  context.fillStyle = "#6e8790";
  for (let floor = 0; floor < 7; floor += 1) {
    context.fillRect(x + 85, y + 50 + floor * 18, 92, 8);
    context.fillRect(x + w - 177, y + 50 + floor * 18, 92, 8);
  }
  context.fillStyle = "#ece7d6";
  context.fillRect(x + 190, y + 80, w - 380, 98);
  context.fillStyle = "#4d7481";
  context.fillRect(x + 206, y + 101, w - 412, 48);
  context.fillStyle = COLORS.paper;
  context.font = "bold 9px ui-monospace, monospace";
  context.textAlign = "center";
  context.fillText("市政中心", x + w / 2, y + 94);
  context.fillStyle = COLORS.water;
  context.fillRect(x + w / 2 - 24, y + h - 62, 48, 34);
  context.fillStyle = COLORS.waterLight;
  context.fillRect(x + w / 2 - 15, y + h - 54, 30, 18);
  drawLamp(x + 198, y + h - 42);
  drawLamp(x + w - 198, y + h - 42);
}

function drawCivicNeighborhoodHub({ x, y, w, h }, now) {
  context.fillStyle = "#83a77d";
  context.fillRect(x, y, w, h);
  context.fillStyle = "#d8cdae";
  context.fillRect(x + 88, y + 18, w - 176, 102);
  context.fillRect(x + 46, y + 122, w - 92, 96);
  context.fillStyle = "#b6ad91";
  context.fillRect(x + 92, y + 94, w - 184, 12);
  context.fillRect(x + w / 2 - 7, y + 102, 14, 122);
  context.fillStyle = "#72966d";
  context.fillRect(x + 15, y + 128, 42, 88);
  context.fillRect(x + w - 57, y + 128, 42, 88);
  drawTree(x + 36, y + 154, now, 0.6, 0.72);
  drawTree(x + w - 36, y + 164, now, 1.8, 0.72);
  drawLamp(x + 187, y + 126);
  drawLamp(x + w - 187, y + h - 24);
  context.fillStyle = "#5d7f64";
  context.fillRect(x + 10, y + h - 16, w - 20, 6);
}

function drawStadiumHub({ x, y, w, h }) {
  context.fillStyle = "#b9b2a4";
  context.fillRect(x, y, w, h);
  context.fillStyle = "#486978";
  context.beginPath();
  context.ellipse(x + w / 2, y + h / 2, w * 0.42, h * 0.42, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#d9d5c8";
  context.beginPath();
  context.ellipse(x + w / 2, y + h / 2, w * 0.35, h * 0.34, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#71a56b";
  context.beginPath();
  context.ellipse(x + w / 2, y + h / 2, w * 0.28, h * 0.26, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#c99a66";
  context.beginPath();
  context.moveTo(x + w / 2, y + h / 2 - 10);
  context.lineTo(x + w / 2 + 66, y + h / 2 + 48);
  context.lineTo(x + w / 2, y + h / 2 + 92);
  context.lineTo(x + w / 2 - 66, y + h / 2 + 48);
  context.closePath();
  context.fill();
  context.fillStyle = "#1c3947";
  context.fillRect(x + w / 2 - 54, y + 18, 108, 35);
  context.fillStyle = COLORS.yellow;
  context.font = "bold 12px ui-monospace, monospace";
  context.textAlign = "center";
  context.fillText("TAICHUNG", x + w / 2, y + 39);
}

function drawLalaportHub({ x, y, w, h }) {
  context.fillStyle = "#d6cdb9";
  context.fillRect(x, y, w, h);
  const mallY = y + 44;
  context.fillStyle = "#e6e3db";
  context.fillRect(x + 28, mallY, 186, 166);
  context.fillRect(x + w - 214, mallY, 186, 166);
  context.fillStyle = "#41788c";
  for (let floor = 0; floor < 4; floor += 1) {
    context.fillRect(x + 42, mallY + 22 + floor * 32, 158, 13);
    context.fillRect(x + w - 200, mallY + 22 + floor * 32, 158, 13);
  }
  context.fillStyle = "#d45d48";
  context.fillRect(x + 24, mallY, 194, 11);
  context.fillStyle = "#e2b849";
  context.fillRect(x + w - 218, mallY, 194, 11);
  context.fillStyle = "#9dc0c4";
  context.fillRect(x + 196, y + 105, w - 392, 28);
  context.fillStyle = "#4c7180";
  context.fillRect(x + 196, y + 113, w - 392, 8);
  context.fillStyle = COLORS.ink;
  context.fillRect(x + 105, y + h - 46, 78, 6);
  context.fillRect(x + w - 183, y + h - 46, 78, 6);
}

function drawHospitalHub({ x, y, w, h }, now) {
  context.fillStyle = "#9fb6ad";
  context.fillRect(x, y, w, h);
  context.fillStyle = "#e7eee9";
  context.fillRect(x + 76, y + 38, w - 152, 176);
  context.fillStyle = "#d8e5e2";
  context.fillRect(x + 34, y + 92, 86, 122);
  context.fillRect(x + w - 120, y + 92, 86, 122);
  context.fillStyle = "#4e7f91";
  for (let floor = 0; floor < 4; floor += 1) {
    for (let windowIndex = 0; windowIndex < 8; windowIndex += 1) {
      context.fillRect(x + 92 + windowIndex * 40, y + 69 + floor * 31, 22, 13);
    }
  }
  context.fillStyle = "#d24e52";
  context.fillRect(x + w / 2 - 8, y + 48, 16, 50);
  context.fillRect(x + w / 2 - 25, y + 65, 50, 16);
  context.fillStyle = "#375d6e";
  context.fillRect(x + w / 2 - 22, y + 179, 44, 35);
  context.fillStyle = COLORS.paper;
  context.fillRect(x + 38, y + h - 44, 66, 25);
  context.fillStyle = "#d24e52";
  context.fillRect(x + 44, y + h - 39, 20, 7);
  context.fillStyle = "#4f7484";
  context.fillRect(x + 71, y + h - 37, 23, 14);
  drawLamp(x + w - 48, y + h - 42);
}

function drawAsiaMuseumHub({ x, y, w, h }, now) {
  context.fillStyle = "#86aa79";
  context.fillRect(x, y, w, h);
  context.fillStyle = "#c9c8c1";
  context.beginPath();
  context.moveTo(x + 58, y + 214);
  context.lineTo(x + 220, y + 38);
  context.lineTo(x + 292, y + 214);
  context.closePath();
  context.fill();
  context.fillStyle = "#9ea6a4";
  context.beginPath();
  context.moveTo(x + 214, y + 214);
  context.lineTo(x + 336, y + 55);
  context.lineTo(x + 444, y + 214);
  context.closePath();
  context.fill();
  context.fillStyle = "#426c7a";
  context.beginPath();
  context.moveTo(x + 150, y + 200);
  context.lineTo(x + 223, y + 80);
  context.lineTo(x + 258, y + 200);
  context.closePath();
  context.fill();
  context.fillStyle = "#e2d7b7";
  context.fillRect(x + 44, y + h - 45, w - 88, 12);
  context.fillStyle = "#8a5640";
  context.fillRect(x + w - 70, y + h - 92, 9, 55);
  context.fillRect(x + w - 86, y + h - 90, 42, 7);
  drawTree(x + 42, y + 58, now, 0.2);
  drawTree(x + w - 42, y + 62, now, 1.4);
}

function drawArcadeShelter(venue) {
  const { x, y, w, h } = venue;
  context.fillStyle = "#e7d6ad";
  context.fillRect(x - 4, y + h - 4, w + 8, 7);
  context.fillStyle = "#6e5a4a";
  context.fillRect(x + 5, y + h + 3, 3, 10);
  context.fillRect(x + w - 8, y + h + 3, 3, 10);
}

function drawConvenienceStore(venue) {
  const { x, y, w, h, brand } = venue;
  context.fillStyle = brand.wall;
  context.fillRect(x, y, w, h);
  context.fillStyle = brand.roof;
  if (brand.style === "leaf") {
    context.beginPath();
    context.moveTo(x - 3, y + 8);
    context.lineTo(x + w / 2, y - 7);
    context.lineTo(x + w + 3, y + 8);
    context.fill();
    context.fillStyle = brand.accent;
    context.fillRect(x + 10, y + 13, w - 20, 5);
  } else if (brand.style === "star") {
    context.fillRect(x - 3, y, w + 6, 9);
    context.fillStyle = brand.accent;
    context.fillRect(x + 4, y + 9, 10, h - 9);
    context.fillRect(x + w - 14, y + 9, 10, h - 9);
  } else {
    context.fillRect(x - 3, y, w + 6, 8);
    context.fillStyle = brand.accent;
    context.fillRect(x, y + 9, w, 5);
  }
  context.fillStyle = COLORS.window;
  context.fillRect(x + 10, y + 18, Math.max(18, w / 2 - 18), h - 26);
  context.fillRect(x + w / 2 + 8, y + 18, Math.max(18, w / 2 - 18), h - 26);
  context.fillStyle = "#6b4a39";
  context.fillRect(x + w / 2 - 5, y + h - 17, 10, 17);
  if (brand.style === "star") {
    context.fillStyle = brand.accent;
    context.fillRect(x + w - 25, y + 17, 10, 10);
    context.fillStyle = COLORS.paper;
    context.fillRect(x + w - 21, y + 19, 3, 6);
  }
}

function drawSnackShop(venue) {
  const { x, y, w, h } = venue;
  context.fillStyle = "#ead7ac";
  context.fillRect(x, y, w, h);
  for (let stripe = 0; stripe < w; stripe += 16) {
    context.fillStyle = stripe % 32 ? "#fff0cc" : "#c95d43";
    context.fillRect(x + stripe, y, Math.min(16, w - stripe), 10);
  }
  context.fillStyle = "#76513a";
  context.fillRect(x + 8, y + 19, w - 16, 8);
  context.fillStyle = COLORS.window;
  context.fillRect(x + 12, y + 28, w - 34, h - 28);
  context.fillStyle = COLORS.ink;
  context.fillRect(x + w - 18, y + h - 16, 10, 16);
  context.fillStyle = COLORS.yellow;
  context.fillRect(x + 18, y + 14, Math.min(44, w - 36), 4);
}

function drawServiceVenue(venue) {
  const { x, y, w, h, type } = venue;
  const serviceColor = type === "police-station" ? "#436b8d" : type === "fire-station" ? "#bd503c" : "#e6eee8";
  const serviceAccent = type === "hospital" ? "#d34f52" : type === "fire-station" ? "#f0c952" : "#d6e7ee";
  context.fillStyle = type === "hospital" ? "#dfe9e4" : "#d5d7cf";
  context.fillRect(x, y, w, h);
  context.fillStyle = serviceColor;
  context.fillRect(x - 2, y, w + 4, 9);
  context.fillStyle = COLORS.window;
  context.fillRect(x + 7, y + 16, 14, 10);
  context.fillRect(x + w - 21, y + 16, 14, 10);
  context.fillStyle = serviceAccent;
  if (type === "hospital") {
    context.fillRect(x + w / 2 - 3, y + 13, 6, 18);
    context.fillRect(x + w / 2 - 9, y + 19, 18, 6);
  } else if (type === "fire-station") {
    context.fillRect(x + w / 2 - 10, y + h - 19, 20, 19);
    context.fillStyle = "#7d3f35";
    context.fillRect(x + w / 2 - 7, y + h - 16, 14, 3);
    context.fillRect(x + w / 2 - 7, y + h - 10, 14, 3);
  } else {
    context.fillRect(x + w / 2 - 8, y + 14, 16, 5);
    context.fillStyle = COLORS.ink;
    context.fillRect(x + w / 2 - 4, y + h - 15, 8, 15);
  }
}

function drawVenueOccupancy(venue) {
  const occupants = state.npcs.filter((npc) => npc.insideVenueId === venue.id).slice(0, 4);
  occupants.forEach((npc, occupantIndex) => {
    const column = occupantIndex % 2;
    const row = Math.floor(occupantIndex / 2);
    const px = venue.x + 10 + column * Math.max(18, venue.w - 34);
    const py = venue.y + venue.h - 12 - row * 10;
    context.fillStyle = npc.skin;
    context.fillRect(px, py - 6, 5, 5);
    context.fillStyle = npc.outfit;
    context.fillRect(px - 1, py - 1, 7, 5);
  });
}

function drawVenueLabel(venue, now, index) {
  const sparkle = reducedMotion ? 0 : Math.floor(now / 700 + index) % 2;
  const label = venueDisplayLabel(venue, true);
  context.fillStyle = "rgba(255, 248, 231, 0.96)";
  context.fillRect(venue.x + 3, venue.y - 14 - sparkle, venue.w - 6, 14);
  context.fillStyle = COLORS.ink;
  context.font = `bold ${venue.w < 90 ? 7 : 9}px ui-monospace, monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(label).slice(0, venue.w < 90 ? 7 : 12), venue.x + venue.w / 2, venue.y - 7 - sparkle);
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

  if (["coast", "harbor", "church-harbor", "wetland", "lake-pavilion"].includes(feature)) {
    context.fillStyle = COLORS.water;
    context.fillRect(-30, 5, 60, 16);
    context.fillStyle = COLORS.waterLight;
    context.fillRect(-26, 9, 18, 3);
    context.fillRect(3, 15, 20, 3);
  }

  if (feature === "luce-chapel") {
    context.fillStyle = "#d8b36a";
    context.beginPath();
    context.moveTo(-25, 20);
    context.quadraticCurveTo(-12, -20, 0, -24);
    context.quadraticCurveTo(12, -20, 25, 20);
    context.lineTo(12, 20);
    context.quadraticCurveTo(6, -4, 0, -11);
    context.quadraticCurveTo(-6, -4, -12, 20);
    context.closePath();
    context.fill();
    context.fillStyle = "#486f7a";
    context.fillRect(-3, -10, 6, 30);
    context.fillStyle = "#79aa6e";
    context.fillRect(-30, 20, 60, 5);
  } else if (feature === "lake-pavilion") {
    context.fillStyle = COLORS.water;
    context.fillRect(-30, 3, 60, 19);
    context.fillStyle = COLORS.paper;
    context.fillRect(-12, -6, 24, 20);
    context.fillStyle = "#bd4e3a";
    context.fillRect(-18, -13, 36, 7);
    context.fillRect(-10, -19, 20, 6);
    context.fillStyle = "#6d4236";
    context.fillRect(-8, 3, 4, 11);
    context.fillRect(5, 3, 4, 11);
    context.fillStyle = "#d8c697";
    context.fillRect(-28, 17, 56, 4);
  } else if (feature === "science-museum") {
    context.fillStyle = "#d9ded8";
    context.fillRect(-29, -8, 58, 29);
    context.fillStyle = "#527e8d";
    context.fillRect(-25, -3, 22, 17);
    context.beginPath();
    context.arc(15, -7, 13, Math.PI, Math.PI * 2);
    context.fill();
    context.fillStyle = COLORS.paper;
    context.fillRect(7, -7, 16, 21);
    context.fillStyle = "#6ba28a";
    context.fillRect(-29, 17, 58, 5);
  } else if (feature === "culture-center") {
    context.fillStyle = "#e1d9c7";
    context.fillRect(-30, -3, 60, 24);
    context.fillStyle = "#c5b899";
    context.fillRect(-24, -10, 48, 8);
    context.fillRect(-17, -17, 34, 8);
    context.fillStyle = COLORS.window;
    for (let windowX = -22; windowX <= 14; windowX += 12) context.fillRect(windowX, 4, 8, 9);
    context.fillStyle = "#8d5b43";
    context.fillRect(-5, 10, 10, 11);
  } else if (feature === "library") {
    context.fillStyle = "#d9ded8";
    context.fillRect(-29, -12, 58, 33);
    context.fillStyle = "#4f8190";
    context.fillRect(-25, -7, 50, 7);
    context.fillRect(-25, 5, 50, 7);
    context.fillStyle = COLORS.paper;
    context.fillRect(-18, -5, 6, 25);
    context.fillRect(-3, -5, 6, 25);
    context.fillRect(12, -5, 6, 25);
  } else if (feature === "coast") {
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
  drawCampusDetails(layout);
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

  drawCompactSchoolSign(school);
  if (layout.neighborCounty) drawNeighborSchoolDataMarker(school);
  if (state.isWeekend) drawWeekendSchoolMarker(layout);

  if (!reducedMotion && now && school.index % 13 === 0) {
    context.fillStyle = COLORS.yellow;
    context.fillRect(layout.x + layout.w - 8, layout.y + 6 + Math.floor(now / 500) % 2, 4, 4);
  }
}

function drawNeighborSchoolDataMarker(school) {
  const { layout } = school;
  const available = schoolHasCurrentMeal(school);
  context.fillStyle = available ? "#3f8b58" : "#d7a33a";
  context.fillRect(layout.x + 3, layout.y + 3, 7, 7);
  context.strokeStyle = "rgba(255, 248, 231, 0.9)";
  context.lineWidth = 1;
  context.strokeRect(layout.x + 2.5, layout.y + 2.5, 8, 8);
}

function drawWeekendSchoolMarker(layout) {
  const x = layout.x + layout.w - 32;
  const y = layout.y + 4;
  context.fillStyle = "#496379";
  context.fillRect(x, y, 28, 12);
  context.fillStyle = COLORS.paper;
  context.font = "bold 7px ui-monospace, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("休息日", x + 14, y + 6);
}

function drawCampusDetails(layout) {
  if (["lamps", "open"].includes(layout.theme)) {
    drawLamp(layout.x + 16, layout.y + 16);
    drawLamp(layout.x + layout.w - 16, layout.y + 16);
    drawLamp(layout.x + 16, layout.y + layout.h - 16);
    drawLamp(layout.x + layout.w - 16, layout.y + layout.h - 16);
    return;
  }
  if (layout.theme === "hedge") {
    context.fillStyle = COLORS.tree;
    context.fillRect(layout.x + 12, layout.y + 14, 13, 11);
    context.fillRect(layout.x + layout.w - 25, layout.y + layout.h - 25, 13, 11);
    context.fillStyle = COLORS.treeLight;
    context.fillRect(layout.x + 15, layout.y + 10, 8, 7);
    context.fillRect(layout.x + layout.w - 22, layout.y + layout.h - 29, 8, 7);
    return;
  }
  context.fillStyle = layout.theme === "brick" || layout.theme === "mixed" ? "#a45842" : "#a2714e";
  context.fillRect(layout.x + 12, layout.y + layout.h - 20, 30, 7);
  context.fillRect(layout.x + layout.w - 42, layout.y + 13, 30, 7);
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
  const label = formatSchoolMapLabel(school.name, school.district);
  context.fillStyle = COLORS.ink;
  context.fillRect(gateX - 54, gateY, 108, 20);
  context.fillStyle = COLORS.paper;
  context.font = `bold ${fitSchoolLabelFont(label, 100, 12, 8)}px ui-monospace, monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, gateX, gateY + 10);
}

function drawCompactSchoolSign(school) {
  const { layout } = school;
  const label = formatSchoolMapLabel(school.name, school.district);
  const signWidth = Math.max(44, layout.w - 6);
  const maxTextWidth = signWidth - 8;
  const singleLineFont = fitSchoolLabelFont(label, maxTextWidth, 10, 7);
  const needsTwoLines = singleLineFont < 7 || context.measureText(label).width > maxTextWidth;
  const lines = needsTwoLines ? splitSchoolMapLabel(label) : [label];
  const fontSize = Math.max(6, Math.min(10, ...lines.map((line) => fitSchoolLabelFont(line, maxTextWidth, 10, 6))));
  const lineHeight = fontSize + 2;
  const signHeight = lines.length * lineHeight + 5;
  const signX = layout.x + (layout.w - signWidth) / 2;
  const signY = layout.y + layout.h - signHeight - 3;

  context.fillStyle = "#fff8df";
  context.fillRect(signX, signY, signWidth, signHeight);
  context.strokeStyle = COLORS.ink;
  context.lineWidth = 2;
  context.strokeRect(signX + 1, signY + 1, signWidth - 2, signHeight - 2);
  context.fillStyle = COLORS.ink;
  context.font = `bold ${fontSize}px ui-monospace, monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  lines.forEach((line, index) => {
    context.fillText(line, signX + signWidth / 2, signY + 3 + lineHeight * (index + 0.5));
  });
}

function formatSchoolMapLabel(name, district = "") {
  let label = String(name || "").trim()
    .replace(/^臺中市/, "")
    .replace(/^台中市/, "")
    .replace(/國民中小學/g, "國中小")
    .replace(/國民小學/g, "國小")
    .replace(/\s+/g, "");
  if (district && label.startsWith(district)) label = label.slice(district.length);
  return label || "國小";
}

function splitSchoolMapLabel(label) {
  const primarySchoolEnd = label.indexOf("國小") + 2;
  if (primarySchoolEnd > 1 && primarySchoolEnd < label.length) {
    return [label.slice(0, primarySchoolEnd), label.slice(primarySchoolEnd)];
  }
  if (label.length > 10) {
    const lineLength = Math.ceil(label.length / 3);
    return [0, lineLength, lineLength * 2]
      .map((start) => label.slice(start, start + lineLength))
      .filter(Boolean);
  }
  const midpoint = Math.ceil(label.length / 2);
  return [label.slice(0, midpoint), label.slice(midpoint)].filter(Boolean);
}

function fitSchoolLabelFont(label, maxWidth, preferredSize, minimumSize) {
  for (let size = preferredSize; size >= minimumSize; size -= 1) {
    context.font = `bold ${size}px ui-monospace, monospace`;
    if (context.measureText(label).width <= maxWidth) return size;
  }
  return minimumSize - 1;
}

function streetDecorationsForZone(zone, districtIndex) {
  const treeXs = [62, 138, 222, 310, 402, 496];
  return {
    trees: [
      ...treeXs.map((offset, index) => ({ x: zone.x + offset, y: zone.y + 54, phase: districtIndex * 0.7 + index * 0.45 })),
      ...treeXs.slice(0, 5).map((offset, index) => ({ x: zone.x + offset + 34, y: zone.y + zone.h - 24, phase: districtIndex + index * 0.52 })),
      { x: zone.x + 24, y: zone.y + 148, phase: districtIndex * 0.4 },
      { x: zone.x + zone.w - 24, y: zone.y + 198, phase: districtIndex * 0.4 + 1.7 },
    ],
    lamps: [
      { x: zone.x + 28, y: zone.y + 44 },
      { x: zone.x + zone.w - 28, y: zone.y + 44 },
      { x: zone.x + 20, y: zone.y + zone.h / 2 },
      { x: zone.x + zone.w - 20, y: zone.y + zone.h / 2 },
      { x: zone.x + 162, y: zone.y + zone.h - 18 },
      { x: zone.x + zone.w - 162, y: zone.y + zone.h - 18 },
    ],
  };
}

function drawStreetDetails(now, environment) {
  DISTRICT_DISPLAY_ORDER.filter((district) => isVisibleRect(DISTRICT_ZONES[district], 40)).forEach((district) => {
    const zone = DISTRICT_ZONES[district];
    const districtIndex = DISTRICT_DISPLAY_ORDER.indexOf(district);
    const decorations = streetDecorationsForZone(zone, districtIndex);
    decorations.trees.forEach((tree) => drawTree(tree.x, tree.y, now, tree.phase));
    decorations.lamps.forEach((lamp) => drawLamp(lamp.x, lamp.y, environment));
    context.fillStyle = "#a2714e";
    context.fillRect(zone.x + zone.w - 92, zone.y + 48, 38, 7);
    context.fillRect(zone.x + 206, zone.y + zone.h - 30, 42, 7);
  });
}

function drawTree(x, y, now = 0, phase = 0, scale = 1) {
  const sway = reducedMotion ? 0 : Math.round(Math.sin(now / 920 + phase) * 2);
  context.save();
  context.translate(Math.round(x), Math.round(y));
  context.scale(scale, scale);
  context.fillStyle = COLORS.trunk;
  context.fillRect(-4, 0, 8, 18);
  context.translate(sway, 0);
  context.fillStyle = COLORS.tree;
  context.fillRect(-14, -18, 28, 22);
  context.fillStyle = COLORS.treeLight;
  context.fillRect(-8, -26, 18, 18);
  context.restore();
}

function drawLamp(x, y, environment = state.environment) {
  context.fillStyle = COLORS.ink;
  context.fillRect(x - 2, y - 14, 4, 18);
  context.fillStyle = environment?.darkness > 0.08 ? "#ffe78a" : "#e8d7a2";
  context.fillRect(x - 5, y - 20, 10, 8);
}

function drawAtmosphereOverlay(environment) {
  if (!environment) return;
  context.save();
  const transitionStrength = Math.sin(Math.PI * Number(environment.phaseProgress || 0));
  if (environment.phase === "黎明") {
    context.fillStyle = `rgba(226, 123, 145, ${0.08 + transitionStrength * 0.08})`;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.fillStyle = `rgba(255, 193, 112, ${0.04 + transitionStrength * 0.06})`;
    context.fillRect(0, 0, WIDTH, HEIGHT);
  } else if (environment.phase === "黃昏") {
    context.fillStyle = `rgba(241, 151, 66, ${0.08 + transitionStrength * 0.1})`;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.fillStyle = `rgba(126, 76, 125, ${environment.phaseProgress * 0.08})`;
    context.fillRect(0, 0, WIDTH, HEIGHT);
  }
  if (environment.darkness > 0) {
    context.fillStyle = `rgba(12, 27, 55, ${environment.darkness})`;
    context.fillRect(0, 0, WIDTH, HEIGHT);
  }
  if (environment.isRaining) {
    context.fillStyle = `rgba(69, 98, 116, ${0.08 + environment.rainIntensity * 0.1})`;
    context.fillRect(0, 0, WIDTH, HEIGHT);
  }
  context.restore();
}

function visibleLampPositions() {
  const positions = [];
  DISTRICT_DISPLAY_ORDER.filter((district) => isVisibleRect(DISTRICT_ZONES[district], 80)).forEach((district) => {
    const zone = DISTRICT_ZONES[district];
    const districtIndex = DISTRICT_DISPLAY_ORDER.indexOf(district);
    positions.push(...streetDecorationsForZone(zone, districtIndex).lamps);
  });
  state.schools.filter((school) => isVisibleRect(school.layout, 80)).forEach((school) => {
    const { layout } = school;
    if (!["lamps", "open"].includes(layout.theme)) return;
    positions.push(
      { x: layout.x + 16, y: layout.y + 16 },
      { x: layout.x + layout.w - 16, y: layout.y + 16 },
      { x: layout.x + 16, y: layout.y + layout.h - 16 },
      { x: layout.x + layout.w - 16, y: layout.y + layout.h - 16 },
    );
  });
  state.venues
    .filter((venue) => venue.id === "waternan-central-park" && isVisibleRect(venue, 80))
    .forEach((venue) => positions.push(...centralParkLampPositions(venue)));
  positions.push(...riverbankFixturePositions()
    .filter((fixture) => fixture.kind === "lamp")
    .map((fixture) => ({ x: fixture.x, y: fixture.y + fixture.bankSide * 7 })));
  return positions;
}

function drawStreetLightGlows(environment, now) {
  if (!environment || environment.darkness <= 0.08) return;
  const strength = Math.min(1, environment.darkness / MAX_NIGHT_DARKNESS);
  const pulse = reducedMotion ? 1 : 0.96 + Math.sin(now / 840) * 0.04;
  context.save();
  context.globalCompositeOperation = "screen";
  visibleLampPositions().forEach((lamp) => {
    const x = lamp.x - state.camera.x;
    const y = lamp.y - 20 - state.camera.y;
    if (x < -45 || x > WIDTH + 45 || y < -45 || y > HEIGHT + 45) return;
    const glowWidth = Math.round(27 * pulse);
    context.fillStyle = `rgba(255, 203, 82, ${0.045 * strength})`;
    context.fillRect(Math.round(x - glowWidth), Math.round(y - 20), glowWidth * 2, 40);
    context.fillStyle = `rgba(255, 215, 105, ${0.1 * strength})`;
    context.fillRect(Math.round(x - 16), Math.round(y - 12), 32, 24);
    context.fillStyle = `rgba(255, 233, 137, ${0.22 * strength})`;
    context.fillRect(Math.round(x - 8), Math.round(y - 7), 16, 14);
    context.fillStyle = "#ffe99b";
    context.fillRect(Math.round(x - 3), Math.round(y - 2), 6, 5);
  });
  context.restore();
}

function drawRain(environment, now) {
  if (!environment?.isRaining) return;
  const intensity = environment.rainIntensity;
  const dropCount = Math.round(38 + intensity * 58);
  const travel = reducedMotion ? 0 : Math.floor(now / 12);
  context.save();
  context.strokeStyle = `rgba(205, 235, 244, ${0.28 + intensity * 0.35})`;
  context.lineWidth = 2;
  context.beginPath();
  for (let index = 0; index < dropCount; index += 1) {
    const x = (index * 83 + travel * 2) % (WIDTH + 80) - 40;
    const y = (index * 47 + travel * 3) % (HEIGHT + 80) - 40;
    context.moveTo(x, y);
    context.lineTo(x - 5, y + 14);
  }
  context.stroke();
  context.strokeStyle = `rgba(185, 222, 235, ${0.16 + intensity * 0.18})`;
  context.lineWidth = 1;
  for (let index = 0; index < 10; index += 1) {
    const x = (index * 113 + 36) % WIDTH;
    const y = HEIGHT - 18 - (index % 3) * 34;
    const ripple = reducedMotion ? 5 : 3 + ((Math.floor(now / 160) + index) % 5);
    context.beginPath();
    context.ellipse(x, y, ripple * 2, ripple, 0, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}

function drawPerson(person, now) {
  const { x, y, direction, step, player = false } = person;
  if (person.isCollapsed) {
    context.save();
    context.translate(Math.round(x), Math.round(y));
    context.fillStyle = "rgba(20, 45, 55, 0.22)";
    context.fillRect(-17, 8, 34, 5);
    context.fillStyle = person.outfitDark;
    context.fillRect(-8, 0, 19, 9);
    context.fillStyle = person.outfit;
    context.fillRect(-11, -6, 18, 9);
    context.fillStyle = person.skin;
    context.fillRect(7, -8, 12, 12);
    context.fillStyle = person.hair;
    context.fillRect(11, -10, 8, 5);
    context.restore();
    return;
  }
  if (person.ridingBike) drawNpcBicycle(person);
  const frame = person.isMoving && !reducedMotion ? Math.floor(step) % 4 : 0;
  const gait = [0, 1, 0, -1][frame];
  const activityBeat = reducedMotion ? 0 : Math.floor(now / 280 + (person.lookIndex || 0)) % 2;
  const socialBob = ["greeting", "listening", "exercising", "sweeping", "barbecuing"].includes(person.activity)
    ? activityBeat
    : 0;
  const bob = (person.isMoving && !reducedMotion && frame % 2 ? 1 : 0) + socialBob;
  const legSwing = gait * 2;
  let armSwing = -legSwing;
  if (!person.isMoving && !reducedMotion) {
    if (person.activity === "greeting") armSwing = activityBeat ? -3 : 1;
    if (["sweeping", "exercising"].includes(person.activity)) armSwing = activityBeat ? 3 : -3;
    if (person.activity === "fishing") armSwing = activityBeat ? -1 : 1;
    if (person.activity === "barbecuing") armSwing = activityBeat ? 3 : -2;
  }
  const bodyScale = person.ageGroup === "child" ? 0.8 : person.ageGroup === "teen" ? 0.9 : person.ageGroup === "senior" ? 0.96 : 1;
  const rideLift = person.ridingBike ? 6 : 0;
  context.save();
  context.translate(Math.round(x), Math.round(y - bob - rideLift + (1 - bodyScale) * 13));
  context.scale(direction === "left" ? -bodyScale : bodyScale, bodyScale);
  if (!person.ridingBike) {
    context.fillStyle = "rgba(20, 45, 55, 0.22)";
    context.fillRect(-9, 12, 19, 5);
  }

  drawCharacterBackAccessory(person, direction);
  const outfitStyle = resolveOutfitStyle(person);
  drawCharacterLegs(person, legSwing, outfitStyle);
  drawCharacterArms(person, armSwing, outfitStyle);
  drawCharacterOutfit(person, outfitStyle);

  context.fillStyle = person.skin;
  context.fillRect(-3, -11, 6, 4);
  context.fillRect(-7, -22, 14, 12);
  if (["left", "right"].includes(direction)) context.fillRect(6, -19, 3, 5);
  drawCharacterHair(person, direction);
  drawCharacterFace(person, direction, now);
  drawCharacterAccessory(person, direction, armSwing, player);
  if (state.environment?.isRaining && (player || person.hasUmbrella || (person.lookIndex || 0) % 3 === 0)) {
    drawRainUmbrella(person);
  }
  context.restore();
  drawNpcRiverbankActivity(person, now);
  drawPersonEmote(person, now);
}

function drawNpcRiverbankActivity(person, now) {
  if (!person.riverbankSiteId || !["fishing", "barbecuing"].includes(person.activity)) return;
  const site = riverbankLeisureSiteById(person.riverbankSiteId);
  if (!site) return;
  context.save();
  context.lineCap = "square";
  if (person.activity === "fishing") {
    const bridge = BOUNDARY_BRIDGES.find((item) => item.id === site.bridgeId);
    if (!bridge) {
      context.restore();
      return;
    }
    const wobble = reducedMotion ? 0 : Math.round(Math.sin(now / 520 + (person.lookIndex || 0)) * 2);
    const handX = Math.round(person.x + 5);
    const handY = Math.round(person.y - 9);
    const rodTipX = Math.round(person.x + 19 + wobble);
    const rodTipY = Math.round(person.y - site.bankSide * 34);
    const bobberY = Math.round(boundaryRiverYAt(rodTipX, bridge)
      + site.bankSide * (BORDER_RIVER_WIDTH / 2 - 5));
    context.strokeStyle = "#5d4933";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(handX, handY);
    context.lineTo(rodTipX, rodTipY);
    context.stroke();
    context.strokeStyle = "rgba(226, 236, 220, 0.9)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(rodTipX, rodTipY);
    context.lineTo(rodTipX, bobberY);
    context.stroke();
    context.fillStyle = "#e65b45";
    context.fillRect(rodTipX - 2, bobberY - 2, 5, 5);
  } else {
    const grillX = Math.round(site.x + 21);
    const grillY = Math.round(site.y - 10);
    context.strokeStyle = "#745035";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(Math.round(person.x + 5), Math.round(person.y - 8));
    context.lineTo(grillX, grillY);
    context.stroke();
    context.fillStyle = "#efc45b";
    context.fillRect(grillX - 3, grillY - 2, 7, 4);
  }
  context.restore();
}

function drawNpcBicycle(person) {
  const facingLeft = person.direction === "left";
  context.save();
  context.translate(Math.round(person.x), Math.round(person.y));
  context.scale(facingLeft ? -1 : 1, 1);
  context.fillStyle = "rgba(20, 45, 55, 0.2)";
  context.fillRect(-22, 18, 44, 4);
  context.strokeStyle = "#263f48";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(-13, 10, 9, 0, Math.PI * 2);
  context.arc(13, 10, 9, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = "#5d973f";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-13, 10);
  context.lineTo(-3, -2);
  context.lineTo(4, 10);
  context.lineTo(-13, 10);
  context.moveTo(-3, -2);
  context.lineTo(13, 10);
  context.moveTo(4, 10);
  context.lineTo(10, -7);
  context.lineTo(16, -7);
  context.stroke();
  context.fillStyle = "#e9b936";
  context.fillRect(-7, -5, 9, 3);
  context.fillStyle = "#173443";
  context.fillRect(1, 8, 7, 3);
  context.restore();
}

function drawPersonEmote(person, now) {
  if (!person.emote || !person.emoteUntil || now >= person.emoteUntil) return;
  const symbols = { smile: "☺", question: "?", note: "♪", greeting: "!" };
  const symbol = symbols[person.emote] || "·";
  const y = Math.round(person.y - (person.ageGroup === "child" ? 31 : 38));
  const x = Math.round(person.x + 10);
  context.save();
  context.fillStyle = "rgba(255, 250, 229, 0.96)";
  context.strokeStyle = COLORS.navy;
  context.lineWidth = 2;
  context.fillRect(x, y, 17, 16);
  context.strokeRect(x, y, 17, 16);
  context.fillRect(x + 2, y + 14, 4, 4);
  context.strokeRect(x + 2, y + 14, 4, 4);
  context.fillStyle = COLORS.navy;
  context.font = "bold 12px monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(symbol, x + 8.5, y + 8);
  context.restore();
}

function drawRainUmbrella(person) {
  context.fillStyle = person.player ? COLORS.yellow : person.accent || "#efc454";
  context.fillRect(-15, -31, 30, 4);
  context.fillRect(-11, -35, 22, 4);
  context.fillRect(-4, -38, 8, 3);
  context.fillStyle = "#4f5961";
  context.fillRect(0, -31, 2, 24);
  context.fillRect(0, -8, 6, 2);
}

function resolveOutfitStyle(person) {
  if (person.outfitStyle) return person.outfitStyle;
  const styles = ROLE_OUTFIT_STYLES[person.role] || ["casual-layered"];
  return styles[(person.lookIndex || 0) % styles.length];
}

function drawCharacterLegs(person, legSwing, outfitStyle) {
  if (outfitStyle === "ivory-dress") {
    context.fillStyle = person.outfitDark;
    context.fillRect(-9, 1, 18, 9);
    context.fillStyle = person.outfit;
    context.fillRect(-8, 1, 16, 8);
    context.fillStyle = person.skin;
    context.fillRect(-5 + legSwing, 10, 4, 3);
    context.fillRect(2 - legSwing, 10, 4, 3);
    context.fillStyle = person.shoeColor;
    context.fillRect(-6 + legSwing, 12, 5, 3);
    context.fillRect(2 - legSwing, 12, 5, 3);
    return;
  }
  const skirtStyles = ["school-uniform", "fashionable", "formal-bow", "civic-suit"];
  const wearsSkirt = person.bodyStyle === "feminine" && skirtStyles.includes(outfitStyle);
  if (wearsSkirt) {
    context.fillStyle = person.outfitDark;
    context.fillRect(-8, 1, 16, 6);
    context.fillStyle = person.skin;
    context.fillRect(-5 + legSwing, 7, 4, 5);
    context.fillRect(2 - legSwing, 7, 4, 5);
    context.fillStyle = outfitStyle === "school-uniform" ? COLORS.paper : "#3f4149";
    context.fillRect(-5 + legSwing, 10, 4, 3);
    context.fillRect(2 - legSwing, 10, 4, 3);
  } else {
    context.fillStyle = person.outfitDark;
    context.fillRect(-6 + legSwing, 5, 5, 8);
    context.fillRect(2 - legSwing, 5, 5, 8);
  }
  if (outfitStyle === "leather-jacket") {
    context.fillStyle = "#62606a";
    context.fillRect(-6 + legSwing, 6, 5, 7);
    context.fillRect(2 - legSwing, 6, 5, 7);
    context.fillStyle = person.outfitDark;
    context.fillRect(-8, 1, 16, 5);
  }
  if (outfitStyle === "athletic-set") {
    context.fillStyle = COLORS.paper;
    context.fillRect(-6 + legSwing, 9, 5, 3);
    context.fillRect(2 - legSwing, 9, 5, 3);
  }
  context.fillStyle = person.shoeColor || "#26333b";
  context.fillRect(-7 + legSwing, 11, 6, 4);
  context.fillRect(2 - legSwing, 11, 6, 4);
  if (outfitStyle === "leather-jacket") {
    context.fillStyle = COLORS.paper;
    context.fillRect(-7 + legSwing, 14, 6, 1);
    context.fillRect(2 - legSwing, 14, 6, 1);
    context.fillRect(-5 + legSwing, 11, 2, 2);
    context.fillRect(4 - legSwing, 11, 2, 2);
  }
}

function drawCharacterArms(person, armSwing, outfitStyle) {
  const longSleeves = [
    "school-cardigan", "cardigan", "blazer", "lab-coat", "medical-coat",
    "overalls", "formal-bow", "civic-suit", "senior-knit", "police-uniform", "fire-uniform",
    "leather-jacket", "ivory-dress",
  ].includes(outfitStyle);
  context.fillStyle = person.skin;
  context.fillRect(-11, -5 + armSwing, 4, 10);
  context.fillRect(7, -5 - armSwing, 4, 10);
  context.fillStyle = person.outfit;
  context.fillRect(-11, -6 + armSwing, 4, longSleeves ? 8 : 5);
  context.fillRect(7, -6 - armSwing, 4, longSleeves ? 8 : 5);
  if (longSleeves) {
    context.fillStyle = person.outfitDark;
    context.fillRect(-11, 1 + armSwing, 4, 2);
    context.fillRect(7, 1 - armSwing, 4, 2);
  }
}

function drawCharacterOutfit(person, outfitStyle) {
  context.fillStyle = person.outfit;
  if (person.bodyStyle === "feminine") {
    context.fillRect(-7, -8, 14, 7);
    context.fillRect(-8, -1, 16, 7);
  } else {
    context.fillRect(-8, -8, 16, 14);
  }
  context.fillStyle = person.outfitDark;
  context.fillRect(-8, 3, 16, 3);

  if (outfitStyle === "leather-jacket") {
    context.fillStyle = "#555b61";
    context.fillRect(-4, -7, 8, 9);
    context.fillStyle = person.outfit;
    context.fillRect(-8, -8, 4, 12);
    context.fillRect(4, -8, 4, 12);
    if (person.direction !== "up") {
      context.fillStyle = person.accent;
      context.fillRect(-5, -7, 2, 4);
      context.fillRect(3, -6, 2, 4);
      context.fillRect(4, -1, 1, 5);
      context.fillRect(-1, -8, 3, 1);
      context.fillRect(0, -7, 1, 2);
      context.fillRect(-1, 3, 3, 2);
    }
  } else if (outfitStyle === "ivory-dress") {
    context.fillStyle = person.outfitDark;
    context.fillRect(-7, -7, 2, 12);
    context.fillRect(5, -7, 2, 12);
    context.fillRect(-5, 2, 10, 1);
    context.fillStyle = "#fff9ec";
    context.fillRect(-4, -6, 8, 8);
  } else if (outfitStyle === "athletic-set") {
    context.fillStyle = person.outfitDark;
    context.fillRect(-8, 0, 16, 6);
    if (person.direction !== "up") {
      context.fillRect(-3, -8, 6, 2);
      context.fillRect(8, -1, 3, 2);
      context.fillStyle = person.accent;
      context.fillRect(3, -5, 2, 2);
    }
  } else if (["school-uniform", "school-cardigan"].includes(outfitStyle)) {
    context.fillStyle = COLORS.paper;
    context.fillRect(-5, -7, 4, 3);
    context.fillRect(2, -7, 4, 3);
    context.fillStyle = person.accent;
    context.fillRect(-1, -5, 3, 5);
    if (outfitStyle === "school-cardigan") {
      context.fillStyle = person.outfitDark;
      context.fillRect(-1, -8, 2, 11);
      context.fillStyle = person.accent;
      context.fillRect(2, -2, 1, 1);
      context.fillRect(2, 1, 1, 1);
    }
  } else if (["cardigan", "casual-layered", "senior-knit"].includes(outfitStyle)) {
    context.fillStyle = person.accent;
    context.fillRect(-4, -7, 8, 3);
    context.fillStyle = person.outfitDark;
    context.fillRect(-1, -4, 2, 8);
    context.fillStyle = person.accent;
    context.fillRect(2, -2, 1, 1);
    context.fillRect(2, 1, 1, 1);
    if (outfitStyle === "senior-knit") {
      context.fillRect(-6, 0, 3, 2);
      context.fillRect(3, 0, 3, 2);
    }
  } else if (["blazer", "civic-suit", "formal-bow"].includes(outfitStyle)) {
    context.fillStyle = COLORS.paper;
    context.fillRect(-4, -8, 8, 8);
    context.fillStyle = person.outfit;
    context.fillRect(-7, -8, 4, 11);
    context.fillRect(3, -8, 4, 11);
    context.fillStyle = person.outfitDark;
    context.fillRect(-3, -7, 2, 5);
    context.fillRect(1, -7, 2, 5);
    context.fillRect(-1, -2, 2, 5);
    if (outfitStyle === "civic-suit") {
      context.fillStyle = person.accent;
      context.fillRect(4, -5, 2, 2);
    }
  } else if (["lab-coat", "medical-coat"].includes(outfitStyle)) {
    context.fillStyle = COLORS.paper;
    context.fillRect(-7, -8, 14, 12);
    context.fillStyle = person.outfitDark;
    context.fillRect(-1, -8, 2, 12);
    context.strokeStyle = person.outfitDark;
    context.lineWidth = 1;
    context.strokeRect(2, -1, 4, 3);
    if (outfitStyle === "medical-coat") {
      context.fillStyle = person.accent;
      context.fillRect(-5, -5, 5, 2);
      context.fillRect(-3, -7, 2, 6);
    }
  } else if (["kitchen-uniform", "shop-apron"].includes(outfitStyle)) {
    context.fillStyle = COLORS.paper;
    context.fillRect(-6, -5, 12, 10);
    context.fillStyle = person.accent;
    context.fillRect(-5, 1, 10, 2);
    context.fillRect(-3, -3, 6, 3);
  } else if (outfitStyle === "safety-vest") {
    context.fillStyle = person.accent;
    context.fillRect(-7, -7, 14, 9);
    context.fillStyle = COLORS.paper;
    context.fillRect(-7, -2, 14, 2);
    context.fillStyle = person.outfitDark;
    context.fillRect(-1, -7, 2, 9);
  } else if (outfitStyle === "police-uniform") {
    context.fillStyle = person.outfitDark;
    context.fillRect(-8, 1, 16, 3);
    context.fillRect(-1, -8, 2, 9);
    context.fillStyle = person.accent;
    context.fillRect(3, -5, 3, 3);
    context.fillRect(-7, -7, 4, 2);
    context.fillRect(3, -7, 4, 2);
  } else if (outfitStyle === "fire-uniform") {
    context.fillStyle = person.outfitDark;
    context.fillRect(-8, 2, 16, 4);
    context.fillStyle = person.accent;
    context.fillRect(-8, -5, 16, 2);
    context.fillRect(-8, 0, 16, 2);
    context.fillStyle = COLORS.paper;
    context.fillRect(3, -8, 3, 3);
  } else if (outfitStyle === "overalls") {
    context.fillStyle = person.outfitDark;
    context.fillRect(-5, -6, 3, 5);
    context.fillRect(2, -6, 3, 5);
    context.fillRect(-6, -2, 12, 7);
    context.fillStyle = person.accent;
    context.fillRect(-2, 0, 5, 3);
  } else if (outfitStyle === "sporty") {
    context.fillStyle = person.accent;
    context.fillRect(-8, -4, 16, 3);
    context.fillRect(-2, -8, 4, 14);
  } else if (outfitStyle === "fashionable") {
    context.fillStyle = person.accent;
    context.fillRect(-7, -7, 14, 2);
    context.fillRect(-8, 1, 16, 2);
    context.fillStyle = COLORS.paper;
    context.fillRect(3, -4, 3, 3);
  } else if (outfitStyle === "adventurer") {
    context.fillStyle = person.accent;
    context.fillRect(-7, -6, 14, 3);
    context.fillRect(-2, -3, 4, 7);
  }
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
  } else if (person.hairStyle === "shoulder-length") {
    context.fillRect(-9, -23, 4, 16);
    context.fillRect(5, -23, 4, 16);
    context.fillRect(-7, -9, 4, 3);
    context.fillRect(3, -9, 4, 3);
    if (direction !== "up") context.fillRect(-4, -22, 5, 3);
  } else if (person.hairStyle === "ponytail") {
    context.fillRect(5, -22, 4, 10);
    context.fillRect(7, -15, 5, 6);
  } else if (person.hairStyle === "twin-tail") {
    context.fillRect(-10, -22, 4, 11);
    context.fillRect(6, -22, 4, 11);
    context.fillRect(-12, -15, 5, 6);
    context.fillRect(8, -15, 5, 6);
    if (direction !== "up") context.fillRect(-4, -22, 4, 3);
  } else if (person.hairStyle === "braid") {
    context.fillRect(5, -22, 4, 9);
    context.fillRect(7, -15, 5, 4);
    context.fillRect(6, -11, 5, 4);
    context.fillRect(7, -7, 4, 4);
    context.fillStyle = person.accent;
    context.fillRect(7, -4, 4, 2);
    context.fillStyle = person.hair;
  } else if (person.hairStyle === "long-high-ponytail") {
    context.fillRect(4, -28, 5, 8);
    context.fillRect(7, -25, 5, 18);
    context.fillRect(9, -10, 5, 8);
    context.fillRect(8, -3, 4, 3);
    context.fillStyle = person.outfitDark;
    context.fillRect(5, -25, 4, 2);
    context.fillStyle = person.hair;
  } else if (person.hairStyle === "high-ponytail") {
    context.fillRect(4, -27, 5, 8);
    context.fillRect(7, -24, 5, 12);
    context.fillRect(8, -14, 4, 5);
  } else if (person.hairStyle === "long-wavy") {
    context.fillRect(-9, -23, 4, 15);
    context.fillRect(5, -23, 4, 15);
    context.fillRect(-7, -10, 3, 5);
    context.fillRect(4, -10, 3, 5);
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
  } else if (person.hairStyle === "short-wave") {
    context.fillRect(-9, -24, 4, 6);
    context.fillRect(-5, -27, 5, 6);
    context.fillRect(0, -26, 5, 6);
    context.fillRect(5, -23, 4, 7);
  } else if (person.hairStyle === "wavy" || person.hairStyle === "curl") {
    context.fillRect(-9, -22, 4, 6);
    context.fillRect(5, -22, 4, 6);
    if (person.hairStyle === "curl") context.fillRect(-7, -17, 3, 5);
  }
  if (person.hairClip && direction !== "up") {
    context.fillStyle = person.hairClip;
    context.fillRect(4, -23, 4, 1);
    context.fillRect(5, -21, 3, 1);
  }
  if (person.hairAccent && direction !== "up") {
    context.fillStyle = person.hairAccent;
    context.fillRect(-4, -24, 6, 1);
    if (["long-wavy", "shoulder-length"].includes(person.hairStyle)) context.fillRect(6, -20, 1, 8);
  }
}

function drawCharacterFace(person, direction, now) {
  if (direction === "up") return;
  const facePhase = Math.floor(((now || 0) + (person.lookIndex || 0) * 173) / 90) % 67;
  const isBlinking = !reducedMotion && facePhase < 2;
  const eyeColor = person.eyeColor || "#243238";
  if (direction === "down") {
    context.fillStyle = eyeColor;
    if (isBlinking) {
      context.fillRect(-5, -18, 3, 1);
      context.fillRect(3, -18, 3, 1);
    } else {
      context.fillRect(-5, -19, 3, 3);
      context.fillRect(3, -19, 3, 3);
      context.fillStyle = COLORS.paper;
      context.fillRect(-4, -19, 1, 1);
      context.fillRect(4, -19, 1, 1);
    }
    context.fillStyle = eyeColor;
    if (["focused", "determined"].includes(person.expression)) {
      context.fillRect(-5, -21, 4, 1);
      context.fillRect(2, -21, 4, 1);
      context.fillRect(-4, -20, 2, 1);
      context.fillRect(3, -20, 2, 1);
    } else if (person.expression === "curious" || person.expression === "surprised") {
      context.fillRect(-5, -21, 3, 1);
      context.fillRect(3, -20, 3, 1);
    } else if (person.expression === "confident") {
      context.fillRect(-5, -20, 4, 1);
      context.fillRect(3, -21, 3, 1);
    } else if (person.expression === "thoughtful") {
      context.fillRect(-5, -20, 3, 1);
      context.fillRect(3, -20, 3, 1);
      context.fillRect(-5, -21, 1, 1);
    }
    if (person.makeup || ["cheerful", "gentle", "kind"].includes(person.expression)) {
      context.fillStyle = person.blushColor || "#d97d7d";
      context.fillRect(-7, -15, 2, 1);
      context.fillRect(6, -15, 2, 1);
    }
    context.fillStyle = person.makeup ? (person.lipColor || "#ad4658") : eyeColor;
    if (["happy", "kind", "gentle", "cheerful"].includes(person.expression)) {
      context.fillRect(-3, -14, 2, 1);
      context.fillRect(2, -14, 2, 1);
      context.fillRect(-1, -13, 3, 1);
    } else if (person.expression === "surprised") {
      context.fillRect(-1, -14, 3, 2);
    } else if (person.expression === "curious") {
      context.fillRect(-2, -14, 4, 1);
      context.fillRect(1, -13, 2, 1);
    } else if (person.expression === "confident") {
      context.fillRect(-3, -14, 6, 1);
      context.fillRect(1, -13, 2, 1);
    } else if (person.expression === "thoughtful") {
      context.fillRect(-2, -13, 4, 1);
      context.fillRect(2, -14, 2, 1);
    } else {
      context.fillRect(-2, -14, 5, 1);
    }
  } else {
    context.fillStyle = eyeColor;
    context.fillRect(3, isBlinking ? -18 : -19, 3, isBlinking ? 1 : 3);
    if (["focused", "determined", "confident"].includes(person.expression)) context.fillRect(3, -21, 4, 1);
    context.fillStyle = person.makeup ? (person.lipColor || "#ad4658") : eyeColor;
    context.fillRect(5, -14, 2, 1);
  }
}

function drawCharacterAccessory(person, direction, armSwing, player) {
  if (player
    && ["coffee-cup", "water-bottle"].includes(person.accessory)
    && (person.ridingBike || state.environment?.isRaining)) return;
  if (person.accessory === "coffee-cup") {
    context.fillStyle = "#bb8d61";
    context.fillRect(9, -6 - armSwing, 7, 9);
    context.fillStyle = "#e7ca9d";
    context.fillRect(9, -5 - armSwing, 7, 2);
    context.fillStyle = COLORS.paper;
    context.fillRect(8, -7 - armSwing, 9, 2);
    context.fillStyle = person.accent;
    context.fillRect(13, -12 - armSwing, 1, 6);
  } else if (person.accessory === "butterfly-pin" && direction !== "up") {
    context.fillStyle = "#625a5d";
    context.fillRect(2, -6, 2, 2);
    context.fillRect(5, -6, 2, 2);
    context.fillRect(3, -4, 1, 2);
    context.fillRect(5, -4, 1, 2);
  } else if (person.accessory === "water-bottle") {
    context.fillStyle = person.accent;
    context.fillRect(10, -3 - armSwing, 6, 9);
    context.fillStyle = "#d8eef2";
    context.fillRect(11, -1 - armSwing, 4, 4);
    context.fillStyle = "#477891";
    context.fillRect(11, -5 - armSwing, 4, 2);
  } else if (person.accessory === "book") {
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
  } else if (person.accessory === "radio") {
    context.fillStyle = person.outfitDark;
    context.fillRect(7, -7, 6, 9);
    context.fillStyle = person.accent;
    context.fillRect(9, -5, 2, 2);
    context.fillStyle = COLORS.ink;
    context.fillRect(11, -11, 1, 5);
  } else if (person.accessory === "helmet") {
    context.fillStyle = person.accent;
    context.fillRect(-9, -27, 18, 6);
    context.fillRect(-6, -31, 12, 5);
    context.fillStyle = person.outfitDark;
    context.fillRect(-10, -22, 20, 2);
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
  } else if (["briefcase", "bow-briefcase"].includes(person.accessory)) {
    if (person.accessory === "bow-briefcase") {
      context.fillStyle = COLORS.paper;
      context.fillRect(-6, -7, 5, 4);
      context.fillRect(2, -7, 5, 4);
      context.fillRect(-2, -5, 5, 7);
    }
    context.fillStyle = person.outfitDark;
    context.fillRect(9, 1 - armSwing, 10, 7);
    context.strokeStyle = person.accent;
    context.lineWidth = 2;
    context.strokeRect(12, -2 - armSwing, 5, 4);
  } else if (person.accessory === "cane") {
    context.fillStyle = "#76513a";
    context.fillRect(12, -5, 2, 17);
    context.fillRect(9, -6, 5, 2);
  } else if (person.accessory === "folder") {
    context.fillStyle = person.accent;
    context.fillRect(8, -3 - armSwing, 9, 11);
    context.fillStyle = COLORS.paper;
    context.fillRect(10, -1 - armSwing, 5, 2);
  } else if (person.accessory === "broom") {
    context.fillStyle = "#76513a";
    context.fillRect(10, -9 - armSwing, 2, 22);
    context.fillStyle = "#c79645";
    context.fillRect(7, 10 - armSwing, 9, 5);
    context.fillRect(5, 14 - armSwing, 13, 2);
  } else if (person.accessory === "package") {
    context.fillStyle = "#b77a3c";
    context.fillRect(7, -2 - armSwing, 12, 10);
    context.fillStyle = "#e4bd72";
    context.fillRect(12, -2 - armSwing, 2, 10);
    context.fillRect(7, 1 - armSwing, 12, 2);
  } else if (person.accessory === "sash") {
    context.fillStyle = COLORS.paper;
    context.fillRect(-7, -7, 3, 4);
    context.fillRect(-4, -4, 3, 4);
    context.fillRect(-1, -1, 3, 4);
    context.fillRect(2, 2, 5, 3);
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
  const facingLeft = pet.direction === "left";
  context.save();
  context.translate(Math.round(pet.x), Math.round(pet.y));
  context.scale(facingLeft ? -1 : 1, 1);
  context.fillStyle = "rgba(20, 45, 55, 0.18)";
  context.fillRect(-8, 5, 17, 4);
  context.fillStyle = pet.color;
  context.fillRect(-7, -4, 14, 9);
  context.fillRect(5, -9, 8, 8);
  context.fillRect(-11 - wag, -6, 5, 3);
  if (pet.kind === "cat") {
    context.fillRect(5, -12, 3, 4);
    context.fillRect(10, -12, 3, 4);
  } else {
    context.fillStyle = "#c85645";
    context.fillRect(-2, -6, 8, 2);
    context.fillStyle = "#4a3831";
    context.fillRect(5, -10, 3, 6);
  }
  context.fillStyle = COLORS.ink;
  context.fillRect(10, -6, 2, 2);
  context.restore();
}

function drawDogLeashes() {
  state.pets
    .filter((pet) => pet.kind === "dog" && !pet.hidden)
    .forEach((pet) => drawDogLeash(pet));
}

function drawDogLeash(pet) {
  const owner = dogOwnerFor(pet);
  if (!owner || owner.insideVenueId || owner.backgroundSimulated || owner.isCollapsed || pet.hidden) return;
  const leashDistance = Math.hypot(pet.x - owner.x, pet.y - owner.y);
  if (leashDistance > 64) return;
  const leashSide = pet.x < owner.x ? -1 : 1;
  const bodyScale = owner.ageGroup === "child" ? 0.8 : owner.ageGroup === "teen" ? 0.9 : owner.ageGroup === "senior" ? 0.96 : 1;
  const handX = owner.x + leashSide * 9 * bodyScale;
  const handY = owner.y + 2 * bodyScale;
  const collarX = pet.x + (pet.direction === "left" ? -2 : 2);
  const collarY = pet.y - 5;
  context.save();
  context.strokeStyle = "#76513a";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(Math.round(handX), Math.round(handY));
  context.lineTo(Math.round(collarX), Math.round(collarY));
  context.stroke();
  context.restore();
}

function drawBird(bird, now) {
  const flying = bird.altitude > 3;
  const wing = reducedMotion ? 0 : Math.sin(now / 90 + bird.phase) > 0 ? -3 : 2;
  const facingLeft = bird.direction === "left";
  context.save();
  context.translate(Math.round(bird.x), Math.round(bird.y - bird.altitude));
  context.scale(facingLeft ? -1 : 1, 1);
  if (!flying) {
    context.fillStyle = "rgba(20, 45, 55, 0.16)";
    context.fillRect(-5, 5, 12, 3);
  }
  context.fillStyle = bird.species === "bulbul" ? "#667064" : "#8a7358";
  context.fillRect(-5, -3, 11, 7);
  context.fillRect(4, -6, 7, 7);
  context.fillRect(-8, -1, 5, 3);
  context.fillStyle = bird.species === "bulbul" ? "#f1eee5" : "#b99a72";
  context.fillRect(5, -7, 5, 3);
  context.fillStyle = bird.species === "bulbul" ? "#222d32" : "#5b493b";
  context.fillRect(8, -4, 2, 2);
  context.fillRect(-2, wing, 7, 3);
  context.fillStyle = COLORS.yellow;
  context.fillRect(11, -3, 3, 2);
  context.restore();
}

function updateNearbyPrompt() {
  if (state.dialogueNpc) return;
  const moment = nearbyTownMoment();
  const bikeStation = nearbyBikeStation();
  const npc = nearbyNpc();
  const school = nearbySchool();
  const neighborSchool = nearbyNeighborSchool();
  const venue = nearbyVenue();
  const target = moment
    ? `moment:${moment.id}:${moment.actor.name}`
    : bikeStation
      ? `bike:${bikeStation.id}:${state.player.ridingBike ? "return" : "rent"}`
      : npc
        ? `npc:${npc.name}:${npc.currentReason}`
        : school
          ? `school:${school.fatraceSchoolId}`
          : neighborSchool
            ? `neighbor-school:${neighborSchool.fatraceSchoolId}`
          : venue
            ? `venue:${venue.id}`
            : "";
  if (target === state.lastPromptTarget) return;
  state.lastPromptTarget = target;
  refs.prompt.hidden = !target;
  const actionLead = mobileLayoutQuery.matches ? "點 A" : "按 Enter";
  refs.prompt.textContent = moment
    ? `${actionLead} ${moment.prompt}｜${moment.actor.name}`
    : bikeStation
      ? `${actionLead} 在 ${bikeStation.label}${state.player.ridingBike ? "歸還 YouBike" : "租借 YouBike｜騎乘速度更快"}`
      : npc
        ? townText(`${actionLead} 與 ${npcDisplayName(npc)}（${ROLE_LABELS[npc.role]}）對話｜${npc.currentReason}`)
        : school
          ? `${actionLead} 查看 ${school.name} ${formatDate(state.date)} 午餐`
          : neighborSchool
            ? `${actionLead} 查看 ${neighborSchool.name} ${formatDate(state.date)} 午餐`
          : venue
            ? townUsesEnglish()
              ? `${actionLead} enter ${venueDisplayLabel(venue)}`
              : `${actionLead} 進入 ${venueDisplayLabel(venue)}`
            : "";
}

function nearbyBikeStation() {
  return state.bikeStations
    .map((station) => ({ station, point: bikeStationAccessPoint(station) }))
    .map(({ station, point }) => ({
      station,
      distance: Math.hypot(state.player.x - point.x, state.player.y - point.y),
    }))
    .filter((item) => item.distance < 70)
    .sort((first, second) => first.distance - second.distance)[0]?.station || null;
}

function nearbyNpc() {
  return state.npcs
    .filter((npc) => !npc.insideVenueId && !npc.ridingBike)
    .map((npc) => ({ npc, distance: Math.hypot(state.player.x - npc.x, state.player.y - npc.y) }))
    .filter((item) => item.distance < 42)
    .sort((first, second) => first.distance - second.distance)[0]?.npc || null;
}

function nearbyVenue() {
  const nearbyBuilding = state.venues
    .filter((venue) => !venue.hubKind)
    .map((venue) => ({
      venue,
      distance: Math.hypot(state.player.x - (venue.x + venue.w / 2), state.player.y - (venue.y + venue.h + 10)),
    }))
    .filter((item) => item.distance < 52)
    .sort((first, second) => first.distance - second.distance)[0]?.venue;
  if (nearbyBuilding) return nearbyBuilding;
  const enclosingHub = state.venues.find((venue) => venue.hubKind && pointInRect(state.player, venue));
  if (enclosingHub) return enclosingHub;
  return state.venues
    .map((venue) => ({
      venue,
      distance: Math.hypot(state.player.x - (venue.x + venue.w / 2), state.player.y - (venue.y + venue.h + 10)),
    }))
    .filter((item) => item.distance < 52)
    .sort((first, second) => first.distance - second.distance)[0]?.venue || null;
}

function venueAtPoint(point, padding = 0) {
  return state.venues
    .filter((venue) => pointInExpandedRect(point, venue, padding))
    .sort((first, second) => {
      if (Boolean(first.hubKind) !== Boolean(second.hubKind)) return first.hubKind ? 1 : -1;
      return first.w * first.h - second.w * second.h;
    })[0] || null;
}

function nearbySchool() {
  return state.schools.find((school) => {
    const point = schoolGatePoint(school);
    return Math.hypot(state.player.x - point.x, state.player.y - point.y) < 58;
  }) || null;
}

function nearbyNeighborSchool() {
  return state.neighborSchools.find((school) => {
    const point = schoolGatePoint(school);
    return Math.hypot(state.player.x - point.x, state.player.y - point.y) < 58;
  }) || null;
}

function interactWithNearbyTarget() {
  if (state.townEvent) {
    announce("請先在街區事件面板選擇如何回應。 ");
    return;
  }
  const moment = nearbyTownMoment();
  if (moment) {
    resolveTownMoment();
    return;
  }
  const bikeStation = nearbyBikeStation();
  if (bikeStation) {
    interactWithBikeStation(bikeStation, "nearby_action");
    return;
  }
  const npc = nearbyNpc();
  if (npc) {
    openNpcDialogue(npc, "nearby_action");
    return;
  }
  const school = nearbySchool();
  if (school) {
    openSchool(school, "nearby_action");
    return;
  }
  const neighborSchool = nearbyNeighborSchool();
  if (neighborSchool) {
    openNeighborSchool(neighborSchool, "nearby_action");
    return;
  }
  const venue = nearbyVenue();
  if (venue) openVenue(venue, "nearby_action");
  else announce("請先走近人物、學校、街區建築或 YouBike 站，也可以直接點選目標。");
}

function interactWithBikeStation(station, method = "nearby_action") {
  if (state.townEvent) {
    announce("請先完成目前的街區事件，再使用 YouBike。");
    return;
  }
  if (state.dialogueNpc) closeNpcDialogue();
  state.keys.clear();
  state.moveTarget = null;
  state.pendingBikeStationId = "";
  const wasRidingBike = state.player.ridingBike;
  state.player.ridingBike = !state.player.ridingBike;
  state.lastPromptTarget = null;
  trackTownEvent(state.player.ridingBike ? "lunch_town_bike_rented" : "lunch_town_bike_returned", {
    district: station.district,
    method,
  });
  if (state.player.ridingBike) {
    void recordAchievementEvent("bike_rental", townAchievementInstance(`bike-${station.id}`));
  } else if (wasRidingBike) {
    void recordDailyQuestEvent("bike_return", station.id, 1, `bike_return:${station.id}`);
  }
  updateNearbyPrompt();
  canvas.focus({ preventScroll: true });
  announce(state.player.ridingBike
    ? `已在${station.label}租到 YouBike，騎乘速度已提升；請到任一 YouBike 站還車。`
    : `已在${station.label}歸還 YouBike，可以繼續步行探索。`);
}

function openVenue(venue, method = "nearby_action") {
  if (state.townEvent) {
    announce("請先完成目前的街區事件。 ");
    return;
  }
  setQuestPanelOpen(false);
  if (state.dialogueNpc) closeNpcDialogue();
  trackTownEvent("lunch_town_venue_entered", {
    district: venue.district,
    venue_type: venue.type,
    method,
  });
  void recordDailyQuestEvent("venue_visit", venue.type);
  if (venue.hubKind || venue.type === "landmark" || venue.type === "museum" || venue.type === "stadium") {
    void recordAchievementEvent("landmark_visit", venue.id);
  }
  const occupants = state.npcs.filter((npc) => venue.hubKind
    ? !npc.insideVenueId && pointInRect(npc, venue)
    : npc.insideVenueId === venue.id);
  const registeredResidents = RESIDENTIAL_VENUE_TYPES.has(venue.type)
    ? state.npcs.filter((npc) => npc.residenceVenueId === venue.id)
    : [];
  const residentNames = registeredResidents.slice(0, 6).map(npcDisplayName).join("、");
  const homeStage = venue.type === "player-home" ? venue.homeStage || PLAYER_HOME_STAGE : null;
  const homeDetails = homeStage ? `
    <div class="meal-summary"><span>目前住所</span><strong>${escapeHtml(homeStage.label)}</strong></div>
    <p class="data-note">房屋階段：${homeStage.rooms} 房。可規劃的改建方向包含${escapeHtml(homeStage.renovationPaths.join("、"))}；日後正式改建會綁定家庭帳號保存。</p>
  ` : RESIDENTIAL_VENUE_TYPES.has(venue.type)
    ? `<p class="data-note">這棟住宅已納入居民行程；居民會從這裡出門，也會在傍晚或行程結束後回家。</p>`
    : "";
  const displayLabel = venueDisplayLabel(venue);
  refs.dialogKicker.textContent = `${venue.district}・${VENUE_LABELS[venue.type] || "街區設施"}`;
  refs.dialogTitle.textContent = displayLabel;
  refs.dialogBody.innerHTML = `
    <p class="venue-description">${escapeHtml(venueDisplayDescription(venue))}</p>
    ${homeDetails}
    ${registeredResidents.length ? `<div class="meal-summary"><span>登記住戶 ${registeredResidents.length} 人</span><span>${escapeHtml(residentNames)}${registeredResidents.length > 6 ? `等 ${registeredResidents.length} 人` : ""}</span></div>` : ""}
    ${venue.specialty ? `<p class="data-note">代表小吃：${escapeHtml(venue.specialty)}。店名與場景採原創像素世界設定。</p>` : ""}
    <div class="meal-summary"><span>目前使用中 ${occupants.length} 人</span><span>${occupants.length ? escapeHtml(occupants.map(npcDisplayName).join("、")) : "現在較安靜"}</span></div>
    ${occupants.length ? `<ul class="dish-list">${occupants.map((npc) => `<li><strong>${escapeHtml(npcDisplayName(npc))}</strong><small>${escapeHtml(townText(npc.currentReason))}</small></li>`).join("")}</ul>` : ""}
    ${venue.sourceUrl ? `<a class="source-link" href="${escapeAttribute(venue.sourceUrl)}" target="_blank" rel="noreferrer">查看官方地標或美食參考來源</a>` : ""}
  `;
  refs.dialog.showModal();
  announce(townUsesEnglish() ? `Entered ${displayLabel}.` : `已進入${displayLabel}。`);
}

function openNpcDialogue(npc, method = "nearby_action") {
  setQuestPanelOpen(false);
  endAmbientConversation(performance.now(), 5_000);
  state.keys.clear();
  state.moveTarget = null;
  state.dialogueNpc = npc;
  state.dialogueStep = 0;
  const playerConversation = buildPlayerConversation(npc);
  state.dialogueLines = playerConversation.lines;
  state.dialogueTopicId = playerConversation.topicId;
  npc.activity = "greeting";
  npc.emote = "smile";
  npc.emoteUntil = performance.now() + 4_000;
  refs.prompt.hidden = true;
  refs.npcDialogue.hidden = false;
  trackTownEvent("lunch_town_npc_talked", {
    district: districtAtPoint(npc) || npc.district,
    npc_role: npc.role,
    mobility_mode: npc.mobilityMode,
    method,
  });
  void recordAchievementEvent("npc_talk", `${npc.district}:${npc.name}`);
  renderNpcDialogue();
  announce(townText(`${npc.name}（${ROLE_LABELS[npc.role]}）開始對話。`));
}

function renderNpcDialogue() {
  const npc = state.dialogueNpc;
  if (!npc) return;
  refs.npcName.textContent = npcDisplayName(npc);
  refs.npcRole.textContent = townText(`${npc.district}・${ROLE_LABELS[npc.role]}・住家：${npc.residenceLabel || "小鎮住宅"}・${npc.personality.label}・${npc.currentReason}`);
  const sourceUrl = npc.campaignSourceUrl || npc.sourceUrl;
  refs.npcSource.hidden = !sourceUrl;
  refs.npcSource.textContent = npc.role === "candidate" ? "候選人公開資料" : "公開身分來源";
  if (sourceUrl) refs.npcSource.href = sourceUrl;
  refs.npcText.textContent = state.dialogueLines[state.dialogueStep] || npc.dialogues[0];
  refs.npcNext.textContent = state.dialogueStep >= state.dialogueLines.length - 1 ? "結束對話" : "再聊一句";
}

function advanceNpcDialogue() {
  const npc = state.dialogueNpc;
  if (!npc) return;
  if (state.dialogueStep >= state.dialogueLines.length - 1) {
    closeNpcDialogue();
    return;
  }
  state.dialogueStep += 1;
  npc.emote = state.dialogueStep % 2 ? "note" : "smile";
  npc.emoteUntil = performance.now() + 2_400;
  renderNpcDialogue();
}

function closeNpcDialogue() {
  if (state.dialogueNpc && state.dialogueTopicId) {
    rememberConversation({
      pairKey: `player|${state.dialogueNpc.name}`,
      topicId: state.dialogueTopicId,
      relationship: "visitor",
      endedAt: performance.now(),
    });
    state.dialogueNpc.activity = "waiting";
  }
  state.dialogueNpc = null;
  state.dialogueStep = 0;
  state.dialogueLines = [];
  state.dialogueTopicId = "";
  refs.npcDialogue.hidden = true;
  state.lastPromptTarget = null;
  updateNearbyPrompt();
  canvas.focus({ preventScroll: true });
}

function buildPlayerConversation(npc) {
  if (npc.featuredResident && ROLE_DIALOGUES[npc.role]?.length) {
    const dialogue = ROLE_DIALOGUES[npc.role];
    const start = npc.dialogueCursor % dialogue.length;
    npc.dialogueCursor = (start + 1) % dialogue.length;
    return {
      topicId: `resident-${npc.role}`,
      lines: Array.from({ length: 3 }, (_, index) => dialogue[(start + index) % dialogue.length]),
    };
  }
  if (npc.role === "candidate") {
    return {
      topicId: "civic-campaign",
      lines: [
        npc.campaignAppeal,
        "你可以查看我的公開資料，也比較每位候選人的資訊後再自己決定。",
        "謝謝你停下來聽我說，記得以選舉委員會公布的正式資訊為準。",
      ],
    };
  }
  const now = performance.now();
  pruneConversationMemory(now);
  const recentTopics = new Set(state.conversationMemory
    .filter((memory) => memory.pairKey === `player|${npc.name}`)
    .map((memory) => memory.topicId));
  const topicId = selectConversationTopic(npc, npc, recentTopics, now);
  const context = {
    topicId,
    relationship: "visitor",
    relationshipLabel: "第一次見面",
    location: nearestLocationLabel(npc),
    hour: Number(state.environment?.clock?.hour ?? 12),
    timeLabel: Number(state.environment?.clock?.hour ?? 12) < 12 ? "早上" : "今天",
    isRaining: Boolean(state.environment?.isRaining),
    firstActivity: npc.activity,
    secondActivity: "exploring",
    rumor: latestTownRumor(districtAtPoint(npc) || npc.district),
  };
  const turns = buildDailyTopicTurns(topicId, npc, npc, context);
  const lineCount = Math.max(2, Math.min(4, npc.personality.turnCount));
  const lines = turns.slice(0, lineCount).map((turn) => turn.text);
  if (hashText(`${npc.name}-${topicId}`) % 5 === 0 && ROLE_DIALOGUES[npc.role]?.length) {
    lines[lines.length - 1] = ROLE_DIALOGUES[npc.role][npc.dialogueCursor % ROLE_DIALOGUES[npc.role].length];
    npc.dialogueCursor = (npc.dialogueCursor + 1) % ROLE_DIALOGUES[npc.role].length;
  }
  return { topicId, lines };
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

function openNeighborSchool(school, method = "nearby_action") {
  void openSchool(school, method);
}

async function openSchool(school, method = "nearby_action") {
  if (state.townEvent) {
    announce("請先完成目前的街區事件。 ");
    return;
  }
  setQuestPanelOpen(false);
  if (state.dialogueNpc) closeNpcDialogue();
  const id = String(school.fatraceSchoolId);
  if (school.mapScope !== "neighbor-county") {
    state.visited.add(id);
    void recordAchievementEvent("school_visit", id);
    refreshSchoolListIfRendered();
    updateProgress();
  }
  refs.dialogKicker.textContent = `${school.city}・${school.district}・${formatDate(state.date)}`;
  refs.dialogTitle.textContent = school.name;
  refs.dialogBody.innerHTML = '<p class="empty-meal">正在讀取學校午餐資料…</p>';
  if (!refs.dialog.open) refs.dialog.showModal();
  announce(`正在查看 ${school.name} 午餐。`);
  try {
    const dashboard = await loadSchoolMeal(school, state.date);
    renderMeal(dashboard, school);
    trackTownEvent("lunch_town_school_viewed", {
      school_id: id,
      district: school.district,
      menu_date: state.date,
      method,
      data_status: dashboard.record?.status === "available" ? "available" : "not_available",
    });
  } catch (error) {
    console.warn(error);
    refs.dialogBody.innerHTML = '<p class="empty-meal">目前無法讀取這間學校的午餐資料，請稍後再試。</p>';
    trackTownEvent("lunch_town_school_viewed", {
      school_id: id,
      district: school.district,
      menu_date: state.date,
      method,
      data_status: "error",
    });
  }
}

function trackTownEvent(name, params = {}) {
  if (state.townMapPreview.active) return;
  window.ProductAnalytics?.event(name, params);
}

async function loadSchoolMeal(school, date) {
  const endpoint = `/api/dashboard?schoolId=${encodeURIComponent(school.fatraceSchoolId)}&date=${encodeURIComponent(date)}&mealType=meat`;
  try {
    const response = await fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`午餐 API 回傳 ${response.status}`);
    const payload = await response.json();
    return { record: payload.record ?? payload.officialRecord ?? null, sourceUrl: payload.sourceUrl || payload.record?.source?.url || "" };
  } catch (apiError) {
    const response = await fetch(`/data/school-meals/${encodeURIComponent(school.fatraceSchoolId)}.json`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw apiError;
    const payload = await response.json();
    const record = payload.records?.[date] || null;
    return { record, sourceUrl: record?.source?.url || school.sourceUrl || "" };
  }
}

function schoolHasCurrentMeal(school) {
  return Array.isArray(school?.recordDates) && school.recordDates.includes(state.date);
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
        <li class="daily-dish-row">
          <div><strong>${escapeHtml(dish.name || "未命名菜色")}</strong><small>${escapeHtml(dish.category || "午餐菜色")}</small></div>
          <button class="daily-dish-pick" type="button" data-daily-dish="school-${escapeAttribute(school.fatraceSchoolId)}" data-dish-name="${escapeAttribute(dish.name || "這道菜")}" aria-pressed="false">今天想吃</button>
        </li>
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

function placePlayerAtHome() {
  const home = state.venues.find((venue) => venue.id === state.player.homeVenueId);
  if (!home) {
    placePlayerAtGate(state.schools.find((school) => school.district === "西區") || state.schools[0]);
    return;
  }
  state.player.x = home.x + home.w / 2;
  state.player.y = home.y + home.h + 14;
  state.player.direction = "up";
}

function placePlayerAtTownMapPreview() {
  if (!state.townMapPreview.active || !state.townMapPreview.focus) return;
  const { city, district, placementId } = state.townMapPreview.focus;
  const target = state.venues.find((venue) => (
    venue.editorManaged && venue.city === city && venue.district === district
      && (!placementId || venue.townMapPlacementId === placementId)
  ));
  if (target) {
    state.player.x = target.x + target.w / 2;
    state.player.y = target.y + target.h + 14;
    state.player.direction = "up";
    return;
  }
  const zone = districtZoneForName(district);
  if (!zone) return;
  state.player.x = zone.x + zone.w * 0.34;
  state.player.y = zone.y + zone.h * 0.71;
  state.player.direction = "down";
}

function schoolGatePoint(school) {
  const { x, y, w, h, gate } = school.layout;
  return { x: x + w / 2, y: gate === "south" ? y + h : y };
}

function updateProgress() {
  refs.progress.textContent = `本次 ${state.visited.size} / ${state.schools.length}`;
}

function canvasPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * WIDTH / bounds.width + state.camera.x,
    y: (event.clientY - bounds.top) * HEIGHT / bounds.height + state.camera.y,
  };
}

function canvasWorldUnitsForCssPixels(cssPixels) {
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width) return cssPixels;
  return cssPixels * WIDTH / bounds.width;
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

function pointInExpandedRect(point, rect, padding) {
  return point.x >= rect.x - padding
    && point.x <= rect.x + rect.w + padding
    && point.y >= rect.y - padding
    && point.y <= rect.y + rect.h + padding;
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
