/**
 * Image policy for the recipe catalogue:
 * - Prefer an image that arrived WITH the recipe from the same source.
 * - Never keyword-search / loosely match an unrelated food photo by recipe name.
 * - If no matched image exists, use a tasteful occasion placeholder.
 * - Once stored on the Meal row, the planner always renders that stable URL.
 */

export type MealImageRef = {
  imageUrl: string;
  imageSource: "placeholder" | "local" | "external" | "seed";
  imageAttribution: string;
};

/** Tasteful local placeholders — preferable to an incorrect dish photo. */
export const PLACEHOLDER_IMAGES = {
  breakfast: {
    imageUrl: "/meals/placeholder-breakfast.svg",
    imageSource: "placeholder" as const,
    imageAttribution: "Plately placeholder",
  },
  lunch: {
    imageUrl: "/meals/placeholder-lunch.svg",
    imageSource: "placeholder" as const,
    imageAttribution: "Plately placeholder",
  },
  dinner: {
    imageUrl: "/meals/placeholder-dinner.svg",
    imageSource: "placeholder" as const,
    imageAttribution: "Plately placeholder",
  },
  generic: {
    imageUrl: "/meals/plate-warm.svg",
    imageSource: "placeholder" as const,
    imageAttribution: "Plately placeholder",
  },
};

/**
 * Resolve a display image for a recipe record.
 * Only uses an attached URL when the caller confirms it belongs to this recipe.
 */
export function resolveRecipeImage(input: {
  /** Explicit image that arrived with this recipe (same source). */
  matchedImageUrl?: string | null;
  matchedImageSource?: string | null;
  matchedImageAttribution?: string | null;
  breakfastSuitability: number;
  lunchSuitability: number;
  dinnerSuitability: number;
}): MealImageRef {
  if (input.matchedImageUrl?.trim()) {
    return {
      imageUrl: input.matchedImageUrl.trim(),
      imageSource: (input.matchedImageSource as MealImageRef["imageSource"]) || "external",
      imageAttribution: input.matchedImageAttribution?.trim() || "Recipe source image",
    };
  }

  const b = input.breakfastSuitability;
  const l = input.lunchSuitability;
  const d = input.dinnerSuitability;
  if (b >= l && b >= d && b >= 0.45) return PLACEHOLDER_IMAGES.breakfast;
  if (l >= d && l >= 0.45) return PLACEHOLDER_IMAGES.lunch;
  if (d >= 0.45) return PLACEHOLDER_IMAGES.dinner;
  return PLACEHOLDER_IMAGES.generic;
}

/** @deprecated use resolveRecipeImage — keyword Unsplash matching removed. */
export function resolveMealImage(input: {
  name: string;
  tags?: string[];
  breakfastSuitability: number;
  lunchSuitability: number;
  dinnerSuitability: number;
  matchedImageUrl?: string | null;
  matchedImageSource?: string | null;
  matchedImageAttribution?: string | null;
}): MealImageRef {
  return resolveRecipeImage(input);
}
