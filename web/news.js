const state = { items: [], category: "全部", month: "all" };

const refs = {
  newsRange: document.getElementById("newsRange"),
  newsFilters: document.getElementById("newsFilters"),
  newsList: document.getElementById("newsList"),
  newsEmpty: document.getElementById("newsEmpty"),
  sourcePolicy: document.getElementById("sourcePolicy"),
  month: document.getElementById("newsMonth"),
  summary: document.getElementById("newsFilterSummary"),
};

function setNewsStatus(status) {
  refs.newsList.setAttribute("aria-busy", String(status === "loading"));
  refs.month.disabled = status === "loading";
  for (const button of refs.newsFilters.querySelectorAll("button")) {
    button.disabled = status === "loading";
  }
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Taipei",
  }).format(new Date(value));
}

function createNewsItem(item) {
  const article = node("article", `news-item${item.important ? " important" : ""}`);
  const meta = node("div", "news-meta");
  meta.append(
    node("span", `news-tag${item.isLocal ? " local" : ""}`, item.isLocal ? "臺中優先" : item.category),
    node("time", "", formatDate(item.publishedAt)),
  );
  const content = node("div", "news-item-content");
  const title = node("h4");
  const link = LunchI18n.keep(node("a", "", item.title));
  link.href = item.url;
  link.target = "_blank";
  link.rel = "noreferrer";
  title.append(link);
  content.append(title, LunchI18n.keep(node("p", "news-why", item.whyItMatters)));
  const source = node("div", "news-item-source");
  source.append(
    LunchI18n.keep(node("strong", "", item.source)),
    node("span", "", item.sourceType),
    node("span", "", item.category),
  );
  article.append(meta, content, source);
  return article;
}

function render() {
  const visible = state.items.filter(item =>
    (state.category === "全部" || item.category === state.category)
      && (state.month === "all" || monthKey(item.publishedAt) === state.month));
  const groups = new Map();
  for (const item of visible) {
    const key = monthKey(item.publishedAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  refs.newsList.replaceChildren(...[...groups].map(([month, items]) => {
    const section = node("section", "news-month");
    const heading = node("h3", "news-month-title", monthLabel(month));
    heading.id = `news-month-${month}`;
    section.setAttribute("aria-labelledby", heading.id);
    section.append(heading, ...items.map(createNewsItem));
    return section;
  }));
  refs.summary.textContent = `顯示 ${visible.length} 則，共保留 ${state.items.length} 則消息。`;
  refs.newsEmpty.hidden = visible.length > 0;
}

function monthKey(value) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(new Date(value)).slice(0, 7);
}

function monthLabel(value) {
  const [year, month] = value.split("-");
  return `${year} 年 ${Number(month)} 月`;
}

function populateMonths() {
  const all = node("option", "", "全部月份");
  all.value = "all";
  refs.month.replaceChildren(all);
  for (const month of [...new Set(state.items.map(item => monthKey(item.publishedAt)))].sort().reverse()) {
    const option = node("option", "", monthLabel(month));
    option.value = month;
    refs.month.append(option);
  }
}

refs.month.addEventListener("change", () => {
  state.month = refs.month.value;
  render();
});

refs.newsFilters.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  for (const item of refs.newsFilters.querySelectorAll("button")) {
    const active = item === button;
    item.classList.toggle("active", active);
    item.setAttribute("aria-pressed", String(active));
  }
  render();
});

async function loadNews() {
  setNewsStatus("loading", "正在讀取午餐消息…");
  try {
    let response;
    try {
      response = await fetch("/api/news", { cache: "no-store" });
    } catch { /* Static exports can use the bundled copy. */ }
    if (!response?.ok) response = await fetch("/data/news.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.items = Array.isArray(payload.items) ? [...payload.items].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)) : [];
    populateMonths();
    refs.newsRange.textContent = `共保留 ${state.items.length} 則消息，依原始發布日期排列。`;
    refs.sourcePolicy.textContent = payload.sourcePolicy || refs.sourcePolicy.textContent;
    setNewsStatus("ready", `更新於 ${formatDate(payload.generatedAt)}`);
    render();
  } catch (error) {
    setNewsStatus("error", "午餐消息暫時無法顯示");
    refs.newsList.replaceChildren();
    refs.newsEmpty.hidden = false;
    refs.newsEmpty.textContent = "目前還無法顯示近期消息，請稍後再試。";
  }
}

loadNews();
