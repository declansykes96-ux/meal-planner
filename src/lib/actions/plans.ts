"use server";

import { PreferenceEventType, type PlanningStyle } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  assignMealToSlot,
  clearOccasionSlot,
  generateMealPlan,
  replaceOccasionMeal,
  setDayEnabled,
  setDayPlanningStyle,
  setSlotLocked,
  setSlotMealId,
  setSlotPlanningStyle,
  setWeekPlanningStyle,
  swapDayContents,
} from "@/lib/services/plans";
import { setFavourite } from "@/lib/services/meals";
import { recordEvent } from "@/lib/services/preferences";
import {
  saveHouseholdSize,
  savePlanningStylePreference,
  updateHouseholdSize,
  updatePreferredPlanningStyle,
} from "@/lib/services/household";
import { isPlanningStyle } from "@/lib/planning-style";

function refresh() {
  revalidatePath("/planner");
  revalidatePath("/meals");
  revalidatePath("/preferences");
}

export async function generatePlanAction(
  durationDays: 7 | 14,
  planningStyle?: PlanningStyle,
) {
  const style = planningStyle && isPlanningStyle(planningStyle) ? planningStyle : undefined;
  await generateMealPlan(durationDays, style);
  refresh();
}

/** Browse to another suggestion using this slot's effective Planning Style */
export async function anotherMealAction(slotId: string, excludeMealIds: string[] = []) {
  await replaceOccasionMeal(slotId, excludeMealIds);
  refresh();
}

/** Restore a previously browsed meal into this slot (history navigation — not preference). */
export async function restoreSlotMealAction(slotId: string, mealId: string) {
  await setSlotMealId(slotId, mealId);
  revalidatePath("/planner");
}

/** Remove — empties slot, does not mean recipe dislike */
export async function removeMealSlotAction(slotId: string) {
  await clearOccasionSlot(slotId);
  refresh();
}

export async function toggleLockAction(slotId: string, locked: boolean) {
  await setSlotLocked(slotId, locked);
  refresh();
}

export async function toggleDayEnabledAction(planId: string, dateKey: string, enabled: boolean) {
  await setDayEnabled(planId, dateKey, enabled);
  refresh();
}

/** Rearrange only — not preference behaviour */
export async function swapDaysAction(planId: string, dateKeyA: string, dateKeyB: string) {
  await swapDayContents(planId, dateKeyA, dateKeyB);
  refresh();
}

export async function assignMealToSlotAction(slotId: string, mealId: string) {
  await assignMealToSlot(slotId, mealId);
  refresh();
}

export async function setWeekPlanningStyleAction(planId: string, planningStyle: PlanningStyle) {
  if (!isPlanningStyle(planningStyle)) throw new Error("Invalid planning style");
  await setWeekPlanningStyle(planId, planningStyle);
  refresh();
}

export async function setDayPlanningStyleAction(
  planId: string,
  dateKey: string,
  planningStyle: PlanningStyle | null,
) {
  if (planningStyle != null && !isPlanningStyle(planningStyle)) {
    throw new Error("Invalid planning style");
  }
  await setDayPlanningStyle(planId, dateKey, planningStyle);
  refresh();
}

export async function setSlotPlanningStyleAction(
  slotId: string,
  planningStyle: PlanningStyle | null,
) {
  if (planningStyle != null && !isPlanningStyle(planningStyle)) {
    throw new Error("Invalid planning style");
  }
  await setSlotPlanningStyle(slotId, planningStyle);
  refresh();
}

export async function toggleFavouriteAction(mealId: string, favourite: boolean) {
  await setFavourite(mealId, favourite);
  await recordEvent({
    type: PreferenceEventType.MEAL_FAVOURITED,
    mealId,
    metadata: { favourite },
  });
  refresh();
}

/** Explicit thumbs: "up" | "down" | null (clear). Mutual exclusive. */
export async function setMealThumbAction(mealId: string, thumb: "up" | "down" | null) {
  const { setMealThumb } = await import("@/lib/services/preferences");
  await setMealThumb(mealId, thumb);
  refresh();
}

/** Strong dislike — same as thumbs down */
export async function blockMealAction(mealId: string) {
  const { setMealThumb } = await import("@/lib/services/preferences");
  await setMealThumb(mealId, "down");
  refresh();
}

export async function unblockMealAction(mealId: string) {
  const { setMealThumb } = await import("@/lib/services/preferences");
  await setMealThumb(mealId, null);
  refresh();
}

export async function completeHouseholdPromptAction(input: {
  householdSize: number;
  remember: boolean;
}) {
  await saveHouseholdSize(input);
  refresh();
}

export async function completePlanningStylePromptAction(input: {
  planningStyle: PlanningStyle;
  remember: boolean;
  durationDays: 7 | 14;
}) {
  if (!isPlanningStyle(input.planningStyle)) throw new Error("Invalid planning style");
  await savePlanningStylePreference({
    planningStyle: input.planningStyle,
    remember: input.remember,
  });
  await generateMealPlan(input.durationDays, input.planningStyle);
  refresh();
}

export async function updateHouseholdSizeAction(householdSize: number) {
  await updateHouseholdSize(householdSize);
  refresh();
}

export async function updatePreferredPlanningStyleAction(planningStyle: PlanningStyle) {
  if (!isPlanningStyle(planningStyle)) throw new Error("Invalid planning style");
  await updatePreferredPlanningStyle(planningStyle);
  refresh();
}

/** @deprecated use anotherMealAction */
export async function swipeReplaceAction(slotId: string) {
  return anotherMealAction(slotId);
}
