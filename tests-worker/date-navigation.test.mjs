import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
function api() {
  let now = 100000; const calls = [];
  const record = { source: { url: 'https://official.example/school/date' } };
  const state = { schoolId: 123, mealType: 'meat', schoolDashboardCache: new Map() };
  const context = vm.createContext({ state, DEFAULT_SCHOOL_ID: 193609,
    Date: { now: () => now }, encodeURIComponent,
    fetch: async url => { calls.push(url); return { ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ viewMode: 'officialDaily', school: { fatraceSchoolId: 123 }, records: { '2026-10-21': record, '2026-10-22': record }, record, selectedDate: '2026-10-21' }) }; },
    isAbortError: e => e.name === 'AbortError', console,
  });
  vm.runInContext(source.slice(source.indexOf('async function fetchDashboard('), source.indexOf('async function fetchSchoolDirectory(')), context);
  return { context, calls, state, advance: ms => { now += ms; } };
}
test('switching dates and meal types reuses same-school fetched records without another API request', async () => {
  const { context, calls } = api();
  await context.fetchDashboard('2026-10-21');
  const next = await context.fetchDashboard('2026-10-22', { mealType: 'vegetarian' });
  assert.equal(calls.length, 1); assert.equal(next.selectedDate, '2026-10-22');
  assert.equal(next.mealType, 'vegetarian'); assert.equal(next.record.source.url, 'https://official.example/school/date');
});
test('school changes and expired data require a fresh request', async () => {
  const { context, calls, advance } = api();
  await context.fetchDashboard('2026-10-21');
  await context.fetchDashboard('2026-10-22', { schoolId: 124 }); assert.equal(calls.length, 2);
  advance(60001); await context.fetchDashboard('2026-10-22'); assert.equal(calls.length, 3);
});
test('date selection acknowledges immediately while the dashboard is still pending', async () => {
  const cards = ['2026-10-21', '2026-10-22'].map(date => ({ dataset: { date }, attributes: {}, classList: { toggle() {} }, setAttribute(k,v) { this.attributes[k] = v; } }));
  const refs = { weekDays: { setAttribute() {}, querySelectorAll: () => cards } };
  const state = { dashboard: { selectedDate: '2026-10-21' } };
  const context = vm.createContext({ refs, state });
  vm.runInContext(source.slice(source.indexOf('function markPendingDate('), source.indexOf('function cancelDashboardRequest(')), context);
  context.markPendingDate('2026-10-22'); assert.equal(cards[1].attributes['aria-current'], 'true');
  context.markPendingDate(); assert.equal(cards[0].attributes['aria-current'], 'true');
});
