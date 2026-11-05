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
    Intl,
    Map,
    Set,
    Promise,
  });
  return module.exports;
}

const quests = loadModule(transpile("../lib/town-daily-quests.ts"));
const achievements = loadModule(transpile("../lib/town-achievements.ts"));

function fakeDatabase() {
  const events = [];
  const ledger = [];
  const overrides = [];
  return {
    events,
    ledger,
    overrides,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async all() {
              if (sql.includes("FROM town_daily_quest_events")) {
                const [owner, taskDate] = values;
                return { results: events.filter((item) => item.auth_user_id === owner && item.task_date === taskDate) };
              }
              if (sql.includes("FROM town_coin_ledger")) {
                const [owner, prefix] = values;
                const stem = String(prefix).replace(/%$/, "");
                return { results: ledger.filter((item) => item.auth_user_id === owner && item.ledger_key.startsWith(stem)) };
              }
              throw new Error(`Unexpected query: ${sql}`);
            },
            async first() {
              if (sql.includes("COALESCE(SUM(amount)")) {
                const [owner] = values;
                return { balance: ledger.filter((item) => item.auth_user_id === owner).reduce((sum, item) => sum + item.amount, 0) };
              }
              if (sql.includes("FROM town_daily_quest_overrides")) {
                const [owner, taskDate] = values;
                return overrides.find((item) => item.auth_user_id === owner && item.task_date === taskDate) || null;
              }
              throw new Error(`Unexpected first query: ${sql}`);
            },
            async run() {
              if (sql.includes("INSERT OR IGNORE INTO town_daily_quest_events")) {
                const [auth_user_id, event_key, task_date, event_type, subject_id, value, occurred_at] = values;
                if (events.some((item) => item.auth_user_id === auth_user_id && item.event_key === event_key)) return { meta: { changes: 0 } };
                events.push({ auth_user_id, event_key, task_date, event_type, subject_id, value, occurred_at });
                return { meta: { changes: 1 } };
              }
              if (sql.includes("INSERT OR IGNORE INTO town_coin_ledger")) {
                const [auth_user_id, ledger_key, amount, reason, created_at] = values;
                if (ledger.some((item) => item.auth_user_id === auth_user_id && item.ledger_key === ledger_key)) return { meta: { changes: 0 } };
                ledger.push({ auth_user_id, ledger_key, amount, reason, created_at });
                return { meta: { changes: 1 } };
              }
              if (sql.includes("INSERT OR IGNORE INTO town_daily_quest_overrides")) {
                const [auth_user_id, task_date, category, task_id, created_at] = values;
                if (overrides.some((item) => item.auth_user_id === auth_user_id && item.task_date === task_date)) return { meta: { changes: 0 } };
                overrides.push({ auth_user_id, task_date, category, task_id, created_at });
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
      return id ? { id, displayName: "朵朵家", email: null } : null;
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
  const route = loadModule(transpile("../app/api/account/town-daily-quests/route.ts"), {
    "@/lib/account-auth": auth,
    "@/lib/town-daily-quests": quests,
  });
  return { db, route };
}

function request(method = "GET", body, user = "parent-1", origin = "https://haohaofood.cc") {
  const headers = new Headers({ origin });
  if (user) headers.set("x-test-user", user);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request("https://haohaofood.cc/api/account/town-daily-quests", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function sendRequirement(route, task, requirement, sequence) {
  const subjectId = requirement.subjectIds?.[0] || `${requirement.eventType}-subject`;
  let remaining = requirement.target;
  do {
    const value = requirement.mode === "sum" ? Math.min(100, remaining) : 1;
    const response = await route.POST(request("POST", {
      eventType: requirement.eventType,
      subjectId,
      value,
      eventKey: `${task.id}:${requirement.eventType}:${sequence.value++}`,
    }));
    assert.equal(response.status, 200);
    remaining -= value;
  } while (remaining > 0);
}

test("daily task pool has six distinct non-achievement tasks in each category", () => {
  assert.equal(quests.TOWN_DAILY_TASKS.length, 18);
  for (const category of ["life", "food", "explore"]) {
    assert.equal(quests.TOWN_DAILY_TASKS.filter((item) => item.category === category).length, 6);
  }
  const dailyTypes = new Set(quests.TOWN_DAILY_EVENT_TYPES);
  for (const type of achievements.TOWN_ACHIEVEMENT_EVENT_TYPES) assert.equal(dailyTypes.has(type), false);
  assert.deepEqual(
    Array.from(quests.baseTownDailyTasks("2026-11-04"), (item) => item.category),
    ["life", "food", "explore"],
  );
  const nextDay = quests.baseTownDailyTasks("2026-11-05");
  assert.equal(nextDay.some((item, index) => item.id === quests.baseTownDailyTasks("2026-11-04")[index].id), false);
});

test("signed-out visitors preview three tasks without saved coins or rerolls", async () => {
  const { route } = routeFixture();
  const response = await route.GET(request("GET", undefined, ""));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(payload.authenticated, false);
  assert.equal(payload.tasks.length, 3);
  assert.deepEqual(payload.tasks.map((item) => item.rewardCoins), [10, 15, 20]);
  assert.equal(payload.coinBalance, 0);
  assert.equal(payload.rerollAvailable, false);
});

test("daily quest writes require an account, same origin, and bounded events", async () => {
  const { route } = routeFixture();
  const event = { eventType: "venue_visit", subjectId: "player-home", value: 1, eventKey: "venue:home" };
  assert.equal((await route.POST(request("POST", event, ""))).status, 401);
  assert.equal((await route.POST(request("POST", event, "parent-1", "https://evil.example"))).status, 403);
  assert.equal((await route.POST(request("POST", { ...event, value: 101 }))).status, 400);
  assert.equal((await route.POST(request("POST", { ...event, eventType: "town_visit" }))).status, 400);
});

test("completed tasks and all-clear bonus award exactly sixty coins once", async () => {
  const { db, route } = routeFixture();
  const date = quests.taipeiDateKey();
  const tasks = quests.assignedTownDailyTasks(date);
  const sequence = { value: 1 };
  for (const task of tasks) {
    for (const item of task.requirements) await sendRequirement(route, task, item, sequence);
  }
  let payload = await (await route.GET(request())).json();
  assert.equal(payload.summary.completed, 3);
  assert.equal(payload.summary.allComplete, true);
  assert.equal(payload.summary.bonusAwarded, true);
  assert.equal(payload.coinBalance, 60);
  assert.equal(db.ledger.length, 4);

  for (const task of tasks) {
    for (const item of task.requirements) await sendRequirement(route, task, item, sequence);
  }
  payload = await (await route.GET(request())).json();
  assert.equal(payload.coinBalance, 60);
  assert.equal(db.ledger.length, 4);
});

test("one unfinished task can be replaced once with the same category", async () => {
  const { db, route } = routeFixture();
  const before = await (await route.GET(request())).json();
  const selected = before.tasks[1];
  const response = await route.POST(request("POST", { action: "reroll", taskId: selected.id }));
  const after = await response.json();
  assert.equal(response.status, 200);
  assert.equal(after.rerolled, true);
  assert.equal(after.tasks[1].category, selected.category);
  assert.notEqual(after.tasks[1].id, selected.id);
  assert.equal(after.rerollAvailable, false);
  assert.equal(db.overrides.length, 1);
  assert.equal((await route.POST(request("POST", { action: "reroll", taskId: after.tasks[0].id }))).status, 409);
});

test("generated migration keeps quests and coin ledger account-owned", () => {
  const migration = readFileSync(new URL("../drizzle/0018_sharp_punisher.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE `town_daily_quest_events`/);
  assert.match(migration, /CREATE TABLE `town_daily_quest_overrides`/);
  assert.match(migration, /CREATE TABLE `town_coin_ledger`/);
  assert.match(migration, /REFERENCES `parent_accounts`\(`auth_user_id`\) ON UPDATE no action ON DELETE cascade/);
  assert.match(migration, /PRIMARY KEY\(`auth_user_id`, `event_key`\)/);
  assert.match(migration, /PRIMARY KEY\(`auth_user_id`, `ledger_key`\)/);
});
