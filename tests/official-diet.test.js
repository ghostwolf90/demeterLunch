import test from "node:test";
import assert from "node:assert/strict";

await import("../web/official-diet.js");
const OfficialDiet = globalThis.OfficialDiet;

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

test("detects a vegetarian variant when staple or main dishes contain both labels", () => {
  assert.equal(OfficialDiet.profile(mixedRecord).hasVariants, true);
  assert.equal(
    OfficialDiet.profile(record([
      { name: "家常炒麵", category: "主食", ingredients: [] },
      { name: "家常炒麵(素)", category: "主食", ingredients: [] },
      { name: "鄉村雞翅", category: "主菜", ingredients: [] },
    ])).hasVariants,
    true,
  );
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

test("splits paired staple dishes into meat and vegetarian menus", () => {
  const stapleVariants = record([
    { name: "家常炒麵", category: "主食", ingredients: [{ name: "油麵" }] },
    { name: "家常炒麵(素)", category: "主食", ingredients: [{ name: "油麵" }] },
    { name: "鄉村雞翅", category: "主菜", ingredients: [{ name: "雞翅" }] },
    { name: "金菇海茸", category: "副菜", ingredients: [{ name: "金針菇" }] },
    { name: "蚵白菜", category: "蔬菜", ingredients: [{ name: "白菜" }] },
  ]);

  assert.deepEqual(
    OfficialDiet.filter(stapleVariants, "meat").map((dish) => dish.name),
    ["家常炒麵", "鄉村雞翅", "金菇海茸", "蚵白菜"],
  );
  assert.deepEqual(
    OfficialDiet.filter(stapleVariants, "vegetarian").map((dish) => dish.name),
    ["家常炒麵(素)", "蚵白菜"],
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

test("keeps each official nutrition batch separate and includes all six food groups", () => {
  const nutritionRecord = {
    mealDate: "2026-10-16",
    meals: [
      {
        batchDataId: "batch-a",
        kitchenName: "飪珍記食品股份有限公司",
        nutrition: {
          caloriesKcal: "520",
          wholeGrainsServings: "2.98",
          proteinServings: "4",
          vegetablesServings: "3.09",
          oilsNutsServings: "0",
          fruitServings: "0",
          milkServings: "0",
        },
        dishes: [],
      },
      {
        batchDataId: "batch-b",
        kitchenName: "另一供餐廚房",
        nutrition: {
          caloriesKcal: "610",
          wholeGrainsServings: "5.77",
          proteinServings: "2.52",
          vegetablesServings: "1.25",
          oilsNutsServings: "0.68",
          fruitServings: "0",
          milkServings: "0",
        },
        dishes: [],
      },
    ],
  };

  const snapshots = OfficialDiet.nutritionSnapshots(nutritionRecord);
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[0].nutrition.caloriesKcal, 520);
  assert.equal(snapshots[0].nutrition.milkServings, 0);
  assert.equal(snapshots[1].kitchenName, "另一供餐廚房");
});

test("prefers reviewed school low and upper grade nutrition without inventing milk", () => {
  const meal = {
    meals: [{ nutrition: {
      caloriesKcal: "520", wholeGrainsServings: "2.98", proteinServings: "4",
      vegetablesServings: "3.09", oilsNutsServings: "0", fruitServings: "0", milkServings: "0",
    }, dishes: [] }],
    schoolMenu: {
      nutritionSnapshots: [
        { gradeGroup: "elementary_lower", label: "低年級", nutrition: {
          caloriesKcal: 654, wholeGrainsServings: 5, proteinServings: 2.5,
          vegetablesServings: 1.7, oilsNutsServings: 2, fruitServings: 0, milkServings: null,
        } },
        { gradeGroup: "elementary_upper", label: "高年級", nutrition: {
          caloriesKcal: 710, wholeGrainsServings: 5.5, proteinServings: 2.5,
          vegetablesServings: 1.7, oilsNutsServings: 2.5, fruitServings: 0, milkServings: null,
        } },
      ],
    },
  };

  const snapshots = OfficialDiet.nutritionSnapshots(meal);
  assert.deepEqual(snapshots.map((snapshot) => snapshot.nutrition.caloriesKcal), [654, 710]);
  assert.equal(snapshots[0].sourceType, "school_weekly_menu");
  assert.equal(snapshots[0].nutrition.milkServings, null);
});

test("matches school serving weights to the meat dish but not a vegetarian alternative", () => {
  const schoolRecord = {
    schoolMenu: { dishes: [
      { category: "主菜", name: "宮保雞丁", servingText: "100 公克" },
      { category: "飲品", name: "履歷豆漿", officialNames: ["鮮豆漿陽光豆乳黃豆"], servingText: "200 cc／罐" },
    ] },
  };

  assert.equal(
    OfficialDiet.schoolMenuDish(schoolRecord, { name: "宮保雞丁(葷)" }).servingText,
    "100 公克",
  );
  assert.equal(OfficialDiet.schoolMenuDish(schoolRecord, { name: "宮保雞丁(素)" }), null);
  assert.equal(
    OfficialDiet.schoolMenuDish(schoolRecord, { name: "鮮豆漿陽光豆乳黃豆" }).servingText,
    "200 cc／罐",
  );
});

test("does not invent a nutrition snapshot when the official fields are incomplete", () => {
  const incomplete = {
    meals: [{
      nutrition: { caloriesKcal: "520", wholeGrainsServings: "2.98" },
      dishes: [],
    }],
  };

  assert.deepEqual(OfficialDiet.nutritionSnapshots(incomplete), []);
});

test("builds a deterministic dinner rotation from the selected official menu", () => {
  const meal = {
    mealDate: "2026-10-16",
    meals: [{
      kitchenName: "測試廚房",
      nutrition: {
        caloriesKcal: "520",
        wholeGrainsServings: "2.98",
        proteinServings: "4",
        vegetablesServings: "1.2",
        oilsNutsServings: "0",
        fruitServings: "0",
        milkServings: "0",
      },
      dishes: [
        { name: "胚芽飯", category: "主食", ingredients: [] },
        { name: "宮保雞丁", category: "主菜", ingredients: [] },
      ],
    }],
  };

  const first = OfficialDiet.dinnerSuggestion(meal, "meat");
  const second = OfficialDiet.dinnerSuggestion(meal, "meat");
  assert.deepEqual(first, second);
  assert.match(first.reason, /午餐已有雞肉/);
  assert.ok(first.notes.includes("晚餐補一盤深綠色蔬菜"));
  assert.ok(first.notes.includes("餐後可加一份當季水果"));
});

test("groups daily records into the selected Monday-to-Sunday week", () => {
  const dates = [
    "2026-10-08",
    "2026-10-12",
    "2026-10-13",
    "2026-10-14",
    "2026-10-15",
    "2026-10-16",
  ];

  assert.deepEqual(OfficialDiet.weekView(dates, "2026-10-16"), {
    start: "2026-10-12",
    end: "2026-10-18",
    dates: [
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
    ],
    previousDate: "2026-10-08",
    nextDate: null,
  });
});

test("starts a fresh weekly list on the following Monday", () => {
  const dates = ["2026-10-08", "2026-10-16", "2026-10-19"];

  assert.deepEqual(OfficialDiet.weekView(dates, "2026-10-19"), {
    start: "2026-10-19",
    end: "2026-10-25",
    dates: ["2026-10-19"],
    previousDate: "2026-10-16",
    nextDate: null,
  });
  assert.deepEqual(OfficialDiet.weekView(dates, "2026-10-08").dates, ["2026-10-08"]);
  assert.equal(OfficialDiet.weekView(dates, "2026-10-08").nextDate, "2026-10-16");
});
