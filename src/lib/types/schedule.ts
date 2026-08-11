/**
 * Schedule shape:
 * MealPlan → days (Mon–Sun × weeks) → MealOccasions (BREAKFAST | LUNCH | DINNER)
 *
 * Each occasion: date, mealType, mealId?, enabled, locked.
 * Disabling a day sets enabled=false on that day's three occasions.
 * Empty slot = mealId null (user cleared it or never filled it).
 *
 * Household size affects recipe/shopping quantities, NOT how many slots exist.
 */
export {};
