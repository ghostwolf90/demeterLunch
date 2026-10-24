import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { dishPhoto } from "../lib/dish-photo.ts";

const source = readFileSync(new URL("../web/app.js", import.meta.url), "utf8");
class Element {
  children = []; hidden = false; attributes = {}; childNodes = [];
  classes = new Set();
  classList = { add: value => this.classes.add(value), remove: value => this.classes.delete(value) };
  append(...children) { children.forEach(child => { child.parentElement = this; }); this.children.push(...children); }
  querySelector(selector) { return this.children.find(child => child.className === selector.slice(1)); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); }
  replaceChildren(...children) { this.children = children; }
  get firstElementChild() { return this.children[0]; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener() {}
}
function ui() {
  const refs = new Proxy({}, { get(target, key) { return target[key] ||= new Element(); } });
  const state = { activeDishIndex: 0, mealType: "meat" };
  const context = vm.createContext({ refs, state, URL, encodeURIComponent,
    document: { createElement: () => new Element() },
    LunchI18n: { keep: x => x }, roleLabels: {},
    renderAllergenNotice() {},
    node(tag, className, text) { const element = new Element(); element.className = className; element.textContent = text; return element; },
  });
  vm.runInContext(source.slice(source.indexOf("function renderMeal("), source.indexOf("function renderDishDetail(")), context);
  return { refs, state, context };
}
const photo = "https://fatraceschool.k12ea.gov.tw/dish/pic/1792636821055976";
const day = { date: "2026-10-22", meal: { mainDish: "蔥燒鮮菇豬柳" }, allergens: [], recipeDetails: [{ name: "蔥燒鮮菇豬柳", role: "main" }] };
const record = { mealDate: day.date, meals: [{ dishes: [{ name: day.meal.mainDish, imageUrl: photo }] }] };

test("weekly menu passes the exact same-day dish photo through to a same-origin image", () => {
  const { refs, state, context } = ui();
  context.renderMeal(day, { photoRecord: record });
  assert.equal(state.dishDetails[0].officialPhotoUrl, photo);
  assert.equal(refs.mainDishButton.querySelector(".meal-photo").src, "/api/dish-photo?dishId=1792636821055976");
  context.renderDishPhoto(state.dishDetails[0]);
  const image = refs.dishDetailPhoto.firstElementChild;
  assert.equal(image.src, "/api/dish-photo?dishId=1792636821055976");
  assert.equal(refs.dishDetailPhoto.hidden, false);
  assert.equal(image.hidden, true);
  image.naturalWidth = 1280; image.onload();
  assert.equal(image.hidden, false);
  assert.equal(refs.dishDetailPhoto.children[1].hidden, true);
});
test("menu thumbnails fail gracefully and stale callbacks cannot change a new selection", () => {
  const { refs, context } = ui();
  const container = refs.mainDishButton;
  const dish = { officialRecord: true, imageUrl: photo };
  context.renderMenuPhoto(container, dish, { eager: true });
  const first = container.querySelector(".meal-photo");
  assert.equal(first.alt, "");
  assert.equal(first.loading, "eager");
  context.renderMenuPhoto(container, dish);
  const second = container.querySelector(".meal-photo");
  first.onerror();
  assert.ok(container.classes.has("has-photo"));
  second.onload();
  assert.ok(second.classes.has("is-loaded"));
  second.onerror();
  assert.equal(container.querySelector(".meal-photo"), undefined);
  assert.equal(container.classes.has("has-photo"), false);
  context.renderMenuPhoto(container, null);
  assert.equal(container.children.length, 0);
});
test("different dates, different dish names and ambiguous matches never supply a photo", () => {
  const { state, context } = ui();
  for (const r of [null, { ...record, mealDate: "2026-10-21" },
    { ...record, meals: [{ dishes: [{ name: "另一道菜", imageUrl: photo }] }] },
    { ...record, meals: [{ dishes: [record.meals[0].dishes[0], record.meals[0].dishes[0]] }] }]) {
    context.renderMeal(day, { photoRecord: r });
    assert.equal(state.dishDetails[0].officialPhotoUrl, null);
  }
});
test("official daily photos, failures, missing URLs and stale callbacks are handled", () => {
  const { refs, context } = ui();
  context.renderDishPhoto({ officialRecord: true, imageUrl: photo, name: "主菜" });
  const first = refs.dishDetailPhoto.firstElementChild;
  context.renderDishPhoto({ officialRecord: true, imageUrl: photo + "1", name: "配菜" });
  const second = refs.dishDetailPhoto.firstElementChild;
  first.naturalWidth = 640; first.onload(); first.onerror();
  assert.equal(second.hidden, true);
  second.onerror();
  assert.equal(refs.dishDetailPhoto.hidden, false);
  assert.match(refs.dishDetailPhoto.children[1].textContent, /暫時無法載入/);
  context.renderDishPhoto({ officialRecord: true });
  assert.equal(refs.dishDetailPhoto.hidden, false);
  assert.match(refs.dishDetailPhoto.firstElementChild.textContent, /尚無/);
  for (const imageUrl of ["bad", "https://example.com/dish/pic/123"]) {
    context.renderDishPhoto({ officialRecord: true, imageUrl });
    assert.equal(refs.dishDetailPhoto.hidden, true);
    assert.equal(refs.dishDetailPhoto.children.length, 0);
  }
});
test("vegetarian marker prefix is matched only in the vegetarian meal", () => {
  const { state, context } = ui();
  const r = { ...record, meals: [{ dishes: [{ name: `素${day.meal.mainDish}`, imageUrl: photo }] }] };
  context.renderMeal(day, { photoRecord: r });
  assert.equal(state.dishDetails[0].officialPhotoUrl, null);
  state.mealType = "vegetarian";
  context.renderMeal(day, { photoRecord: r });
  assert.equal(state.dishDetails[0].officialPhotoUrl, photo);
});
test("photo delivery restricts IDs, validates image bytes and does not forward upstream cookies", async () => {
  const original = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(url, "https://fatraceschool.k12ea.gov.tw/dish/pic/123");
      assert.ok(options.signal);
      return new Response(new Uint8Array([255,216,255,217]), { headers: { "content-type": "image/jpeg", "set-cookie": "private=1" } });
    };
    assert.equal((await dishPhoto(new Request("https://example.com/api/dish-photo?dishId=../123"))).status, 400);
    assert.equal(calls, 0);
    const result = await dishPhoto(new Request("https://example.com/api/dish-photo?dishId=123"));
    assert.equal(result.status, 200);
    assert.equal(result.headers.get("set-cookie"), null);
    assert.equal(result.headers.get("content-type"), "image/jpeg");
    globalThis.fetch = async () => new Response("not an image", { headers: { "content-type": "image/jpeg" } });
    const fallback = await dishPhoto(new Request("https://example.com/api/dish-photo?dishId=123"));
    assert.equal(fallback.status, 302);
    assert.equal(fallback.headers.get("location"), "https://fatraceschool.k12ea.gov.tw/dish/pic/123");
    assert.equal(fallback.headers.get("cache-control"), "no-store");
    globalThis.fetch = async () => { throw new Error("timeout"); };
    assert.equal((await dishPhoto(new Request("https://example.com/api/dish-photo?dishId=123"))).status, 302);
  } finally { globalThis.fetch = original; }
});


test("generic vegetable uses the explicit reviewed ingredient and same-day official vegetable", () => {
  const { state, context } = ui();
  const vegetable = { name: "有機青菜", role: "vegetable", ingredients: [{ name: "有機小松菜" }] };
  const day16 = { ...day, date: "2026-10-16", recipeDetails: [vegetable] };
  const official = { name: "炒有機小松菜", category: "蔬菜", imageUrl: photo };
  const record16 = { mealDate: day16.date, meals: [{ dishes: [official] }] };
  context.renderMeal(day16, { photoRecord: record16 });
  assert.equal(state.dishDetails[0].officialPhotoUrl, photo);
  context.renderMeal(day16, { photoRecord: { ...record16, mealDate: "2026-10-15" } });
  assert.equal(state.dishDetails[0].officialPhotoUrl, null);
  for (const dishes of [[{ ...official, name: "炒有機白菜" }], [official, official]]) {
    context.renderMeal(day16, { photoRecord: { ...record16, meals: [{ dishes }] } });
    assert.equal(state.dishDetails[0].officialPhotoUrl, null);
  }
});
test("vegetable category alone and compound dishes never guess a photo", () => {
  const { context } = ui();
  const official = [{ name: "炒空心菜", category: "蔬菜", imageUrl: photo }];
  assert.equal(context.matchSameDayPhoto({ name: "營養時蔬", role: "vegetable" }, official, "meat"), null);
  assert.equal(context.matchSameDayPhoto({ name: "空心菜＋豆沙包", role: "vegetable", ingredients: [{ name: "空心菜" }] }, official, "meat"), null);
  assert.equal(context.matchSameDayPhoto({ name: "有機青菜", role: "vegetable", ingredients: [{ name: "有機空心菜" }] }, official, "meat"), null);
});
test("reviewed spelling differences resolve uniquely, without substring matching", () => {
  const { context } = ui();
  const official = { name: "日式南蠻雞", imageUrl: photo };
  assert.equal(context.matchSameDayPhoto({ name: "南蠻雞" }, [official], "meat").imageUrl, photo);
  assert.equal(context.matchSameDayPhoto({ name: "雞" }, [official], "meat"), null);
  assert.equal(context.matchSameDayPhoto({ name: "南蠻雞" }, [official, official], "meat"), null);
});

test("menu annotations match only a unique unannotated same-day dish", () => {
  const { context } = ui();
  const official = { name: "義式雞排", imageUrl: photo };
  assert.equal(context.matchSameDayPhoto({ name: "義式雞排（TS4）" }, [official], "meat").imageUrl, photo);
  assert.equal(context.matchSameDayPhoto({ name: "義式雞排（TS4）" }, [official, official], "meat"), null);
  assert.equal(context.matchSameDayPhoto({ name: "義式雞排（TS4）" }, [{ ...official, name: "香酥雞排" }], "meat"), null);
});

test("actual October 16 reviewed vegetable resolves in both meal variants", () => {
  const { context } = ui();
  const week = JSON.parse(readFileSync(new URL("../data/parsed/2026/semester-1/week-07/recipe-details.json", import.meta.url)));
  const record = JSON.parse(readFileSync(new URL("../data/parsed/schools/fatrace/193609/2026-10-16.json", import.meta.url)));
  assert.equal(record.mealDate, "2026-10-16");
  assert.equal(Number(record.school.fatraceSchoolId), 193609);
  const dishes = record.services.flatMap(service => service.meals.flatMap(meal => meal.dishes));
  for (const variant of ["meat", "vegetarian"]) {
    const dish = week.days.find(day => day.date === record.mealDate).variants[variant].find(dish => dish.role === "vegetable");
    const match = context.matchSameDayPhoto(dish, dishes, variant);
    assert.equal(match.name, "炒有機小松菜");
    assert.match(match.imageUrl, /1666324134064437$/);
  }
});

test("actual October 22 overview fruit and recipe drink have photos without duplicates", () => {
  const record = JSON.parse(readFileSync(new URL("../data/parsed/schools/fatrace/193609/2026-10-22.json", import.meta.url)));
  const menu = JSON.parse(readFileSync(new URL("../data/parsed/2026/semester-1/week-08/menu.json", import.meta.url))).days.find(day => day.date === record.mealDate);
  const recipes = JSON.parse(readFileSync(new URL("../data/parsed/2026/semester-1/week-08/recipe-details.json", import.meta.url))).days.find(day => day.date === record.mealDate);
  const photoRecord = { mealDate: record.mealDate, meals: record.services.flatMap(service => service.meals) };
  for (const variant of ["meat", "vegetarian"]) {
    const { refs, state, context } = ui(); state.mealType = variant;
    const actualDay = { date: menu.date, ...menu.variants[variant], recipeDetails: recipes.variants[variant] };
    context.renderMeal(actualDay, { photoRecord });
    const bananas = state.dishDetails.filter(dish => dish.name === "香蕉");
    const drinks = state.dishDetails.filter(dish => dish.name === "燕麥麥茶拿鐵");
    assert.equal(bananas.length, 1); assert.equal(drinks.length, 1);
    assert.equal(bananas[0].role, "fruit"); assert.equal(drinks[0].role, "soup");
    assert.equal(bananas[0].officialRecord, true);
    assert.ok(bananas[0].ingredients.every(ingredient => ingredient.officialRecord));
    const thumbs = refs.mealList.children.map(item => item.querySelector(".meal-photo")?.src).filter(Boolean);
    assert.ok(thumbs.includes("/api/dish-photo?dishId=1441067953110029"));
    assert.equal(thumbs.filter(url => url === "/api/dish-photo?dishId=1792636821055978").length, 1);
    assert.doesNotMatch(refs.dishCount.textContent, /設計用量/);
  }
});
test("supplemental fruit never borrows another date's photograph", () => {
  const { state, refs, context } = ui();
  context.renderMeal({ ...day, meal: { ...day.meal, fruit: "香蕉" } }, {
    photoRecord: { mealDate: "2026-10-21", meals: [{ dishes: [{ name: "香蕉", imageUrl: photo }] }] },
  });
  assert.equal(state.dishDetails.some(dish => dish.name === "香蕉"), false);
  assert.equal(refs.mealList.children.at(-1).querySelector(".meal-photo"), undefined);
});
