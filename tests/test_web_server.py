import json
import re
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
    @staticmethod
    def _contrast_ratio(first: str, second: str) -> float:
        def luminance(value: str) -> float:
            channels = [int(value[index:index + 2], 16) / 255 for index in (1, 3, 5)]
            linear = [
                channel / 12.92
                if channel <= 0.04045
                else ((channel + 0.055) / 1.055) ** 2.4
                for channel in channels
            ]
            return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]

        brighter, darker = sorted((luminance(first), luminance(second)), reverse=True)
        return (brighter + 0.05) / (darker + 0.05)

    def test_week_then_traceability_then_standard_sections(self) -> None:
        index_html = (
            Path(__file__).resolve().parents[1] / "web" / "index.html"
        ).read_text(encoding="utf-8")

        self.assertLess(
            index_html.index('id="week"'),
            index_html.index('id="traceability"'),
        )
        self.assertLess(
            index_html.index('id="traceability"'),
            index_html.index('id="standard"'),
        )

    def test_site_exposes_meat_vegetarian_and_detail_controls(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        index_html = (project_root / "web" / "index.html").read_text(encoding="utf-8")
        app_js = (project_root / "web" / "app.js").read_text(encoding="utf-8")

        self.assertIn('id="mealTypeMeat"', index_html)
        self.assertIn('id="mealTypeVegetarian"', index_html)
        self.assertIn('id="openDetail"', index_html)
        self.assertIn('id="mainDishButton"', index_html)
        self.assertIn('id="dishDetailDialog"', index_html)
        self.assertIn("<title>好好吃飯</title>", index_html)
        self.assertNotIn("document.title =", app_js)
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

    def test_hero_title_keeps_readable_line_spacing(self) -> None:
        styles = (
            Path(__file__).resolve().parents[1] / "web" / "styles.css"
        ).read_text(encoding="utf-8")

        self.assertRegex(styles, r"h1 \{[^}]*line-height: \.98;")
        self.assertRegex(styles, r"h1 \{[^}]*font-size: clamp\(42px[^}]*line-height: 1;")

    def test_dish_detail_uses_staged_apple_style_motion(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        app_js = (project_root / "web" / "app.js").read_text(encoding="utf-8")
        styles = (project_root / "web" / "styles.css").read_text(encoding="utf-8")

        self.assertIn("DISH_DETAIL_MOTION_MS = 360", app_js)
        self.assertIn('classList.add("is-visible")', app_js)
        self.assertIn('addEventListener("cancel"', app_js)
        self.assertIn(".dish-detail-dialog.is-visible", styles)
        self.assertIn("cubic-bezier(.32,.72,0,1)", styles)
        self.assertIn("prefers-reduced-motion: reduce", styles)

    def test_tablet_widths_keep_primary_navigation(self) -> None:
        styles = (
            Path(__file__).resolve().parents[1] / "web" / "styles.css"
        ).read_text(encoding="utf-8")
        tablet_rules = styles[
            styles.index("@media (max-width: 1050px)"):
            styles.index("@media (max-width: 720px)")
        ]

        self.assertIn(".mobile-nav {", tablet_rules)
        self.assertIn("display: grid;", tablet_rules)
        self.assertIn("grid-auto-flow: column;", tablet_rules)
        self.assertIn("grid-auto-columns: 1fr;", tablet_rules)
        self.assertIn("padding-bottom: calc(76px + env(safe-area-inset-bottom));", tablet_rules)

    def test_brand_colors_meet_normal_text_contrast(self) -> None:
        styles = (
            Path(__file__).resolve().parents[1] / "web" / "styles.css"
        ).read_text(encoding="utf-8")
        colors = dict(re.findall(r"--(orange|green|paper|white):\s*(#[0-9a-fA-F]{6});", styles))

        self.assertGreaterEqual(self._contrast_ratio(colors["orange"], colors["paper"]), 4.5)
        self.assertGreaterEqual(self._contrast_ratio(colors["white"], colors["orange"]), 4.5)
        self.assertGreaterEqual(self._contrast_ratio(colors["white"], colors["green"]), 4.5)

    def test_selection_updates_use_a_dedicated_live_region(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        index_html = (project_root / "web" / "index.html").read_text(encoding="utf-8")
        app_js = (project_root / "web" / "app.js").read_text(encoding="utf-8")

        self.assertIn('id="selectionAnnouncement" aria-live="polite"', index_html)
        self.assertNotIn('class="today-grid" aria-live="polite"', index_html)
        self.assertIn('selectedDay?.focus({ preventScroll: true });', app_js)
        self.assertIn("insightsPeriodLabel", app_js)

    def test_async_surfaces_expose_loading_and_error_statuses(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        index_html = (project_root / "web" / "index.html").read_text(encoding="utf-8")
        news_html = (project_root / "web" / "news.html").read_text(encoding="utf-8")
        app_js = (project_root / "web" / "app.js").read_text(encoding="utf-8")
        news_js = (project_root / "web" / "news.js").read_text(encoding="utf-8")
        styles = (project_root / "web" / "styles.css").read_text(encoding="utf-8")

        self.assertIn('<main id="dashboard" aria-busy="true">', index_html)
        self.assertIn('id="sourceImageStatus" role="status"', index_html)
        self.assertIn('id="newsList" aria-live="polite" aria-busy="true"', news_html)
        self.assertIn('setDashboardStatus("loading"', app_js)
        self.assertIn('setSourceImageState("loading"', app_js)
        self.assertIn("await refs.sourceImage.decode()", app_js)
        self.assertIn('setNewsStatus("loading"', news_js)
        self.assertIn("@keyframes status-spin", styles)
        self.assertIn(".loading-spinner { animation: none; }", styles)


if __name__ == "__main__":
    unittest.main()
