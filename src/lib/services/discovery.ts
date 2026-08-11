import type { MealType } from "@prisma/client";
import type { MealRecord } from "@/lib/types/meal";
import { listMeals } from "@/lib/services/meals";
import { meetsMealTypeThreshold } from "@/lib/meal-occasion";

export type DiscoverMealsInput = {
  householdSize: number;
  dislikedIngredients: string[];
  likedIngredients: string[];
  recentMealIds: string[];
  desiredCount: number;
  /** Optional: bias discovery toward an occasion (still returns multi-occasion meals). */
  mealType?: MealType;
};

export type DiscoveredMeal = MealRecord & {
  discoveryScore?: number;
};

/**
 * Abstraction for bringing meal ideas into the planner.
 * Local catalogue now; external RecipeDiscoveryProvider implementations later
 * (see recipe-discovery.ts for normalization + classification).
 */
export interface MealDiscoveryProvider {
  discoverMeals(input: DiscoverMealsInput): Promise<DiscoveredMeal[]>;
}

/**
 * Local discovery backed by the Meal Library / seed catalogue.
 * Does not hard-filter to dinner-only — recommendation applies mealType gates.
 */
export class LocalSeedMealDiscoveryProvider implements MealDiscoveryProvider {
  async discoverMeals(input: DiscoverMealsInput): Promise<DiscoveredMeal[]> {
    const meals = await listMeals();
    const pool = input.mealType
      ? meals.filter((m) => meetsMealTypeThreshold(m, input.mealType!))
      : meals;

    const scored = (pool.length ? pool : meals).map((meal) => {
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

/** For tests / future wiring of an external provider. */
export function setMealDiscoveryProvider(next: MealDiscoveryProvider) {
  provider = next;
}
