import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
function functionSource(name, next) {
  const start = source.indexOf(`function ${name}(`);
  return source.slice(start, source.indexOf(`\n${next}`, start));
}
const configurations = source.slice(source.indexOf('const SETTINGS_DOCUMENT_PAGES'), source.indexOf('function refreshSettingsDepth'));
function element() {
  const handlers = {};
  const classes = new Set();
  return {
    handlers, open: true, hidden: false, isConnected: true,
    addEventListener(name, fn) { handlers[name] = fn; },
    querySelectorAll() { return []; }, querySelector() { return { scrollTo() {} }; },
    classList: { contains: value => classes.has(value), add: value => classes.add(value), remove: value => classes.delete(value), toggle(value, enabled) { if (enabled) classes.add(value); else classes.delete(value); } },
    focus() { this.focused = true; }, setAttribute() {},
  };
}
function settingsEvents() {
  const refs = new Proxy({}, { get(target, key) { return target[key] ||= element(); } });
  const calls = [];
  const state = { settingsPageKind: 'grade', settingsPageRequestId: 0 };
  const context = { refs, state, FormData: class { get() { return 'elementary_upper'; } },
    openSettingsDialog: trigger => calls.push(['settings', trigger]),
    openAccountDialog: trigger => calls.push(['account', trigger]),
    closeSettingsDialog: () => calls.push(['closeSettings']),
    closeSettingsPage: async () => calls.push(['closePage']),
    renderSettings: () => calls.push(['render']), setFormStatus: (...args) => calls.push(['status', ...args]),
    selectGradeGroup: value => calls.push(['grade', value]), selectStandardMode: value => calls.push(['standard', value]),
  };
  const start = source.indexOf('for (const trigger of [refs.accountButton, refs.mobileSettingsButton])');
  const handlers = source.slice(start, source.indexOf('refs.passportUnlock.addEventListener', start));
  vm.runInNewContext(configurations + handlers, context);
  return { refs, calls, state };
}

test('desktop and mobile use the same settings entry; account opens above it without closing settings', () => {
  const { refs, calls } = settingsEvents();
  refs.accountButton.handlers.click();
  refs.mobileSettingsButton.handlers.click();
  refs.settingsFamilyAccount.handlers.click();
  assert.deepEqual(calls.map(call => call[0]), ['settings', 'settings', 'account']);
  assert.equal(calls[2][1], refs.settingsFamilyAccount);
  assert.doesNotMatch(html, /id="settingsButton"/);
  for (const kind of ['grade', 'standard', 'support', 'about', 'privacy', 'terms']) {
    assert.match(html, new RegExp(`data-settings-page="${kind}"`));
  }
});

test('preference X discards the pending choice; Done commits before dismissing just the child sheet', async () => {
  const { refs, calls } = settingsEvents();
  refs.closeSettingsPage.handlers.click();
  assert.deepEqual(calls.map(call => call[0]), ['closePage']);
  calls.length = 0;
  await refs.settingsPreferenceForm.handlers.submit({ preventDefault() {} });
  assert.deepEqual(calls.map(call => call[0]), ['grade', 'render', 'status', 'closePage']);
  assert.equal(calls[0][1], 'elementary_upper');
  assert.equal(refs.settingsDialog.open, true);
});

test('Escape and backdrop dismiss the top sheet; focus returns to its original row', () => {
  const { refs, calls, state } = settingsEvents();
  let prevented = false;
  refs.settingsPageDialog.handlers.cancel({ target: refs.settingsPageDialog, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  refs.settingsPageDialog.handlers.click({ target: refs.settingsPageDialog });
  assert.equal(calls.filter(call => call[0] === 'closePage').length, 2);
  // Inject the callback dependency used only by the native close event.
  const trigger = element();
  state.settingsPageTrigger = trigger;
  const closeCode = source.slice(source.indexOf('refs.settingsPageDialog.addEventListener("close"'), source.indexOf('refs.settingsPreferenceForm.addEventListener'));
  vm.runInNewContext(closeCode, { refs, state, refreshSettingsDepth() {} });
  refs.settingsPageDialog.handlers.close();
  assert.equal(trigger.focused, true);
  assert.equal(state.settingsPageKind, null);
  assert.equal(refs.settingsDialog.open, true);
});

test('a late save cannot dismiss a different account task opened in the meantime', async () => {
  const refs = { settingsDialog: element(), accountDialog: element(), settingsStatus: element() };
  refs.accountDialog.classList.add('settings-child-sheet');
  const state = { settingsAccountSession: 4 };
  let closes = 0;
  const code = 'async ' + functionSource('completeSettingsAccountTask', 'function closeSettingsDialog');
  const ctx = vm.createContext({ refs, state, window: { matchMedia: () => ({ matches: true }) }, renderSettings() {}, setFormStatus() {}, async closeAccountDialog() { closes++; } });
  vm.runInContext(code, ctx);
  await ctx.completeSettingsAccountTask('已儲存', 3);
  assert.equal(closes, 0);
  await ctx.completeSettingsAccountTask('已儲存', 4);
  assert.equal(closes, 1);
  refs.accountDialog.open = false;
  await ctx.completeSettingsAccountTask('已儲存', 4);
  assert.equal(closes, 1);
});

test('stale document responses cannot replace the newer sheet content', async () => {
  const pending = [];
  const refs = { settingsDocument: { setAttribute() {}, replaceChildren(value) { this.content = value; } }, settingsPageStatus: {}, settingsPageRetry: {}, settingsPageDialog: { open: true } };
  const state = { settingsPageRequestId: 0 };
  const ctx = vm.createContext({ refs, state, AbortController, setFormStatus() {},
    fetch: () => new Promise(resolve => pending.push(resolve)),
    DOMParser: class { parseFromString(text) { return { querySelector: () => ({ text, attributes: [], hasAttribute: () => false, querySelectorAll: () => [] }) }; } },
    document: { importNode: value => value },
  });
  vm.runInContext(configurations + 'async ' + functionSource('loadSettingsDocument', 'function openSettingsPage'), ctx);
  const older = ctx.loadSettingsDocument('privacy');
  const newer = ctx.loadSettingsDocument('terms');
  pending[1]({ ok: true, text: async () => 'newer terms' });
  await newer;
  pending[0]({ ok: true, text: async () => 'older privacy' });
  await older;
  assert.equal(refs.settingsDocument.content.text, 'newer terms');
  assert.equal(refs.settingsPageRetry.hidden, true);
});

test('failed account save retains the form; successful save returns to settings with name and nickname separate', async () => {
  const start = source.indexOf('refs.parentProfileForm.addEventListener("submit"');
  const handler = source.slice(start, source.indexOf('refs.removeParentAvatar.addEventListener', start));
  async function save(ok) {
    let submit, body, completions = 0, resets = 0;
    const refs = { parentProfileForm: { addEventListener(_, fn) { submit = fn; } }, saveParentProfile: {}, parentProfileStatus: {}, parentName: { value: '林家長' }, parentNickname: { value: '阿禾爸' } };
    vm.runInNewContext(handler, { refs, state: { settingsAccountSession: 9 },
      fetch: async (_, options) => { body = JSON.parse(options.body); return { ok }; },
      responsePayload: async () => ({}), loadAccount: async () => {},
      resetAvatarSelection() { resets++; }, setFormStatus() {},
      completeSettingsAccountTask: async (_, session) => { assert.equal(session, 9); completions++; },
    });
    await submit({ preventDefault() {} });
    return { refs, body, completions, resets };
  }
  const failed = await save(false);
  assert.equal(failed.completions, 0);
  assert.equal(failed.resets, 0);
  assert.equal(failed.refs.parentName.value, '林家長');
  const success = await save(true);
  assert.equal(success.completions, 1);
  assert.deepEqual(success.body, { name: '林家長', nickname: '阿禾爸' });
  assert.equal(success.refs.saveParentProfile.disabled, false);
});

test('account task opens as a bottom sheet over the still-open settings page', () => {
  const refs = Object.fromEntries(['settingsDialog', 'accountDialog', 'settingsAccountToolbar', 'closeSettingsAccountSheet', 'closeAccountDialog'].map(id => [id, element()]));
  const trigger = element();
  const state = { account: { loading: false, authenticated: true }, settingsAccountSession: 1, dialogMotion: { account: {} } };
  let focused, refreshed = false;
  const ctx = vm.createContext({ refs, state, EMAIL_REGISTRATION_ENABLED: true, renderAccount() {}, renderAccountIntentNotice() {},
    refreshSettingsDepth() { refreshed = true; },
    openStagedDialog(_, __, focus) { focused = focus; },
  });
  vm.runInContext(functionSource('openAccountDialog', 'function closeAccountDialog'), ctx);
  ctx.openAccountDialog(trigger);
  assert.equal(refs.settingsDialog.open, true);
  assert.equal(refs.accountDialog.classList.contains('settings-child-sheet'), true);
  assert.equal(refs.settingsAccountToolbar.hidden, false);
  assert.equal(focused, refs.closeSettingsAccountSheet);
  assert.equal(state.lastAccountTrigger, trigger);
  assert.equal(refreshed, true);
});


test('desktop preference controls apply immediately without opening or dismissing a sheet', () => {
  const { refs, calls } = settingsEvents();
  refs.settingsDesktopGrade.value = 'elementary_upper';
  refs.settingsDesktopGrade.handlers.change();
  refs.settingsDesktopStandard.value = 'transitional';
  refs.settingsDesktopStandard.handlers.change();
  assert.deepEqual(calls.map(call => call[0]), ['grade', 'render', 'status', 'standard', 'render', 'status']);
  assert.equal(refs.settingsDialog.open, true);
  for (const path of ['support', 'about', 'privacy', 'terms']) {
    assert.ok(html.includes(`class="settings-row settings-web-link" href="/${path}"`));
  }
});

test('desktop account save stays open, while the same mobile task dismisses after success', async () => {
  for (const mobile of [false, true]) {
    const refs = { settingsDialog: element(), accountDialog: element(), settingsStatus: element() };
    refs.accountDialog.classList.add('settings-child-sheet');
    let closes = 0;
    const ctx = vm.createContext({ refs, state: { settingsAccountSession: 2 },
      window: { matchMedia: () => ({ matches: mobile }) }, renderSettings() {}, setFormStatus() {},
      async closeAccountDialog() { closes++; },
    });
    vm.runInContext('async ' + functionSource('completeSettingsAccountTask', 'function closeSettingsDialog'), ctx);
    await ctx.completeSettingsAccountTask('已儲存', 2);
    assert.equal(closes, mobile ? 1 : 0);
  }
});
