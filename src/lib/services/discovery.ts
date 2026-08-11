import type { MealType } from "@prisma/client";
import type { MealRecord } from "@/lib/types/meal";
import { listMeals } from "@/lib/services/meals";
import { meetsMealTypeThreshold } from "@/lib/meal-occasion";
import { isCatalogueEligible } from "@/lib/recipe-validation";
import { normalizeName } from "@/lib/utils/dates";

export type DiscoverMealsInput = {
  householdSize: number;
  dislikedIngredients: string[];
  likedIngredients: string[];
  recentMealIds: string[];
  desiredCount: number;
  /**
   * When set, discovery HARD-filters to meals that meet the meal-type
   * suitability threshold. Empty result means empty — never falls back to
   * inappropriate occasions.
   */
  mealType?: MealType;
};

export type DiscoveredMeal = MealRecord & {
  discoveryScore?: number;
};

/**
 * RecipeDiscoveryProvider (product name).
 * External providers normalize → validate → classify → store; this interface
 * only returns already-normalized MealRecords to the recommendation engine.
 */
export interface MealDiscoveryProvider {
  discoverMeals(input: DiscoverMealsInput): Promise<DiscoveredMeal[]>;
}

function isEligibleMeal(meal: MealRecord): boolean {
  return isCatalogueEligible({
    name: meal.name,
    description: meal.description,
    ingredients: meal.ingredients,
    instructions: meal.instructions,
    servings: meal.servings,
    imageUrl: meal.imageUrl,
    imageSource: meal.imageSource,
    sourceUrl: meal.sourceUrl,
    sourceTitle: meal.sourceTitle,
    source: meal.source,
    breakfastSuitability: meal.breakfastSuitability,
    lunchSuitability: meal.lunchSuitability,
    dinnerSuitability: meal.dinnerSuitability,
  });
}

function containsDisliked(meal: MealRecord, disliked: string[]): boolean {
  if (!disliked.length) return false;
  const names = meal.ingredients.map((i) => normalizeName(i.name));
  return disliked.some((d) => names.includes(d) || names.some((n) => n.includes(d)));
}

/**
 * Local discovery backed by the validated Meal Library / seed catalogue.
 */
export class LocalSeedMealDiscoveryProvider implements MealDiscoveryProvider {
  async discoverMeals(input: DiscoverMealsInput): Promise<DiscoveredMeal[]> {
    const meals = (await listMeals()).filter(isEligibleMeal);

    let pool = meals.filter((m) => !containsDisliked(m, input.dislikedIngredients));

    if (input.mealType) {
      pool = pool.filter((m) => meetsMealTypeThreshold(m, input.mealType!));
      // HARD filter: do not reopen the full catalogue if this occasion is thin.
    }

    const scored = pool.map((meal) => {
      let score = Math.random() * 3;
      if (meal.favourite) score += 2;
      if (
        input.likedIngredients.some((liked) =>
          meal.ingredients.some((i) => i.name.toLowerCase().includes(liked)),
        )
      ) {
        score += 1.5;
      }
      if (input.recentMealIds.includes(meal.id)) score -= 2;
      score += Math.max(0, 3 - meal.timesUsed) * 0.3;
      if (input.mealType === "BREAKFAST") score += meal.breakfastSuitability * 4;
      if (input.mealType === "LUNCH") score += meal.lunchSuitability * 4;
      if (input.mealType === "DINNER") score += meal.dinnerSuitability * 4;
      return { ...meal, discoveryScore: score };
    });

    scored.sort((a, b) => (b.discoveryScore ?? 0) - (a.discoveryScore ?? 0));
    return scored.slice(0, Math.max(input.desiredCount * 4, 40));
  }
}

let provider: MealDiscoveryProvider = new LocalSeedMealDiscoveryProvider();

export function getMealDiscoveryProvider(): MealDiscoveryProvider {
  return provider;
}

/** For tests / wiring an external RecipeDiscoveryProvider. */
export function setMealDiscoveryProvider(next: MealDiscoveryProvider) {
  provider = next;
}
