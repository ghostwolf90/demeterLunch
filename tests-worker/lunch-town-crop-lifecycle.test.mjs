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

function loadLifecycle() {
  const state = { cropPlots: new Map(), cropPlotsByDistrict: new Map() };
  const context = {
    state,
    performance: { now: () => 1_000 },
    reducedMotion: false,
    SHOWCASE_CITY: "臺中市",
    CROP_GROWTH_DURATION_MS: {
      rice: 80_000,
      wheat: 75_000,
      vegetable: 60_000,
      flower: 70_000,
      grape: 90_000,
      fruit: 100_000,
      sugarcane: 90_000,
    },
    CROP_FALLOW_DURATION_MS: 12_000,
    CROP_HARVEST_INTERVAL_MS: 1_800,
    CROP_HARVEST_REACH: 48,
    CROP_HARVEST_ROLES: new Set([
      "farmer", "fruit-farmer", "flower-grower", "rice-farmer", "vegetable-farmer", "grape-grower",
    ]),
    hashText(value) {
      return [...String(value)].reduce((hash, character) => (hash * 31 + character.codePointAt(0)) >>> 0, 2166136261);
    },
    activityReason(activity, location, fallback) {
      return activity === "harvesting" ? `在${location}採收成熟作物，採收後田區暫時留空` : fallback;
    },
  };
  vm.createContext(context);
  vm.runInContext([
    fn("cropDistrictKey"),
    fn("cropGrowthDuration"),
    fn("registerCropPlot"),
    fn("cropLifecycleAt"),
    fn("cropVisibleGrowth"),
    fn("cropPlotDistanceToPoint"),
    fn("npcCropDistrictKey"),
    fn("updateNpcCropHarvest"),
    "Object.assign(globalThis, { registerCropPlot, cropLifecycleAt, cropVisibleGrowth, updateNpcCropHarvest });",
  ].join("\n"), context);
  return context;
}

test("a future region receives the same persistent crop lifecycle", () => {
  const context = loadLifecycle();
  const startedAt = 1_000;
  const plot = context.registerCropPlot({
    id: "future:yunlin:douliu:plot-1",
    city: "雲林縣",
    district: "斗六市",
    label: "斗六示範農田",
    cropType: "vegetable",
    initialGrowth: 0,
    x: 100,
    y: 200,
    w: 80,
    h: 60,
  }, startedAt);

  assert.equal(context.cropLifecycleAt(plot, startedAt).phase, "sprouting");
  assert.equal(context.cropLifecycleAt(plot, startedAt + 30_000).growth, 0.5);
  assert.equal(context.cropLifecycleAt(plot, startedAt + 60_000).phase, "mature");
  assert.equal(context.cropLifecycleAt(plot, startedAt + 600_000).phase, "mature", "mature crops never disappear on a timer");
  assert.equal(plot.harvestCount, 0);
});

test("only an eligible farmer physically at a mature plot can harvest it", () => {
  const context = loadLifecycle();
  const plot = context.registerCropPlot({
    id: "future:yunlin:douliu:plot-2",
    city: "雲林縣",
    district: "斗六市",
    label: "斗六示範農田",
    cropType: "rice",
    initialGrowth: 0,
    x: 100,
    y: 200,
    w: 80,
    h: 60,
  }, 1_000);
  const matureAt = 81_000;
  const visitor = { role: "agricultural-technician", city: "雲林縣", district: "斗六市", x: 120, y: 220 };
  const farFarmer = { role: "rice-farmer", city: "雲林縣", district: "斗六市", x: 400, y: 500 };
  const farmer = { role: "rice-farmer", name: "未來稻農", city: "雲林縣", district: "斗六市", x: 120, y: 220 };

  assert.equal(context.updateNpcCropHarvest(visitor, matureAt), false);
  assert.equal(context.updateNpcCropHarvest(farFarmer, matureAt), false);
  assert.equal(context.updateNpcCropHarvest(farmer, matureAt), true);
  assert.equal(plot.harvestCount, 1);
  assert.equal(plot.harvestedBy, "未來稻農");
  assert.equal(context.cropLifecycleAt(plot, matureAt).phase, "fallow", "the plants disappear only after harvest");
  assert.match(farmer.currentReason, /採收成熟作物/);
  assert.ok(context.cropLifecycleAt(plot, matureAt + 12_000 + 40_000).growth > 0, "the harvested plot grows again after its fallow period");
  assert.equal(context.cropLifecycleAt(plot, matureAt + 12_000 + 80_000).phase, "mature");
});

test("crop registry and rendering are generic and wired into the town loop", () => {
  const lifecycleSource = [
    fn("registerCropPlot"),
    fn("cropLifecycleAt"),
    fn("createTownCropPlots"),
    fn("updateNpcCropHarvest"),
  ].join("\n");
  assert.doesNotMatch(lifecycleSource, /miaoli|changhua|苗栗|彰化/i);
  assert.match(fn("createTownCropPlots"), /venue\.cropType/);
  assert.match(fn("createTownCropPlots"), /CROP_TYPE_BY_DISTRICT_FEATURE\[theme\.feature\]/);
  assert.match(fn("drawDistrictFeature"), /districtFeatureCropPlotId\(theme\)/);
  assert.match(fn("drawNeighborFarmland"), /cropLifecycleForPlotId/);
  assert.match(fn("drawNeighborWorkZone"), /cropLifecycleForPlotId/);
  assert.match(fn("updateNpcs"), /updateNpcCropHarvest\(npc, performance\.now\(\)\)/);
  assert.match(source, /createTownCropPlots\(performance\.now\(\)\)/);
});
