import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
function fixture({ mobile = true } = {}) {
  function element(extra = {}) {
    const classes = new Set();
    const attributes = new Map();
    return { inert: false, handlers: {}, open: false, scrollTop: 0,
      classList: { add: (...values) => values.forEach(value => classes.add(value)), remove: (...values) => values.forEach(value => classes.delete(value)), contains: value => classes.has(value), toggle(value, active) { if (active) classes.add(value); else classes.delete(value); } },
      attributes, setAttribute(key, value) { attributes.set(key, value); }, removeAttribute(key) { attributes.delete(key); },
      addEventListener(name, handler) { this.handlers[name] = handler; }, focus() { this.focused = true; },
      scrollTo({ top }) { this.scrollTop = top; }, show() { this.open = true; this.nonmodalShows = (this.nonmodalShows || 0) + 1; }, close() { this.open = false; }, ...extra,
    };
  }
  const links = ['today', 'week', 'traceability', 'passport'].map(id => element({ hash: `#${id}` }));
  const settingsButton = element();
  const shell = element();
  const background = [element(), element({ inert: true }), element()];
  const body = element();
  const refs = { settingsDesktopGrade: element(), settingsDesktopStandard: element(), refreshSiteVersion: element(), accountButton: element(), mobileSettingsButton: settingsButton, settingsDialog: element({ querySelector: () => shell }), settingsTitle: element(), settingsStatus: element(), closeSettingsDialog: element(), accountDialog: element(), settingsPageDialog: element(), familyPlanDialog: element() };
  const sections = Object.fromEntries(['today', 'week', 'traceability', 'passport'].map((id, index) => [id, { id, hidden: false, getClientRects: () => [1], getBoundingClientRect: () => ({ top: [-400, -100, 500, 1000][index] }) }]));
  const state = { releaseCheckRequestId: 0, settingsTabActive: false, settingsTabScrollTop: 0, settingsPreviousTab: 'today', settingsBackground: [], settingsIgnoredCloseEvents: 0, dialogMotion: { settings: { openFrame: 0 } } };
  let modalShows = 0;
  const frames = [];
  const windowHandlers = {};
  const ctx = vm.createContext({ refs, state, Promise,
    renderSettings() {}, setFormStatus() {}, checkSiteVersion() {},
    openStagedDialog(dialog) { modalShows++; dialog.open = true; }, closeStagedDialog(dialog) { dialog.open = false; return Promise.resolve(); },
    document: { body,
      querySelectorAll(selector) {
        if (selector === '.mobile-nav a[href^="#"], #mobileSettingsButton') return [...links, settingsButton];
        if (selector === '.mobile-nav a[href^="#"]') return links;
        if (selector === 'body > .topbar, body > main, body > footer') return background;
        throw new Error(`Unexpected selector: ${selector}`);
      },
      querySelector: () => links.find(link => link.classList.contains('active')),
      getElementById: id => sections[id],
    },
    window: { innerHeight: 800, matchMedia: () => ({ matches: mobile }), cancelAnimationFrame() {},
      requestAnimationFrame(fn) { frames.push(fn); return frames.length; },
      addEventListener(event, callback) { windowHandlers[event] = callback; },
    },
  });
  const start = source.indexOf('function setMobileNavigationTarget');
  vm.runInContext(source.slice(start, source.indexOf('function closeSettingsPage', start)), ctx);
  const closeStart = source.indexOf('function closeSettingsDialog()');
  vm.runInContext(source.slice(closeStart, source.indexOf('function renderAccount()', closeStart)), ctx);
  const navStart = source.indexOf('function setupMobileNavigation()');
  vm.runInContext(source.slice(navStart, source.indexOf('for (const link of document.querySelectorAll("a.today-link"))', navStart)), ctx);
  ctx.setupMobileNavigation();
  return { ctx, refs, state, links, shell, background, body, frames, windowHandlers, get modalShows() { return modalShows; }, setMobile(value) { mobile = value; } };
}

test('mobile settings is a nonmodal page; the real tab bar stays accessible and only Settings is current', () => {
  const f = fixture();
  f.ctx.openSettingsDialog(f.refs.mobileSettingsButton);
  assert.equal(f.modalShows, 0);
  assert.equal(f.refs.settingsDialog.nonmodalShows, 1);
  assert.equal(f.refs.settingsDialog.attributes.get('role'), 'region');
  assert.equal(f.refs.mobileSettingsButton.attributes.get('aria-current'), 'page');
  assert.equal(f.refs.mobileSettingsButton.inert, false);
  assert.ok(f.links.every(link => !link.inert && !link.attributes.has('aria-current')));
  assert.ok(f.background.every(element => element.inert));
  assert.equal(f.refs.settingsTitle.focused, true);
  f.windowHandlers.scroll();
  f.frames.shift()();
  assert.equal(f.refs.mobileSettingsButton.attributes.get('aria-current'), 'page');
});

test('another tab closes settings immediately and restores background state without stealing the new tab selection', () => {
  const f = fixture();
  f.ctx.openSettingsDialog(f.refs.mobileSettingsButton);
  f.shell.scrollTop = 415;
  f.links[3].handlers.click();
  assert.equal(f.refs.settingsDialog.open, false);
  assert.equal(f.links[3].focused, true);
  assert.equal(f.state.settingsTabActive, false);
  assert.equal(f.state.skipSettingsFocusRestore, true);
  assert.equal(f.links[3].attributes.get('aria-current'), 'page');
  assert.equal(f.refs.mobileSettingsButton.attributes.has('aria-current'), false);
  assert.deepEqual(f.background.map(element => element.inert), [false, true, false]);
  assert.equal(f.body.classList.contains('settings-tab-active'), false);
  f.ctx.openSettingsDialog(f.refs.mobileSettingsButton);
  assert.equal(f.shell.scrollTop, 415);
});

test('desktop retains its modal settings panel', () => {
  const f = fixture({ mobile: false });
  f.ctx.openSettingsDialog(f.refs.accountButton);
  assert.equal(f.modalShows, 1);
  assert.equal(f.state.settingsTabActive, false);
  assert.equal(f.refs.settingsDialog.attributes.has('role'), false);
  assert.deepEqual(f.background.map(element => element.inert), [false, true, false]);
});

test('viewport mode changes wait for the child sheet, then preserve settings scroll position', () => {
  const f = fixture();
  f.ctx.openSettingsDialog(f.refs.mobileSettingsButton);
  f.shell.scrollTop = 320;
  f.refs.settingsPageDialog.open = true;
  f.setMobile(false);
  f.ctx.syncSettingsPresentation();
  assert.equal(f.state.settingsTabActive, true);
  f.refs.settingsPageDialog.open = false;
  f.ctx.syncSettingsPresentation();
  assert.equal(f.state.settingsTabActive, false);
  assert.equal(f.modalShows, 1);
  assert.equal(f.shell.scrollTop, 320);
  assert.equal(f.state.settingsIgnoredCloseEvents, 1);
  assert.equal(f.body.classList.contains('settings-tab-active'), false);
});


test('the queued native close event does not restore focus to Settings after selecting another tab', () => {
  const f = fixture();
  const start = source.indexOf('refs.settingsDialog.addEventListener("close"');
  vm.runInContext(source.slice(start, source.indexOf('refs.settingsFamilyAccount.addEventListener', start)), f.ctx);
  f.ctx.openSettingsDialog(f.refs.mobileSettingsButton);
  f.links[0].handlers.click();
  f.refs.settingsDialog.handlers.close();
  assert.equal(f.refs.mobileSettingsButton.focused, undefined);
  assert.equal(f.links[0].focused, true);
  assert.equal(f.links[0].attributes.get('aria-current'), 'page');
  assert.equal(f.state.skipSettingsFocusRestore, false);
});
