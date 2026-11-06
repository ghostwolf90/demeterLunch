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
    performance: { now: () => 1_000 },
    SHOWCASE_CITY: "臺中市",
    DISTRICT_ZONES: { "西屯區": { x: 0, y: 0, w: 300, h: 200 } },
    RESIDENTIAL_VENUE_TYPES: new Set(["apartment", "townhouse"]),
    reducedMotion: false,
    state: {
      player: { x: 100, y: 100 },
      npcs: [],
      schools: [],
      neighborSchools: [],
      venues: [],
      neighborDistrictThemes: new Map([
        ["苗栗市", { county: { name: "苗栗縣" } }],
        ["彰化市", { county: { name: "彰化縣" } }],
      ]),
      environment: { clock: { hour: 12 }, isRaining: false },
      townEvent: null,
      dialogueNpc: null,
    },
    districtAtPoint: point => point.district,
    naturalTerrainCollisionDepth: point => point.blocked ? 20 : 0,
    npcSafeNaturalTerrainPoint: point => point.blocked
      ? { x: point.x + 50, y: point.y + 50 }
      : { x: point.x, y: point.y },
    schoolGatePoint: school => ({ x: school.x + 10, y: school.y + 20 }),
    districtZoneForName: district => district === "大里區"
      ? { x: 300, y: 300, w: 200, h: 200 }
      : { x: 600, y: 300, w: 200, h: 200 },
    nearestLocationLabel: npc => npc.locationLabel || npc.district,
    townText: text => text,
  };
  vm.createContext(context);
  const declarations = [
    "SMART_NPC_MEMORY_LIMIT", "SMART_NPC_PROACTIVE_COOLDOWN_MS", "SMART_NPC_NAME_PROFILES",
  ].map(declaration).join("\n");
  const functions = [
    "hashText", "smartNpcProfileFor", "createSmartNpcState", "rememberSmartNpc",
    "smartNpcDistrictInJurisdiction", "smartNpcPerception", "smartNpcPublicStop",
    "smartNpcProposal", "beginSmartNpcPlan", "finishSmartNpcPlan",
    "notifySmartNpcTownEvent", "buildSmartNpcConversation",
  ].map(fn).join("\n");
  vm.runInContext(`${declarations}\n${functions}\nObject.assign(globalThis, {
    SMART_NPC_MEMORY_LIMIT, SMART_NPC_NAME_PROFILES, smartNpcProfileFor, createSmartNpcState,
    rememberSmartNpc, smartNpcDistrictInJurisdiction, smartNpcPerception, smartNpcProposal,
    beginSmartNpcPlan, finishSmartNpcPlan, notifySmartNpcTownEvent, buildSmartNpcConversation,
  });`, context);
  return context;
}

function npc(context, identity) {
  return {
    ...identity,
    x: 100,
    y: 100,
    district: identity.district,
    homeDistrict: identity.district,
    schedule: [{ x: 100, y: 100, district: identity.district, label: "住家" }],
    segment: 0,
    progress: 0.25,
    dwellRemaining: 2,
    insideVenueId: "",
    ridingBike: false,
    activity: "waiting",
    smartAgent: context.createSmartNpcState(identity),
  };
}

test("the pilot selects exactly four named public figures and two county police", () => {
  const context = load();
  const identities = [
    { name: "何欣純", role: "candidate", district: "大里區" },
    { name: "盧秀燕", role: "mayor", district: "西屯區" },
    { name: "鍾東錦", role: "county-magistrate", district: "苗栗市" },
    { name: "王惠美", role: "county-magistrate", district: "彰化市" },
    { name: "苗栗市・警察", role: "police-officer", district: "苗栗市", countyId: "miaoli", countyName: "苗栗縣" },
    { name: "彰化市・警察", role: "police-officer", district: "彰化市", countyId: "changhua", countyName: "彰化縣" },
  ];
  assert.equal(identities.filter(identity => context.smartNpcProfileFor(identity)).length, 6);
  assert.equal(context.smartNpcProfileFor({ name: "一般居民", role: "parent" }), null);
  assert.equal(context.smartNpcProfileFor({ name: "臺中警察", role: "police-officer", countyId: "taichung" }), null);
  for (const identity of identities.slice(0, 4)) {
    assert.equal(context.smartNpcProfileFor(identity).verifiedFactsOnly, true);
  }
});

test("session memory deduplicates and stays bounded to six controlled summaries", () => {
  const context = load();
  const resident = npc(context, { name: "王惠美", role: "county-magistrate", district: "彰化市" });
  context.rememberSmartNpc(resident, "routine", "彰化市", "公共場所需求走訪", 1);
  context.rememberSmartNpc(resident, "routine", "彰化市", "公共場所需求走訪", 2);
  assert.equal(resident.smartAgent.memory.length, 1);
  for (let index = 0; index < 8; index += 1) {
    context.rememberSmartNpc(resident, `event-${index}`, "彰化市", `摘要-${index}`, index + 3);
  }
  assert.equal(resident.smartAgent.memory.length, 6);
  assert.equal(resident.smartAgent.memory[0].summary, "摘要-2");
  assert.equal(resident.smartAgent.memory.at(-1).summary, "摘要-7");
});

test("leaders and police react only to events inside their own jurisdiction", () => {
  const context = load();
  const leader = npc(context, { name: "王惠美", role: "county-magistrate", district: "彰化市" });
  const police = npc(context, {
    name: "彰化市・警察", role: "police-officer", district: "彰化市",
    countyId: "changhua", countyName: "彰化縣",
  });
  const event = { type: "theft", district: "彰化市", title: "遺失物通報", startedAt: 77,
    victim: { x: 700, y: 500, district: "彰化市" } };
  context.state.townEvent = event;
  const leaderPerception = context.smartNpcPerception(leader);
  const policePerception = context.smartNpcPerception(police);
  assert.equal(context.smartNpcProposal(leader, leaderPerception, 1_000).intent, "civic-response");
  assert.equal(context.smartNpcProposal(police, policePerception, 1_000).intent, "public-safety-response");
  const candidate = npc(context, { name: "何欣純", role: "candidate", district: "大里區" });
  assert.equal(context.smartNpcDistrictInJurisdiction(candidate.smartAgent, "彰化市"), false);
});

test("county police rescue nearby NPCs from natural barriers before resuming patrol", () => {
  const context = load();
  const police = npc(context, {
    name: "苗栗市・警察", role: "police-officer", district: "苗栗市",
    countyId: "miaoli", countyName: "苗栗縣",
  });
  const resident = { name: "居民", role: "farmer", district: "苗栗市", x: 120, y: 120, blocked: true };
  context.state.npcs = [police, resident];
  const proposal = context.smartNpcProposal(police, context.smartNpcPerception(police), 1_000);
  assert.equal(proposal.intent, "safety-guidance");
  const routine = police.schedule;
  assert.equal(context.beginSmartNpcPlan(police, proposal, 1_000), true);
  assert.equal(police.schedule.length, 3);
  assert.equal(resident.x, 170);
  assert.match(resident.currentReason, /安全步道/);
  context.finishSmartNpcPlan(police);
  assert.equal(police.schedule, routine);
  assert.equal(police.smartAgent.plan, null);
});

test("candidate dialogue uses public-source safeguards and creates a local follow-up", () => {
  const context = load();
  const candidate = npc(context, { name: "何欣純", role: "candidate", district: "大里區" });
  context.state.schools.push({ name: "大里國小", district: "大里區", x: 350, y: 350 });
  const first = context.buildSmartNpcConversation(candidate);
  assert.ok(first.lines.some(line => line.includes("不代表本人引言、背書或政見")));
  assert.equal(candidate.smartAgent.pendingFollowUp, true);
  const second = context.buildSmartNpcConversation(candidate);
  assert.ok(second.lines.some(line => line.includes("我記得先前")));
  const proposal = context.smartNpcProposal(candidate, { hour: 12, event: null, unsafeResident: null }, 1_000);
  assert.equal(proposal.intent, "local-follow-up");
  assert.equal(proposal.target.district, "大里區");
  assert.match(proposal.target.reason, /大里國小/);
});
