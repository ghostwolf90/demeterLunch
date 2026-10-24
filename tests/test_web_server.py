import json
import re
import struct
import tempfile
import unittest
from pathlib import Path
from urllib.parse import unquote, urlsplit

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

    def test_news_page_keeps_the_consistent_desktop_navigation(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        index_html = (project_root / "web" / "index.html").read_text(encoding="utf-8")
        news_html = (project_root / "web" / "news.html").read_text(encoding="utf-8")
        expected_labels = ["今日菜單", "本週菜單", "食材來源", "飲食紀錄", "營養基準", "供應趨勢", "午餐消息", "支援中心"]

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
        self.assertNotIn('href="/schools">學校目錄</a>', re.search(
            r'<nav aria-label="主要導覽">(.*?)</nav>',
            index_html,
            re.DOTALL,
        ).group(1))
        self.assertIn('href="/schools">學校目錄</a>', index_html)
        self.assertIn('href="/schools">學校目錄</a>', news_html)
        self.assertIn('href="/#news">午餐消息</a>', news_html)
        self.assertIn('id="newsAccountButton" data-account-panel-trigger type="button"', news_html)
        self.assertIn('<strong data-account-label>帳號</strong><small data-account-status>未登入</small>', news_html)
        self.assertIn('/account-panel.js?v=20261023-family-copy', news_html)

    def test_static_fragment_links_point_to_existing_sections(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        web_root = project_root / "web"
        html_pages = list(web_root.rglob("*.html"))

        def route_file(path: str, source: Path) -> Path:
            if path.startswith("/"):
                candidate = web_root / unquote(path.lstrip("/"))
            else:
                candidate = source.parent / unquote(path)
            if path in ("", "/"):
                candidate = source if path == "" else web_root / "index.html"
            elif candidate.suffix == "":
                candidate = candidate / "index.html"
            return candidate.resolve()

        ids_by_page: dict[Path, set[str]] = {}
        duplicate_ids: list[str] = []
        for page in html_pages:
            html = page.read_text(encoding="utf-8")
            page_ids = re.findall(r'\bid=["\']([^"\']+)["\']', html)
            duplicates = sorted({page_id for page_id in page_ids if page_ids.count(page_id) > 1})
            duplicate_ids.extend(f"{page.relative_to(web_root)}#{page_id}" for page_id in duplicates)
            ids_by_page[page.resolve()] = set(page_ids)
        self.assertEqual(duplicate_ids, [], f"Duplicate HTML ids: {duplicate_ids}")

        missing_targets: list[str] = []
        for page in html_pages:
            html = page.read_text(encoding="utf-8")
            for href in re.findall(r'\bhref=["\']([^"\']+)["\']', html):
                parsed = urlsplit(href)
                if not parsed.fragment or parsed.scheme or parsed.netloc:
                    continue
                target_page = route_file(parsed.path, page)
                if target_page not in ids_by_page:
                    missing_targets.append(f"{page.relative_to(web_root)} -> {href} (missing page)")
                    continue
                if unquote(parsed.fragment) not in ids_by_page[target_page]:
                    missing_targets.append(f"{page.relative_to(web_root)} -> {href} (missing id)")

        for script in web_root.glob("*.js"):
            source = script.read_text(encoding="utf-8")
            for href in re.findall(r'\.href\s*=\s*["\']([^"\']+#[^"\']+)["\']', source):
                parsed = urlsplit(href)
                if parsed.scheme or parsed.netloc:
                    continue
                target_page = route_file(parsed.path, script)
                if target_page not in ids_by_page:
                    missing_targets.append(f"{script.relative_to(web_root)} -> {href} (missing page)")
                    continue
                if unquote(parsed.fragment) not in ids_by_page[target_page]:
                    missing_targets.append(f"{script.relative_to(web_root)} -> {href} (missing id)")
        self.assertEqual(missing_targets, [], f"Broken fragment links: {missing_targets}")

    def test_homepage_restores_cross_page_fragment_after_async_layout(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        app_js = (project_root / "web" / "app.js").read_text(encoding="utf-8")

        for section_id in ("today", "week", "traceability", "passport", "standard", "insights"):
            self.assertIn(f'"{section_id}"', app_js)
        self.assertIn("async function restoreInitialSectionPosition()", app_js)
        self.assertIn("const initialSectionId = sectionIdFromHash(window.location.hash);", app_js)
        self.assertIn("target.scrollIntoView({ block: \"start\" })", app_js)
        self.assertIn("await restoreInitialSectionPosition();", app_js)
        self.assertLess(
            app_js.index("await loadDashboard(localIsoDate());"),
            app_js.index("await restoreInitialSectionPosition();"),
        )

    def test_information_pages_share_home_story_and_account_navigation(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        account_js = (project_root / "web" / "account-panel.js").read_text(encoding="utf-8")
        app_js = (project_root / "web" / "app.js").read_text(encoding="utf-8")
        pages = [
            project_root / "web" / page / "index.html"
            for page in ("support", "privacy", "terms", "about")
        ]
        for page in pages:
            html = page.read_text(encoding="utf-8")
            navigation = re.search(
                r'<nav aria-label="主要導覽">(.*?)</nav>',
                html,
                re.DOTALL,
            )
            self.assertIsNotNone(navigation)
            self.assertEqual(
                re.findall(r'<a[^>]*>([^<]+)</a>', navigation.group(1)),
                ["回到首頁", "品牌故事"],
            )
            self.assertIn('data-account-panel-trigger type="button" aria-haspopup="dialog"', html)
            self.assertNotIn('href="/?account=1"', html)
            self.assertIn('<span class="account-avatar" data-account-avatar', html)
            self.assertIn('<strong data-account-label>帳號</strong><small data-account-status>未登入</small>', html)
            self.assertIn('/account-panel.js?v=20261023-family-copy', html)

        support_html = pages[0].read_text(encoding="utf-8")
        self.assertNotIn("自動扣款", support_html)
        self.assertIn('"/api/account"', account_js)
        self.assertIn('fetch(accountEndpoint(childId)', account_js)
        self.assertIn('credentials: "same-origin"', account_js)
        self.assertIn('profile?.displayName || profile?.nickname || profile?.name', account_js)
        self.assertIn('image.src = source', account_js)
        self.assertIn('if (label) label.textContent = displayName', account_js)
        self.assertIn('status.hidden = true', account_js)
        self.assertIn('dialog.showModal()', account_js)
        self.assertIn('if (event.target === refs.sharedAccountDialog) closeDialog()', account_js)
        self.assertIn('trigger?.isConnected) trigger.focus()', account_js)
        self.assertIn('fetch("/api/account/profile"', account_js)
        self.assertIn('fetch("/api/account/child"', account_js)
        self.assertIn('fetch("/api/auth/request-code"', account_js)
        self.assertIn('fetch("/api/auth/sign-out"', account_js)
        self.assertIn('url.searchParams.get("account") !== "1"', app_js)
        self.assertIn("openRequestedAccountDialog();", app_js)

    def test_brand_story_has_a_public_route_and_sitemap_entry(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        about_route = (project_root / "app" / "about" / "route.ts").read_text(encoding="utf-8")
        sitemap_route = (project_root / "app" / "sitemap.xml" / "route.ts").read_text(encoding="utf-8")

        self.assertIn('import aboutHtml from "@/web/about/index.html?raw";', about_route)
        self.assertIn("new Response(aboutHtml", about_route)
        self.assertIn("`${SITE_ORIGIN}/about`", sitemap_route)

    def test_site_exposes_meat_vegetarian_and_detail_controls(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        index_html = (project_root / "web" / "index.html").read_text(encoding="utf-8")
        app_js = (project_root / "web" / "app.js").read_text(encoding="utf-8")

        self.assertIn('id="mealTypeMeat"', index_html)
        self.assertIn('id="mealTypeVegetarian"', index_html)
        self.assertIn('id="openDetail"', index_html)
        self.assertIn('id="mainDishButton"', index_html)
        self.assertIn('id="dishDetailDialog"', index_html)
        self.assertIn("<title>好好吃飯｜國小營養午餐查詢、每日菜單與晚餐搭配</title>", index_html)
        self.assertIn(
            '<h1 class="eyebrow intro-service-heading">國小營養午餐查詢</h1>',
            index_html,
        )
        self.assertIn('<small id="brandSchoolLabel">孩子午餐，晚餐靈感</small>', index_html)
        self.assertNotIn("臺中市國小午餐助手", index_html)
        self.assertNotIn("document.title =", app_js)
        self.assertNotIn('id="recipeSourceDetails"', index_html)

    def test_dinner_suggestions_open_private_recipe_searches(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        index_html = (project_root / "web" / "index.html").read_text(encoding="utf-8")
        app_js = (project_root / "web" / "app.js").read_text(encoding="utf-8")
        styles = (project_root / "web" / "styles.css").read_text(encoding="utf-8")

        self.assertIn("點選餐點，另開新分頁搜尋做法", index_html)
        self.assertIn("食譜 做法 site:cookpad.com/tw", app_js)
        self.assertIn("encodeURIComponent(query)", app_js)
        self.assertIn('link.target = "_blank"', app_js)
        self.assertIn('link.rel = "noopener noreferrer"', app_js)
        self.assertIn('link.referrerPolicy = "no-referrer"', app_js)
        self.assertIn("的食譜，另開新分頁", app_js)
        self.assertIn("suggestion.recommendations.map(dinnerRecipeLink)", app_js)
        self.assertIn(".dinner-picks > a:focus-visible", styles)

    def test_homepage_declares_one_consistent_website_schema(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        index_html = (project_root / "web" / "index.html").read_text(encoding="utf-8")

        matches = re.findall(
            r'<script type="application/ld\+json">\s*(\{.*?\})\s*</script>',
            index_html,
            re.DOTALL,
        )
        schemas = [json.loads(match) for match in matches]
        website_schemas = [schema for schema in schemas if schema.get("@type") == "WebSite"]

        self.assertEqual(len(website_schemas), 1)
        self.assertEqual(
            website_schemas[0],
            {
                "@context": "https://schema.org",
                "@type": "WebSite",
                "name": "好好吃飯",
                "alternateName": ["HaoHaoFood", "haohaofood.cc"],
                "url": "https://haohaofood.cc/",
            },
        )
        self.assertIn('<meta property="og:site_name" content="好好吃飯" />', index_html)

    def test_school_pages_use_school_specific_lunch_metadata(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        route = (project_root / "app" / "schools" / "[schoolId]" / "route.ts").read_text(
            encoding="utf-8"
        )

        self.assertIn(
            "`${school.name}營養午餐｜每日菜單與食材資訊｜好好吃飯`",
            route,
        )
        self.assertIn("`查詢${school.fullName}已公布的每日營養午餐", route)
        self.assertIn("<h1>${escapeHtml(school.fullName)}<br /><em>營養午餐</em></h1>", route)

    def test_mobile_school_and_passport_actions_keep_readable_spacing(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        styles = (project_root / "web" / "styles.css").read_text(encoding="utf-8")
        school_styles = (project_root / "web" / "schools.css").read_text(
            encoding="utf-8"
        )

        self.assertIn(
            ".school-next-actions .primary-action { color: var(--white); }",
            school_styles,
        )
        self.assertIn(
            ".all-encounters-link { min-height: 45px; margin-top: 16px;",
            styles,
        )

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
        self.assertIn("LunchDateContext.latestMealDate", app_js)
        self.assertIn(
            "loadDashboard(localIsoDate(), { announce: true, preferLatest: true })",
            app_js,
        )
        self.assertNotIn("preferClosest = !state.account.authenticated", app_js)
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

    def test_public_data_loading_is_split_and_progressive(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        app_js = (project_root / "web" / "app.js").read_text(encoding="utf-8")
        records_js = (project_root / "web" / "records.js").read_text(encoding="utf-8")
        build_script = (project_root / "scripts" / "build_static_site.py").read_text(
            encoding="utf-8"
        )

        self.assertIn('fetch("./data/sample-data.json")', app_js)
        self.assertIn("publicSchoolMealData", app_js)
        self.assertIn("const sampleRequest = renderNoSchoolSelected();", app_js)
        self.assertLess(
            app_js.index("const sampleRequest = renderNoSchoolSelected();"),
            app_js.index("await accountRequest;"),
        )
        self.assertIn('const response = await fetch("./data/schools.json");', app_js)
        self.assertNotIn('fetch("/api/schools"', app_js)
        self.assertNotIn('fetch("./data/site-data.json", { cache: "no-store" })', app_js)
        self.assertNotIn('fetch("./data/site-data.json", { cache: "no-store" })', records_js)
        self.assertIn('data_output / "sample-data.json"', build_script)
        self.assertIn('data_output / "school-meals"', build_script)

    def test_food_passport_is_visible_but_gated_until_free_login(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        index_html = (project_root / "web" / "index.html").read_text(encoding="utf-8")
        news_html = (project_root / "web" / "news.html").read_text(encoding="utf-8")
        app_js = (project_root / "web" / "app.js").read_text(encoding="utf-8")
        news_js = (project_root / "web" / "news.js").read_text(encoding="utf-8")
        styles = (project_root / "web" / "styles.css").read_text(encoding="utf-8")

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
        self.assertIn("驗證碼 10 分鐘內有效", index_html)
        self.assertIn("const EMAIL_REGISTRATION_ENABLED = true", app_js)
        self.assertIn('fetch("/api/auth/request-code"', app_js)
        self.assertIn('fetch("/api/auth/verify-code"', app_js)
        self.assertIn('fetch("/api/auth/sign-out"', app_js)
        self.assertIn("fetch(accountEndpoint(childId)", app_js)
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
        self.assertIn("留一句原話、一點觀察或這次的感受，就能完成記錄", index_html)
        self.assertEqual(index_html.count('class="field-required">必填</span>'), 1)
        self.assertIn('id="passportOptionalDetails"', index_html)
        self.assertIn("補充更多細節", index_html)
        self.assertIn("家裡／其他地方吃到", app_js)
        self.assertIn("記錄孩子與食物的", index_html)
        self.assertIn("孩子提到哪一道菜、說了什麼", index_html)
        self.assertIn("孩子午餐紀錄所屬學校", index_html)
        self.assertIn("儲存飲食紀錄", index_html)
        self.assertIn("這次，孩子怎麼接觸這個食物？", index_html)
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
        self.assertIn('id="encounterNote" maxlength="240" rows="2"', index_html)
        self.assertIn(".passport-note-grid textarea { resize: vertical; }", styles)
        self.assertIn('id="allEncounterRecords" href="./records.html"', index_html)
        self.assertIn("encounterCount <= 3", app_js)
        self.assertIn("slice(0, 3)", app_js)
        self.assertIn('node("div", "encounter-detail-copy")', app_js)
        self.assertIn('"查看詳情"', app_js)
        self.assertIn('refs.customFoodName.setAttribute("aria-required"', app_js)
        self.assertIn('id="passportOptionalBadge"', index_html)
        self.assertIn("refs.passportOptionalDetails.open = true", app_js)
        self.assertIn("align-items: start", styles)
        self.assertNotIn("min-height: 530px", styles)
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
        self.assertIn("再點一次可以取消", index_html)

    def test_support_email_is_only_returned_to_authenticated_accounts(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        index_html = (project_root / "web" / "index.html").read_text(encoding="utf-8")
        app_js = (project_root / "web" / "app.js").read_text(encoding="utf-8")
        account_route = (project_root / "app" / "api" / "account" / "route.ts").read_text(
            encoding="utf-8"
        )

        self.assertIn('id="accountSupport" hidden', index_html)
        self.assertIn('id="accountSupportEmail"', index_html)
        self.assertNotIn("support@haohaofood.cc", index_html)
        self.assertNotIn("support@haohaofood.cc", app_js)
        self.assertIn('supportEmail: "support@haohaofood.cc"', account_route)
        self.assertIn('refs.accountSupport.hidden = !supportEmail;', app_js)
        self.assertLess(
            index_html.index('id="accountSignedInView"'),
            index_html.index('id="accountSupport"'),
        )
        unauthenticated_response = account_route[
            account_route.index("if (!user)"):
            account_route.index("try {")
        ]
        self.assertNotIn("supportEmail", unauthenticated_response)

    def test_legal_and_support_pages_match_the_deployed_service(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        index_html = (project_root / "web" / "index.html").read_text(encoding="utf-8")
        about_html = (project_root / "web" / "about" / "index.html").read_text(encoding="utf-8")
        privacy_html = (project_root / "web" / "privacy" / "index.html").read_text(encoding="utf-8")
        terms_html = (project_root / "web" / "terms" / "index.html").read_text(encoding="utf-8")
        support_html = (project_root / "web" / "support" / "index.html").read_text(encoding="utf-8")

        for page in (index_html, about_html, privacy_html, terms_html, support_html):
            self.assertIn('href="/about"', page)
            self.assertIn('href="/privacy"', page)
            self.assertIn('href="/terms"', page)
            self.assertIn('href="/support"', page)

        self.assertIn("好好吃飯，從每天的一餐開始", about_html)
        self.assertIn("飲食紀錄不是成績單", about_html)
        self.assertIn("知道多少，就說多少", about_html)

        self.assertIn("服務經營者：</strong>待確認", privacy_html)
        self.assertIn("出生日期只在提出驗證碼申請時用來判斷是否滿 18 歲", privacy_html)
        self.assertIn("目前尚未提供帳號內的一鍵停用或刪除功能", privacy_html)
        self.assertIn("Cloudflare Workers、D1、R2 與 CDN", privacy_html)
        self.assertIn("Resend", privacy_html)
        self.assertIn("Sentry", privacy_html)
        self.assertIn("未使用 Google Analytics", privacy_html)
        self.assertIn("2026 年 10 月 20 日", privacy_html)

        self.assertIn("不代表孩子實際攝取的營養量", terms_html)
        self.assertIn("未出現過敏提醒也不代表完全安全", terms_html)
        self.assertIn("現階段為免費服務", terms_html)
        self.assertIn("不排除或限制法律上不得排除的責任", terms_html)

        self.assertIn("support@haohaofood.cc", support_html)
        self.assertIn("客服不會索取驗證碼", support_html)
        self.assertIn("請使用家庭帳號的登入 Email", support_html)
        self.assertIn("沒有站內客服表單或即時聊天", support_html)
        self.assertIn("繼續使用即表示你同意", index_html)

    def test_passport_copy_avoids_eating_pressure(self) -> None:
        index_html = (
            Path(__file__).resolve().parents[1] / "web" / "index.html"
        ).read_text(encoding="utf-8")

        self.assertIn("孩子提到哪一道菜、說了什麼", index_html)
        self.assertNotIn("成長中的飲食回憶", index_html)
        self.assertIn("最近留下的片刻", index_html)

    def test_registration_and_social_copy_matches_public_brand(self) -> None:
        index_html = (
            Path(__file__).resolve().parents[1] / "web" / "index.html"
        ).read_text(encoding="utf-8")

        self.assertIn("好好吃飯｜國小營養午餐查詢、每日菜單與晚餐搭配", index_html)
        self.assertIn("好好吃飯提供臺中市國小每日營養午餐查詢", index_html)
        self.assertIn("過敏原注意事項", index_html)
        self.assertNotIn("過敏安全保證", index_html)
        self.assertNotIn("查詢臺中市國小每日及每週營養午餐菜單", index_html)
        self.assertIn('property="og:title"', index_html)
        self.assertIn('name="twitter:card" content="summary_large_image"', index_html)
        self.assertIn("免費建立家庭帳號", index_html)
        self.assertIn("替孩子留一份飲食紀錄", index_html)
        self.assertIn("登入後，可以保存孩子提過的食物、說過的話", index_html)
        self.assertIn("免費建立 1 位孩子的飲食紀錄", index_html)
        self.assertIn('placeholder="請輸入電子郵件"', index_html)
        self.assertIn("寄送登入驗證碼", index_html)
        self.assertIn("不需要設定密碼，透過 Email 驗證即可登入。", index_html)
        self.assertIn("只想查看學校午餐嗎？不需要註冊，也能免費使用。", index_html)
        signed_out_view = index_html[
            index_html.index('id="accountSignedOutView"'):
            index_html.index('id="accountSignedInView"')
        ]
        self.assertNotIn("ChatGPT", signed_out_view)
        self.assertNotIn("信用卡", signed_out_view)

    def test_brand_icon_assets_and_metadata_are_complete(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        web_root = project_root / "web"
        expected_png_sizes = {
            "favicon-16x16.png": (16, 16),
            "favicon-32x32.png": (32, 32),
            "apple-touch-icon.png": (180, 180),
            "icon-192x192.png": (192, 192),
            "icon-512x512.png": (512, 512),
            "og-image.png": (1200, 630),
        }

        for filename, expected_size in expected_png_sizes.items():
            data = (web_root / filename).read_bytes()
            self.assertEqual(data[:8], b"\x89PNG\r\n\x1a\n", filename)
            self.assertEqual(struct.unpack(">II", data[16:24]), expected_size, filename)

        favicon = (web_root / "favicon.ico").read_bytes()
        self.assertEqual(favicon[:4], b"\x00\x00\x01\x00")
        self.assertEqual(int.from_bytes(favicon[4:6], "little"), 3)

        manifest = json.loads((web_root / "site.webmanifest").read_text(encoding="utf-8"))
        self.assertEqual(manifest["short_name"], "好好吃飯")
        self.assertEqual(
            {(icon["sizes"], icon["purpose"]) for icon in manifest["icons"]},
            {("192x192", "any maskable"), ("512x512", "any maskable")},
        )

        pages = [
            web_root / "index.html",
            web_root / "news.html",
            web_root / "records.html",
            web_root / "about" / "index.html",
            web_root / "privacy" / "index.html",
            web_root / "terms" / "index.html",
            web_root / "support" / "index.html",
        ]
        for page in pages:
            html = page.read_text(encoding="utf-8")
            if page.name == "index.html" and page.parent == web_root:
                self.assertIn('/favicon.ico" type="image/x-icon" sizes="16x16 32x32 48x48"', html)
                self.assertIn('/icon-192x192.png?v=20261020', html)
            else:
                self.assertIn('/favicon.ico?v=20261020', html, page.name)
            self.assertIn('/apple-touch-icon.png?v=20261020', html, page.name)
            self.assertIn('/site.webmanifest?v=20261022-child-meals', html, page.name)
            self.assertIn('https://haohaofood.cc/og-image.png?v=20261020', html, page.name)
            self.assertIn('class="brand-mark" src="/icon-192x192.png?v=20261020"', html, page.name)
            self.assertNotIn("favicon.svg", html, page.name)

    def test_complete_lunch_records_page_groups_days_by_month(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        records_html = (project_root / "web" / "records.html").read_text(encoding="utf-8")
        records_js = (project_root / "web" / "records.js").read_text(encoding="utf-8")

        self.assertIn("全部飲食紀錄", records_html)
        self.assertIn('id="monthJump"', records_html)
        self.assertIn("都依記錄的日期保存在這裡", records_html)
        self.assertIn('/api/account/encounters?childId=', records_js)
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

    def test_desktop_header_omits_redundant_status_and_does_not_wrap_navigation(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        index_html = (project_root / "web" / "index.html").read_text(encoding="utf-8")
        news_html = (project_root / "web" / "news.html").read_text(encoding="utf-8")
        app_js = (project_root / "web" / "app.js").read_text(encoding="utf-8")
        news_js = (project_root / "web" / "news.js").read_text(encoding="utf-8")
        styles = (project_root / "web" / "styles.css").read_text(encoding="utf-8")

        self.assertNotIn('id="syncStatus"', index_html)
        self.assertNotIn('id="syncStatusText"', index_html)
        self.assertNotIn('"syncStatus"', app_js)
        self.assertNotIn('id="newsSync"', news_html)
        self.assertNotIn('"newsSync"', news_js)
        self.assertIn('id="schoolDataScope" role="status"', index_html)
        self.assertIn(".topbar nav { min-width: 0;", styles)
        self.assertIn("white-space: nowrap;", styles)

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
