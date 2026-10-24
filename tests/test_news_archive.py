import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from scripts import check_news_updates
from src.news_monitor import build_news_payload, merge_news_items, payload_fingerprint

NOW = datetime(2026, 10, 24, 6, tzinfo=timezone.utc)


def item(name, date="2026-10-20T00:00:00Z", url=None):
    return {"id": name, "title": name, "url": url or f"https://example.com/{name}",
            "publishedAt": date, "source": "Official source", "category": "食育現場",
            "whyItMatters": "A note", "sourceType": "官方公告", "isLocal": False}


class NewsArchiveTests(unittest.TestCase):
    def test_missing_and_expired_feed_entries_remain_with_their_actual_dates(self):
        old = item("September", "2026-09-18T05:56:00Z")
        current = item("October")
        payload = build_news_payload([current], [], now=NOW, previous_items=[old])
        self.assertEqual(payload["items"], [current, old])
        self.assertEqual(payload["itemCount"], 2)
        self.assertEqual(payload["recentItemCount"], 1)
        self.assertEqual(payload["archiveStart"], old["publishedAt"])
        self.assertEqual(merge_news_items(payload["items"], []), payload["items"])

    def test_same_url_corrections_keep_a_stable_identity_and_do_not_duplicate(self):
        old = item("Original title")
        updated = {**old, "id": "new-feed-id", "title": "Corrected title", "whyItMatters": "Updated note"}
        merged = merge_news_items([old], [updated])
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["id"], old["id"])
        self.assertEqual(merged[0]["title"], "Corrected title")
        self.assertEqual(merge_news_items(merged, [updated]), merged)

    def test_duplicate_title_and_fragment_links_are_merged_and_blocked_urls_stay_removed(self):
        first = item("School lunch announcement")
        duplicate = {**first, "url": first["url"] + "#article"}
        other_source = {**first, "url": "https://example.org/same-story"}
        blocked = item("Removed story", url="https://www.taichung.gov.tw/3388745/post")
        merged = merge_news_items([first, blocked], [duplicate, other_source])
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["id"], first["id"])

    def test_malformed_incoming_entries_cannot_replace_valid_archived_entries(self):
        old = item("Saved")
        self.assertEqual(merge_news_items([old], [{**old, "publishedAt": "not-a-date"}, {}]), [old])

    def test_successful_checks_merge_partial_results_and_unchanged_runs_do_not_duplicate(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            news, state, reviewed = [root / name for name in ("news.json", "state.json", "reviewed.json")]
            old = item("Old", "2026-09-18T05:56:00Z")
            new = item("New")
            manual = item("Reviewed", "2026-10-19T00:00:00Z")
            news.write_text(json.dumps({"items": [old]}))
            reviewed.write_text(json.dumps({"items": [manual]}))
            argv = ["check_news_updates", "--news-file", str(news), "--state-file", str(state), "--reviewed-file", str(reviewed)]
            statuses = [{"id": "one-source", "status": "ok"}, {"id": "another-source", "status": "failed"}]
            with patch("sys.argv", argv), patch.object(check_news_updates, "HttpClient"), patch.object(check_news_updates, "fetch_news", return_value=([new], statuses)):
                self.assertEqual(check_news_updates.main(), 0)
                first = json.loads(news.read_text())
                self.assertEqual({entry["id"] for entry in first["items"]}, {"Old", "New", "Reviewed"})
                self.assertEqual(check_news_updates.main(), 0)
                second = json.loads(news.read_text())
                self.assertEqual(payload_fingerprint(first), payload_fingerprint(second))
                self.assertFalse(json.loads(state.read_text())["changed"])
                self.assertEqual(json.loads(state.read_text())["failedSources"], ["another-source"])

    def test_failed_refresh_leaves_published_payload_byte_for_byte_unchanged(self):
        with tempfile.TemporaryDirectory() as directory:
            news, state = Path(directory) / "news.json", Path(directory) / "state.json"
            original = json.dumps({"items": [item("Keep this")]})
            news.write_text(original)
            argv = ["check_news_updates", "--news-file", str(news), "--state-file", str(state)]
            with patch("sys.argv", argv), patch.object(check_news_updates, "HttpClient"), patch.object(check_news_updates, "fetch_news", side_effect=RuntimeError("all sources failed")):
                self.assertEqual(check_news_updates.main(), 2)
            self.assertEqual(news.read_text(), original)
            self.assertEqual(json.loads(state.read_text())["status"], "failed")

    def test_news_navigation_stops_at_home_preview_before_the_full_archive(self):
        root = Path(__file__).resolve().parents[1]
        source = (root / "web/index.html").read_text()
        self.assertIn('href="#news">午餐消息</a>', source)
        self.assertIn('class="text-action" href="/news">查看午餐消息</a>', source)
        self.assertIn('href="/#news">午餐消息</a>', (root / "web/news.html").read_text())
        app = (root / "web/app.js").read_text().split("const homepageSectionIds = new Set([", 1)[1].split("]);", 1)[0]
        self.assertIn('"news"', app)
        route = (root / "app/news/route.ts").read_text()
        self.assertIn('import newsHtml from "@/web/news.html?raw";', route)
        self.assertIn("new Response(newsHtml", route)
        self.assertIn("`${SITE_ORIGIN}/news`", (root / "app/sitemap.xml/route.ts").read_text())


if __name__ == "__main__":
    unittest.main()
