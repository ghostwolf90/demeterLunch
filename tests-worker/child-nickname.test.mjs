import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';

function fixture(onboarding = 'completed') {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(x => x.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), 'utf8'));
  }
  sqlite.prepare("INSERT INTO parent_accounts(auth_user_id,email,email_normalized,display_name,plan,onboarding_status,created_at,updated_at) VALUES('owner','p@example.test','p@example.test','家長','free',?,'now','now')").run(onboarding);
  const db = { prepare(sql) {
    let params = [];
    const query = { bind(...values) { params = values; return query; },
      async first() { return sqlite.prepare(sql).get(...params) || null; },
      async run() { const result = sqlite.prepare(sql).run(...params); return { meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } }; } };
    return query;
  }, async batch(statements) { const results = []; for (const statement of statements) results.push(await statement.run()); return results; } };
  const auth = { accountDatabase: () => db, getAccountUser: async () => ({ id: 'owner', email: 'p@example.test', displayName: '家長' }), isSameOriginMutation: () => true,
    privateJson: (body, init) => Response.json(body, init), authRequired() {}, forbiddenMutation() {} };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const source = readFileSync(new URL(`../${file}.ts`, import.meta.url), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} };
    vm.runInNewContext(js, { module, exports: module.exports, Response, Date, console,
      require(name) {
        if (name === '@/lib/account-auth') return auth;
        if (name === '@/lib/schools') return { findSchool: id => id === 193609 ? { id } : null };
        return load(name.replace('@/', ''));
      } });
    cache.set(file, module.exports); return module.exports;
  }
  const route = load('app/api/account/child/route');
  const post = body => route.POST(new Request('https://haohaofood.cc/api/account/child', { method: 'POST', body: JSON.stringify({ schoolId: 193609, allergenCodes: [], ...body }) }));
  return { sqlite, post };
}

test('nickname alone creates a child with a genuinely empty real-name column', async () => {
  for (const onboarding of [false, true]) {
    const h = fixture(onboarding ? 'pending' : 'completed');
    const response = await h.post({ nickname: ' 小禾 ', onboarding, name: '不應收集的本名' });
    assert.equal(response.status, 201);
    const child = h.sqlite.prepare('SELECT name,nickname,school_id FROM child_profiles').get();
    assert.equal(child.name, null);
    assert.equal(child.nickname, '小禾');
    assert.equal(child.school_id, 193609);
    if (onboarding) assert.equal((await response.json()).onboardingCompleted, true);
    h.sqlite.close();
  }
});

test('editing a nickname preserves the stored real name and rejects another owner’s child', async () => {
  const h = fixture();
  h.sqlite.exec("INSERT INTO parent_accounts(auth_user_id,email,email_normalized,display_name,plan,created_at,updated_at) VALUES('someone-else','other@example.test','other@example.test','他人','free','now','now'); INSERT INTO child_profiles(id,auth_user_id,name,nickname,grade_group,school_id,created_at,updated_at) VALUES(1,'owner','保留的本名','舊暱稱','not_set',193609,'now','now'),(2,'someone-else','他人本名','他人暱稱','not_set',193609,'now','now')");
  assert.equal((await h.post({ childId: 1, nickname: '新暱稱', name: '覆寫嘗試' })).status, 200);
  assert.deepEqual({ ...h.sqlite.prepare('SELECT name,nickname FROM child_profiles WHERE id=1').get() }, { name: '保留的本名', nickname: '新暱稱' });
  assert.equal((await h.post({ childId: 2, nickname: '更改' })).status, 404);
  assert.equal(h.sqlite.prepare('SELECT nickname FROM child_profiles WHERE id=2').get().nickname, '他人暱稱');
  h.sqlite.close();
});

test('blank, missing and overlong nicknames cannot create a child', async () => {
  const h = fixture();
  for (const nickname of [undefined, '', '  ', '字'.repeat(21)]) assert.equal((await h.post({ nickname })).status, 400);
  assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS count FROM child_profiles').get().count, 0);
  h.sqlite.close();
});

test('child display uses a nickname without inventing a real name for new or legacy profiles', () => {
  const source = readFileSync(new URL('../app/api/account/route.ts', import.meta.url), 'utf8');
  const fn = source.slice(source.indexOf('function publicChild('), source.indexOf('\nfunction avatarUrl('));
  const js = ts.transpileModule(fn, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = vm.createContext({ parseStoredAllergenCodes: () => [] });
  vm.runInContext(js, context);
  for (const name of [null, '已保存本名']) {
    const result = context.publicChild({ id: 1, name, nickname: '小禾' });
    assert.equal(result.name, name); assert.equal(result.nickname, '小禾'); assert.equal(result.displayName, '小禾');
  }
  assert.equal(context.publicChild({ name: '不顯示本名', nickname: '' }).displayName, '孩子');
});
