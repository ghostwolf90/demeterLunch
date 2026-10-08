const test = require("node:test");
const assert = require("node:assert/strict");

const OfficialDiet = require("../web/official-diet.js");

function record(dishes) {
  return {
    meals: [{ serviceLabel: "午餐", dishes }],
  };
}

const mixedRecord = record([
  { name: "胚芽飯", category: "主食", ingredients: [{ name: "白米" }] },
  { name: "京醬豬柳", category: "主菜", ingredients: [{ name: "豬肉" }] },
  { name: "(素)京醬豆腐", category: "主菜", ingredients: [{ name: "豆腐" }] },
  { name: "青花炒雞絲", category: "副菜", ingredients: [{ name: "雞肉" }] },
  { name: "青花炒素腰花", category: "副菜", ingredients: [{ name: "素腰花" }] },
  { name: "高麗菜", category: "蔬菜", ingredients: [{ name: "甘藍" }] },
  { name: "翡翠湯", category: "湯品", ingredients: [{ name: "豆腐" }] },
]);

test("detects a vegetarian variant only when the main dishes contain both labels", () => {
  assert.equal(OfficialDiet.profile(mixedRecord).hasVariants, true);
  assert.equal(
    OfficialDiet.profile(record([
      { name: "味噌鮮魚", category: "主菜", ingredients: [] },
      { name: "翠綠青江菜", category: "蔬菜", ingredients: [] },
    ])).hasVariants,
    false,
  );
});

test("splits main and side dishes by the vegetarian marker", () => {
  assert.deepEqual(
    OfficialDiet.filter(mixedRecord, "meat").map((dish) => dish.name),
    ["胚芽飯", "京醬豬柳", "青花炒雞絲", "高麗菜", "翡翠湯"],
  );
  assert.deepEqual(
    OfficialDiet.filter(mixedRecord, "vegetarian").map((dish) => dish.name),
    ["胚芽飯", "(素)京醬豆腐", "青花炒素腰花", "高麗菜", "翡翠湯"],
  );
});

test("keeps the full official record when no paired main dish exists", () => {
  const unsplit = record([
    { name: "肉燥飯", category: "主食", ingredients: [] },
    { name: "椒鹽海陸", category: "主菜", ingredients: [] },
  ]);
  assert.deepEqual(
    OfficialDiet.filter(unsplit, "vegetarian").map((dish) => dish.name),
    ["肉燥飯", "椒鹽海陸"],
  );
});

test("summarizes only the filtered dishes and ingredients", () => {
  assert.deepEqual(OfficialDiet.summary(OfficialDiet.filter(mixedRecord, "vegetarian")), {
    dishCount: 5,
    ingredientCount: 5,
    certifiedIngredientCount: 0,
  });
});
