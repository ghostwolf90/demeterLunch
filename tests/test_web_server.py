import json
import tempfile
import unittest
from pathlib import Path

from scripts.serve import load_menus, load_news


class WebDataTests(unittest.TestCase):
    def test_load_menus_sorts_latest_first_and_builds_local_urls(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for week, end_date in [(1, "2026-09-04"), (2, "2026-09-11")]:
                target = root / "2026" / "semester-1" / f"week-{week:02d}"
                target.mkdir(parents=True)
                (target / "menu-01.png").write_bytes(b"image")
                (target / "metadata.json").write_text(
                    json.dumps(
                        {
                            "id": str(week),
                            "week": week,
                            "startDate": "2026-09-01",
                            "endDate": end_date,
                            "images": [
                                {"file": "menu-01.png", "bytes": 5, "width": 1, "height": 1}
                            ],
                        }
                    ),
                    encoding="utf-8",
                )

            payload = load_menus(root)
            menus = payload["menus"]
            self.assertEqual([menu["week"] for menu in menus], [2, 1])
            self.assertEqual(payload["stats"]["menuCount"], 2)
            self.assertEqual(payload["stats"]["imageCount"], 2)
            self.assertEqual(
                menus[0]["images"][0]["url"],
                "/data/2026/semester-1/week-02/menu-01.png",
            )

    def test_news_api_returns_saved_payload(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            news = root / "news.json"
            news.write_text('{"items":[{"title":"午餐新聞"}]}', encoding="utf-8")
            payload = load_news(news)
            self.assertEqual(payload["items"][0]["title"], "午餐新聞")


class SiteLayoutTests(unittest.TestCase):
    def test_week_menu_precedes_traceability_section(self) -> None:
        index_html = (
            Path(__file__).resolve().parents[1] / "web" / "index.html"
        ).read_text(encoding="utf-8")

        self.assertLess(
            index_html.index('id="week"'),
            index_html.index('id="traceability"'),
        )

    def test_site_exposes_meat_vegetarian_and_detail_controls(self) -> None:
        index_html = (
            Path(__file__).resolve().parents[1] / "web" / "index.html"
        ).read_text(encoding="utf-8")

        self.assertIn('id="mealTypeMeat"', index_html)
        self.assertIn('id="mealTypeVegetarian"', index_html)
        self.assertIn('id="openDetail"', index_html)
        self.assertIn('id="mainDishButton"', index_html)
        self.assertIn('id="dishDetailDialog"', index_html)
        self.assertNotIn('id="recipeSourceDetails"', index_html)

    def test_site_exposes_grade_and_standard_controls(self) -> None:
        index_html = (
            Path(__file__).resolve().parents[1] / "web" / "index.html"
        ).read_text(encoding="utf-8")

        self.assertIn('id="standard"', index_html)
        self.assertIn('id="gradeLower"', index_html)
        self.assertIn('id="gradeUpper"', index_html)
        self.assertIn('id="standardTarget"', index_html)
        self.assertIn('id="standardTransitional"', index_html)
        self.assertNotIn("營養符合度", index_html)


if __name__ == "__main__":
    unittest.main()
