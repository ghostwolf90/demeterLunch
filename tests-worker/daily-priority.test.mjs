import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const weekly = { selected: { date: '2026-10-22' }, requestedDate: '2026-10-22', mealType: 'meat', week: [{ date: '2026-10-23' }] };
function setup() {
  let calls = 0, now = 1000;
  const data = {};
  const record = { mealDate: '2026-10-22', status: 'available', meals: [{ dishes: [{ name: '實際午餐' }] }] };
  const snapshot = { school: { fatraceSchoolId: 193609 }, records: {}, selectedDate: '2026-10-22', viewMode: 'officialDaily' };
  const ctx = vm.createContext({ DEFAULT_SCHOOL_ID: 193609, state: { schoolDashboardCache: new Map() }, Date: { now: () => now }, encodeURIComponent, console,
    publicSiteData: async () => data, dashboardFromStatic: (_, date, mealType) => ({ ...weekly, requestedDate: date, mealType, selected: { date } }),
    officialDashboardFromStatic: () => snapshot, isAbortError: e => e.name === 'AbortError',
    fetch: async () => { calls++; return { ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ ...snapshot, records: { '2026-10-22': record } }) }; },
  });
  vm.runInContext(source.slice(source.indexOf('function prioritizeDailyDashboard('), source.indexOf('async function fetchDashboard(')), ctx);
  return { ctx, snapshot, record, calls: () => calls, advance: () => { now += 60001; } };
}
test('unpublished, another date or another school never replaces the weekly plan', () => {
  const { ctx, snapshot, record } = setup();
  for (const daily of [snapshot, { ...snapshot, records: { '2026-10-22': { ...record, status: 'not_published' } } }, { ...snapshot, records: { '2026-10-22': { ...record, mealDate: '2026-10-21' } } }, { ...snapshot, school: { fatraceSchoolId: 123 }, records: { '2026-10-22': record } }]) {
    const result = ctx.prioritizeDailyDashboard(weekly, daily);
    assert.equal(result.dataPriority, 'weekly_planned'); assert.equal(result.selected.date, '2026-10-22');
  }
});
test('same-day actual dishes and explicit no-meal win while retaining every planned day', () => {
  const { ctx, snapshot, record } = setup();
  for (const status of ['available', 'no_meal']) {
    const result = ctx.prioritizeDailyDashboard(weekly, { ...snapshot, records: { '2026-10-22': { ...record, status } } });
    assert.equal(result.dataPriority, 'official_daily'); assert.equal(result.record.status, status);
    assert.equal(result.weeklyDashboard.week[0].date, '2026-10-23');
  }
});
test('date changes reuse the whole official catalog, including missing days, until refresh is due', async () => {
  const { ctx, calls, advance } = setup();
  const opts = { mealType: 'meat' };
  assert.equal((await ctx.fetchWeeklyDashboard('2026-10-22', opts)).dataPriority, 'official_daily');
  assert.equal((await ctx.fetchWeeklyDashboard('2026-10-23', opts)).dataPriority, 'weekly_planned');
  assert.equal(calls(), 1);
  advance(); await ctx.fetchWeeklyDashboard('2026-10-22', opts); assert.equal(calls(), 2);
});

test('requested-day actual record wins even when the weekly plan falls back to an older date', () => {
  const { ctx, snapshot, record } = setup();
  const oldPlan = { ...weekly, requestedDate: '2026-10-27', selected: { date: '2026-10-23' }, isFallback: true };
  const actual = { ...record, mealDate: '2026-10-27', meals: [{ dishes: [{ name: '蒜香奶油雞翅' }] }],
    schoolMenu: { dishes: [{ name: '咖哩骰子豬' }], nutritionSnapshots: [{ nutrition: { caloriesKcal: 697 } }] } };
  const result = ctx.prioritizeDailyDashboard(oldPlan, { ...snapshot, records: { '2026-10-27': actual } });
  assert.equal(result.selectedDate, '2026-10-27');
  assert.equal(result.dataPriority, 'official_daily');
  assert.equal(result.isFallback, false);
  assert.equal(result.weeklyDashboard, null);
  assert.equal(result.record.meals[0].dishes[0].name, '蒜香奶油雞翅');
  assert.equal(result.record.schoolMenu, undefined);
  assert.equal(result.records['2026-10-27'].schoolMenu, undefined);
  assert.ok(actual.schoolMenu, 'source record is preserved');
});

test('an older official record must not be treated as the requested-day meal', () => {
  const { ctx, snapshot, record } = setup();
  const oldPlan = { ...weekly, requestedDate: '2026-10-27', isFallback: true };
  const result = ctx.prioritizeDailyDashboard(oldPlan, { ...snapshot, records: { '2026-10-22': record } });
  assert.equal(result.dataPriority, 'weekly_planned');
});

test('live lookup asks for the requested date rather than the weekly fallback date', async () => {
  const { ctx, snapshot, record } = setup();
  ctx.dashboardFromStatic = (_, date, mealType) => ({ ...weekly, requestedDate: date, selected: { date: '2026-10-23' }, mealType, isFallback: true });
  let requested;
  ctx.fetch = async url => { requested = url; return { ok: true,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ ...snapshot, records: { '2026-10-27': { ...record, mealDate: '2026-10-27' } } }) }; };
  const result = await ctx.fetchWeeklyDashboard('2026-10-27', { mealType: 'meat' });
  assert.match(requested, /date=2026-10-27/);
  assert.equal(result.selectedDate, '2026-10-27');
  assert.equal(result.dataPriority, 'official_daily');
});
