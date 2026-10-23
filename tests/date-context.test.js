const test = require("node:test");
const assert = require("node:assert/strict");

const {
  closestMealDate,
  latestMealDate,
  insightsPeriodLabel,
  mealMoment,
  relativeDayOffset,
} = require("../web/date-context.js");

test("uses relative labels for yesterday, today, and tomorrow", () => {
  assert.equal(mealMoment("2026-09-30", "2026-10-01"), "昨天中午，");
  assert.equal(mealMoment("2026-10-01", "2026-10-01"), "今天中午，");
  assert.equal(mealMoment("2026-10-02", "2026-10-01"), "明天中午，");
});

test("uses the weekday for dates farther away", () => {
  assert.equal(mealMoment("2026-09-29", "2026-10-01"), "星期二中午，");
  assert.equal(mealMoment("2026-10-05", "2026-10-01"), "星期一中午，");
});

test("calculates day offsets across month boundaries", () => {
  assert.equal(relativeDayOffset("2026-10-01", "2026-09-30"), 1);
});

test("selects the available meal date closest to today", () => {
  const dates = ["2026-10-12", "2026-10-14", "2026-10-15"];
  assert.equal(closestMealDate(dates, "2026-10-16"), "2026-10-15");
  assert.equal(closestMealDate(dates, "2026-10-13"), "2026-10-12");
  assert.equal(closestMealDate(dates, "2026-10-01"), "2026-10-12");
  assert.equal(closestMealDate([], "2026-10-16"), null);
});

test("selects the latest available meal date up to today", () => {
  const dates = ["2026-10-12", "2026-10-16", "2026-10-19", "2026-10-20"];
  assert.equal(latestMealDate(dates, "2026-10-19"), "2026-10-19");
  assert.equal(latestMealDate(dates, "2026-10-18"), "2026-10-16");
  assert.equal(latestMealDate(dates, "2026-10-01"), "2026-10-12");
  assert.equal(latestMealDate([], "2026-10-19"), null);
});

test("labels insight ranges from their actual months", () => {
  assert.equal(
    insightsPeriodLabel("2026-08-31", "2026-10-08"),
    "2026 年 8–10 月午餐趨勢",
  );
  assert.equal(
    insightsPeriodLabel("2026-10-01", "2026-10-31"),
    "2026 年 10 月午餐趨勢",
  );
  assert.equal(
    insightsPeriodLabel("2026-12-01", "2027-01-31"),
    "2026 年 12 月–2027 年 1 月午餐趨勢",
  );
});
