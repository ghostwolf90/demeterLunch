from pathlib import Path
import json
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class LunchTownTests(unittest.TestCase):
    def read(self, relative: str) -> str:
        return (PROJECT_ROOT / relative).read_text(encoding="utf-8")

    def test_town_is_a_separate_accessible_page(self) -> None:
        html = self.read("web/lunch-town/index.html")
        self.assertIn("<title>營養午餐小鎮｜好好吃飯</title>", html)
        self.assertIn('id="townCanvas" width="960" height="640" tabindex="0" role="application"', html)
        self.assertIn('id="townAnnouncement" aria-live="polite"', html)
        self.assertIn('id="mealDialog" aria-labelledby="mealDialogTitle"', html)
        self.assertIn('id="npcDialogue" role="dialog" aria-modal="false"', html)
        self.assertIn('href="/lunch-town/">2D 午餐小鎮</a>', self.read("web/index.html"))
        self.assertNotIn("lunch-island", html)

    def test_town_is_original_retro_canvas_without_threejs(self) -> None:
        html = self.read("web/lunch-town/index.html")
        app = self.read("web/lunch-town/app.js")
        styles = self.read("web/lunch-town/styles.css")
        self.assertIn("探索街區依主題編排；行政位置與比例請以官方地圖為準", html)
        self.assertNotIn("three.module", html.lower())
        self.assertNotIn("THREE.", app)
        self.assertIn("context.imageSmoothingEnabled = false", app)
        self.assertIn("image-rendering: pixelated", styles)
        self.assertIn("prefers-reduced-motion: reduce", styles)

    def test_town_supports_keyboard_touch_and_direct_school_selection(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        self.assertIn("directionForKey(event.key)", app)
        self.assertIn("interactWithNearbyTarget", app)
        self.assertIn("canvas.addEventListener(\"pointerdown\"", app)
        self.assertIn("button[data-direction]", app)
        self.assertIn('data-action="interact"', html)
        self.assertIn("state.moveTarget = point", app)

    def test_town_uses_reviewed_school_data_without_date_fallback(self) -> None:
        app = self.read("web/lunch-town/app.js")
        self.assertIn('const endpoints = ["/data/schools.json", "/api/schools"]', app)
        self.assertIn('/data/school-meals/${encodeURIComponent(school.fatraceSchoolId)}.json', app)
        self.assertIn("payload.records?.[date] || null", app)
        self.assertIn("payload.record ?? payload.officialRecord ?? null", app)
        self.assertNotIn("Object.values(payload.records", app)
        self.assertIn("loadAccountPreference", app)

    def test_town_has_varied_campuses_and_living_streets(self) -> None:
        app = self.read("web/lunch-town/app.js")
        for facility in ("playground", "garden", "track", "court", "library"):
            self.assertIn(f'"{facility}"', app)
        for theme in ("brick", "fence", "lamps", "hedge", "open", "mixed"):
            self.assertIn(f'"{theme}"', app)
        self.assertIn("createTownCharacters", app)
        self.assertIn("drawPerson", app)
        self.assertIn("drawPet", app)
        self.assertIn("drawTownSquare", app)
        self.assertIn("drawMarketStall", app)
        self.assertIn("campusBoundaryRects", app)
        self.assertIn('if (layout.compact || layout.theme === "open") return []', app)
        self.assertIn('if (layout.facility === "library")', app)

    def test_town_characters_have_distinct_profiles_and_directional_animation(self) -> None:
        app = self.read("web/lunch-town/app.js")
        for role in ("student", "teacher", "cook", "nurse", "crossing-guard", "gardener"):
            self.assertIn(f'role: "{role}"', app)
        for detail in ("hairStyle", "expression", "accessory", "drawCharacterHair", "drawCharacterFace", "drawCharacterAccessory"):
            self.assertIn(detail, app)
        self.assertIn('direction === "up"', app)
        self.assertIn('direction === "down"', app)
        self.assertIn("armSwing", app)
        self.assertIn("legSwing", app)

    def test_town_contains_all_29_districts_and_camera_following(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        themes = json.loads(self.read("web/lunch-town/taichung-district-themes.json"))
        self.assertEqual(len(themes["districts"]), 29)
        self.assertEqual(len({item["name"] for item in themes["districts"]}), 29)
        self.assertEqual(
            {item["name"] for item in themes["districts"]},
            {
                "中區", "東區", "南區", "西區", "北區", "西屯區", "南屯區", "北屯區",
                "后里區", "神岡區", "大雅區", "豐原區", "潭子區", "石岡區", "東勢區", "新社區", "和平區",
                "大安區", "大甲區", "外埔區", "沙鹿區", "清水區", "梧棲區", "龍井區", "大肚區",
                "烏日區", "大里區", "霧峰區", "太平區",
            },
        )
        self.assertEqual(
            {group: sum(item["group"] == group for item in themes["districts"]) for group in ("海線", "城區", "山線", "屯區")},
            {"海線": 8, "城區": 8, "山線": 9, "屯區": 4},
        )
        for item in themes["districts"]:
            self.assertTrue(item["tagline"])
            self.assertTrue(item["feature"])
            self.assertTrue(item["dialogue"])
            self.assertTrue(item["sourceUrl"].startswith("https://"))
        self.assertIn('fetch("./taichung-district-themes.json"', app)
        self.assertIn("configureDistrictThemes", app)
        self.assertIn("createSchoolLayouts", app)
        self.assertIn("WORLD_WIDTH", app)
        self.assertIn("updateCamera", app)
        self.assertIn("state.camera.x", app)
        self.assertNotIn(".slice(0, layouts.length)", app)
        self.assertNotIn("SHOWCASE_DISTRICT =", app)
        self.assertIn("臺中 29 區營養午餐小鎮", html)
        self.assertIn("探索街區依主題編排；行政位置與比例請以官方地圖為準", html)

    def test_npcs_are_named_role_matched_and_support_varied_dialogue(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        themes = self.read("web/lunch-town/taichung-district-themes.json")
        self.assertIn("DISTRICT_DISPLAY_ORDER.flatMap", app)
        self.assertIn("CHILD_NAMES", app)
        for name in ("小晴", "米糰營養師", "紅豆廚房阿姨", "青芽護理師", "橘帽導護員", "樹叔園丁"):
            self.assertIn(name, app)
        for token in ("student: [", "teacher: [", "nutritionist: [", "cook: [", "nurse: [", '"crossing-guard": [', "gardener: ["):
            self.assertIn(token, app)
        for behavior in ("nearbyNpc", "openNpcDialogue", "advanceNpcDialogue", "closeNpcDialogue", "drawNearbyNpcMarker"):
            self.assertIn(behavior, app)
        self.assertNotIn("虛構角色", html)
        self.assertNotIn("虛構角色", app)
        for draft_word in ("模擬", "測試", "示範", "虛構", "開發中", "預覽版"):
            self.assertNotIn(draft_word, html)
            self.assertNotIn(draft_word, app)
            self.assertNotIn(draft_word, themes)
        self.assertIn('accessory: "clipboard"', app)
        self.assertIn('accessory: "flag"', app)
        self.assertIn('accessory: "medical"', app)

    def test_town_draws_distinct_officially_sourced_district_features(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        for feature in ("wetland", "harbor", "wheat", "opera", "mansion-fog", "atayal-spring", "station-watermelon"):
            self.assertIn(f'feature === "{feature}"', app)
        self.assertIn("drawDistrictFeatures", app)
        self.assertIn("drawDistrictFeature", app)
        self.assertIn('id="districtSource"', html)
        self.assertIn("官方特色來源", html)

    def test_framework_route_serves_the_town_page(self) -> None:
        route = self.read("app/lunch-town/route.ts")
        self.assertIn('import lunchTownHtml from "@/web/lunch-town/index.html?raw";', route)
        self.assertIn("new Response(lunchTownHtml", route)


if __name__ == "__main__":
    unittest.main()
