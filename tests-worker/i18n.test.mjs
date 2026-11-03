import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const copy = readFileSync(new URL('../web/locales/en.js', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../web/i18n.js', import.meta.url), 'utf8');

function load({ saved = null, languages = ['en-US'], blocked = false, dom = false } = {}) {
  const storage = new Map(saved === null ? [] : [['demeter-language', saved]]);
  const handlers = {};
  const context = {
    navigator: { languages, language: languages[0] },
    localStorage: {
      getItem(key) { if (blocked) throw Error('blocked'); return storage.get(key) ?? null; },
      setItem(key, value) { if (blocked) throw Error('blocked'); storage.set(key, value); },
      removeItem(key) { if (blocked) throw Error('blocked'); storage.delete(key); },
    },
    addEventListener(name, callback) { handlers[name] = callback; },
    dispatchEvent() {},
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
  };
  let deliver;
  if (dom) {
    context.document = {
      documentElement: element(),
      querySelectorAll() { return []; },
      addEventListener() {},
    };
    context.MutationObserver = class { constructor(callback) { deliver = callback; } observe() {} };
  }
  context.window = context;
  vm.createContext(context);
  vm.runInContext(copy, context);
  vm.runInContext(runtime, context);
  return { api: context.LunchI18n, context, storage, handlers, deliver: records => deliver(records) };
}
function element(text = '') {
  const attributes = new Map();
  const node = {
    nodeType: 1, childNodes: [],
    closest(selector) { return selector.includes('[translate="no"]') && attributes.get('translate') === 'no' ? node : null; },
    hasAttribute: key => attributes.has(key),
    getAttribute: key => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
  };
  if (text) node.childNodes.push({ nodeType: 3, parentElement: node, nodeValue: text });
  return node;
}

test('explicit supported preference wins; browser language order is respected; unsupported languages fall back to Traditional Chinese', () => {
  const { api } = load();
  assert.equal(api.resolve('zh-Hant', ['en-US']), 'zh-Hant');
  assert.equal(api.resolve('en', ['zh-TW']), 'en');
  assert.equal(api.resolve(null, ['ja-JP', 'en-GB', 'zh-TW']), 'en');
  assert.equal(api.resolve(null, ['zh-TW', 'en-US']), 'zh-Hant');
  assert.equal(api.resolve(null, ['fr-FR', 'ja-JP']), 'zh-Hant');
  assert.equal(api.resolve('invalid', ['en-AU']), 'en');
  assert.equal(api.resolve(null, []), 'zh-Hant');
  assert.equal(load({ blocked: true }).api.language, 'en');
});

test('English covers dynamic notices without changing embedded personal or official source text', () => {
  const { api } = load();
  assert.equal(api.t('設定'), 'Settings');
  assert.equal(api.t('  顯示偏好\n'), '  Display preferences\n');
  assert.equal(api.t('查看全部 12 筆飲食紀錄'), 'View all 12 journal entries');
  assert.equal(api.t('孩子說：「我今天不喜歡蛋」'), 'Your child\'s words: “我今天不喜歡蛋”');
  assert.equal(api.t('來源菜色：番茄炒蛋'), 'Source dish: 番茄炒蛋');
  assert.equal(api.t('編輯喜歡的設定'), 'Edit settings for 喜歡');
  assert.equal(api.t('2026年10月24日 星期六'), 'October 24, 2026 (Sat)');
  assert.equal(api.t('素食，3 道官方公開菜色'), 'Vegetarian, 3 officially listed dishes');
});

test('English localizes Lunch Town dialogue and City Hall after-hours routines', () => {
  const { api } = load();
  assert.equal(api.t('小晴'), 'Sunny');
  assert.equal(api.t('大安區・學生'), 'Daan District · Student');
  assert.equal(api.t('按 Enter 與 小晴（學生）對話'), 'Press Enter to talk to Sunny (Student)');
  assert.equal(api.t('小晴（學生）開始對話。'), 'Conversation started with Sunny (Student).');
  assert.equal(
    api.t('海風吹來的時候，我們會聊聊海岸生態，也記得不把沙灘上的東西帶回家。'),
    'When the sea breeze blows, we talk about coastal ecology and remember not to take things home from the beach.',
  );
  assert.equal(
    api.t('我每天先看看午餐有什麼，再決定最想先認識哪一道菜。'),
    "I check what's for lunch first, then decide which dish I want to get to know first.",
  );
  assert.equal(
    api.t('已回到市政晴庭公寓，今晚不再返回市府辦公區'),
    'Back at Civic Sunny Court Apartments for the night, with no return to the civic offices.',
  );
  assert.equal(
    api.t('下班後到福星小站買晚餐、日用品或逛逛，再回家休息'),
    'Stopping by Lucky Star Stop after work for dinner, daily essentials, or a little shopping before heading home.',
  );
});

test('language changes restore Chinese, preserve raw source text and form values, and handle later renders', () => {
  const env = load({ dom: true });
  const heading = element('設定');
  const source = env.api.keep(element('蛋'));
  const field = element(); field.value = '孩子填寫的內容';
  env.context.document.documentElement.childNodes.push(heading, source, field);
  env.api.translateTree(heading); env.api.translateTree(source);
  assert.equal(heading.childNodes[0].nodeValue, 'Settings');
  assert.equal(source.childNodes[0].nodeValue, '蛋');
  env.api.select('zh-Hant');
  assert.equal(heading.childNodes[0].nodeValue, '設定');
  assert.equal(field.value, '孩子填寫的內容');
  assert.equal(env.storage.get('demeter-language'), 'zh-Hant');
  env.api.select('auto');
  assert.equal(env.api.language, 'en');
  assert.equal(env.storage.has('demeter-language'), false);
  heading.childNodes[0].nodeValue = '正在儲存…';
  env.deliver([{ type: 'characterData', target: heading.childNodes[0] }]);
  assert.equal(heading.childNodes[0].nodeValue, 'Saving…');
  env.api.select('zh-Hant');
  assert.equal(heading.childNodes[0].nodeValue, '正在儲存…');
  assert.deepEqual([...env.storage.keys()], ['demeter-language']);
});

test('blocked storage and browser-language changes do not break switching', () => {
  const { api, context, handlers } = load({ dom: true, blocked: true });
  api.select('zh-Hant');
  assert.equal(api.language, 'zh-Hant');
  context.navigator.languages = ['en-US'];
  handlers.languagechange();
  assert.equal(api.language, 'zh-Hant');
  api.select('auto');
  assert.equal(api.language, 'en');
  context.navigator.languages = ['ja-JP'];
  handlers.languagechange();
  assert.equal(api.language, 'zh-Hant');
});
