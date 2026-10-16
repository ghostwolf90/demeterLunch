(function attachOfficialDiet(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.OfficialDiet = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const VARIANT_CATEGORIES = ["主食", "主菜"];
  const SPLIT_CATEGORIES = new Set(["主菜", "副菜"]);
  const SHARED_CATEGORIES = new Set(["蔬菜", "湯品", "附餐"]);
  const NUTRITION_KEYS = [
    "caloriesKcal",
    "wholeGrainsServings",
    "proteinServings",
    "vegetablesServings",
    "oilsNutsServings",
    "fruitServings",
    "milkServings",
  ];
  const DINNER_POOLS = {
    chicken: [
      ["番茄豆腐煲", "蒜炒地瓜葉"],
      ["味噌烤鯖魚", "涼拌秋葵"],
      ["毛豆炒蛋", "香菇炊飯"],
    ],
    pork: [
      ["檸檬烤鯖魚", "蒜香花椰菜"],
      ["番茄炒蛋", "毛豆炒菇"],
      ["香煎板豆腐", "涼拌小黃瓜"],
    ],
    fish: [
      ["香菇蒸雞", "清炒菠菜"],
      ["番茄炒蛋", "滷豆干"],
      ["三杯杏鮑菇", "毛豆玉米"],
    ],
    egg: [
      ["味噌烤鯖魚", "燙青花菜"],
      ["香菇雞肉煲", "涼拌木耳"],
      ["麻婆豆腐", "清炒高麗菜"],
    ],
    tofu: [
      ["蔥燒雞腿", "清炒小松菜"],
      ["鮭魚炊飯", "涼拌秋葵"],
      ["番茄炒蛋", "蒜香花椰菜"],
    ],
    balanced: [
      ["南瓜雞肉燉飯", "燙青花菜"],
      ["味噌烤鯖魚", "涼拌豆芽"],
      ["番茄豆腐煲", "蒜炒菠菜"],
    ],
    vegetarian: [
      ["番茄豆腐煲", "蒜炒地瓜葉"],
      ["毛豆炒蛋", "香菇炊飯"],
      ["三杯杏鮑菇", "涼拌小黃瓜"],
    ],
  };
  const DINNER_REASONS = {
    chicken: "午餐已有雞肉，晚餐改用魚、蛋或豆製品，整天更有變化。",
    pork: "午餐已有豬肉，晚餐換成魚、蛋、海鮮或豆製品。",
    fish: "午餐已有魚或海鮮，晚餐改搭雞肉、蛋或豆製品。",
    egg: "午餐已有蛋料理，晚餐換一種主要蛋白質。",
    tofu: "午餐已有豆製品，晚餐可搭配魚、蛋或肉類。",
    balanced: "從不同料理輪替選一組，讓一天的餐桌更多元。",
    vegetarian: "依素食午餐內容輪替豆類、蛋與蔬菜，晚餐也維持素食搭配。",
  };

  function hasVegetarianMarker(name) {
    return String(name || "").includes("素");
  }

  function flatten(record) {
    return (record?.meals || []).flatMap((meal) =>
      (meal.dishes || []).map((dish) => ({
        ...dish,
        serviceLabel: meal.serviceLabel,
      })),
    );
  }

  function profile(record) {
    const dishes = flatten(record);
    const variantCategories = VARIANT_CATEGORIES.filter((category) => {
      const candidates = dishes.filter((dish) => dish.category === category);
      return candidates.some((dish) => hasVegetarianMarker(dish.name))
        && candidates.some((dish) => !hasVegetarianMarker(dish.name));
    });
    const splitCategories = new Set(SPLIT_CATEGORIES);
    if (dishes.some((dish) =>
      dish.category === "主食" && hasVegetarianMarker(dish.name)
    )) splitCategories.add("主食");
    return {
      hasVariants: variantCategories.length > 0,
      variantCategories,
      splitCategories,
      dishes,
    };
  }

  function filter(record, mealType) {
    const result = profile(record);
    if (!result.hasVariants || !["meat", "vegetarian"].includes(mealType)) {
      return result.dishes;
    }
    return result.dishes.filter((dish) => {
      if (SHARED_CATEGORIES.has(dish.category)) return true;
      if (!result.splitCategories.has(dish.category)) return true;
      return mealType === "vegetarian"
        ? hasVegetarianMarker(dish.name)
        : !hasVegetarianMarker(dish.name);
    });
  }

  function summary(dishes) {
    const ingredients = dishes.flatMap((dish) => dish.ingredients || []);
    return {
      dishCount: dishes.length,
      ingredientCount: ingredients.length,
      certifiedIngredientCount: ingredients.filter(
        (ingredient) => Boolean(ingredient.certifications?.length),
      ).length,
    };
  }

  function parseIsoDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return null;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.toISOString().slice(0, 10) === value ? date : null;
  }

  function shiftIsoDate(value, days) {
    const date = parseIsoDate(value);
    if (!date) return null;
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function mondayOf(value) {
    const date = parseIsoDate(value);
    if (!date) return null;
    const offset = (date.getUTCDay() + 6) % 7;
    return shiftIsoDate(value, -offset);
  }

  function weekView(availableDates, selectedDate) {
    const dates = [...new Set((availableDates || []).filter(parseIsoDate))].sort();
    const anchor = parseIsoDate(selectedDate) ? selectedDate : dates.at(-1) || null;
    const start = mondayOf(anchor);
    if (!start) {
      return { start: null, end: null, dates: [], previousDate: null, nextDate: null };
    }
    const end = shiftIsoDate(start, 6);
    const currentDates = dates.filter((date) => date >= start && date <= end);
    return {
      start,
      end,
      dates: currentDates,
      previousDate: dates.filter((date) => date < start).at(-1) || null,
      nextDate: dates.find((date) => date > end) || null,
    };
  }

  function sourceNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  function nutritionSnapshots(record) {
    const schoolMenuSnapshots = record?.schoolMenu?.nutritionSnapshots;
    if (Array.isArray(schoolMenuSnapshots) && schoolMenuSnapshots.length) {
      return schoolMenuSnapshots.flatMap((snapshot) => {
        const source = snapshot?.nutrition;
        if (!source || typeof source !== "object") return [];
        const nutrition = Object.fromEntries(
          NUTRITION_KEYS.map((key) => [key, sourceNumber(source[key])]),
        );
        if (nutrition.caloriesKcal === null || NUTRITION_KEYS.slice(1, -1).some(
          (key) => nutrition[key] === null,
        )) return [];
        return [{
          batchDataId: `school-menu-${snapshot.gradeGroup}`,
          kitchenName: snapshot.label || "校方營養分析",
          menuTypeName: "校方週菜單",
          sourceType: "school_weekly_menu",
          nutrition,
        }];
      });
    }
    return (record?.meals || []).flatMap((meal) => {
      const source = meal?.nutrition;
      if (!source || typeof source !== "object") return [];
      const nutrition = Object.fromEntries(
        NUTRITION_KEYS.map((key) => [key, sourceNumber(source[key])]),
      );
      if (nutrition.caloriesKcal === null || NUTRITION_KEYS.slice(1).some(
        (key) => nutrition[key] === null,
      )) return [];
      return [{
        batchDataId: meal.batchDataId,
        kitchenName: meal.kitchenName || "供餐廚房未註明",
        menuTypeName: meal.menuTypeName || meal.serviceLabel || "午餐",
        nutrition,
      }];
    });
  }

  function comparableDishName(value) {
    return String(value || "")
      .replace(/[（(]葷[)）]/g, "")
      .replace(/[^\p{Letter}\p{Number}]/gu, "");
  }

  function schoolMenuDish(record, officialDish) {
    if (!record?.schoolMenu?.dishes || !officialDish || hasVegetarianMarker(officialDish.name)) {
      return null;
    }
    const officialName = comparableDishName(officialDish.name);
    return record.schoolMenu.dishes.find((dish) => {
      const names = [dish.name, ...(dish.officialNames || [])].map(comparableDishName);
      return names.some((name) => name && (
        name === officialName || name.includes(officialName) || officialName.includes(name)
      ));
    }) || null;
  }

  function proteinGroup(dishes, mealType) {
    if (mealType === "vegetarian") return "vegetarian";
    const mainNames = dishes
      .filter((dish) => dish.category === "主菜")
      .map((dish) => String(dish.name || ""));
    const names = mainNames.length ? mainNames : dishes.map((dish) => String(dish.name || ""));
    const text = names.join("、");
    if (text.includes("雞")) return "chicken";
    if (["豬", "排骨", "肉燥", "肉片", "豬腳"].some((item) => text.includes(item))) return "pork";
    if (["魚", "蝦", "蚵", "魷", "海鮮"].some((item) => text.includes(item))) return "fish";
    if (text.includes("蛋")) return "egg";
    if (["豆腐", "豆干", "豆皮", "百頁"].some((item) => text.includes(item))) return "tofu";
    return "balanced";
  }

  function stableIndex(value, length) {
    let hash = 2166136261;
    for (const character of String(value)) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % length;
  }

  function dinnerSuggestion(record, mealType = "meat") {
    if (!record) return null;
    const result = profile(record);
    const dishes = filter(record, result.hasVariants ? mealType : null);
    if (!dishes.length) return null;
    const group = proteinGroup(dishes, result.hasVariants ? mealType : "meat");
    const pool = DINNER_POOLS[group];
    const mainDish = dishes.find((dish) => dish.category === "主菜")?.name || dishes[0]?.name || "";
    const recommendations = [...pool[stableIndex(`${record.mealDate}:${mainDish}`, pool.length)]];
    const snapshots = nutritionSnapshots(record);
    const notes = [];
    const vegetables = snapshots.map((item) => item.nutrition.vegetablesServings);
    if (vegetables.length && vegetables.every((value) => value < 1.5)) {
      notes.push("晚餐補一盤深綠色蔬菜");
    } else {
      notes.push("晚餐維持一盤蔬菜");
    }
    const fruit = snapshots.map((item) => item.nutrition.fruitServings);
    if (fruit.length && fruit.every((value) => value === 0)) {
      notes.push("餐後可加一份當季水果");
    }
    if (dishes.some((dish) => /炸|酥|脆皮|鹽酥/.test(String(dish.name || "")))) {
      notes.push("午餐有酥炸料理，晚餐以蒸、煮或燉為主");
    }
    return {
      title: "今晚換個主角",
      recommendations,
      reason: DINNER_REASONS[group],
      notes,
      disclaimer: "這是依同日官方午餐內容產生的家庭搭配靈感，不是個人化醫療或營養建議。",
    };
  }

  return {
    dinnerSuggestion,
    filter,
    flatten,
    hasVegetarianMarker,
    nutritionSnapshots,
    profile,
    schoolMenuDish,
    summary,
    weekView,
  };
});
