from pathlib import Path
import json
import re
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
        self.assertIn('href="/lunch-town/">午餐小鎮</a>', self.read("web/index.html"))
        self.assertNotIn("lunch-island", html)

    def test_town_is_original_retro_canvas_without_threejs(self) -> None:
        html = self.read("web/lunch-town/index.html")
        app = self.read("web/lunch-town/app.js")
        styles = self.read("web/lunch-town/styles.css")
        self.assertIn("臺中成就是第一冊，未來可以接著收藏其他縣市", html)
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

    def test_town_has_a_portrait_mobile_viewport_and_searchable_explore_sheet(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        styles = self.read("web/lunch-town/styles.css")
        self.assertIn('const MOBILE_VIEWPORT = { width: 480, height: 600 }', app)
        self.assertIn('window.matchMedia("(max-width: 680px)")', app)
        self.assertIn("configureCanvasViewport", app)
        self.assertIn("canvasWorldUnitsForCssPixels", app)
        self.assertIn("pointInExpandedRect", app)
        self.assertIn('id="mobileExploreButton"', html)
        self.assertIn('id="questPanel"', html)
        self.assertIn('id="schoolSearch" type="search"', html)
        self.assertIn("setQuestPanelOpen", app)
        self.assertIn("state.schoolQuery", app)
        self.assertIn("aspect-ratio: 4 / 5", styles)
        self.assertIn("min-height: 44px", styles)
        self.assertIn("env(safe-area-inset-bottom)", styles)
        self.assertIn("prefers-reduced-transparency: reduce", styles)
        self.assertIn('id="mealDateDisplay" aria-live="polite"', html)
        self.assertIn('<details class="town-options">', html)
        self.assertIn(".town-options:not([open]) > .town-options-content", styles)
        self.assertIn("-webkit-text-fill-color: var(--ink)", styles)
        self.assertIn("syncDateDisplay", app)
        self.assertNotIn('id="mealDate"', html)
        self.assertIn("依臺中當日自動更新", html)
        self.assertIn("syncTownOptionsDisclosure", app)

    def test_town_uses_reviewed_school_data_without_date_fallback(self) -> None:
        app = self.read("web/lunch-town/app.js")
        self.assertIn('const endpoints = ["/data/schools.json", "/api/schools"]', app)
        self.assertIn('/data/school-meals/${encodeURIComponent(school.fatraceSchoolId)}.json', app)
        self.assertIn("payload.records?.[date] || null", app)
        self.assertIn("payload.record ?? payload.officialRecord ?? null", app)
        self.assertNotIn("Object.values(payload.records", app)
        self.assertIn("loadAccountPreference", app)

    def test_town_uses_the_current_taichung_date_without_a_date_picker(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        self.assertNotIn("const DEFAULT_DATE", app)
        self.assertIn("function townMealDateKey", app)
        self.assertIn("function syncCurrentMealDate", app)
        self.assertIn("state.date = nextDate", app)
        self.assertIn("syncCurrentMealDate(environment)", app)
        self.assertNotIn("function townMealDates", app)
        self.assertNotIn("function initialMealDate", app)
        self.assertNotIn('id="mealDate"', html)

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
        self.assertIn("drawCampusDetails", app)
        self.assertNotIn("state.collisions", app)
        self.assertNotIn("buildCollisions", app)
        self.assertNotIn("rectanglesOverlap", app)
        self.assertNotIn("campusBoundaryRects", app)
        self.assertNotIn("context.strokeRect(layout.x + 1.5", app)
        self.assertIn('if (layout.facility === "library")', app)
        for architecture in ("gable", "flat", "stepped", "courtyard", "eco-roof"):
            self.assertIn(f'"{architecture}"', app)
        for detail in ("flagpole", "reading-tree", "rain-tank", "bike-rack", "flower-beds"):
            self.assertIn(f'"{detail}"', app)
        self.assertIn("function campusVisualProfile", app)
        self.assertIn("function drawCompactSchoolBuilding", app)
        self.assertIn("function drawCompactYardDetail", app)

    def test_town_school_visuals_use_stable_school_identity(self) -> None:
        app = self.read("web/lunch-town/app.js")
        profile = app.split("function campusVisualProfile(school) {", 1)[1].split("\n}\n", 1)[0]
        compact = app.split("function drawCompactCampus(school, now) {", 1)[1].split("\n}\n\nfunction drawCompactCampusBoundary", 1)[0]
        taichung_layout = app.split("function createSchoolLayouts(schools) {", 1)[1].split("\n}\n", 1)[0]
        neighbor_layout = app.split("function createNeighborSchoolLayouts(schools) {", 1)[1].split("\n}\n", 1)[0]

        self.assertIn("school.fatraceSchoolId || school.name", profile)
        self.assertIn("hashText(identity)", profile)
        self.assertIn('choose(CAMPUS_ARCHITECTURES, "architecture")', profile)
        self.assertIn("const visual = campusVisualProfile(school)", taichung_layout)
        self.assertIn("const visual = campusVisualProfile(school)", neighbor_layout)
        self.assertIn("visual,", taichung_layout)
        self.assertIn("visual,", neighbor_layout)
        self.assertNotIn("school.index %", compact)

    def test_town_roads_and_street_furniture_keep_building_clearance(self) -> None:
        app = self.read("web/lunch-town/app.js")
        town = app.split("function drawTown(now, environment = townEnvironmentAt()) {", 1)[1].split("\n}\n\nfunction drawTownLayer", 1)[0]
        roads = app.split("function drawRoads(now) {", 1)[1].split("\n}\n\nfunction strokeRoadPath", 1)[0]
        decorations = app.split("function streetDecorationsForZone", 1)[1].split("\n}\n\nfunction drawStreetDetails", 1)[0]

        self.assertIn("const ROAD_EDGE_WIDTH = 30", app)
        self.assertIn("const ROAD_CONTENT_CLEARANCE = 5", app)
        self.assertIn("function roadCurveLimitForGap", app)
        self.assertIn("function roundaboutRadiusForDistrictCorridors", app)
        self.assertIn("Math.min(column === 3 ? 15 : 9, verticalCurveLimit)", roads)
        self.assertIn("Math.min(row === 2 ? 11 : 7, horizontalCurveLimit)", roads)
        self.assertLess(town.index('drawTownLayer("street-details"'), town.index('drawTownLayer("district-labels"'))
        self.assertLess(town.index('drawTownLayer("street-details"'), town.index('drawTownLayer("venues"'))
        self.assertIn("districtDecorationExclusionRects", decorations)
        self.assertIn("pointInExpandedRect", decorations)
        self.assertIn("lotsIntersect", decorations)
        self.assertIn("benches:", decorations)

    def test_town_geography_places_the_sea_west_and_mountains_east(self) -> None:
        app = self.read("web/lunch-town/app.js")
        self.assertIn("const WEST_COAST_WIDTH = 320", app)
        self.assertIn("const EAST_MOUNTAIN_WIDTH = 500", app)
        self.assertIn("const COASTAL_TETRAPOD_COUNT = 48", app)
        self.assertIn("const DISTRICT_ZONE_ORIGIN_X = WEST_COAST_WIDTH + WEST_COAST_LAND_GAP", app)
        self.assertIn("const EAST_MOUNTAIN_START_X = DISTRICT_ZONE_ORIGIN_X + DISTRICT_GRID_WIDTH", app)
        self.assertIn("const WORLD_WIDTH = EAST_MOUNTAIN_START_X + EAST_MOUNTAIN_WIDTH", app)
        self.assertIn("function drawWesternCoast(now)", app)
        self.assertIn("function drawFishingHarbor(now)", app)
        self.assertIn("function drawFishingBoat(", app)
        self.assertIn("function drawTetrapod(", app)
        self.assertIn("function drawEasternMountainRange(now)", app)
        self.assertIn("function drawMountainPeak(", app)
        self.assertIn('drawTownLayer("western-coast", () => drawWesternCoast(now));\n    drawTownLayer("eastern-mountains", () => drawEasternMountainRange(now));', app)
        self.assertIn("path.moveTo(COASTAL_ROAD_START_X, y)", app)
        self.assertIn("path.lineTo(EASTERN_ROAD_END_X, y)", app)
        self.assertNotIn("path.moveTo(0, y)", app)
        self.assertNotIn("path.lineTo(WORLD_WIDTH, y)", app)

    def test_town_extends_north_to_miaoli_and_south_to_changhua_across_rivers(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        english = self.read("web/locales/en.js")
        themes = json.loads(self.read("web/lunch-town/taichung-district-themes.json"))
        for marker in (
            'name: "苗栗縣"', 'name: "彰化縣"', "const BORDER_RIVER_WIDTH = 112",
            "function drawBoundaryRivers", "function drawBoundaryBridges",
            "function drawIronBoundaryBridge", "function drawConcreteBoundaryBridge",
            "function drawLunchInfoSign", "function createNeighborCountyExcursion",
            "function neighborCountyForNpc", "neighborCountyAtPoint(point)?.name",
        ):
            self.assertIn(marker, app)
        self.assertIn('material: "iron"', app)
        self.assertIn('material: "concrete"', app)
        self.assertNotIn('townText("午餐資料建設中")', app)
        self.assertIn('path.moveTo(x, DISTRICT_ZONE_ORIGIN_Y)', app)
        self.assertIn('path.lineTo(x, TAICHUNG_SOUTH_EDGE_Y)', app)
        self.assertNotIn("path.moveTo(x, 0)", app)
        self.assertNotIn("path.lineTo(x, WORLD_HEIGHT)", app)
        self.assertNotIn("苗栗縣", json.dumps(themes, ensure_ascii=False))
        self.assertNotIn("彰化縣", json.dumps(themes, ensure_ascii=False))
        self.assertIn('"苗栗縣": "Miaoli County"', english)
        self.assertIn('"彰化縣": "Changhua County"', english)
        self.assertIn("app.js?v=20261106-crop-lifecycle", html)
        self.assertIn("/locales/en.js?v=20261106-crop-lifecycle", html)
        self.assertIn("/i18n.js?v=20261106-crop-lifecycle", html)

    def test_miaoli_and_changhua_map_every_reviewed_primary_school_by_realistic_district_position(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        english = self.read("web/locales/en.js")
        i18n = self.read("web/i18n.js")
        themes = json.loads(self.read("web/lunch-town/neighbor-county-themes.json"))
        expectations = {
            "miaoli": ("苗栗縣", 5, 18, 114, "data/reference/miaoli-active-elementary-schools.json"),
            "changhua": ("彰化縣", 6, 26, 171, "data/reference/changhua-active-elementary-schools.json"),
        }
        def assert_english(source: str) -> None:
            match = re.search(rf'"{re.escape(source)}":\s*"([^"]+)"', english)
            self.assertIsNotNone(match, source)
            self.assertIsNone(re.search(r"[\u3400-\u9fff]", match.group(1)), source)

        self.assertEqual(themes["schemaVersion"], 1)
        self.assertEqual({county["id"] for county in themes["counties"]}, set(expectations))
        for county in themes["counties"]:
            name, rows, district_count, school_count, registry_path = expectations[county["id"]]
            registry = json.loads(self.read(registry_path))
            schools = registry["schools"]
            district_names = {school["district"] for school in schools}
            mapped_names = {district["name"] for district in county["districts"]}
            grids = [tuple(district["grid"]) for district in county["districts"]]
            self.assertEqual(county["name"], name)
            self.assertEqual(county["rows"], rows)
            self.assertEqual(len(county["districts"]), district_count)
            self.assertEqual(len(schools), school_count)
            self.assertEqual(mapped_names, district_names)
            self.assertEqual(len(grids), len(set(grids)))
            self.assertTrue(all(0 <= column < 6 and 0 <= row < rows for column, row in grids))
            assert_english(county["title"])
            assert_english(county["tagline"])
            for district in county["districts"]:
                assert_english(district["name"])
                assert_english(district["featureLabel"])
            for landmark in county["landmarks"]:
                self.assertIn(landmark["district"], mapped_names)
                assert_english(landmark["name"])
        assert_english(themes["mapNote"])

        for marker in (
            "function loadNeighborCountyThemes", "function configureNeighborCountyThemes",
            "function createNeighborSchoolLayouts", "function drawNeighborDistrictTerrain",
            "function neighborCountyDistrictRoutes", "function drawNeighborDistrictLabel",
            "function drawNeighborCountyLandmark", "function drawPixelCountyLandmark",
            "function openNeighborSchool", "function nearbyNeighborSchool",
            "function schoolHasCurrentMeal", "function drawNeighborSchoolDataMarker",
            "state.neighborSchools.length !== neighborSourceSchools.length", 'mapScope: "neighbor-county"',
        ):
            self.assertIn(marker, app)
        self.assertIn('terrain === "high-mountain"', app)
        self.assertIn('/farm|plain|flower|sugar|orchard/.test(terrain)', app)
        self.assertIn('state.neighborSchools.filter((school) => isVisibleRect(school.layout, 60))', app)
        self.assertIn("school.recordDates.includes(state.date)", app)
        self.assertIn('function openNeighborSchool(school, method = "nearby_action") {\n  void openSchool(school, method);\n}', app)
        self.assertNotIn("目前可散步查看校名；苗栗與彰化的午餐內容尚未在午餐小鎮開放。", app)
        self.assertIn('if (school.mapScope !== "neighbor-county")', app)
        self.assertIn('cache: "no-store"', app)
        self.assertIn('availableCount === schoolCount', app)
        self.assertIn('"午餐資料持續更新": "Lunch data update in progress"', english)
        self.assertIn('"當日午餐已更新": "Today\'s lunch data is ready"', english)
        self.assertIn('"到{0}散步，看看當地學校與景觀": [0]', i18n)
        self.assertIn('neighbor-county-themes.json?v=20261105-outer-rivers', app)
        self.assertIn("app.js?v=20261106-crop-lifecycle", html)
        self.assertIn("/locales/en.js?v=20261106-crop-lifecycle", html)
        self.assertIn("/i18n.js?v=20261106-crop-lifecycle", html)

    def test_neighbor_counties_follow_taichung_district_block_layout(self) -> None:
        app = self.read("web/lunch-town/app.js")
        styles = self.read("web/lunch-town/styles.css")
        school_layout = app.split("function createNeighborSchoolLayouts(schools) {", 1)[1].split("\n}\n", 1)[0]
        road_layout = app.split("function drawNeighborCountyRoads() {", 1)[1].split("\n}\n", 1)[0]
        farmland = app.split("function drawNeighborFarmland(theme) {", 1)[1].split("\n}\n", 1)[0]

        self.assertIn("const NEIGHBOR_COUNTY_ZONE_GAP = 40", app)
        self.assertIn("function neighborCountyGridMetrics", app)
        self.assertIn("const landscapeWidth = neighborDistrictLandscapeWidth(districtTheme)", school_layout)
        self.assertIn("const schoolAreaWidth = zone.w - landscapeWidth", school_layout)
        self.assertIn("townMapEditorLaneHeight(districtTheme.county.name, district)", school_layout)
        self.assertIn("column < NEIGHBOR_COUNTY_DISTRICT_COLUMNS", road_layout)
        self.assertIn("row < countyTheme.rows", road_layout)
        self.assertIn("metrics.left", road_layout)
        self.assertNotIn("first.zone.x + first.zone.w / 2", road_layout)
        self.assertIn("function drawNeighborFarmland", app)
        self.assertIn("function neighborFarmlandGeometry", app)
        self.assertIn("function neighborPaddyParcels", app)
        self.assertIn("function drawRiceSeedlings", app)
        self.assertIn('hashText(`${theme.county.id}-${theme.name}-${terrain}-fields`)', farmland)
        self.assertNotIn("+ index", farmland)
        self.assertIn("zone.x + zone.w - landscapeWidth + 12", app)
        self.assertIn("drawPixelCountyLandmark(landmark.style, x, y, scale)", app)
        self.assertNotIn("function isBlockedTownTerrain", app)
        self.assertNotIn("function playerTerrainMoveAllowed", app)
        self.assertNotIn("pointIsOnNeighborCountyRoad", app)
        self.assertIn("const MAX_NIGHT_DARKNESS = 0.4", app)
        self.assertIn("max-width: min(420px, calc(100% - 96px))", styles)

    def test_boundary_rivers_show_clear_westbound_pixel_currents(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        river = app.split("function drawBoundaryRiverCurrents(now, bridge, path) {", 1)[1].split("\n}\n", 1)[0]
        self.assertIn("RIVER_FLOW_LANE_OFFSETS", river)
        self.assertIn("RIVER_FLOW_CHEVRON_SPACING", river)
        self.assertIn("context.lineDashOffset = flowDistance", river)
        self.assertIn("const x = anchorX - flowTravel", river)
        self.assertIn("boundaryRiverYAt(x + 5, bridge)", river)
        self.assertIn("const flowTravel = reducedMotion ? 0", river)
        self.assertIn("context.lineTo(2, 0)", river)
        self.assertIn("context.createLinearGradient", app)
        self.assertLess(app.index('drawTownLayer("boundary-rivers"'), app.index('drawTownLayer("bridges"'))
        self.assertIn("app.js?v=20261106-crop-lifecycle", html)

    def test_miaoli_north_and_changhua_south_have_named_boundary_rivers(self) -> None:
        app = self.read("web/lunch-town/app.js")
        english = self.read("web/locales/en.js")
        for marker in (
            "const NORTH_OUTER_RIVER_Y", "const SOUTH_OUTER_RIVER_Y",
            "const OUTER_BOUNDARY_RIVERS", "const BOUNDARY_RIVERS",
            'id: "miaoli-north-yanshuigang"', 'label: "苗栗北界・鹽水港溪"',
            'id: "changhua-south-zhuoshui"', 'label: "彰化南界・濁水溪"',
            "function drawBoundaryRiverLabels", "BOUNDARY_RIVERS.forEach",
            "const WORLD_HEIGHT = SOUTH_COUNTY_END_Y + OUTER_BORDER_RIVER_SPAN",
        ):
            self.assertIn(marker, app)
        self.assertNotIn("function blockedTerrainEscapeDepth", app)
        self.assertIn('"苗栗北界・鹽水港溪": "Northern Miaoli boundary · Yanshuigang Creek"', english)
        self.assertIn('"彰化南界・濁水溪": "Southern Changhua boundary · Zhuoshui River"', english)

    def test_riverbanks_have_safe_landscapes_and_npc_leisure_activities(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        english = self.read("web/locales/en.js")
        i18n = self.read("web/i18n.js")
        for marker in (
            "function drawRiverbankLandscapes", "function drawRiverbankLevee",
            "function drawRiverbankFishingDeck", "function drawRiverbankBarbecueArea",
            "function drawNpcRiverbankActivity", "function createRiverbankLeisureExcursion",
            "function riverbankFixturePositions", "function drawRiverbankSiteSign",
        ):
            self.assertIn(marker, app)
        self.assertIn('"fishing", "barbecuing"', app)
        self.assertIn("BORDER_RIVER_WIDTH / 2 + 16", app)
        self.assertIn("riverbankSiteId: site.id", app)
        self.assertIn('activity === "barbecuing"', app)
        self.assertIn('npc.activity === "barbecuing"', app)
        self.assertIn('npc.riverbankSiteId === site.id', app)
        self.assertIn("state.environment?.isRaining", app)
        self.assertIn("hour < 7 || hour >= 21", app)
        self.assertLess(app.index('drawTownLayer("boundary-rivers"'), app.index('drawTownLayer("riverbanks"'))
        self.assertLess(app.index('drawTownLayer("riverbanks"'), app.index('drawTownLayer("bridges"'))
        self.assertNotIn("function isBlockedTownTerrain", app)
        for source, translated in (
            ('"釣魚平台":', "Fishing deck"),
            ('"指定休憩區":', "Designated recreation area"),
            ('"北界河濱釣魚平台":', "North river fishing deck"),
            ('"南界河岸休憩區":', "South river recreation area"),
        ):
            self.assertIn(source, english)
            self.assertIn(translated, english)
        self.assertIn('"在{0}的安全平台釣魚，釣線朝向河道但人留在護欄內": [0]', i18n)
        self.assertIn('"在{0}使用指定烤肉台休憩，並把垃圾與火源收拾好": [0]', i18n)
        self.assertIn("app.js?v=20261106-crop-lifecycle", html)
        self.assertIn("/locales/en.js?v=20261106-crop-lifecycle", html)
        self.assertIn("/i18n.js?v=20261106-crop-lifecycle", html)

    def test_town_map_labels_every_school_with_a_readable_primary_school_name(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        self.assertIn("drawCompactSchoolSign(school)", app)
        self.assertIn("formatSchoolMapLabel", app)
        self.assertIn('.replace(/國民小學/g, "國小")', app)
        self.assertIn("fitSchoolLabelFont", app)
        self.assertIn("splitSchoolMapLabel", app)
        self.assertNotIn("String(school.name).slice(0, 6)", app)
        self.assertIn("styles.css?v=20261106-crop-lifecycle", html)
        self.assertIn("app.js?v=20261106-crop-lifecycle", html)

    def test_player_movement_blocks_only_sea_mountains_and_rivers(self) -> None:
        app = self.read("web/lunch-town/app.js")
        move_player = app.split("function tryMovePlayer(dx, dy) {", 1)[1].split("\n}\n", 1)[0]
        update_player = app.split("function updatePlayer(delta) {", 1)[1].split("\n}\n\nfunction accumulateDailyWalkDistance", 1)[0]
        self.assertIn("state.player.x = next.x", move_player)
        self.assertIn("state.player.y = next.y", move_player)
        self.assertIn("const next = clampTownPoint", move_player)
        self.assertIn("playerNaturalTerrainMoveAllowed(current, next)", move_player)
        self.assertIn("return false", move_player)
        self.assertIn("return true", move_player)
        self.assertIn("const movedX = tryMovePlayer", app)
        self.assertIn("const movedY = tryMovePlayer", app)
        self.assertIn("state.player.isMoving = movedX || movedY", update_player)
        self.assertIn("if (state.moveTarget && !state.player.isMoving) state.moveTarget = null", app)
        for removed_collision in (
            "PLAYER_TERRAIN_PADDING", "BOUNDARY_BRIDGE_PASSAGE_HALF_WIDTH",
            "trySlidePlayer", "nearestWalkableTownPoint",
            "recoverPlayerToWalkableTerrain", "pointIsOnBoundaryBridge", "isBlockedTownTerrain",
            "blockedTerrainEscapeDepth", "terrainEscapeAuditPoints", "auditTownTerrainEscapes",
        ):
            self.assertNotIn(removed_collision, app)
        self.assertIn("const NATURAL_TERRAIN_MARGIN = 10", app)
        self.assertIn("const RIVER_BRIDGE_PASSAGE_HALF_WIDTH = 28", app)
        self.assertIn("function playerNaturalTerrainMoveAllowed", app)
        self.assertIn("function naturalTerrainCollisionDepth", app)
        self.assertIn("coastlineXAt(point.y) + NATURAL_TERRAIN_MARGIN - point.x", app)
        self.assertIn("point.x + NATURAL_TERRAIN_MARGIN - EAST_MOUNTAIN_START_X", app)
        self.assertIn("BOUNDARY_BRIDGES.forEach", app)
        self.assertIn("OUTER_BOUNDARY_RIVERS.forEach", app)
        self.assertIn("function pointIsOnRiverBridge", app)
        self.assertIn("currentDepth > 0 && nextDepth <= currentDepth + 0.001", app)

    def test_natural_collision_has_no_object_masks_or_forced_relocation(self) -> None:
        app = self.read("web/lunch-town/app.js")
        english = self.read("web/locales/en.js")

        self.assertIn("const RIVERBANK_NAVIGATION_CLEARANCE = 46", app)
        self.assertIn("BORDER_RIVER_WIDTH / 2 + RIVERBANK_NAVIGATION_CLEARANCE", app)
        self.assertNotIn("blockedMoveFrames", app)
        self.assertNotIn("terrainAudit", app)
        self.assertNotIn("state.neighborWorkZones.some((zone) => zone.restricted", app)
        self.assertNotIn("pointInExpandedRect(point, zone", app)
        self.assertNotIn("已自動移到最近的安全步道。", app)
        self.assertNotIn("已自動移到最近的安全步道。", english)
        self.assertIn("const MAP_CHECKPOINT_PROXIMITY = 10", app)

    def test_neighbor_city_restricted_zones_are_visual_only_and_walkable(self) -> None:
        app = self.read("web/lunch-town/app.js")
        self.assertIn('context.fillStyle = zone.restricted ? "rgba(104, 50, 40, 0.93)"', app)
        self.assertIn("if (zone.restricted)", app)
        self.assertNotIn("state.neighborWorkZones.some((zone) => zone.restricted", app)
        self.assertNotIn("pointInExpandedRect(point, zone", app)

    def test_town_syncs_time_weather_lighting_and_organic_streets(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        styles = self.read("web/lunch-town/styles.css")
        self.assertIn('id="environmentStatus" role="status" aria-live="polite"', html)
        self.assertIn('const TAICHUNG_TIME_ZONE = "Asia/Taipei"', app)
        self.assertIn("function townEnvironmentAt", app)
        self.assertIn("function drawAtmosphereOverlay", app)
        self.assertIn("function drawStreetLightGlows", app)
        self.assertIn("visibleLampPositions().forEach((lamp)", app)
        self.assertNotIn("visibleLampPositions().slice", app)
        self.assertIn("function drawRain", app)
        for phase in ("黎明", "白天", "黃昏", "夜晚"):
            self.assertIn(f'phase = "{phase}"', app)
        self.assertIn('environment.phase === "黎明"', app)
        self.assertIn('environment.phase === "黃昏"', app)
        self.assertIn("function streetDecorationsForZone", app)
        self.assertIn("Math.sin(now / 920 + phase)", app)
        self.assertIn("quadraticCurveTo", app)
        self.assertIn("function drawRoundabout", app)
        self.assertIn(".environment-status.is-night", styles)
        self.assertIn(".environment-status.is-dawn", styles)
        self.assertIn(".environment-status.is-dusk", styles)
        self.assertIn(".environment-status.is-raining", styles)

    def test_town_has_daily_choices_weekend_markets_and_rain_shelters(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        styles = self.read("web/lunch-town/styles.css")
        self.assertIn('id="dailyStoryCard"', html)
        self.assertIn('id="dailyStoryChoices" aria-label="今日故事選擇"', html)
        self.assertIn("function setupDailyStory", app)
        self.assertIn("function chooseDailyStory", app)
        self.assertIn("WEEKEND_STORY_TEMPLATE", app)
        self.assertIn("RAIN_STORY_TEMPLATE", app)
        self.assertIn("function weekendMarketStop", app)
        self.assertIn("function drawWeekendMarkets", app)
        self.assertIn("function rainShelterForNpc", app)
        self.assertIn("function drawArcadeShelter", app)
        self.assertIn("function drawRainUmbrella", app)
        self.assertIn(".daily-story-card", styles)
        self.assertIn("低頻氣氛排程，不代表即時氣象", html)

    def test_town_uses_mostly_straight_roads_with_selected_curves(self) -> None:
        app = self.read("web/lunch-town/app.js")
        self.assertIn("if ([3, 6].includes(column))", app)
        self.assertIn("if ([2, 5].includes(row))", app)
        self.assertIn("path.lineTo(x, TAICHUNG_SOUTH_EDGE_Y)", app)
        self.assertIn("drawNeighborCountyRoads()", app)
        self.assertIn("path.lineTo(EASTERN_ROAD_END_X, y)", app)
        self.assertIn("path.quadraticCurveTo", app)
        self.assertIn("function drawRoundabout", app)

    def test_candidate_outfits_keep_requested_distinct_colors(self) -> None:
        app = self.read("web/lunch-town/app.js")
        self.assertIn('identity.name === "何欣純"', app)
        self.assertIn('outfit: "#e8aebd"', app)
        self.assertIn('identity.name === "江啟臣"', app)
        self.assertIn('outfit: "#29466f"', app)
        self.assertIn('accent: "#c84e52"', app)

    def test_candidates_start_in_separate_home_districts_before_cross_district_travel(self) -> None:
        app = self.read("web/lunch-town/app.js")
        for district, name in (("大里區", "何欣純"), ("豐原區", "江啟臣")):
            self.assertIn(f'district: "{district}", name: "{name}", role: "candidate"', app)
        self.assertIn("const route = [identity.district]", app)
        self.assertIn("跨區走訪從第二站才開始", app)
        self.assertNotIn('identity.role === "candidate" && state.activeDistrict', app)

    def test_jiang_candidate_appears_much_less_often_than_ho(self) -> None:
        app = self.read("web/lunch-town/app.js")
        self.assertIn('"何欣純": { cycleSeconds: 120, visibleSeconds: 120, initialDelaySeconds: 0 }', app)
        self.assertIn('"江啟臣": { cycleSeconds: 120, visibleSeconds: 18, initialDelaySeconds: 45 }', app)
        self.assertIn('const NPC_OFFSCREEN_VENUE_ID = "__candidate_offscreen__"', app)
        self.assertIn("function updateNpcAppearance", app)
        self.assertIn("npc.appearanceElapsed < rule.visibleSeconds", app)
        self.assertIn("state.dialogueNpc === npc || npc.isSocializing || npc.isInTownMoment || npc.storyVenueId", app)

    def test_town_sends_privacy_bounded_ga4_events(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        analytics = self.read("web/product-analytics.js")
        self.assertIn("G-EDXYFV1B3L", html)
        self.assertIn('/product-analytics.js?v=20261104-town-auth', html)
        for event in (
            "lunch_town_viewed", "lunch_town_district_entered", "lunch_town_school_viewed",
            "lunch_town_npc_talked", "lunch_town_venue_entered", "lunch_town_music_toggled",
            "lunch_town_player_style_changed", "lunch_town_story_choice",
            "lunch_town_achievement_unlocked",
        ):
            self.assertIn(f'"{event}"', app)
            self.assertIn(f'"{event}"', analytics)
        self.assertIn("function trackTownEvent", app)
        self.assertIn("npc_role", analytics)
        self.assertNotIn("npc_name", analytics)
        self.assertNotIn("dialogue_text", analytics)

    def test_town_has_occasional_stylish_adult_npcs_and_six_player_avatars(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        styles = self.read("web/lunch-town/styles.css")
        for name in (
            "采寧媽媽", "若庭老師", "芊羽學姊", "映彤姐", "瑄寧媽媽",
            "語安老師", "思妤學姊", "筱晴姐", "佳蓉媽媽",
        ):
            self.assertIn(name, app)
        for role in ('role: "parent"', 'role: "college-volunteer"', 'role: "community-resident"'):
            self.assertIn(role, app)
        self.assertIn("OCCASIONAL_TOWN_NPCS", app)
        self.assertIn('hairStyle: "long-wavy"', app)
        self.assertIn('hairStyle: "high-ponytail"', app)
        self.assertIn("PLAYER_AVATARS", app)
        self.assertIn("PLAYER_AVATAR_LABELS", app)
        self.assertIn("loadPlayerAvatarPreference", app)
        self.assertIn("setPlayerAvatar", app)
        self.assertIn("lunchTownPlayerAvatar", app)
        self.assertIn("LEGACY_PLAYER_STYLE_STORAGE_KEY", app)
        for avatar in ("haiyin", "mubai", "qingxia", "xiangye", "qingchuan", "yueyang"):
            self.assertNotIn(f'data-player-avatar="{avatar}"', html)
            self.assertIn(f'{avatar}: {{', app)
        self.assertIn('data-player-avatar="${avatarId}"', app)
        self.assertNotIn("角色造型", html)
        self.assertIn("時間與音樂", html)
        self.assertIn("function playerHomeAvatarPickerMarkup", app)
        self.assertIn("function renderAvatarPreviewCanvases", app)
        self.assertIn('canvas[data-avatar-preview], canvas[data-current-avatar-preview]', app)
        self.assertIn("drawPerson({", app)
        self.assertIn(".home-avatar-grid", styles)
        self.assertIn('.home-avatar-card[aria-pressed="true"]', styles)
        self.assertIn('[data-player-avatar="haiyin"]', styles)
        self.assertIn('[data-player-avatar="yueyang"]', styles)

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
        self.assertIn('person.ageGroup === "child" ? 0.8', app)

    def test_character_faces_and_clothing_have_pixel_level_detail(self) -> None:
        app = self.read("web/lunch-town/app.js")
        for outfit_style in (
            "school-uniform", "school-cardigan", "sporty", "cardigan", "blazer",
            "lab-coat", "medical-coat", "kitchen-uniform", "safety-vest", "overalls",
            "casual-layered", "fashionable", "formal-bow", "senior-knit", "civic-suit",
        ):
            self.assertIn(f'"{outfit_style}"', app)
        for renderer in (
            "resolveOutfitStyle", "drawCharacterLegs", "drawCharacterArms", "drawCharacterOutfit",
        ):
            self.assertIn(renderer, app)
        for hair_style in ("twin-tail", "braid", "shoulder-length", "short-wave"):
            self.assertIn(f'person.hairStyle === "{hair_style}"', app)
        for expression in ("cheerful", "gentle", "focused", "thoughtful", "curious", "confident"):
            self.assertIn(f'expression: "{expression}"', app)
        self.assertIn("isBlinking", app)
        self.assertIn("blushColor", app)
        self.assertIn("lipColor", app)
        self.assertIn("hairAccent", app)
        self.assertIn("drawCharacterFace(person, direction, now)", app)

    def test_npc_expressions_are_readable_in_world_and_dialogue_portraits(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        styles = self.read("web/lunch-town/styles.css")
        english = self.read("web/locales/en.js")
        for marker in (
            "CHARACTER_EXPRESSION_LABELS", "DIALOGUE_EXPRESSION_SEQUENCES",
            "function npcDialogueExpression", "function currentCharacterExpression",
            "function characterExpressionLabel", "function renderNpcPortrait",
            "gazeOffset", "smilingEyes", "portraitPreview",
            "renderNpcPortrait(npc, expression)",
        ):
            self.assertIn(marker, app)
        for expression in (
            'expression === "surprised"', 'expression === "curious"',
            'expression === "confident"', 'expression === "thoughtful"',
            '["focused", "determined"].includes(expression)',
        ):
            self.assertIn(expression, app)
        for element_id in ("npcPortrait", "npcExpression"):
            self.assertIn(f'id="{element_id}"', html)
        self.assertIn('aria-label="人物表情特寫"', html)
        self.assertIn(".npc-dialogue-layout", styles)
        self.assertIn(".npc-portrait canvas", styles)
        self.assertIn("image-rendering: pixelated", styles)
        for translation in (
            '"人物表情特寫": "Character expression close-up"',
            '"開心": "Happy"', '"溫和": "Gentle"', '"專注": "Focused"',
            '"自信": "Confident"', '"思考": "Thoughtful"',
            '"驚訝": "Surprised"', '"平靜": "Calm"',
        ):
            self.assertIn(translation, english)
        self.assertIn("app.js?v=20261106-crop-lifecycle", html)
        self.assertIn("styles.css?v=20261106-crop-lifecycle", html)
        self.assertIn("/locales/en.js?v=20261106-crop-lifecycle", html)
        self.assertIn("/i18n.js?v=20261106-crop-lifecycle", html)

    def test_town_has_age_gender_and_workplace_diversity(self) -> None:
        app = self.read("web/lunch-town/app.js")
        for role in ("high-school-student", "university-student", "office-worker", "senior"):
            self.assertIn(f'role: "{role}"', app)
        for dialogue_key in ('"high-school-student": [', '"university-student": [', '"office-worker": [', "senior: ["):
            self.assertIn(dialogue_key, app)
        for name in (
            "靜宜同學", "子豪同學", "佩珊學姊", "建宇學長", "雅雯姐",
            "志明哥", "桂花奶奶", "文山爺爺", "芷妍姐",
        ):
            self.assertIn(name, app)
        self.assertIn("DIVERSE_TOWN_NPCS", app)
        self.assertIn('gender: "female"', app)
        self.assertIn('gender: "male"', app)
        self.assertIn('variant: "formal-black"', app)
        self.assertIn('accessory: "bow-briefcase"', app)

    def test_town_civic_npcs_use_verified_real_roles_and_sourced_campaign_appeals(self) -> None:
        app = self.read("web/lunch-town/app.js")
        for name in ("盧秀燕", "林哲雄", "陳淑華", "何欣純", "江啟臣"):
            self.assertIn(name, app)
        for role in ("mayor", "borough-chief", "city-councilor", "candidate"):
            self.assertIn(f'role: "{role}"', app)
        for source in ("taichung.gov.tw", "west.taichung.gov.tw", "tccc.gov.tw", "web.cec.gov.tw"):
            self.assertIn(source, app)
        self.assertIn("CIVIC_TOWN_NPCS", app)
        self.assertIn('id="npcSource"', html := self.read("web/lunch-town/index.html"))
        self.assertIn("不代表本人引言、背書或政見", html)
        self.assertIn("npc.campaignSourceUrl || npc.sourceUrl", app)
        self.assertIn("你可以比較每位候選人的公開資料再自行判斷", app)
        self.assertIn("campaignAppeal", app)
        self.assertIn("https://a-chun.tw/", app)
        self.assertIn("https://taichungway.tw/", app)
        self.assertEqual(app.count("正在爭取你的支持"), 2)
        self.assertIn("歡迎投票支持我", app)
        self.assertIn("比較每位候選人的公開資料", app)

    def test_npcs_hold_role_aware_conversations_in_comic_bubbles(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        styles = self.read("web/lunch-town/styles.css")
        for element_id in ("speechLayer", "comicBubble", "comicSpeaker", "comicText"):
            self.assertIn(f'id="{element_id}"', html)
        for behavior in (
            "updateAmbientConversation", "findConversationPair", "startAmbientConversation",
            "conversationTurns", "endAmbientConversation", "renderComicBubble",
        ):
            self.assertIn(f"function {behavior}", app)
        self.assertIn("conversationMemory", app)
        self.assertIn("slice(-CONVERSATION_MEMORY_LIMIT)", app)
        self.assertIn("nutritionist", app)
        self.assertIn("police-officer", app)
        self.assertIn("mayor", app)
        self.assertIn(".comic-bubble", styles)
        self.assertIn("-webkit-line-clamp: 2", styles)
        self.assertIn("prefers-reduced-motion: reduce", styles)

    def test_npc_conversations_use_identity_context_relationship_and_memory(self) -> None:
        app = self.read("web/lunch-town/app.js")
        for behavior in (
            "buildConversationContext", "selectConversationTopic", "buildDailyTopicTurns",
            "buildTownRelationships", "relationshipBetween", "rememberConversation",
            "pruneConversationMemory", "buildPlayerConversation",
        ):
            self.assertIn(f"function {behavior}", app)
        for field in (
            "topicId", "relationship", "relationshipLabel", "location", "timeLabel",
            "isRaining", "firstActivity", "secondActivity", "rumor",
        ):
            self.assertIn(field, app)
        for relation in ("parent-child", "classmates", "coworkers", "neighbors", "new-acquaintances"):
            self.assertIn(f'"{relation}"', app)
        self.assertIn("const CONVERSATION_MEMORY_LIMIT = 8", app)
        self.assertIn("const CONVERSATION_MEMORY_WINDOW_MS = 10 * 60 * 1000", app)
        self.assertIn("Math.max(2, Math.min(familiar ? 4 : 2, requestedLength))", app)

    def test_npc_dialogue_has_twelve_daily_topics_and_role_aware_work_lines(self) -> None:
        app = self.read("web/lunch-town/app.js")
        for topic in (
            "weather", "errands", "work-school", "family", "shopping", "cooking",
            "lunch", "neighborhood", "transport", "rest", "animals", "seasonal",
        ):
            self.assertIn(f'"{topic}"', app)
        for role in (
            "teacher", "nutritionist", "cook", "police-officer", "firefighter", "doctor",
            "sanitation-worker", "delivery-worker",
        ):
            self.assertIn(f'{role}:', app.replace(f'"{role}":', f'{role}:'))
        self.assertIn("roleDailyWorkLine", app)
        self.assertIn("NPC_PERSONALITIES", app)

    def test_town_has_daily_actions_service_workers_and_low_stakes_moments(self) -> None:
        app = self.read("web/lunch-town/app.js")
        for activity in (
            "waiting", "queuing", "resting", "greeting", "watching-birds", "feeding-birds",
            "exercising", "sweeping", "stocking", "school-pickup", "delivery", "listening",
        ):
            self.assertIn(f'"{activity}"', app)
        for moment in (
            "lost-bottle", "directions", "carry-bag", "find-parent", "delivery-stop",
            "missing-ingredient", "park-cleanup", "school-dismissal",
        ):
            self.assertIn(f'id: "{moment}"', app)
        for behavior in (
            "updateTownMoment", "startTownMoment", "nearbyTownMoment", "resolveTownMoment",
            "finishTownMoment", "addTownRumor", "latestTownRumor", "drawPersonEmote",
        ):
            self.assertIn(f"function {behavior}", app)
        self.assertIn("TOWN_SERVICE_NPCS", app)
        self.assertIn('accessory: "broom"', app)
        self.assertIn('accessory: "package"', app)

    def test_mobile_simulation_is_coarse_outside_the_active_district(self) -> None:
        app = self.read("web/lunch-town/app.js")
        self.assertIn("const MOBILE_COARSE_UPDATE_SECONDS = 1", app)
        self.assertIn("function shouldUseCoarseMobileUpdate", app)
        self.assertIn("entityDistrict === state.activeDistrict", app)
        self.assertIn("const visible = isVisibleRect", app)
        self.assertIn("return !visible", app)
        self.assertIn("refreshActiveNpcSimulationSet(delta);", app)
        self.assertIn("if (npc.backgroundSimulated)", app)
        self.assertIn("npc.coarseElapsed < BACKGROUND_NPC_UPDATE_SECONDS", app)
        self.assertIn("shouldUseCoarseMobileUpdate(pet, pet.district)", app)
        self.assertIn("shouldUseCoarseMobileUpdate(bird, bird.district)", app)
        self.assertIn("coarseElapsed", app)
        self.assertIn("bird.coarseElapsed", app)
        self.assertIn("pet.coarseElapsed", app)
        self.assertIn("const nearestNpc = bird.district === state.activeDistrict", app)
        self.assertIn("const startled = bird.species === \"sparrow\"", app)

    def test_changhua_fast_travel_culls_and_caches_expensive_frame_work(self) -> None:
        app = self.read("web/lunch-town/app.js")
        backdrop = app.split("function drawNeighborCountyBackdrop(county) {", 1)[1].split("\n}\n\nfunction drawNeighborDistrictTerrain", 1)[0]
        farmland = app.split("function drawNeighborFarmland(theme) {", 1)[1].split("\n}\n\nfunction drawFieldCrops", 1)[0]
        npc_update = app.split("function updateNpcs(delta) {", 1)[1].split("\n}\n\nfunction contextualActivityForNpc", 1)[0]
        compact_campus = app.split("function drawCompactCampus(school, now) {", 1)[1].split("\n}\n\nfunction drawCompactCampusBoundary", 1)[0]
        roads = app.split("function drawRoads(now) {", 1)[1].split("\n}\n\nfunction strokeRoadPath", 1)[0]
        neighbor_roads = app.split("function drawNeighborCountyRoads() {", 1)[1].split("\n}\n\nfunction neighborCountyDistrictRoutes", 1)[0]
        river_path = app.split("function boundaryRiverPath(bridge) {", 1)[1].split("\n}\n\nfunction drawBoundaryRiverCurrents", 1)[0]

        self.assertIn("state.camera.x - 40", backdrop)
        self.assertIn("state.camera.x + WIDTH + 40", backdrop)
        self.assertIn("state.camera.y - 40", backdrop)
        self.assertIn("if (canalY < state.camera.y - 80", backdrop)
        self.assertIn("const neighborPaddyParcelCache = new Map()", app)
        self.assertIn("const boundaryRiverPathCache = new Map()", app)
        self.assertIn("const coastlinePathCache = new Map()", app)
        self.assertIn("neighborPaddyParcelCache.get(cacheKey)", app)
        self.assertIn("neighborPaddyParcelCache.set(cacheKey, stableParcels)", app)
        self.assertIn("const detailStride = townUsesReducedDetail() ? 2 : 1", farmland)
        self.assertIn("if (!townUsesReducedDetail())", compact_campus)
        self.assertIn("state.activeNpcRefreshElapsed < 0.2", app)
        self.assertNotIn("const npcDistrict = districtAtPoint(npc)", npc_update)
        self.assertIn("function refreshNeighborSchoolStats", app)
        self.assertIn("state.neighborSchoolStatsDate === dateKey", app)
        self.assertIn("function updateTownRenderBudget", app)
        self.assertIn("frameCost > 22", app)
        self.assertIn("frameCost > 50", app)
        self.assertIn("budget.slowFrames >= 4", app)
        self.assertIn("function townUsesReducedDetail", app)
        self.assertIn("state.camera.x > WEST_COAST_WIDTH + 140", app)
        self.assertIn("state.camera.x + WIDTH < EAST_MOUNTAIN_START_X - 140", app)
        self.assertIn("isVisibleRect({ x: x - ROAD_EDGE_WIDTH", roads)
        self.assertIn("!isVisibleRect(county, 100)", neighbor_roads)
        self.assertIn("route.moveTo(x, metrics.top)", neighbor_roads)
        self.assertIn("route.lineTo(x, metrics.bottom)", neighbor_roads)
        self.assertIn("route.moveTo(metrics.left, y)", neighbor_roads)
        self.assertIn("route.lineTo(metrics.right, y)", neighbor_roads)
        self.assertNotIn("route.moveTo(x, visibleTop)", neighbor_roads)
        self.assertNotIn("route.lineTo(visibleRight, y)", neighbor_roads)
        self.assertIn("boundaryRiverPathCache.get(bridge.id)", river_path)
        self.assertIn("const { startX, endX } = bounds", river_path)
        self.assertIn("boundaryRiverPathCache.set(bridge.id, path)", river_path)
        self.assertNotIn("state.camera", river_path)

    def test_miaoli_and_changhua_roads_have_trees_lamps_and_night_glows(self) -> None:
        app = self.read("web/lunch-town/app.js")
        exclusions = app.split("function neighborDistrictDecorationExclusionRects(theme) {", 1)[1].split("\n}\n\nfunction roadsideOffsets", 1)[0]
        decorations = app.split("function neighborStreetDecorationsForTheme(theme) {", 1)[1].split("\n}\n\nfunction streetDecorationsForZone", 1)[0]
        street_details = app.split("function drawStreetDetails(now, environment) {", 1)[1].split("\n}\n\nfunction drawTree", 1)[0]
        visible_lamps = app.split("function visibleLampPositions() {", 1)[1].split("\n}\n\nfunction drawStreetLightGlows", 1)[0]

        self.assertIn("function roadsideOffsets", app)
        self.assertIn("county.id === \"miaoli\" ? 0.82 : 0.76", decorations)
        self.assertIn("pointIsClear(tree, 20)", decorations)
        self.assertIn("pointIsClear(lamp, 12)", decorations)
        self.assertIn("state.neighborSchools", exclusions)
        self.assertIn("state.venues", exclusions)
        self.assertIn("state.neighborWorkZones", exclusions)
        self.assertIn("countyTheme?.landmarks", exclusions)
        self.assertIn("neighborStreetDecorationsForTheme(theme)", street_details)
        self.assertIn("drawTree(tree.x, tree.y, now, tree.phase, tree.scale)", street_details)
        self.assertIn("drawLamp(lamp.x, lamp.y, environment)", street_details)
        self.assertIn("neighborStreetDecorationsForTheme(theme).lamps", visible_lamps)
        self.assertIn("app.js?v=20261106-crop-lifecycle", self.read("web/lunch-town/index.html"))

    def test_frame_failures_cannot_freeze_players_or_npcs_when_entering_changhua(self) -> None:
        app = self.read("web/lunch-town/app.js")
        english = self.read("web/locales/en.js")
        frame = app.split("function frame(now) {", 1)[1].split("\n}\n\nfunction updateTownRenderBudget", 1)[0]
        isolated_stage = app.split("function runTownFrameStage(stage, task", 1)[1].split("\n}\n\nfunction frame", 1)[0]
        drawing = app.split("function drawTown(now, environment = townEnvironmentAt()) {", 1)[1].split("\n}\n\nfunction drawTownLayer", 1)[0]
        npc_update = app.split("function updateNpcs(delta) {", 1)[1].split("\n}\n\nfunction contextualActivityForNpc", 1)[0]
        actors = app.split("function drawTownActors(now) {", 1)[1].split("\n}\n\nfunction drawGround", 1)[0]

        self.assertIn("const TOWN_FRAME_WATCHDOG_MS = 750", app)
        self.assertIn("performance.now() - state.lastFrameAt >= TOWN_FRAME_WATCHDOG_MS", app)
        self.assertIn('runTownFrameStage("player", () => updatePlayer(delta), { critical: true })', frame)
        self.assertIn('runTownFrameStage("npcs", () => updateNpcs(delta))', frame)
        self.assertIn('runTownFrameStage("town-drawing", () => drawTown(now, state.environment), { critical: true })', frame)
        self.assertIn("scheduleTownFrame();", frame)
        self.assertIn("suspendedUntil", isolated_stage)
        self.assertIn("state.frameStageFailures.set(stage, fault)", isolated_stage)
        self.assertIn('drawTownLayer("actors", () => drawTownActors(now))', drawing)
        self.assertIn("function drawTownLayer", app)
        self.assertIn("context.restore();", drawing)
        self.assertIn('runTownFrameStage(`npc:${index}:${npc.name || "resident"}`', npc_update)
        self.assertIn('const actorId = subject.player ? "player"', actors)
        self.assertIn("drawTownLayer(`actor:${actor.kind}:${actorId}:${index}`", actors)
        self.assertIn(
            '"小鎮已隔離一個異常畫面項目，人物可以繼續移動。": "Lunch Town isolated a faulty visual item so everyone can keep moving."',
            english,
        )

    def test_mobile_game_controls_avoid_selection_zoom_and_offer_immersive_mode(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        styles = self.read("web/lunch-town/styles.css")
        self.assertIn('id="gameCard"', html)
        self.assertIn('id="fullscreenToggle"', html)
        self.assertIn('aria-label="進入全螢幕模式"', html)
        self.assertNotIn("user-scalable=no", html)
        self.assertNotIn("maximum-scale=1", html)
        self.assertIn("-webkit-user-select: none", styles)
        self.assertIn("-webkit-touch-callout: none", styles)
        self.assertIn("touch-action: manipulation", styles)
        self.assertIn("body.town-immersive", styles)
        self.assertIn(".game-card.is-immersive", styles)
        for behavior in (
            "toggleImmersiveMode", "handleFullscreenChange", "setImmersiveMode", "fullscreenElement",
        ):
            self.assertIn(f"function {behavior}", app)
        self.assertIn("requestFullscreen", app)
        self.assertIn("webkitRequestFullscreen", app)
        self.assertIn("exitFullscreen", app)
        self.assertIn('addEventListener("selectstart"', app)

    def test_town_has_interactive_police_and_medical_events(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        styles = self.read("web/lunch-town/styles.css")
        for element_id in ("townEventPanel", "townEventChoices", "townEventSource", "townEventContinue"):
            self.assertIn(f'id="{element_id}"', html)
        for behavior in ("startTownEvent", "updateTownEvent", "renderTownEvent", "chooseTownEventAction", "finishTownEvent"):
            self.assertIn(f"function {behavior}", app)
        for choice_id in ("call-110", "observe", "chase", "call-119", "get-aed", "wait"):
            self.assertIn(f'id: "{choice_id}"', app)
        self.assertIn("www.npa.gov.tw", app)
        self.assertIn("www.nfa.gov.tw", app)
        self.assertIn("不要自行追逐或攔人", app)
        self.assertIn("依 119 派遣員與 AED 語音指示", app)
        self.assertIn(".town-event-panel", styles)
        self.assertIn("min-height: 44px", styles)

    def test_police_and_medical_events_are_rare_special_events(self) -> None:
        app = self.read("web/lunch-town/app.js")
        self.assertIn("const TOWN_EVENT_INITIAL_DELAY_MS = 120_000", app)
        self.assertIn("const TOWN_EVENT_COOLDOWN_MS = 240_000", app)
        self.assertIn("const TOWN_EVENT_COOLDOWN_STEP_MS = 45_000", app)
        self.assertIn("const TOWN_EVENT_AUTO_DISMISS_MS = 30_000", app)
        self.assertIn("performance.now() + TOWN_EVENT_INITIAL_DELAY_MS", app)
        self.assertIn("+ TOWN_EVENT_COOLDOWN_MS", app)
        self.assertIn("state.townEventSequence % 3 * TOWN_EVENT_COOLDOWN_STEP_MS", app)
        self.assertIn("now - event.startedAt >= TOWN_EVENT_AUTO_DISMISS_MS", app)
        self.assertIn("function dismissTownEvent", app)
        self.assertIn("clearTownEvent(now", app)

    def test_town_has_sparrows_and_light_vented_bulbuls(self) -> None:
        app = self.read("web/lunch-town/app.js")
        for behavior in ("createTownBirds", "updateBirds", "chooseBirdTarget", "drawBird"):
            self.assertIn(f"function {behavior}", app)
        self.assertIn('species: "sparrow"', app)
        self.assertIn('label: "麻雀"', app)
        self.assertIn('species: "bulbul"', app)
        self.assertIn('label: "白頭翁"', app)
        self.assertIn("...state.birds.map", app)

    def test_npcs_follow_explainable_schedules_and_town_has_real_destinations(self) -> None:
        app = self.read("web/lunch-town/app.js")
        for venue in ("restaurant", "park", "department-store", "grocery-store"):
            self.assertIn(f'"{venue}"', app)
        for label in ("餐廳", "公園", "百貨公司", "雜貨店"):
            self.assertIn(label, app)
        for behavior in (
            "createTownVenues", "drawTownVenues", "createNpcSchedule", "reasonAtSchool",
            "reasonAtVenue", "reasonOnStreet", "currentReason", "dwellRemaining",
        ):
            self.assertIn(behavior, app)
        self.assertNotIn("districtNpcRoutes", app)
        self.assertIn("按照今天的行程前往下一個目的地", app)

    def test_large_blank_blocks_are_replaced_with_interactive_taichung_landmark_hubs(self) -> None:
        app = self.read("web/lunch-town/app.js")
        themes = self.read("web/lunch-town/taichung-district-themes.json")
        expected_hubs = {
            "waternan-central-park": "水湳中央公園與臺中綠美圖",
            "harbor-outlet": "臺中港灣購物聚落",
            "civic-center": "臺灣大道市政與辦公街區",
            "intercontinental-stadium": "臺中洲際棒球場",
            "lalaport-taichung": "LaLaport 台中",
            "city-general-hospital": "臺中城市綜合醫院",
            "asia-modern-museum": "亞洲大學現代美術館",
        }
        self.assertIn("LANDMARK_HUB_DEFINITIONS", app)
        for hub_id, label in expected_hubs.items():
            self.assertIn(f'id: "{hub_id}"', app)
            self.assertIn(label, app)
        for behavior in (
            "drawLandmarkHub", "drawCentralParkHub", "drawHarborOutletHub",
            "drawCivicCenterHub", "drawStadiumHub", "drawLalaportHub",
            "drawHospitalHub", "drawAsiaMuseumHub", "hubSupportsRole",
        ):
            self.assertIn(f"function {behavior}", app)
        self.assertIn("東海大學路思義教堂", themes)
        self.assertIn('style": "luce-chapel"', themes)
        self.assertIn('feature === "luce-chapel"', app)
        self.assertIn("outdoorVenue", app)

    def test_central_park_path_has_six_lamps_with_night_glows(self) -> None:
        app = self.read("web/lunch-town/app.js")
        lamp_positions = app.split("function centralParkLampPositions", 1)[1].split("\n}\n", 1)[0]
        visible_lamps = app.split("function visibleLampPositions", 1)[1].split("\n}\n", 1)[0]
        self.assertEqual(lamp_positions.count("{ x:"), 6)
        self.assertIn("centralParkLampPositions({ x, y, w, h }).forEach", app)
        self.assertIn('venue.id === "waternan-central-park"', visible_lamps)
        self.assertIn("positions.push(...centralParkLampPositions(venue))", visible_lamps)
        self.assertIn("drawStreetLightGlows(environment, now)", app)

    def test_town_loading_is_staged_and_defers_the_large_school_list(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        styles = self.read("web/lunch-town/styles.css")
        for element_id in ("loadingTitle", "loadingStep", "loadingProgress", "loadingProgressBar", "loadingPercent"):
            self.assertIn(f'id="{element_id}"', html)
        self.assertIn('role="progressbar"', html)
        self.assertIn("function setLoadingProgress", app)
        self.assertIn("function nextPaint", app)
        self.assertIn("function scheduleSchoolListRender", app)
        self.assertIn('window.requestIdleCallback(render, { timeout: 2800 })', app)
        self.assertIn("schoolListRendered: false", app)
        self.assertIn("refreshSchoolListIfRendered", app)
        self.assertIn("Promise.race", app)
        self.assertIn("650", app)
        self.assertIn("setLoadingProgress(100", app)
        self.assertIn(".loading-progress", styles)
        self.assertIn("20261106-crop-lifecycle", html)

    def test_town_has_opt_in_original_web_audio_music(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        styles = self.read("web/lunch-town/styles.css")
        self.assertIn('id="musicToggle"', html)
        self.assertIn('aria-pressed="false"', html)
        self.assertIn("toggleTownMusic", app)
        self.assertIn("scheduleTownMusic", app)
        self.assertIn("playTownTone", app)
        self.assertIn("window.AudioContext || window.webkitAudioContext", app)
        self.assertIn("原創像素小鎮背景音樂", app)
        self.assertIn('.music-toggle[aria-pressed="true"]', styles)

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
        self.assertIn("drawCompass", app)
        self.assertIn("state.camera.x", app)
        self.assertNotIn(".slice(0, layouts.length)", app)
        self.assertNotIn("SHOWCASE_DISTRICT =", app)
        self.assertIn("臺中・苗栗・彰化午餐小鎮", html)
        self.assertIn("臺中成就是第一冊，未來可以接著收藏其他縣市", html)

    def test_town_district_grid_follows_relative_cardinal_geography(self) -> None:
        themes = json.loads(self.read("web/lunch-town/taichung-district-themes.json"))
        grid = {name: tuple(position) for name, position in themes["cardinalGrid"].items()}
        self.assertEqual(set(grid), {item["name"] for item in themes["districts"]})
        self.assertEqual(len(set(grid.values())), 29)
        self.assertTrue(all(0 <= column < 8 and 0 <= row < 6 for column, row in grid.values()))
        self.assertLess(grid["北區"][1], grid["南區"][1])
        self.assertLess(grid["北屯區"][1], grid["南屯區"][1])
        self.assertLess(grid["大安區"][1], grid["大肚區"][1])
        self.assertGreater(grid["東區"][0], grid["西區"][0])
        self.assertGreater(grid["東勢區"][0], grid["西屯區"][0])
        self.assertEqual(grid["和平區"][0], max(column for column, _ in grid.values()))
        self.assertGreater(grid["霧峰區"][1], grid["豐原區"][1])

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
        for draft_word in ("模擬", "示範", "虛構", "開發中", "預覽版"):
            self.assertNotIn(draft_word, html)
            self.assertNotIn(draft_word, app)
            self.assertNotIn(draft_word, themes)
        self.assertIn('accessory: "clipboard"', app)
        self.assertIn('accessory: "flag"', app)
        self.assertIn('accessory: "medical"', app)

    def test_miaoli_and_changhua_have_local_npcs_government_and_landscapes(self) -> None:
        app = self.read("web/lunch-town/app.js")
        english_source = self.read("web/locales/en.js")
        english, _ = json.JSONDecoder().raw_decode(
            english_source.split("window.LunchEnglish = ", 1)[1]
        )
        themes = json.loads(self.read("web/lunch-town/neighbor-county-themes.json"))
        base_roles = app.split("const NEIGHBOR_BASE_ROLE_BY_DISTRICT = Object.freeze({", 1)[1].split("});", 1)[0]
        base_districts = re.findall(r'^\s+"([^"]+)": \[', base_roles, re.MULTILINE)
        extras = app.split("const NEIGHBOR_EXTRA_NPCS = Object.freeze([", 1)[1].split("]);", 1)[0]

        self.assertEqual(len(base_districts), 44)
        self.assertEqual(len(set(base_districts)), 44)
        self.assertEqual(extras.count('countyId: "miaoli"'), 10)
        self.assertEqual(extras.count('countyId: "changhua"'), 8)
        self.assertIn('const NEIGHBOR_COUNTY_NPC_TARGETS = Object.freeze({ miaoli: 28, changhua: 34 })', app)
        for marker in (
            "function appendNeighborCountyCharacters", "function createNeighborNpcSchedule",
            "function createNeighborCivicAfterHoursSchedule", "function transitionNeighborCivicAfterHoursRoutine",
            "function createNeighborCountyVenues",
            "function neighborCivicCampusBounds", "function assignNeighborCivicResidences",
            "function drawCountyGovernmentVenue", 'type: "county-government"', 'type: "county-council"',
            'type: "township-office"', '"farmer"', '"fruit-farmer"', '"flower-grower"',
            '"woodcarver"', '"forest-ranger"', '"railway-worker"', '"oyster-farmer"',
            '"irrigation-worker"',
        ):
            self.assertIn(marker, app)
        landmark_names = {
            landmark["name"]
            for county in themes["counties"]
            for landmark in county["landmarks"]
        }
        for name in ("龍鳳漁港", "明德水庫", "臺灣客家文化館", "汶水遊客中心", "大村葡萄園", "芳苑濕地", "八堡圳"):
            self.assertIn(name, landmark_names)
            self.assertIn(name, english)
            self.assertIsNone(re.search(r"[\u3400-\u9fff]", english[name]))
        for name in ("鍾東錦", "王惠美", "苗栗縣政府", "苗栗縣議會", "彰化縣政府", "彰化縣議會"):
            self.assertIn(name, english)
            self.assertIsNone(re.search(r"[\u3400-\u9fff]", english[name]))

        self.assertIn('campusGrid: [2, 3]', app)
        self.assertIn('campusGrid: [4, 0]', app)
        self.assertIn('w: 330, h: 96', app)
        self.assertIn('`${countyTheme.id}-civic-apartment-a`', app)
        self.assertIn('`${countyTheme.id}-civic-apartment-b`', app)
        self.assertIn("identity.residenceUnitId", app)
        self.assertIn("identity.residenceLabel", app)
        self.assertIn("workVenueId", extras)
        self.assertNotIn("homeVenueId", extras)
        self.assertIn("縣府已下班，正在回家或安排晚間採買", app)
        self.assertIn("county-shopping", app)

    def test_changhua_has_complete_local_workforce_work_zones_and_landscapes(self) -> None:
        app = self.read("web/lunch-town/app.js")
        i18n = self.read("web/i18n.js")
        locale_source = self.read("web/locales/en.js")
        english, _ = json.JSONDecoder().raw_decode(locale_source.split("window.LunchEnglish = ", 1)[1])
        themes = json.loads(self.read("web/lunch-town/neighbor-county-themes.json"))
        changhua = next(county for county in themes["counties"] if county["id"] == "changhua")
        districts = {district["name"] for district in changhua["districts"]}
        work_zones = changhua["workZones"]
        required_roles = {
            "rice-farmer", "vegetable-farmer", "grape-grower", "flower-grower",
            "agricultural-technician", "irrigation-worker", "oyster-farmer", "fisher",
            "railway-maintainer", "sugar-rail-worker", "local-guide",
            "garden-shop-worker", "produce-market-worker",
        }
        required_types = {
            "rice-paddy", "vegetable-field", "grape-packing-yard", "nursery-field",
            "horticulture-market", "lit-flower-route", "tidal-oyster-field",
            "wanggong-harbor", "railway-yard", "sugar-rail-yard", "craft-quarter",
            "produce-coop", "produce-market", "agriculture-service", "irrigation-network",
        }

        self.assertEqual(len(districts), 26)
        self.assertTrue(all(district.get("workProfile") for district in changhua["districts"]))
        self.assertEqual({zone["district"] for zone in work_zones}, districts)
        self.assertTrue(required_types.issubset({zone["type"] for zone in work_zones}))
        self.assertTrue(required_roles.issubset({role for zone in work_zones for role in zone["roles"]}))
        self.assertTrue(all(zone.get("restricted") for zone in work_zones if zone["type"] in {
            "tidal-oyster-field", "railway-yard", "sugar-rail-yard", "irrigation-network",
        }))
        self.assertIn("https://www.chcg.gov.tw/DTO/agriculture/01intro/intro03.aspx", app)
        self.assertIn("https://tourism.chcg.gov.tw/st/index.aspx?id=5308402080902426553", json.dumps(changhua))
        self.assertIn("https://tourism.chcg.gov.tw/AttractionsContent.aspx", json.dumps(changhua))

        for role in required_roles:
            self.assertIn(f'"{role}"', app)
        for marker in (
            "function createNeighborWorkZones", "function drawNeighborWorkZones",
            "function drawChanghuaRidgeConnection", "function drawRiceWorkZone",
            "function drawVegetableWorkZone", "function drawGrapeWorkZone",
            "function drawHorticultureWorkZone", "function drawTidalOysterWorkZone",
            "function drawHarborWorkZone", "function drawRailWorkZone",
            "function drawCraftWorkZone", "function drawAgricultureServiceWorkZone",
            "function drawIrrigationWorkZone", 'id: "changhua-agriculture-office"',
            'type: "agriculture-office"',
        ):
            self.assertIn(marker, app)
        self.assertNotIn("zone.restricted && pointInExpandedRect", app)
        for source in [*(zone["name"] for zone in work_zones), "稻農", "蔬菜農", "葡萄果農", "農業技術員", "鐵道維修員", "糖廠小火車人員", "園藝店員", "果菜市場人員", "農業處"]:
            self.assertIn(source, english)
            self.assertIsNone(re.search(r"[\u3400-\u9fff]", english[source]), source)
        self.assertIn('"在{0}進行{1}": [0, 1]', i18n)
        self.assertIn('"深夜回到{0}住家休息": [0]', i18n)

    def test_neighbor_npcs_store_four_period_routines_bridge_access_and_background_simulation(self) -> None:
        app = self.read("web/lunch-town/app.js")
        for marker in (
            "function createNeighborNpcTimeSchedule", "function neighborDayPeriod",
            "function transitionNeighborTimeRoutine", 'morning: [home, work]', "midday,", "evening,",
            '"late-night": [home', "homeCounty:", "homeDistrict:", "workplaceId:",
            "frequentPlaceIds:", "localSpecialty:", "timeSchedule,",
            "canCrossCountyBridge:", "bridgeDestinations:", "specialWorkZoneIds:",
            "function neighborBridgeTripStops", 'bridgeDestinations: timeSchedule.canCross ? ["臺中市"] : []',
            "const MIN_ACTIVE_TOWN_NPCS = 6", "const MAX_ACTIVE_TOWN_NPCS = 10",
            "const BACKGROUND_NPC_UPDATE_SECONDS = 2", "function refreshActiveNpcSimulationSet",
            "chosen.length < MIN_ACTIVE_TOWN_NPCS", ".slice(0, MAX_ACTIVE_TOWN_NPCS)",
            "npc.backgroundSimulated", "!person.backgroundSimulated",
        ):
            self.assertIn(marker, app)

    def test_town_frame_recovers_and_neighbor_events_use_generalized_zones(self) -> None:
        app = self.read("web/lunch-town/app.js")
        frame = app.split("function frame(now) {", 1)[1].split("\n}\n\nfunction updatePlayer", 1)[0]
        event = app.split("function updateTownEvent(now, delta) {", 1)[1].split("\n}\n\nfunction startTownEvent", 1)[0]
        start_event = app.split("function startTownEvent(now) {", 1)[1].split("\n}\n\nfunction resolveTownEvent", 1)[0]
        zone_lookup = app.split("function districtZoneForName(district) {", 1)[1].split("\n}", 1)[0]

        self.assertIn("try {", frame)
        self.assertIn("} catch (error) {", frame)
        self.assertIn("} finally {", frame)
        self.assertIn("scheduleTownFrame();", frame)
        self.assertIn("ensureTownFrameRunning();", app)
        self.assertIn("state.neighborDistrictThemes.get(district)?.zone", zone_lookup)
        self.assertIn("districtZoneForName(event.district)", event)
        self.assertIn("districtZoneForName(district)", start_event)
        self.assertNotIn("DISTRICT_ZONES[event.district]", event)

    def test_all_town_character_dialogue_has_english_copy(self) -> None:
        app = self.read("web/lunch-town/app.js")
        themes = json.loads(self.read("web/lunch-town/taichung-district-themes.json"))
        locale_source = self.read("web/locales/en.js")
        english, _ = json.JSONDecoder().raw_decode(
            locale_source.split("window.LunchEnglish = ", 1)[1]
        )
        dialogue_block = app.split("const ROLE_DIALOGUES = {", 1)[1].split(
            "\n};\n\nconst PLAYER_AVATAR_LABELS", 1
        )[0]
        role_dialogues = re.findall(r'^\s+"([^"]+)",?$', dialogue_block, re.MULTILINE)
        child_block = app.split("const CHILD_NAMES = [", 1)[1].split("];", 1)[0]
        child_names = re.findall(r'"([^"]+)"', child_block)
        adults_block = app.split("const DISTRICT_ADULTS = [", 1)[1].split("];", 1)[0]
        adult_names = re.findall(r'name: "([^"]+)"', adults_block)
        roles_block = app.split("const ROLE_LABELS = {", 1)[1].split("\n};", 1)[0]
        role_labels = re.findall(r': "([^"]+)"', roles_block)
        sources = {
            *(item["name"] for item in themes["districts"]),
            *(item["dialogue"] for item in themes["districts"]),
            *role_dialogues,
            *child_names,
            *adult_names,
            *role_labels,
            "今天的小鎮很熱鬧，慢慢走、仔細看看吧。",
            "結束對話",
        }
        missing = sorted(source for source in sources if source not in english)
        untranslated = sorted(
            source for source in sources
            if source in english and re.search(r"[\u3400-\u9fff]", english[source])
        )
        self.assertEqual(missing, [])
        self.assertEqual(untranslated, [])

    def test_town_draws_distinct_officially_sourced_district_features(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        for feature in ("wetland", "harbor", "wheat", "opera", "mansion-fog", "atayal-spring", "station-watermelon"):
            self.assertIn(f'feature === "{feature}"', app)
        self.assertIn("drawDistrictFeatures", app)
        self.assertIn("drawDistrictFeature", app)
        self.assertIn('id="districtSource"', html)
        self.assertIn("官方特色來源", html)

    def test_all_districts_have_landmarks_snack_shops_and_original_convenience_stores(self) -> None:
        app = self.read("web/lunch-town/app.js")
        themes = json.loads(self.read("web/lunch-town/taichung-district-themes.json"))
        self.assertEqual(themes["schemaVersion"], 3)
        for district in themes["districts"]:
            self.assertTrue(district["landmarks"])
            self.assertTrue(all(item["name"] and item["style"] for item in district["landmarks"]))
            self.assertTrue(district["snackShop"]["name"])
            self.assertTrue(district["snackShop"]["specialty"])
        landmarks_by_district = {
            district["name"]: {landmark["name"] for landmark in district["landmarks"]}
            for district in themes["districts"]
        }
        self.assertIn("臺中公園湖心亭", landmarks_by_district["北區"])
        self.assertIn("國立自然科學博物館", landmarks_by_district["北區"])
        self.assertIn("國立臺灣美術館", landmarks_by_district["西區"])
        self.assertIn("大墩文化中心", landmarks_by_district["西區"])
        self.assertIn("葫蘆墩文化中心", landmarks_by_district["豐原區"])
        for original_brand in ("日曜便利", "青葉商店", "福星小站"):
            self.assertIn(original_brand, app)
        for copied_brand in ("7-11", "全家便利商店", "萊爾富"):
            self.assertNotIn(copied_brand, app)
        for behavior in ("drawConvenienceStore", "drawSnackShop", "openVenue", "drawVenueOccupancy"):
            self.assertIn(behavior, app)

    def test_npcs_make_role_based_cross_district_trips_and_pets_wander(self) -> None:
        app = self.read("web/lunch-town/app.js")
        for behavior in (
            "ROLE_DESTINATION_PREFERENCES", "mobilityModeFor", "chooseNpcDistrictRoute",
            "districtGridDistance", "chooseRoleDestination", "createCrossDistrictWaypoints",
            "insideVenueId", "updatePets", "choosePetTarget",
        ):
            self.assertIn(behavior, app)
        self.assertIn("const route = [identity.district]", app)
        self.assertIn('identity.role === "candidate" ? 0', app)
        self.assertIn('identity.role === "candidate" ? ""', app)
        self.assertIn("跨區走訪", app)
        self.assertIn("向居民問候並聽取意見", app)
        self.assertIn("江啟臣", app)
        self.assertIn("何欣純", app)

    def test_dogs_walk_with_adult_npc_owners_and_visible_leashes(self) -> None:
        app = self.read("web/lunch-town/app.js")
        self.assertIn("function dogWalkerForDistrict", app)
        self.assertIn('const kind = index % 2 ? "dog" : "cat"', app)
        self.assertIn("ownerName: owner?.name", app)
        self.assertIn("ownerLookIndex: owner?.lookIndex", app)
        self.assertIn("owner.hasLeashedDog = true", app)
        self.assertIn("owner.bikePreference = false", app)
        self.assertIn("function dogOwnerFor", app)
        self.assertIn("npc.name === pet.ownerName", app)
        self.assertIn("function updateLeashedDog", app)
        self.assertIn('if (pet.kind === "dog")', app)
        self.assertIn("function drawDogLeashes", app)
        self.assertIn('drawTownLayer("dog-leashes", drawDogLeashes);\n  actors.forEach', app)
        self.assertIn("function drawDogLeash", app)
        self.assertIn("if (leashDistance > 64) return", app)
        self.assertIn("const leashSide = pet.x < owner.x ? -1 : 1", app)
        self.assertIn("context.lineTo(Math.round(collarX), Math.round(collarY))", app)
        self.assertIn("npc.hasLeashedDog", app)
        self.assertIn("牽著狗散步", app)
        self.assertIn("!pet.hidden", app)
        self.assertIn("app.js?v=20261106-crop-lifecycle", self.read("web/lunch-town/index.html"))

    def test_town_has_visible_youbike_stations_and_rental_trips(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        for behavior in (
            "createBikeStations", "npcPrefersBike", "bikeStationStop", "segmentUsesBike",
            "drawBikeStations", "drawBikeStation", "drawParkedBike", "drawNpcBicycle",
            "bikeStationAccessPoint", "bikeStationHitRect", "nearbyBikeStation", "interactWithBikeStation",
        ):
            self.assertIn(f"function {behavior}", app)
        self.assertIn("bikeStations: []", app)
        self.assertIn('pendingBikeStationId: ""', app)
        self.assertIn("ridingBike: false", app)
        self.assertIn('label: `${district} YouBike 站`', app)
        self.assertIn("w: 112", app)
        self.assertIn("h: 32", app)
        self.assertIn("bikeCount: 4 + index % 3", app)
        self.assertIn('context.fillText("YouBike 2.0"', app)
        self.assertIn('context.fillText("公共自行車租賃站"', app)
        self.assertIn('bikeStationStop(fromDistrict, "rent", role)', app)
        self.assertIn('bikeStationStop(toDistrict, "return", role)', app)
        self.assertIn('bikeAction: action', app)
        self.assertIn('npc.activity = ridingBike ? "cycling" : "walking"', app)
        self.assertIn("const PLAYER_BIKE_SPEED = 272", app)
        self.assertIn("const BIKE_SPEED_MULTIPLIER = 3", app)
        self.assertIn("state.player.ridingBike = !state.player.ridingBike", app)
        self.assertIn('interactWithBikeStation(bikeStation, "map_click")', app)
        self.assertIn('interactWithBikeStation(station, "map_arrival")', app)
        self.assertIn("state.environment?.isRaining && !npc.ridingBike", app)
        self.assertIn("!npc.ridingBike", app)
        self.assertIn("點道路移動・點人物、學校、建築或 YouBike 站互動", html)
        self.assertIn("Enter／空白鍵：對話、進入建築、查看午餐或租還 YouBike", html)

    def test_player_starts_at_an_owned_home_with_residential_neighborhoods(self) -> None:
        app = self.read("web/lunch-town/app.js")
        styles = self.read("web/lunch-town/styles.css")
        for marker in (
            'homeVenueId: "player-home"',
            "function createResidentialVenues",
            "function configurePlayerHome",
            "function placePlayerAtHome",
            "function drawPlayerHome",
            "function drawTownhouse",
            "function drawApartment",
            "renovationPaths",
            'label: "陽光庭院之家"',
            'w: 220',
            'h: 72',
            "function playerHomeAvatarPickerMarkup",
            "function renderAvatarPreviewCanvases",
            "data-current-avatar-preview",
            "一樓有明亮客廳與廚房",
        ):
            self.assertIn(marker, app)
        for marker in (
            ".meal-dialog.is-player-home",
            ".player-home-shell",
            ".home-room-scene",
            ".home-dressing-mirror",
            ".home-avatar-card",
        ):
            self.assertIn(marker, styles)
        self.assertIn("placePlayerAtHome();", app)
        self.assertIn("addResidentialStops", app)

    def test_civic_center_has_a_residential_neighborhood_and_every_npc_gets_a_unit(self) -> None:
        app = self.read("web/lunch-town/app.js")
        for marker in (
            "function createCivicNeighborhoodVenues",
            'id: "civic-south-neighborhood"',
            'id: "civic-south-apartment-a"',
            'id: "civic-south-apartment-b"',
            'id: "civic-south-apartment-c"',
            'id: "civic-south-apartment-d"',
            'id: "civic-south-townhouses"',
            'id: "civic-south-townhouses-east"',
            'id: "civic-south-townhouses-west"',
            'id: "civic-south-courtyard-homes"',
            'id: "civic-south-convenience"',
            'id: "civic-south-night-convenience"',
            'hubKind: "civic-neighborhood"',
            "const southBlockY = y + DISTRICT_ZONE_HEIGHT + DISTRICT_ZONE_GAP_Y",
            "function drawCivicNeighborhoodHub",
            'parentHubId: civicCenter.id',
            "function assignNpcResidences",
            "identity.residenceUnitId",
            "identity.residenceLabel",
            "function venueAtPoint",
            "登記住戶",
        ):
            self.assertIn(marker, app)
        self.assertIn("assignNpcResidences(identities);", app)
        self.assertIn("addResidentialStops(identity, civicSchedule, districtIndex, true)", app)
        self.assertNotIn('["mayor", "candidate", "borough-chief", "city-councilor", "civil-servant", "city-supervisor"].includes(identity.role)) return', app)

    def test_city_hall_staff_leave_the_office_after_hours(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        for marker in (
            "CIVIC_AFTER_HOURS_ROLES",
            "function civicAfterHoursPeriod",
            "function createCivicAfterHoursSchedule",
            "function transitionCivicAfterHoursRoutine",
            'if (hour >= 23 || hour < 7) return "late-night"',
            "civicDaySchedule",
            "civicAfterHoursRoutineKey",
            "市府已下班，正在回家或安排晚間採買",
            "今晚不再返回市府辦公區",
        ):
            self.assertIn(marker, app)
        self.assertIn('venue.id === "civic-south-night-convenience"', app)
        self.assertIn('!CIVIC_AFTER_HOURS_ROLES.has(npc.role) && !NEIGHBOR_CIVIC_ROLES.has(npc.role)', app)
        self.assertIn("const civicAfterHours = transitionNeighborCivicAfterHoursRoutine(npc, index)", app)
        self.assertIn('/locales/en.js?v=20261106-crop-lifecycle', html)
        self.assertIn('/i18n.js?v=20261106-crop-lifecycle', html)

    def test_npcs_take_evening_trips_to_department_stores_and_lalaport(self) -> None:
        app = self.read("web/lunch-town/app.js")
        self.assertIn("EVENING_SHOPPING_ROLES", app)
        self.assertIn("function maybeStartEveningShoppingTrip", app)
        self.assertIn('venue.type === "department-store"', app)
        self.assertIn('["lalaport", "harbor-outlet"]', app)
        self.assertIn("晚上到${destination.label}用餐、逛逛商店或和人碰面", app)
        self.assertIn("finishEveningShoppingTrip", app)

    def test_moving_away_fades_comic_bubbles_instead_of_pinning_them_to_the_viewport(self) -> None:
        app = self.read("web/lunch-town/app.js")
        styles = self.read("web/lunch-town/styles.css")
        self.assertIn("function hideComicBubble", app)
        self.assertIn("function showComicBubble", app)
        self.assertIn("speakerIsVisible", app)
        self.assertIn("isMovingAwayFromMoment", app)
        self.assertIn("if (state.player.isMoving)", app)
        self.assertIn(".comic-bubble.is-fading", styles)
        self.assertIn("transition: opacity 240ms ease", styles)

    def test_public_safety_and_health_buildings_have_gender_balanced_staff(self) -> None:
        app = self.read("web/lunch-town/app.js")
        for venue in ("police-station", "fire-station", "hospital"):
            self.assertIn(f'"{venue}"', app)
        for role in ("police-officer", "firefighter", "doctor"):
            self.assertIn(f'role: "{role}"', app)
        self.assertIn("SERVICE_STAFF_NAMES", app)
        self.assertIn('const gender = index % 2 === 0 ? "female" : "male"', app)
        self.assertIn("drawServiceVenue", app)

    def test_mayor_and_fictional_city_staff_are_anchored_to_the_civic_center(self) -> None:
        app = self.read("web/lunch-town/app.js")
        self.assertIn('district: "西屯區", name: "盧秀燕", role: "mayor"', app)
        self.assertIn('homeVenueId: "civic-center"', app)
        self.assertIn("const CITY_HALL_NPCS = [", app)
        self.assertEqual(app.count('role: "civil-servant"'), 6)
        self.assertEqual(app.count('role: "city-supervisor"'), 4)
        self.assertIn("function createCivicCenterSchedule", app)
        self.assertIn('["mayor", "civil-servant", "city-supervisor"]', app)
        self.assertIn('"civic-center": ["office-worker", "civil-servant", "city-supervisor"', app)
        self.assertNotIn('name: "洪麗華", role: "candidate"', app)

    def test_repeated_outfit_styles_receive_varied_color_palettes(self) -> None:
        app = self.read("web/lunch-town/app.js")
        self.assertIn("OUTFIT_COLOR_PALETTES", app)
        self.assertIn("LIGHT_UNIFORM_PALETTES", app)
        self.assertIn("varyOutfitColors", app)
        self.assertIn("hashText", app)
        self.assertIn('"police-uniform"', app)
        self.assertIn('"fire-uniform"', app)

    def test_achievement_handbook_scrolls_and_categories_can_collapse(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        styles = self.read("web/lunch-town/styles.css")
        self.assertIn('id="questPanel" tabindex="0"', html)
        self.assertIn('aria-describedby="achievementScrollNote"', html)
        self.assertIn('id="achievementExpandAll" type="button" disabled', html)
        self.assertIn('id="achievementCollapseAll" type="button" disabled', html)
        self.assertIn('details class="achievement-category"', app)
        self.assertIn('summary class="achievement-category-heading"', app)
        self.assertIn('const expandedCategories = new Set(', app)
        self.assertIn('function setAchievementCategoriesExpanded(expanded)', app)
        self.assertIn('category.open = expanded', app)
        self.assertIn('refs.questPanel.focus({ preventScroll: true })', app)
        self.assertIn('max-height: calc(100dvh - 28px)', styles)
        self.assertIn('overscroll-behavior: contain', styles)
        self.assertIn('scrollbar-gutter: stable', styles)
        self.assertIn('.achievement-category[open] > .achievement-category-heading::before', styles)
        self.assertIn('top: auto;', styles)

    def test_account_bound_taichung_achievement_book_replaces_one_off_quest(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        styles = self.read("web/lunch-town/styles.css")
        achievements = self.read("lib/town-achievements.ts")
        schema = self.read("db/schema.ts")
        account_panel = self.read("web/account-panel.js")
        self.assertIn('id="townAccountAction" data-account-panel-trigger', html)
        self.assertIn('data-authenticated-label="家庭帳號"', html)
        self.assertIn("登入／免費註冊・保存任務與金幣", html)
        self.assertIn('id="achievementAccountLink" data-account-panel-trigger type="button"', html)
        self.assertIn('/line-auth-return.js?v=20261104-town-auth', html)
        self.assertIn('/account-panel.js?v=20261104-town-auth', html)
        self.assertNotIn('href="/?account=1"', html)
        self.assertNotIn('id="townAuthDialog"', html)
        self.assertIn('returnTo: lineAuthReturnPath()', account_panel)
        self.assertIn('return window.location.pathname.startsWith("/lunch-town") ? "/lunch-town/" : "/"', account_panel)
        self.assertIn('id="sharedLineSignIn"', account_panel)
        self.assertIn('id="sharedLinkLineAccount"', account_panel)
        self.assertIn('startLineAuth("login")', account_panel)
        self.assertIn('startLineAuth("link")', account_panel)
        self.assertIn('fetch("/api/auth/line/start"', account_panel)
        self.assertIn('window.dispatchEvent(new CustomEvent("accountpanelchange"', account_panel)
        self.assertIn('window.addEventListener("accountpanelchange"', app)
        self.assertNotIn("LunchTownAuth", app)
        self.assertIn('id="achievementList"', html)
        self.assertIn('id="achievementToast" role="status" aria-live="polite"', html)

        self.assertIn("成就是一次性的長期收藏", html)
        self.assertNotIn("TODAY'S QUEST", html)
        self.assertNotIn("走訪臺中 29 區學校", html)
        self.assertIn("/api/account/town-achievements", app)
        self.assertIn('recordAchievementEvent("medical_rescue"', app)
        self.assertIn('recordAchievementEvent("theft_assist"', app)
        self.assertIn('recordAchievementEvent("landmark_visit"', app)
        self.assertIn('recordAchievementEvent("district_visit"', app)
        self.assertIn('recordAchievementEvent("school_visit"', app)
        self.assertIn('recordAchievementEvent("npc_talk"', app)
        self.assertIn('recordAchievementEvent("bike_rental"', app)
        self.assertIn('recordAchievementEvent("daily_story"', app)
        self.assertIn("未登入時只供預覽，不會假裝已永久保存進度", html)
        self.assertIn("townAchievementEvents", schema)
        self.assertIn("townAchievementUnlocks", schema)
        self.assertIn('achievement("medical-three"', achievements)
        self.assertIn('achievement("district-all"', achievements)
        self.assertEqual(achievements.count("  achievement("), 19)
        self.assertIn('achievement("mayor-meeting"', achievements)
        self.assertIn('achievement("candidate-ho"', achievements)
        self.assertIn('achievement("candidate-chiang"', achievements)
        self.assertIn('achievement("civic-collection"', achievements)
        self.assertIn('"西屯區:盧秀燕"', achievements)
        self.assertIn(".achievement-account-card", styles)
        self.assertIn(".account-dialog", styles)
        self.assertIn("max-height: 94dvh", styles)
        self.assertIn(".achievement-card.is-unlocked", styles)
        self.assertIn("@keyframes achievement-toast-in", styles)

    def test_daily_quests_are_account_bound_separate_from_achievements_and_reward_coins(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        styles = self.read("web/lunch-town/styles.css")
        english = self.read("web/locales/en.js")
        quests = self.read("lib/town-daily-quests.ts")
        achievements = self.read("lib/town-achievements.ts")
        route = self.read("app/api/account/town-daily-quests/route.ts")
        schema = self.read("db/schema.ts")
        migration = self.read("drizzle/0018_sharp_punisher.sql")

        self.assertIn('id="dailyQuestList"', html)
        self.assertIn('id="dailyCoinBalance"', html)
        self.assertIn("小鎮生活、午餐探索與城市散步各一題", html)
        self.assertIn("每天可免費更換一題尚未完成的任務", html)
        self.assertIn("購買家具或服裝不會被列為賺取金幣的條件", html)
        self.assertIn("function loadTownDailyQuests", app)
        self.assertIn("function recordDailyQuestEvent", app)
        self.assertIn("function rerollDailyQuest", app)
        self.assertIn('recordDailyQuestEvent("bike_return"', app)
        self.assertIn('recordDailyQuestEvent("venue_visit"', app)
        self.assertIn('recordDailyQuestEvent("dish_pick"', app)
        self.assertIn("function observeDailyBridgeCrossing", app)
        self.assertIn("function observeDailyMapCheckpoints", app)
        self.assertIn("dailyWalkPending", app)
        self.assertGreater(
            app.index("accumulateDailyWalkDistance(Math.hypot"),
            app.index("const movedY = tryMovePlayer"),
        )
        self.assertIn("state.dailyQuestEventMemory.clear()", app)
        self.assertIn(".daily-quest-board", styles)
        self.assertIn(".daily-quest-card.is-complete", styles)
        self.assertIn(".daily-dish-pick", styles)

        self.assertEqual(quests.count('  task("'), 18)
        self.assertIn('export type TownDailyCategory = "life" | "food" | "explore"', quests)
        self.assertIn("TOWN_DAILY_ALL_CLEAR_BONUS = 15", quests)
        self.assertIn('life: 10', quests)
        self.assertIn('food: 15', quests)
        self.assertIn('explore: 20', quests)
        self.assertIn("replacementTownDailyTask", quests)
        self.assertNotIn('"town_visit"', quests)
        self.assertNotIn('"district_visit"', quests)
        self.assertNotIn('"landmark_visit"', quests)
        self.assertNotIn('"npc_talk"', quests)
        self.assertIn('"town_visit"', achievements)

        self.assertIn("townDailyQuestEvents", schema)
        self.assertIn("townDailyQuestOverrides", schema)
        self.assertIn("townCoinLedger", schema)
        self.assertIn("CREATE TABLE `town_daily_quest_events`", migration)
        self.assertIn("CREATE TABLE `town_daily_quest_overrides`", migration)
        self.assertIn("CREATE TABLE `town_coin_ledger`", migration)
        self.assertIn("INSERT OR IGNORE INTO town_coin_ledger", route)
        self.assertIn("INSERT OR IGNORE INTO town_daily_quest_events", route)
        self.assertIn("INSERT OR IGNORE INTO town_daily_quest_overrides", route)
        self.assertIn("isSameOriginMutation", route)
        self.assertIn("taipeiDateKey", route)
        self.assertIn('"回家報到": "Check in at home"', english)
        self.assertIn('"每日任務完成": "Daily quest complete"', english)
        self.assertIn("app.js?v=20261106-crop-lifecycle", html)
        self.assertIn("/locales/en.js?v=20261106-crop-lifecycle", html)
        self.assertIn("/i18n.js?v=20261106-crop-lifecycle", html)

    def test_lunch_town_line_login_icon_stays_inside_pixel_button(self) -> None:
        html = self.read("web/lunch-town/index.html")
        styles = self.read("web/lunch-town/styles.css")
        scoped_button = styles.split(".account-dialog .line-icon-button {", 1)[1].split("}", 1)[0]
        scoped_image = styles.split(".account-dialog .line-icon-button img {", 1)[1].split("}", 1)[0]
        self.assertIn("styles.css?v=20261106-crop-lifecycle", html)
        self.assertIn("overflow: hidden", scoped_button)
        self.assertIn("width: 48px", scoped_image)
        self.assertIn("height: 48px", scoped_image)
        self.assertIn("object-fit: contain", scoped_image)
        self.assertIn("width: 64px", self.read("web/styles.css").split(".line-icon-button {", 1)[1].split("}", 1)[0])

    def test_town_crops_grow_persist_and_require_a_farmer_to_harvest(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        english = self.read("web/locales/en.js")
        i18n = self.read("web/i18n.js")
        registry = app.split("function registerCropPlot(definition", 1)[1].split("\n}\n\nfunction cropLifecycleAt", 1)[0]
        lifecycle = app.split("function cropLifecycleAt(plot", 1)[1].split("\n}\n\nfunction cropVisibleGrowth", 1)[0]
        harvest = app.split("function updateNpcCropHarvest(npc", 1)[1].split("\n}\n\nfunction schoolBuildingRect", 1)[0]

        self.assertIn("const CROP_GROWTH_DURATION_MS", app)
        self.assertIn("cropPlots: new Map()", app)
        self.assertIn("cropPlotsByDistrict: new Map()", app)
        self.assertIn("createTownCropPlots(performance.now())", app)
        self.assertIn("venue.cropType && venue.district", app)
        self.assertIn("CROP_TYPE_BY_DISTRICT_FEATURE[theme.feature]", app)
        self.assertIn("cropLifecycleForPlotId(districtFeatureCropPlotId(theme), now)", app)
        self.assertIn("Math.min(1, (now - plot.growthStartedAt)", lifecycle)
        self.assertNotIn("harvest", lifecycle.lower(), "growth reaching maturity must not harvest or remove crops")
        self.assertIn("CROP_HARVEST_ROLES.has(npc.role)", harvest)
        self.assertIn("distance <= CROP_HARVEST_REACH", harvest)
        self.assertIn("maturePlot.growthStartedAt = now + CROP_FALLOW_DURATION_MS", harvest)
        self.assertNotRegex(registry + lifecycle + harvest, r"miaoli|changhua|苗栗|彰化")
        self.assertIn("cropLifecycleForPlotId(backgroundCropPlotId(theme, parcelIndex)", app)
        self.assertIn("cropLifecycleForPlotId(workZoneCropPlotId(zone), now)", app)
        self.assertIn('harvesting: `在${location}採收成熟作物，採收後田區暫時留空`', app)
        self.assertIn('"在{0}採收成熟作物，採收後田區暫時留空": [0]', i18n)
        self.assertIn('"Harvesting mature crops at {0}; the plot stays briefly empty afterward."', english)
        self.assertIn("app.js?v=20261106-crop-lifecycle", html)
        self.assertIn("/locales/en.js?v=20261106-crop-lifecycle", html)
        self.assertIn("/i18n.js?v=20261106-crop-lifecycle", html)

    def test_framework_route_serves_the_town_page(self) -> None:
        route = self.read("app/lunch-town/route.ts")
        self.assertIn('import lunchTownHtml from "@/web/lunch-town/index.html?raw";', route)
        self.assertIn("new Response(lunchTownHtml", route)

    def test_published_map_editor_content_uses_a_safe_district_lane(self) -> None:
        app = self.read("web/lunch-town/app.js")
        schema = self.read("db/schema.ts")
        public_route = self.read("app/api/lunch-town/map/route.ts")
        private_route = self.read("app/api/internal/operations/town-map/route.ts")

        self.assertIn('fetch("/api/lunch-town/map"', app)
        self.assertIn("townMapEditorLaneHeight", app)
        self.assertIn("applyTownMapPlacements", app)
        self.assertIn("appendTownMapNeighborCharacters", app)
        self.assertIn("venueDisplayLabel", app)
        self.assertIn("townMapRevisions", schema)
        self.assertIn("WHERE action = 'publish'", public_route)
        self.assertIn("parseTownMapEditorInput", private_route)
        self.assertIn("SELECT COALESCE(MAX(id), 0)", private_route)

    def test_map_editor_draft_preview_uses_the_real_town_without_recording_progress(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        styles = self.read("web/lunch-town/styles.css")
        english = self.read("web/locales/en.js")
        schema = self.read("db/schema.ts")
        preview_route = self.read("app/api/lunch-town/map/preview/route.ts")

        self.assertIn('id="mapPreviewBanner"', html)
        self.assertIn('get("map-preview")', html)
        self.assertLess(html.index('get("map-preview")'), html.index("googletagmanager.com"))
        self.assertIn('fetch("/api/lunch-town/map/preview"', app)
        self.assertIn("placePlayerAtTownMapPreview", app)
        self.assertIn("venue.townMapPlacementId === placementId", app)
        self.assertGreaterEqual(app.count("if (state.townMapPreview.active) return;"), 3)
        self.assertIn(".map-preview-banner", styles)
        self.assertIn('"草稿測試模式": "Draft test mode"', english)
        self.assertIn("townMapPreviews", schema)
        self.assertIn('"referrer-policy": "no-referrer"', preview_route)
        self.assertIn("expires_at <=", self.read("app/api/internal/operations/town-map/route.ts"))


if __name__ == "__main__":
    unittest.main()
