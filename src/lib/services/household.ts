import type { PlanningStyle } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type HouseholdSettingsRecord = {
  id: string;
  householdSize: number;
  rememberHouseholdSize: boolean;
  householdPromptCompleted: boolean;
  preferredPlanningStyle: PlanningStyle | null;
  rememberPlanningStyle: boolean;
};

export async function getHouseholdSettings(): Promise<HouseholdSettingsRecord> {
  const existing = await prisma.householdSettings.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (existing) {
    return {
      id: existing.id,
      householdSize: existing.householdSize,
      rememberHouseholdSize: existing.rememberHouseholdSize,
      householdPromptCompleted: existing.householdPromptCompleted,
      preferredPlanningStyle: existing.preferredPlanningStyle,
      rememberPlanningStyle: existing.rememberPlanningStyle,
    };
  }
  const created = await prisma.householdSettings.create({
    data: {
      householdSize: 2,
      rememberHouseholdSize: false,
      householdPromptCompleted: false,
      preferredPlanningStyle: null,
      rememberPlanningStyle: false,
    },
  });
  return {
    id: created.id,
    householdSize: created.householdSize,
    rememberHouseholdSize: created.rememberHouseholdSize,
    householdPromptCompleted: created.householdPromptCompleted,
    preferredPlanningStyle: created.preferredPlanningStyle,
    rememberPlanningStyle: created.rememberPlanningStyle,
  };
}

export async function saveHouseholdSize(input: {
  householdSize: number;
  remember: boolean;
}) {
  const size = Math.max(1, Math.floor(input.householdSize));
  const current = await getHouseholdSettings();
  return prisma.householdSettings.update({
    where: { id: current.id },
    data: {
      householdSize: size,
      rememberHouseholdSize: input.remember,
      householdPromptCompleted: true,
    },
  });
}

export async function updateHouseholdSize(householdSize: number) {
  const size = Math.max(1, Math.floor(householdSize));
  const current = await getHouseholdSettings();
  return prisma.householdSettings.update({
    where: { id: current.id },
    data: { householdSize: size, householdPromptCompleted: true },
  });
}

/** Default Planning Style for new plans: remembered preference, else BALANCED. */
export async function getDefaultPlanningStyle(): Promise<PlanningStyle> {
  const household = await getHouseholdSettings();
  if (household.rememberPlanningStyle && household.preferredPlanningStyle) {
    return household.preferredPlanningStyle;
  }
  return household.preferredPlanningStyle ?? "BALANCED";
}

export async function savePlanningStylePreference(input: {
  planningStyle: PlanningStyle;
  remember: boolean;
}) {
  const current = await getHouseholdSettings();
  return prisma.householdSettings.update({
    where: { id: current.id },
    data: {
      preferredPlanningStyle: input.planningStyle,
      rememberPlanningStyle: input.remember,
    },
  });
}

export async function updatePreferredPlanningStyle(planningStyle: PlanningStyle) {
  const current = await getHouseholdSettings();
  return prisma.householdSettings.update({
    where: { id: current.id },
    data: {
      preferredPlanningStyle: planningStyle,
      rememberPlanningStyle: true,
    },
  });
}
