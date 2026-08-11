export type IngredientLine = {
  name: string;
  quantity?: number | null;
  unit?: string | null;
};

export type MealRecord = {
  id: string;
  name: string;
  description: string;
  ingredients: IngredientLine[];
  instructions: string;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  servings: number;
  tags: string[];
  favourite: boolean;
  timesUsed: number;
  lastUsedAt: Date | null;
  source: string;
  imageUrl: string | null;
  imageSource: string | null;
  imageAttribution: string | null;
  goodForLeftovers: boolean;
  leftoverStorageDays: number | null;
  reheatsWell: boolean;
  batchFriendly: boolean;
  estimatedIngredientCost: number | null;
  breakfastSuitability: number;
  lunchSuitability: number;
  dinnerSuitability: number;
  suitableForLunch: boolean;
  suitableForDinner: boolean;
  suitableForBreakfast: boolean;
  sourceTitle: string | null;
  sourceUrl: string | null;
  discoveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  discoveryScore?: number;
};

export type CreateMealInput = {
  name: string;
  description?: string;
  ingredients?: IngredientLine[];
  instructions?: string;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  servings?: number;
  tags?: string[];
  favourite?: boolean;
  source?: "SEED" | "MANUAL" | "AI" | "IMPORTED" | "WEB";
  imageUrl?: string | null;
  imageSource?: string | null;
  imageAttribution?: string | null;
  goodForLeftovers?: boolean;
  leftoverStorageDays?: number | null;
  reheatsWell?: boolean;
  batchFriendly?: boolean;
  estimatedIngredientCost?: number | null;
  breakfastSuitability?: number;
  lunchSuitability?: number;
  dinnerSuitability?: number;
  suitableForLunch?: boolean;
  suitableForDinner?: boolean;
  suitableForBreakfast?: boolean;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
};

export type UpdateMealInput = Partial<CreateMealInput> & { id: string };

export function parseIngredients(raw: string): IngredientLine[] {
  try {
    const parsed = JSON.parse(raw) as IngredientLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function serializeIngredients(items: IngredientLine[]): string {
  return JSON.stringify(items);
}

export function serializeTags(tags: string[]): string {
  return JSON.stringify(tags);
}

export function totalTimeMinutes(
  prep: number | null | undefined,
  cook: number | null | undefined,
): number | null {
  if (prep == null && cook == null) return null;
  return (prep ?? 0) + (cook ?? 0);
}

/** Approximate household meal occasions covered by one full recipe. */
export function householdMealOccasions(servings: number, householdSize: number): number {
  return servings / Math.max(1, householdSize);
}

/** Servings left after one household dinner (or other occasion). */
export function remainingServingsAfterOccasion(
  recipeServings: number,
  householdSize: number,
): number {
  return Math.max(0, recipeServings - householdSize);
}

export function canCoverLeftoverOccasion(
  recipeServings: number,
  householdSize: number,
): boolean {
  return remainingServingsAfterOccasion(recipeServings, householdSize) >= householdSize;
}

export function costPerServing(
  estimatedIngredientCost: number | null | undefined,
  servings: number,
): number | null {
  if (estimatedIngredientCost == null || !(servings > 0)) return null;
  return estimatedIngredientCost / servings;
}
