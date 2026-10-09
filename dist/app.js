const savedMealType = window.localStorage.getItem("demeter-meal-type");
const savedGradeGroup = window.localStorage.getItem("demeter-grade-group");
const savedStandardMode = window.localStorage.getItem("demeter-standard-mode");
const savedFavoriteSchoolId = Number(window.localStorage.getItem("demeter-favorite-school-id"));
const DEFAULT_SCHOOL_ID = 193609;
const state = {
  dashboard: null,
  loading: false,
  staticData: null,
  schoolId: null,
  favoriteSchoolId: Number.isInteger(savedFavoriteSchoolId) ? savedFavoriteSchoolId : null,
  schoolDirectory: [],
  district: null,
  newsLoaded: false,
  mealType: savedMealType === "vegetarian" ? "vegetarian" : "meat",
  gradeGroup: savedGradeGroup === "elementary_upper" ? "elementary_upper" : "elementary_lower",
  standardMode: savedStandardMode === "transitional" ? "transitional" : "target",
  dishDetails: [],
  activeDishIndex: -1,
  lastDishTrigger: null,
  dishDetailOpenFrame: 0,
  dishDetailCloseTimer: 0,
  sourceImageRequestId: 0,
};

const DISH_DETAIL_MOTION_MS = 360;
const DISH_DETAIL_REDUCED_MOTION_MS = 160;

const roleLabels = {
  staple: "主食", main: "主菜", side_1: "副菜一", side_2: "副菜二",
  side_3: "副菜三", vegetable: "青菜", soup: "湯品", fruit: "水果", drink: "飲品",
};

const claimLabels = {
  initial_processed_non_gmo: "初級加工／非基改",
  local: "在地",
  safe_vegetable: "安全蔬菜標示",
  organic_text: "原表註明有機",
};

const traceabilityStatusLabels = {
  verified: "同日官方資料",
  matched_reference: "歷史來源參考",
  menu_claim: "菜單原表標示",
  unavailable: "來源待補",
};

const ids = [
  "dashboard", "syncStatus", "syncStatusText", "todayLabel", "mealMoment", "heroDish", "introNote", "mainDish", "mealList",
  "allergenRow", "calories", "nutritionBars", "dinnerTitle", "dinnerPicks",
  "dinnerReason", "dinnerNotes", "disclaimer", "weekLabel", "weekDays",
  "previousWeek", "nextWeek", "averageCalories", "averageVegetables",
  "fruitDays", "fruitDaysContext", "friedDays", "friedDaysContext", "proteinBars", "calorieChart", "trendRange",
  "insightsKicker", "selectionAnnouncement",
  "sourceArticle", "openSource", "archiveList", "errorState", "errorMessage",
  "sourceDialog", "closeSource", "dialogTitle", "sourceImageStage", "sourceImageStatus",
  "sourceImageStatusText", "sourceImage", "downloadSource",
  "educationCategory", "educationIngredient", "educationTitle", "educationFact", "educationPrompt", "educationSource",
  "recipeInspired", "recipeTitle", "recipeMeta", "recipePreview", "recipeDetails",
  "recipeIngredients", "recipeSteps", "recipeAllergens", "recipeNote",
  "latestNews", "newsUpdated", "traceabilityStatus", "traceabilityNotice",
  "traceabilitySummary", "traceabilityDishes", "traceabilitySource",
  "mealTypeMeat", "mealTypeVegetarian", "mealTypeNote", "openDetail",
  "dishCount", "mainDishButton", "dishDetailDialog", "closeDishDetail",
  "dishDetailRole", "dishDetailTitle", "dishDetailCount", "dishDetailIngredients",
  "dishDetailNote", "previousDish", "nextDish",
  "gradeLower", "gradeUpper", "standardTarget", "standardTransitional",
  "standardPeriod", "standardBasis", "standardDescription", "standardSummary",
  "standardMetrics", "standardGuidance", "standardObservations", "standardMethod",
  "standardCoverage", "standardSource", "standardRevision",
  "districtSelect", "schoolSelect", "favoriteSchoolButton", "schoolDataScope", "brandSchoolLabel", "footerSource",
  "mealTypeSwitch", "menuBoard", "menuKicker", "menuHeading", "reviewBadge",
  "officialSourceLink", "nutritionCard", "dinnerCard", "standard", "learn",
  "week", "todayGrid", "traceability", "news", "insights", "source", "traceabilityKicker", "traceabilityHeading",
];
const refs = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function loadingState(message) {
  const status = node("div", "loading-state");
  status.setAttribute("role", "status");
  const spinner = node("span", "loading-spinner");
  spinner.setAttribute("aria-hidden", "true");
  status.append(spinner, node("span", "", message));
  return status;
}

function setDashboardStatus(status, message) {
  refs.syncStatus.classList.remove("ready", "is-loading", "is-error");
  refs.syncStatus.classList.add(status === "ready" ? "ready" : `is-${status}`);
  refs.syncStatusText.textContent = message;
  refs.dashboard.setAttribute("aria-busy", String(status === "loading"));
}

function localIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value, options = {}) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("zh-TW", {
    month: "long", day: "numeric", ...options,
  }).format(new Date(year, month - 1, day));
}

function compactDate(value) {
  const [, month, day] = value.split("-").map(Number);
  return `${month}/${day}`;
}

function formatNewsDate(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric", month: "long", day: "numeric",
  }).format(date);
}

function isLocalApiAvailable() {
  return window.location.protocol.startsWith("http") &&
    ["127.0.0.1", "localhost"].includes(window.location.hostname);
}

function dashboardFromStatic(data, selectedDate, mealType) {
  const variant = data.variants[mealType];
  const official = data.officialSchoolMeals || { schools: [], records: {} };
  const school = official.schools.find((item) => Number(item.fatraceSchoolId) === DEFAULT_SCHOOL_ID);
  const exact = variant.days.find((day) => day.date === selectedDate);
  const earlier = variant.days.filter((day) => day.date <= selectedDate);
  const active = exact || earlier.at(-1) || variant.days[0];
  return {
    viewMode: "detailed",
    school,
    schoolDirectory: official.schools,
    officialRecord: official.records?.[String(DEFAULT_SCHOOL_ID)]?.[active.date] || null,
    selected: active,
    mealType,
    mealTypeLabel: mealType === "meat" ? "葷食" : "素食",
    availableMealTypes: ["meat", "vegetarian"],
    requestedDate: selectedDate,
    isFallback: !exact,
    week: variant.days.filter((day) => day.weekId === active.weekId),
    nutritionStandard: data.nutritionStandard,
    nutritionAssessments: variant.nutritionAssessments?.[active.date],
    dinnerSuggestion: variant.dinnerSuggestions[active.date],
    foodEducation: variant.foodEducation[active.date],
    homeRecipe: variant.homeRecipes[active.date],
    traceability: variant.traceability?.[active.date],
    insights: variant.insights,
    archive: variant.archive,
    dateRange: variant.dateRange,
    totalDays: variant.totalDays,
  };
}

function officialDashboardFromStatic(data, selectedDate, schoolId, mealType) {
  const catalog = data.officialSchoolMeals;
  if (!catalog) throw new Error("公開版資料尚未包含跨校午餐紀錄");
  const school = catalog.schools.find((item) => Number(item.fatraceSchoolId) === Number(schoolId));
  if (!school) throw new Error(`找不到學校代碼：${schoolId}`);
  const record = catalog.records?.[String(schoolId)]?.[selectedDate] || null;
  const sourceUrl = `https://fatraceschool.k12ea.gov.tw/frontend/search.html?school=${encodeURIComponent(schoolId)}&period=${encodeURIComponent(selectedDate)}`;
  return {
    viewMode: "officialDaily",
    school,
    schoolDirectory: catalog.schools,
    requestedDate: selectedDate,
    selectedDate,
    record,
    records: catalog.records?.[String(schoolId)] || {},
    isMissing: !record,
    availableDates: school.recordDates || [],
    dateRange: school.dateRange,
    totalDays: school.recordCount || 0,
    sourceUrl: record?.source?.url || sourceUrl,
    mealType,
    mealTypeLabel: mealType === "vegetarian" ? "素食" : "葷食",
    dataNotice: "教育部校園食材登錄平臺的當日或歷史實際供餐公開紀錄；若同時出現葷、素主菜，本站依菜名的「素」字拆分主菜與副菜，其他分類列為共用。",
  };
}

async function fetchDashboard(date) {
  if (!state.schoolId) throw new Error("請先選擇學校");
  if (isLocalApiAvailable()) {
    try {
      const response = await fetch(`/api/dashboard?date=${encodeURIComponent(date)}&mealType=${encodeURIComponent(state.mealType)}&schoolId=${encodeURIComponent(state.schoolId)}`, { cache: "no-store" });
      const isJson = response.headers.get("content-type")?.includes("application/json");
      if (response.ok && isJson) return await response.json();
    } catch (error) {
      console.info("Local API unavailable; using the static data snapshot.", error);
    }
  }
  if (!state.staticData) {
    const response = await fetch("./data/site-data.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`無法讀取公開版資料（HTTP ${response.status}）`);
    state.staticData = await response.json();
  }
  return state.schoolId === DEFAULT_SCHOOL_ID
    ? dashboardFromStatic(state.staticData, date, state.mealType)
    : officialDashboardFromStatic(state.staticData, date, state.schoolId, state.mealType);
}

async function fetchSchoolDirectory() {
  const endpoint = isLocalApiAvailable() ? "/api/schools" : "./data/schools.json";
  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) throw new Error(`無法讀取學校名冊（HTTP ${response.status}）`);
  const payload = await response.json();
  if (!Array.isArray(payload.schools)) throw new Error("學校名冊格式不正確");
  return payload.schools;
}

async function fetchNews() {
  const endpoint = isLocalApiAvailable() ? "/api/news" : "./data/news.json";
  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) throw new Error(`無法讀取午餐觀察（HTTP ${response.status}）`);
  return response.json();
}

function newsCard(item) {
  const article = node("article", "news-preview-card card");
  const meta = node("div", "news-meta");
  meta.append(
    node("span", `news-tag${item.isLocal ? " local" : ""}`, item.isLocal ? "臺中優先" : item.category),
    node("time", "", formatNewsDate(item.publishedAt)),
  );
  const title = node("h3");
  const link = node("a", "", item.title);
  link.href = item.url;
  link.target = "_blank";
  link.rel = "noreferrer";
  title.append(link);
  article.append(
    meta,
    title,
    node("p", "news-why", item.whyItMatters),
    node("span", "news-source", `${item.sourceType} · ${item.source}`),
  );
  return article;
}

async function loadNewsPreview() {
  refs.latestNews.setAttribute("aria-busy", "true");
  refs.latestNews.replaceChildren(loadingState("正在整理近期午餐消息…"));
  refs.newsUpdated.textContent = "正在讀取近期消息…";
  try {
    const payload = await fetchNews();
    const items = Array.isArray(payload.items) ? payload.items.slice(0, 2) : [];
    refs.latestNews.replaceChildren(...items.map(newsCard));
    if (!items.length) {
      refs.latestNews.append(node("p", "news-empty", "近 30 天暫時沒有符合條件的消息。"));
    }
    refs.newsUpdated.textContent = `最近更新：${formatNewsDate(payload.generatedAt)} · 僅整理近 ${payload.lookbackDays || 30} 天`;
  } catch (error) {
    refs.latestNews.replaceChildren(node("p", "news-empty", "近期消息暫時讀取不到，午餐菜單仍可正常使用。"));
    refs.newsUpdated.textContent = "新聞資料暫時無法更新";
  } finally {
    state.newsLoaded = true;
    refs.latestNews.setAttribute("aria-busy", "false");
  }
}

function renderMeal(day) {
  if (refs.dishDetailDialog.open) {
    state.lastDishTrigger = null;
    closeDishDetail({ immediate: true });
  }
  refs.mainDish.textContent = day.meal.mainDish;
  refs.heroDish.textContent = day.meal.mainDish;
  refs.mealList.replaceChildren();
  const sourceDishes = Array.isArray(day.recipeDetails) ? day.recipeDetails : [];
  const detailedRoles = new Set(sourceDishes.map((dish) => dish.role));
  const supplementalItems = [
    !detailedRoles.has("fruit") && day.meal.fruit
      ? { label: "水果", value: day.meal.fruit }
      : null,
    !detailedRoles.has("drink") && day.meal.drink
      ? { label: "飲品", value: day.meal.drink }
      : null,
  ].filter(Boolean);
  state.dishDetails = sourceDishes;
  state.activeDishIndex = -1;
  refs.dishCount.textContent = sourceDishes.length
    ? supplementalItems.length
      ? `菜單共 ${sourceDishes.length + supplementalItems.length} 道 · 其中 ${sourceDishes.length} 道可查看食材與設計用量`
      : `本餐共 ${sourceDishes.length} 道 · 點選菜色查看食材與設計用量`
    : "菜色依午餐總表校讀";

  const mainDishIndex = sourceDishes.findIndex((dish) => dish.role === "main");
  refs.mainDishButton.disabled = mainDishIndex < 0;
  refs.mainDishButton.setAttribute(
    "aria-label",
    mainDishIndex >= 0 ? `查看主菜「${day.meal.mainDish}」的食材與設計用量` : "這餐主角",
  );
  refs.mainDishButton.onclick = mainDishIndex >= 0
    ? () => openDishDetail(mainDishIndex, refs.mainDishButton)
    : null;

  const items = sourceDishes.length
    ? [
      ...sourceDishes
        .filter((dish) => dish.role !== "main")
        .map((dish) => ({ label: roleLabels[dish.role] || "配菜", value: dish.name, dish })),
      ...supplementalItems,
    ]
    : [
      { label: "主食", value: day.meal.staple },
      ...day.meal.sideDishes.map((dish, index) => ({ label: `配菜 ${index + 1}`, value: dish })),
      { label: "湯品", value: day.meal.soup },
      { label: day.meal.drink ? "飲品" : "水果", value: day.meal.drink || day.meal.fruit },
    ].filter(({ value }) => value);
  for (const { label, value, dish } of items) {
    const item = node(dish ? "button" : "div", "meal-item");
    if (dish) {
      const dishIndex = sourceDishes.indexOf(dish);
      item.type = "button";
      item.setAttribute("aria-label", `查看${label}「${value}」的食材與設計用量`);
      item.addEventListener("click", () => openDishDetail(dishIndex, item));
    }
    item.append(node("span", "", label), node("strong", "", value));
    refs.mealList.append(item);
  }
  refs.allergenRow.textContent = day.allergens.length
    ? `原圖標示／菜名可辨識的過敏原：${day.allergens.join("、")}`
    : "過敏原資訊請仍以校方原始菜單與個人需求核對。";
}

function ingredientQuantity(ingredient) {
  if (ingredient.officialRecord) return "官方未提供用量";
  return ingredient.quantityText || [
    ingredient.quantityValue,
    ingredient.quantityUnit,
  ].filter((value) => value !== null && value !== undefined).join(" ") || "未標示";
}

function renderDishDetail() {
  const dish = state.dishDetails[state.activeDishIndex];
  if (!dish) return;
  const ingredients = Array.isArray(dish.ingredients) ? dish.ingredients : [];
  refs.dishDetailRole.textContent = dish.category || roleLabels[dish.role] || "菜色";
  refs.dishDetailTitle.textContent = dish.name;
  refs.dishDetailCount.textContent = `食譜明細共 ${ingredients.length} 項`;
  refs.dishDetailIngredients.replaceChildren();

  if (!ingredients.length) {
    refs.dishDetailIngredients.append(node("p", "dish-detail-empty", "這道菜的食材明細尚未提供。"));
  }
  for (const ingredient of ingredients) {
    const row = node("article", "dish-detail-ingredient");
    const heading = node("div", "dish-detail-ingredient-heading");
    heading.append(
      node("strong", "", ingredient.name),
      node("span", "", ingredientQuantity(ingredient)),
    );
    const badges = node("div", "ingredient-source-badges");
    if (ingredient.officialRecord) {
      for (const certification of ingredient.certifications || []) {
        badges.append(node("span", "ingredient-trace verified", certification.name));
      }
      if (!(ingredient.certifications || []).length) {
        badges.append(node("span", "ingredient-trace unavailable", "未提供標章"));
      }
    } else {
      for (const claim of ingredient.claims || []) {
        badges.append(node("span", `source-claim ${claim}`, claimLabels[claim] || claim));
      }
      const status = ingredient.traceabilityStatus || "unavailable";
      badges.append(node(
        "span",
        `ingredient-trace ${status}`,
        traceabilityStatusLabels[status] || traceabilityStatusLabels.unavailable,
      ));
    }
    row.append(heading, badges);
    refs.dishDetailIngredients.append(row);
  }

  refs.dishDetailNote.textContent = dish.officialRecord
    ? "食材名稱、產地、供應商與標章照教育部當日公開紀錄呈現；官方頁面沒有提供每人用量。"
    : state.mealType === "vegetarian"
    ? "素食菜單可能含蛋、奶；用量為供餐廠商的食譜設計值，不代表實際攝取量。"
    : "用量為供餐廠商的食譜設計值，不代表實際攝取量。";
  refs.previousDish.disabled = state.activeDishIndex === 0;
  refs.nextDish.disabled = state.activeDishIndex === state.dishDetails.length - 1;
  const previous = state.dishDetails[state.activeDishIndex - 1];
  const next = state.dishDetails[state.activeDishIndex + 1];
  refs.previousDish.setAttribute("aria-label", previous ? `查看上一道：${previous.name}` : "已是第一道菜");
  refs.nextDish.setAttribute("aria-label", next ? `查看下一道：${next.name}` : "已是最後一道菜");
}

function openDishDetail(index, trigger) {
  if (!state.dishDetails[index]) return;
  state.activeDishIndex = index;
  state.lastDishTrigger = trigger || document.activeElement;
  renderDishDetail();
  if (refs.dishDetailDialog.open) return;

  window.clearTimeout(state.dishDetailCloseTimer);
  window.cancelAnimationFrame(state.dishDetailOpenFrame);
  refs.dishDetailDialog.classList.remove("is-visible", "is-closing");
  refs.dishDetailDialog.showModal();
  refs.dishDetailDialog.focus({ preventScroll: true });
  refs.dishDetailDialog.getBoundingClientRect();
  state.dishDetailOpenFrame = window.requestAnimationFrame(() => {
    state.dishDetailOpenFrame = 0;
    if (refs.dishDetailDialog.open) {
      refs.dishDetailDialog.classList.add("is-visible");
    }
  });
}

function closeDishDetail({ immediate = false } = {}) {
  const dialog = refs.dishDetailDialog;
  if (!dialog.open || dialog.classList.contains("is-closing")) return;

  window.cancelAnimationFrame(state.dishDetailOpenFrame);
  state.dishDetailOpenFrame = 0;
  window.clearTimeout(state.dishDetailCloseTimer);

  if (immediate) {
    dialog.classList.remove("is-visible", "is-closing");
    dialog.close();
    return;
  }

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const finishProperty = reducedMotion ? "opacity" : "transform";
  const finish = () => {
    window.clearTimeout(state.dishDetailCloseTimer);
    dialog.removeEventListener("transitionend", handleTransitionEnd);
    dialog.classList.remove("is-visible", "is-closing");
    if (dialog.open) dialog.close();
  };
  const handleTransitionEnd = (event) => {
    if (event.target === dialog && event.propertyName === finishProperty) finish();
  };

  dialog.classList.add("is-closing");
  dialog.classList.remove("is-visible");
  dialog.addEventListener("transitionend", handleTransitionEnd);
  state.dishDetailCloseTimer = window.setTimeout(
    finish,
    (reducedMotion ? DISH_DETAIL_REDUCED_MOTION_MS : DISH_DETAIL_MOTION_MS) + 80,
  );
}

function renderNutrition(nutrition) {
  refs.calories.textContent = LunchNumberFormat.sourceCalories(nutrition.caloriesKcal);
  refs.nutritionBars.replaceChildren();
  const entries = [
    ["全穀雜糧", nutrition.wholeGrainsServings, 6],
    ["豆魚蛋肉", nutrition.proteinServings, 5],
    ["蔬菜", nutrition.vegetablesServings, 3],
    ["油脂堅果", nutrition.oilsNutsServings, 4],
    ["水果", nutrition.fruitServings, 2],
  ];
  for (const [label, value, scale] of entries) {
    const row = node("div", "nutrition-row");
    const track = node("div", "bar-track");
    const fill = node("div", "bar-fill");
    fill.style.width = `${Math.min(100, (value / scale) * 100)}%`;
    track.append(fill);
    row.append(node("span", "", label), track, node("strong", "", `${value} 份`));
    refs.nutritionBars.append(row);
  }
}

function renderStandard(dashboard) {
  const assessment = dashboard.nutritionAssessments?.[state.gradeGroup]?.[state.standardMode];
  const standard = dashboard.nutritionStandard;
  if (!assessment || !standard) {
    refs.standardDescription.textContent = "這份資料快照尚未包含營養基準，請重新建立網站資料。";
    refs.standardSummary.textContent = "基準資料待更新";
    refs.standardMetrics.replaceChildren();
    refs.standardGuidance.replaceChildren();
    refs.standardObservations.replaceChildren();
    return;
  }

  refs.gradeLower.setAttribute("aria-pressed", String(state.gradeGroup === "elementary_lower"));
  refs.gradeUpper.setAttribute("aria-pressed", String(state.gradeGroup === "elementary_upper"));
  refs.standardTarget.setAttribute("aria-pressed", String(state.standardMode === "target"));
  refs.standardTransitional.setAttribute("aria-pressed", String(state.standardMode === "transitional"));
  refs.standardPeriod.textContent = [
    `${compactDate(assessment.period.start)}–${compactDate(assessment.period.end)}`,
    `${assessment.dayCount} 個供餐日`,
    assessment.mealTypeLabel,
  ].join(" · ");
  refs.standardBasis.textContent = `${assessment.gradeLabel} · ${assessment.modeLabel}`;
  refs.standardDescription.textContent = assessment.modeDescription;
  refs.standardSummary.textContent = assessment.summary.label;

  refs.standardMetrics.replaceChildren();
  for (const metric of assessment.metrics) {
    const card = node("article", `standard-metric ${metric.status}`);
    const heading = node("header");
    heading.append(
      node("span", "", metric.label),
      node("span", "standard-status", metric.statusLabel),
    );
    card.append(
      heading,
      node("strong", "", metric.valueLabel),
      node("p", "", metric.targetLabel),
      node("small", "", metric.message),
    );
    refs.standardMetrics.append(card);
  }

  refs.standardGuidance.replaceChildren(
    ...assessment.guidance.map((item) => node("li", "", item)),
  );
  refs.standardObservations.replaceChildren();
  for (const observation of assessment.observations) {
    const card = node("article", "standard-observation");
    card.append(
      node("strong", "", observation.label),
      node("span", "", observation.valueLabel),
    );
    const note = node("p");
    const reference = node("b", "", observation.referenceLabel);
    note.append(reference, document.createTextNode(`；${observation.note}`));
    card.append(note);
    refs.standardObservations.append(card);
  }

  refs.standardMethod.textContent = assessment.methodNote;
  refs.standardCoverage.textContent = assessment.coverageNote;
  refs.standardSource.textContent = standard.source.title;
  refs.standardSource.href = standard.source.url;
  refs.standardRevision.textContent = ` · ${standard.source.revisionLabel} · 本站校讀 ${standard.source.reviewedAt}`;
}

function traceabilityDetail(label, value, url = null) {
  const row = node("div", "traceability-detail");
  row.append(node("dt", "", label));
  const description = node("dd");
  if (url) {
    const link = node("a", "", value);
    link.href = url;
    link.target = "_blank";
    link.rel = "noreferrer";
    description.append(link);
  } else {
    description.textContent = value;
  }
  row.append(description);
  return row;
}

function renderIngredient(ingredient) {
  const card = node("article", "ingredient-card");
  const heading = node("div", "ingredient-heading");
  heading.append(node("strong", "", ingredient.name));
  const certification = ingredient.certification;
  const certificationLabel = certification?.label.includes("CAS")
    ? "CAS"
    : certification?.label || ingredient.platformMark;
  heading.append(node(
    "span",
    `certification-badge${certification ? "" : " empty"}`,
    certificationLabel || "未提供標章",
  ));
  card.append(heading);

  const details = node("dl", "ingredient-details");
  if (ingredient.referenceDate) {
    details.append(
      traceabilityDetail("匹配依據", ingredient.matchReason),
      traceabilityDetail(
        "資料日期",
        formatDate(ingredient.referenceDate, { year: "numeric" }),
      ),
      traceabilityDetail("原始菜色", ingredient.referenceDishName),
    );
  }
  const supplier = ingredient.supplier;
  if (ingredient.producer) {
    details.append(traceabilityDetail("製造／生產者", ingredient.producer.name));
  }
  if (ingredient.platformMark) {
    details.append(traceabilityDetail("平臺標示", ingredient.platformMark));
  }
  if (ingredient.originCountry) {
    details.append(traceabilityDetail("原料產地（國）", ingredient.originCountry));
  }
  details.append(
    traceabilityDetail("平臺申報供應商", supplier.name),
    traceabilityDetail("供應商統編", supplier.taxId || "未提供"),
  );
  if (supplier.address) details.append(traceabilityDetail("供應商地址", supplier.address));

  if (certification) {
    details.append(traceabilityDetail(
      "認證／追溯號碼",
      certification.number,
      certification.officialUrl,
    ));
    if (certification.operator) {
      details.append(traceabilityDetail(
        "認證經營者",
        certification.operator.name,
        certification.operator.sourceUrl,
      ));
      if (certification.operator.address) {
        details.append(traceabilityDetail("經營者所在地", certification.operator.address));
      }
    }
    if (certification.verificationBody) {
      details.append(traceabilityDetail("驗證／管理單位", certification.verificationBody));
    }
    if (certification.status || certification.validUntil) {
      const state = [
        certification.status,
        certification.validUntil ? `效期至 ${formatDate(certification.validUntil, { year: "numeric" })}` : null,
      ].filter(Boolean).join(" · ");
      details.append(traceabilityDetail("查核狀態", state));
    }
  } else if (ingredient.platformMark) {
    details.append(traceabilityDetail("追溯號碼", "本次頁面截圖未顯示可核對的號碼"));
  } else {
    details.append(traceabilityDetail("標章資料", "這筆平臺資料未提供認證標章或追溯號碼"));
  }
  card.append(details);
  return card;
}

function renderTraceability(traceability) {
  refs.traceabilityDishes.replaceChildren();
  refs.traceabilityStatus.className = "traceability-status";
  if (!traceability || traceability.status === "unavailable") {
    refs.traceabilityStatus.textContent = "等待官方資料";
    refs.traceabilityStatus.classList.add("unavailable");
    refs.traceabilityNotice.textContent = traceability?.notice || "目前沒有已校讀的官方食材明細。";
    refs.traceabilitySummary.textContent = "本日菜單已收錄 · 食材來源待補";
    const empty = node("div", "traceability-empty");
    empty.append(
      node("strong", "", "目前沒有可靠的食材匹配"),
      node("p", "", "同日資料尚未取得，這套餐別的菜名也沒有可與既有資料明確對應的食材。"),
    );
    refs.traceabilityDishes.append(empty);
    refs.traceabilitySource.textContent = "";
    return;
  }

  const isHistoricalMatch = traceability.status === "matched_reference";
  refs.traceabilityStatus.textContent = isHistoricalMatch
    ? `歷史匹配 · ${traceability.ingredientCount} 項`
    : `本餐別已比對 · ${compactDate(traceability.dataDate)}`;
  refs.traceabilityStatus.classList.add(isHistoricalMatch ? "reference" : "verified");
  refs.traceabilityNotice.textContent = traceability.notice;
  refs.traceabilitySummary.textContent = isHistoricalMatch
    ? `${traceability.dishes.length} 道菜找到匹配 · ${traceability.ingredientCount} 項歷史食材來源`
    : `${traceability.dishes.length} 道菜 · ${traceability.ingredientCount} 項食材 · ${traceability.markedIngredientCount ?? traceability.certifiedIngredientCount} 項附標章／溯源標示`;

  for (const dish of traceability.dishes) {
    const details = node("details", "traceability-dish");
    const summary = node("summary");
    const title = node("span", "traceability-dish-title");
    title.append(node("small", "", dish.category || "菜色"), node("strong", "", dish.name));
    if (dish.officialName && dish.officialName !== dish.name) {
      title.append(node("em", "", `平臺名稱：${dish.officialName}`));
    }
    summary.append(title, node("span", "traceability-count", `${dish.ingredients.length} 項食材`));
    const ingredients = node("div", "ingredient-grid");
    ingredients.append(...dish.ingredients.map(renderIngredient));
    details.append(summary, ingredients);
    refs.traceabilityDishes.append(details);
  }

  refs.traceabilitySource.textContent = isHistoricalMatch
    ? `資料來源：${traceability.sourceName} · 歷史資料日期 ${traceability.referenceDates.map(compactDate).join("、")} · 不代表本日供應批次`
    : `資料來源：${traceability.sourceName} · 供餐日期 ${compactDate(traceability.dataDate)} · 校讀日期 ${traceability.reviewedAt}`;
}

function renderDinner(suggestion) {
  refs.dinnerTitle.textContent = "這天晚餐，換個主角";
  refs.dinnerPicks.replaceChildren(...suggestion.recommendations.map((item) => node("span", "", item)));
  refs.dinnerReason.textContent = suggestion.reason;
  refs.dinnerNotes.replaceChildren(...suggestion.notes.map((text) => node("li", "", text)));
  refs.disclaimer.textContent = suggestion.disclaimer;
}

function renderFoodEducation(card) {
  refs.educationCategory.textContent = `健康小常識 · ${card.category || "吃得更懂"}`;
  refs.educationIngredient.textContent = card.ingredient;
  refs.educationTitle.textContent = card.title;
  refs.educationFact.textContent = card.fact;
  refs.educationPrompt.textContent = card.prompt;
  refs.educationSource.textContent = card.source.label;
  refs.educationSource.href = card.source.url;
}

function renderHomeRecipe(recipe) {
  refs.recipeInspired.textContent = `從「${recipe.inspiredBy}」延伸`;
  refs.recipeTitle.textContent = recipe.title;
  refs.recipeMeta.replaceChildren(
    node("span", "", recipe.time),
    node("span", "", recipe.servings),
  );
  refs.recipePreview.replaceChildren(
    ...recipe.ingredients.slice(0, 3).map((item) => node("span", "", item)),
  );
  refs.recipeIngredients.replaceChildren(
    ...recipe.ingredients.map((item) => node("li", "", item)),
  );
  refs.recipeSteps.replaceChildren(
    ...recipe.steps.map((step) => node("li", "", step)),
  );
  refs.recipeAllergens.textContent = `留意過敏原：${recipe.allergens.join("、")}`;
  refs.recipeNote.textContent = recipe.note;
  refs.recipeDetails.open = false;
}

function renderWeek(dashboard) {
  const active = dashboard.selected;
  refs.weekLabel.textContent = `第 ${active.week} 週 · ${compactDate(active.weekStartDate)}–${compactDate(active.weekEndDate)}`;
  refs.weekDays.replaceChildren();
  for (const day of dashboard.week) {
    const button = node("button", "day-card");
    button.type = "button";
    button.dataset.date = day.date;
    button.setAttribute("aria-current", String(day.date === active.date));
    const dateLine = node("div", "day-date");
    dateLine.append(node("span", "", day.weekday), node("strong", "", day.date.slice(-2)));
    const sides = [day.meal.staple, ...day.meal.sideDishes.slice(0, 2)].join(" · ");
    const hasTraceability = day.traceabilityStatus === "verified";
    const hasHistoricalMatch = day.traceabilityStatus === "matched_reference";
    const traceabilityLabel = hasTraceability
      ? `${day.traceableIngredientCount} 項同日可追溯`
      : hasHistoricalMatch
        ? `${day.traceableIngredientCount} 項歷史匹配`
        : "溯源待補";
    const traceabilityClass = hasTraceability
      ? "verified"
      : hasHistoricalMatch ? "reference" : "pending";
    button.append(
      dateLine,
      node("h3", "", day.meal.mainDish),
      node("span", `day-traceability ${traceabilityClass}`, traceabilityLabel),
      node("p", "", sides),
    );
    button.addEventListener("click", () => loadDashboard(day.date, {
      announce: true,
      focusWeekDay: true,
    }));
    refs.weekDays.append(button);
  }

  const archiveIndex = dashboard.archive.findIndex((week) => week.id === active.weekId);
  refs.previousWeek.disabled = archiveIndex < 0 || archiveIndex >= dashboard.archive.length - 1;
  refs.nextWeek.disabled = archiveIndex <= 0;
  refs.previousWeek.onclick = () => loadDashboard(
    dashboard.archive[archiveIndex + 1].startDate,
    { announce: true },
  );
  refs.nextWeek.onclick = () => loadDashboard(
    dashboard.archive[archiveIndex - 1].startDate,
    { announce: true },
  );
}

function renderInsights(insights, dashboard) {
  refs.insightsKicker.textContent = LunchDateContext.insightsPeriodLabel(
    dashboard.dateRange.start,
    dashboard.dateRange.end,
  );
  refs.averageCalories.textContent = insights.averageCaloriesKcal;
  refs.averageVegetables.textContent = `約 ${insights.averageVegetablesServings} 份`;
  refs.fruitDays.textContent = `${insights.fruitDays} 天`;
  refs.fruitDaysContext.textContent = `共 ${dashboard.totalDays} 個供餐日`;
  refs.friedDays.textContent = `${insights.friedDays} 天`;
  refs.friedDaysContext.textContent = `共 ${dashboard.totalDays} 個供餐日`;

  refs.proteinBars.replaceChildren();
  const maxProtein = Math.max(...insights.proteinCounts.map((item) => item.count), 1);
  for (const item of insights.proteinCounts) {
    const row = node("div", "protein-row");
    const track = node("div", "bar-track");
    const fill = node("div", "bar-fill");
    fill.style.width = `${(item.count / maxProtein) * 100}%`;
    track.append(fill);
    row.append(node("span", "", item.label), track, node("strong", "", item.count));
    refs.proteinBars.append(row);
  }

  refs.calorieChart.replaceChildren();
  const values = insights.calorieTrend.map((item) => item.value);
  const minimum = Math.min(...values) - 40;
  const maximum = Math.max(...values) + 20;
  for (const point of insights.calorieTrend) {
    const column = node("div", "calorie-column");
    const height = Math.max(8, ((point.value - minimum) / (maximum - minimum)) * 100);
    column.dataset.label = `${compactDate(point.date)} · ${LunchNumberFormat.sourceCalories(point.value)} kcal`;
    column.style.setProperty("--height", `${height}%`);
    const bar = node("i");
    bar.style.height = `${height}%`;
    column.append(bar);
    refs.calorieChart.append(column);
  }
  refs.trendRange.textContent = `${compactDate(dashboard.dateRange.start)}–${compactDate(dashboard.dateRange.end)}`;
}

function renderArchive(dashboard) {
  refs.archiveList.replaceChildren();
  for (const week of dashboard.archive) {
    const button = node("button", "archive-item");
    button.type = "button";
    button.append(
      node("strong", "", `W${String(week.week).padStart(2, "0")}`),
      (() => { const wrap = node("span"); wrap.append(node("span", "", `${compactDate(week.startDate)}–${compactDate(week.endDate)}`), node("small", "", `${week.dayCount} 個供餐日 · 已校讀`)); return wrap; })()
    );
    button.addEventListener("click", () => loadDashboard(week.startDate, { announce: true }));
    refs.archiveList.append(button);
  }
}

function renderSource(day) {
  refs.sourceArticle.hidden = !day.source.url;
  if (day.source.url) refs.sourceArticle.href = day.source.url;
  const openImage = (kind) => {
    const isDetail = kind === "detail";
    const image = isDetail ? day.source.detailImage : day.source.image;
    const label = isDetail
      ? `${day.mealType === "meat" ? "葷食" : "素食"}食譜用量明細`
      : "原始午餐菜單";
    const requestId = ++state.sourceImageRequestId;
    refs.sourceImage.onload = null;
    refs.sourceImage.onerror = null;
    refs.sourceImage.removeAttribute("src");
    refs.sourceImage.alt = `第 ${day.week} 週${label}`;
    refs.downloadSource.href = image;
    const imageExtension = image.match(/\.(png|jpe?g|webp)(?:\?|$)/i)?.[1] || "jpg";
    refs.downloadSource.download = `week-${String(day.week).padStart(2, "0")}-${isDetail ? day.mealType : "menu"}.${imageExtension}`;
    refs.dialogTitle.textContent = `第 ${day.week} 週${label}`;
    refs.sourceDialog.dataset.kind = kind;
    setSourceImageState("loading", `正在載入第 ${day.week} 週${label}…`);
    refs.sourceDialog.showModal();
    refs.sourceImage.onload = async () => {
      try {
        await refs.sourceImage.decode();
      } catch (error) {
        // The load event already confirms usable pixels when decode is unavailable.
      }
      if (requestId === state.sourceImageRequestId) {
        setSourceImageState("ready", `${label}已載入`);
      }
    };
    refs.sourceImage.onerror = () => {
      if (requestId === state.sourceImageRequestId) {
        refs.sourceImage.alt = "";
        setSourceImageState("error", `${label}載入失敗，請稍後再試。`);
      }
    };
    refs.sourceImage.src = image;
  };
  refs.openSource.onclick = () => openImage("summary");
  refs.openDetail.onclick = () => openImage("detail");
}

function setSourceImageState(status, message) {
  refs.sourceImageStage.dataset.state = status;
  refs.sourceImageStatus.setAttribute("role", status === "error" ? "alert" : "status");
  refs.sourceImageStatusText.textContent = message;
  refs.sourceDialog.setAttribute("aria-busy", String(status === "loading"));
  refs.downloadSource.hidden = status !== "ready";
}

function districtKey(school) {
  return `${school.city}\u0000${school.district}`;
}

function selectedSchool() {
  return state.schoolDirectory.find(
    (school) => Number(school.fatraceSchoolId) === Number(state.schoolId),
  ) || null;
}

function renderFavoriteButton() {
  const school = selectedSchool();
  const isFavorite = school && Number(school.fatraceSchoolId) === state.favoriteSchoolId;
  refs.favoriteSchoolButton.disabled = !school;
  refs.favoriteSchoolButton.classList.toggle("is-favorite", Boolean(isFavorite));
  refs.favoriteSchoolButton.textContent = isFavorite ? "★ 我的最愛（可取消）" : "☆ 設為我的最愛";
  refs.favoriteSchoolButton.setAttribute("aria-pressed", String(Boolean(isFavorite)));
}

function populateSchoolSelectors() {
  const districts = [];
  const seenDistricts = new Set();
  for (const school of state.schoolDirectory) {
    const key = districtKey(school);
    if (!seenDistricts.has(key)) {
      seenDistricts.add(key);
      districts.push({ key, city: school.city, district: school.district });
    }
  }
  const activeSchool = selectedSchool();
  if (activeSchool) state.district = districtKey(activeSchool);
  if (!state.district || !seenDistricts.has(state.district)) {
    state.district = districts[0]?.key || null;
  }

  refs.districtSelect.replaceChildren();
  for (const district of districts) {
    const option = node("option", "", `${district.city} · ${district.district}`);
    option.value = district.key;
    refs.districtSelect.append(option);
  }
  refs.districtSelect.value = state.district || "";

  refs.schoolSelect.replaceChildren();
  const placeholder = node("option", "", "請選擇國小");
  placeholder.value = "";
  refs.schoolSelect.append(placeholder);
  for (const school of state.schoolDirectory.filter((item) => districtKey(item) === state.district)) {
    const option = node("option", "", school.name);
    option.value = String(school.fatraceSchoolId);
    refs.schoolSelect.append(option);
  }
  refs.schoolSelect.value = activeSchool ? String(activeSchool.fatraceSchoolId) : "";
  renderFavoriteButton();
}

function renderSchoolContext(dashboard) {
  if (Array.isArray(dashboard.schoolDirectory) && dashboard.schoolDirectory.length) {
    state.schoolDirectory = dashboard.schoolDirectory;
  }
  if (dashboard.school) {
    state.schoolId = Number(dashboard.school.fatraceSchoolId);
    state.district = districtKey(dashboard.school);
    populateSchoolSelectors();
    refs.brandSchoolLabel.textContent = `${dashboard.school.name}午餐助手`;
    const complete = dashboard.viewMode === "detailed";
    refs.schoolDataScope.textContent = complete
      ? "校方完整菜單＋教育部當日紀錄"
      : "教育部當日實際供餐公開紀錄";
    refs.footerSource.textContent = complete
      ? "資料來源：忠信國小午餐網、教育部校園食材登錄平臺 · 僅供家庭餐食規劃參考"
      : OfficialDiet.profile(dashboard.record).hasVariants
        ? `資料來源：教育部校園食材登錄平臺（${dashboard.school.fullName}）· 主副菜依「素」字標示分組`
        : `資料來源：教育部校園食材登錄平臺（${dashboard.school.fullName}）· 完整官方紀錄`;
  }
}

function setViewMode(mode, { showOfficialMealTypes = false } = {}) {
  const official = mode === "officialDaily";
  document.body.dataset.viewMode = official ? "official" : "detailed";
  refs.week.hidden = false;
  refs.todayGrid.hidden = false;
  refs.traceability.hidden = false;
  refs.news.hidden = false;
  refs.mealTypeSwitch.hidden = official && !showOfficialMealTypes;
  refs.mealTypeSwitch.setAttribute(
    "aria-label",
    official ? "依官方菜名標示切換葷食或素食" : "選擇午餐餐別",
  );
  refs.mealTypeMeat.textContent = "葷食";
  refs.mealTypeVegetarian.textContent = "素食";
  refs.nutritionCard.hidden = official;
  refs.dinnerCard.hidden = official;
  refs.standard.hidden = official;
  refs.learn.hidden = official;
  refs.insights.hidden = official;
  refs.source.hidden = official;
  refs.openDetail.hidden = official;
  refs.officialSourceLink.hidden = !official;
  refs.menuBoard.classList.toggle("official-menu-board", official);
  refs.menuKicker.textContent = official ? "OFFICIAL DAILY RECORD" : "SELECTED PLATE";
  refs.menuHeading.textContent = official ? "當日供餐紀錄" : "午餐內容";
  refs.reviewBadge.textContent = official ? "✓ 官方公開紀錄" : "✓ 已校讀";
  refs.mainDishButton.firstElementChild.textContent = official ? "主菜" : "這餐主角";
  refs.traceabilityKicker.textContent = official ? "OFFICIAL INGREDIENT RECORD" : "SOURCE TO PLATE";
  refs.traceabilityHeading.textContent = official ? "教育部公開食材紀錄" : "今日供餐食材追溯";
  for (const link of document.querySelectorAll('a[href="#week"], a[href="#traceability"]')) {
    link.hidden = false;
  }
  for (const link of document.querySelectorAll('a[href="#standard"], a[href="#insights"]')) {
    link.hidden = official;
  }
}

function renderNoSchoolSelected() {
  state.schoolId = null;
  state.dashboard = null;
  populateSchoolSelectors();
  document.body.dataset.viewMode = "empty";
  refs.mealTypeSwitch.hidden = true;
  refs.week.hidden = true;
  refs.todayGrid.hidden = true;
  refs.traceability.hidden = true;
  refs.standard.hidden = true;
  refs.learn.hidden = true;
  refs.insights.hidden = true;
  refs.news.hidden = true;
  refs.source.hidden = true;
  refs.todayLabel.textContent = formatDate(localIsoDate(), { year: "numeric", weekday: "long" });
  refs.mealMoment.textContent = "今天想看，";
  refs.heroDish.textContent = "哪一間國小？";
  refs.introNote.textContent = "先選行政區與學校；設成我的最愛後，下次進站才會優先讀取那間學校。";
  refs.brandSchoolLabel.textContent = "臺中市國小午餐助手";
  refs.schoolDataScope.textContent = "尚未選擇學校，不讀取午餐資料";
  refs.footerSource.textContent = "選擇學校後，才會讀取對應的公開午餐資料。";
  refs.errorState.hidden = true;
  for (const link of document.querySelectorAll('a[href="#week"], a[href="#traceability"], a[href="#standard"], a[href="#insights"]')) {
    link.hidden = true;
  }
  setDashboardStatus("ready", "請先選擇學校");
}

function officialDishes(record, mealType = null) {
  return OfficialDiet.filter(record, mealType).map((dish) => ({
      ...dish,
      officialRecord: true,
      ingredients: (dish.ingredients || []).map((ingredient) => ({
        ...ingredient,
        officialRecord: true,
      })),
    }));
}

function officialMainDish(dishes) {
  return dishes.find((dish) => dish.category === "主菜") || dishes[0] || null;
}

function renderOfficialMeal(dashboard) {
  const record = dashboard.record;
  const profile = OfficialDiet.profile(record);
  const dishes = officialDishes(record, profile.hasVariants ? state.mealType : null);
  const summary = OfficialDiet.summary(dishes);
  const heroIndex = Math.max(0, dishes.indexOf(officialMainDish(dishes)));
  const heroDish = dishes[heroIndex];
  state.dishDetails = dishes;
  state.activeDishIndex = -1;
  refs.mealList.replaceChildren();

  if (!record) {
    refs.mainDish.textContent = "尚未取得這一天的公開紀錄";
    refs.heroDish.textContent = "資料尚未發布";
    refs.mainDishButton.disabled = true;
    refs.mainDishButton.onclick = null;
    refs.dishCount.textContent = "不會拿其他日期的紀錄代替今天";
    refs.allergenRow.textContent = "請改選已收錄日期，或直接到教育部公開頁確認。";
    refs.mealTypeNote.textContent = dashboard.dataNotice;
    return;
  }

  refs.heroDish.textContent = `${summary.dishCount} 道公開菜色`;
  refs.mainDish.textContent = heroDish?.name || "本日無菜色";
  refs.mainDishButton.disabled = !heroDish;
  refs.mainDishButton.setAttribute(
    "aria-label",
    heroDish ? `查看「${heroDish.name}」的官方食材紀錄` : "本日無菜色",
  );
  refs.mainDishButton.onclick = heroDish
    ? () => openDishDetail(heroIndex, refs.mainDishButton)
    : null;
  const groupingLabel = profile.hasVariants
    ? `${state.mealType === "vegetarian" ? "素食" : "葷食"} · `
    : "";
  refs.dishCount.textContent = `${groupingLabel}官方公開 ${summary.dishCount} 道菜 · ${summary.ingredientCount} 項食材紀錄`;

  dishes.forEach((dish, index) => {
    if (index === heroIndex) return;
    const item = node("button", "meal-item");
    item.type = "button";
    item.setAttribute("aria-label", `查看${dish.category}「${dish.name}」的官方食材紀錄`);
    item.append(node("span", "", dish.category), node("strong", "", dish.name));
    item.addEventListener("click", () => openDishDetail(index, item));
    refs.mealList.append(item);
  });
  refs.allergenRow.textContent = profile.hasVariants
    ? "依官方菜名的「素」字拆分主菜與副菜；主食、蔬菜、湯品與附餐列為兩種分組共用。"
    : "這一天沒有同時出現葷、素主菜，因此保留官方完整菜色，不另外拆分。";
  refs.mealTypeNote.textContent = profile.hasVariants
    ? "這是依菜名標示所做的分組，不等同素食認證；共用菜色是否含動物性食材，仍以展開後的官方食材明細為準。"
    : "食材、產地、供應商與標章照同日官方公開紀錄呈現；不代表孩子實際攝取量。";
}

function renderOfficialIngredient(ingredient) {
  const card = node("article", "ingredient-card");
  const heading = node("div", "ingredient-heading");
  const certification = ingredient.certifications?.[0];
  heading.append(
    node("strong", "", ingredient.name),
    node(
      "span",
      `certification-badge${certification ? "" : " empty"}`,
      certification?.name || "未提供標章",
    ),
  );
  const details = node("dl", "ingredient-details");
  if (ingredient.standardName && ingredient.standardName !== ingredient.name) {
    details.append(traceabilityDetail("標準名稱", ingredient.standardName));
  }
  if (ingredient.productName && ingredient.productName !== ingredient.name) {
    details.append(traceabilityDetail("產品名稱", ingredient.productName));
  }
  details.append(
    traceabilityDetail("原料產地（國）", ingredient.origin || "未提供"),
    traceabilityDetail("製造／生產者", ingredient.manufacturer || "未提供"),
    traceabilityDetail("平臺申報供應商", ingredient.supplierName || "未提供"),
  );
  if (ingredient.stockDate) {
    details.append(traceabilityDetail(
      "進貨日期",
      formatDate(ingredient.stockDate.slice(0, 10), { year: "numeric" }),
    ));
  }
  for (const item of ingredient.certifications || []) {
    details.append(traceabilityDetail(item.name, item.id || "未提供編號"));
  }
  card.append(heading, details);
  return card;
}

function renderOfficialTraceability(dashboard) {
  const record = dashboard.record;
  refs.traceabilityDishes.replaceChildren();
  refs.traceabilityStatus.className = "traceability-status";
  if (!record) {
    refs.traceabilityStatus.textContent = "尚未收錄";
    refs.traceabilityStatus.classList.add("unavailable");
    refs.traceabilityNotice.textContent = `${dashboard.selectedDate} 沒有已校讀的同日公開紀錄；本站不會用較早日期冒充今天。`;
    refs.traceabilitySummary.textContent = "指定日期無資料";
    const empty = node("div", "traceability-empty");
    empty.append(
      node("strong", "", "等待官方同日紀錄"),
      node("p", "", "資料取得並通過結構驗證後，才會加入這裡。"),
    );
    refs.traceabilityDishes.append(empty);
    refs.traceabilitySource.textContent = "";
    return;
  }

  const profile = OfficialDiet.profile(record);
  const dishes = officialDishes(record, profile.hasVariants ? state.mealType : null);
  const summary = OfficialDiet.summary(dishes);
  refs.traceabilityStatus.textContent = `同日官方資料 · ${summary.ingredientCount} 項`;
  refs.traceabilityStatus.classList.add("verified");
  refs.traceabilityNotice.textContent = profile.hasVariants
    ? `${record.mealDate} 的主菜與副菜依官方菜名的「素」字分組；主食、蔬菜、湯品與附餐共用，食材內容仍以官方明細為準。`
    : `${record.mealDate} 的菜色與食材直接整理自教育部公開頁；未發現可配對的葷、素主菜，因此不拆分。`;
  refs.traceabilitySummary.textContent = `${summary.dishCount} 道菜 · ${summary.ingredientCount} 項食材 · ${summary.certifiedIngredientCount} 項附標章／溯源標示`;

  for (const dish of dishes) {
    const details = node("details", "traceability-dish");
    const summary = node("summary");
    const title = node("span", "traceability-dish-title");
    title.append(node("small", "", dish.category), node("strong", "", dish.name));
    summary.append(title, node("span", "traceability-count", `${dish.ingredients.length} 項食材`));
    const ingredients = node("div", "ingredient-grid");
    if (dish.ingredients.length) {
      ingredients.append(...dish.ingredients.map(renderOfficialIngredient));
    } else {
      ingredients.append(node("p", "news-empty", "官方頁面未列出這道菜的食材明細。"));
    }
    details.append(summary, ingredients);
    refs.traceabilityDishes.append(details);
  }
  refs.traceabilitySource.textContent = `資料來源：${record.source.name} · 供餐日期 ${record.mealDate} · 校讀 ${record.review.reviewedAt.slice(0, 10)}`;
}

function renderOfficialWeek(dashboard) {
  const dates = dashboard.availableDates || [];
  const selectedProfile = OfficialDiet.profile(dashboard.record);
  const groupingLabel = selectedProfile.hasVariants
    ? ` · ${state.mealType === "vegetarian" ? "素食" : "葷食"}`
    : "";
  refs.weekLabel.textContent = dates.length
    ? `已收錄 ${dates.length} 個供餐日 · 只顯示同日紀錄${groupingLabel}`
    : "尚未收錄供餐日";
  refs.weekDays.replaceChildren();
  for (const date of dates) {
    const record = dashboard.records?.[date] || (date === dashboard.selectedDate ? dashboard.record : null);
    const profile = OfficialDiet.profile(record);
    const dishes = officialDishes(record, profile.hasVariants ? state.mealType : null);
    const mainDish = officialMainDish(dishes);
    const supportingDishes = dishes.filter((dish) => dish !== mainDish);
    const button = node("button", "day-card");
    button.type = "button";
    button.dataset.date = date;
    button.setAttribute("aria-current", String(date === dashboard.selectedDate));
    const weekday = new Intl.DateTimeFormat("zh-TW", { weekday: "short" }).format(
      new Date(`${date}T12:00:00+08:00`),
    );
    const dateLine = node("div", "day-date");
    dateLine.append(node("span", "", weekday), node("strong", "", date.slice(-2)));
    button.append(
      dateLine,
      node("span", "day-dish-role", mainDish ? "主菜" : "供餐紀錄"),
      node("h3", "", mainDish?.name || "無供餐紀錄"),
      node("span", "day-traceability verified", `${dishes.length} 道官方菜色`),
      node("p", "", supportingDishes.slice(0, 3).map((dish) => dish.name).join(" · ") || "—"),
    );
    button.addEventListener("click", () => loadDashboard(date, { announce: true, focusWeekDay: true }));
    refs.weekDays.append(button);
  }
  const index = dates.indexOf(dashboard.selectedDate);
  refs.previousWeek.disabled = index <= 0;
  refs.nextWeek.disabled = index < 0 || index >= dates.length - 1;
  refs.previousWeek.onclick = index > 0
    ? () => loadDashboard(dates[index - 1], { announce: true })
    : null;
  refs.nextWeek.onclick = index >= 0 && index < dates.length - 1
    ? () => loadDashboard(dates[index + 1], { announce: true })
    : null;
}

function renderOfficial(dashboard) {
  const profile = OfficialDiet.profile(dashboard.record);
  const dishes = officialDishes(dashboard.record, profile.hasVariants ? state.mealType : null);
  const summary = OfficialDiet.summary(dishes);
  renderSchoolContext(dashboard);
  setViewMode("officialDaily", { showOfficialMealTypes: profile.hasVariants });
  refs.mealTypeMeat.setAttribute("aria-pressed", String(state.mealType === "meat"));
  refs.mealTypeVegetarian.setAttribute("aria-pressed", String(state.mealType === "vegetarian"));
  const date = dashboard.selectedDate || localIsoDate();
  refs.todayLabel.textContent = formatDate(date, { year: "numeric", weekday: "long" });
  refs.mealMoment.textContent = dashboard.record ? `${dashboard.school.name}這天，` : `${dashboard.school.name}這天，`;
  refs.introNote.textContent = dashboard.record
    ? `${profile.hasVariants ? `${state.mealType === "vegetarian" ? "素食" : "葷食"}：` : ""}${summary.dishCount} 道菜、${summary.ingredientCount} 項食材，來自同日教育部公開紀錄。`
    : `${date} 尚無已校讀紀錄，不會拿別天資料代替。`;
  refs.officialSourceLink.href = dashboard.sourceUrl;
  renderOfficialMeal(dashboard);
  renderOfficialTraceability(dashboard);
  renderOfficialWeek(dashboard);
  const count = summary.dishCount;
  setDashboardStatus("ready", dashboard.record ? `同日官方紀錄 · ${count} 道菜` : "指定日期尚無資料");
  refs.errorState.hidden = true;
}

function render(dashboard) {
  if (dashboard.viewMode === "officialDaily") {
    renderOfficial(dashboard);
    return;
  }
  renderSchoolContext(dashboard);
  setViewMode("detailed");
  const day = dashboard.selected;
  state.mealType = dashboard.mealType;
  refs.mealTypeMeat.setAttribute("aria-pressed", String(state.mealType === "meat"));
  refs.mealTypeVegetarian.setAttribute("aria-pressed", String(state.mealType === "vegetarian"));
  refs.mealTypeNote.textContent = state.mealType === "vegetarian"
    ? "素食菜單可能含蛋、奶；用量為供餐廠商的每人食譜設計值，不代表實際攝取量。"
    : "用量為供餐廠商的每人食譜設計值，不代表實際攝取量。";
  const formatted = formatDate(day.date, { year: "numeric", weekday: "long" });
  refs.todayLabel.textContent = formatted;
  refs.mealMoment.textContent = LunchDateContext.mealMoment(day.date, localIsoDate());
  refs.introNote.textContent = dashboard.isFallback
    ? `指定日期沒有供餐資料，先顯示最近的 ${formatDate(day.date)}。`
    : `${dashboard.mealTypeLabel}：${day.meal.staple}、${day.meal.mainDish}；${day.meal.fruit ? `附餐 ${day.meal.fruit}；` : ""}食譜明細共 ${day.recipeDetails?.length || day.meal.sideDishes.length + 2} 道。`;
  renderMeal(day);
  renderNutrition(day.nutrition);
  renderStandard(dashboard);
  renderTraceability(dashboard.traceability);
  renderDinner(dashboard.dinnerSuggestion);
  renderFoodEducation(dashboard.foodEducation);
  renderHomeRecipe(dashboard.homeRecipe);
  renderWeek(dashboard);
  renderInsights(dashboard.insights, dashboard);
  renderArchive(dashboard);
  renderSource(day);
  setDashboardStatus("ready", `已整理 ${dashboard.totalDays} 個供餐日`);
  refs.errorState.hidden = true;
}

function announceSelection(dashboard) {
  if (dashboard.viewMode === "officialDaily") {
    const profile = OfficialDiet.profile(dashboard.record);
    const dishes = officialDishes(dashboard.record, profile.hasVariants ? state.mealType : null);
    refs.selectionAnnouncement.textContent = [
      dashboard.school.name,
      formatDate(dashboard.selectedDate, { year: "numeric", weekday: "long" }),
      dashboard.record
        ? `${profile.hasVariants ? `${state.mealType === "vegetarian" ? "素食" : "葷食"}，` : ""}${dishes.length} 道官方公開菜色`
        : "尚無同日公開紀錄",
    ].join("，");
    return;
  }
  const day = dashboard.selected;
  refs.selectionAnnouncement.textContent = [
    formatDate(day.date, { year: "numeric", weekday: "long" }),
    `${dashboard.mealTypeLabel}午餐`,
    day.meal.mainDish,
  ].join("，");
}

async function loadDashboard(date, { announce = false, focusWeekDay = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  setDashboardStatus("loading", state.dashboard ? "正在更新菜單…" : "正在讀取菜單…");
  try {
    const payload = await fetchDashboard(date);
    state.dashboard = payload;
    render(payload);
    if (!state.newsLoaded) loadNewsPreview();
    if (focusWeekDay) {
      const activeDate = payload.viewMode === "officialDaily"
        ? payload.selectedDate
        : payload.selected.date;
      const selectedDay = refs.weekDays.querySelector(
        `.day-card[data-date="${activeDate}"]`,
      );
      selectedDay?.focus({ preventScroll: true });
    }
    if (announce) announceSelection(payload);
  } catch (error) {
    refs.errorState.hidden = false;
    refs.errorMessage.textContent = error instanceof Error ? error.message : "未知錯誤";
    setDashboardStatus("error", "資料讀取失敗");
  } finally {
    state.loading = false;
  }
}

refs.closeSource.addEventListener("click", () => refs.sourceDialog.close());
refs.sourceDialog.addEventListener("click", (event) => {
  if (event.target === refs.sourceDialog) refs.sourceDialog.close();
});
refs.sourceDialog.addEventListener("close", () => {
  state.sourceImageRequestId += 1;
  refs.sourceImage.onload = null;
  refs.sourceImage.onerror = null;
});

refs.closeDishDetail.addEventListener("click", () => closeDishDetail());
refs.dishDetailDialog.addEventListener("click", (event) => {
  if (event.target === refs.dishDetailDialog) closeDishDetail();
});
refs.dishDetailDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeDishDetail();
});
refs.dishDetailDialog.addEventListener("close", () => {
  const trigger = state.lastDishTrigger;
  state.lastDishTrigger = null;
  if (trigger?.isConnected) trigger.focus();
});
refs.previousDish.addEventListener("click", () => {
  if (state.activeDishIndex > 0) {
    state.activeDishIndex -= 1;
    renderDishDetail();
  }
});
refs.nextDish.addEventListener("click", () => {
  if (state.activeDishIndex < state.dishDetails.length - 1) {
    state.activeDishIndex += 1;
    renderDishDetail();
  }
});

async function selectMealType(mealType) {
  if (mealType === state.mealType) return;
  if (state.dashboard?.viewMode === "officialDaily") {
    if (!OfficialDiet.profile(state.dashboard.record).hasVariants) return;
    state.mealType = mealType;
    window.localStorage.setItem("demeter-meal-type", mealType);
    renderOfficial(state.dashboard);
    announceSelection(state.dashboard);
    return;
  }
  state.mealType = mealType;
  window.localStorage.setItem("demeter-meal-type", mealType);
  const selectedDate = state.dashboard?.selected?.date || localIsoDate();
  await loadDashboard(selectedDate, { announce: true });
}

refs.mealTypeMeat.addEventListener("click", () => selectMealType("meat"));
refs.mealTypeVegetarian.addEventListener("click", () => selectMealType("vegetarian"));

async function selectSchool(schoolId) {
  const nextSchoolId = Number(schoolId);
  const exists = state.schoolDirectory.some(
    (school) => Number(school.fatraceSchoolId) === nextSchoolId,
  );
  if (!exists) {
    renderNoSchoolSelected();
    return;
  }
  if (nextSchoolId === state.schoolId && state.dashboard) return;
  state.schoolId = nextSchoolId;
  const selectedDate = state.dashboard?.viewMode === "officialDaily"
    ? state.dashboard.selectedDate
    : state.dashboard?.selected?.date;
  await loadDashboard(selectedDate || localIsoDate(), { announce: true });
}

refs.schoolSelect.addEventListener("change", () => selectSchool(refs.schoolSelect.value));
refs.districtSelect.addEventListener("change", () => {
  state.district = refs.districtSelect.value;
  renderNoSchoolSelected();
  refs.schoolSelect.focus();
});
refs.favoriteSchoolButton.addEventListener("click", () => {
  const school = selectedSchool();
  if (!school) return;
  const schoolId = Number(school.fatraceSchoolId);
  if (state.favoriteSchoolId === schoolId) {
    state.favoriteSchoolId = null;
    window.localStorage.removeItem("demeter-favorite-school-id");
    refs.schoolDataScope.textContent = "已取消我的最愛；目前畫面仍保留，重新進站時不會自動讀取。";
  } else {
    state.favoriteSchoolId = schoolId;
    window.localStorage.setItem("demeter-favorite-school-id", String(schoolId));
    refs.schoolDataScope.textContent = `已將${school.name}設為我的最愛；下次進站會優先讀取。`;
  }
  renderFavoriteButton();
});

function selectGradeGroup(gradeGroup) {
  if (gradeGroup === state.gradeGroup) return;
  state.gradeGroup = gradeGroup;
  window.localStorage.setItem("demeter-grade-group", gradeGroup);
  if (state.dashboard) renderStandard(state.dashboard);
}

function selectStandardMode(mode) {
  if (mode === state.standardMode) return;
  state.standardMode = mode;
  window.localStorage.setItem("demeter-standard-mode", mode);
  if (state.dashboard) renderStandard(state.dashboard);
}

refs.gradeLower.addEventListener("click", () => selectGradeGroup("elementary_lower"));
refs.gradeUpper.addEventListener("click", () => selectGradeGroup("elementary_upper"));
refs.standardTarget.addEventListener("click", () => selectStandardMode("target"));
refs.standardTransitional.addEventListener("click", () => selectStandardMode("transitional"));

for (const link of document.querySelectorAll("a.today-link")) {
  link.addEventListener("click", async (event) => {
    event.preventDefault();
    if (state.schoolId) {
      await loadDashboard(localIsoDate(), { announce: true });
    } else {
      refs.schoolSelect.focus();
    }
    history.replaceState(null, "", "#today");
    document.getElementById("today").scrollIntoView();
  });
}

async function initialize() {
  setDashboardStatus("loading", "正在讀取學校名冊…");
  try {
    state.schoolDirectory = await fetchSchoolDirectory();
    const favorite = state.schoolDirectory.find(
      (school) => Number(school.fatraceSchoolId) === state.favoriteSchoolId,
    );
    if (!favorite) {
      state.favoriteSchoolId = null;
      window.localStorage.removeItem("demeter-favorite-school-id");
      renderNoSchoolSelected();
      return;
    }
    state.schoolId = Number(favorite.fatraceSchoolId);
    state.district = districtKey(favorite);
    populateSchoolSelectors();
    await loadDashboard(localIsoDate());
  } catch (error) {
    refs.errorState.hidden = false;
    refs.errorMessage.textContent = error instanceof Error ? error.message : "未知錯誤";
    setDashboardStatus("error", "學校名冊讀取失敗");
  }
}

initialize();
