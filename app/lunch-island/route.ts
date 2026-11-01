import lunchIslandHtml from "@/web/lunch-island/index.html?raw";

export const dynamic = "force-static";

export async function GET() {
  return new Response(lunchIslandHtml, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
