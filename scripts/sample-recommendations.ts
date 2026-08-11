/**
 * Smoke-test recommendation quality after catalogue improvements.
 * Generates ≥20 picks per meal type and flags obvious mistakes.
 */
import { PrismaClient, type MealType } from "@prisma/client";
import { getPreferenceSnapshot } from "../src/lib/services/preferences";
import { listMeals } from "../src/lib/services/meals";
import { suggestReplacementMeal, isMealAllowedForOccasion } from "../src/lib/services/recommendation";
import { meetsMealTypeThreshold } from "../src/lib/meal-occasion";
import { isCatalogueEligible } from "../src/lib/recipe-validation";

const prisma = new PrismaClient();

async function main() {
  const prefs = await getPreferenceSnapshot();
  const meals = await listMeals();
  const eligible = meals.filter((m) =>
    isCatalogueEligible({
      name: m.name,
      description: m.description,
      ingredients: m.ingredients,
      instructions: m.instructions,
      servings: m.servings,
      imageUrl: m.imageUrl,
      imageSource: m.imageSource,
      sourceUrl: m.sourceUrl,
      sourceTitle: m.sourceTitle,
      source: m.source,
      breakfastSuitability: m.breakfastSuitability,
      lunchSuitability: m.lunchSuitability,
      dinnerSuitability: m.dinnerSuitability,
    }),
  );

  console.log(`Catalogue: ${meals.length} meals, ${eligible.length} eligible`);

  const types: MealType[] = ["BREAKFAST", "LUNCH", "DINNER"];
  let failures = 0;

  for (const mealType of types) {
    const picks: { name: string; score: number; imageSource: string | null }[] = [];
    const exclude: string[] = [];
    for (let i = 0; i < 24; i++) {
      const m = suggestReplacementMeal(meals, prefs, exclude, 2, "BALANCED", mealType);
      if (!m) break;
      const score =
        mealType === "BREAKFAST"
          ? m.breakfastSuitability
          : mealType === "LUNCH"
            ? m.lunchSuitability
            : m.dinnerSuitability;
      picks.push({ name: m.name, score, imageSource: m.imageSource });
      exclude.push(m.id);

      if (!meetsMealTypeThreshold(m, mealType)) {
        console.error(`FAIL ${mealType}: ${m.name} below threshold (${score})`);
        failures++;
      }
      if (!isMealAllowedForOccasion(m, prefs, mealType)) {
        console.error(`FAIL ${mealType}: ${m.name} not allowed for occasion`);
        failures++;
      }
      // Images must be stable stored refs — never null random search
      if (!m.imageUrl) {
        console.error(`FAIL ${mealType}: ${m.name} missing imageUrl`);
        failures++;
      }
    }

    console.log(`\n${mealType} (${picks.length} picks):`);
    for (const p of picks) {
      console.log(` - ${p.name} (${p.score.toFixed(2)}) [${p.imageSource}]`);
    }

    if (picks.length < 20) {
      console.error(`FAIL ${mealType}: only ${picks.length} picks (need ≥20)`);
      failures++;
    }

    const low = picks.filter((p) => p.score < 0.35);
    if (low.length) {
      console.error(`FAIL ${mealType}: ${low.length} picks below hard filter`);
      failures++;
    }
  }

  // Spot-check: dinner-forward meals should not dominate breakfast
  const breakfastPool = eligible.filter((m) => meetsMealTypeThreshold(m, "BREAKFAST"));
  const dinnerLeak = breakfastPool.filter((m) => m.dinnerSuitability >= 0.85 && m.breakfastSuitability < 0.35);
  if (dinnerLeak.length) {
    console.error(`FAIL: ${dinnerLeak.length} dinner meals leaked into breakfast pool`);
    failures++;
  } else {
    console.log("\nOK: no high-dinner / low-breakfast meals in breakfast pool");
  }

  if (failures) {
    console.error(`\n${failures} failure(s)`);
    process.exit(1);
  }
  console.log("\nAll recommendation smoke checks passed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
