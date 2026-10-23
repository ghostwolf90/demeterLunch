import {
  SITE_ORIGIN,
  escapeHtml,
  formatMealDate,
  formatTimestamp,
  loadPublicSchoolPageData,
  publicHtmlHeaders,
  safeExternalUrl,
  type PublicMeal,
  type PublicMealRecord,
  type PublicSchoolPageData,
} from "@/lib/public-school-seo";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ schoolId: string }> | { schoolId: string };
};

export async function GET(request: Request, context: RouteContext) {
  const { schoolId: schoolIdParam } = await context.params;
  if (!/^[1-9]\d*$/.test(schoolIdParam)) return notFound();
  const data = await loadPublicSchoolPageData(request, Number(schoolIdParam));
  if (!data) return notFound();
  return new Response(renderSchoolPage(data), { headers: publicHtmlHeaders() });
}

function renderSchoolPage(data: PublicSchoolPageData) {
  const { school, today, todayRecord, displayRecord, dates, hasWeeklyMenu } = data;
  const canonical = `${SITE_ORIGIN}/schools/${school.fatraceSchoolId}`;
  const title = `${school.name}營養午餐｜每日菜單與食材資訊｜好好吃飯`;
  const description = hasWeeklyMenu
    ? `查詢${school.fullName}已公布的每日營養午餐與經校讀週菜單，了解菜色、營養資訊與食材來源，並參考家庭晚餐搭配建議。`
    : `查詢${school.fullName}已公布的每日營養午餐菜單、供餐日期與官方食材來源；如今日尚未公布，頁面會清楚標示。`;
  const todayAvailable = todayRecord?.status === "available";
  const todayNoMeal = todayRecord?.status === "no_meal";
  const displayDate = displayRecord?.mealDate || findRecordDate(data, displayRecord);
  const latestIsToday = displayDate === today;

  return `<!doctype html>
<html lang="zh-Hant">
  <head>
    ${analyticsHead()}
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="zh_TW" />
    <meta property="og:site_name" content="好好吃飯" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:image" content="${SITE_ORIGIN}/og-image.png?v=20261020" />
    <meta property="og:image:alt" content="好好吃飯｜國小營養午餐查詢" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${SITE_ORIGIN}/og-image.png?v=20261020" />
    <meta name="theme-color" content="#f5f0e7" />
    <title>${escapeHtml(title)}</title>
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="16x16 32x32 48x48" />
    <link rel="icon" href="/favicon-32x32.png?v=20261020" type="image/png" sizes="32x32" />
    <link rel="icon" href="/icon-192x192.png?v=20261020" type="image/png" sizes="192x192" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=20261020" sizes="180x180" />
    <link rel="stylesheet" href="/styles.css?v=20261020-school-seo" />
    <link rel="stylesheet" href="/schools.css?v=20261020-school-seo" />
  </head>
  <body class="school-public-page">
    ${siteHeader()}
    <main class="school-public-main">
      <nav class="school-breadcrumbs" aria-label="麵包屑"><a href="/">首頁</a><span aria-hidden="true">/</span><a href="/schools">學校目錄</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(school.name)}</span></nav>
      <section class="school-hero">
        <div>
          <p class="kicker">${escapeHtml(school.city)} · ${escapeHtml(school.district)} · 每日午餐</p>
          <h1>${escapeHtml(school.fullName)}<br /><em>營養午餐</em></h1>
          <p class="school-hero-copy">直接查看校方已公布、本站已取得的午餐內容。每日資料與完整週菜單的來源範圍不同，本站不會把每日紀錄宣稱成整週菜單。</p>
        </div>
        <div class="school-id-card"><span>正式學校識別碼</span><strong>${school.fatraceSchoolId}</strong><small>教育部校園食材登錄平臺 School ID</small></div>
      </section>

      <section class="school-status-card card ${todayAvailable ? "is-available" : todayNoMeal ? "is-no-meal" : "is-pending"}" aria-labelledby="todayStatusTitle">
        <div><p class="kicker">今日資料狀態</p><h2 id="todayStatusTitle">${escapeHtml(formatMealDate(today))}</h2></div>
        <div class="school-status-copy"><strong>${todayAvailable ? "今日菜單已公布" : todayNoMeal ? "官方資料標示今日不供餐" : "今日尚未取得已校讀菜單"}</strong><p>${todayStatusMessage(todayRecord)}</p></div>
      </section>

      ${displayRecord && displayDate ? renderMealRecord(displayRecord, displayDate, latestIsToday) : renderNoPublishedMenu()}

      <section class="school-info-grid">
        <article class="card school-source-card">
          <p class="kicker">資料說明</p><h2>實際日期與來源都保留</h2>
          <p>菜單來自教育部校園食材登錄平臺的當日或歷史實際供餐公開紀錄；本站只呈現已取得的日期，不以前一天或相似餐點代替今天。</p>
          ${renderSource(displayRecord)}
        </article>
        <article class="card school-history-card">
          <p class="kicker">最近收錄日期</p><h2>已公布的每日紀錄</h2>
          <div class="school-date-list">${dates.slice(0, 8).map((date) => `<time datetime="${date}">${escapeHtml(formatMealDate(date))}</time>`).join("")}</div>
          ${hasWeeklyMenu ? '<p class="school-weekly-note"><strong>本校另有有效的經校讀週菜單資料。</strong>完整週菜單只在實際具備來源時顯示；可回到主查詢查看營養分析與晚餐搭配。</p>' : '<p class="school-weekly-note">本頁提供已公布的每日供餐紀錄，不宣稱有完整週菜單。</p>'}
        </article>
      </section>

      <section class="school-next-actions" aria-label="接下來可以做什麼"><a class="primary-action" href="/">回到午餐查詢</a><a class="secondary-action" href="/schools">查看其他學校</a></section>
    </main>
    ${siteFooter()}
  </body>
</html>`;
}

function renderMealRecord(record: PublicMealRecord, date: string, isToday: boolean) {
  const meals = record.services?.length
    ? record.services.flatMap((service) =>
        (service.meals ?? []).map((meal) => ({ serviceLabel: service.label, meal })),
      )
    : (record.meals ?? []).map((meal) => ({
        serviceLabel: meal.serviceLabel,
        meal,
      }));
  const updatedAt = record.fetchedAt || record.review?.reviewedAt;
  const fetchedAt = formatTimestamp(updatedAt);
  return `<section class="school-menu-section" aria-labelledby="publishedMenuTitle">
    <div class="school-section-heading"><div><p class="kicker">${isToday ? "今日已公布菜單" : "最近已公布菜單"}</p><h2 id="publishedMenuTitle">${escapeHtml(formatMealDate(date))}</h2></div>${fetchedAt ? `<p>最後資料取得時間<br /><time datetime="${escapeHtml(updatedAt)}">${escapeHtml(fetchedAt)}</time></p>` : ""}</div>
    ${!isToday ? `<p class="school-date-warning"><strong>這是 ${escapeHtml(formatMealDate(date))} 的歷史供餐紀錄，並非今天的菜單。</strong>今天的菜單尚未取得時，不會用較早日期代替。</p>` : ""}
    <div class="school-meal-groups">${meals.length ? meals.map(({ serviceLabel, meal }, index) => renderMealGroup(meal, serviceLabel, index)).join("") : '<article class="card school-empty-card"><p>這筆紀錄目前沒有可顯示的菜色。</p></article>'}</div>
  </section>`;
}

function renderMealGroup(meal: PublicMeal, serviceLabel: string | undefined, index: number) {
  const dishes = (meal.dishes ?? []).filter((dish) => String(dish.name ?? "").trim());
  const calories = meal.nutrition?.caloriesKcal;
  const heading = meal.menuTypeName || serviceLabel || `午餐 ${index + 1}`;
  return `<article class="card school-meal-card">
    <header><div><p class="kicker">${escapeHtml(serviceLabel || "午餐")}</p><h3>${escapeHtml(heading)}</h3></div>${calories ? `<span class="school-calorie"><strong>${escapeHtml(calories)}</strong> kcal</span>` : ""}</header>
    <ul class="school-dish-list">${dishes.map((dish) => {
      const ingredients = (dish.ingredients ?? []).map((ingredient) => ingredient.productName || ingredient.name || ingredient.standardName).filter(Boolean).slice(0, 8);
      return `<li><span>${escapeHtml(dish.category || "菜色")}</span><div><strong>${escapeHtml(dish.name)}</strong>${ingredients.length ? `<small>食材：${ingredients.map(escapeHtml).join("、")}</small>` : ""}</div></li>`;
    }).join("")}</ul>
    ${renderNutrition(meal)}
  </article>`;
}

function renderNutrition(meal: PublicMeal) {
  const entries = [
    ["全穀雜糧", meal.nutrition?.wholeGrainsServings],
    ["豆魚蛋肉", meal.nutrition?.proteinServings],
    ["蔬菜", meal.nutrition?.vegetablesServings],
    ["水果", meal.nutrition?.fruitServings],
    ["乳品", meal.nutrition?.milkServings],
  ].filter((entry) => entry[1] !== undefined && entry[1] !== null && entry[1] !== "");
  if (!entries.length) return "";
  return `<dl class="school-nutrition">${entries.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)} 份</dd></div>`).join("")}</dl>`;
}

function renderSource(record: PublicMealRecord | null) {
  if (!record) return '<p class="school-source-missing">目前沒有可連結的菜單來源。</p>';
  const sourceUrl = safeExternalUrl(record.source?.url);
  const sourceName = record.source?.name || "教育部校園食材登錄平臺公開查詢頁";
  return `<dl class="school-source-details"><div><dt>資料來源</dt><dd>${escapeHtml(sourceName)}</dd></div>${record.source?.scope ? `<div><dt>資料範圍</dt><dd>${escapeHtml(record.source.scope)}</dd></div>` : ""}</dl>${sourceUrl ? `<a class="text-action" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">查看官方來源 ↗</a>` : ""}`;
}

function todayStatusMessage(record: PublicMealRecord | null) {
  if (!record) return "各校通常在當日陸續公布；本站不預測，也不拿其他日期的內容當作今天菜單。";
  if (record.status === "no_meal") {
    const reasons = (record.noMealReasons ?? []).filter(Boolean).join("、");
    return reasons ? `校方公開資料註記：${escapeHtml(reasons)}。` : "校方公開資料目前標示不供餐。";
  }
  return "以下內容來自今天已取得的官方供餐紀錄。";
}

function renderNoPublishedMenu() {
  return `<section class="school-menu-section"><article class="card school-empty-card"><p class="kicker">尚無可顯示資料</p><h2>目前沒有已公布的菜單紀錄</h2><p>請稍後再查；本站不會為了補滿頁面而虛構菜色。</p></article></section>`;
}

function findRecordDate(data: PublicSchoolPageData, target: PublicMealRecord | null) {
  if (!target) return "";
  return data.dates.find((date) => data.records[date] === target) ?? "";
}

function notFound() {
  const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="robots" content="noindex,follow" /><title>找不到學校頁面｜好好吃飯</title><link rel="stylesheet" href="/styles.css" /><link rel="stylesheet" href="/schools.css" /></head><body class="school-public-page"><main class="school-not-found"><p class="kicker">404</p><h1>找不到這所學校的公開頁面</h1><p>學校代碼不存在，或目前沒有可公開呈現的已審核菜單資料。</p><a class="primary-action" href="/schools">查看學校目錄</a></main></body></html>`;
  return new Response(html, { status: 404, headers: publicHtmlHeaders(60) });
}

function analyticsHead() {
  return `<!-- Google tag (gtag.js) --><script async src="https://www.googletagmanager.com/gtag/js?id=G-EDXYFV1B3L"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-EDXYFV1B3L');</script>`;
}

function siteHeader() {
  return `<header class="topbar school-public-topbar"><a class="brand" href="/" aria-label="好好吃飯首頁"><img class="brand-mark" src="/icon-192x192.png?v=20261020" alt="" aria-hidden="true" width="43" height="43" /><span><strong>好好吃飯</strong><small>國小午餐助手</small></span></a><nav aria-label="主要導覽"><a href="/">午餐查詢</a><a href="/schools" aria-current="page">學校目錄</a><a href="/news.html">午餐消息</a><a href="/support">支援中心</a></nav></header>`;
}

function siteFooter() {
  return `<footer><div class="footer-brand"><strong>好好吃飯</strong><span>公開午餐資訊不需登入 · 菜單以各校實際公布為準</span></div><nav class="footer-links" aria-label="服務資訊"><a href="/schools">學校目錄</a><a href="/privacy">隱私權政策</a><a href="/terms">服務條款</a><a href="/support">支援中心</a></nav></footer>`;
}
