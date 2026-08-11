"use server";

import { PreferenceEventType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  createMeal,
  removeIngredientFromMeal,
  setFavourite,
  updateMeal,
} from "@/lib/services/meals";
import { assignMealToSlot } from "@/lib/services/plans";
import { recordEvent } from "@/lib/services/preferences";
import type { CreateMealInput, IngredientLine } from "@/lib/types/meal";

function refresh() {
  revalidatePath("/planner");
  revalidatePath("/meals");
  revalidatePath("/preferences");
}

export async function createMealAction(input: CreateMealInput & { assignToSlotId?: string }) {
  const { assignToSlotId, ...mealInput } = input;
  const meal = await createMeal(mealInput);
  if (assignToSlotId) {
    await assignMealToSlot(assignToSlotId, meal.id);
  }
  refresh();
  return { mealId: meal.id };
}

export async function updateMealAction(input: {
  id: string;
  name?: string;
  description?: string;
  instructions?: string;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  servings?: number;
  tags?: string[];
  ingredients?: IngredientLine[];
}) {
  await updateMeal(input);
  refresh();
}

export async function removeIngredientAction(mealId: string, ingredientName: string) {
  await removeIngredientFromMeal(mealId, ingredientName);
  await recordEvent({
    type: PreferenceEventType.INGREDIENT_REMOVED,
    mealId,
    ingredient: ingredientName,
  });
  refresh();
}

export async function recordIngredientRemovedAction(mealId: string, ingredientName: string) {
  await recordEvent({
    type: PreferenceEventType.INGREDIENT_REMOVED,
    mealId,
    ingredient: ingredientName,
  });
  refresh();
}

export async function substituteIngredientAction(
  mealId: string,
  fromName: string,
  toName: string,
  quantity?: number | null,
  unit?: string | null,
) {
  const { getMealById, updateMeal: update } = await import("@/lib/services/meals");
  const meal = await getMealById(mealId);
  if (!meal) throw new Error("Meal not found");
  const ingredients = meal.ingredients.map((line) => {
    if (line.name.trim().toLowerCase() !== fromName.trim().toLowerCase()) return line;
    return { name: toName.trim(), quantity: quantity ?? line.quantity, unit: unit ?? line.unit };
  });
  await update({ id: mealId, ingredients });
  await recordEvent({
    type: PreferenceEventType.INGREDIENT_SUBSTITUTED,
    mealId,
    ingredient: fromName,
    replacementIngredient: toName,
  });
  refresh();
}

export async function toggleMealFavouriteAction(mealId: string, favourite: boolean) {
  await setFavourite(mealId, favourite);
  await recordEvent({
    type: PreferenceEventType.MEAL_FAVOURITED,
    mealId,
    metadata: { favourite },
  });
  refresh();
}
