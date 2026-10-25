import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const dateSource = readFileSync(new URL('../web/date-context.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
function setup() {
  const label = { children: [], replaceChildren(...children) { this.children = children; }, append(child) { this.children.push(child); } };
  const context = vm.createContext({ refs: { weekLabel: label }, node: (tag, className, text) => ({ className, text }) });
  vm.runInContext(dateSource, context);
  vm.runInContext(appSource.slice(appSource.indexOf('function setWeekLabel('), appSource.indexOf('function renderWeek(')), context);
  return { context, label };
}
test('same-month heading shows month and school week, keeping exact dates in its tooltip', () => {
  const { context, label } = setup();
  context.setWeekLabel('2026-10-19', '2026-10-23', 8);
  assert.equal(label.children.map(x => x.text).join(' '), '10月 · 第 8 週');
  assert.equal(label.title, '2026-10-19–2026-10-23');
});
test('month and year boundaries stay explicit', () => {
  const { context, label } = setup();
  context.setWeekLabel('2026-08-31', '2026-09-04', 1);
  assert.equal(label.children[0].text, '8–9月');
  context.setWeekLabel('2026-12-28', '2027-01-01', 18);
  assert.equal(label.children[0].text, '2026年12月–2027年1月');
});
test('a school without published week numbers does not get an invented number; examples remain marked', () => {
  const { context, label } = setup();
  context.setWeekLabel('2026-10-19', '2026-10-25');
  assert.equal(label.children.length, 1);
  context.setWeekLabel('2026-10-19', '2026-10-23', 8, true);
  assert.equal(label.children.at(-1).text, '功能範例');
});
test('month labels translate without intercepting prices or other month copy', () => {
  const context = vm.createContext({ navigator: { languages: ['en'] } });
  context.window = context;
  vm.runInContext(readFileSync(new URL('../web/locales/en.js', import.meta.url), 'utf8'), context);
  vm.runInContext(readFileSync(new URL('../web/i18n.js', import.meta.url), 'utf8'), context);
  assert.equal(context.LunchI18n.t('10月'), 'October');
  assert.equal(context.LunchI18n.t('10–11月'), 'Oct–Nov');
  assert.equal(context.LunchI18n.t('· 第 8 週'), '· Week 8');
  assert.equal(context.LunchI18n.t('2026年12月–2027年1月'), '2026/12–2027/1');
});
