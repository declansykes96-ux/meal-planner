import type { MealType } from "@prisma/client";

/** Hard floor: meals below this for the requested occasion are never recommended. */
export const MEAL_TYPE_MIN_SUITABILITY = 0.35;

/** Soft “counts as suitable” flag used for catalogue filters / legacy booleans. */
export const MEAL_TYPE_FLAG_THRESHOLD = 0.45;

export type OccasionSuitability = {
  breakfast: number;
  lunch: number;
  dinner: number;
};

export type MealOccasionScores = {
  breakfastSuitability: number;
  lunchSuitability: number;
  dinnerSuitability: number;
};

export function clampSuitability(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function suitabilityForMealType(
  meal: MealOccasionScores,
  mealType: MealType,
  override?: Partial<OccasionSuitability> | null,
): number {
  const breakfast = clampSuitability(override?.breakfast ?? meal.breakfastSuitability);
  const lunch = clampSuitability(override?.lunch ?? meal.lunchSuitability);
  const dinner = clampSuitability(override?.dinner ?? meal.dinnerSuitability);
  if (mealType === "BREAKFAST") return breakfast;
  if (mealType === "LUNCH") return lunch;
  if (mealType === "DINNER") return dinner;
  // SNACK — treat as lunch-ish for MVP
  return lunch;
}

export function meetsMealTypeThreshold(
  meal: MealOccasionScores,
  mealType: MealType,
  override?: Partial<OccasionSuitability> | null,
  min = MEAL_TYPE_MIN_SUITABILITY,
): boolean {
  return suitabilityForMealType(meal, mealType, override) >= min;
}

export function flagsFromSuitability(scores: MealOccasionScores) {
  return {
    suitableForBreakfast: scores.breakfastSuitability >= MEAL_TYPE_FLAG_THRESHOLD,
    suitableForLunch: scores.lunchSuitability >= MEAL_TYPE_FLAG_THRESHOLD,
    suitableForDinner: scores.dinnerSuitability >= MEAL_TYPE_FLAG_THRESHOLD,
  };
}

/** Ranking boost from suitability (higher suitability → stronger preference). */
export function mealTypeSuitabilityBonus(suitability: number): number {
  // 0.35 → ~0, 0.7 → ~5.6, 1.0 → ~10.4
  return Math.max(0, (suitability - MEAL_TYPE_MIN_SUITABILITY) * 16);
}
