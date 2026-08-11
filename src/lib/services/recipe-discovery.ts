import type { MealType } from "@prisma/client";
import type { IngredientLine } from "@/lib/types/meal";
import { validateRecipe } from "@/lib/recipe-validation";

/**
 * External recipe source → normalize → validate/classify → store → recommend.
 * UI must never consume raw external API payloads.
 */
export type ExternalRecipeCandidate = {
  externalId?: string;
  name: string;
  description?: string;
  ingredients?: IngredientLine[];
  instructions?: string;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  servings?: number;
  tags?: string[];
  /** Image URL returned WITH this recipe by the provider (same record). */
  imageUrl?: string | null;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  cuisine?: string | null;
  /** Provider meal-type / dish-type hints when available. */
  mealTypeHints?: Array<"breakfast" | "lunch" | "dinner" | string>;
};

export type NormalizedRecipe = {
  name: string;
  description: string;
  ingredients: IngredientLine[];
  instructions: string;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  servings: number;
  tags: string[];
  imageUrl: string | null;
  imageSource: string | null;
  imageAttribution: string | null;
  breakfastSuitability: number;
  lunchSuitability: number;
  dinnerSuitability: number;
  goodForLeftovers: boolean;
  leftoverStorageDays: number | null;
  reheatsWell: boolean;
  batchFriendly: boolean;
  /** Display label for recipe provenance (maps to Meal.sourceTitle). */
  recipeSource: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  source: "SEED" | "MANUAL" | "AI" | "IMPORTED" | "WEB";
};

/**
 * Alias kept for product language (“RecipeDiscoveryProvider”).
 * Implementations live in discovery.ts as MealDiscoveryProvider.
 */
export type { MealDiscoveryProvider as RecipeDiscoveryProvider } from "@/lib/services/discovery";
export {
  getMealDiscoveryProvider as getRecipeDiscoveryProvider,
  setMealDiscoveryProvider as setRecipeDiscoveryProvider,
} from "@/lib/services/discovery";

/**
 * Australian-household baseline classifier when an external recipe has no scores.
 * Defaults only — household/cultural onboarding can override later.
 * Never marks unknown recipes suitable for all three occasions.
 */
export function classifyMealOccasions(input: {
  name: string;
  tags?: string[];
  description?: string;
  mealTypeHints?: string[];
}): { breakfast: number; lunch: number; dinner: number } {
  const hay = `${input.name} ${(input.tags ?? []).join(" ")} ${input.description ?? ""} ${(input.mealTypeHints ?? []).join(" ")}`.toLowerCase();

  let breakfast = 0.05;
  let lunch = 0.3;
  let dinner = 0.35;

  if (
    /breakfast|porridge|oat|granola|pancake|waffle|french toast|omelette|scrambled|eggs on toast|avocado toast|baked beans|overnight oats|muesli|yoghurt bowl|yogurt bowl|breakfast wrap|breakfast burrito|bacon and egg|eggs benedict|bircher|smoothie bowl|cereal/.test(
      hay,
    )
  ) {
    breakfast = 0.95;
    lunch = Math.min(Math.max(lunch, 0.3), 0.45);
    dinner = Math.min(dinner, 0.15);
  }

  if (
    /sandwich|toastie|wrap|salad|soup|roll|bagel|focaccia|rice bowl|noodle salad|ciabatta|baguette|ploughman/.test(
      hay,
    )
  ) {
    lunch = Math.max(lunch, 0.9);
    breakfast = Math.min(breakfast, 0.2);
  }

  if (
    /roast|steak|casserole|curry|stir[- ]?fry|parmigiana|lasagne|lasagna|pie|ragu|slow.?cook|bbq|grill|schnitzel|risotto|stew|bolognese|massaman|butter chicken|shepherd|cottage pie|pad thai|ramen|pho|biryani/.test(
      hay,
    )
  ) {
    dinner = Math.max(dinner, 0.95);
    breakfast = Math.min(breakfast, 0.08);
    lunch = Math.max(lunch, 0.45);
  }

  if (/frittata|quiche/.test(hay)) {
    breakfast = Math.max(breakfast, 0.7);
    lunch = Math.max(lunch, 0.75);
    dinner = Math.max(dinner, 0.55);
  }

  if (/fried rice|taco|burger|pizza|pasta|nacho|kebab|falafel/.test(hay)) {
    lunch = Math.max(lunch, 0.7);
    dinner = Math.max(dinner, 0.8);
    breakfast = Math.min(breakfast, 0.12);
  }

  if ((input.mealTypeHints ?? []).some((h) => /breakfast/i.test(h))) {
    breakfast = Math.max(breakfast, 0.85);
  }
  if ((input.mealTypeHints ?? []).some((h) => /lunch/i.test(h))) {
    lunch = Math.max(lunch, 0.85);
  }
  if ((input.mealTypeHints ?? []).some((h) => /dinner|main course|main.?dish/i.test(h))) {
    dinner = Math.max(dinner, 0.85);
  }

  // Sparse / unknown → conservative dinner-leaning, not all occasions
  if (breakfast < 0.2 && lunch < 0.4 && dinner < 0.4) {
    dinner = 0.55;
    lunch = 0.35;
    breakfast = 0.05;
  }

  return { breakfast, lunch, dinner };
}

export function normalizeExternalRecipe(
  raw: ExternalRecipeCandidate,
  opts?: { mealTypeHint?: MealType; providerName?: string },
): NormalizedRecipe {
  const tags = [...(raw.tags ?? [])];
  if (raw.cuisine && !tags.includes(raw.cuisine.toLowerCase())) {
    tags.push(raw.cuisine.toLowerCase());
  }

  const classified = classifyMealOccasions({
    name: raw.name,
    tags,
    description: raw.description,
    mealTypeHints: raw.mealTypeHints,
  });

  // Soft hint only — never force a recipe into all occasions
  if (opts?.mealTypeHint === "BREAKFAST" && classified.breakfast < 0.35) {
    classified.breakfast = 0.55;
  }
  if (opts?.mealTypeHint === "LUNCH" && classified.lunch < 0.35) {
    classified.lunch = 0.55;
  }
  if (opts?.mealTypeHint === "DINNER" && classified.dinner < 0.35) {
    classified.dinner = 0.55;
  }

  const sourceTitle = raw.sourceTitle?.trim() || opts?.providerName || null;
  const imageUrl = raw.imageUrl?.trim() || null;

  const normalized: NormalizedRecipe = {
    name: raw.name.trim(),
    description: (raw.description ?? "").trim(),
    ingredients: raw.ingredients ?? [],
    instructions: (raw.instructions ?? "").trim(),
    prepTimeMinutes: raw.prepTimeMinutes ?? null,
    cookTimeMinutes: raw.cookTimeMinutes ?? null,
    servings: raw.servings ?? 4,
    tags,
    // Image only when the provider returned it on the same recipe record
    imageUrl,
    imageSource: imageUrl ? "external" : null,
    imageAttribution: imageUrl && sourceTitle ? `${sourceTitle} recipe image` : null,
    breakfastSuitability: classified.breakfast,
    lunchSuitability: classified.lunch,
    dinnerSuitability: classified.dinner,
    goodForLeftovers: false,
    leftoverStorageDays: null,
    reheatsWell: false,
    batchFriendly: false,
    recipeSource: sourceTitle,
    sourceTitle,
    sourceUrl: raw.sourceUrl ?? null,
    source: "WEB",
  };

  const check = validateRecipe({
    name: normalized.name,
    description: normalized.description,
    ingredients: normalized.ingredients,
    instructions: normalized.instructions,
    servings: normalized.servings,
    imageUrl: normalized.imageUrl,
    imageSource: normalized.imageSource,
    sourceUrl: normalized.sourceUrl,
    sourceTitle: normalized.sourceTitle,
    source: normalized.source,
    breakfastSuitability: normalized.breakfastSuitability,
    lunchSuitability: normalized.lunchSuitability,
    dinnerSuitability: normalized.dinnerSuitability,
  });

  if (!check.ok) {
    // Still return normalized data for inspection; callers must check validation
    // before inserting into the recommendation catalogue.
  }

  return normalized;
}

export function assertNormalizedRecipeCatalogueReady(recipe: NormalizedRecipe): void {
  const check = validateRecipe({
    name: recipe.name,
    description: recipe.description,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    servings: recipe.servings,
    imageUrl: recipe.imageUrl,
    imageSource: recipe.imageSource,
    sourceUrl: recipe.sourceUrl,
    sourceTitle: recipe.sourceTitle,
    source: recipe.source,
    breakfastSuitability: recipe.breakfastSuitability,
    lunchSuitability: recipe.lunchSuitability,
    dinnerSuitability: recipe.dinnerSuitability,
  });
  if (!check.ok) {
    throw new Error(`Recipe failed validation: ${check.errors.join("; ")}`);
  }
}
