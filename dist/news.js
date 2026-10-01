const state = { items: [], category: "全部" };

const refs = {
  newsSync: document.getElementById("newsSync"),
  newsRange: document.getElementById("newsRange"),
  newsFilters: document.getElementById("newsFilters"),
  newsList: document.getElementById("newsList"),
  newsEmpty: document.getElementById("newsEmpty"),
  sourcePolicy: document.getElementById("sourcePolicy"),
};

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function endpoint() {
  const local = window.location.protocol.startsWith("http") &&
    ["127.0.0.1", "localhost"].includes(window.location.hostname);
  return local ? "/api/news" : "./data/news.json";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric", month: "long", day: "numeric",
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
  const title = node("h3");
  const link = node("a", "", item.title);
  link.href = item.url;
  link.target = "_blank";
  link.rel = "noreferrer";
  title.append(link);
  content.append(title, node("p", "news-why", item.whyItMatters));
  const source = node("div", "news-item-source");
  source.append(
    node("strong", "", item.source),
    node("span", "", item.sourceType),
    node("span", "", item.category),
  );
  article.append(meta, content, source);
  return article;
}

function render() {
  const visible = state.category === "全部"
    ? state.items
    : state.items.filter((item) => item.category === state.category);
  refs.newsList.replaceChildren(...visible.map(createNewsItem));
  refs.newsEmpty.hidden = visible.length > 0;
}

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
  try {
    const response = await fetch(endpoint(), { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.items = Array.isArray(payload.items) ? payload.items : [];
    refs.newsRange.textContent = `整理近 ${payload.lookbackDays || 30} 天 · ${state.items.length} 則`;
    refs.sourcePolicy.textContent = payload.sourcePolicy || refs.sourcePolicy.textContent;
    refs.newsSync.classList.add("ready");
    refs.newsSync.lastChild.textContent = `更新於 ${formatDate(payload.generatedAt)}`;
    render();
  } catch (error) {
    refs.newsSync.lastChild.textContent = "消息讀取失敗";
    refs.newsList.replaceChildren();
    refs.newsEmpty.hidden = false;
    refs.newsEmpty.textContent = "近期消息暫時讀取不到，請稍後再試。";
  }
}

loadNews();
