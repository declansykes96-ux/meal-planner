import { MealSource, PrismaClient } from "@prisma/client";
import { CATALOGUE_MEALS } from "./data/catalogue";
import { resolveMealImage } from "../src/lib/meal-images";
import { flagsFromSuitability } from "../src/lib/meal-occasion";

const prisma = new PrismaClient();

async function main() {
  console.log(`Seeding ${CATALOGUE_MEALS.length} catalogue meals…`);

  await prisma.preferenceEvent.deleteMany();
  await prisma.preference.deleteMany();
  await prisma.plannedMeal.deleteMany();
  await prisma.cookedMealBatch.deleteMany();
  await prisma.mealPlan.deleteMany();
  await prisma.meal.deleteMany();

  for (const meal of CATALOGUE_MEALS) {
    const breakfastSuitability = meal.breakfastSuitability;
    const lunchSuitability = meal.lunchSuitability;
    const dinnerSuitability = meal.dinnerSuitability;
    const flags = flagsFromSuitability({
      breakfastSuitability,
      lunchSuitability,
      dinnerSuitability,
    });
    const image = resolveMealImage({
      name: meal.name,
      tags: meal.tags,
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
    },
  });
  const breakfast = counts.filter((m) => m.breakfastSuitability >= 0.7).length;
  const lunch = counts.filter((m) => m.lunchSuitability >= 0.7).length;
  const dinner = counts.filter((m) => m.dinnerSuitability >= 0.7).length;

  console.log(
    `Seeded ${counts.length} meals (breakfast-forward ${breakfast}, lunch-forward ${lunch}, dinner-forward ${dinner}).`,
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
