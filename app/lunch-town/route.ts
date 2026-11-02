import lunchTownHtml from "@/web/lunch-town/index.html?raw";

export const dynamic = "force-static";

export async function GET() {
  return new Response(lunchTownHtml, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
