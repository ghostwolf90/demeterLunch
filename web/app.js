const state = { dashboard: null, loading: false, staticData: null };

const ids = [
  "syncStatus", "todayLabel", "mealMoment", "heroDish", "introNote", "mainDish", "mealList",
  "allergenRow", "calories", "nutritionBars", "dinnerTitle", "dinnerPicks",
  "dinnerReason", "dinnerNotes", "disclaimer", "weekLabel", "weekDays",
  "previousWeek", "nextWeek", "averageCalories", "averageVegetables",
  "fruitDays", "fruitDaysContext", "friedDays", "friedDaysContext", "proteinBars", "calorieChart", "trendRange",
  "sourceArticle", "openSource", "archiveList", "errorState", "errorMessage",
  "sourceDialog", "closeSource", "dialogTitle", "sourceImage", "downloadSource",
  "educationIngredient", "educationTitle", "educationFact", "educationPrompt", "educationSource",
  "recipeInspired", "recipeTitle", "recipeMeta", "recipePreview", "recipeDetails",
  "recipeIngredients", "recipeSteps", "recipeAllergens", "recipeNote",
  "latestNews", "newsUpdated",
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

function dashboardFromStatic(data, selectedDate) {
  const exact = data.days.find((day) => day.date === selectedDate);
  const earlier = data.days.filter((day) => day.date <= selectedDate);
  const active = exact || earlier.at(-1) || data.days[0];
  return {
    selected: active,
    requestedDate: selectedDate,
    isFallback: !exact,
    week: data.days.filter((day) => day.weekId === active.weekId),
    dinnerSuggestion: data.dinnerSuggestions[active.date],
    foodEducation: data.foodEducation[active.date],
    homeRecipe: data.homeRecipes[active.date],
    insights: data.insights,
    archive: data.archive,
    dateRange: data.dateRange,
    totalDays: data.totalDays,
  };
}

async function fetchDashboard(date) {
  if (isLocalApiAvailable()) {
    try {
      const response = await fetch(`/api/dashboard?date=${encodeURIComponent(date)}`, { cache: "no-store" });
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
  return dashboardFromStatic(state.staticData, date);
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
  refs.mainDish.textContent = day.meal.mainDish;
  refs.heroDish.textContent = day.meal.mainDish;
  refs.mealList.replaceChildren();
  const items = [
    ["主食", day.meal.staple],
    ...day.meal.sideDishes.map((dish, index) => [`配菜 ${index + 1}`, dish]),
    ["湯品", day.meal.soup],
    [day.meal.drink ? "飲品" : "水果", day.meal.drink || day.meal.fruit],
  ].filter(([, value]) => value);
  for (const [label, value] of items) {
    const item = node("div", "meal-item");
    item.append(node("span", "", label), node("strong", "", value));
    refs.mealList.append(item);
  }
  refs.allergenRow.textContent = day.allergens.length
    ? `原圖標示／菜名可辨識的過敏原：${day.allergens.join("、")}`
    : "過敏原資訊請仍以校方原始菜單與個人需求核對。";
}

function renderNutrition(nutrition) {
  refs.calories.textContent = Math.round(nutrition.caloriesKcal);
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

function renderDinner(suggestion) {
  refs.dinnerTitle.textContent = "這天晚餐，換個主角";
  refs.dinnerPicks.replaceChildren(...suggestion.recommendations.map((item) => node("span", "", item)));
  refs.dinnerReason.textContent = suggestion.reason;
  refs.dinnerNotes.replaceChildren(...suggestion.notes.map((text) => node("li", "", text)));
  refs.disclaimer.textContent = suggestion.disclaimer;
}

function renderFoodEducation(card) {
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
    button.setAttribute("aria-current", String(day.date === active.date));
    const dateLine = node("div", "day-date");
    dateLine.append(node("span", "", day.weekday), node("strong", "", day.date.slice(-2)));
    const sides = [day.meal.staple, ...day.meal.sideDishes.slice(0, 2)].join(" · ");
    button.append(dateLine, node("h3", "", day.meal.mainDish), node("p", "", sides));
    button.addEventListener("click", () => loadDashboard(day.date));
    refs.weekDays.append(button);
  }

  const archiveIndex = dashboard.archive.findIndex((week) => week.id === active.weekId);
  refs.previousWeek.disabled = archiveIndex < 0 || archiveIndex >= dashboard.archive.length - 1;
  refs.nextWeek.disabled = archiveIndex <= 0;
  refs.previousWeek.onclick = () => loadDashboard(dashboard.archive[archiveIndex + 1].startDate);
  refs.nextWeek.onclick = () => loadDashboard(dashboard.archive[archiveIndex - 1].startDate);
}

function renderInsights(insights, dashboard) {
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
    column.dataset.label = `${compactDate(point.date)} · ${Math.round(point.value)} kcal`;
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
    button.addEventListener("click", () => loadDashboard(week.startDate));
    refs.archiveList.append(button);
  }
}

function renderSource(day) {
  refs.sourceArticle.href = day.source.url;
  refs.sourceImage.src = day.source.image;
  refs.sourceImage.alt = `第 ${day.week} 週原始午餐菜單`;
  refs.downloadSource.href = day.source.image;
  refs.downloadSource.download = `week-${String(day.week).padStart(2, "0")}-menu.png`;
  refs.dialogTitle.textContent = `第 ${day.week} 週原始菜單`;
}

function render(dashboard) {
  const day = dashboard.selected;
  const formatted = formatDate(day.date, { year: "numeric", weekday: "long" });
  refs.todayLabel.textContent = formatted;
  refs.mealMoment.textContent = LunchDateContext.mealMoment(day.date, localIsoDate());
  refs.introNote.textContent = dashboard.isFallback
    ? `指定日期沒有供餐資料，先顯示最近的 ${formatDate(day.date)}。`
    : `${day.meal.staple}、${day.meal.mainDish}，以及 ${day.meal.sideDishes.length} 道配菜。`;
  renderMeal(day);
  renderNutrition(day.nutrition);
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
  document.title = `${day.meal.mainDish}｜好好吃飯`;
}

async function loadDashboard(date) {
  if (state.loading) return;
  state.loading = true;
  try {
    const payload = await fetchDashboard(date);
    state.dashboard = payload;
    render(payload);
  } catch (error) {
    refs.errorState.hidden = false;
    refs.errorMessage.textContent = error instanceof Error ? error.message : "未知錯誤";
    refs.syncStatus.lastChild.textContent = "資料讀取失敗";
  } finally {
    state.loading = false;
  }
}

refs.openSource.addEventListener("click", () => refs.sourceDialog.showModal());
refs.closeSource.addEventListener("click", () => refs.sourceDialog.close());
refs.sourceDialog.addEventListener("click", (event) => {
  if (event.target === refs.sourceDialog) refs.sourceDialog.close();
});

for (const link of document.querySelectorAll("a.today-link")) {
  link.addEventListener("click", async (event) => {
    event.preventDefault();
    await loadDashboard(localIsoDate());
    history.replaceState(null, "", "#today");
    document.getElementById("today").scrollIntoView();
  });
}

loadDashboard(localIsoDate());
loadNewsPreview();
