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

function declaration(name) {
  const start = source.indexOf(`const ${name} = `);
  assert.notEqual(start, -1, `${name} exists`);
  return source.slice(start, source.indexOf(";\n", start) + 1);
}

function load() {
  const context = {
    now: 10_000,
    reducedMotion: false,
    followUps: [],
    performance: { now: () => context.now },
    state: {
      environment: { dateKey: "2026-11-07", clock: { hour: 15 } },
      dialogueNpc: null,
      venues: [],
    },
    hashText(value) {
      return [...String(value)].reduce((hash, character) => (
        (hash * 31 + character.codePointAt(0)) >>> 0
      ), 2166136261);
    },
    districtAtPoint: npc => npc.district,
    beginNpcLifeFollowUp(npc, topicId, now) {
      context.followUps.push({ npc, topicId, now });
      return true;
    },
  };
  vm.createContext(context);
  const constants = [
    "NPC_LIFE_MEMORY_LIMIT", "NPC_LIFE_MEMORY_WINDOW_MS", "NPC_LIFE_UPDATE_SECONDS",
  ].map(declaration).join("\n");
  const functions = [
    "clampNpcNeed", "createNpcLifeState", "seedNpcLifeBond", "strengthenNpcLifeBond",
    "rememberNpcLifeEvent", "latestSharedNpcLifeMemory", "npcLifeTopicSummary",
    "npcLifeMood", "npcLifeGoalLabel", "updateNpcLifeState", "applyNpcConversationOutcome",
  ].map(fn).join("\n");
  vm.runInContext(`${constants}\n${functions}\nObject.assign(globalThis, {
    createNpcLifeState, seedNpcLifeBond, strengthenNpcLifeBond, rememberNpcLifeEvent,
    latestSharedNpcLifeMemory, updateNpcLifeState, applyNpcConversationOutcome,
  });`, context);
  return context;
}

function resident(context, name) {
  return {
    name,
    role: "community-resident",
    district: "西屯區",
    residenceVenueId: "home",
    insideVenueId: "",
    activity: "waiting",
    isMoving: false,
    isSocializing: false,
    life: context.createNpcLifeState({ name, role: "community-resident", district: "西屯區" }, 1),
  };
}

test("living state turns needs into an observable mood and goal", () => {
  const context = load();
  const npc = resident(context, "小芳");
  npc.life.needs.energy = 12;
  context.updateNpcLifeState(npc, 1.2, context.now);
  assert.equal(npc.mood, "疲倦");
  assert.equal(npc.life.goalLabel, "找個地方坐下休息");
  for (const value of Object.values(npc.life.needs)) {
    assert.ok(value >= 0 && value <= 100);
  }
});

test("life memories stay bounded and familiar people build a stronger bond", () => {
  const context = load();
  const first = resident(context, "小芳");
  const second = resident(context, "阿明");
  context.seedNpcLifeBond(first, second, "neighbors");
  assert.equal(first.life.bonds.get(second.name), 2);
  context.strengthenNpcLifeBond(first, second, 2);
  assert.equal(first.life.bonds.get(second.name), 4);
  for (let index = 0; index < 12; index += 1) {
    context.rememberNpcLifeEvent(first, "event", `topic-${index}`, `memory-${index}`, second.name, context.now + index);
  }
  assert.equal(first.life.memory.length, 8);
});

test("a completed conversation changes both residents and schedules a consequence", () => {
  const context = load();
  const first = resident(context, "小芳");
  const second = resident(context, "阿明");
  first.life.needs.social = 20;
  second.life.needs.social = 25;
  context.applyNpcConversationOutcome(first, second, { topicId: "shopping" }, context.now);
  assert.equal(first.life.needs.social, 42);
  assert.equal(second.life.needs.social, 47);
  assert.equal(first.life.memory.at(-1).withName, second.name);
  assert.equal(second.life.memory.at(-1).withName, first.name);
  assert.equal(context.followUps.length, 1);
  assert.equal(context.followUps[0].topicId, "shopping");
});
