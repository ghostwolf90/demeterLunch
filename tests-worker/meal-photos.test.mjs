import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source = readFileSync(new URL('../web/meal-photos.js', import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
function setup({ delayed = false, lazy = false } = {}) {
  const calls = []; const revoked = []; let resolveFetch; let observer;
  const context = vm.createContext({ Map, Set, Date, AbortController, encodeURIComponent,
    URL: { createObjectURL: () => `blob:photo-${calls.length}`, revokeObjectURL: url => revoked.push(url) },
    fetch(url, options) {
      calls.push({ url, options });
      return delayed ? new Promise(resolve => { resolveFetch = resolve; }) : Promise.resolve(response());
    },
    ...(lazy ? { IntersectionObserver: class {
      constructor(callback) { observer = { callback, observed: new Set() }; }
      observe(image) { observer.observed.add(image); }
      unobserve(image) { observer.observed.delete(image); }
    } } : {}),
  });
  vm.runInContext(source, context);
  return { api: context.MealPhotos, calls, revoked,
    resolve() { resolveFetch(response()); }, observer: () => observer };
}
function response() { return { ok: true, headers: new Headers({ 'content-type': 'image/jpeg' }), blob: async () => new Blob(['photo'], { type: 'image/jpeg' }) }; }

test('concurrent thumbnails and detail share one request; later date revisits use memory without an API call', async () => {
  const { api, calls, resolve } = setup({ delayed: true });
  const first = {}, detail = {}, revisit = {};
  api.attach(first, '123'); api.attach(detail, '123');
  assert.equal(calls.length, 1); assert.equal(calls[0].options.credentials, 'omit');
  resolve(); await flush();
  assert.ok(first.src.startsWith('blob:')); assert.equal(first.src, detail.src);
  api.attach(revisit, '123');
  assert.equal(revisit.src, first.src); assert.equal(calls.length, 1);
});
test('old date requests abort only after the last image subscriber leaves', async () => {
  const { api, calls, resolve } = setup({ delayed: true });
  const first = {}, second = {};
  const leaveFirst = api.attach(first, '123'); const leaveSecond = api.attach(second, '123');
  leaveFirst(); assert.equal(calls[0].options.signal.aborted, false);
  leaveSecond(); assert.equal(calls[0].options.signal.aborted, true);
  resolve(); await flush(); assert.equal(first.src, undefined); assert.equal(second.src, undefined);
});
test('offscreen images wait, and cancelled offscreen images never request the API', async () => {
  const { api, calls, observer } = setup({ lazy: true });
  const first = { loading: 'lazy' }, second = { loading: 'lazy' };
  const leave = api.attach(first, '123'); api.attach(second, '124');
  assert.equal(calls.length, 0); leave();
  observer().callback([{ target: first, isIntersecting: true }, { target: second, isIntersecting: true }]);
  await flush(); assert.equal(calls.length, 1); assert.match(calls[0].url, /124$/);
});
test('cache is bounded and revokes evicted object URLs', async () => {
  const { api, calls, revoked } = setup();
  for (let id = 1; id <= 33; id++) { api.attach({}, String(id)); await flush(); }
  assert.equal(revoked.length, 1);
  api.attach({}, '33'); assert.equal(calls.length, 33);
  api.attach({}, '1'); await flush(); assert.equal(calls.length, 34);
});
