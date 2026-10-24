import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { renderReleaseHtml } from '../lib/release.ts';
import { GET } from '../app/api/version/route.ts';

const source = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const check = source.slice(source.indexOf('function viewedSiteRelease()'), source.indexOf('function setMobileNavigationTarget'));
const viewed = { version: '0.1.1', buildNumber: 1, releaseId: 'a'.repeat(64), builtAt: null };
async function checkVersion(response) {
  const refs = { refreshSiteVersion: { hidden: true }, settingsVersionStatus: {}, settingsDialog: { open: true } };
  const ctx = vm.createContext({ refs, state: { releaseCheckRequestId: 0 }, AbortController,
    document: { getElementById: () => ({ textContent: JSON.stringify(viewed) }) },
    window: { setTimeout: () => 1, clearTimeout() {} },
    fetch: async (_, options) => { assert.equal(options.cache, 'no-store'); if (response instanceof Error) throw response; return { ok: true, json: async () => response }; },
  });
  vm.runInContext(check, ctx);
  await ctx.checkSiteVersion();
  return { refs, snapshot: ctx.viewedSiteRelease() };
}

test('same identity confirms latest, while a newer identity offers reload without relabeling the old page', async () => {
  const same = await checkVersion(viewed);
  assert.equal(same.refs.settingsVersionStatus.textContent, '已是最新版。');
  assert.equal(same.refs.refreshSiteVersion.hidden, true);
  const newer = await checkVersion({ ...viewed, version: '0.1.2', releaseId: 'b'.repeat(64) });
  assert.match(newer.refs.settingsVersionStatus.textContent, /0\.1\.2/);
  assert.equal(newer.refs.refreshSiteVersion.hidden, false);
  assert.equal(newer.snapshot.version, '0.1.1');
  assert.equal(newer.snapshot.releaseId, viewed.releaseId);
});

test('offline and malformed responses never claim the page is latest', async () => {
  for (const response of [new Error('offline'), { version: '0.1.2' }]) {
    const result = await checkVersion(response);
    assert.match(result.refs.settingsVersionStatus.textContent, /無法確認/);
    assert.equal(result.refs.refreshSiteVersion.hidden, true);
    assert.equal(result.snapshot.version, '0.1.1');
  }
});

test('version endpoint is not cacheable and returns a valid build snapshot', async () => {
  const response = await GET();
  assert.match(response.headers.get('cache-control'), /no-store/);
  const payload = await response.json();
  assert.match(payload.version, /^\d+\.\d+\.\d+$/);
  assert.equal(typeof payload.buildNumber, 'number');
});

test('Worker HTML stamps visible version, build and all core asset URLs from the same snapshot', () => {
  const html = '<span id="settingsAppVersion">old</span><span id="settingsBuildNumber">old</span><script type="application/json" id="siteReleaseMetadata">{}</script><link href="/styles.css?v=old"><script src="/app.js"></script>';
  const result = renderReleaseHtml(html, viewed);
  assert.match(result, /settingsAppVersion">0\.1\.1/);
  assert.match(result, /settingsBuildNumber">1/);
  assert.ok(result.includes(JSON.stringify(viewed)));
  assert.ok(result.includes('/styles.css?v=' + viewed.releaseId.slice(0, 16)));
  assert.ok(result.includes('/app.js?v=' + viewed.releaseId.slice(0, 16)));
});
