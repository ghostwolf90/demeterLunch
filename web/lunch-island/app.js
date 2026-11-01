const CITY_ORDER = ["臺中市", "臺南市"];
const DEFAULT_MEAL_DATE = "2026-10-30";
const SHOWCASE_CITY = "臺中市";
const SHOWCASE_DISTRICT = "西區";
const CAMPUS_TYPES = ["中庭環繞型", "都會緊湊型", "一字教學型", "多棟分散型", "鄉村開放型", "現代複合型"];
const CHARACTER_ROLES = [
  { role: "校長", group: "行政團隊", actions: ["巡視校園", "前往行政大樓"], destinations: ["行政大樓", "教學大樓"] },
  { role: "導師", group: "教學團隊", actions: ["準備午餐時間", "返回教室"], destinations: ["教學大樓", "午餐廣場"] },
  { role: "科任老師", group: "教學團隊", actions: ["前往下一堂課", "整理教學用品"], destinations: ["教學大樓", "圖書館"] },
  { role: "營養師", group: "午餐與健康", actions: ["確認今日菜單", "前往廚房"], destinations: ["廚房與餐廳", "午餐廣場"] },
  { role: "廚房人員", group: "午餐與健康", actions: ["準備供餐動線", "確認餐點地標"], destinations: ["廚房與餐廳", "午餐廣場"] },
  { role: "行政人員", group: "行政團隊", actions: ["處理校務文件", "前往教學大樓"], destinations: ["行政大樓", "教學大樓"] },
  { role: "圖書館員", group: "閱讀與資源", actions: ["整理閱讀空間", "前往圖書館"], destinations: ["圖書館", "教學大樓"] },
  { role: "體育老師", group: "體育與活動", actions: ["查看活動場地", "準備體育器材"], destinations: ["活動中心", "操場"] },
  { role: "校務人員", group: "校園維護", actions: ["查看校園設施", "整理戶外空間"], destinations: ["生態花園", "行政大樓"] },
  { role: "警衛", group: "校園服務", actions: ["巡視校門", "確認訪客動線"], destinations: ["校門", "行政大樓"] },
  { role: "送貨人員", group: "訪客與物流", actions: ["前往卸貨區", "離開校園"], destinations: ["廚房與餐廳", "校門"] },
  { role: "訪客", group: "訪客與物流", actions: ["前往行政大樓", "沿參訪路線移動"], destinations: ["行政大樓", "校門"] },
];
const PET_PROFILES = [
  { species: "校園貓", names: ["橘子", "小灰", "花卷", "豆花"], personalities: ["好奇但慢熟", "喜歡曬太陽", "安靜觀察型"], spots: ["生態花園", "圖書館旁", "午餐廣場邊緣"], actions: ["沿花圃散步", "找一處陽光休息", "遠遠觀察校園動靜"] },
  { species: "校園犬", names: ["米糕", "栗子", "阿福", "奶茶"], personalities: ["親人又有精神", "溫和慢步調", "喜歡巡視四周"], spots: ["校門附近", "活動中心旁", "生態花園"], actions: ["慢慢巡視校園", "前往熟悉的休息處", "在走廊旁散步"] },
];

const refs = {
  app: document.querySelector("#islandApp"),
  canvas: document.querySelector("#islandCanvas"),
  islandLabels: document.querySelector("#islandLabels"),
  navigator: document.querySelector("#islandNavigator"),
  mobileListButton: document.querySelector("#mobileListButton"),
  breadcrumbs: document.querySelector("#breadcrumbs"),
  islandSearch: document.querySelector("#islandSearch"),
  overviewCityTabs: document.querySelector("#overviewCityTabs"),
  dateControl: document.querySelector("#dateControl"),
  mealDate: document.querySelector("#mealDate"),
  listFilters: document.querySelector("#listFilters"),
  navigatorSummary: document.querySelector("#navigatorSummary"),
  exploreList: document.querySelector("#exploreList"),
  sceneKicker: document.querySelector("#sceneKicker"),
  sceneTitle: document.querySelector("#sceneTitle"),
  sceneCount: document.querySelector("#sceneCount"),
  homeViewButton: document.querySelector("#homeViewButton"),
  resetCameraButton: document.querySelector("#resetCameraButton"),
  peopleMotionButton: document.querySelector("#peopleMotionButton"),
  loadingOverlay: document.querySelector("#loadingOverlay"),
  loadingTitle: document.querySelector("#loadingTitle"),
  loadingDetail: document.querySelector("#loadingDetail"),
  detailPanel: document.querySelector("#detailPanel"),
  detailClose: document.querySelector("#detailClose"),
  detailCategory: document.querySelector("#detailCategory"),
  detailTitle: document.querySelector("#detailTitle"),
  detailBody: document.querySelector("#detailBody"),
  webglFallback: document.querySelector("#webglFallback"),
  announcement: document.querySelector("#selectionAnnouncement"),
};

const state = {
  view: "showcase",
  schools: [],
  preferredCity: CITY_ORDER[0],
  city: null,
  district: null,
  school: null,
  date: DEFAULT_MEAL_DATE,
  dashboard: null,
  scene: null,
  sceneReady: false,
  mealRequestId: 0,
  listItems: [],
  listFilter: "all",
  searchQuery: "",
  peopleMotion: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
};

async function init() {
  const startedAt = performance.now();
  bindInterface();
  try {
    const [schools, sceneModule, accountPreference] = await Promise.all([
      loadSchools(),
      import("./scene.js"),
      loadAccountPreference(),
    ]);
    state.schools = schools
      .filter((school) => CITY_ORDER.includes(school.city))
      .sort(compareSchools);
    if (!state.schools.length) throw new Error("學校名冊沒有臺中市或臺南市國小");
    state.date = preferredDate(state.schools) || DEFAULT_MEAL_DATE;
    const defaultSchool = state.schools.find((school) => Number(school.fatraceSchoolId) === Number(accountPreference?.defaultSchoolId));
    state.preferredCity = defaultSchool?.city || CITY_ORDER[0];

    try {
      state.scene = new sceneModule.LunchIslandScene(refs.canvas, {
        onSelect: handleItemSelection,
        onHover: handleSceneHover,
        labelLayer: refs.islandLabels,
      });
      state.sceneReady = true;
    } catch (error) {
      console.warn("3D scene unavailable", error);
      refs.webglFallback.hidden = false;
      refs.canvas.hidden = true;
    }

    showCities();
    refs.app.setAttribute("aria-busy", "false");
    requestAnimationFrame(() => refs.loadingOverlay.classList.add("is-ready"));
    console.info(`Lunch islands ready in ${Math.round(performance.now() - startedAt)} ms`);
  } catch (error) {
    console.error(error);
    refs.loadingTitle.textContent = "午餐群島暫時無法建立";
    refs.loadingDetail.textContent = error instanceof Error ? error.message : "讀取資料時發生錯誤";
    refs.navigatorSummary.innerHTML = "<strong>資料讀取失敗</strong><span>請確認本機伺服器已啟動後重新整理。</span>";
    refs.app.setAttribute("aria-busy", "false");
  }
}

function bindInterface() {
  refs.homeViewButton.addEventListener("click", () => {
    closeDetail({ resetFollow: true });
    state.city = SHOWCASE_CITY;
    state.district = SHOWCASE_DISTRICT;
    state.school = null;
    state.scene?.resetCamera("showcase");
  });
  refs.resetCameraButton.addEventListener("click", () => state.scene?.resetCamera());
  refs.peopleMotionButton.addEventListener("click", () => {
    state.peopleMotion = !state.peopleMotion;
    refs.peopleMotionButton.setAttribute("aria-pressed", String(state.peopleMotion));
    refs.peopleMotionButton.setAttribute("aria-label", state.peopleMotion ? "暫停校園角色" : "繼續校園角色");
    refs.peopleMotionButton.title = state.peopleMotion ? "暫停校園角色" : "繼續校園角色";
    state.scene?.setPeopleMotion(state.peopleMotion);
  });
  refs.peopleMotionButton.setAttribute("aria-pressed", String(state.peopleMotion));
  refs.peopleMotionButton.setAttribute("aria-label", state.peopleMotion ? "暫停校園角色" : "繼續校園角色");
  refs.peopleMotionButton.title = state.peopleMotion ? "暫停校園角色" : "繼續校園角色";
  refs.islandSearch.addEventListener("input", () => {
    state.searchQuery = refs.islandSearch.value.trim();
    renderList(state.listItems, { preserveItems: true });
  });
  refs.overviewCityTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-overview-city]");
    if (!button) return;
    showDistricts(button.dataset.overviewCity);
  });
  refs.listFilters.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-list-filter]");
    if (!button) return;
    state.listFilter = button.dataset.listFilter;
    refs.listFilters.querySelectorAll("button").forEach((candidate) => {
      candidate.setAttribute("aria-pressed", String(candidate === button));
    });
    renderList(state.listItems, { preserveItems: true });
  });
  refs.detailClose.addEventListener("click", () => closeDetail({ resetFollow: true }));
  refs.mealDate.addEventListener("change", () => {
    state.date = refs.mealDate.value;
    closeDetail();
    if (state.view === "showcase") showShowcase({ preserveSearch: true, preserveDate: true });
    if (state.view === "districts" && state.city) showDistricts(state.city, { preserveSearch: true });
    if (state.view === "schools") showSchools(state.district, { preserveDate: true });
    if (state.view === "meal" && state.school) showMeal(state.school, { preserveDate: true });
  });
  refs.mobileListButton.addEventListener("click", () => {
    const open = !document.body.classList.contains("is-list-open");
    document.body.classList.toggle("is-list-open", open);
    refs.mobileListButton.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("pointerdown", (event) => {
    if (!document.body.classList.contains("is-list-open")) return;
    if (refs.navigator.contains(event.target) || refs.mobileListButton.contains(event.target)) return;
    closeMobileList();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!refs.detailPanel.hidden) closeDetail({ resetFollow: true });
    else if (state.scene?.isFollowing()) state.scene.stopFollowing(true);
    else closeMobileList();
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

async function loadAccountPreference() {
  try {
    const response = await fetch("/api/account", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function loadDashboard(schoolId, date) {
  const endpoint = `/api/dashboard?schoolId=${encodeURIComponent(schoolId)}&date=${encodeURIComponent(date)}&mealType=meat`;
  try {
    const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`午餐 API 回傳 ${response.status}`);
    const payload = await response.json();
    const record = payload.record ?? payload.officialRecord ?? null;
    return {
      ...payload,
      selectedDate: payload.selectedDate || payload.requestedDate || date,
      record,
      availableDates: payload.availableDates || payload.school?.recordDates || [],
      sourceUrl: payload.sourceUrl || record?.source?.url || payload.school?.sourceUrl || "",
    };
  } catch (apiError) {
    try {
      const response = await fetch(`/data/school-meals/${encodeURIComponent(schoolId)}.json`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`午餐快照回傳 ${response.status}`);
      const payload = await response.json();
      const records = payload.records || {};
      const school = state.schools.find((item) => Number(item.fatraceSchoolId) === Number(schoolId));
      return {
        school,
        selectedDate: date,
        requestedDate: date,
        record: records[date] || null,
        records,
        availableDates: Object.keys(records).sort(),
        isMissing: !records[date],
        sourceUrl: records[date]?.source?.url || school?.sourceUrl || "",
      };
    } catch (snapshotError) {
      console.warn("School meal API and snapshot both failed", { apiError, snapshotError });
      throw snapshotError;
    }
  }
}

function showCities() {
  showShowcase();
}

function showShowcase({ preserveSearch = false, preserveDate = false } = {}) {
  state.view = "showcase";
  state.city = SHOWCASE_CITY;
  state.district = SHOWCASE_DISTRICT;
  state.school = null;
  state.dashboard = null;
  state.listFilter = "all";
  if (!preserveSearch) resetSearch();
  closeDetail();

  const schools = state.schools
    .filter((school) => school.city === SHOWCASE_CITY && school.district === SHOWCASE_DISTRICT)
    .sort(compareSchools);
  const dates = unique(schools.flatMap((school) => school.recordDates || [])).sort().reverse();
  if (!preserveDate || !dates.includes(state.date)) {
    state.date = dates.includes(DEFAULT_MEAL_DATE) ? DEFAULT_MEAL_DATE : dates[0] || DEFAULT_MEAL_DATE;
  }
  const schoolItems = schools.map((school, index) => ({
    kind: "school",
    id: String(school.fatraceSchoolId),
    label: school.name,
    city: school.city,
    district: school.district,
    school,
    campusType: CAMPUS_TYPES[index % CAMPUS_TYPES.length],
    visualType: index,
    status: (school.recordDates || []).includes(state.date) ? "available" : "missing",
  }));
  const characterItems = createShowcaseCharacterRoster(schools);
  const petItems = createShowcasePetRoster(schools);
  const availableCount = schoolItems.filter((item) => item.status === "available").length;

  refs.overviewCityTabs.hidden = true;
  updateSceneText(
    "臺中市・西區示範島",
    "先把一座島做好",
    `${schoolItems.length} 間國小・${characterItems.length} 位模擬角色・${petItems.length} 隻校園小動物`,
  );
  updateSummary(
    "西區示範島",
    `以 ${formatDate(state.date)} 資料呈現，${availableCount}/${schoolItems.length} 間學校已有菜單；拖曳與縮放可直接看完整細節。`,
  );
  renderBreadcrumbs([
    { label: "午餐群島", action: showCities },
    { label: "臺中市西區示範島", action: showCities },
  ]);
  renderDateControl(dates);
  renderList([...schoolItems, ...characterItems, ...petItems]);
  refs.peopleMotionButton.hidden = false;
  state.scene?.setContent("showcase", schoolItems, {
    city: SHOWCASE_CITY,
    district: SHOWCASE_DISTRICT,
    date: state.date,
    characters: characterItems,
    pets: petItems,
  });
  state.scene?.setPeopleMotion(state.peopleMotion);
  announce(`臺中市西區示範島已建立，共有${schoolItems.length}間國小與${characterItems.length}位虛構模擬角色。`);
}

function showDistricts(city, { preserveSearch = false } = {}) {
  state.view = "districts";
  state.city = city;
  state.preferredCity = city;
  state.district = null;
  state.school = null;
  state.dashboard = null;
  state.listFilter = "all";
  if (!preserveSearch) resetSearch();
  closeDetail();
  const citySchools = state.schools.filter((school) => school.city === city);
  const districtNames = unique(citySchools.map((school) => school.district)).sort(localeCompare);
  const items = districtNames.map((district) => {
    const schools = citySchools.filter((school) => school.district === district);
    return {
      kind: "district",
      id: `${city}-${district}`,
      label: district,
      city,
      district,
      schoolCount: schools.length,
      status: "available",
    };
  });
  const characterItems = createDistrictCharacterRoster(city, items);
  const petItems = createDistrictPetRoster(city, items);
  const schoolItems = citySchools.map((school) => ({
    kind: "school",
    id: String(school.fatraceSchoolId),
    label: school.name,
    city: school.city,
    district: school.district,
    school,
    campusType: campusTypeForSchool(school),
    status: (school.recordDates || []).includes(state.date) ? "available" : "missing",
  }));
  const dates = unique(citySchools.flatMap((school) => school.recordDates || [])).sort().reverse();
  refs.overviewCityTabs.hidden = false;
  refs.overviewCityTabs.querySelectorAll("button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.overviewCity === city));
  });
  updateSceneText(city.replace("市", "群島"), "拖曳、縮放，直接走進島嶼", `${items.length} 個行政區・${citySchools.length} 間國小・不切換場景`);
  updateSummary(`${city}連續群島`, "縮放即可看見島上校舍與設施；點選只會聚焦並開啟資料，不會跳到另一個畫面。");
  renderBreadcrumbs([
    { label: "午餐群島", action: showCities },
    { label: city, action: () => showDistricts(city) },
  ]);
  renderDateControl(dates);
  renderList([...items, ...schoolItems, ...characterItems, ...petItems]);
  refs.peopleMotionButton.hidden = false;
  state.scene?.setContent("districts", items, { city, schools: schoolItems, characters: characterItems, pets: petItems });
  state.scene?.setPeopleMotion(state.peopleMotion);
  announce(`進入${city}，共有${items.length}個行政區與${characterItems.length}位模擬人物。`);
}

function showSchools(district, { preserveDate = false } = {}) {
  state.view = "schools";
  state.district = district;
  state.school = null;
  state.dashboard = null;
  state.listFilter = "all";
  resetSearch();
  closeDetail();
  refs.overviewCityTabs.hidden = true;
  const schools = state.schools.filter((school) => school.city === state.city && school.district === district);
  const dates = unique(schools.flatMap((school) => school.recordDates || [])).sort().reverse();
  if (!preserveDate || !dates.includes(state.date)) state.date = dates.includes(DEFAULT_MEAL_DATE) ? DEFAULT_MEAL_DATE : dates[0] || DEFAULT_MEAL_DATE;
  const items = schools.map((school) => ({
    kind: "school",
    id: String(school.fatraceSchoolId),
    label: school.name,
    city: school.city,
    district: school.district,
    school,
    campusType: campusTypeForSchool(school),
    status: (school.recordDates || []).includes(state.date) ? "available" : "missing",
  }));
  const availableCount = items.filter((item) => item.status === "available").length;
  updateSceneText(`${state.city}・${district}`, "選一棟學校建築", `${formatDate(state.date)}・${availableCount}/${items.length} 間已有資料`);
  updateSummary(`${district}的國小`, `綠色建築表示 ${formatDate(state.date)} 已取得菜單；灰色僅表示目前沒有該日資料。`);
  renderBreadcrumbs([
    { label: "午餐群島", action: showCities },
    { label: state.city, action: () => showDistricts(state.city) },
    { label: district, action: () => showSchools(district, { preserveDate: true }) },
  ]);
  renderDateControl(dates);
  renderList(items);
  state.scene?.setContent("schools", items, { city: state.city, district, date: state.date });
  announce(`進入${state.city}${district}，共有${items.length}間國小。`);
}

async function showMeal(school, { preserveDate = false } = {}) {
  const requestId = ++state.mealRequestId;
  state.view = "meal";
  state.school = school;
  state.listFilter = "all";
  resetSearch();
  closeDetail();
  refs.overviewCityTabs.hidden = true;
  const dates = [...(school.recordDates || [])].sort().reverse();
  if (!preserveDate && !dates.includes(state.date)) state.date = dates.includes(DEFAULT_MEAL_DATE) ? DEFAULT_MEAL_DATE : dates[0] || state.date;
  renderBreadcrumbs([
    { label: "午餐群島", action: showCities },
    { label: state.city, action: () => showDistricts(state.city) },
    { label: state.district, action: () => showSchools(state.district, { preserveDate: true }) },
    { label: school.name, action: () => showMeal(school, { preserveDate: true }) },
  ]);
  renderDateControl(dates);
  updateSceneText(`${state.city}・${state.district}`, school.name, `${formatDate(state.date)}・正在讀取午餐`);
  updateSummary(school.name, `正在取得 ${formatDate(state.date)} 的官方午餐紀錄…`);
  renderList([]);
  showStageLoading(`正在前往${school.name}`, `只載入這間學校 ${formatDate(state.date)} 的午餐資料`);

  try {
    const dashboard = await loadDashboard(school.fatraceSchoolId, state.date);
    if (requestId !== state.mealRequestId || state.school !== school || state.date !== dashboard.selectedDate) return;
    state.dashboard = dashboard;
    const meal = selectLunchMeal(dashboard.record);
    const dishes = meal?.dishes || [];
    const dishItems = dishes.map((dish, index) => ({
      kind: "dish",
      id: String(dish.dishId || `${school.fatraceSchoolId}-${state.date}-${index}`),
      label: dish.name || `餐點 ${index + 1}`,
      category: dish.category || "餐點",
      dish,
      status: "available",
    }));
    const characterItems = createCharacterRoster(school);
    const petItems = createPetRoster(school);
    const items = [...dishItems, ...characterItems, ...petItems];
    const petStatus = petItems.length ? `・${petItems.length} 隻偶遇小動物` : "";
    const statusText = dishItems.length ? `${dishItems.length} 道菜・${characterItems.length} 位模擬人物${petStatus}` : `尚無餐點・${characterItems.length} 位模擬人物${petStatus}`;
    updateSceneText(`${state.city}・${state.district}`, school.name, `${formatDate(state.date)}・${statusText}`);
    updateSummary(
      dishItems.length ? `${formatDate(state.date)} 午餐與校園` : `${formatDate(state.date)} 校園模擬`,
      dishItems.length ? "點選餐點地標、校園人物或偶遇小動物查看詳細資料。" : "沒有用其他日期代替；校園人物與小動物皆為虛構模擬角色。",
    );
    renderList(items);
    state.scene?.setContent("meal", dishItems, { city: state.city, school, date: state.date, hasMeal: Boolean(meal), characters: characterItems, pets: petItems });
    state.scene?.setPeopleMotion(state.peopleMotion);
    announce(dishItems.length ? `${school.name}${formatDate(state.date)}共有${dishItems.length}道菜、${characterItems.length}位模擬人物${petItems.length ? `與${petItems.length}隻偶遇小動物` : ""}。` : `${school.name}${formatDate(state.date)}尚無菜單，校園角色為虛構模擬。`);
  } catch (error) {
    console.error(error);
    state.dashboard = null;
    updateSceneText(`${state.city}・${state.district}`, school.name, `${formatDate(state.date)}・資料讀取失敗`);
    updateSummary("無法讀取午餐資料", "請確認本機伺服器仍在執行，再重新選擇這間學校。");
    const characterItems = createCharacterRoster(school);
    const petItems = createPetRoster(school);
    renderList([...characterItems, ...petItems]);
    state.scene?.setContent("meal", [], { city: state.city, school, date: state.date, hasMeal: false, characters: characterItems, pets: petItems });
    state.scene?.setPeopleMotion(state.peopleMotion);
  } finally {
    if (requestId === state.mealRequestId) hideStageLoading();
  }
}

function handleItemSelection(item) {
  if (!item) return;
  if (item.kind === "city") showDistricts(item.city);
  if (item.kind === "district") {
    state.city = item.city;
    state.district = item.district;
    state.school = null;
    state.scene?.focusItem(item, { radius: 4.4 });
    showDistrictDetail(item);
  }
  if (item.kind === "school") {
    state.district = item.district;
    state.scene?.focusItem(item, { radius: 2.7 });
    showSchoolDetail(item);
  }
  if (item.kind === "dish") {
    state.scene?.stopFollowing(true);
    showDishDetail(item);
  }
  if (item.kind === "person") {
    showPersonDetail(item);
    state.scene?.followCharacter(item);
  }
  if (item.kind === "pet") {
    showPetDetail(item);
    state.scene?.followCharacter(item);
  }
  closeMobileList();
}

function handleSceneHover(item) {
  refs.canvas.setAttribute("aria-label", item ? `午餐群島 3D 場景，目前指向${item.label}` : "午餐群島 3D 探索場景");
}

function renderList(items, { preserveItems = false } = {}) {
  if (!preserveItems) state.listItems = items;
  const hasCharacters = state.listItems.some((item) => item.kind === "person" || item.kind === "pet");
  const availableKinds = new Set(state.listItems.map((item) => item.kind));
  refs.listFilters.querySelectorAll("button[data-list-filter]").forEach((button) => {
    const filter = button.dataset.listFilter;
    button.hidden = filter !== "all" && !availableKinds.has(filter);
  });
  if (state.listFilter !== "all" && !availableKinds.has(state.listFilter)) {
    state.listFilter = "all";
    refs.listFilters.querySelectorAll("button").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.listFilter === "all"));
    });
  }
  refs.listFilters.hidden = state.listItems.length === 0;
  refs.peopleMotionButton.hidden = !((state.view === "meal" && hasCharacters) || state.view === "districts" || state.view === "showcase");
  const visibleItems = state.listFilter === "all"
    ? state.listItems
    : state.listItems.filter((item) => item.kind === state.listFilter);
  const query = state.searchQuery.toLocaleLowerCase("zh-Hant");
  const searchedItems = query
    ? visibleItems.filter((item) => [item.label, item.city, item.district, item.category, item.roleLabel, item.species, item.group]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase("zh-Hant").includes(query)))
    : visibleItems;
  refs.exploreList.replaceChildren();
  searchedItems.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "explore-item";
    button.dataset.kind = item.kind;
    button.dataset.status = item.status || "available";

    const label = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = item.label;
    const description = document.createElement("small");
    description.textContent = itemDescription(item);
    label.append(title, description);

    const trailing = document.createElement("span");
    trailing.textContent = itemTrailing(item);
    button.append(label, trailing);
    button.addEventListener("click", () => handleItemSelection(item));
    refs.exploreList.append(button);
  });
  if (!searchedItems.length) {
    const empty = document.createElement("p");
    empty.className = "explore-empty";
    empty.textContent = "沒有符合的探索項目";
    refs.exploreList.append(empty);
  }
}

function itemDescription(item) {
  if (item.kind === "city") return `${item.districtCount} 個行政區`;
  if (item.kind === "district") return `${state.view === "overview" ? `${item.city}・` : ""}${item.schoolCount} 間國小`;
  if (item.kind === "school") {
    const status = item.status === "available" ? `${formatDate(state.date)} 已取得菜單` : `${formatDate(state.date)} 未取得資料`;
    return `${item.campusType}・${status}`;
  }
  if (item.kind === "dish") {
    const count = item.dish.ingredients?.length || 0;
    return count ? `校方公布 ${count} 項食材` : "校方未提供食材明細";
  }
  if (item.kind === "person") return `${item.group}・${item.currentAction}`;
  if (item.kind === "pet") return `${item.species}・${item.personality}・${item.currentAction}`;
  return "";
}

function itemTrailing(item) {
  if (item.kind === "city") return `${item.schoolCount} 校`;
  if (item.kind === "district") return "聚焦";
  if (item.kind === "school") return item.status === "available" ? "看資料" : "聚焦";
  if (item.kind === "dish") return item.category || "餐點";
  if (item.kind === "person") return item.roleLabel;
  if (item.kind === "pet") return item.species;
  return "";
}

function renderBreadcrumbs(crumbs) {
  refs.breadcrumbs.replaceChildren();
  crumbs.forEach((crumb, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = crumb.label;
    button.disabled = index === crumbs.length - 1;
    if (!button.disabled) button.addEventListener("click", crumb.action);
    refs.breadcrumbs.append(button);
  });
}

function renderDateControl(dates) {
  refs.mealDate.replaceChildren();
  if (!dates.length) {
    refs.dateControl.hidden = true;
    return;
  }
  refs.dateControl.hidden = false;
  dates.forEach((date) => {
    const option = document.createElement("option");
    option.value = date;
    option.textContent = formatDate(date, true);
    option.selected = date === state.date;
    refs.mealDate.append(option);
  });
}

function updateSceneText(kicker, title, count) {
  refs.sceneKicker.textContent = kicker;
  refs.sceneTitle.textContent = title;
  refs.sceneCount.textContent = count;
}

function updateSummary(title, description) {
  refs.navigatorSummary.replaceChildren();
  const strong = document.createElement("strong");
  strong.textContent = title;
  const span = document.createElement("span");
  span.textContent = description;
  refs.navigatorSummary.append(strong, span);
}

function showDistrictDetail(item) {
  const schools = state.schools
    .filter((school) => school.city === item.city && school.district === item.district)
    .sort(compareSchools);
  const availableCount = schools.filter((school) => (school.recordDates || []).includes(state.date)).length;
  refs.detailCategory.textContent = `${item.city}・行政區島嶼`;
  refs.detailTitle.textContent = item.label;
  refs.detailBody.innerHTML = `
    <dl class="detail-meta">
      <dt>國小數量</dt><dd>${schools.length} 間</dd>
      <dt>所選日期</dt><dd>${escapeHtml(formatDate(state.date, true))}</dd>
      <dt>已有資料</dt><dd>${availableCount} 間</dd>
      <dt>觀看方式</dt><dd>繼續滾動縮放即可看見校舍與島上設施</dd>
    </dl>
    <p>${escapeHtml(schools.slice(0, 8).map((school) => school.name).join("、"))}${schools.length > 8 ? `等 ${schools.length} 間國小` : ""}</p>
    <p>島嶼外觀是依行政區固定產生的視覺識別，不代表面積、人口、學校規模或午餐品質。</p>
  `;
  refs.detailPanel.hidden = false;
  refs.detailClose.focus({ preventScroll: true });
  announce(`已聚焦${item.city}${item.label}，場景沒有切換。`);
}

async function showSchoolDetail(item) {
  const requestId = ++state.mealRequestId;
  const school = item.school;
  state.school = school;
  state.dashboard = null;
  refs.detailCategory.textContent = `${school.city}・${school.district}・學校建築`;
  refs.detailTitle.textContent = school.name;
  refs.detailBody.innerHTML = `
    <dl class="detail-meta">
      <dt>校園類型</dt><dd>${escapeHtml(item.campusType)}</dd>
      <dt>供餐日期</dt><dd>${escapeHtml(formatDate(state.date, true))}</dd>
      <dt>場景狀態</dt><dd>已在原群島中聚焦，沒有切換畫面</dd>
    </dl>
    <p>正在讀取這間學校的當日午餐資料…</p>
  `;
  refs.detailPanel.hidden = false;
  refs.detailClose.focus({ preventScroll: true });

  try {
    const dashboard = await loadDashboard(school.fatraceSchoolId, state.date);
    if (requestId !== state.mealRequestId || state.school !== school) return;
    state.dashboard = dashboard;
    const meal = selectLunchMeal(dashboard.record);
    const dishes = meal?.dishes || [];
    refs.detailBody.innerHTML = `
      <dl class="detail-meta">
        <dt>完整校名</dt><dd>${escapeHtml(school.fullName || school.name)}</dd>
        <dt>校園類型</dt><dd>${escapeHtml(item.campusType)}</dd>
        <dt>供餐日期</dt><dd>${escapeHtml(formatDate(state.date, true))}</dd>
        <dt>午餐資料</dt><dd>${dishes.length ? `${dishes.length} 道菜` : "當日尚未取得"}</dd>
      </dl>
      ${dishes.length
    ? `<ul class="ingredient-list">${dishes.map((dish) => `<li>${escapeHtml(dish.name || "未命名餐點")}</li>`).join("")}</ul>`
    : "<p>沒有用其他日期的菜單代替。當日資料可能仍在校方公布時段內陸續上傳。</p>"}
      ${dashboard.sourceUrl ? `<a class="source-link" href="${escapeAttribute(dashboard.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看教育部校園食材登錄平臺來源</a>` : ""}
    `;
    announce(`已載入${school.name}${formatDate(state.date)}的午餐資料，場景維持原位。`);
  } catch (error) {
    console.warn("School detail unavailable", error);
    if (requestId !== state.mealRequestId || state.school !== school) return;
    refs.detailBody.innerHTML = `
      <dl class="detail-meta">
        <dt>校園類型</dt><dd>${escapeHtml(item.campusType)}</dd>
        <dt>供餐日期</dt><dd>${escapeHtml(formatDate(state.date, true))}</dd>
      </dl>
      <p>目前無法讀取午餐資料；3D 群島仍可繼續拖曳與縮放探索。</p>
    `;
  }
}

function showDishDetail(item) {
  const dish = item.dish;
  const ingredients = dish.ingredients || [];
  const dashboard = state.dashboard;
  const meal = selectLunchMeal(dashboard?.record);
  refs.detailCategory.textContent = item.category || "餐點";
  refs.detailTitle.textContent = item.label;
  refs.detailBody.innerHTML = `
    <dl class="detail-meta">
      <dt>學校</dt><dd>${escapeHtml(state.school?.fullName || state.school?.name || "—")}</dd>
      <dt>供餐日期</dt><dd>${escapeHtml(formatDate(state.date, true))}</dd>
      <dt>供餐單位</dt><dd>${escapeHtml(meal?.kitchenName || "校方未提供")}</dd>
      <dt>食材資料</dt><dd>${ingredients.length ? `${ingredients.length} 項校方紀錄` : "校方未提供明細"}</dd>
    </dl>
    ${ingredients.length ? `<ul class="ingredient-list">${ingredients.map((ingredient) => `<li>${escapeHtml(ingredient.name || ingredient.standardName || "未命名食材")}</li>`).join("")}</ul>` : "<p>菜色名稱不能用來推定完整食材、過敏原、製程或交叉接觸；嚴重過敏仍應向校方確認。</p>"}
    ${dashboard?.sourceUrl ? `<a class="source-link" href="${escapeAttribute(dashboard.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看教育部校園食材登錄平臺來源</a>` : ""}
  `;
  refs.detailPanel.hidden = false;
  refs.detailClose.focus({ preventScroll: true });
  announce(`已開啟${item.label}詳細資料。`);
}

function showPersonDetail(item) {
  refs.detailCategory.textContent = "虛構校園角色";
  refs.detailTitle.textContent = item.label;
  refs.detailBody.innerHTML = `
    <dl class="detail-meta">
      <dt>角色性質</dt><dd>程序生成的虛構模擬人物</dd>
      <dt>職務類型</dt><dd>${escapeHtml(item.roleLabel)}</dd>
      <dt>工作群組</dt><dd>${escapeHtml(item.group)}</dd>
      <dt>目前行動</dt><dd>${escapeHtml(item.currentAction)}</dd>
      <dt>目的地</dt><dd>${escapeHtml(item.destinationLabel)}</dd>
      <dt>模擬時段</dt><dd>${escapeHtml(item.scheduleLabel)}</dd>
    </dl>
    <p class="follow-note">鏡頭跟隨中；可拖曳場景、按 Escape 或關閉資料卡退出跟隨。</p>
    <p>這個人物用來呈現校園動線與空間使用，不是真實教職員、訪客或即時位置，也沒有使用學校人員名冊。</p>
  `;
  refs.detailPanel.hidden = false;
  refs.detailClose.focus({ preventScroll: true });
  announce(`已開啟${item.label}的虛構角色資料。`);
}

function showPetDetail(item) {
  refs.detailCategory.textContent = "虛構校園小動物";
  refs.detailTitle.textContent = item.label;
  refs.detailBody.innerHTML = `
    <dl class="detail-meta">
      <dt>角色性質</dt><dd>程序生成的虛構偶遇角色</dd>
      <dt>種類</dt><dd>${escapeHtml(item.species)}</dd>
      <dt>個性</dt><dd>${escapeHtml(item.personality)}</dd>
      <dt>常出沒地點</dt><dd>${escapeHtml(item.favoriteSpot)}</dd>
      <dt>目前行動</dt><dd>${escapeHtml(item.currentAction)}</dd>
      <dt>前往方向</dt><dd>${escapeHtml(item.destinationLabel)}</dd>
      <dt>出現頻率</dt><dd>${escapeHtml(item.scheduleLabel)}</dd>
    </dl>
    <p class="follow-note">鏡頭跟隨中；可拖曳場景、按 Escape 或關閉資料卡退出跟隨。</p>
    <p>這隻小動物是用來增添校園探索感的虛構角色，不代表學校真的飼養或出現這隻動物，也不是即時位置資訊。</p>
  `;
  refs.detailPanel.hidden = false;
  refs.detailClose.focus({ preventScroll: true });
  announce(`已開啟${item.label}的虛構小動物資料。`);
}

function closeDetail({ resetFollow = false } = {}) {
  refs.detailPanel.hidden = true;
  if (resetFollow) state.scene?.stopFollowing(true);
}

function showStageLoading(title, detail) {
  refs.loadingTitle.textContent = title;
  refs.loadingDetail.textContent = detail;
  refs.loadingOverlay.classList.remove("is-ready");
}

function hideStageLoading() {
  requestAnimationFrame(() => refs.loadingOverlay.classList.add("is-ready"));
}

function closeMobileList() {
  document.body.classList.remove("is-list-open");
  refs.mobileListButton.setAttribute("aria-expanded", "false");
}

function resetSearch() {
  state.searchQuery = "";
  refs.islandSearch.value = "";
}

function selectLunchMeal(record) {
  if (!record) return null;
  const meals = record.meals || record.services?.flatMap((service) => service.meals || []) || [];
  return meals.find((meal) => meal.serviceLabel === "午餐" || meal.menuTypeName === "午餐") || meals[0] || null;
}

function campusTypeForSchool(school) {
  return CAMPUS_TYPES[hashString(String(school.fatraceSchoolId || school.fullName || school.name)) % CAMPUS_TYPES.length];
}

function createCharacterRoster(school) {
  const compact = window.matchMedia("(max-width: 820px), (pointer: coarse)").matches;
  const count = compact ? 16 : 26;
  const seed = hashString(`${school.fatraceSchoolId}:${school.fullName}`);
  return Array.from({ length: count }, (_, index) => {
    const role = CHARACTER_ROLES[(seed + index * 7) % CHARACTER_ROLES.length];
    const roleNumber = 1 + Math.floor(index / CHARACTER_ROLES.length);
    const action = role.actions[(seed + index * 3) % role.actions.length];
    const destination = role.destinations[(seed + index * 5) % role.destinations.length];
    return {
      kind: "person",
      id: `sim-${school.fatraceSchoolId}-${index + 1}`,
      label: `${role.role} ${String(roleNumber).padStart(2, "0")}`,
      roleLabel: role.role,
      group: role.group,
      currentAction: action,
      destinationLabel: destination,
      scheduleLabel: "午餐時段模擬",
      simulated: true,
      routeSeed: seed + index * 31,
      colorSeed: seed + index * 17,
      expressionSeed: seed + index * 23,
      speed: 0.55 + ((seed + index * 11) % 35) / 100,
      status: "available",
    };
  });
}

function createShowcaseCharacterRoster(schools) {
  const compact = window.matchMedia("(max-width: 820px), (pointer: coarse)").matches;
  const count = compact ? 20 : 36;
  const seed = hashString(`showcase:${SHOWCASE_CITY}:${SHOWCASE_DISTRICT}`);
  return Array.from({ length: count }, (_, index) => {
    const role = CHARACTER_ROLES[(seed + index * 7) % CHARACTER_ROLES.length];
    const destination = schools[(seed + index * 5) % Math.max(schools.length, 1)];
    return {
      kind: "person",
      id: `sim-showcase-${index + 1}`,
      label: `${role.role} ${String(index + 1).padStart(2, "0")}`,
      roleLabel: role.role,
      group: role.group,
      currentAction: role.actions[(seed + index * 3) % role.actions.length],
      destinationLabel: destination?.name || "中央午餐廣場",
      scheduleLabel: "西區示範島午餐時段模擬",
      simulated: true,
      routeSeed: seed + index * 31,
      colorSeed: seed + index * 17,
      expressionSeed: seed + index * 23,
      speed: 0.18 + ((seed + index * 11) % 15) / 100,
      scale: compact ? 0.82 : 0.9,
      status: "available",
    };
  });
}

function createShowcasePetRoster(schools) {
  const compact = window.matchMedia("(max-width: 820px), (pointer: coarse)").matches;
  const count = compact ? 2 : 3;
  const seed = hashString(`showcase-pets:${SHOWCASE_CITY}:${SHOWCASE_DISTRICT}`);
  return Array.from({ length: count }, (_, index) => {
    const profile = PET_PROFILES[index % PET_PROFILES.length];
    const destination = schools[(seed + index * 5) % Math.max(schools.length, 1)];
    return {
      kind: "pet",
      id: `sim-showcase-pet-${index + 1}`,
      label: profile.names[(seed + index * 3) % profile.names.length],
      species: profile.species,
      personality: profile.personalities[(seed + index * 5) % profile.personalities.length],
      favoriteSpot: `${destination?.name || "中央廣場"}旁的綠地`,
      currentAction: profile.actions[(seed + index * 7) % profile.actions.length],
      destinationLabel: destination?.name || "生態花園",
      scheduleLabel: "偶爾出現的西區示範島模擬",
      simulated: true,
      routeSeed: seed + index * 29,
      colorSeed: seed + index * 19,
      speed: 0.15 + ((seed + index * 13) % 10) / 100,
      scale: compact ? 0.76 : 0.84,
      status: "available",
    };
  });
}

function createDistrictCharacterRoster(city, districts) {
  const compact = window.matchMedia("(max-width: 820px), (pointer: coarse)").matches;
  const count = compact ? 24 : 52;
  const seed = hashString(`district-characters:${city}`);
  return Array.from({ length: count }, (_, index) => {
    const role = CHARACTER_ROLES[(seed + index * 7) % CHARACTER_ROLES.length];
    const destination = districts[(seed + index * 5) % districts.length];
    return {
      kind: "person",
      id: `sim-city-${city}-${index + 1}`,
      label: `${role.role} ${String(index + 1).padStart(2, "0")}`,
      roleLabel: role.role,
      group: role.group,
      currentAction: role.actions[(seed + index * 3) % role.actions.length],
      destinationLabel: destination?.label || "行政區橋樑",
      scheduleLabel: "縣市群島巡遊模擬",
      simulated: true,
      routeSeed: seed + index * 31,
      colorSeed: seed + index * 17,
      expressionSeed: seed + index * 23,
      speed: 0.24 + ((seed + index * 11) % 18) / 100,
      scale: compact ? 0.6 : 0.66,
      status: "available",
    };
  });
}

function createDistrictPetRoster(city, districts) {
  const compact = window.matchMedia("(max-width: 820px), (pointer: coarse)").matches;
  const count = compact ? 1 : 2;
  const seed = hashString(`district-pets:${city}`);
  return Array.from({ length: count }, (_, index) => {
    const profile = PET_PROFILES[(seed + index) % PET_PROFILES.length];
    const destination = districts[(seed + index * 7) % districts.length];
    return {
      kind: "pet",
      id: `sim-city-pet-${city}-${index + 1}`,
      label: profile.names[(seed + index * 3) % profile.names.length],
      species: profile.species,
      personality: profile.personalities[(seed + index * 5) % profile.personalities.length],
      favoriteSpot: `${destination?.label || city}校園周邊`,
      currentAction: profile.actions[(seed + index * 11) % profile.actions.length],
      destinationLabel: destination?.label || "行政區橋樑",
      scheduleLabel: "偶爾出現的縣市群島模擬",
      simulated: true,
      routeSeed: seed + index * 29,
      colorSeed: seed + index * 19,
      speed: 0.3 + ((seed + index * 13) % 16) / 100,
      scale: compact ? 0.64 : 0.72,
      status: "available",
    };
  });
}

function createPetRoster(school) {
  const seed = hashString(`pet:${school.fatraceSchoolId}:${school.fullName}`);
  const appearanceRoll = ((seed ^ (seed >>> 16)) >>> 0) % 100;
  if (appearanceRoll >= 48) return [];
  const count = seed % 17 === 0 ? 2 : 1;
  return Array.from({ length: count }, (_, index) => {
    const profile = PET_PROFILES[(seed + index) % PET_PROFILES.length];
    const name = profile.names[(seed + index * 3) % profile.names.length];
    const favoriteSpot = profile.spots[(seed + index * 5) % profile.spots.length];
    return {
      kind: "pet",
      id: `sim-pet-${school.fatraceSchoolId}-${index + 1}`,
      label: name,
      species: profile.species,
      personality: profile.personalities[(seed + index * 7) % profile.personalities.length],
      favoriteSpot,
      currentAction: profile.actions[(seed + index * 11) % profile.actions.length],
      destinationLabel: favoriteSpot,
      scheduleLabel: "偶爾出現的校園模擬",
      simulated: true,
      routeSeed: seed + index * 29,
      colorSeed: seed + index * 19,
      speed: 0.34 + ((seed + index * 13) % 18) / 100,
      status: "available",
    };
  });
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function preferredDate(schools) {
  const dates = schools.flatMap((school) => school.recordDates || []);
  if (dates.includes(DEFAULT_MEAL_DATE)) return DEFAULT_MEAL_DATE;
  return dates.sort().at(-1) || null;
}

function compareSchools(first, second) {
  const cityDifference = CITY_ORDER.indexOf(first.city) - CITY_ORDER.indexOf(second.city);
  if (cityDifference) return cityDifference;
  const districtDifference = localeCompare(first.district, second.district);
  return districtDifference || localeCompare(first.name, second.name);
}

function localeCompare(first = "", second = "") {
  return first.localeCompare(second, "zh-Hant");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function formatDate(date, includeYear = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return date || "未選日期";
  const [year, month, day] = date.split("-").map(Number);
  return includeYear ? `${year} 年 ${month} 月 ${day} 日` : `${month} 月 ${day} 日`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function announce(message) {
  refs.announcement.textContent = "";
  requestAnimationFrame(() => { refs.announcement.textContent = message; });
}

init();
