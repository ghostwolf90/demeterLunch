import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const start = source.indexOf('refs.encounterForm.addEventListener("submit"');
const handler = source.slice(start, source.indexOf('\nasync function refreshPassportMemories', start));

test('entire entry is collapsed initially, while history and status remain outside', () => {
  const entry = html.indexOf('id="encounterEntry"');
  const form = html.indexOf('<form id="encounterForm">', entry);
  const formEnd = html.indexOf('</form>', form);
  const entryEnd = html.indexOf('</details>', formEnd);
  assert.ok(entry > 0 && form > entry && formEnd > form);
  assert.doesNotMatch(html.slice(html.lastIndexOf('<details', entry), html.indexOf('>', entry)), /\bopen\b/);
  assert.ok(html.indexOf('id="encounterFormStatus"') > entryEnd);
  assert.ok(html.indexOf('id="encounterList"') > entryEnd);
  const choices = source.slice(source.indexOf('function renderPassportFoodChoices'), source.indexOf('function syncPassportOptionalDetails'));
  assert.doesNotMatch(choices, /其他地方|OTHER_FOOD_CONTEXT/);
});

async function submit({ ok = true, selected = '油菜', experience = 'tasted', quote = '' } = {}) {
  let listener, body, resets = 0, focused = false;
  const button = {};
  const refs = {
    encounterEntry: { open: true }, encounterEntryToggle: { focus() { focused = true; } },
    encounterForm: { addEventListener(_, callback) { listener = callback; }, querySelector() { return button; }, reset() { resets++; } },
    passportFoodChoices: { querySelector() { return { value: selected, focus() {} }; } },
    customFoodName: { value: '' }, encounterFormStatus: {},
    encounterChildQuote: { value: quote }, encounterPreparation: { value: '' }, encounterNote: { value: '' },
  };
  vm.runInNewContext(handler, {
    refs, state: { account: { child: { id: 7 } }, mealType: 'meat' },
    isViewingChildSchool: () => true, passportFoodOptions: () => ['油菜'], selectedMealDate: () => '2026-10-22',
    FormData: class { get(key) { return key === 'experience' ? experience : null; } },
    setFormStatus() {}, updateNoEatDetails() {}, resetPassportOptionalDetails() {}, loadAccount: async () => {},
    setMemoryMode() {},
    responsePayload: async () => ({}),
    fetch: async (_, options) => { body = JSON.parse(options.body); return { ok }; },
  });
  await listener({ preventDefault() {} });
  return { refs, body, resets, focused };
}

test('saving creates a school lunch record and collapses after success', async () => {
  const result = await submit();
  assert.equal(result.body.mealContext, 'school_lunch');
  assert.equal(result.body.dishName, '油菜');
  assert.equal(result.body.foodName, '油菜');
  assert.equal(result.refs.encounterEntry.open, false);
  assert.equal(result.resets, 1);
  assert.equal(result.focused, true);
});

test('failed save preserves the draft and keeps entry open', async () => {
  const result = await submit({ ok: false });
  assert.equal(result.resets, 0);
  assert.equal(result.refs.encounterEntry.open, true);
});

test('stale or removed source choices cannot create a record', async () => {
  const result = await submit({ selected: '__other_food_context__' });
  assert.equal(result.body, undefined);
  assert.equal(result.resets, 0);
});

test('a quote alone saves without inferring contact, while empty drafts stay open', async () => {
  const result = await submit({ experience: null, quote: '像雨傘' });
  assert.equal(result.body.experience, 'unrecorded');
  assert.equal(result.body.childQuote, '像雨傘');
  const empty = await submit({ experience: null });
  assert.equal(empty.body, undefined);
  assert.equal(empty.resets, 0);
});
