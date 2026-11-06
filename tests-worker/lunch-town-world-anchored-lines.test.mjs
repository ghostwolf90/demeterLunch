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

class RecordedPath {
  constructor() { this.commands = []; }
  moveTo(...args) { this.commands.push(["moveTo", ...args]); }
  lineTo(...args) { this.commands.push(["lineTo", ...args]); }
}

function load() {
  const context = {
    Path2D: RecordedPath,
    WEST_COAST_WIDTH: 320,
    WORLD_WIDTH: 5600,
    WORLD_HEIGHT: 6500,
    EAST_MOUNTAIN_START_X: 5100,
    boundaryRiverPathCache: new Map(),
    coastlinePathCache: new Map(),
    state: { camera: { x: 0, y: 0 } },
  };
  vm.createContext(context);
  vm.runInContext([
    "coastlineXAt", "boundaryRiverYAt", "boundaryRiverBounds", "boundaryRiverPath", "traceCoastline",
  ].map(fn).join("\n") + "\nObject.assign(globalThis, { coastlineXAt, boundaryRiverYAt, boundaryRiverBounds, boundaryRiverPath, traceCoastline });", context);
  return context;
}

test("river and coastline paths stay identical when the camera moves", () => {
  const context = load();
  const river = { id: "test-river", x: 2400, riverY: 3300 };
  const firstRiverPath = context.boundaryRiverPath(river);
  const firstRiverCommands = JSON.stringify(firstRiverPath.commands);
  const firstCoastPath = context.traceCoastline(1);
  const firstCoastCommands = JSON.stringify(firstCoastPath.commands);

  context.state.camera = { x: 1800, y: 4200 };
  const movedRiverPath = context.boundaryRiverPath(river);
  const movedCoastPath = context.traceCoastline(1);

  assert.equal(movedRiverPath, firstRiverPath);
  assert.equal(movedCoastPath, firstCoastPath);
  assert.equal(JSON.stringify(movedRiverPath.commands), firstRiverCommands);
  assert.equal(JSON.stringify(movedCoastPath.commands), firstCoastCommands);
});

test("every reported dashed map path is built from stable world bounds", () => {
  const riverPath = fn("boundaryRiverPath");
  const coastlinePath = fn("traceCoastline");
  const neighborRoads = fn("drawNeighborCountyRoads");

  assert.doesNotMatch(riverPath, /state\.camera/);
  assert.doesNotMatch(coastlinePath, /state\.camera/);
  assert.match(riverPath, /const \{ startX, endX \} = bounds/);
  assert.match(coastlinePath, /boundedStartY/);
  assert.match(neighborRoads, /route\.moveTo\(x, metrics\.top\)/);
  assert.match(neighborRoads, /route\.moveTo\(metrics\.left, y\)/);
  assert.doesNotMatch(neighborRoads, /route\.moveTo\(x, visibleTop\)/);
  assert.doesNotMatch(neighborRoads, /route\.moveTo\(visibleLeft, y\)/);
});
