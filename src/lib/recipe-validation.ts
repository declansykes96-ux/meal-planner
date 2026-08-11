import type { IngredientLine } from "@/lib/types/meal";

export type RecipeValidationInput = {
  name: string;
  description?: string;
  ingredients: IngredientLine[];
  instructions?: string;
  servings?: number | null;
  imageUrl?: string | null;
  imageSource?: string | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  source?: string | null;
  breakfastSuitability: number;
  lunchSuitability: number;
  dinnerSuitability: number;
};

export type RecipeValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

const MIN_NAME_LEN = 3;
const MIN_INGREDIENTS = 2;
/** At least one occasion must clear this bar to enter the recommendation catalogue. */
export const CATALOGUE_MIN_OCCASION_SUITABILITY = 0.45;

/**
 * Validate a recipe before it enters the usable recommendation catalogue.
 * Failing recipes must not appear in the normal meal wheel.
 */
export function validateRecipe(input: RecipeValidationInput): RecipeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const name = (input.name ?? "").trim();
  if (name.length < MIN_NAME_LEN) {
    errors.push("Recipe needs a real name");
  }
  if (/^(test|demo|sample|placeholder|meal\s*\d+)/i.test(name)) {
    errors.push("Demo/placeholder recipe names are not allowed");
  }

  const ingredients = input.ingredients ?? [];
  if (ingredients.length < MIN_INGREDIENTS) {
    errors.push("Recipe needs at least two ingredients");
  }
  for (const ing of ingredients) {
    if (!ing?.name?.trim()) {
      errors.push("Ingredient entries must have a name");
      break;
    }
  }

  const instructions = (input.instructions ?? "").trim();
  const hasSource = Boolean(input.sourceUrl?.trim() || input.sourceTitle?.trim());
  if (instructions.length < 24 && !hasSource) {
    errors.push("Recipe needs usable instructions or a source link");
  }

  if (input.servings == null || !(input.servings > 0)) {
    warnings.push("Servings missing or invalid");
  }

  const b = input.breakfastSuitability ?? 0;
  const l = input.lunchSuitability ?? 0;
  const d = input.dinnerSuitability ?? 0;
  if (b < 0 || b > 1 || l < 0 || l > 1 || d < 0 || d > 1) {
    errors.push("Suitability scores must be between 0 and 1");
  }
  if (
    Math.max(b, l, d) < CATALOGUE_MIN_OCCASION_SUITABILITY
  ) {
    errors.push("At least one meal type must have suitable classification (≥ 0.45)");
  }

  // Image policy: either no image (placeholder later) OR tagged source.
  if (input.imageUrl?.trim() && !input.imageSource?.trim()) {
    warnings.push("Image URL present without imageSource — treat carefully");
  }

  if (input.source === "WEB" || input.source === "IMPORTED") {
    if (!input.sourceUrl?.trim() && !input.sourceTitle?.trim()) {
      errors.push("Externally imported recipes need source metadata");
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** True when a stored meal should be offered by discovery / recommendation. */
export function isCatalogueEligible(input: RecipeValidationInput): boolean {
  return validateRecipe(input).ok;
}
