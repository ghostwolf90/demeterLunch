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

    def test_town_map_labels_every_school_with_a_readable_primary_school_name(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        self.assertIn("drawCompactSchoolSign(school)", app)
        self.assertIn("formatSchoolMapLabel", app)
        self.assertIn('.replace(/國民小學/g, "國小")', app)
        self.assertIn("fitSchoolLabelFont", app)
        self.assertIn("splitSchoolMapLabel", app)
        self.assertNotIn("String(school.name).slice(0, 6)", app)
        self.assertIn("styles.css?v=20261103-civic-housing", html)
        self.assertIn("app.js?v=20261103-civic-neighborhood-night", html)

    def test_player_can_walk_through_school_signs_and_all_buildings(self) -> None:
        app = self.read("web/lunch-town/app.js")
        move_player = app.split("function tryMovePlayer(dx, dy) {", 1)[1].split("\n}\n", 1)[0]
        self.assertIn("state.player.x = next.x", move_player)
        self.assertIn("state.player.y = next.y", move_player)
        self.assertNotIn("collision", move_player.lower())
        self.assertNotIn("return", move_player)

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
        self.assertIn("path.lineTo(x, WORLD_HEIGHT)", app)
        self.assertIn("path.lineTo(WORLD_WIDTH, y)", app)
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
        self.assertIn('/product-analytics.js?v=20261103-civic-housing', html)
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

    def test_town_has_occasional_stylish_adult_npcs_and_switchable_player_styles(self) -> None:
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
        self.assertIn("PLAYER_PROFILES", app)
        self.assertIn("loadPlayerStylePreference", app)
        self.assertIn("setPlayerStyle", app)
        self.assertIn("lunchTownPlayerStyle", app)
        self.assertIn('data-player-style="female"', html)
        self.assertIn('data-player-style="male"', html)
        self.assertIn('.player-style-picker button[aria-pressed="true"]', styles)

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
        self.assertIn("shouldUseCoarseMobileUpdate(npc, npcDistrict)", app)
        self.assertIn("shouldUseCoarseMobileUpdate(pet, pet.district)", app)
        self.assertIn("shouldUseCoarseMobileUpdate(bird, bird.district)", app)
        self.assertIn("coarseElapsed", app)
        self.assertIn("bird.coarseElapsed", app)
        self.assertIn("pet.coarseElapsed", app)
        self.assertIn("const nearestNpc = bird.district === state.activeDistrict", app)
        self.assertIn("const startled = bird.species === \"sparrow\"", app)

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
        self.assertIn("20261103-civic-housing", html)

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
        self.assertIn("臺中 29 區營養午餐小鎮", html)
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
        for draft_word in ("模擬", "測試", "示範", "虛構", "開發中", "預覽版"):
            self.assertNotIn(draft_word, html)
            self.assertNotIn(draft_word, app)
            self.assertNotIn(draft_word, themes)
        self.assertIn('accessory: "clipboard"', app)
        self.assertIn('accessory: "flag"', app)
        self.assertIn('accessory: "medical"', app)

    def test_all_town_character_dialogue_has_english_copy(self) -> None:
        app = self.read("web/lunch-town/app.js")
        themes = json.loads(self.read("web/lunch-town/taichung-district-themes.json"))
        locale_source = self.read("web/locales/en.js")
        english, _ = json.JSONDecoder().raw_decode(
            locale_source.split("window.LunchEnglish = ", 1)[1]
        )
        dialogue_block = app.split("const ROLE_DIALOGUES = {", 1)[1].split(
            "\n};\n\nconst PLAYER_PROFILE", 1
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
        self.assertIn("function updateLeashedDog", app)
        self.assertIn('if (pet.kind === "dog")', app)
        self.assertIn("function drawDogLeash", app)
        self.assertIn("context.lineTo(Math.round(pet.x), Math.round(pet.y - 4))", app)
        self.assertIn("npc.hasLeashedDog", app)
        self.assertIn("牽著狗散步", app)
        self.assertIn("!pet.hidden", app)
        self.assertIn("app.js?v=20261103-civic-neighborhood-night", self.read("web/lunch-town/index.html"))

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
        for marker in (
            'homeVenueId: "player-home"',
            "function createResidentialVenues",
            "function configurePlayerHome",
            "function placePlayerAtHome",
            "function drawPlayerHome",
            "function drawTownhouse",
            "function drawApartment",
            "renovationPaths",
            "日後正式改建會綁定家庭帳號保存",
        ):
            self.assertIn(marker, app)
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
        self.assertIn('if (!CIVIC_AFTER_HOURS_ROLES.has(npc.role)) maybeStartEveningShoppingTrip', app)
        self.assertIn("const civicAfterHours = transitionCivicAfterHoursRoutine(npc, index)", app)
        self.assertIn('/locales/en.js?v=20261103-civic-neighborhood-night', html)
        self.assertIn('/i18n.js?v=20261103-civic-neighborhood-night', html)

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

    def test_account_bound_taichung_achievement_book_replaces_one_off_quest(self) -> None:
        app = self.read("web/lunch-town/app.js")
        html = self.read("web/lunch-town/index.html")
        styles = self.read("web/lunch-town/styles.css")
        achievements = self.read("lib/town-achievements.ts")
        schema = self.read("db/schema.ts")
        self.assertIn('id="townAccountAction" href="/?account=1"', html)
        self.assertIn("免費註冊・保存成就", html)
        self.assertIn('id="achievementList"', html)
        self.assertIn('id="achievementToast" role="status" aria-live="polite"', html)
        self.assertIn("臺中成就是第一冊", html)
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
        self.assertIn("未登入時可預覽成就，但不會假裝已永久保存進度", html)
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
        self.assertIn(".achievement-card.is-unlocked", styles)
        self.assertIn("@keyframes achievement-toast-in", styles)

    def test_framework_route_serves_the_town_page(self) -> None:
        route = self.read("app/lunch-town/route.ts")
        self.assertIn('import lunchTownHtml from "@/web/lunch-town/index.html?raw";', route)
        self.assertIn("new Response(lunchTownHtml", route)


if __name__ == "__main__":
    unittest.main()
