const test = require("node:test");
const assert = require("node:assert/strict");

const { insightsPeriodLabel, mealMoment, relativeDayOffset } = require("../web/date-context.js");

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

test("labels insight ranges from their actual months", () => {
  assert.equal(
    insightsPeriodLabel("2026-08-31", "2026-10-08"),
    "AUGUST–OCTOBER AT A GLANCE",
  );
  assert.equal(
    insightsPeriodLabel("2026-10-01", "2026-10-31"),
    "OCTOBER AT A GLANCE",
  );
  assert.equal(
    insightsPeriodLabel("2026-12-01", "2027-01-31"),
    "DECEMBER 2026–JANUARY 2027 AT A GLANCE",
  );
});
