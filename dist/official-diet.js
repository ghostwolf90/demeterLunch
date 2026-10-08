(function attachOfficialDiet(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.OfficialDiet = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const SPLIT_CATEGORIES = new Set(["主菜", "副菜"]);
  const SHARED_CATEGORIES = new Set(["主食", "蔬菜", "湯品", "附餐"]);

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
    const mainDishes = dishes.filter((dish) => dish.category === "主菜");
    const hasVegetarianMain = mainDishes.some((dish) => hasVegetarianMarker(dish.name));
    const hasMeatMain = mainDishes.some((dish) => !hasVegetarianMarker(dish.name));
    return {
      hasVariants: hasVegetarianMain && hasMeatMain,
      hasVegetarianMain,
      hasMeatMain,
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
      if (!SPLIT_CATEGORIES.has(dish.category)) return true;
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

  return {
    filter,
    flatten,
    hasVegetarianMarker,
    profile,
    summary,
  };
});
