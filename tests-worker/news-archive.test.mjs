import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../web/news.js', import.meta.url), 'utf8');
class Element {
  constructor(tag = 'div') { this.tagName = tag; this.children = []; this.attributes = {}; this.listeners = {}; this.dataset = {}; this.hidden = false; this.value = 'all'; this.classList = { toggle() {} }; }
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(''); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.text = ''; this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  querySelectorAll() { return this.children; }
}
async function page(items, fail = false) {
  const ids = ['newsRange', 'newsFilters', 'newsList', 'newsEmpty', 'sourcePolicy', 'newsMonth', 'newsFilterSummary'];
  const refs = Object.fromEntries(ids.map(id => [id, new Element()]));
  const buttons = ['全部', '食安與供應', '營養與政策', '食育現場'].map(category => {
    const button = new Element('button'); button.dataset.category = category; return button;
  });
  refs.newsFilters.children = buttons;
  const calls = [];
  const context = vm.createContext({
    document: { getElementById: id => refs[id], createElement: tag => new Element(tag) },
    LunchI18n: { keep: element => element },
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (fail) return { ok: false, status: 503 };
      return { ok: true, json: async () => ({ items, generatedAt: '2026-10-24T06:00:00Z' }) };
    },
  });
  vm.runInContext(source.replace(/loadNews\(\);\s*$/, 'globalThis.loaded = loadNews();'), context);
  await context.loaded;
  return { refs, calls, clickCategory(index) { refs.newsFilters.listeners.click({ target: { closest: () => buttons[index] } }); }, selectMonth(month) { refs.newsMonth.value = month; refs.newsMonth.listeners.change(); } };
}
function article(title, publishedAt, category) {
  return { title, publishedAt, category, url: 'https://example.com/' + title, source: 'Official', sourceType: '官方公告', whyItMatters: 'Source note' };
}

test('archive starts with all dates, groups newest first, and retains articles older than the discovery window', async () => {
  const { refs, calls } = await page([
    article('September story', '2026-09-18T05:56:00Z', '營養與政策'),
    article('Latest story', '2026-10-20T00:00:00Z', '食育現場'),
    article('Taipei October boundary', '2026-09-30T16:30:00Z', '食安與供應'),
  ]);
  assert.equal(calls[0].url, '/api/news');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.deepEqual(refs.newsList.children.map(group => group.children[0].textContent), ['2026 年 10 月', '2026 年 9 月']);
  assert.equal(refs.newsList.children[0].children[1].children[1].children[0].textContent, 'Latest story');
  assert.ok(refs.newsList.textContent.includes('September story'));
  assert.equal(refs.newsMonth.children.length, 3);
  assert.equal(refs.newsFilterSummary.textContent, '顯示 3 則，共保留 3 則消息。');
});

test('month and category filters combine and can return to the full historical list', async () => {
  const view = await page([
    article('Old policy', '2026-09-18T05:56:00Z', '營養與政策'),
    article('New food education', '2026-10-20T00:00:00Z', '食育現場'),
  ]);
  view.clickCategory(2);
  assert.ok(view.refs.newsList.textContent.includes('Old policy'));
  assert.equal(view.refs.newsEmpty.hidden, true);
  view.selectMonth('2026-10');
  assert.equal(view.refs.newsList.children.length, 0);
  assert.equal(view.refs.newsEmpty.hidden, false);
  view.clickCategory(0);
  assert.ok(view.refs.newsList.textContent.includes('New food education'));
  view.selectMonth('all');
  assert.equal(view.refs.newsList.children.length, 2);
  assert.equal(view.refs.newsFilterSummary.textContent, '顯示 2 則，共保留 2 則消息。');
});

test('failed API and static fallback show an error without leaving loading controls disabled', async () => {
  const { refs, calls } = await page([], true);
  assert.deepEqual(calls.map(call => call.url), ['/api/news', '/data/news.json']);
  assert.equal(refs.newsList.attributes['aria-busy'], 'false');
  assert.equal(refs.newsEmpty.hidden, false);
  assert.equal(refs.newsMonth.disabled, false);
});
