import aboutHtml from "@/web/about/index.html?raw";

export const dynamic = "force-static";

export async function GET() {
  return new Response(aboutHtml, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
