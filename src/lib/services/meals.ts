import type { Meal, MealSource } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { flagsFromSuitability } from "@/lib/meal-occasion";
import {
  parseIngredients,
  parseTags,
  serializeIngredients,
  serializeTags,
  type CreateMealInput,
  type MealRecord,
  type UpdateMealInput,
} from "@/lib/types/meal";

export function toMealRecord(meal: Meal): MealRecord {
  const breakfastSuitability = meal.breakfastSuitability ?? 0;
  const lunchSuitability = meal.lunchSuitability ?? 0.5;
  const dinnerSuitability = meal.dinnerSuitability ?? 0.5;
  const flags = flagsFromSuitability({
    breakfastSuitability,
    lunchSuitability,
    dinnerSuitability,
  });

  return {
    id: meal.id,
    name: meal.name,
    description: meal.description,
    ingredients: parseIngredients(meal.ingredients),
    instructions: meal.instructions,
    prepTimeMinutes: meal.prepTimeMinutes,
    cookTimeMinutes: meal.cookTimeMinutes,
    servings: meal.servings,
    tags: parseTags(meal.tags),
    favourite: meal.favourite,
    timesUsed: meal.timesUsed,
    lastUsedAt: meal.lastUsedAt,
    source: meal.source,
    imageUrl: meal.imageUrl,
    imageSource: meal.imageSource ?? null,
    imageAttribution: meal.imageAttribution ?? null,
    goodForLeftovers: meal.goodForLeftovers,
    leftoverStorageDays: meal.leftoverStorageDays,
    reheatsWell: meal.reheatsWell,
    batchFriendly: meal.batchFriendly,
    estimatedIngredientCost: meal.estimatedIngredientCost,
    breakfastSuitability,
    lunchSuitability,
    dinnerSuitability,
    suitableForLunch: meal.suitableForLunch ?? flags.suitableForLunch,
    suitableForDinner: meal.suitableForDinner ?? flags.suitableForDinner,
    suitableForBreakfast: meal.suitableForBreakfast ?? flags.suitableForBreakfast,
    sourceTitle: meal.sourceTitle,
    sourceUrl: meal.sourceUrl,
    discoveredAt: meal.discoveredAt,
    createdAt: meal.createdAt,
    updatedAt: meal.updatedAt,
  };
}

export async function listMeals(search?: string): Promise<MealRecord[]> {
  const meals = await prisma.meal.findMany({
    orderBy: [{ favourite: "desc" }, { timesUsed: "desc" }, { name: "asc" }],
  });
  const mapped = meals.map(toMealRecord);
  if (!search?.trim()) return mapped;
  const q = search.trim().toLowerCase();
  return mapped.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.tags.some((t) => t.toLowerCase().includes(q)),
  );
}

export async function getMealById(id: string): Promise<MealRecord | null> {
  const meal = await prisma.meal.findUnique({ where: { id } });
  return meal ? toMealRecord(meal) : null;
}

export async function createMeal(input: CreateMealInput): Promise<MealRecord> {
  const breakfastSuitability = input.breakfastSuitability ?? 0;
  const lunchSuitability = input.lunchSuitability ?? 0.5;
  const dinnerSuitability = input.dinnerSuitability ?? 0.5;
  const flags = flagsFromSuitability({
    breakfastSuitability,
    lunchSuitability,
    dinnerSuitability,
  });

  const meal = await prisma.meal.create({
    data: {
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      instructions: input.instructions?.trim() ?? "",
      ingredients: serializeIngredients(input.ingredients ?? []),
      tags: serializeTags(input.tags ?? []),
      prepTimeMinutes: input.prepTimeMinutes ?? null,
      cookTimeMinutes: input.cookTimeMinutes ?? null,
      servings: input.servings ?? 4,
      favourite: input.favourite ?? false,
      source: (input.source as MealSource | undefined) ?? "MANUAL",
      imageUrl: input.imageUrl ?? null,
      imageSource: input.imageSource ?? null,
      imageAttribution: input.imageAttribution ?? null,
      goodForLeftovers: input.goodForLeftovers ?? false,
      leftoverStorageDays: input.leftoverStorageDays ?? null,
      reheatsWell: input.reheatsWell ?? false,
      batchFriendly: input.batchFriendly ?? false,
      estimatedIngredientCost: input.estimatedIngredientCost ?? null,
      breakfastSuitability,
      lunchSuitability,
      dinnerSuitability,
      suitableForLunch: input.suitableForLunch ?? flags.suitableForLunch,
      suitableForDinner: input.suitableForDinner ?? flags.suitableForDinner,
      suitableForBreakfast: input.suitableForBreakfast ?? flags.suitableForBreakfast,
      sourceTitle: input.sourceTitle ?? null,
      sourceUrl: input.sourceUrl ?? null,
      discoveredAt: input.source === "WEB" || input.source === "AI" ? new Date() : null,
    },
  });
  return toMealRecord(meal);
}

export async function updateMeal(input: UpdateMealInput): Promise<MealRecord> {
  const { id, ...rest } = input;
  const meal = await prisma.meal.update({
    where: { id },
    data: {
      ...(rest.name !== undefined ? { name: rest.name.trim() } : {}),
      ...(rest.description !== undefined ? { description: rest.description.trim() } : {}),
      ...(rest.instructions !== undefined ? { instructions: rest.instructions.trim() } : {}),
      ...(rest.ingredients !== undefined
        ? { ingredients: serializeIngredients(rest.ingredients) }
        : {}),
      ...(rest.tags !== undefined ? { tags: serializeTags(rest.tags) } : {}),
      ...(rest.prepTimeMinutes !== undefined ? { prepTimeMinutes: rest.prepTimeMinutes } : {}),
      ...(rest.cookTimeMinutes !== undefined ? { cookTimeMinutes: rest.cookTimeMinutes } : {}),
      ...(rest.servings !== undefined ? { servings: rest.servings } : {}),
      ...(rest.favourite !== undefined ? { favourite: rest.favourite } : {}),
      ...(rest.imageUrl !== undefined ? { imageUrl: rest.imageUrl } : {}),
      ...(rest.imageSource !== undefined ? { imageSource: rest.imageSource } : {}),
      ...(rest.imageAttribution !== undefined ? { imageAttribution: rest.imageAttribution } : {}),
      ...(rest.goodForLeftovers !== undefined ? { goodForLeftovers: rest.goodForLeftovers } : {}),
      ...(rest.leftoverStorageDays !== undefined
        ? { leftoverStorageDays: rest.leftoverStorageDays }
        : {}),
      ...(rest.reheatsWell !== undefined ? { reheatsWell: rest.reheatsWell } : {}),
      ...(rest.batchFriendly !== undefined ? { batchFriendly: rest.batchFriendly } : {}),
      ...(rest.estimatedIngredientCost !== undefined
        ? { estimatedIngredientCost: rest.estimatedIngredientCost }
        : {}),
      ...(rest.breakfastSuitability !== undefined
        ? { breakfastSuitability: rest.breakfastSuitability }
        : {}),
      ...(rest.lunchSuitability !== undefined ? { lunchSuitability: rest.lunchSuitability } : {}),
      ...(rest.dinnerSuitability !== undefined ? { dinnerSuitability: rest.dinnerSuitability } : {}),
      ...(rest.suitableForLunch !== undefined ? { suitableForLunch: rest.suitableForLunch } : {}),
      ...(rest.suitableForDinner !== undefined ? { suitableForDinner: rest.suitableForDinner } : {}),
      ...(rest.suitableForBreakfast !== undefined
        ? { suitableForBreakfast: rest.suitableForBreakfast }
        : {}),
      ...(rest.sourceTitle !== undefined ? { sourceTitle: rest.sourceTitle } : {}),
      ...(rest.sourceUrl !== undefined ? { sourceUrl: rest.sourceUrl } : {}),
    },
  });
  return toMealRecord(meal);
}

export async function setFavourite(mealId: string, favourite: boolean) {
  return toMealRecord(
    await prisma.meal.update({ where: { id: mealId }, data: { favourite } }),
  );
}

export async function recordMealUsage(mealId: string) {
  return prisma.meal.update({
    where: { id: mealId },
    data: { timesUsed: { increment: 1 }, lastUsedAt: new Date() },
  });
}

export async function removeIngredientFromMeal(mealId: string, ingredientName: string) {
  const meal = await getMealById(mealId);
  if (!meal) throw new Error("Meal not found");
  const next = meal.ingredients.filter(
    (i) => i.name.trim().toLowerCase() !== ingredientName.trim().toLowerCase(),
  );
  return updateMeal({ id: mealId, ingredients: next });
}
