(function attachOfficialDiet(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.OfficialDiet = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const VARIANT_CATEGORIES = ["主食", "主菜"];
  const SPLIT_CATEGORIES = new Set(["主菜", "副菜"]);
  const SHARED_CATEGORIES = new Set(["蔬菜", "湯品", "附餐"]);

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

  return {
    filter,
    flatten,
    hasVegetarianMarker,
    profile,
    summary,
  };
});
