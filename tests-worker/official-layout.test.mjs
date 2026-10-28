import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
function setup() {
  const refs = new Proxy({}, { get(target, key) {
    if (!target[key]) { const classes = new Set(); target[key] = {
      hidden: false, textContent: 'previous day', firstElementChild: {}, children: ['previous day'],
      classList: { add: name => classes.add(name), remove: name => classes.delete(name),
        toggle(name, on) { on ? classes.add(name) : classes.delete(name); }, contains: name => classes.has(name) },
      setAttribute() {}, replaceChildren(...children) { this.children = children; } };
    } return target[key];
  } });
  const data = { snapshots: [], dinner: null };
  const context = vm.createContext({ refs, state: { mealType: 'meat' },
    document: { body: { dataset: {} }, querySelectorAll: () => [] },
    OfficialDiet: { profile: () => ({ hasVariants: false }), summary: () => ({ dishCount: 1, ingredientCount: 0 }),
      nutritionSnapshots: () => data.snapshots, dinnerSuggestion: () => data.dinner },
    officialDishes: () => [], localIsoDate: () => '2026-10-27', formatDate: value => value,
    watchProductContent() {}, renderSchoolContext() {}, renderOfficialMeal() {}, renderPassportFoodChoices() {}, renderOfficialTraceability() {}, renderOfficialWeek() {}, setDashboardStatus() {},
    renderOfficialNutrition(snapshots) { refs.nutritionBars.replaceChildren(...snapshots); },
    renderDinner(dinner) { refs.dinnerPicks.replaceChildren(...dinner.recommendations); },
    node: (tag, className, textContent) => ({ tag, className, textContent }),
  });
  vm.runInContext(source.slice(source.indexOf('function setViewMode('), source.indexOf('async function renderNoSchoolSelected(')) + '\n' +
    source.slice(source.indexOf('function renderOfficial(dashboard)'), source.indexOf('// Taiwan 2026 dates:')), context);
  return { refs, data, context, dashboard: { school: { name: '測試國小' }, selectedDate: '2026-10-27', record: { status: 'available' } } };
}
test('official desktop keeps both companion cards without retaining another date’s numbers or dinner ideas', () => {
  const h = setup(); h.refs.nutritionBars.classList.add('has-multiple-snapshots');
  h.context.renderOfficial(h.dashboard);
  assert.equal(h.refs.nutritionCard.hidden, false); assert.equal(h.refs.dinnerCard.hidden, false);
  assert.equal(h.refs.nutritionCard.classList.contains('is-unavailable'), true);
  assert.equal(h.refs.dinnerCard.classList.contains('is-unavailable'), true);
  assert.equal(h.refs.calories.textContent, '未提供');
  assert.equal(h.refs.nutritionBars.classList.contains('has-multiple-snapshots'), false);
  assert.equal(h.refs.dinnerPicks.children.length, 0); assert.equal(h.refs.dinnerNotes.children.length, 0);
  assert.match(h.refs.dinnerReason.textContent, /所選日期/);
  h.dashboard.record = { status: 'no_meal' }; h.context.renderOfficial(h.dashboard);
  assert.match(h.refs.dinnerReason.textContent, /當日不供餐/);
});
test('available daily data and returning to weekly mode clear the unavailable state', () => {
  const h = setup(); h.context.renderOfficial(h.dashboard);
  h.data.snapshots = [{ nutrition: { caloriesKcal: 600 } }]; h.data.dinner = { recommendations: ['晚餐'] };
  h.context.renderOfficial(h.dashboard);
  assert.equal(h.refs.nutritionCard.classList.contains('is-unavailable'), false);
  assert.equal(h.refs.dinnerCard.classList.contains('is-unavailable'), false);
  assert.equal(h.refs.nutritionBars.children.length, 1); assert.equal(h.refs.dinnerPicks.children[0], '晚餐');
  h.data.snapshots = []; h.context.renderOfficial(h.dashboard); h.context.setViewMode('detailed');
  assert.equal(h.refs.nutritionCard.classList.contains('is-unavailable'), false);
  assert.equal(h.refs.dinnerCard.hidden, false);
});
