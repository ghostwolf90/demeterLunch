(function exposeDateContext(root, factory) {
  const api = factory();
  root.LunchDateContext = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createDateContext() {
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  function parseIsoDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
    if (!match) throw new TypeError(`Invalid ISO date: ${value}`);
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  }

  function utcDay(value) {
    const [year, month, day] = parseIsoDate(value);
    return Date.UTC(year, month - 1, day) / 86400000;
  }

  function relativeDayOffset(selectedDate, todayDate) {
    return utcDay(selectedDate) - utcDay(todayDate);
  }

  function closestMealDate(availableDates, targetDate) {
    if (!Array.isArray(availableDates) || !availableDates.length) return null;
    let closest = null;
    let closestOffset = null;
    for (const date of new Set(availableDates)) {
      let offset;
      try {
        offset = relativeDayOffset(date, targetDate);
      } catch {
        continue;
      }
      if (
        closestOffset === null ||
        Math.abs(offset) < Math.abs(closestOffset) ||
        (Math.abs(offset) === Math.abs(closestOffset) && offset <= 0 && closestOffset > 0)
      ) {
        closest = date;
        closestOffset = offset;
      }
    }
    return closest;
  }

  function latestMealDate(availableDates, targetDate) {
    if (!Array.isArray(availableDates) || !availableDates.length) return null;
    const dates = [...new Set(availableDates)].filter((date) => {
      try {
        parseIsoDate(date);
        return true;
      } catch {
        return false;
      }
    }).sort();
    return dates.filter((date) => date <= targetDate).at(-1) || dates[0] || null;
  }

  function mealMoment(selectedDate, todayDate) {
    const offset = relativeDayOffset(selectedDate, todayDate);
    if (offset === 0) return "今天中午，";
    if (offset === 1) return "明天中午，";
    if (offset === -1) return "昨天中午，";
    const [year, month, day] = parseIsoDate(selectedDate);
    return `${weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]}中午，`;
  }

  function insightsPeriodLabel(startDate, endDate) {
    const [startYear, startMonth] = parseIsoDate(startDate);
    const [endYear, endMonth] = parseIsoDate(endDate);
    if (startYear === endYear && startMonth === endMonth) {
      return `${startYear} 年 ${startMonth} 月午餐趨勢`;
    }
    if (startYear === endYear) {
      return `${startYear} 年 ${startMonth}–${endMonth} 月午餐趨勢`;
    }
    return `${startYear} 年 ${startMonth} 月–${endYear} 年 ${endMonth} 月午餐趨勢`;
  }

  return { closestMealDate, latestMealDate, insightsPeriodLabel, mealMoment, relativeDayOffset };
}));
