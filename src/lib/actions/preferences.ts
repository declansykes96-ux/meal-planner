"use server";

import { PreferenceType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  addPreference,
  deletePreference,
  updatePreference,
} from "@/lib/services/preferences";
import {
  acceptDislikeSuggestion,
  dismissDislikeSuggestion,
} from "@/lib/services/preference-learning";

function refresh() {
  revalidatePath("/preferences");
  revalidatePath("/planner");
}

export async function addPreferenceAction(type: PreferenceType, value: string) {
  await addPreference(type, value);
  refresh();
}

export async function updatePreferenceAction(id: string, value: string) {
  await updatePreference(id, value);
  refresh();
}

export async function deletePreferenceAction(id: string) {
  await deletePreference(id);
  refresh();
}

export async function acceptDislikeSuggestionAction(ingredient: string) {
  await acceptDislikeSuggestion(ingredient);
  refresh();
}

export async function dismissDislikeSuggestionAction(ingredient: string) {
  await dismissDislikeSuggestion(ingredient);
  refresh();
}

export async function updateHouseholdSizeFromPrefsAction(householdSize: number) {
  const { updateHouseholdSizeAction } = await import("@/lib/actions/plans");
  await updateHouseholdSizeAction(householdSize);
}
