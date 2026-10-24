import indexHtml from "@/web/index.html?raw";

import release from "@/.openai/release.json";
import { renderReleaseHtml } from "@/lib/release";

export const dynamic = "force-static";

export async function GET() {
  return new Response(renderReleaseHtml(indexHtml, release), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    },
  });
}
