(function exposeSampleDashboard(root, factory) {
  const api = factory();
  root.LunchSampleDashboard = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createSampleDashboard() {
  function selectSampleWeek(days, referenceDate = null) {
    if (!Array.isArray(days) || !days.length) return null;

    const weeks = new Map();
    for (const day of days) {
      if (!day?.weekId || !/^\d{4}-\d{2}-\d{2}$/.test(day.date || "") || !day.meal) continue;
      if (!weeks.has(day.weekId)) weeks.set(day.weekId, []);
      weeks.get(day.weekId).push(day);
    }

    const candidates = [...weeks.entries()]
      .map(([weekId, weekDays]) => {
        const sortedDays = [...weekDays].sort((left, right) => left.date.localeCompare(right.date));
        return {
          weekId,
          days: sortedDays,
          startDate: sortedDays[0]?.date,
          endDate: sortedDays.at(-1)?.date,
        };
      })
      .filter((week) => week.days.length)
      .sort((left, right) => right.endDate.localeCompare(left.endDate));

    const eligibleCandidates = /^\d{4}-\d{2}-\d{2}$/.test(referenceDate || "")
      ? candidates.filter((week) => week.endDate <= referenceDate)
      : candidates;
    const sampleCandidates = eligibleCandidates.length ? eligibleCandidates : candidates;
    const selected = sampleCandidates.find((week) => week.days.length >= 5)
      || sampleCandidates.sort((left, right) => right.days.length - left.days.length || right.endDate.localeCompare(left.endDate))[0];
    if (!selected) return null;

    return {
      weekId: selected.weekId,
      dates: selected.days.map((day) => day.date),
      selectedDate: selected.endDate,
      startDate: selected.startDate,
      endDate: selected.endDate,
    };
  }

  return { selectSampleWeek };
}));
