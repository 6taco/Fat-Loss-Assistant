export const orderedMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];

export function groupMealsByType(meals) {
  const byType = new Map();

  for (const meal of meals) {
    const group = byType.get(meal.mealType) || {
      mealType: meal.mealType,
      meals: [],
      summary: { carb: 0, protein: 0, fat: 0, calories: 0 },
    };

    group.meals.push(meal);
    group.summary.carb += meal.carb;
    group.summary.protein += meal.protein;
    group.summary.fat += meal.fat;
    group.summary.calories += meal.calories ?? Math.round(meal.carb * 4 + meal.protein * 4 + meal.fat * 9);
    byType.set(meal.mealType, group);
  }

  return orderedMealTypes
    .map(mealType => byType.get(mealType))
    .filter(Boolean)
    .map(group => ({
      ...group,
      meals: [...group.meals].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    }));
}
