import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../web/lunch-town/app.js", import.meta.url), "utf8");
const themes = JSON.parse(readFileSync(new URL("../web/lunch-town/neighbor-county-themes.json", import.meta.url), "utf8"));

function fn(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const end = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, end < 0 ? undefined : end);
}

function load(exclusions = []) {
  const context = {
    hashText(value) {
      return [...String(value)].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) | 0, 0);
    },
    neighborDistrictDecorationExclusionRects() { return exclusions; },
    pointInExpandedRect(point, rect, padding) {
      return point.x >= rect.x - padding && point.x <= rect.x + rect.w + padding
        && point.y >= rect.y - padding && point.y <= rect.y + rect.h + padding;
    },
  };
  vm.createContext(context);
  vm.runInContext([
    fn("roadsideOffsets"),
    fn("neighborStreetDecorationsForTheme"),
    "Object.assign(globalThis, { roadsideOffsets, neighborStreetDecorationsForTheme });",
  ].join("\n"), context);
  return context;
}

function configuredThemes() {
  return themes.counties.flatMap((county) => county.districts.map((district, index) => ({
    ...district,
    county: { id: county.id, name: county.name },
    zone: {
      x: 100 + district.grid[0] * 760,
      y: 100 + district.grid[1] * 252,
      w: 720,
      h: 212,
    },
    testIndex: index,
  })));
}

test("all 44 Miaoli and Changhua districts receive stable roadside trees and lamps", () => {
  const context = load();
  const districts = configuredThemes();
  assert.equal(districts.length, 44);
  assert.equal(districts.filter((theme) => theme.county.id === "miaoli").length, 18);
  assert.equal(districts.filter((theme) => theme.county.id === "changhua").length, 26);

  districts.forEach((theme) => {
    const first = context.neighborStreetDecorationsForTheme(theme);
    const second = context.neighborStreetDecorationsForTheme(theme);
    assert.deepEqual(second, first, `${theme.name} furniture is deterministic`);
    assert.ok(first.trees.length >= 8, `${theme.name} has roadside trees`);
    assert.ok(first.lamps.length >= 8, `${theme.name} has street lamps`);
    [...first.trees, ...first.lamps].forEach((fixture) => {
      assert.ok(fixture.x >= theme.zone.x && fixture.x <= theme.zone.x + theme.zone.w, `${theme.name} fixture x stays in its block`);
      assert.ok(fixture.y >= theme.zone.y && fixture.y <= theme.zone.y + theme.zone.h, `${theme.name} fixture y stays in its block`);
    });
  });
});

test("neighbor road furniture respects building and landmark exclusion rectangles", () => {
  const theme = configuredThemes()[0];
  const baseline = load().neighborStreetDecorationsForTheme(theme);
  const blockedFixture = baseline.lamps[0];
  const exclusion = { x: blockedFixture.x - 2, y: blockedFixture.y - 2, w: 4, h: 4 };
  const filtered = load([exclusion]).neighborStreetDecorationsForTheme(theme);

  assert.ok(filtered.lamps.length < baseline.lamps.length);
  assert.ok(filtered.trees.length <= baseline.trees.length);
  [...filtered.trees, ...filtered.lamps].forEach((fixture) => {
    assert.ok(
      fixture.x < exclusion.x - 12 || fixture.x > exclusion.x + exclusion.w + 12
        || fixture.y < exclusion.y - 12 || fixture.y > exclusion.y + exclusion.h + 12,
      "fixtures stay outside the padded exclusion",
    );
  });
});

test("neighbor lamps participate in daytime drawing and nighttime glow collection", () => {
  const streetDetails = fn("drawStreetDetails");
  const visibleLamps = fn("visibleLampPositions");
  assert.match(streetDetails, /neighborStreetDecorationsForTheme\(theme\)/);
  assert.match(streetDetails, /drawTree\(tree\.x, tree\.y, now, tree\.phase, tree\.scale\)/);
  assert.match(streetDetails, /drawLamp\(lamp\.x, lamp\.y, environment\)/);
  assert.match(visibleLamps, /neighborStreetDecorationsForTheme\(theme\)\.lamps/);
});
