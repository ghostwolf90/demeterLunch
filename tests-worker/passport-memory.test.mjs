import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE child_profiles(id INTEGER PRIMARY KEY, auth_user_id TEXT, school_id INTEGER);
    INSERT INTO child_profiles VALUES(1,'parent-a',193609),(2,'parent-a',64601),(3,'parent-b',64602);
    CREATE TABLE food_encounters(id INTEGER PRIMARY KEY, child_id INTEGER, auth_user_id TEXT,
    meal_date TEXT, school_id INTEGER, meal_type TEXT, meal_context TEXT, dish_name TEXT, food_name TEXT,
    experience TEXT, reactions TEXT, child_quote TEXT, first_encounter INTEGER, preparation TEXT, note TEXT, created_at TEXT);`);
  const db = { prepare(sql) { return { bind(...values) {
    const statement = sqlite.prepare(sql);
    return { first: async () => statement.get(...values) || null,
      all: async () => ({ results: statement.all(...values) }),
      run: async () => { const r = statement.run(...values); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; } };
  } }; } };
  const auth = {
    accountDatabase: () => db,
    getAccountUser: async request => request.headers.get('x-signed-out') ? null : { id: 'parent-a' },
    isSameOriginMutation: request => request.headers.get('origin') === 'https://haohaofood.cc',
    privateJson: (body, init = {}) => Response.json(body, { ...init, headers: { 'cache-control': 'private, no-store' } }),
    authRequired: () => new Response('', { status: 401 }), forbiddenMutation: () => new Response('', { status: 403 }),
  };
  const source = readFileSync(new URL('../app/api/account/encounters/route.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: () => auth, Response, Request, URL, console });
  function request(method, body, query = '', headers = {}) { return new Request(`https://haohaofood.cc/api/account/encounters${query}`, {
    method, headers: { origin: 'https://haohaofood.cc', 'content-type': 'application/json', ...headers },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
  }); }
  const base = { childId: 1, schoolId: 193609, mealDate: '2026-10-23', mealType: 'meat', mealContext: 'school_lunch', dishName: '香菇雞湯', foodName: '香菇', childQuote: '菇菇像雨傘' };
  return { sqlite, api: exports, request, base };
}
test('quote-only save roundtrips with unrecorded contact, private response and stable school', async () => {
  const { sqlite, api, request, base } = fixture();
  const response = await api.POST(request('POST', base));
  assert.equal(response.status, 201); assert.match(response.headers.get('cache-control'), /no-store/);
  const { encounter } = await response.json();
  assert.equal(encounter.experience, 'unrecorded'); assert.equal(encounter.childQuote, base.childQuote);
  sqlite.exec('UPDATE child_profiles SET school_id=64601 WHERE id=1');
  const loaded = await (await api.GET(request('GET', null, '?childId=1'))).json();
  assert.equal(loaded.encounters[0].schoolId, 193609);
  sqlite.close();
});
test('new records reject blank memories, invalid dates and another school', async () => {
  const { sqlite, api, request, base } = fixture();
  for (const changes of [{ childQuote: '  ' }, { mealDate: '2026-02-30' }, { schoolId: 64601 }, { childId: 3 }]) {
    const response = await api.POST(request('POST', { ...base, ...changes }));
    assert.ok([400, 404].includes(response.status));
  }
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM food_encounters').get().n, 0);
  sqlite.close();
});
test('ownership, explicit child and origin protect all mutations', async () => {
  const { sqlite, api, request, base } = fixture();
  const created = await (await api.POST(request('POST', base))).json();
  const id = created.encounter.id;
  assert.equal((await api.GET(request('GET', null))).status, 400);
  assert.equal((await api.GET(request('GET', null, '?childId=3'))).status, 404);
  for (const method of ['PATCH', 'DELETE']) {
    assert.equal((await api[method](request(method, { id, childId: 2, childQuote: '錯誤孩子' }))).status, 404);
    assert.equal((await api[method](request(method, { id, childId: 3 }))).status, 404);
    assert.equal((await api[method](request(method, { id, childId: 1 }, '', { origin: 'https://elsewhere.test' }))).status, 403);
    assert.equal((await api[method](request(method, { id, childId: 1 }, '', { 'x-signed-out': '1' }))).status, 401);
  }
  sqlite.close();
});
test('legacy edits never invent provenance; deletion removes record from subsequent reads', async () => {
  const { sqlite, api, request } = fixture();
  sqlite.exec(`INSERT INTO food_encounters(id,child_id,auth_user_id,meal_date,school_id,meal_type,meal_context,dish_name,food_name,experience,created_at)
    VALUES(1,1,'parent-a','2026-09-02',NULL,'meat','unknown',NULL,'香菇','unknown','2026-09-02');`);
  assert.equal((await api.PATCH(request('PATCH', { id: 1, childId: 1, childQuote: '修正原話', note: '我的觀察', experience: 'unrecorded', dishName: '猜測菜色', mealDate: '2026-10-23', schoolId: 193609 }))).status, 200);
  const loaded = await (await api.GET(request('GET', null, '?childId=1'))).json();
  assert.equal(loaded.encounters[0].mealDate, '2026-09-02');
  assert.equal(loaded.encounters[0].schoolId, null); assert.equal(loaded.encounters[0].dishName, null);
  assert.equal(loaded.encounters[0].childQuote, '修正原話'); assert.equal(loaded.encounters[0].note, '我的觀察');
  assert.equal((await api.DELETE(request('DELETE', { id: 1, childId: 1 }))).status, 200);
  const after = await (await api.GET(request('GET', null, '?childId=1'))).json(); assert.equal(after.encounterCount, 0);
  sqlite.close();
});
