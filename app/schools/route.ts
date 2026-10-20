import {
  SITE_ORIGIN,
  escapeHtml,
  loadIndexableSchools,
  publicHtmlHeaders,
} from "@/lib/public-school-seo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const schools = await loadIndexableSchools(request);
  if (!schools.length) {
    return new Response("學校目錄目前無法讀取", {
      status: 503,
      headers: { ...publicHtmlHeaders(60), "retry-after": "300" },
    });
  }
  const groups = Map.groupBy(schools, (school) => school.district);
  const title = "臺中市國小營養午餐學校目錄｜好好吃飯";
  const description = `依行政區查找好好吃飯目前收錄的 ${schools.length} 所臺中市國小，直接前往各校已公布的每日營養午餐頁面。`;
  const html = `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index,follow" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="zh_TW" />
    <meta property="og:site_name" content="好好吃飯" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${SITE_ORIGIN}/schools" />
    <meta property="og:image" content="${SITE_ORIGIN}/og-image.png?v=20261020" />
    <meta name="theme-color" content="#f5f0e7" />
    <title>${escapeHtml(title)}</title>
    <link rel="canonical" href="${SITE_ORIGIN}/schools" />
    <link rel="icon" href="/favicon.ico?v=20261020" sizes="any" />
    <link rel="stylesheet" href="/styles.css?v=20261020-school-seo" />
    <link rel="stylesheet" href="/schools.css?v=20261020-school-seo" />
  </head>
  <body class="school-public-page">
    <header class="topbar school-public-topbar"><a class="brand" href="/" aria-label="好好吃飯首頁"><img class="brand-mark" src="/icon-192x192.png?v=20261020" alt="" aria-hidden="true" width="43" height="43" /><span><strong>好好吃飯</strong><small>臺中市國小午餐助手</small></span></a><nav aria-label="主要導覽"><a href="/">午餐查詢</a><a href="/schools" aria-current="page">學校目錄</a><a href="/news.html">午餐消息</a><a href="/support">支援中心</a></nav></header>
    <main class="school-public-main school-directory-main">
      <nav class="school-breadcrumbs" aria-label="麵包屑"><a href="/">首頁</a><span aria-hidden="true">/</span><span aria-current="page">學校目錄</span></nav>
      <section class="school-directory-hero"><p class="kicker">臺中市國小營養午餐</p><h1>找到孩子的學校，<br /><em>直接看已公布菜單</em></h1><p>目前收錄 ${schools.length} 所臺中市國小。每個連結都是可直接開啟的公開學校頁面；若今天尚未公布，頁面會清楚標示，不會用其他日期代替。</p></section>
      <nav class="district-jump" aria-label="依行政區快速前往">${[...groups.keys()].map((district) => `<a href="#district-${escapeHtml(district)}">${escapeHtml(district)}</a>`).join("")}</nav>
      <div class="school-directory-groups">${[...groups.entries()].map(([district, districtSchools]) => `<section class="school-directory-group" id="district-${escapeHtml(district)}"><header><h2>${escapeHtml(district)}</h2><span>${districtSchools.length} 所</span></header><div class="school-link-grid">${districtSchools.map((school) => `<a href="/schools/${school.fatraceSchoolId}"><strong>${escapeHtml(school.name)}</strong><small>${escapeHtml(school.fullName)}</small></a>`).join("")}</div></section>`).join("")}</div>
    </main>
    <footer><div class="footer-brand"><strong>好好吃飯</strong><span>公開午餐資訊不需登入 · 菜單以各校實際公布為準</span></div><nav class="footer-links" aria-label="服務資訊"><a href="/">午餐查詢</a><a href="/privacy">隱私權政策</a><a href="/terms">服務條款</a><a href="/support">支援中心</a></nav></footer>
  </body>
</html>`;
  return new Response(html, { headers: publicHtmlHeaders(1800) });
}
