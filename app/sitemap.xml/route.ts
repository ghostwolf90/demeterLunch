import {
  SITE_ORIGIN,
  escapeHtml,
  loadIndexableSchools,
} from "@/lib/public-school-seo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const schools = await loadIndexableSchools(request);
  if (!schools.length) {
    return new Response("Sitemap is temporarily unavailable", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "retry-after": "300" },
    });
  }
  const urls = [
    `${SITE_ORIGIN}/`,
    `${SITE_ORIGIN}/about`,
    `${SITE_ORIGIN}/schools`,
    `${SITE_ORIGIN}/news.html`,
    `${SITE_ORIGIN}/support`,
    ...schools.map((school) => `${SITE_ORIGIN}/schools/${school.fatraceSchoolId}`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`).join("\n")}
</urlset>\n`;
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
