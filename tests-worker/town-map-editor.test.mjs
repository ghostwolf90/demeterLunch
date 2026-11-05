import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { DatabaseSync } from "node:sqlite";

function harness() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync(new URL("../drizzle/", import.meta.url)).filter((name) => name.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8"));
  }
  const env = {
    DB: { prepare(sql) { let params = []; const query = {
      bind(...values) { params = values; return query; },
      async first() { return sqlite.prepare(sql).get(...params) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...params) }; },
      async run() {
        const result = sqlite.prepare(sql).run(...params);
        return { meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
      },
    }; return query; } },
    EMAIL_AUTH_SECRET: "test",
    MAINTENANCE_API_TOKEN: "test-maintenance-token-with-32-characters",
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    if (file.endsWith(".json")) {
      const value = JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
      cache.set(file, value);
      return value;
    }
    const code = ts.transpileModule(readFileSync(new URL(`../${file}.ts`, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, resolveJsonModule: true },
    }).outputText;
    const module = { exports: {} };
    cache.set(file, module.exports);
    vm.runInNewContext(code, {
      module,
      exports: module.exports,
      require(name) { return name === "cloudflare:workers" ? { env } : load(name.slice(2)); },
      crypto, TextEncoder, btoa, Date, Intl, URL, Response, Request, Headers, console: { error() {} },
    });
    return module.exports;
  }
  const request = (body, token = "Bearer test-maintenance-token-with-32-characters", suffix = "") => new Request(
    `https://haohaofood.cc/api/internal/operations/town-map${suffix}`,
    { headers: { authorization: token, origin: "https://haohaofood.cc", "content-type": "application/json" }, ...(body ? { method: "POST", body: JSON.stringify(body) } : {}) },
  );
  return {
    sqlite,
    library: load("lib/town-map-editor"),
    route: load("app/api/internal/operations/town-map/route"),
    publicRoute: load("app/api/lunch-town/map/route"),
    previewRoute: load("app/api/lunch-town/map/preview/route"),
    request,
  };
}

const manifest = {
  schemaVersion: 1,
  placements: [{
    id: "west-family-cafe",
    city: "臺中市",
    district: "西區",
    type: "restaurant",
    label: "家庭小食堂",
    labelEn: "Family Table",
    description: "居民會來交換晚餐靈感的小食堂。",
    descriptionEn: "A neighborhood table for sharing dinner ideas.",
    x: 0.05,
    y: 0.75,
    w: 0.18,
    h: 0.14,
  }],
  npcs: [{
    id: "west-editor-resident",
    city: "臺中市",
    district: "西區",
    name: "小禾",
    nameEn: "Xiao-He",
    role: "community-resident",
    gender: "female",
    primaryVenueId: "west-family-cafe",
  }],
};

test("town map manifest validates bilingual buildings, NPC venues and safe placement lanes", () => {
  const { library } = harness();
  assert.deepEqual(JSON.parse(JSON.stringify(library.parseTownMapManifest(manifest))), manifest);
  assert.throws(() => library.parseTownMapManifest({ ...manifest, placements: [{ ...manifest.placements[0], y: 0.4 }] }), /編輯街廓/);
  assert.throws(() => library.parseTownMapManifest({ ...manifest, npcs: [{ ...manifest.npcs[0], primaryVenueId: "missing-place" }] }), /同一行政區/);
  assert.throws(() => library.parseTownMapManifest({ ...manifest, placements: [manifest.placements[0], { ...manifest.placements[0], id: "overlap-place", x: 0.1 }] }), /重疊/);
  const catalog = library.townMapEditorCatalog();
  assert.deepEqual(Array.from(catalog.cities, (city) => city.name), ["臺中市", "苗栗縣", "彰化縣"]);
  assert.equal(catalog.cities.find((city) => city.name === "彰化縣").districts.length, 26);
  const preview = library.parseTownMapEditorInput({
    action: "preview",
    revision: 0,
    manifest,
    focus: { city: "臺中市", district: "西區", placementId: "west-family-cafe" },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(preview.focus)), { city: "臺中市", district: "西區", placementId: "west-family-cafe" });
  assert.throws(() => library.parseTownMapEditorInput({
    action: "preview",
    revision: 0,
    manifest,
    focus: { city: "臺中市", district: "西區", placementId: "missing-place" },
  }), /不在所選行政區/);
});

test("short-lived draft previews open the real map without publishing a revision", async () => {
  const h = harness();
  const response = await h.route.POST(h.request({
    action: "preview",
    revision: 0,
    manifest,
    focus: { city: "臺中市", district: "西區", placementId: "west-family-cafe" },
  }));
  assert.equal(response.status, 200);
  const created = await response.json();
  assert.match(created.previewToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(created.focus.placementId, "west-family-cafe");
  assert.equal(h.sqlite.prepare("SELECT COUNT(*) AS count FROM town_map_revisions").get().count, 0);
  assert.equal((await (await h.publicRoute.GET()).json()).manifest.placements.length, 0);
  const stored = h.sqlite.prepare("SELECT token_hash, expires_at FROM town_map_previews").get();
  assert.notEqual(stored.token_hash, created.previewToken);
  assert.ok(stored.expires_at > new Date().toISOString());

  const previewRequest = () => new Request("https://haohaofood.cc/api/lunch-town/map/preview", {
    method: "POST",
    headers: { origin: "https://haohaofood.cc", "content-type": "application/json" },
    body: JSON.stringify({ token: created.previewToken }),
  });
  const previewResponse = await h.previewRoute.POST(previewRequest());
  assert.equal(previewResponse.status, 200);
  assert.match(previewResponse.headers.get("cache-control"), /no-store/);
  assert.equal(previewResponse.headers.get("referrer-policy"), "no-referrer");
  const preview = await previewResponse.json();
  assert.equal(preview.preview, true);
  assert.equal(preview.focus.district, "西區");
  assert.equal(preview.manifest.placements[0].label, "家庭小食堂");

  h.sqlite.prepare("UPDATE town_map_previews SET expires_at = ?").run("2000-01-01T00:00:00.000Z");
  assert.equal((await h.previewRoute.POST(previewRequest())).status, 410);
  const invalid = new Request("https://haohaofood.cc/api/lunch-town/map/preview", {
    method: "POST",
    headers: { origin: "https://haohaofood.cc", "content-type": "application/json" },
    body: JSON.stringify({ token: "invalid" }),
  });
  assert.equal((await h.previewRoute.POST(invalid)).status, 400);
});

test("town map drafts stay private until a validated revision is published", async () => {
  const h = harness();
  assert.equal((await h.route.GET(h.request(null, "Bearer wrong"))).status, 403);
  const initial = await (await h.route.GET(h.request())).json();
  assert.equal(initial.revision, 0);
  assert.equal(initial.manifest.placements.length, 0);
  assert.equal((await h.route.POST(h.request({ action: "save", revision: 0, manifest }))).status, 200);
  assert.equal((await (await h.publicRoute.GET()).json()).manifest.placements.length, 0);
  assert.equal((await h.route.POST(h.request({ action: "publish", revision: 1, manifest }))).status, 200);
  const publishedResponse = await h.publicRoute.GET();
  assert.match(publishedResponse.headers.get("cache-control"), /no-store/);
  const published = await publishedResponse.json();
  assert.equal(published.revision, 2);
  assert.equal(published.manifest.placements[0].labelEn, "Family Table");
  assert.equal((await h.route.POST(h.request({ action: "save", revision: 1, manifest }))).status, 409);
  const historical = await (await h.route.GET(h.request(null, undefined, "?revision=1"))).json();
  assert.equal(historical.action, "save");
  assert.equal(historical.manifest.npcs[0].name, "小禾");
  assert.equal(h.sqlite.prepare("SELECT COUNT(*) AS count FROM town_map_revisions").get().count, 2);
});
