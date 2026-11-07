import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function transpile(path) {
  return ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
}

function loadModule(code, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require(name) {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
    Request,
    Response,
    Headers,
    URL,
    console,
    Date,
    Map,
    Set,
    Promise,
  });
  return module.exports;
}

const achievements = loadModule(transpile("../lib/town-achievements.ts"));

function fakeDatabase() {
  const events = [];
  const unlocks = [];
  return {
    events,
    unlocks,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async all() {
              if (sql.includes("FROM town_achievement_events")) {
                const [owner, city] = values;
                return { results: events.filter((item) => item.auth_user_id === owner && item.city === city) };
              }
              if (sql.includes("FROM town_achievement_unlocks")) {
                const [owner] = values;
                return { results: unlocks.filter((item) => item.auth_user_id === owner) };
              }
              throw new Error(`Unexpected query: ${sql}`);
            },
            async run() {
              if (sql.includes("INSERT OR IGNORE INTO town_achievement_events")) {
                const [auth_user_id, event_key, city, event_type, subject_id, occurred_at] = values;
                if (events.some((item) => item.auth_user_id === auth_user_id && item.event_key === event_key)) {
                  return { meta: { changes: 0 } };
                }
                events.push({ auth_user_id, event_key, city, event_type, subject_id, occurred_at });
                return { meta: { changes: 1 } };
              }
              if (sql.includes("INSERT OR IGNORE INTO town_achievement_unlocks")) {
                const [auth_user_id, achievement_id, unlocked_at] = values;
                if (unlocks.some((item) => item.auth_user_id === auth_user_id && item.achievement_id === achievement_id)) {
                  return { meta: { changes: 0 } };
                }
                unlocks.push({ auth_user_id, achievement_id, unlocked_at });
                return { meta: { changes: 1 } };
              }
              throw new Error(`Unexpected mutation: ${sql}`);
            },
          };
        },
      };
    },
  };
}

function routeFixture() {
  const db = fakeDatabase();
  const auth = {
    accountDatabase: () => db,
    getAccountUser: async (request) => {
      const id = request.headers.get("x-test-user");
      return id ? { id, displayName: id === "parent-1" ? "朵朵家" : "另一個家", email: null } : null;
    },
    isSameOriginMutation: (request) => {
      const origin = request.headers.get("origin");
      return !origin || origin === new URL(request.url).origin;
    },
    forbiddenMutation: () => Response.json({ error: "forbidden" }, { status: 403 }),
    privateJson: (body, init = {}) => {
      const headers = new Headers(init.headers);
      headers.set("cache-control", "private, no-store");
      headers.set("vary", "Cookie");
      return Response.json(body, { ...init, headers });
    },
  };
  const route = loadModule(transpile("../app/api/account/town-achievements/route.ts"), {
    "@/lib/account-auth": auth,
    "@/lib/town-achievements": achievements,
  });
  return { db, route };
}

function request(method = "GET", body, user = "parent-1", origin = "https://haohaofood.cc") {
  const headers = new Headers({ origin });
  if (user) headers.set("x-test-user", user);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request("https://haohaofood.cc/api/account/town-achievements", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test("signed-out visitors can preview all Taichung achievements without saved progress", async () => {
  const { route } = routeFixture();
  const response = await route.GET(request("GET", undefined, ""));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(payload.authenticated, false);
  assert.equal(payload.city.id, "taichung");
  assert.equal(payload.achievements.length, 20);
  assert.equal(payload.summary.unlocked, 0);
  assert.equal(payload.futureCities.available, false);
});

test("civic achievements count only the mayor and the two requested candidates", () => {
  const snapshot = achievements.townAchievementSnapshot([
    { event_type: "npc_talk", subject_id: "西屯區:盧秀燕", occurred_at: "2026-11-03T01:00:00Z" },
    { event_type: "npc_talk", subject_id: "大里區:何欣純", occurred_at: "2026-11-03T01:01:00Z" },
    { event_type: "npc_talk", subject_id: "豐原區:江啟臣", occurred_at: "2026-11-03T01:02:00Z" },
    { event_type: "npc_talk", subject_id: "西區:一般居民", occurred_at: "2026-11-03T01:03:00Z" },
  ], []);
  assert.equal(snapshot.achievements.find((item) => item.id === "taichung:mayor-meeting").progress, 1);
  assert.equal(snapshot.achievements.find((item) => item.id === "taichung:candidate-ho").progress, 1);
  assert.equal(snapshot.achievements.find((item) => item.id === "taichung:candidate-chiang").progress, 1);
  assert.equal(snapshot.achievements.find((item) => item.id === "taichung:civic-collection").progress, 3);
  assert.equal(snapshot.achievements.find((item) => item.id === "taichung:civic-collection").reached, true);
});

test("signed-in GET retroactively unlocks civic achievements from existing conversations", async () => {
  const { db, route } = routeFixture();
  for (const [index, subject_id] of ["中區:盧秀燕", "大里區:何欣純", "豐原區:江啟臣"].entries()) {
    db.events.push({
      auth_user_id: "parent-1",
      event_key: `taichung:npc_talk:${subject_id}`,
      city: "taichung",
      event_type: "npc_talk",
      subject_id,
      occurred_at: `2026-11-03T01:0${index}:00Z`,
    });
  }
  const payload = await (await route.GET(request())).json();
  assert.equal(payload.achievements.find((item) => item.id === "taichung:civic-collection").unlocked, true);
  assert.equal(db.unlocks.filter((item) => item.achievement_id.startsWith("taichung:")).length, 4);
});

test("achievement writes require an account, same-origin request, and valid bounded events", async () => {
  const { route } = routeFixture();
  let response = await route.POST(request("POST", { city: "taichung", eventType: "medical_rescue", subjectId: "event-1" }, ""));
  assert.equal(response.status, 401);
  response = await route.POST(request("POST", { city: "taichung", eventType: "medical_rescue", subjectId: "event-1" }, "parent-1", "https://evil.example"));
  assert.equal(response.status, 403);
  response = await route.POST(request("POST", { city: "taipei", eventType: "medical_rescue", subjectId: "event-1" }));
  assert.equal(response.status, 400);
  response = await route.POST(request("POST", { city: "taichung", eventType: "district_visit", subjectId: "不存在區" }));
  assert.equal(response.status, 400);
});

test("three distinct medical assists unlock the account-bound lifesaver achievement once", async () => {
  const { db, route } = routeFixture();
  for (const id of ["medical-a", "medical-a", "medical-b", "medical-c"]) {
    const response = await route.POST(request("POST", { city: "taichung", eventType: "medical_rescue", subjectId: id }));
    assert.equal(response.status, 200);
  }
  assert.equal(db.events.filter((item) => item.event_type === "medical_rescue").length, 3);
  assert.equal(db.unlocks.filter((item) => item.achievement_id === "taichung:medical-three").length, 1);
  const payload = await (await route.GET(request())).json();
  const lifesaver = payload.achievements.find((item) => item.id === "taichung:medical-three");
  assert.equal(lifesaver.progress, 3);
  assert.equal(lifesaver.unlocked, true);
  assert.ok(lifesaver.unlockedAt);
});

test("six distinct flower festival stamps unlock once and duplicate stamps stay idempotent", async () => {
  const { db, route } = routeFixture();
  const stampIds = ["welcome", "castle", "pastel-field", "sunset-field", "market", "overlook"];
  for (const id of [...stampIds, "welcome"]) {
    const response = await route.POST(request("POST", {
      city: "taichung",
      eventType: "flower_festival_stamp",
      subjectId: `xinshe-flower-season:${id}`,
    }));
    assert.equal(response.status, 200);
  }
  assert.equal(db.events.filter((item) => item.event_type === "flower_festival_stamp").length, 6);
  assert.equal(db.unlocks.filter((item) => item.achievement_id === "taichung:flower-festival-six").length, 1);
  const payload = await (await route.GET(request())).json();
  const flowerAchievement = payload.achievements.find((item) => item.id === "taichung:flower-festival-six");
  assert.equal(flowerAchievement.progress, 6);
  assert.equal(flowerAchievement.unlocked, true);
});

test("progress is isolated per family account and distinct calendar day", async () => {
  const { route } = routeFixture();
  for (const date of ["2026-11-01", "2026-11-02", "2026-11-03"]) {
    await route.POST(request("POST", { city: "taichung", eventType: "town_visit", subjectId: date }, "parent-1"));
  }
  const first = await (await route.GET(request("GET", undefined, "parent-1"))).json();
  const second = await (await route.GET(request("GET", undefined, "parent-2"))).json();
  assert.equal(first.achievements.find((item) => item.id === "taichung:three-days").unlocked, true);
  assert.equal(second.summary.unlocked, 0);
  assert.equal(second.achievements.find((item) => item.id === "taichung:three-days").progress, 0);
});

test("generated migration keeps achievement data owned by the family account", () => {
  const migration = readFileSync(new URL("../drizzle/0017_broken_hercules.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE `town_achievement_events`/);
  assert.match(migration, /CREATE TABLE `town_achievement_unlocks`/);
  assert.match(migration, /REFERENCES `parent_accounts`\(`auth_user_id`\) ON UPDATE no action ON DELETE cascade/);
  assert.match(migration, /PRIMARY KEY\(`auth_user_id`, `event_key`\)/);
  assert.match(migration, /PRIMARY KEY\(`auth_user_id`, `achievement_id`\)/);
});
