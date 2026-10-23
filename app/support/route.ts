import supportHtml from "@/web/support/index.html?raw";

export const dynamic = "force-static";

export async function GET() {
  return new Response(supportHtml, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
