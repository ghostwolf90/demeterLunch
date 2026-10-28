import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../web/product-analytics.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../web/app.js", import.meta.url), "utf8");
const context = { school_id: "193609", menu_date: "2026-10-28", meal_type: "meat", data_source: "official_daily" };

function harness({ navigator = {}, observer = true } = {}) {
  const events = [], handlers = new Map(), observed = new Set();
  let notify;
  const root = {
    location: { origin: "https://haohaofood.cc" }, navigator,
    gtag: (...args) => events.push(args),
    document: { visibilityState: "visible", addEventListener: (type, fn) => handlers.set(type, fn) },
    fetch: async () => ({ ok: true, json: async () => ({ isNewAccount: false }) }),
  };
  if (observer) root.IntersectionObserver = class {
    constructor(callback) { notify = callback; }
    observe(element) { observed.add(element); }
    unobserve(element) { observed.delete(element); }
  };
  vm.runInNewContext(source, { window: root, URL });
  const element = { hidden: false, getClientRects: () => [1] };
  const visible = (target = element, ratio = 0.5) => notify([{ target, isIntersecting: ratio > 0, intersectionRatio: ratio }]);
  return { root, api: root.ProductAnalytics, events, element, observed, visible, handlers };
}

test("views wait for a visible card in the foreground and deduplicate redraws and repeat visits", () => {
  const h = harness();
  h.api.watch(h.element, "lunch_viewed", context);
  assert.equal(h.events.length, 0);
  h.visible(h.element, 0.1);
  assert.equal(h.events.length, 0);
  h.root.document.visibilityState = "hidden";
  h.visible();
  assert.equal(h.events.length, 0);
  h.root.document.visibilityState = "visible";
  h.handlers.get("visibilitychange")();
  assert.equal(h.events[0][1], "lunch_viewed");
  h.api.watch(h.element, "lunch_viewed", context); h.visible();
  assert.equal(h.events.length, 1);
  h.api.watch(h.element, "lunch_viewed", { ...context, menu_date: "2026-10-27" }); h.visible();
  h.api.watch(h.element, "lunch_viewed", { ...context, meal_type: "vegetarian" }); h.visible();
  assert.equal(h.events.length, 3);
  h.api.watch(h.element, "lunch_viewed", context); h.visible();
  assert.equal(h.events.length, 3);
});

test("dinner impressions are independent; cleared, hidden and unsupported cards do not count", () => {
  const h = harness();
  h.api.watch(h.element, "dinner_idea_viewed", context);
  h.element.hidden = true; h.visible(); assert.equal(h.events.length, 0);
  h.element.hidden = false; h.visible(); assert.equal(h.events[0][1], "dinner_idea_viewed");
  h.api.watch(h.element, "lunch_viewed", context);
  h.api.watch(h.element, "lunch_viewed", null); h.visible(); assert.equal(h.events.length, 1);
  const noObserver = harness({ observer: false });
  noObserver.api.watch(noObserver.element, "lunch_viewed", context); assert.equal(noObserver.events.length, 0);
});

test("analytics failure cannot break actions and personal parameters are excluded", () => {
  const h = harness();
  h.api.event("school_selected", { ...context, email: "private@example.test", child_id: "secret", nickname: "private", school_id: "193609" });
  assert.equal(JSON.stringify(h.events).includes("private"), false);
  assert.equal(h.api.event("unsupported", context), false);
  h.root.gtag = () => { throw new Error("blocked"); };
  assert.equal(h.api.event("school_selected", context), false);
  delete h.root.gtag;
  assert.equal(h.api.event("school_selected", context), false);
});

test("sharing counts only successful native shares or clipboard writes and preserves menu context", async () => {
  let shared, copied, complete;
  const h = harness({ navigator: { share: data => { shared = data; return new Promise(resolve => { complete = resolve; }); } } });
  const action = h.api.shareMenu(context);
  assert.equal(h.events.length, 0);
  const url = new URL(shared.url);
  assert.equal(url.searchParams.get("school"), "193609");
  assert.equal(url.searchParams.get("date"), "2026-10-28");
  assert.equal(url.searchParams.get("meal"), "meat");
  complete(); await action;
  assert.equal(h.events[0][2].method, "native_share");
  h.root.navigator.share = async () => { throw Object.assign(new Error("cancelled"), { name: "AbortError" }); };
  await assert.rejects(h.api.shareMenu(context)); assert.equal(h.events.length, 1);
  delete h.root.navigator.share;
  h.root.navigator.clipboard = { writeText: async value => { copied = value; } };
  await h.api.shareMenu(context);
  assert.equal(copied, shared.url); assert.equal(h.events[1][2].method, "copy_link");
  h.root.navigator.clipboard.writeText = async () => { throw new Error("denied"); };
  await assert.rejects(h.api.shareMenu(context)); assert.equal(h.events.length, 2);
});

test("email sign-up requires the server new-account flag; LINE consumes a server receipt", async () => {
  const h = harness();
  for (const payload of [{}, { isNewAccount: false }, { isNewAccount: "true" }]) h.api.emailSignup(payload);
  assert.equal(h.events.length, 0);
  h.api.emailSignup({ isNewAccount: true }); assert.equal(h.events[0][2].method, "email");
  let count = 0;
  h.root.fetch = async () => ({ ok: true, json: async () => ({ isNewAccount: ++count === 1 }) });
  await Promise.all([h.api.lineSignup(), h.api.lineSignup()]);
  await h.api.lineSignup();
  assert.equal(h.events.filter(e => e[2].method === "line").length, 1);
  h.root.fetch = async () => { throw new Error("offline"); };
  await h.api.lineSignup();
  assert.equal(h.events.length, 2);
});

test("only real matching-school meal content is eligible, with the actual displayed date", () => {
  const state = { schoolId: 193609, mealType: "meat" };
  const ctx = vm.createContext({ state, officialDishes: record => record.dishes || [], OfficialDiet: { profile: () => ({ hasVariants: false }) } });
  vm.runInContext(app.slice(app.indexOf("function displayedMenuContext("), app.indexOf("function watchProductContent(")), ctx);
  const meal = { school: { fatraceSchoolId: 193609 }, viewMode: "officialDaily", selectedDate: "2026-10-28", record: { status: "available", dishes: [1] } };
  assert.equal(ctx.displayedMenuContext(meal).menu_date, "2026-10-28");
  for (const invalid of [null, { ...meal, isSample: true }, { ...meal, school: { fatraceSchoolId: 193608 } }, { ...meal, record: null }, { ...meal, record: { status: "no_meal", dishes: [1] } }, { ...meal, record: { status: "available", dishes: [] } }]) {
    assert.equal(ctx.displayedMenuContext(invalid), null);
  }
  const fallback = { school: meal.school, selected: { date: "2026-10-23", meal: { mainDish: "公開午餐" } }, isFallback: true, dataPriority: "weekly_planned" };
  assert.equal(ctx.displayedMenuContext(fallback).menu_date, "2026-10-23");
  assert.equal(ctx.displayedMenuContext(fallback).data_source, "weekly_planned");
});

test("school selection counts only explicit valid changes, not restoration or repeated choice", async () => {
  const events = [];
  const state = { schoolId: 1, schoolDirectory: [{ fatraceSchoolId: 1 }, { fatraceSchoolId: 2 }], dashboard: {}, account: {} };
  const ctx = vm.createContext({ state, refs: {}, window: { ProductAnalytics: { event: (...args) => events.push(args) } },
    renderNoSchoolSelected: async () => {}, loadDashboard: async () => {}, localIsoDate: () => "2026-10-28" });
  vm.runInContext(app.slice(app.indexOf("async function selectSchool("), app.indexOf('document.getElementById("shareMenu")?.addEventListener')), ctx);
  await ctx.selectSchool(2); assert.equal(events.length, 0);
  await ctx.selectSchool(2, { trackSelection: true }); assert.equal(events.length, 0);
  await ctx.selectSchool(999, { trackSelection: true }); assert.equal(events.length, 0);
  await ctx.selectSchool(1, { trackSelection: true }); assert.equal(events.length, 1);
  assert.equal(events[0][0], "school_selected"); assert.equal(events[0][1].school_id, "1");
});
