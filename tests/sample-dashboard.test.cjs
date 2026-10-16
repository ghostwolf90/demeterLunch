const test = require("node:test");
const assert = require("node:assert/strict");

require("../web/sample-dashboard.js");
const { selectSampleWeek } = globalThis.LunchSampleDashboard;

function day(date, weekId) {
  return { date, weekId, meal: { mainDish: "範例主菜" } };
}

test("selects the latest complete five-day week", () => {
  const days = [
    day("2026-10-19", "week-08"),
    day("2026-10-20", "week-08"),
    day("2026-10-21", "week-08"),
    day("2026-10-22", "week-08"),
    day("2026-10-23", "week-08"),
    day("2026-10-12", "week-07"),
    day("2026-10-13", "week-07"),
    day("2026-10-14", "week-07"),
    day("2026-10-15", "week-07"),
    day("2026-10-16", "week-07"),
    day("2026-10-05", "week-06"),
    day("2026-10-06", "week-06"),
    day("2026-10-07", "week-06"),
    day("2026-10-08", "week-06"),
    day("2026-10-09", "week-06"),
  ];

  assert.deepEqual(selectSampleWeek(days, "2026-10-17"), {
    weekId: "week-07",
    dates: ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"],
    selectedDate: "2026-10-16",
    startDate: "2026-10-12",
    endDate: "2026-10-16",
  });
});

test("falls back to the fullest available week", () => {
  const selected = selectSampleWeek([
    day("2026-10-12", "week-07"),
    day("2026-10-13", "week-07"),
    day("2026-10-14", "week-07"),
    day("2026-10-19", "week-08"),
  ]);

  assert.equal(selected.weekId, "week-07");
  assert.equal(selected.selectedDate, "2026-10-14");
});

test("ignores malformed entries", () => {
  assert.equal(selectSampleWeek([{ date: "today", weekId: "week-01", meal: {} }, null]), null);
});
