import type { MealType } from "@prisma/client";
import type { IngredientLine } from "@/lib/types/meal";

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
  imageUrl?: string | null;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  cuisine?: string | null;
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
 * Heuristic classifier when an external recipe has no occasion scores.
 * Never defaults to “suitable for everything”.
 */
export function classifyMealOccasions(input: {
  name: string;
  tags?: string[];
  description?: string;
}): { breakfast: number; lunch: number; dinner: number } {
  const hay = `${input.name} ${(input.tags ?? []).join(" ")} ${input.description ?? ""}`.toLowerCase();

  let breakfast = 0.05;
  let lunch = 0.35;
  let dinner = 0.4;

  if (
    /breakfast|porridge|oat|granola|pancake|waffle|french toast|omelette|scrambled|eggs on toast|avocado toast|baked beans|overnight oats|muesli|yoghurt bowl|breakfast wrap|breakfast burrito|bacon and egg/.test(
      hay,
    )
  ) {
    breakfast = 0.9;
    lunch = Math.max(lunch, 0.35);
    dinner = Math.min(dinner, 0.25);
  }

  if (/sandwich|toastie|wrap|salad|soup|roll|bagel|focaccia|rice bowl|noodle salad|leftover/.test(hay)) {
    lunch = Math.max(lunch, 0.85);
  }

  if (
    /roast|steak|casserole|curry|stir[- ]?fry|parmigiana|lasagne|pie|ragu|slow.?cook|BBQ|grill|schnitzel|risotto|stew|bolognese|massaman|butter chicken/.test(
      hay,
    )
  ) {
    dinner = Math.max(dinner, 0.9);
    breakfast = Math.min(breakfast, 0.1);
  }

  if (/frittata|quiche|fried rice|taco|burger|pizza|pasta/.test(hay)) {
    lunch = Math.max(lunch, 0.7);
    dinner = Math.max(dinner, 0.75);
    if (/frittata|quiche/.test(hay)) breakfast = Math.max(breakfast, 0.65);
  }

  // Unknown / sparse data stays conservative — not all occasions suitable
  if (breakfast < 0.2 && lunch < 0.4 && dinner < 0.4) {
    dinner = 0.55;
    lunch = 0.4;
    breakfast = 0.05;
  }

  return { breakfast, lunch, dinner };
}

export function normalizeExternalRecipe(
  raw: ExternalRecipeCandidate,
  opts?: { mealTypeHint?: MealType },
): NormalizedRecipe {
  const tags = [...(raw.tags ?? [])];
  if (raw.cuisine && !tags.includes(raw.cuisine.toLowerCase())) {
    tags.push(raw.cuisine.toLowerCase());
  }

  const classified = classifyMealOccasions({
    name: raw.name,
    tags,
    description: raw.description,
  });

  if (opts?.mealTypeHint === "BREAKFAST" && classified.breakfast < 0.35) {
    classified.breakfast = 0.55;
  }
  if (opts?.mealTypeHint === "LUNCH" && classified.lunch < 0.35) {
    classified.lunch = 0.55;
  }
  if (opts?.mealTypeHint === "DINNER" && classified.dinner < 0.35) {
    classified.dinner = 0.55;
  }

  return {
    name: raw.name.trim(),
    description: (raw.description ?? "").trim(),
    ingredients: raw.ingredients ?? [],
    instructions: (raw.instructions ?? "").trim(),
    prepTimeMinutes: raw.prepTimeMinutes ?? null,
    cookTimeMinutes: raw.cookTimeMinutes ?? null,
    servings: raw.servings ?? 4,
    tags,
    imageUrl: raw.imageUrl ?? null,
    imageSource: raw.imageUrl ? "external" : null,
    imageAttribution: null,
    breakfastSuitability: classified.breakfast,
    lunchSuitability: classified.lunch,
    dinnerSuitability: classified.dinner,
    goodForLeftovers: false,
    leftoverStorageDays: null,
    reheatsWell: false,
    batchFriendly: false,
    sourceTitle: raw.sourceTitle ?? null,
    sourceUrl: raw.sourceUrl ?? null,
    source: "WEB",
  };
}
