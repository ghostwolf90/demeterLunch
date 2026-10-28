import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const render = source.slice(source.indexOf('function renderPassportChildAvatar()'), source.indexOf('function renderProfileAvatar('));
function fixture() {
  const button = { hidden: true, dataset: {}, firstElementChild: null,
    setAttribute(name, value) { this[name] = value; },
    replaceChildren(image) { this.firstElementChild = image || null; } };
  const state = { account: { authenticated: true, child: { nickname: '小禾', avatarUrl: '/api/account/avatar?scope=child&childId=1&v=1' } } };
  const context = vm.createContext({ state, refs: { passportChildAvatar: button }, profileDisplayName: p => p.nickname,
    document: { createElement: () => ({}) } });
  vm.runInContext(render, context);
  return { button, state, render: () => context.renderPassportChildAvatar() };
}
test('passport photo only appears after it loads, stays cached, and disappears when removed or signed out', () => {
  const h = fixture(); h.render(); const image = h.button.firstElementChild;
  assert.equal(h.button.hidden, true);
  assert.match(image.src, /^\/api\/account\/avatar/);
  assert.equal(image.referrerPolicy, 'no-referrer');
  image.onload(); assert.equal(h.button.hidden, false);
  h.render(); assert.equal(h.button.firstElementChild, image);
  h.state.account.child.avatarUrl = null; h.render();
  assert.equal(h.button.hidden, true); assert.equal(h.button.firstElementChild, null);
  image.onload(); assert.equal(h.button.hidden, true);
  h.state.account.child.avatarUrl = '/api/account/avatar?v=2'; h.render();
  h.state.account.authenticated = false; h.render();
  assert.equal(h.button.hidden, true); assert.equal(h.button.firstElementChild, null);
});
test('failed photos and stale callbacks cannot reveal an empty or different child’s avatar', () => {
  const h = fixture(); h.render(); const previous = h.button.firstElementChild;
  h.state.account.child = { nickname: '小米', avatarUrl: '/api/account/avatar?childId=2' }; h.render();
  const current = h.button.firstElementChild;
  previous.onload(); assert.equal(h.button.hidden, true);
  current.onload(); assert.equal(h.button.hidden, false);
  previous.onerror(); assert.equal(h.button.hidden, false);
  assert.equal(h.button['aria-label'], '開啟小米的孩子設定');
  current.onerror(); assert.equal(h.button.hidden, true);
  assert.match(source, /refs\.passportChildAvatar\.addEventListener\("click", \(\) => \{\s*void openPassportChildSettings\(state.account.child\?\.id, refs.passportChildAvatar\);/);
});
