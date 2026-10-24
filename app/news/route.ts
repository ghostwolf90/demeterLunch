import newsHtml from "@/web/news.html?raw";

export const dynamic = "force-static";

export async function GET() {
  return new Response(newsHtml, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
