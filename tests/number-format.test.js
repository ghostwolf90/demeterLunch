const test = require("node:test");
const assert = require("node:assert/strict");

const { sourceCalories } = require("../web/number-format.js");

test("shows the reviewed calorie value without integer rounding", () => {
  assert.equal(sourceCalories(721.91), "721.91");
  assert.equal(sourceCalories(686.98), "686.98");
});

test("keeps the two decimal places used by the source sheet", () => {
  assert.equal(sourceCalories(717.8), "717.80");
  assert.equal(sourceCalories(710.1), "710.10");
});

test("uses a placeholder for invalid calorie values", () => {
  assert.equal(sourceCalories(undefined), "—");
  assert.equal(sourceCalories("not-a-number"), "—");
});
