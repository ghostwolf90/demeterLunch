import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const headerRender = source.slice(source.indexOf('function renderAccount() {'), source.indexOf('  renderEmailAuthStep();', source.indexOf('function renderAccount() {'))) + '}';

function renderHeader(account) {
  const refs = Object.fromEntries(['accountButton', 'accountAvatar', 'accountLoadingStatus', 'accountButtonText', 'accountSignedOutView', 'accountSignedInView'].map(id => [id, {
    classList: { toggle() {} },
    setAttribute(name, value) { this[name] = value; },
  }]));
  vm.runInNewContext(headerRender + '\nrenderAccount();', { state: { account }, refs, EMAIL_REGISTRATION_ENABLED: true });
  return refs;
}

test('initial HTML waits for session verification before offering login', () => {
  assert.match(html, /id="accountButton"[^>]*aria-busy="true"[^>]*disabled/);
  assert.match(html, /id="accountButtonText">正在確認登入…/);
  assert.match(html, /id="passportLocked" hidden/);
});

test('pending session never appears signed out, then resolves to the verified state', () => {
  let refs = renderHeader({ loading: true, authenticated: false });
  assert.equal(refs.accountButton.disabled, true);
  assert.equal(refs.accountButtonText.textContent, '正在確認登入…');
  assert.equal(refs.accountSignedOutView.hidden, true);
  assert.equal(refs.accountSignedInView.hidden, true);
  refs = renderHeader({ loading: false, authenticated: true, child: { nickname: '小米' } });
  assert.equal(refs.accountButton.disabled, false);
  assert.equal(refs.accountButton['aria-busy'], 'false');
  assert.equal(refs.accountButtonText.textContent, '小米的午餐紀錄');
  assert.equal(refs.accountLoadingStatus.hidden, true);
  assert.equal(refs.accountSignedInView.hidden, false);
  refs = renderHeader({ loading: false, authenticated: false });
  assert.equal(refs.accountButtonText.textContent, '登入／免費註冊');
  assert.equal(refs.accountSignedOutView.hidden, false);
});
