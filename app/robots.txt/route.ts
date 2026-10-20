import { SITE_ORIGIN } from "@/lib/public-school-seo";

export const dynamic = "force-static";

export async function GET() {
  const body = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /mcp/

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
