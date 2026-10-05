const savedMealType = window.localStorage.getItem("demeter-meal-type");
const savedGradeGroup = window.localStorage.getItem("demeter-grade-group");
const savedStandardMode = window.localStorage.getItem("demeter-standard-mode");
const state = {
  dashboard: null,
  loading: false,
  staticData: null,
  mealType: savedMealType === "vegetarian" ? "vegetarian" : "meat",
  gradeGroup: savedGradeGroup === "elementary_upper" ? "elementary_upper" : "elementary_lower",
  standardMode: savedStandardMode === "transitional" ? "transitional" : "target",
  dishDetails: [],
  activeDishIndex: -1,
  lastDishTrigger: null,
  dishDetailOpenFrame: 0,
  dishDetailCloseTimer: 0,
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
  "syncStatus", "todayLabel", "mealMoment", "heroDish", "introNote", "mainDish", "mealList",
  "allergenRow", "calories", "nutritionBars", "dinnerTitle", "dinnerPicks",
  "dinnerReason", "dinnerNotes", "disclaimer", "weekLabel", "weekDays",
  "previousWeek", "nextWeek", "averageCalories", "averageVegetables",
  "fruitDays", "fruitDaysContext", "friedDays", "friedDaysContext", "proteinBars", "calorieChart", "trendRange",
  "insightsKicker", "selectionAnnouncement",
  "sourceArticle", "openSource", "archiveList", "errorState", "errorMessage",
  "sourceDialog", "closeSource", "dialogTitle", "sourceImage", "downloadSource",
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
];
const refs = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
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
  const exact = variant.days.find((day) => day.date === selectedDate);
  const earlier = variant.days.filter((day) => day.date <= selectedDate);
  const active = exact || earlier.at(-1) || variant.days[0];
  return {
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

async function fetchDashboard(date) {
  if (isLocalApiAvailable()) {
    try {
      const response = await fetch(`/api/dashboard?date=${encodeURIComponent(date)}&mealType=${encodeURIComponent(state.mealType)}`, { cache: "no-store" });
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
  return dashboardFromStatic(state.staticData, date, state.mealType);
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
  state.dishDetails = sourceDishes;
  state.activeDishIndex = -1;
  refs.dishCount.textContent = sourceDishes.length
    ? `本餐共 ${sourceDishes.length} 道 · 點選菜色查看食材與設計用量`
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
    ? sourceDishes
      .filter((dish) => dish.role !== "main")
      .map((dish) => ({ label: roleLabels[dish.role] || "配菜", value: dish.name, dish }))
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
  return ingredient.quantityText || [
    ingredient.quantityValue,
    ingredient.quantityUnit,
  ].filter((value) => value !== null && value !== undefined).join(" ") || "未標示";
}

function renderDishDetail() {
  const dish = state.dishDetails[state.activeDishIndex];
  if (!dish) return;
  const ingredients = Array.isArray(dish.ingredients) ? dish.ingredients : [];
  refs.dishDetailRole.textContent = roleLabels[dish.role] || "菜色";
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
    for (const claim of ingredient.claims || []) {
      badges.append(node("span", `source-claim ${claim}`, claimLabels[claim] || claim));
    }
    const status = ingredient.traceabilityStatus || "unavailable";
    badges.append(node(
      "span",
      `ingredient-trace ${status}`,
      traceabilityStatusLabels[status] || traceabilityStatusLabels.unavailable,
    ));
    row.append(heading, badges);
    refs.dishDetailIngredients.append(row);
  }

  refs.dishDetailNote.textContent = state.mealType === "vegetarian"
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
    : certification?.label;
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
        "歷史資料日",
        formatDate(ingredient.referenceDate, { year: "numeric" }),
      ),
      traceabilityDetail("原始菜色", ingredient.referenceDishName),
    );
  }
  const supplier = ingredient.supplier;
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
    : `${traceability.dishes.length} 道菜 · ${traceability.ingredientCount} 項食材 · ${traceability.certifiedIngredientCount} 項附標章資料`;

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
    : `資料來源：${traceability.sourceName} ${traceability.sourceMonth} 月資料 · 校讀日期 ${traceability.reviewedAt}`;
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
    refs.sourceImage.src = image;
    refs.sourceImage.alt = `第 ${day.week} 週${label}`;
    refs.downloadSource.href = image;
    const imageExtension = image.match(/\.(png|jpe?g|webp)(?:\?|$)/i)?.[1] || "jpg";
    refs.downloadSource.download = `week-${String(day.week).padStart(2, "0")}-${isDetail ? day.mealType : "menu"}.${imageExtension}`;
    refs.dialogTitle.textContent = `第 ${day.week} 週${label}`;
    refs.sourceDialog.dataset.kind = kind;
    refs.sourceDialog.showModal();
  };
  refs.openSource.onclick = () => openImage("summary");
  refs.openDetail.onclick = () => openImage("detail");
}

function render(dashboard) {
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
    : `${dashboard.mealTypeLabel}：${day.meal.staple}、${day.meal.mainDish}；食譜明細共 ${day.recipeDetails?.length || day.meal.sideDishes.length + 2} 道。`;
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
  refs.syncStatus.classList.add("ready");
  refs.syncStatus.lastChild.textContent = `已整理 ${dashboard.totalDays} 個供餐日`;
  refs.errorState.hidden = true;
}

function announceSelection(dashboard) {
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
  try {
    const payload = await fetchDashboard(date);
    state.dashboard = payload;
    render(payload);
    if (focusWeekDay) {
      const selectedDay = refs.weekDays.querySelector(
        `.day-card[data-date="${payload.selected.date}"]`,
      );
      selectedDay?.focus({ preventScroll: true });
    }
    if (announce) announceSelection(payload);
  } catch (error) {
    refs.errorState.hidden = false;
    refs.errorMessage.textContent = error instanceof Error ? error.message : "未知錯誤";
    refs.syncStatus.lastChild.textContent = "資料讀取失敗";
  } finally {
    state.loading = false;
  }
}

refs.closeSource.addEventListener("click", () => refs.sourceDialog.close());
refs.sourceDialog.addEventListener("click", (event) => {
  if (event.target === refs.sourceDialog) refs.sourceDialog.close();
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
  state.mealType = mealType;
  window.localStorage.setItem("demeter-meal-type", mealType);
  const selectedDate = state.dashboard?.selected?.date || localIsoDate();
  await loadDashboard(selectedDate, { announce: true });
}

refs.mealTypeMeat.addEventListener("click", () => selectMealType("meat"));
refs.mealTypeVegetarian.addEventListener("click", () => selectMealType("vegetarian"));

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
    await loadDashboard(localIsoDate(), { announce: true });
    history.replaceState(null, "", "#today");
    document.getElementById("today").scrollIntoView();
  });
}

loadDashboard(localIsoDate());
loadNewsPreview();
