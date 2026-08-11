import type { DiscoveredMeal, DiscoverMealsInput, MealDiscoveryProvider } from "@/lib/services/discovery";
import {
  normalizeExternalRecipe,
  type ExternalRecipeCandidate,
} from "@/lib/services/recipe-discovery";
import { validateRecipe } from "@/lib/recipe-validation";
import { createMeal, listMeals } from "@/lib/services/meals";
import { resolveRecipeImage } from "@/lib/meal-images";
import { flagsFromSuitability } from "@/lib/meal-occasion";

/**
 * Edamam Recipe Search — structured provider stub.
 *
 * Local development works WITHOUT credentials: discoverMeals falls through to
 * the local catalogue. When EDAMAM_APP_ID + EDAMAM_APP_KEY are set, search can
 * import structured recipes (title, ingredients, yield, image, source, URL)
 * as ONE record — image travels with the recipe, never keyword-matched later.
 *
 * Docs: https://developer.edamam.com/edamam-docs-recipe-api
 */
export type EdamamConfig = {
  appId: string;
  appKey: string;
  enabled: boolean;
};

export function getEdamamConfig(): EdamamConfig {
  const appId = process.env.EDAMAM_APP_ID?.trim() ?? "";
  const appKey = process.env.EDAMAM_APP_KEY?.trim() ?? "";
  return {
    appId,
    appKey,
    enabled: Boolean(appId && appKey),
  };
}

/** Map a raw Edamam hit into our external candidate (no UI-facing raw objects). */
export function mapEdamamHitToCandidate(hit: {
  recipe?: {
    uri?: string;
    label?: string;
    source?: string;
    url?: string;
    image?: string;
    yield?: number;
    ingredientLines?: string[];
    ingredients?: Array<{ food?: string; quantity?: number; measure?: string }>;
    totalTime?: number;
    cuisineType?: string[];
    mealType?: string[];
    dishType?: string[];
  };
}): ExternalRecipeCandidate | null {
  const r = hit.recipe;
  if (!r?.label) return null;

  const ingredients =
    r.ingredients
      ?.filter((i) => i.food)
      .map((i) => ({
        name: i.food!,
        quantity: i.quantity ?? null,
        unit: i.measure ?? null,
      })) ??
    (r.ingredientLines ?? []).map((line) => ({ name: line }));

  return {
    externalId: r.uri,
    name: r.label,
    ingredients,
    servings: r.yield ? Math.max(1, Math.round(r.yield)) : 4,
    cookTimeMinutes: r.totalTime && r.totalTime > 0 ? Math.round(r.totalTime) : null,
    // Image from the same Edamam recipe record — do not replace later
    imageUrl: r.image ?? null,
    sourceTitle: r.source ?? "Edamam",
    sourceUrl: r.url ?? null,
    cuisine: r.cuisineType?.[0] ?? null,
    tags: [...(r.dishType ?? []), ...(r.cuisineType ?? [])],
    mealTypeHints: r.mealType ?? [],
  };
}

/**
 * Import a structured external candidate into the local Meal table after
 * normalize + validate. Returns null if validation fails.
 */
export async function importExternalRecipeCandidate(
  candidate: ExternalRecipeCandidate,
  opts?: { providerName?: string },
) {
  const normalized = normalizeExternalRecipe(candidate, {
    providerName: opts?.providerName ?? "Edamam",
  });
  const check = validateRecipe({
    name: normalized.name,
    description: normalized.description,
    ingredients: normalized.ingredients,
    instructions: normalized.instructions || normalized.sourceUrl || "",
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
  if (!check.ok) return null;

  const image = resolveRecipeImage({
    matchedImageUrl: normalized.imageUrl,
    matchedImageSource: normalized.imageSource,
    matchedImageAttribution: normalized.imageAttribution,
    breakfastSuitability: normalized.breakfastSuitability,
    lunchSuitability: normalized.lunchSuitability,
    dinnerSuitability: normalized.dinnerSuitability,
  });
  const flags = flagsFromSuitability(normalized);

  return createMeal({
    name: normalized.name,
    description: normalized.description,
    ingredients: normalized.ingredients,
    instructions: normalized.instructions || `See source: ${normalized.sourceUrl ?? ""}`,
    prepTimeMinutes: normalized.prepTimeMinutes,
    cookTimeMinutes: normalized.cookTimeMinutes,
    servings: normalized.servings,
    tags: normalized.tags,
    source: "WEB",
    imageUrl: image.imageUrl,
    imageSource: image.imageSource,
    imageAttribution: image.imageAttribution,
    breakfastSuitability: normalized.breakfastSuitability,
    lunchSuitability: normalized.lunchSuitability,
    dinnerSuitability: normalized.dinnerSuitability,
    suitableForBreakfast: flags.suitableForBreakfast,
    suitableForLunch: flags.suitableForLunch,
    suitableForDinner: flags.suitableForDinner,
    sourceTitle: normalized.recipeSource,
    sourceUrl: normalized.sourceUrl,
  });
}

/**
 * Optional composite provider: uses Edamam when configured, otherwise local DB.
 * Does not call Edamam during normal planner browsing unless explicitly enabled
 * via EDAMAM_LIVE_DISCOVERY=1 (keeps local catalogue authoritative for MVP).
 */
export class EdamamRecipeDiscoveryProvider implements MealDiscoveryProvider {
  constructor(private readonly fallback: MealDiscoveryProvider) {}

  async discoverMeals(input: DiscoverMealsInput): Promise<DiscoveredMeal[]> {
    const config = getEdamamConfig();
    const live = process.env.EDAMAM_LIVE_DISCOVERY === "1";
    if (!config.enabled || !live) {
      return this.fallback.discoverMeals(input);
    }

    // Live search is opt-in; results are imported then re-read from local store.
    try {
      const q =
        input.mealType === "BREAKFAST"
          ? "breakfast"
          : input.mealType === "LUNCH"
            ? "lunch"
            : "dinner";
      const url = new URL("https://api.edamam.com/api/recipes/v2");
      url.searchParams.set("type", "public");
      url.searchParams.set("q", q);
      url.searchParams.set("app_id", config.appId);
      url.searchParams.set("app_key", config.appKey);
      url.searchParams.set("random", "true");

      const res = await fetch(url.toString(), {
        headers: { "Edamam-Account-User": config.appId },
      });
      if (!res.ok) return this.fallback.discoverMeals(input);

      const body = (await res.json()) as { hits?: unknown[] };
      for (const hit of body.hits ?? []) {
        const candidate = mapEdamamHitToCandidate(hit as Parameters<typeof mapEdamamHitToCandidate>[0]);
        if (candidate) await importExternalRecipeCandidate(candidate);
      }
    } catch {
      /* fall through to local */
    }

    return this.fallback.discoverMeals(input);
  }
}

/** Ensure local catalogue remains usable when external discovery is offline. */
export async function ensureLocalCatalogueAvailable(): Promise<number> {
  const meals = await listMeals();
  return meals.length;
}
