import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const headerRender = source.slice(source.indexOf('function renderAccount() {'), source.indexOf('  const childSettingsView', source.indexOf('function renderAccount() {'))) + '}';

function renderHeader(account) {
  const refs = Object.fromEntries(['accountButton', 'accountAvatar', 'accountLoadingStatus', 'accountButtonText', 'accountSignedOutView', 'accountSignedInView'].map(id => [id, {
    classList: { toggle() {} },
    setAttribute(name, value) { this[name] = value; },
  }]));
  vm.runInNewContext(headerRender + '\nrenderAccount();', { state: { account }, refs, LunchI18n: { keep(node) { return node; } }, EMAIL_REGISTRATION_ENABLED: true, renderProfileAvatar() {}, profileDisplayName(profile, fallback) { return profile?.nickname || profile?.name || fallback; } });
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
  refs = renderHeader({ loading: false, authenticated: true, user: { nickname: '家長暱稱' }, child: { nickname: '小米' } });
  assert.equal(refs.accountButton.disabled, false);
  assert.equal(refs.accountButton['aria-busy'], 'false');
  assert.equal(refs.accountButtonText.textContent, '家長暱稱');
  assert.equal(refs.accountLoadingStatus.hidden, true);
  assert.equal(refs.accountSignedInView.hidden, false);
  refs = renderHeader({ loading: false, authenticated: false });
  assert.equal(refs.accountButtonText.textContent, '登入／免費註冊');
  assert.equal(refs.accountSignedOutView.hidden, false);
});

// Exercise the actual initial state and loader together, rather than only the header.
function accountLoader(fetchImplementation) {
  const stateStart = source.indexOf('const state = {');
  const initialState = source.slice(stateStart, source.indexOf('\n};', stateStart) + 3);
  const loaderStart = source.indexOf('async function loadAccount(');
  const loader = source.slice(loaderStart, source.indexOf('\nasync function requestEmailAuthCode', loaderStart));
  let renders = 0;
  const context = vm.createContext({
    Error, savedMealType: null, savedGradeGroup: null, savedStandardMode: null, savedActiveChildId: null,
    fetch: fetchImplementation, accountEndpoint: () => '/api/account',
    responsePayload: response => response.json(), accountNeedsOnboarding: () => false,
    rememberActiveChild() {}, renderAccount() { renders++; }, refs: { accountDialog: { open: false } },
    PassportMemory: { refresh() {}, clear() {} }, refreshPassportMemories() {},
  });
  vm.runInContext(initialState + '\n' + loader + '\nglobalThis.result = { state, loadAccount };', context);
  return { ...context.result, renders: () => renders };
}

test('refresh completes session verification from the actual initial state', async () => {
  for (const authenticated of [true, false]) {
    const loader = accountLoader(async () => ({ ok: true, json: async () => ({ authenticated, child: authenticated ? { id: 7 } : null }) }));
    assert.equal(loader.state.account.loading, true);
    assert.equal(loader.state.accountRequestId, 0);
    await loader.loadAccount();
    assert.equal(loader.state.account.loading, false);
    assert.equal(loader.state.account.authenticated, authenticated);
    assert.equal(loader.renders(), 1);
    assert.equal(loader.state.accountRequestId, 1);
  }
});

test('a failed session request exits verification and displays the error', async () => {
  const loader = accountLoader(async () => { throw new Error('連線失敗'); });
  await loader.loadAccount();
  assert.equal(loader.state.account.loading, false);
  assert.equal(loader.state.account.error, '連線失敗');
  assert.equal(loader.renders(), 1);
});

test('only the latest session request may update the displayed account', async () => {
  const pending = [];
  const loader = accountLoader(() => new Promise(resolve => pending.push(resolve)));
  const old = loader.loadAccount({ childId: 1 });
  const latest = loader.loadAccount({ childId: 2 });
  pending[1]({ ok: true, json: async () => ({ authenticated: true, child: { id: 2 } }) });
  await latest;
  pending[0]({ ok: true, json: async () => ({ authenticated: true, child: { id: 1 } }) });
  await old;
  assert.equal(loader.state.account.child.id, 2);
  assert.equal(loader.renders(), 1);
});
