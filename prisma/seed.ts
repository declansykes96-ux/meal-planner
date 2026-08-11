import { MealSource, PrismaClient } from "@prisma/client";
import { CATALOGUE_MEALS } from "./data/catalogue";
import { resolveRecipeImage } from "../src/lib/meal-images";
import { flagsFromSuitability } from "../src/lib/meal-occasion";
import { validateRecipe } from "../src/lib/recipe-validation";

const prisma = new PrismaClient();

async function main() {
  console.log(`Auditing ${CATALOGUE_MEALS.length} catalogue recipes…`);

  const accepted = [];
  const rejected: { name: string; errors: string[] }[] = [];

  for (const meal of CATALOGUE_MEALS) {
    const check = validateRecipe({
      name: meal.name,
      description: meal.description,
      ingredients: meal.ingredients,
      instructions: meal.instructions,
      servings: meal.servings,
      imageUrl: meal.imageUrl ?? null,
      imageSource: meal.imageSource ?? null,
      sourceUrl: meal.sourceUrl ?? null,
      sourceTitle: meal.sourceTitle ?? "Plately seed catalogue",
      source: "SEED",
      breakfastSuitability: meal.breakfastSuitability,
      lunchSuitability: meal.lunchSuitability,
      dinnerSuitability: meal.dinnerSuitability,
    });
    if (!check.ok) {
      rejected.push({ name: meal.name, errors: check.errors });
      continue;
    }
    accepted.push(meal);
  }

  if (rejected.length) {
    console.warn(`Rejected ${rejected.length} recipes failing validation:`);
    for (const row of rejected.slice(0, 20)) {
      console.warn(` - ${row.name}: ${row.errors.join("; ")}`);
    }
  }

  // Deduplicate by normalized name
  const seen = new Set<string>();
  const unique = accepted.filter((m) => {
    const key = m.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`Seeding ${unique.length} validated unique recipes…`);

  await prisma.preferenceEvent.deleteMany();
  await prisma.preference.deleteMany();
  await prisma.plannedMeal.deleteMany();
  await prisma.cookedMealBatch.deleteMany();
  await prisma.mealPlan.deleteMany();
  await prisma.meal.deleteMany();

  for (const meal of unique) {
    const breakfastSuitability = meal.breakfastSuitability;
    const lunchSuitability = meal.lunchSuitability;
    const dinnerSuitability = meal.dinnerSuitability;
    const flags = flagsFromSuitability({
      breakfastSuitability,
      lunchSuitability,
      dinnerSuitability,
    });
    // Image only if it belongs to this recipe record; otherwise tasteful placeholder
    const image = resolveRecipeImage({
      matchedImageUrl: meal.imageUrl ?? null,
      matchedImageSource: meal.imageSource ?? null,
      matchedImageAttribution: meal.imageAttribution ?? null,
      breakfastSuitability,
      lunchSuitability,
      dinnerSuitability,
    });

    await prisma.meal.create({
      data: {
        name: meal.name,
        description: meal.description,
        instructions: meal.instructions,
        prepTimeMinutes: meal.prepTimeMinutes,
        cookTimeMinutes: meal.cookTimeMinutes,
        servings: meal.servings,
        tags: JSON.stringify(meal.tags),
        ingredients: JSON.stringify(meal.ingredients),
        source: MealSource.SEED,
        sourceTitle: meal.sourceTitle ?? "Plately seed catalogue",
        sourceUrl: meal.sourceUrl ?? null,
        imageUrl: image.imageUrl,
        imageSource: image.imageSource,
        imageAttribution: image.imageAttribution,
        breakfastSuitability,
        lunchSuitability,
        dinnerSuitability,
        suitableForBreakfast: flags.suitableForBreakfast,
        suitableForLunch: flags.suitableForLunch,
        suitableForDinner: flags.suitableForDinner,
        goodForLeftovers: meal.goodForLeftovers ?? false,
        leftoverStorageDays: meal.leftoverStorageDays ?? null,
        reheatsWell: meal.reheatsWell ?? false,
        batchFriendly: meal.batchFriendly ?? false,
      },
    });
  }

  const counts = await prisma.meal.findMany({
    select: {
      breakfastSuitability: true,
      lunchSuitability: true,
      dinnerSuitability: true,
      imageSource: true,
    },
  });
  const breakfast = counts.filter((m) => m.breakfastSuitability >= 0.7).length;
  const lunch = counts.filter((m) => m.lunchSuitability >= 0.7).length;
  const dinner = counts.filter((m) => m.dinnerSuitability >= 0.7).length;
  const placeholders = counts.filter((m) => m.imageSource === "placeholder").length;

  console.log(
    `Seeded ${counts.length} meals (breakfast-forward ${breakfast}, lunch-forward ${lunch}, dinner-forward ${dinner}; placeholders ${placeholders}).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
