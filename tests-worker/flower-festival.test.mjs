import assert from "node:assert/strict";
import test from "node:test";

import {
  FLOWER_FESTIVAL_BEDS,
  FLOWER_FESTIVAL_CHUNK_SIZE,
  FLOWER_FESTIVAL_END_DATE,
  FLOWER_FESTIVAL_ENTRY,
  FLOWER_FESTIVAL_HEIGHT,
  FLOWER_FESTIVAL_LOCAL_NPCS,
  FLOWER_FESTIVAL_OBJECTS,
  FLOWER_FESTIVAL_PATHS,
  FLOWER_FESTIVAL_PHOTO_POINTS,
  FLOWER_FESTIVAL_PROMOTERS,
  FLOWER_FESTIVAL_SCALE,
  FLOWER_FESTIVAL_SHUTTLES,
  FLOWER_FESTIVAL_START_DATE,
  FLOWER_FESTIVAL_STAMPS,
  FLOWER_FESTIVAL_WIDTH,
  captureFlowerFestivalReturnState,
  flowerFestivalFlowerSample,
  flowerFestivalPhaseForDate,
  flowerFestivalPointWalkable,
  flowerFestivalVisibleChunks,
  flowerFestivalWalkingRoute,
  nextFlowerFestivalShuttle,
} from "../web/lunch-town/flower-festival.js";

test("flower festival is a large independent six-zone walking park", () => {
  assert.equal(FLOWER_FESTIVAL_SCALE, 0.8);
  assert.equal(FLOWER_FESTIVAL_WIDTH, 2240);
  assert.equal(FLOWER_FESTIVAL_HEIGHT, 1440);
  assert.equal(FLOWER_FESTIVAL_STAMPS.length, 6);
  assert.equal(FLOWER_FESTIVAL_PHOTO_POINTS.length, 3);
  assert.equal(FLOWER_FESTIVAL_SHUTTLES.length, 4);
  assert.equal(FLOWER_FESTIVAL_PATHS.filter((path) => path.kind === "main").length, 1);
  assert.equal(FLOWER_FESTIVAL_PATHS.filter((path) => path.kind === "shortcut").length, 2);
  assert.ok(FLOWER_FESTIVAL_BEDS.reduce((area, bed) => area + bed.w * bed.h, 0) > 1_000_000);
});

test("entry, interactions, and local NPCs stay on public walkable space", () => {
  assert.equal(flowerFestivalPointWalkable(FLOWER_FESTIVAL_ENTRY), true);
  for (const object of FLOWER_FESTIVAL_OBJECTS) {
    assert.equal(flowerFestivalPointWalkable(object), true, `${object.id} should be reachable`);
    assert.ok(flowerFestivalWalkingRoute(FLOWER_FESTIVAL_ENTRY, object).length > 0, `${object.id} should have a walking route`);
  }
  for (const npc of FLOWER_FESTIVAL_LOCAL_NPCS) {
    assert.equal(flowerFestivalPointWalkable(npc), true, `${npc.id} should stand on a public path`);
  }
  assert.equal(flowerFestivalPointWalkable({ x: -1, y: 200 }), false);
  assert.equal(flowerFestivalPointWalkable({ x: 1500, y: 650 }), false, "flower beds are not shortcuts");
});

test("flower rendering is stable and only visible chunks are requested", () => {
  assert.equal(FLOWER_FESTIVAL_CHUNK_SIZE, 320);
  const first = flowerFestivalFlowerSample(640, 520, "pastel-west");
  assert.equal(first, flowerFestivalFlowerSample(640, 520, "pastel-west"));
  assert.notEqual(first, flowerFestivalFlowerSample(641, 520, "pastel-west"));
  assert.deepEqual(
    flowerFestivalVisibleChunks({ x: 0, y: 0 }, { width: 480, height: 600 }),
    ["0:0", "1:0", "0:1", "1:1"],
  );
  assert.ok(flowerFestivalVisibleChunks({ x: 1200, y: 800 }, { width: 960, height: 640 }).length <= 12);
});

test("the 23-day event includes both boundary dates and closes automatically afterward", () => {
  assert.equal(FLOWER_FESTIVAL_START_DATE, "2026-10-31");
  assert.equal(FLOWER_FESTIVAL_END_DATE, "2026-11-22");
  assert.equal((Date.parse(FLOWER_FESTIVAL_END_DATE) - Date.parse(FLOWER_FESTIVAL_START_DATE)) / 86_400_000 + 1, 23);
  assert.equal(flowerFestivalPhaseForDate("2026-10-30"), "upcoming");
  assert.equal(flowerFestivalPhaseForDate("2026-10-31"), "open");
  assert.equal(flowerFestivalPhaseForDate("2026-11-22"), "open");
  assert.equal(flowerFestivalPhaseForDate("2026-11-23"), "ended");
});

test("several town ambassadors announce the dates and north-side entrance", () => {
  assert.equal(FLOWER_FESTIVAL_PROMOTERS.length, 4);
  assert.deepEqual(FLOWER_FESTIVAL_PROMOTERS.map((promoter) => promoter.district), ["西區", "西屯區", "豐原區", "大里區"]);
  for (const promoter of FLOWER_FESTIVAL_PROMOTERS) {
    assert.equal(promoter.role, "flower-ambassador");
    assert.equal(promoter.dialogues.length, 3);
    assert.match(promoter.dialogues[0], /10 月 31 日.*11 月 22 日.*23 天/u);
  }
  assert.match(FLOWER_FESTIVAL_PROMOTERS[0].dialogues[1], /新社區北側空地/u);
});

test("shuttle stops form a deterministic loop without changing stamp state", () => {
  const visited = [];
  let current = FLOWER_FESTIVAL_SHUTTLES[0];
  for (let index = 0; index < FLOWER_FESTIVAL_SHUTTLES.length; index += 1) {
    visited.push(current.id);
    current = nextFlowerFestivalShuttle(current.id);
  }
  assert.deepEqual(visited, FLOWER_FESTIVAL_SHUTTLES.map((stop) => stop.id));
  assert.equal(current.id, FLOWER_FESTIVAL_SHUTTLES[0].id);
});

test("the festival preserves the exact town position, camera, and bike state for return", () => {
  const saved = captureFlowerFestivalReturnState(
    { x: 2142.5, y: 3718.25, ridingBike: true },
    { x: 1730.5, y: 3398.25 },
  );
  assert.deepEqual(saved, {
    x: 2142.5,
    y: 3718.25,
    ridingBike: true,
    cameraX: 1730.5,
    cameraY: 3398.25,
  });
});
