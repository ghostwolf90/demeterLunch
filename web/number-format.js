(function exposeNumberFormat(root, factory) {
  const api = factory();
  root.LunchNumberFormat = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createNumberFormat() {
  function sourceCalories(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(2) : "—";
  }

  return { sourceCalories };
}));
