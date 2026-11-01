from pathlib import Path
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class LunchIslandTests(unittest.TestCase):
    def read(self, relative: str) -> str:
        return (PROJECT_ROOT / relative).read_text(encoding="utf-8")

    def test_lunch_island_is_a_separate_accessible_page(self) -> None:
        html = self.read("web/lunch-island/index.html")
        self.assertIn("<title>午餐群島｜好好吃飯</title>", html)
        self.assertIn('id="islandCanvas" tabindex="0" role="img"', html)
        self.assertIn('id="exploreList" aria-label=', html)
        self.assertIn('id="selectionAnnouncement" aria-live="polite"', html)
        self.assertIn('id="islandSearch" type="search"', html)
        self.assertIn('id="islandLabels" aria-label="地圖標籤"', html)
        self.assertIn('href="/lunch-island/">午餐群島</a>', self.read("web/index.html"))

    def test_initial_view_is_the_single_taichung_west_showcase_island(self) -> None:
        html = self.read("web/lunch-island/index.html")
        app = self.read("web/lunch-island/app.js")
        scene = self.read("web/lunch-island/scene.js")
        styles = self.read("web/lunch-island/styles.css")
        self.assertIn('fetch("/api/account"', app)
        self.assertIn("accountPreference?.defaultSchoolId", app)
        self.assertIn('const SHOWCASE_DISTRICT = "西區"', app)
        self.assertIn("showShowcase();", app)
        self.assertIn('state.scene?.setContent("showcase"', app)
        self.assertIn('data-overview-city="臺中市"', html)
        self.assertIn('data-overview-city="臺南市"', html)
        self.assertIn('id="overviewCityTabs" aria-label="選擇城市群島" hidden', html)
        self.assertNotIn('data-overview-city="all"', html)
        self.assertIn("buildShowcaseIsland(root, items, context)", scene)
        self.assertIn("const islandRadius = 8.45", scene)
        self.assertIn("grid-column: 2", styles)

    def test_showcase_island_has_moving_clickable_characters(self) -> None:
        app = self.read("web/lunch-island/app.js")
        scene = self.read("web/lunch-island/scene.js")
        self.assertIn("createShowcaseCharacterRoster(schools)", app)
        self.assertIn("createShowcasePetRoster(schools)", app)
        self.assertIn("context.characters || []", scene)
        self.assertIn("this.addCharacter(root, item", scene)
        self.assertIn("this.addPet(root, item", scene)

    def test_islands_have_bounded_procedural_campus_props(self) -> None:
        scene = self.read("web/lunch-island/scene.js")
        self.assertIn("addDistrictProps", scene)
        self.assertIn("addCampusProps", scene)
        for helper in (
            "addSchoolBus",
            "addNoticeBoard",
            "addBikeParking",
            "addRecycleStation",
            "addOutdoorTable",
            "addDrinkingFountain",
            "addSolarArray",
            "addSchoolClock",
            "addCampusFence",
        ):
            self.assertIn(helper, scene)
        self.assertIn("const lampPositions = coarsePointer", scene)
        self.assertIn("const count = compact ? 20 : 36", self.read("web/lunch-island/app.js"))

    def test_city_is_a_continuous_zoomable_world_without_drilldown_scene_switches(self) -> None:
        app = self.read("web/lunch-island/app.js")
        scene = self.read("web/lunch-island/scene.js")
        selection = app[app.index("function handleItemSelection"):app.index("function handleSceneHover")]
        self.assertIn('state.scene?.focusItem(item, { radius: 4.4 })', selection)
        self.assertIn('state.scene?.focusItem(item, { radius: 2.7 })', selection)
        self.assertNotIn("showSchools(item.district)", selection)
        self.assertNotIn("showMeal(item.school)", selection)
        self.assertIn('schools: schoolItems', app)
        self.assertIn("addDistrictSchoolCluster", scene)
        self.assertIn("focusItem(item", scene)
        self.assertIn(", 2.2, 32)", scene)

    def test_people_have_arms_varied_faces_and_a_visible_walk_cycle(self) -> None:
        app = self.read("web/lunch-island/app.js")
        scene = self.read("web/lunch-island/scene.js")
        self.assertIn("expressionSeed", app)
        self.assertIn("const leftArm = new THREE.Group()", scene)
        self.assertIn("mouthOpenGeometry", scene)
        self.assertIn("character.leftArm.rotation.x", scene)
        self.assertIn("character.leftLeg.rotation.x", scene)
        self.assertIn("lift * (character.item.kind", scene)
        self.assertIn("headingDelta", scene)
        self.assertIn("speed: 0.18 +", app)

    def test_people_are_easy_to_select_and_follow_at_close_range(self) -> None:
        scene = self.read("web/lunch-island/scene.js")
        self.assertIn("hitGeometry", scene)
        self.assertIn("this.makePickable(hitTarget, item)", scene)
        self.assertIn("this.targetRadius = coarsePointer ? 3.6 : 2.6", scene)
        self.assertIn("this.followMarker.scale.setScalar(pulse)", scene)

    def test_district_islands_have_deterministic_shape_variants(self) -> None:
        scene = self.read("web/lunch-island/scene.js")
        self.assertIn("addVariedDistrictIsland", scene)
        self.assertIn("const variant = seed % 6", scene)
        self.assertIn("const lobe = new THREE.Group()", scene)
        self.assertIn("const terrace = new THREE.Mesh", scene)
        self.assertIn("const cove = new THREE.Mesh", scene)

    def test_districts_are_dense_themed_neighborhoods(self) -> None:
        scene = self.read("web/lunch-island/scene.js")
        self.assertIn("addDistrictGroundNetwork", scene)
        self.assertIn("addDistrictThemeZone", scene)
        self.assertIn("const theme = seed % 8", scene)
        self.assertIn("const visibleCount = Math.min(schools.length, coarsePointer ? 3 : 5)", scene)
        self.assertIn("const treeCount = coarsePointer ? 4 : 7 + (seed % 3)", scene)
        self.assertIn("const labelStep = coarsePointer ? 3 : 2", scene)

    def test_showcase_uses_six_distinct_school_modules_and_dense_props(self) -> None:
        app = self.read("web/lunch-island/app.js")
        scene = self.read("web/lunch-island/scene.js")
        self.assertIn("visualType: index", app)
        self.assertIn("Number.isInteger(item.visualType)", scene)
        self.assertIn("const schoolPositions = [", scene)
        self.assertIn("this.addSchoolBus(root", scene)
        self.assertIn("this.addBikeParking(root", scene)
        self.assertIn("this.addNoticeBoard(root", scene)
        self.assertIn("this.addRecycleStation(root", scene)
        self.assertIn("this.addDrinkingFountain(root", scene)
        self.assertIn("this.addSolarArray(root", scene)
        self.assertIn("this.addOutdoorTable(root", scene)
        self.assertIn("const treeCount = coarsePointer ? 22 : 38", scene)

    def test_character_selection_supports_camera_follow_mode(self) -> None:
        app = self.read("web/lunch-island/app.js")
        scene = self.read("web/lunch-island/scene.js")
        self.assertIn("state.scene?.followCharacter(item)", app)
        self.assertIn("followCharacter(item)", scene)
        self.assertIn("getWorldPosition(this.followPosition)", scene)
        self.assertIn("stopFollowing(resetView = false)", scene)
        self.assertIn("可拖曳場景、按 Escape 或關閉資料卡退出跟隨", app)

    def test_three_is_vendored_and_only_loaded_on_island_page(self) -> None:
        html = self.read("web/lunch-island/index.html")
        scene = self.read("web/lunch-island/scene.js")
        homepage = self.read("web/index.html")
        self.assertIn('./vendor/three.module.min.js', html)
        self.assertIn('from "./vendor/three.module.min.js"', scene)
        self.assertNotIn("three.module", homepage)
        self.assertTrue((PROJECT_ROOT / "web/lunch-island/vendor/THREE-LICENSE.txt").is_file())

    def test_island_builds_varied_connected_school_campuses(self) -> None:
        app = self.read("web/lunch-island/app.js")
        scene = self.read("web/lunch-island/scene.js")
        self.assertIn("const CAMPUS_TYPES =", app)
        self.assertIn("addBridgeBetween", scene)
        self.assertIn("addSchoolMarker", scene)
        self.assertIn("addCampusBuilding", scene)
        self.assertIn("addPlayground", scene)

    def test_campus_characters_are_fictional_and_performance_bounded(self) -> None:
        app = self.read("web/lunch-island/app.js")
        scene = self.read("web/lunch-island/scene.js")
        self.assertIn("const count = compact ? 16 : 26", app)
        self.assertIn("createCharacterRoster", app)
        self.assertIn("程序生成的虛構模擬人物", app)
        self.assertIn("addCharacter", scene)
        self.assertIn("characterFrameInterval = coarsePointer ? 34 : 17", scene)

    def test_campus_pets_are_occasional_fictional_characters(self) -> None:
        html = self.read("web/lunch-island/index.html")
        app = self.read("web/lunch-island/app.js")
        scene = self.read("web/lunch-island/scene.js")
        self.assertIn('data-list-filter="pet"', html)
        self.assertIn("createPetRoster", app)
        self.assertIn("if (appearanceRoll >= 48) return []", app)
        self.assertIn("不代表學校真的飼養或出現這隻動物", app)
        self.assertIn("addPet", scene)

    def test_island_uses_split_data_loading_without_date_fallback(self) -> None:
        app = self.read("web/lunch-island/app.js")
        self.assertIn('const endpoints = ["/data/schools.json", "/api/schools"]', app)
        self.assertIn('/data/school-meals/${encodeURIComponent(schoolId)}.json', app)
        self.assertIn('payload.record ?? payload.officialRecord ?? null', app)
        self.assertIn('record: records[date] || null', app)
        self.assertNotIn("records[date] || records[", app)
        self.assertIn('state.scene?.setContent("meal", []', app)

    def test_framework_route_serves_the_island_page(self) -> None:
        route = self.read("app/lunch-island/route.ts")
        self.assertIn('import lunchIslandHtml from "@/web/lunch-island/index.html?raw";', route)
        self.assertIn("new Response(lunchIslandHtml", route)


if __name__ == "__main__":
    unittest.main()
