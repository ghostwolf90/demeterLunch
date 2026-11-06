import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../web/lunch-town/app.js", import.meta.url), "utf8");

function fn(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const end = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, end < 0 ? undefined : end);
}

function load() {
  const bridge = { x: 500, riverY: 600 };
  const outerRiver = { x: 500, riverY: 100, meanderScale: 0 };
  const context = {
    NATURAL_TERRAIN_MARGIN: 10,
    RIVER_BRIDGE_PASSAGE_HALF_WIDTH: 28,
    BORDER_RIVER_WIDTH: 112,
    EAST_MOUNTAIN_START_X: 1000,
    WORLD_WIDTH: 1500,
    WORLD_HEIGHT: 2000,
    BOUNDARY_BRIDGES: [bridge],
    OUTER_BOUNDARY_RIVERS: [outerRiver],
    npcSegmentRouteCache: new WeakMap(),
    state: { player: { x: 200, y: 300 } },
    coastlineXAt() { return 100; },
  };
  vm.createContext(context);
  vm.runInContext([
    "boundaryRiverYAt", "playerNaturalTerrainMoveAllowed", "pointIsOnRiverBridge",
    "naturalTerrainCollisionDepth", "boundaryRiverCollisionDepth", "npcSafeNaturalTerrainPoint", "npcSegmentIntersectsBoundaryRiver",
    "npcRiverbankWaypoints", "npcBoundaryRiverDetour", "npcSegmentRoute", "cachedNpcSegmentRoute",
    "npcRouteLength", "npcPointAlongRoute", "npcNaturalTerrainMoveAllowed", "clampTownPoint", "tryMovePlayer",
  ].map(fn).join("\n") + "\nObject.assign(globalThis, { boundaryRiverYAt, playerNaturalTerrainMoveAllowed, pointIsOnRiverBridge, naturalTerrainCollisionDepth, boundaryRiverCollisionDepth, npcSafeNaturalTerrainPoint, npcSegmentIntersectsBoundaryRiver, npcRiverbankWaypoints, npcBoundaryRiverDetour, npcSegmentRoute, cachedNpcSegmentRoute, npcRouteLength, npcPointAlongRoute, npcNaturalTerrainMoveAllowed, clampTownPoint, tryMovePlayer });", context);
  return { context, bridge };
}

test("only sea, mountains, and rivers block the player while bridges remain open", () => {
  const { context, bridge } = load();
  assert.equal(context.naturalTerrainCollisionDepth({ x: 200, y: 300 }), 0);
  assert.ok(context.naturalTerrainCollisionDepth({ x: 105, y: 300 }) > 0, "sea blocks");
  assert.ok(context.naturalTerrainCollisionDepth({ x: 995, y: 300 }) > 0, "mountains block");
  assert.ok(context.naturalTerrainCollisionDepth({ x: 700, y: context.boundaryRiverYAt(700, bridge) }) > 0, "river blocks");
  assert.ok(context.naturalTerrainCollisionDepth({ x: 500, y: 100 }) > 0, "outer river blocks");
  assert.equal(context.naturalTerrainCollisionDepth({ x: 500, y: 600 }), 0, "bridge passage stays open");
});

test("safe players cannot enter natural barriers and existing blocked players can leave", () => {
  const { context } = load();
  context.state.player = { x: 120, y: 300 };
  assert.equal(context.tryMovePlayer(-15, 0), false);
  assert.deepEqual({ ...context.state.player }, { x: 120, y: 300 });

  context.state.player = { x: 105, y: 300 };
  assert.equal(context.tryMovePlayer(0, 1), true, "a player already inside a mask is never locked in place");
  assert.equal(context.tryMovePlayer(1, 0), true);
  assert.deepEqual({ ...context.state.player }, { x: 106, y: 301 });

  context.state.player = { x: 700, y: 520 };
  assert.equal(context.tryMovePlayer(0, 40), false, "river cannot be entered away from a bridge");
  context.state.player = { x: 500, y: 520 };
  assert.equal(context.tryMovePlayer(0, 40), true, "bridge can cross the river");
});

test("NPC routes cross boundary rivers only on the bridge and never stand in water", () => {
  const { context, bridge } = load();
  const from = { x: 700, y: 500 };
  const to = { x: 700, y: 720 };
  const route = context.cachedNpcSegmentRoute(from, to);

  assert.ok(route.length > 2, "a direct river crossing gains safe waypoints");
  assert.ok(route.some((point) => Math.abs(point.x - bridge.x) < 0.001
    && Math.abs(point.y - bridge.riverY) < 0.001), "the route uses the bridge center");
  for (let step = 0; step <= 200; step += 1) {
    const point = context.npcPointAlongRoute(route, step / 200);
    assert.equal(context.naturalTerrainCollisionDepth(point), 0, `route step ${step} stays on walkable terrain`);
  }

  const sameBankFrom = { x: 650, y: 480 };
  const sameBankTo = { x: 750, y: 470 };
  assert.equal(context.npcSegmentRoute(sameBankFrom, sameBankTo).length, 2, "safe same-bank trips remain direct");

  const unsafeDestination = { x: 700, y: context.boundaryRiverYAt(700, bridge) };
  const recoveredRoute = context.npcSegmentRoute(sameBankFrom, unsafeDestination);
  assert.equal(context.naturalTerrainCollisionDepth(recoveredRoute.at(-1)), 0, "unsafe schedule stops are moved onto nearby safe ground");
});
