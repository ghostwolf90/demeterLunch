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

    def test_news_page_keeps_the_complete_desktop_navigation(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        index_html = (project_root / "web" / "index.html").read_text(encoding="utf-8")
        news_html = (project_root / "web" / "news.html").read_text(encoding="utf-8")
        expected_labels = ["今日", "本週", "溯源", "午餐紀錄", "基準", "趨勢", "學校目錄", "午餐觀察"]

        def primary_navigation_labels(html: str) -> list[str]:
            navigation = re.search(
                r'<nav aria-label="主要導覽">(.*?)</nav>',
                html,
                re.DOTALL,
            )
            self.assertIsNotNone(navigation)
            return re.findall(r'<a[^>]*>([^<]+)</a>', navigation.group(1))

        self.assertEqual(primary_navigation_labels(index_html), expected_labels)
        self.assertEqual(primary_navigation_labels(news_html), expected_labels)
        self.assertIn('href="./news.html" aria-current="page">午餐觀察</a>', news_html)
        self.assertIn('id="newsAccountButton" href="./index.html#passport"', news_html)

    def test_site_exposes_meat_vegetarian_and_detail_controls(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        index_html = (project_root / "web" / "index.html").read_text(encoding="utf-8")
        app_js = (project_root / "web" / "app.js").read_text(encoding="utf-8")

        self.assertIn('id="mealTypeMeat"', index_html)
        self.assertIn('id="mealTypeVegetarian"', index_html)
        self.assertIn('id="openDetail"', index_html)
        self.assertIn('id="mainDishButton"', index_html)
        self.assertIn('id="dishDetailDialog"', index_html)
        self.assertIn(
            "<title>臺中國小營養午餐查詢、每日菜單與晚餐搭配｜好好吃飯</title>",
            index_html,
        )
        self.assertNotIn("document.title =", app_js)
        self.assertNotIn('id="recipeSourceDetails"', index_html)

    def test_site_exposes_west_district_school_selector_and_official_mode(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        index_html = (project_root / "web" / "index.html").read_text(encoding="utf-8")
        app_js = (project_root / "web" / "app.js").read_text(encoding="utf-8")

        self.assertIn('id="schoolSelect"', index_html)
        self.assertIn('id="districtSelect"', index_html)
        self.assertIn('id="defaultSchoolButton"', index_html)
        self.assertIn("☆ 設為預設學校", index_html)
        self.assertIn("✓ 預設學校", app_js)
        self.assertNotIn('id="defaultSchoolNote"', index_html)
        self.assertIn("完整菜單＋官方紀錄", app_js)
        self.assertIn("已設為預設學校，會隨帳號同步。", app_js)
        self.assertIn('id="accountIntentNotice"', index_html)
        self.assertIn("登入後會將${school.name}設為預設學校。", app_js)
        self.assertNotIn('setSchoolDataScope(`登入後會把', app_js)
        self.assertIn("LunchDateContext.closestMealDate", app_js)
        self.assertIn("preferClosest = !state.account.authenticated", app_js)
        self.assertIn('id="officialSourceLink"', index_html)
        self.assertIn('src="./official-diet.js"', index_html)
        self.assertIn("officialDashboardFromStatic", app_js)
        self.assertIn("依官方菜名的「素」字拆分主食、主菜與副菜", app_js)
        self.assertIn("不等同素食認證", app_js)
        self.assertIn("schoolId=", app_js)
        self.assertNotIn("demeter-favorite-school-id", app_js)
        self.assertIn('fetch("/api/account/default-school"', app_js)
        self.assertIn("renderAccountIntentNotice", app_js)
        self.assertIn("renderNoSchoolSelected", app_js)
        self.assertIn("fetchSchoolDirectory", app_js)
        self.assertIn("initialize();", app_js)

    def test_food_passport_is_visible_but_gated_until_free_login(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        index_html = (project_root / "web" / "index.html").read_text(encoding="utf-8")
        app_js = (project_root / "web" / "app.js").read_text(encoding="utf-8")

        self.assertIn('id="passport"', index_html)
        self.assertIn('id="passportLocked"', index_html)
        self.assertLess(
            index_html.index('id="traceability"'),
            index_html.index('id="passport"'),
        )
        self.assertLess(
            index_html.index('id="passport"'),
            index_html.index('id="standard"'),
        )
        self.assertIn("免費登入後開啟", index_html)
        self.assertIn('id="passportUnlock" type="button" aria-disabled="false"', index_html)
        self.assertIn("家長 Email", index_html)
        self.assertIn('id="authBirthDate"', index_html)
        self.assertIn("只用來確認已滿 18 歲；完整生日不會保存", index_html)
        self.assertIn("此帳號不由孩子自行使用", index_html)
        self.assertNotIn("signin-with-chatgpt", index_html)
        self.assertNotIn("我已滿 13 歲", index_html)
        self.assertIn('id="requestAuthCode" type="submit" aria-disabled="false"', index_html)
        self.assertIn("驗證碼會寄到你的信箱，10 分鐘內有效", index_html)
        self.assertIn("const EMAIL_REGISTRATION_ENABLED = true", app_js)
        self.assertIn('fetch("/api/auth/request-code"', app_js)
        self.assertIn('fetch("/api/auth/verify-code"', app_js)
        self.assertIn('fetch("/api/auth/sign-out"', app_js)
        self.assertIn('fetch("/api/account"', app_js)
        self.assertIn('fetch("/api/account/child"', app_js)
        self.assertIn('fetch("/api/account/encounters"', app_js)
        self.assertIn('id="cancelChildEdit"', index_html)
        self.assertIn('id="childSchool"', index_html)
        self.assertIn('id="passportSchoolNotice"', index_html)
        self.assertIn('id="editChildFromSchoolPicker"', index_html)
        self.assertIn("僅切換公開午餐", app_js)
        self.assertIn('node("details", "encounter-item")', app_js)
        self.assertIn("encounterMealSnapshot", app_js)
        self.assertIn("不會拿別天的內容代替", app_js)
        self.assertIn("來源菜色：", app_js)
        self.assertIn("舊紀錄未記錄菜色來源", app_js)
        self.assertIn('input.name = "dishSource"', app_js)
        self.assertIn("mealContext", app_js)
        self.assertIn("dishName", app_js)
        self.assertIn("今天午餐從哪一道菜開始記？", index_html)
        self.assertIn("家裡／其他地方吃到", app_js)
        self.assertIn("孩子的營養午餐紀錄", index_html)
        self.assertIn("家裡或其他場合也能另外記錄", index_html)
        self.assertIn("孩子午餐紀錄所屬學校", index_html)
        self.assertIn("儲存午餐紀錄", index_html)
        self.assertIn("這次午餐，孩子有吃這個食物嗎？", index_html)
        self.assertIn('name="experience" value="ate_most"', index_html)
        self.assertIn('name="experience" value="finished"', index_html)
        self.assertIn('id="noEatDetails" hidden', index_html)
        self.assertIn('name="noEatContact" value="touched"', index_html)
        self.assertIn("孩子以前吃過這個食物嗎？", index_html)
        self.assertIn('name="familiarity" value="previous"', index_html)
        self.assertIn("孩子對這個食物的感覺如何？", index_html)
        self.assertIn('type="radio" name="reaction" value="loved"', index_html)
        self.assertIn("很喜歡", index_html)
        self.assertIn('name="reaction" value="disliked"', index_html)
        self.assertIn('id="encounterChildQuote"', index_html)
        self.assertIn('id="allEncounterRecords" href="./records.html"', index_html)
        self.assertIn("encounterCount <= 5", app_js)
        self.assertIn("reactions,", app_js)
        self.assertIn("childQuote:", app_js)
        self.assertIn('experience === "not_eaten"', app_js)
        self.assertIn('familiarity === "first" ? true', app_js)
        self.assertIn("refs.encounterForm.hidden = mismatch || missing", app_js)
        self.assertIn("if (!isViewingChildSchool())", app_js)
        self.assertIn("請先回到孩子就讀學校，再新增午餐紀錄", app_js)
        self.assertIn("if (state.account.child) renderPassportFoodChoices()", app_js)
        self.assertIn("if (state.account.child) refs.encounterForm.hidden = true", app_js)
        self.assertIn("enableRadioDeselection", app_js)
        self.assertIn('event.key !== "Spacebar"', app_js)
        self.assertIn("再次按已選項目可以取消", index_html)

    def test_passport_copy_avoids_eating_pressure(self) -> None:
        index_html = (
            Path(__file__).resolve().parents[1] / "web" / "index.html"
        ).read_text(encoding="utf-8")

        self.assertIn("不要求吃光", index_html)
        self.assertIn("不把孩子貼上挑食標籤", index_html)
        self.assertIn("不是分數，是經驗", index_html)

    def test_complete_lunch_records_page_groups_days_by_month(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        records_html = (project_root / "web" / "records.html").read_text(encoding="utf-8")
        records_js = (project_root / "web" / "records.js").read_text(encoding="utf-8")

        self.assertIn("全部午餐紀錄", records_html)
        self.assertIn('id="monthJump"', records_html)
        self.assertIn("只呈現有留下紀錄的日子", records_html)
        self.assertIn('fetch("/api/account/encounters"', records_js)
        self.assertIn("mealDate.slice(0, 7)", records_js)
        self.assertIn("查看當天完整午餐", records_js)
        self.assertIn("不會拿別天的內容代替", records_js)
        self.assertIn("舊紀錄未記錄菜色來源", records_js)

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
        index_html = (project_root / "web" / "index.html").read_text(encoding="utf-8")
        styles = (project_root / "web" / "styles.css").read_text(encoding="utf-8")

        self.assertIn("DISH_DETAIL_MOTION_MS = 360", app_js)
        self.assertIn('classList.add("is-visible")', app_js)
        self.assertIn('id="dishDetailDialog" tabindex="-1"', index_html)
        self.assertIn("dishDetailDialog.focus({ preventScroll: true })", app_js)
        self.assertIn('addEventListener("cancel"', app_js)
        self.assertIn(".dish-detail-dialog.is-visible", styles)
        self.assertIn(".dish-detail-dialog:focus { outline: none; }", styles)
        self.assertIn(".dish-detail-close:focus-visible", styles)
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

    def test_school_picker_keeps_the_full_district_name_visible(self) -> None:
        styles = (
            Path(__file__).resolve().parents[1] / "web" / "styles.css"
        ).read_text(encoding="utf-8")
        tablet_rules = styles[
            styles.index("@media (max-width: 1050px)"):
            styles.index("@media (max-width: 720px)")
        ]

        self.assertIn("minmax(190px, .7fr) minmax(190px, 1fr) auto", styles)
        self.assertIn("minmax(190px, .8fr) minmax(150px, 1fr)", tablet_rules)
        self.assertIn(".default-school-button { grid-column: 1 / -1; }", tablet_rules)

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

    def test_local_admin_exposes_read_only_status_controls(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        admin_html = (project_root / "admin" / "index.html").read_text(
            encoding="utf-8"
        )
        admin_js = (project_root / "admin" / "admin.js").read_text(
            encoding="utf-8"
        )

        self.assertIn("本機後台", admin_html)
        self.assertIn('id="refreshButton"', admin_html)
        self.assertIn('id="runUpdateButton"', admin_html)
        self.assertIn('id="copyPublishButton"', admin_html)
        self.assertIn('href="/api/admin/status"', admin_html)
        self.assertIn('fetch("/api/admin/status"', admin_js)
        self.assertIn('fetch("/api/admin/update"', admin_js)
        self.assertIn('method: "POST"', admin_js)
        self.assertNotIn("fatrace_access_code", admin_html)


if __name__ == "__main__":
    unittest.main()
