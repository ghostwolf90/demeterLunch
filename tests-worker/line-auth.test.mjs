import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { DatabaseSync } from "node:sqlite";
import { lineAuthorizationUrl, oauthCookie, oauthDigest, randomOAuthValue, verifiedLineSubject } from "../lib/line-oauth.ts";

const subject = `U${"a".repeat(32)}`;
const origin = "https://haohaofood.cc";
const redirectUri = `${origin}/api/auth/line/callback`;
const config = { channelId: "2012225671", secret: "test-only", redirectUri };

function harness() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const name of readdirSync(new URL("../drizzle/", import.meta.url)).filter(x => x.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));
  }
  const db = {
    prepare(sql) {
      let params = [];
      const query = {
        bind(...values) { params = values; return query; },
        async first() { return sqlite.prepare(sql).get(...params) || null; },
        async all() { return { results: sqlite.prepare(sql).all(...params) }; },
        async run() { const result = sqlite.prepare(sql).run(...params); return { meta: { changes: Number(result.changes) } }; },
      };
      return query;
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try { const result = []; for (const statement of statements) result.push(await statement.run()); sqlite.exec("COMMIT"); return result; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  const env = { DB: db, LINE_CHANNEL_ID: config.channelId, LINE_CHANNEL_SECRET: config.secret,
    LINE_REDIRECT_URI: redirectUri, EMAIL_AUTH_SECRET: "test-secret", RESEND_API_KEY: "test-only", AUTH_EMAIL_FROM: "support@example.test" };
  let claimsNonce;
  let remoteCalls = 0;
  const fetcher = async (url, init) => {
    remoteCalls++;
    if (url.endsWith("/token")) return Response.json({ id_token: "verified-by-provider" });
    if (url.endsWith("/verify")) {
      claimsNonce = new URLSearchParams(init.body).get("nonce");
      return Response.json({ sub: subject, nonce: claimsNonce, aud: config.channelId, iss: "https://access.line.me", exp: Date.now() / 1000 + 600 });
    }
    return Response.json({ id: "mail-test" });
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const code = ts.transpileModule(readFileSync(new URL(`../${file}.ts`, import.meta.url), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} };
    cache.set(file, module.exports);
    const require = name => {
      if (name === "cloudflare:workers") return { env };
      if (name.startsWith("@/")) return load(name.slice(2));
      if (name === "./line-oauth") return load("lib/line-oauth");
      throw new Error(`Unexpected module ${name}`);
    };
    vm.runInNewContext(code, { module, exports: module.exports, require, crypto, btoa, URL, URLSearchParams,
      Request, Response, Headers, AbortSignal, TextEncoder, fetch: fetcher, console: { error() {} }, Date });
    return module.exports;
  }
  const auth = load("lib/account-auth");
  async function parent(id, email = null) {
    const now = new Date().toISOString();
    sqlite.prepare("INSERT INTO parent_accounts (auth_user_id,email,email_normalized,display_name,created_at,updated_at) VALUES (?,?,?,'家長',?,?)").run(id, email, email, now, now);
    const session = await auth.createSession();
    sqlite.prepare("INSERT INTO account_sessions VALUES (?,?,?,?)").run(session.tokenDigest, id, session.createdAt, session.expiresAt);
    return `${auth.SESSION_COOKIE}=${session.token}`;
  }
  function post(path, body, cookie = "", requestOrigin = origin) {
    return new Request(`${origin}${path}`, { method: "POST", headers: { origin: requestOrigin, cookie, "content-type": "application/json" }, body: JSON.stringify(body) });
  }
  async function begin(cookie = "", mode = "login") {
    const response = await load("app/api/auth/line/start/route").POST(post("/api/auth/line/start", { mode, birthDate: "1980-01-01", caregiverConfirmed: true }, cookie));
    assert.equal(response.status, 200);
    const authorization = new URL((await response.json()).url);
    const browserCookie = response.headers.get("set-cookie").split(";")[0];
    return { state: authorization.searchParams.get("state"), cookie: [cookie, browserCookie].filter(Boolean).join("; ") };
  }
  function callback(attempt, query = "code=test") {
    return load("app/api/auth/line/callback/route").GET(new Request(`${redirectUri}?state=${attempt.state}&${query}`, { headers: { cookie: attempt.cookie } }));
  }
  return { sqlite, env, auth, load, parent, post, begin, callback, calls: () => remoteCalls };
}

test("LINE authorization uses state, nonce, PKCE and minimum openid scope", async () => {
  const verifier = randomOAuthValue();
  assert.equal(verifier.length, 43);
  const url = new URL(lineAuthorizationUrl(config.channelId, redirectUri, "state", "nonce", await oauthDigest(verifier)));
  assert.equal(url.searchParams.get("scope"), "openid");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.match(oauthCookie(new Request(origin), verifier), /HttpOnly; SameSite=Lax; Max-Age=600; Secure/);
});

test("LINE token exchange rejects unverified, wrong-audience, wrong-nonce and expired claims", async () => {
  const valid = { sub: subject, nonce: "nonce", aud: config.channelId, iss: "https://access.line.me", exp: Date.now() / 1000 + 60 };
  for (const change of [{ aud: "other" }, { nonce: "wrong" }, { exp: 0 }, { iss: "https://attacker.test" }, { sub: "invalid" }]) {
    await assert.rejects(verifiedLineSubject({ code: "code", verifier: "v", nonce: "nonce", ...config }, async url =>
      Response.json(url.endsWith("/token") ? { id_token: "token" } : { ...valid, ...change })));
  }
  await assert.rejects(verifiedLineSubject({ code: "code", verifier: "v", nonce: "nonce", ...config }, async () => new Response(null, { status: 401 })));
});

test("LINE startup requires same origin, eligibility and configured callback", async () => {
  const h = harness();
  const start = h.load("app/api/auth/line/start/route").POST;
  assert.equal((await start(h.post("/api/auth/line/start", { mode: "login" }))).status, 400);
  assert.equal((await start(h.post("/api/auth/line/start", { mode: "link" }))).status, 401);
  assert.equal((await start(h.post("/api/auth/line/start", {}, "", "https://attacker.test"))).status, 403);
  h.env.LINE_REDIRECT_URI = "https://attacker.test/api/auth/line/callback";
  assert.equal((await start(h.post("/api/auth/line/start", { mode: "login" }))).status, 503);
});

test("LINE creates email-less session, preserves profile on returning login, and prevents replay", async () => {
  const h = harness();
  const attempt = await h.begin();
  const response = await h.callback(attempt);
  assert.match(response.headers.get("location"), /line=success/);
  const cookie = response.headers.getSetCookie().find(x => x.startsWith("demeter_family_session=")).split(";")[0];
  const user = await h.auth.getAccountUser(new Request(origin, { headers: { cookie } }));
  assert.ok(user);
  assert.equal(user.email, null);
  h.sqlite.prepare("UPDATE parent_accounts SET display_name='本名', nickname='暱稱' WHERE auth_user_id=?").run(user.id);
  assert.match((await h.callback(attempt)).headers.get("location"), /line=expired/);
  assert.match((await h.callback(await h.begin())).headers.get("location"), /line=success/);
  assert.equal(h.sqlite.prepare("SELECT count(*) AS count FROM parent_accounts").get().count, 1);
  assert.equal(h.sqlite.prepare("SELECT display_name FROM parent_accounts").get().display_name, "本名");
});

test("LINE callback rejects wrong browser, expired or cancelled attempts before provider exchange", async () => {
  const h = harness();
  const attempt = await h.begin();
  assert.match((await h.callback({ ...attempt, cookie: "" })).headers.get("location"), /line=expired/);
  assert.equal(h.calls(), 0);
  assert.match((await h.callback(attempt, "error=access_denied")).headers.get("location"), /line=cancelled/);
  const expired = await h.begin();
  h.sqlite.prepare("UPDATE oauth_challenges SET expires_at='2000-01-01'").run();
  assert.match((await h.callback(expired)).headers.get("location"), /line=expired/);
  assert.equal(h.calls(), 0);
});

test("Email family can bind LINE; another family and changed sessions cannot claim it", async () => {
  const h = harness();
  const cookie = await h.parent("email_parent", "parent@example.test");
  assert.match((await h.callback(await h.begin(cookie, "link"))).headers.get("location"), /line=linked/);
  const second = await h.parent("other", "other@example.test");
  assert.match((await h.callback(await h.begin(second, "link"))).headers.get("location"), /line=conflict/);
  const pending = await h.begin(cookie, "link");
  assert.match((await h.callback({ ...pending, cookie: pending.cookie.replace(cookie, second) })).headers.get("location"), /line=expired/);
  assert.equal(h.sqlite.prepare("SELECT auth_user_id FROM account_identities").get().auth_user_id, "email_parent");
});

test("LINE family can verify and bind Email to the same account; OTP cannot be replayed", async () => {
  const h = harness();
  const cookie = await h.parent("line_parent");
  const request = h.load("app/api/auth/request-code/route").POST;
  const verify = h.load("app/api/auth/verify-code/route").POST;
  const response = await request(h.post("/api/auth/request-code", { purpose: "link_email", email: "parent@example.test" }, cookie));
  assert.equal(response.status, 200);
  const { challengeId } = await response.json();
  const digest = await h.auth.digestVerificationCode(challengeId, "parent@example.test", "123456");
  h.sqlite.prepare("UPDATE email_auth_challenges SET code_digest=? WHERE id=?").run(digest, challengeId);
  assert.equal((await verify(h.post("/api/auth/verify-code", { challengeId, code: "000000" }, cookie))).status, 400);
  assert.equal((await verify(h.post("/api/auth/verify-code", { challengeId, code: "123456" }))).status, 403);
  const verified = await verify(h.post("/api/auth/verify-code", { challengeId, code: "123456" }, cookie));
  assert.equal((await verified.json()).linkedEmail, true);
  assert.equal(h.sqlite.prepare("SELECT email FROM parent_accounts WHERE auth_user_id='line_parent'").get().email, "parent@example.test");
  assert.equal(h.sqlite.prepare("SELECT count(*) AS count FROM parent_accounts").get().count, 1);
  assert.equal((await verify(h.post("/api/auth/verify-code", { challengeId, code: "123456" }, cookie))).status, 410);
});

test("Email linking refuses an address owned by another family without merging", async () => {
  const h = harness();
  const cookie = await h.parent("line_parent");
  await h.parent("existing", "existing@example.test");
  const response = await h.load("app/api/auth/request-code/route").POST(h.post("/api/auth/request-code", { purpose: "link_email", email: "existing@example.test" }, cookie));
  assert.equal(response.status, 409);
  assert.equal(h.sqlite.prepare("SELECT email FROM parent_accounts WHERE auth_user_id='line_parent'").get().email, null);
});

test("Email sign-in after LINE email linking returns the existing family account", async () => {
  const h = harness();
  await h.parent("line_family", "parent@example.test");
  h.sqlite.prepare("INSERT INTO account_identities VALUES ('line',?,'line_family',?)").run(subject, new Date().toISOString());
  const sent = await h.load("app/api/auth/request-code/route").POST(h.post("/api/auth/request-code", {
    email: "parent@example.test", birthDate: "1980-01-01", caregiverConfirmed: true,
  }));
  const { challengeId } = await sent.json();
  h.sqlite.prepare("UPDATE email_auth_challenges SET code_digest=? WHERE id=?")
    .run(await h.auth.digestVerificationCode(challengeId, "parent@example.test", "123456"), challengeId);
  const response = await h.load("app/api/auth/verify-code/route").POST(h.post("/api/auth/verify-code", { challengeId, code: "123456" }));
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie").split(";")[0];
  assert.equal((await h.auth.getAccountUser(new Request(origin, { headers: { cookie } }))).id, "line_family");
  assert.equal(h.sqlite.prepare("SELECT count(*) AS count FROM parent_accounts").get().count, 1);
});

test("Email claimed by another family during verification cannot be linked", async () => {
  const h = harness();
  const cookie = await h.parent("line_parent");
  const response = await h.load("app/api/auth/request-code/route").POST(h.post("/api/auth/request-code", { purpose: "link_email", email: "parent@example.test" }, cookie));
  const { challengeId } = await response.json();
  h.sqlite.prepare("UPDATE email_auth_challenges SET code_digest=? WHERE id=?")
    .run(await h.auth.digestVerificationCode(challengeId, "parent@example.test", "123456"), challengeId);
  await h.parent("another_family", "parent@example.test");
  const verified = await h.load("app/api/auth/verify-code/route").POST(h.post("/api/auth/verify-code", { challengeId, code: "123456" }, cookie));
  assert.equal(verified.status, 409);
  assert.equal(h.sqlite.prepare("SELECT email FROM parent_accounts WHERE auth_user_id='line_parent'").get().email, null);
});

const uiSource = readFileSync(new URL("../web/app.js", import.meta.url), "utf8");
test("LINE choice needs no email; returning restores the email entry and disables hidden required fields", () => {
  const refs = Object.fromEntries(["authEligibilityGate", "authBirthDate", "authCaregiverConfirmed", "emailEntryFields", "authEmail", "requestAuthCode", "continueLineAuth", "authRequestStatus"].map(key => [key, { focus() {} }]));
  const context = vm.createContext({ refs, setFormStatus() {}, renderEmailAuthStep() {} });
  const start = uiSource.indexOf("function chooseAuthMethod(");
  vm.runInContext(uiSource.slice(start, uiSource.indexOf("function resetEmailAuthForm(", start)), context);
  context.chooseAuthMethod("line");
  assert.equal(refs.authEmail.disabled, true);
  assert.equal(refs.continueLineAuth.hidden, false);
  assert.equal(refs.authBirthDate.disabled, false);
  context.resetAuthMethod();
  assert.equal(refs.authEmail.disabled, false);
  assert.equal(refs.authEligibilityGate.hidden, true);
  assert.equal(refs.authBirthDate.disabled, true);
});
