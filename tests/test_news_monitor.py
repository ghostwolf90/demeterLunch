from __future__ import annotations

import unittest
from datetime import datetime, timezone

from src.news_monitor import (
    NewsSource,
    classify_category,
    fetch_news,
    parse_feed,
    relevance_score,
)


SOURCE = NewsSource(
    id="test",
    name="測試來源",
    url="https://example.com/feed",
    source_type="新聞報導",
    priority=1,
)


class StubResponse:
    def __init__(self, data: bytes) -> None:
        self.data = data


class StubClient:
    def __init__(self, data: bytes) -> None:
        self.data = data

    def get(self, *_args, **_kwargs) -> StubResponse:
        return StubResponse(self.data)


class NewsMonitorTests(unittest.TestCase):
    def test_parse_rss(self) -> None:
        payload = b"""<?xml version='1.0' encoding='UTF-8'?>
        <rss><channel><item>
          <title>School lunch</title>
          <link>https://example.com/story?x=1</link>
          <pubDate>Thu, 01 Oct 2026 01:00:00 GMT</pubDate>
          <description>Summary</description>
        </item></channel></rss>"""
        items = parse_feed(payload, SOURCE)
        self.assertEqual(items[0]["title"], "School lunch")
        self.assertEqual(items[0]["source"], "測試來源")
        self.assertEqual(items[0]["publishedAt"], "2026-10-01T01:00:00Z")

    def test_relevance_avoids_unrelated_lunch_word(self) -> None:
        self.assertEqual(relevance_score("白宮午餐會討論科技", ""), 0)
        self.assertEqual(
            relevance_score("教師節展教育成果", "其中包含免費營養午餐政策"),
            0,
        )
        self.assertGreaterEqual(relevance_score("營養午餐專法進度", ""), 5)
        self.assertGreaterEqual(relevance_score("國小推動食農教育", ""), 5)

    def test_category_prefers_food_safety(self) -> None:
        self.assertEqual(classify_category("學校午餐食材檢驗", "食安說明"), "食安與供應")
        self.assertEqual(classify_category("營養午餐專法", ""), "營養與政策")

    def test_fetch_filters_old_and_irrelevant_items(self) -> None:
        payload = """<?xml version='1.0' encoding='UTF-8'?>
        <rss><channel>
          <item><title>營養午餐專法有新進度</title><link>https://example.com/a</link><pubDate>Thu, 01 Oct 2026 01:00:00 GMT</pubDate></item>
          <item><title>白宮午餐會討論科技</title><link>https://example.com/b</link><pubDate>Thu, 01 Oct 2026 02:00:00 GMT</pubDate></item>
          <item><title>校園午餐舊聞</title><link>https://example.com/c</link><pubDate>Sat, 01 Aug 2026 02:00:00 GMT</pubDate></item>
        </channel></rss>""".encode()
        items, statuses = fetch_news(
            StubClient(payload),
            now=datetime(2026, 10, 1, 12, tzinfo=timezone.utc),
            lookback_days=30,
            sources=(SOURCE,),
        )
        self.assertEqual([item["title"] for item in items], ["營養午餐專法有新進度"])
        self.assertEqual(statuses[0]["status"], "ok")


if __name__ == "__main__":
    unittest.main()
