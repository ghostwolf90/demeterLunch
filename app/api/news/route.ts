import news from "@/data/news/news.json";

export async function GET() {
  return Response.json(news, {
    headers: { "cache-control": "public, max-age=900" },
  });
}
