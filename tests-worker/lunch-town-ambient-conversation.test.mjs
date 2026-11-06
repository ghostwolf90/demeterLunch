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
    now: 1_000,
    WIDTH: 960,
    HEIGHT: 640,
    reducedMotion: false,
    refs: { dialog: { open: false } },
    state: {
      townEvent: null,
      dialogueNpc: null,
      activeDistrict: "西屯區",
      player: { x: 100, y: 100, isMoving: false },
      npcs: [],
      ambientConversation: null,
      conversationMemory: [],
      nextConversationAt: 0,
    },
    performance: { now: () => context.now },
    districtAtPoint: npc => npc.district,
    relationshipBetween: () => "neighbors",
    buildConversationContext: () => ({ topicId: "neighborhood", relationship: "neighbors" }),
    conversationTurns: (first, second) => [
      { speaker: first, text: "早安，我想和你聊聊今天街上的變化。" },
      { speaker: second, text: "好啊，我也剛好有一些事情想慢慢告訴你。" },
    ],
    hashText: () => 7,
  };
  vm.createContext(context);
  const constants = [
    "CONVERSATION_MEMORY_LIMIT", "CONVERSATION_MEMORY_WINDOW_MS",
    "AMBIENT_CONVERSATION_RETRY_MS", "AMBIENT_CONVERSATION_MIN_GAP_MS",
    "AMBIENT_PAIR_COOLDOWN_MS", "AMBIENT_TURN_MIN_MS", "AMBIENT_TURN_MAX_MS",
    "AMBIENT_PLAYER_GRACE_MS", "AMBIENT_PLAYER_DISMISS_DISTANCE",
  ].map(declaration).join("\n");
  const functions = [
    "ambientConversationTurnDuration", "ambientPairRecentlyTalked",
    "updateAmbientConversation", "findConversationPair", "startAmbientConversation",
    "endAmbientConversation", "rememberConversation", "pruneConversationMemory",
  ].map(fn).join("\n");
  vm.runInContext(`${constants}\n${functions}\nObject.assign(globalThis, {
    ambientConversationTurnDuration, ambientPairRecentlyTalked, updateAmbientConversation,
    findConversationPair, startAmbientConversation, endAmbientConversation,
  });`, context);
  return context;
}

function resident(name, x, y) {
  return {
    name,
    role: "community-resident",
    district: "西屯區",
    x,
    y,
    insideVenueId: "",
    ridingBike: false,
    isCollapsed: false,
    activity: "walking",
  };
}

test("each ambient line gets six to eleven seconds based on reading length", () => {
  const context = load();
  const short = context.ambientConversationTurnDuration({ text: "你好。" });
  const medium = context.ambientConversationTurnDuration({ text: "今天市場旁邊多了幾張椅子，我們可以慢慢走過去看看。" });
  const long = context.ambientConversationTurnDuration({ text: "這是一段很長的對話內容，讓玩家有足夠時間仔細閱讀，也不會因為文字較多就突然切到下一句。".repeat(3) });
  assert.equal(short, 6_000);
  assert.ok(medium > short);
  assert.equal(long, 11_000);
});

test("walking no longer closes a visible conversation on the next frame", () => {
  const context = load();
  const first = resident("甲", 120, 120);
  const second = resident("乙", 180, 120);
  context.state.npcs = [first, second];
  context.startAmbientConversation(first, second, context.now);
  const conversation = context.state.ambientConversation;
  assert.ok(conversation.nextTurnAt - context.now >= 6_000);
  assert.equal(conversation.playerGraceUntil, context.now + 8_000);

  context.state.player.isMoving = true;
  context.now += 500;
  context.updateAmbientConversation(context.now);
  assert.equal(context.state.ambientConversation, conversation);

  context.state.player.x = 2_000;
  context.state.player.y = 2_000;
  context.now = conversation.playerGraceUntil + 1;
  context.updateAmbientConversation(context.now);
  assert.equal(context.state.ambientConversation, null);
});

test("nearby pairs may talk again after a short pair cooldown", () => {
  const context = load();
  const first = resident("甲", 120, 120);
  const second = resident("乙", 340, 120);
  context.state.npcs = [first, second];
  const pairKey = "乙|甲";

  context.state.conversationMemory = [{ pairKey, topicId: "weather", endedAt: 1_000 }];
  context.now = 45_999;
  assert.equal(context.findConversationPair(), null);

  context.now = 46_001;
  const pair = context.findConversationPair();
  assert.equal(pair[0], first);
  assert.equal(pair[1], second);
});
