import { MealType, OccasionKind, PreferenceEventType, type PlanningStyle } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getMealDiscoveryProvider } from "@/lib/services/discovery";
import { getDefaultPlanningStyle, getHouseholdSettings } from "@/lib/services/household";
import { getMealById, recordMealUsage, toMealRecord } from "@/lib/services/meals";
import { getPreferenceSnapshot, recordEvent } from "@/lib/services/preferences";
import {
  selectMealsForOccasion,
  suggestReplacementMeal,
} from "@/lib/services/recommendation";
import {
  parseDayPlanningStyles,
  resolveEffectivePlanningStyle,
  serializeDayPlanningStyles,
} from "@/lib/planning-style";
import { remainingServingsAfterOccasion } from "@/lib/types/meal";
import { addDays, getNextMonday, toDateKey } from "@/lib/utils/dates";

export const DAY_MEAL_TYPES: MealType[] = [
  MealType.BREAKFAST,
  MealType.LUNCH,
  MealType.DINNER,
];

const planInclude = {
  plannedMeals: {
    include: { meal: true, cookedMealBatch: true },
    orderBy: [{ date: "asc" as const }, { mealType: "asc" as const }],
  },
};

export type PlannedOccasion = {
  id: string;
  mealPlanId: string;
  mealId: string | null;
  date: Date;
  mealType: MealType;
  kind: OccasionKind;
  locked: boolean;
  enabled: boolean;
  planningStyle: PlanningStyle | null;
  cookedMealBatchId: string | null;
  meal: ReturnType<typeof toMealRecord> | null;
};

function mapSlot(slot: {
  id: string;
  mealPlanId: string;
  mealId: string | null;
  date: Date;
  mealType: MealType;
  kind: OccasionKind;
  locked: boolean;
  enabled: boolean;
  planningStyle?: PlanningStyle | null;
  cookedMealBatchId: string | null;
  meal: Parameters<typeof toMealRecord>[0] | null;
}): PlannedOccasion {
  return {
    id: slot.id,
    mealPlanId: slot.mealPlanId,
    mealId: slot.mealId,
    date: slot.date,
    mealType: slot.mealType,
    kind: slot.kind,
    locked: slot.locked,
    enabled: slot.enabled,
    planningStyle: slot.planningStyle ?? null,
    cookedMealBatchId: slot.cookedMealBatchId,
    meal: slot.meal ? toMealRecord(slot.meal) : null,
  };
}

export async function getActivePlan() {
  const plan = await prisma.mealPlan.findFirst({
    where: { isActive: true },
    include: planInclude,
    orderBy: { createdAt: "desc" },
  });
  if (!plan) return null;
  return {
    ...plan,
    plannedMeals: plan.plannedMeals.map(mapSlot),
  };
}

export type DaySummary = {
  dateKey: string;
  date: Date;
  enabled: boolean;
  occasions: PlannedOccasion[];
};

/** Week/fortnight day list for the main planner screen. */
export function groupPlanByDays(occasions: PlannedOccasion[]): DaySummary[] {
  const map = new Map<string, DaySummary>();
  for (const occasion of occasions) {
    const key = toDateKey(occasion.date);
    let day = map.get(key);
    if (!day) {
      day = { dateKey: key, date: occasion.date, enabled: true, occasions: [] };
      map.set(key, day);
    }
    day.occasions.push(occasion);
  }

  return [...map.values()]
    .map((day) => ({
      ...day,
      // Day is disabled when all occasions are disabled
      enabled: day.occasions.some((o) => o.enabled),
      occasions: DAY_MEAL_TYPES.map(
        (type) => day.occasions.find((o) => o.mealType === type)!,
      ).filter(Boolean),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function getOccasionsForDay(
  occasions: PlannedOccasion[],
  dateKey: string,
): PlannedOccasion[] {
  return DAY_MEAL_TYPES.map(
    (type) =>
      occasions.find((o) => toDateKey(o.date) === dateKey && o.mealType === type)!,
  ).filter(Boolean);
}

async function fillOccasion(input: {
  planId: string;
  date: Date;
  mealType: MealType;
  mealId: string;
  householdSize: number;
  locked?: boolean;
}) {
  const meal = await getMealById(input.mealId);
  if (!meal) throw new Error("Meal not found");

  const remaining = remainingServingsAfterOccasion(meal.servings, input.householdSize);
  const batch = await prisma.cookedMealBatch.create({
    data: {
      mealPlanId: input.planId,
      mealId: meal.id,
      recipeServings: meal.servings,
      servingsConsumed: input.householdSize,
      servingsRemaining: remaining,
      cookedOn: input.date,
    },
  });

  await prisma.plannedMeal.update({
    where: {
      mealPlanId_date_mealType: {
        mealPlanId: input.planId,
        date: input.date,
        mealType: input.mealType,
      },
    },
    data: {
      mealId: meal.id,
      kind: OccasionKind.COOK,
      locked: input.locked ?? false,
      enabled: true,
      cookedMealBatchId: batch.id,
    },
  });

  await recordMealUsage(meal.id);
}

export async function generateMealPlan(
  durationDays: 7 | 14,
  planningStyle?: PlanningStyle,
) {
  const household = await getHouseholdSettings();
  const householdSize = household.householdSize;
  const weekStyle = planningStyle ?? (await getDefaultPlanningStyle());
  const prefs = await getPreferenceSnapshot();
  const startDate = getNextMonday();

  const existing = await prisma.mealPlan.findFirst({
    where: { isActive: true },
    include: { plannedMeals: true },
  });

  // Preserve locked enabled occasions by date+type
  const lockedKeys = new Map<string, string>();
  const lockedMealIds: string[] = [];
  const preservedSlotStyles = new Map<string, PlanningStyle | null>();
  if (existing) {
    for (const slot of existing.plannedMeals) {
      const key = `${toDateKey(slot.date)}:${slot.mealType}`;
      preservedSlotStyles.set(key, slot.planningStyle);
      if (slot.locked && slot.enabled && slot.mealId) {
        lockedKeys.set(key, slot.mealId);
        lockedMealIds.push(slot.mealId);
      }
    }
  }

  const preservedDayStyles = existing
    ? parseDayPlanningStyles(existing.dayPlanningStyles)
    : {};

  const totalSlots = durationDays * DAY_MEAL_TYPES.length;
  const unlockedNeeded = totalSlots - lockedKeys.size;

  const pool = await getMealDiscoveryProvider().discoverMeals({
    householdSize,
    dislikedIngredients: prefs.disliked,
    likedIngredients: prefs.liked,
    recentMealIds: [...prefs.recentlyRejectedMealIds, ...lockedMealIds],
    desiredCount: Math.max(unlockedNeeded * 3, 80),
    // No mealType: need a mixed pool; hard occasion filter runs in suggestReplacementMeal
  });

  // Score unlocked slots with their effective style (week + preserved day/slot overrides)
  const already = new Set(lockedMealIds);
  const picksByKey = new Map<string, string>();

  for (let i = 0; i < durationDays; i++) {
    const date = addDays(startDate, i);
    const dateKey = toDateKey(date);
    for (const mealType of DAY_MEAL_TYPES) {
      const key = `${dateKey}:${mealType}`;
      if (lockedKeys.has(key)) continue;

      const effective = resolveEffectivePlanningStyle({
        weekStyle,
        dayStyle: preservedDayStyles[dateKey] ?? null,
        slotStyle: preservedSlotStyles.get(key) ?? null,
      });

      const pick = suggestReplacementMeal(
        pool,
        prefs,
        [...already],
        householdSize,
        effective,
        mealType,
      );
      if (!pick) continue;
      picksByKey.set(key, pick.id);
      already.add(pick.id);
    }
  }

  // Fallback fill per occasion if discovery was thin
  if (picksByKey.size < unlockedNeeded) {
    for (let i = 0; i < durationDays; i++) {
      const date = addDays(startDate, i);
      const dateKey = toDateKey(date);
      for (const mealType of DAY_MEAL_TYPES) {
        const key = `${dateKey}:${mealType}`;
        if (lockedKeys.has(key) || picksByKey.has(key)) continue;
        const [extra] = selectMealsForOccasion(
          pool,
          prefs,
          1,
          householdSize,
          mealType,
          [...already],
          weekStyle,
        );
        if (extra) {
          picksByKey.set(key, extra.id);
          already.add(extra.id);
        }
      }
    }
  }

  await prisma.mealPlan.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  const plan = await prisma.mealPlan.create({
    data: {
      startDate,
      durationDays,
      householdSize,
      planningStyle: weekStyle,
      dayPlanningStyles: serializeDayPlanningStyles(preservedDayStyles),
      isActive: true,
    },
  });

  for (let i = 0; i < durationDays; i++) {
    const date = addDays(startDate, i);
    for (const mealType of DAY_MEAL_TYPES) {
      const key = `${toDateKey(date)}:${mealType}`;
      await prisma.plannedMeal.create({
        data: {
          mealPlanId: plan.id,
          date,
          mealType,
          kind: OccasionKind.COOK,
          mealId: null,
          enabled: true,
          locked: false,
          planningStyle: preservedSlotStyles.get(key) ?? null,
        },
      });
    }
  }

  for (let i = 0; i < durationDays; i++) {
    const date = addDays(startDate, i);
    for (const mealType of DAY_MEAL_TYPES) {
      const key = `${toDateKey(date)}:${mealType}`;
      const lockedMealId = lockedKeys.get(key);
      const mealId = lockedMealId ?? picksByKey.get(key);
      if (!mealId) continue;

      await fillOccasion({
        planId: plan.id,
        date,
        mealType,
        mealId,
        householdSize,
        locked: Boolean(lockedMealId),
      });
    }
  }

  return getActivePlan();
}

/** Browse to another suggestion for this slot only. */
export async function replaceOccasionMeal(slotId: string, extraExcludeIds: string[] = []) {
  const slot = await prisma.plannedMeal.findUnique({
    where: { id: slotId },
    include: { mealPlan: { include: { plannedMeals: true } } },
  });
  if (!slot) throw new Error("Slot not found");
  if (!slot.enabled) throw new Error("This day/slot is disabled");
  if (slot.locked) throw new Error("Unlock this meal before replacing it");

  const householdSize = slot.mealPlan.householdSize;
  const dateKey = toDateKey(slot.date);
  const dayStyles = parseDayPlanningStyles(slot.mealPlan.dayPlanningStyles);
  const effectiveStyle = resolveEffectivePlanningStyle({
    weekStyle: slot.mealPlan.planningStyle,
    dayStyle: dayStyles[dateKey] ?? null,
    slotStyle: slot.planningStyle,
  });

  const prefs = await getPreferenceSnapshot();
  const pool = await getMealDiscoveryProvider().discoverMeals({
    householdSize,
    dislikedIngredients: prefs.disliked,
    likedIngredients: prefs.liked,
    recentMealIds: prefs.recentlyRejectedMealIds,
    desiredCount: 12,
    mealType: slot.mealType,
  });

  const excludeIds = [
    ...slot.mealPlan.plannedMeals
      .filter((s) => s.enabled && s.mealId)
      .map((s) => s.mealId!),
    ...(slot.mealId ? [slot.mealId] : []),
    ...extraExcludeIds,
  ];

  const replacement = suggestReplacementMeal(
    pool,
    prefs,
    excludeIds,
    householdSize,
    effectiveStyle,
    slot.mealType,
  );
  if (!replacement) throw new Error("No alternative meals available");

  if (slot.mealId) {
    // Variety / history only — NOT an explicit food dislike (use thumbs-down for that)
    await recordEvent({
      type: PreferenceEventType.MEAL_REPLACED,
      mealId: slot.mealId,
      metadata: {
        signal: "variety_only",
        via: "browse_next",
        meaning: "another_option_not_dislike",
        slotId,
        mealType: slot.mealType,
        dateKey,
        planningStyle: effectiveStyle,
        householdSize,
        newMealId: replacement.id,
      },
    });
  }

  const remaining = remainingServingsAfterOccasion(replacement.servings, householdSize);
  const batch = await prisma.cookedMealBatch.create({
    data: {
      mealPlanId: slot.mealPlanId,
      mealId: replacement.id,
      recipeServings: replacement.servings,
      servingsConsumed: householdSize,
      servingsRemaining: remaining,
      cookedOn: slot.date,
    },
  });

  const updated = await prisma.plannedMeal.update({
    where: { id: slotId },
    data: {
      mealId: replacement.id,
      kind: OccasionKind.COOK,
      cookedMealBatchId: batch.id,
    },
    include: { meal: true },
  });

  await recordMealUsage(replacement.id);
  return mapSlot({ ...updated, enabled: updated.enabled });
}

export type NextMealPreview = {
  id: string;
  name: string;
  imageUrl: string | null;
};

export type AdjacentMealPeeks = {
  next: NextMealPreview | null;
  prev: NextMealPreview | null;
};

/** Peek two alternative meals for each slot (either side of the option wheel). */
export async function peekNextMealsForPlan(
  plan: {
    planningStyle: PlanningStyle;
    dayPlanningStyles: string;
    householdSize: number;
    plannedMeals: {
      id: string;
      mealId: string | null;
      enabled: boolean;
      date: Date;
      mealType: MealType;
      planningStyle: PlanningStyle | null;
    }[];
  },
): Promise<Record<string, AdjacentMealPeeks>> {
  const prefs = await getPreferenceSnapshot();
  const householdSize = plan.householdSize;
  const dayStyles = parseDayPlanningStyles(plan.dayPlanningStyles);

  const pools = await Promise.all(
    (["BREAKFAST", "LUNCH", "DINNER"] as const).map(async (mealType) => {
      const pool = await getMealDiscoveryProvider().discoverMeals({
        householdSize,
        dislikedIngredients: prefs.disliked,
        likedIngredients: prefs.liked,
        recentMealIds: prefs.recentlyRejectedMealIds,
        desiredCount: 36,
        mealType,
      });
      return [mealType, pool] as const;
    }),
  );
  const poolByType: Partial<Record<MealType, (typeof pools)[number][1]>> = Object.fromEntries(pools);

  const plannedIds = plan.plannedMeals
    .filter((s) => s.enabled && s.mealId)
    .map((s) => s.mealId!);

  const result: Record<string, AdjacentMealPeeks> = {};
  for (const slot of plan.plannedMeals) {
    if (!slot.enabled || !slot.mealId) {
      result[slot.id] = { next: null, prev: null };
      continue;
    }
    const dateKey = toDateKey(slot.date);
    const effective = resolveEffectivePlanningStyle({
      weekStyle: plan.planningStyle,
      dayStyle: dayStyles[dateKey] ?? null,
      slotStyle: slot.planningStyle,
    });
    const pool = poolByType[slot.mealType] ?? [];
    const excludeIds = [...plannedIds, slot.mealId];
    const nextMeal = suggestReplacementMeal(
      pool,
      prefs,
      excludeIds,
      householdSize,
      effective,
      slot.mealType,
    );
    const next = nextMeal
      ? { id: nextMeal.id, name: nextMeal.name, imageUrl: nextMeal.imageUrl }
      : null;
    const prevMeal = suggestReplacementMeal(
      pool,
      prefs,
      next ? [...excludeIds, next.id] : excludeIds,
      householdSize,
      effective,
      slot.mealType,
    );
    const prev = prevMeal
      ? { id: prevMeal.id, name: prevMeal.name, imageUrl: prevMeal.imageUrl }
      : null;
    result[slot.id] = { next, prev };
  }
  return result;
}

/**
 * Swipe left — clear the slot. Does NOT mean the recipe is disliked.
 */
export async function clearOccasionSlot(slotId: string) {
  const slot = await prisma.plannedMeal.findUnique({ where: { id: slotId } });
  if (!slot) throw new Error("Slot not found");
  if (!slot.enabled) throw new Error("This day/slot is disabled");
  if (slot.locked) throw new Error("Unlock this meal before removing it");

  await recordEvent({
    type: PreferenceEventType.MEAL_SLOT_CLEARED,
    mealId: slot.mealId,
    metadata: {
      signal: "none",
      via: "remove_slot",
      meaning: "scheduling_only_not_dislike",
      slotId,
    },
  });

  const updated = await prisma.plannedMeal.update({
    where: { id: slotId },
    data: {
      mealId: null,
      cookedMealBatchId: null,
      kind: OccasionKind.COOK,
    },
    include: { meal: true },
  });

  return mapSlot(updated);
}

export async function setSlotLocked(slotId: string, locked: boolean) {
  const slot = await prisma.plannedMeal.update({
    where: { id: slotId },
    data: { locked },
    include: { meal: true },
  });
  if (slot.mealId) {
    await recordEvent({
      type: locked ? PreferenceEventType.MEAL_LOCKED : PreferenceEventType.MEAL_UNLOCKED,
      mealId: slot.mealId,
      metadata: { slotId },
    });
  }
  return mapSlot(slot);
}

export async function setDayEnabled(planId: string, dateKey: string, enabled: boolean) {
  const plan = await prisma.mealPlan.findUnique({
    where: { id: planId },
    include: { plannedMeals: true },
  });
  if (!plan) throw new Error("Plan not found");

  const daySlots = plan.plannedMeals.filter((s) => toDateKey(s.date) === dateKey);
  if (daySlots.length === 0) throw new Error("Day not found on plan");

  await prisma.plannedMeal.updateMany({
    where: { id: { in: daySlots.map((s) => s.id) } },
    data: { enabled },
  });

  return getActivePlan();
}

/**
 * Swap B/L/D meal assignments between two calendar days.
 * Dates/names stay put — only slot contents move. No preference events.
 */
export async function swapDayContents(
  planId: string,
  dateKeyA: string,
  dateKeyB: string,
) {
  if (dateKeyA === dateKeyB) return getActivePlan();

  const plan = await prisma.mealPlan.findUnique({
    where: { id: planId },
    include: { plannedMeals: true },
  });
  if (!plan) throw new Error("Plan not found");

  const slotsA = plan.plannedMeals.filter((s) => toDateKey(s.date) === dateKeyA);
  const slotsB = plan.plannedMeals.filter((s) => toDateKey(s.date) === dateKeyB);
  if (slotsA.length === 0 || slotsB.length === 0) {
    throw new Error("One or both days were not found on this plan");
  }

  await prisma.$transaction(async (tx) => {
    for (const mealType of DAY_MEAL_TYPES) {
      const a = slotsA.find((s) => s.mealType === mealType);
      const b = slotsB.find((s) => s.mealType === mealType);
      if (!a || !b) continue;

      const aContent = {
        mealId: a.mealId,
        kind: a.kind,
        locked: a.locked,
        cookedMealBatchId: a.cookedMealBatchId,
        planningStyle: a.planningStyle,
      };
      const bContent = {
        mealId: b.mealId,
        kind: b.kind,
        locked: b.locked,
        cookedMealBatchId: b.cookedMealBatchId,
        planningStyle: b.planningStyle,
      };

      await tx.plannedMeal.update({ where: { id: a.id }, data: bContent });
      await tx.plannedMeal.update({ where: { id: b.id }, data: aContent });
    }

    const dayStyles = parseDayPlanningStyles(plan.dayPlanningStyles);
    const styleA = dayStyles[dateKeyA];
    const styleB = dayStyles[dateKeyB];
    if (styleB) dayStyles[dateKeyA] = styleB;
    else delete dayStyles[dateKeyA];
    if (styleA) dayStyles[dateKeyB] = styleA;
    else delete dayStyles[dateKeyB];
    await tx.mealPlan.update({
      where: { id: planId },
      data: { dayPlanningStyles: serializeDayPlanningStyles(dayStyles) },
    });
  });

  const { swapDayHeroes } = await import("@/lib/services/day-heroes");
  await swapDayHeroes(planId, dateKeyA, dateKeyB);

  return getActivePlan();
}

export async function setWeekPlanningStyle(planId: string, planningStyle: PlanningStyle) {
  await prisma.mealPlan.update({
    where: { id: planId },
    data: { planningStyle },
  });
  return getActivePlan();
}

/** Set or clear a day-level Planning Style override. */
export async function setDayPlanningStyle(
  planId: string,
  dateKey: string,
  planningStyle: PlanningStyle | null,
) {
  const plan = await prisma.mealPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan not found");
  const dayStyles = parseDayPlanningStyles(plan.dayPlanningStyles);
  if (planningStyle) dayStyles[dateKey] = planningStyle;
  else delete dayStyles[dateKey];
  await prisma.mealPlan.update({
    where: { id: planId },
    data: { dayPlanningStyles: serializeDayPlanningStyles(dayStyles) },
  });
  return getActivePlan();
}

/** Set or clear a meal-slot Planning Style override. */
export async function setSlotPlanningStyle(
  slotId: string,
  planningStyle: PlanningStyle | null,
) {
  const updated = await prisma.plannedMeal.update({
    where: { id: slotId },
    data: { planningStyle },
    include: { meal: true },
  });
  return mapSlot(updated);
}

export async function assignMealToSlot(slotId: string, mealId: string) {
  const slot = await prisma.plannedMeal.findUnique({
    where: { id: slotId },
    include: { mealPlan: true },
  });
  if (!slot) throw new Error("Slot not found");
  if (!slot.enabled) throw new Error("This day/slot is disabled");
  if (slot.locked) throw new Error("Unlock this meal before changing it");

  const meal = await getMealById(mealId);
  if (!meal) throw new Error("Meal not found");

  const remaining = remainingServingsAfterOccasion(meal.servings, slot.mealPlan.householdSize);
  const batch = await prisma.cookedMealBatch.create({
    data: {
      mealPlanId: slot.mealPlanId,
      mealId: meal.id,
      recipeServings: meal.servings,
      servingsConsumed: slot.mealPlan.householdSize,
      servingsRemaining: remaining,
      cookedOn: slot.date,
    },
  });

  const updated = await prisma.plannedMeal.update({
    where: { id: slotId },
    data: {
      mealId: meal.id,
      kind: OccasionKind.COOK,
      cookedMealBatchId: batch.id,
    },
    include: { meal: true },
  });

  return mapSlot(updated);
}

/**
 * Fast path for browsing the option wheel — only swaps the meal id.
 * No cooked-batch rebuild (that happens when the choice is settled via assign).
 */
export async function setSlotMealId(slotId: string, mealId: string) {
  const slot = await prisma.plannedMeal.findUnique({ where: { id: slotId } });
  if (!slot) throw new Error("Slot not found");
  if (!slot.enabled) throw new Error("This day/slot is disabled");
  if (slot.locked) throw new Error("Unlock this meal before changing it");

  const meal = await getMealById(mealId);
  if (!meal) throw new Error("Meal not found");

  const updated = await prisma.plannedMeal.update({
    where: { id: slotId },
    data: {
      mealId: meal.id,
      kind: OccasionKind.COOK,
    },
    include: { meal: true },
  });

  return mapSlot(updated);
}
