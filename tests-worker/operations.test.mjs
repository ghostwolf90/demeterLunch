import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';
function harness() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(f => f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), 'utf8'));
  const env = { DB: { prepare(sql) { let params = []; const q = {
    bind(...p) { params = p; return q; },
    async first() { return sqlite.prepare(sql).get(...params) || null; },
    async all() { return { results: sqlite.prepare(sql).all(...params) }; },
    async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...params).changes) } }; },
  }; return q; } }, EMAIL_AUTH_SECRET: 'test', MAINTENANCE_API_TOKEN: 'test-maintenance-token-with-32-characters' };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const code = ts.transpileModule(readFileSync(new URL(`../${file}.ts`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} }; cache.set(file, module.exports);
    vm.runInNewContext(code, { module, exports: module.exports, require(name) { return name === 'cloudflare:workers' ? { env } : load(name.slice(2)); }, crypto, TextEncoder, btoa, Date, Intl, URL, Response, Request, Headers, console: { error() {} } });
    return module.exports;
  }
  async function parent(id, email) {
    const now = new Date().toISOString();
    sqlite.prepare('INSERT INTO parent_accounts (auth_user_id,email,created_at,updated_at) VALUES (?,?,?,?)').run(id,email,now,now);
    const auth = load('lib/account-auth'), s = await auth.createSession();
    sqlite.prepare('INSERT INTO account_sessions VALUES (?,?,?,?)').run(s.tokenDigest,id,s.createdAt,s.expiresAt);
    return `${auth.SESSION_COOKIE}=${s.token}`;
  }
  const request = (cookie = '', body, origin = 'https://haohaofood.cc') => new Request('https://haohaofood.cc/api/operations', { headers: { authorization: cookie, origin, 'content-type': 'application/json' }, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
  return { sqlite, load, parent, request, route: load('app/api/internal/operations/route'), publicRoute: load('app/api/maintenance/route') };
}
const ownerToken = 'Bearer test-maintenance-token-with-32-characters';
const notice = { action: 'publish', title: '教育部來源異常', body: '<script>alert(1)</script>\n請確認供餐日期', severity: 'warning', revision: 0 };
test('operations requires its separate service credential; family cookies grant no access', async () => {
  const h = harness();
  assert.equal((await h.route.GET(h.request())).status, 403);
  const cookie = await h.parent('owner', 'ghostwolf90@gmail.com');
  assert.equal((await h.route.GET(h.request(cookie))).status, 403);
  assert.equal((await h.route.POST(h.request(cookie, notice))).status, 403);
  assert.equal((await h.route.GET(h.request('Bearer wrong-token'))).status,403);
});
test('draft, publish, edit draft, stale write and withdrawal preserve public lifecycle and history', async () => {
  const h = harness(), cookie = ownerToken;
  const post = data => h.route.POST(h.request(cookie,data));
  assert.equal((await post({ ...notice, action: 'save' })).status, 200);
  assert.equal((await (await h.publicRoute.GET()).json()).announcement, null);
  assert.equal((await post({ ...notice, revision: 1 })).status, 200);
  const publicResponse = await h.publicRoute.GET();
  assert.match(publicResponse.headers.get('cache-control'), /no-store/);
  const published = (await publicResponse.json()).announcement;
  assert.equal(published.title, notice.title); assert.equal('actor_id' in published, false);
  assert.equal((await post({ ...notice, action: 'save', title: '草稿', revision: 2 })).status, 200);
  assert.equal((await (await h.publicRoute.GET()).json()).announcement.title, notice.title);
  assert.equal((await post({ ...notice, revision: 2 })).status, 409);
  assert.equal((await post({ ...notice, action: 'withdraw', revision: 3 })).status, 200);
  assert.equal((await (await h.publicRoute.GET()).json()).announcement, null);
  assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM maintenance_events').get().n, 4);
});
test('operations rejects CSRF, missing origin, malformed and oversized notices', async () => {
  const h = harness(), cookie = ownerToken;
  for (const origin of ['https://attacker.test', 'null', '']) assert.equal((await h.route.POST(h.request(cookie,notice,origin))).status, 403);
  for (const change of [{title:''},{title:'x'.repeat(81)},{body:'x'.repeat(2001)},{severity:'bad'},{action:'delete'},{revision:-1}]) assert.equal((await h.route.POST(h.request(cookie,{...notice,...change}))).status,400);
});
test('overview returns aggregate facts without parent or child personal records', async () => {
  const h = harness(), cookie = ownerToken;
  await h.parent('owner','ghostwolf90@gmail.com');
  await h.parent('other','private@example.com');
  const response = await h.route.GET(h.request(cookie));
  assert.equal(response.status,200); assert.match(response.headers.get('cache-control'),/no-store/);
  const data = await response.json();
  assert.equal(data.accounts.total,2); assert.equal(data.accounts.today,2); assert.equal(data.accounts.paid,0);
  assert.equal(data.usage.recentSignIns,2); assert.equal(data.usage.children,0);
  assert.equal(JSON.stringify(data).includes('private@example.com'), false);
});
