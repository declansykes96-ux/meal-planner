import type { MealType, PlanningStyle } from "@prisma/client";
import type { MealRecord } from "@/lib/types/meal";
import type { PreferenceSnapshot } from "@/lib/services/preferences";
import {
  LIKED_MEAL_SCORE_BONUS,
  LIKED_SIMILARITY_SCORE_BONUS,
} from "@/lib/preference-signals";
import {
  mealTypeSuitabilityBonus,
  meetsMealTypeThreshold,
  suitabilityForMealType,
} from "@/lib/meal-occasion";
import {
  canCoverLeftoverOccasion,
  costPerServing,
  householdMealOccasions,
} from "@/lib/types/meal";
import { normalizeName } from "@/lib/utils/dates";

const PROTEIN_TAGS = ["chicken", "beef", "lamb", "pork", "seafood", "vegetarian"];

function primaryProtein(meal: MealRecord): string {
  const tags = meal.tags.map((t) => normalizeName(t));
  return PROTEIN_TAGS.find((p) => tags.includes(p)) ?? "other";
}

function mealIngredientNames(meal: MealRecord): string[] {
  return meal.ingredients.map((i) => normalizeName(i.name));
}

function violatesDietary(meal: MealRecord, restrictions: string[]): boolean {
  const names = mealIngredientNames(meal);
  const tags = meal.tags.map((t) => normalizeName(t));
  for (const rule of restrictions) {
    const hay = rule.toLowerCase();
    if (hay.includes("seafood") || hay.includes("fish")) {
      if (
        tags.includes("seafood") ||
        names.some((n) => ["fish", "barramundi", "prawn", "salmon"].some((s) => n.includes(s)))
      ) {
        return true;
      }
    }
    if (hay.includes("vegetarian") || hay.includes("no meat")) {
      if (["chicken", "beef", "lamb", "pork", "seafood"].some((t) => tags.includes(t))) {
        return true;
      }
    }
    if ((hay.includes("no pork") || hay.includes("avoid pork")) && tags.includes("pork")) {
      return true;
    }
    const token = normalizeName(rule);
    if (token && names.includes(token)) return true;
  }
  return false;
}

export function isMealAllowed(meal: MealRecord, prefs: PreferenceSnapshot): boolean {
  if (prefs.blockedMealIds.includes(meal.id)) return false;
  const names = mealIngredientNames(meal);
  if (names.some((n) => prefs.disliked.includes(n))) return false;
  if (violatesDietary(meal, prefs.dietaryRestrictions)) return false;
  return true;
}

/**
 * HARD prerequisite: meal must meet occasion suitability (with user overrides).
 */
export function isMealAllowedForOccasion(
  meal: MealRecord,
  prefs: PreferenceSnapshot,
  mealType: MealType,
): boolean {
  if (!isMealAllowed(meal, prefs)) return false;
  const override = prefs.occasionOverrides[meal.id] ?? null;
  return meetsMealTypeThreshold(meal, mealType, override);
}

function planningStyleYieldBonus(
  meal: MealRecord,
  householdSize: number,
  planningStyle: PlanningStyle,
): number {
  const occasions = householdMealOccasions(meal.servings, householdSize);
  const leftoverCapable = canCoverLeftoverOccasion(meal.servings, householdSize);
  const storage = meal.leftoverStorageDays ?? 0;
  const cps = costPerServing(meal.estimatedIngredientCost, meal.servings);

  if (planningStyle === "FRESH") {
    if (occasions <= 1.15) return 1.5;
    if (occasions >= 2.5) return -1;
    return 0;
  }

  if (planningStyle === "BALANCED") {
    let bonus = 0;
    if (leftoverCapable && meal.goodForLeftovers) bonus += 2;
    else if (leftoverCapable) bonus += 1;
    if (occasions >= 2 && occasions <= 3.5) bonus += 1;
    if (meal.reheatsWell) bonus += 0.5;
    return bonus;
  }

  let bonus = 0;
  if (occasions >= 2) bonus += Math.min(occasions, 5) * 2.5;
  else bonus -= 4;

  if (meal.goodForLeftovers) bonus += 4;
  if (meal.reheatsWell) bonus += 3;
  if (meal.batchFriendly) bonus += 3;
  if (leftoverCapable) bonus += 3;
  if (storage >= 2) bonus += 2;
  else if (storage >= 1) bonus += 1;

  if (cps != null) {
    if (cps <= 4) bonus += 3;
    else if (cps <= 7) bonus += 1.5;
    else if (cps >= 14) bonus -= 2;
  }

  return bonus;
}

function scoreMeal(
  meal: MealRecord,
  prefs: PreferenceSnapshot,
  already: Set<string>,
  usedProteins: string[],
  householdSize: number,
  planningStyle: PlanningStyle,
  mealType: MealType,
): number | null {
  if (!isMealAllowedForOccasion(meal, prefs, mealType)) return null;
  if (already.has(meal.id)) return null;

  const override = prefs.occasionOverrides[meal.id] ?? null;
  const suitability = suitabilityForMealType(meal, mealType, override);

  let score = 10 + Math.random() * 2;
  score += mealTypeSuitabilityBonus(suitability);

  if (prefs.likedMealIds.includes(meal.id)) {
    score += LIKED_MEAL_SCORE_BONUS;
  } else if (meal.favourite) {
    score += LIKED_MEAL_SCORE_BONUS * 0.8;
  }

  const likedIngredientHits = mealIngredientNames(meal).filter((n) =>
    prefs.liked.includes(n),
  ).length;
  score += likedIngredientHits * 2;
  if (likedIngredientHits > 0 && !prefs.likedMealIds.includes(meal.id)) {
    score += LIKED_SIMILARITY_SCORE_BONUS;
  }
  score += Math.min(meal.timesUsed, 3);

  const protein = primaryProtein(meal);
  score -= usedProteins.filter((p) => p === protein).length * 3;

  if (meal.lastUsedAt) {
    const days = (Date.now() - meal.lastUsedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (days < 7) score -= 4;
  }

  // Recent variety browsing — soft penalty only
  if (prefs.recentlyReplacedMealIds.includes(meal.id)) {
    score -= 2.5;
  }

  score += planningStyleYieldBonus(meal, householdSize, planningStyle);

  if (meal.discoveryScore) score += meal.discoveryScore * 0.5;

  return score;
}

/** Select N cook meals for a specific occasion, respecting suitability + Planning Style. */
export function selectMealsForOccasion(
  candidates: MealRecord[],
  prefs: PreferenceSnapshot,
  count: number,
  householdSize: number,
  mealType: MealType,
  excludeIds: string[] = [],
  planningStyle: PlanningStyle = "BALANCED",
): MealRecord[] {
  const selected: MealRecord[] = [];
  const already = new Set(excludeIds);
  const usedProteins: string[] = [];

  for (let i = 0; i < count; i++) {
    const ranked = candidates
      .map((meal) => ({
        meal,
        score: scoreMeal(
          meal,
          prefs,
          already,
          usedProteins,
          householdSize,
          planningStyle,
          mealType,
        ),
      }))
      .filter((row): row is { meal: MealRecord; score: number } => row.score !== null)
      .sort((a, b) => b.score - a.score);

    if (ranked.length === 0) break;

    const pick = ranked[0].meal;
    selected.push(pick);
    already.add(pick.id);
    usedProteins.push(primaryProtein(pick));
  }

  return selected;
}

/** @deprecated use selectMealsForOccasion(..., "DINNER", ...) */
export function selectDinnerCooks(
  candidates: MealRecord[],
  prefs: PreferenceSnapshot,
  count: number,
  householdSize: number,
  excludeIds: string[] = [],
  planningStyle: PlanningStyle = "BALANCED",
): MealRecord[] {
  return selectMealsForOccasion(
    candidates,
    prefs,
    count,
    householdSize,
    "DINNER",
    excludeIds,
    planningStyle,
  );
}

export function suggestReplacementMeal(
  candidates: MealRecord[],
  prefs: PreferenceSnapshot,
  excludeIds: string[],
  householdSize: number,
  planningStyle: PlanningStyle = "BALANCED",
  mealType: MealType = "DINNER",
): MealRecord | null {
  const already = new Set(excludeIds);
  const ranked = candidates
    .map((meal) => ({
      meal,
      score: scoreMeal(meal, prefs, already, [], householdSize, planningStyle, mealType),
    }))
    .filter((row): row is { meal: MealRecord; score: number } => row.score !== null)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.meal ?? null;
}
