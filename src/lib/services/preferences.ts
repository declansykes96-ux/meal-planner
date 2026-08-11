import { PreferenceEventType, PreferenceType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { MealThumb } from "@/lib/preference-signals";
import { VARIETY_HISTORY_WINDOW_DAYS } from "@/lib/preference-signals";
import { setFavourite } from "@/lib/services/meals";
import { normalizeName } from "@/lib/utils/dates";

export async function recordEvent(input: {
  type: PreferenceEventType;
  mealId?: string | null;
  ingredient?: string | null;
  replacementIngredient?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return prisma.preferenceEvent.create({
    data: {
      type: input.type,
      mealId: input.mealId ?? null,
      ingredient: input.ingredient?.trim() || null,
      replacementIngredient: input.replacementIngredient?.trim() || null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

export async function listPreferencesByType(type: PreferenceType) {
  return prisma.preference.findMany({
    where: { type },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listAllPreferences() {
  return prisma.preference.findMany({ orderBy: [{ type: "asc" }, { value: "asc" }] });
}

export async function addPreference(type: PreferenceType, value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Value is required");

  const existing = await prisma.preference.findFirst({
    where: {
      type,
      value: { equals: trimmed },
    },
  });
  if (existing) {
    return prisma.preference.update({
      where: { id: existing.id },
      data: { value: trimmed },
    });
  }

  if (
    type === PreferenceType.LIKED_INGREDIENT ||
    type === PreferenceType.DISLIKED_INGREDIENT
  ) {
    const all = await prisma.preference.findMany({ where: { type } });
    const match = all.find((p) => normalizeName(p.value) === normalizeName(trimmed));
    if (match) {
      return prisma.preference.update({
        where: { id: match.id },
        data: { value: trimmed },
      });
    }
  }

  return prisma.preference.create({ data: { type, value: trimmed } });
}

export async function updatePreference(id: string, value: string) {
  return prisma.preference.update({
    where: { id },
    data: { value: value.trim() },
  });
}

export async function deletePreference(id: string) {
  return prisma.preference.delete({ where: { id } });
}

async function deleteMealPrefs(mealId: string, type: PreferenceType) {
  const prefs = await prisma.preference.findMany({ where: { type, value: mealId } });
  for (const pref of prefs) {
    await prisma.preference.delete({ where: { id: pref.id } });
  }
}

/**
 * Explicit thumbs feedback. Mutual exclusive; tap same again clears (thumb=null).
 * Does not infer ingredient likes/dislikes.
 */
export async function setMealThumb(mealId: string, thumb: MealThumb) {
  await deleteMealPrefs(mealId, PreferenceType.LIKED_MEAL);
  await deleteMealPrefs(mealId, PreferenceType.DISLIKED_MEAL);

  if (thumb === "up") {
    await addPreference(PreferenceType.LIKED_MEAL, mealId);
    await setFavourite(mealId, true);
    await recordEvent({
      type: PreferenceEventType.MEAL_ACCEPTED,
      mealId,
      metadata: { signal: "thumbs_up", via: "thumbs", scope: "meal_general" },
    });
    return "up" as const;
  }

  if (thumb === "down") {
    await addPreference(PreferenceType.DISLIKED_MEAL, mealId);
    await setFavourite(mealId, false);
    await recordEvent({
      type: PreferenceEventType.MEAL_BLOCKED,
      mealId,
      metadata: { signal: "thumbs_down", via: "thumbs", scope: "meal_general" },
    });
    return "down" as const;
  }

  await setFavourite(mealId, false);
  return null;
}

/** @deprecated prefer setMealThumb(mealId, "down") */
export async function blockMeal(mealId: string) {
  return setMealThumb(mealId, "down");
}

/** @deprecated prefer setMealThumb(mealId, null) when clearing thumbs-down */
export async function unblockMeal(mealId: string) {
  const disliked = await prisma.preference.findFirst({
    where: { type: PreferenceType.DISLIKED_MEAL, value: mealId },
  });
  if (!disliked) return;
  await setMealThumb(mealId, null);
}

export async function listBlockedMeals(): Promise<
  { preferenceId: string; mealId: string; name: string }[]
> {
  const prefs = await prisma.preference.findMany({
    where: { type: PreferenceType.DISLIKED_MEAL },
    orderBy: { updatedAt: "desc" },
  });
  if (prefs.length === 0) return [];
  const meals = await prisma.meal.findMany({
    where: { id: { in: prefs.map((p) => p.value) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(meals.map((m) => [m.id, m.name]));
  return prefs.map((p) => ({
    preferenceId: p.id,
    mealId: p.value,
    name: nameById.get(p.value) ?? "Unknown meal",
  }));
}

export async function listLikedMeals(): Promise<
  { preferenceId: string; mealId: string; name: string }[]
> {
  const prefs = await prisma.preference.findMany({
    where: { type: PreferenceType.LIKED_MEAL },
    orderBy: { updatedAt: "desc" },
  });
  if (prefs.length === 0) return [];
  const meals = await prisma.meal.findMany({
    where: { id: { in: prefs.map((p) => p.value) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(meals.map((m) => [m.id, m.name]));
  return prefs.map((p) => ({
    preferenceId: p.id,
    mealId: p.value,
    name: nameById.get(p.value) ?? "Unknown meal",
  }));
}

export type PreferenceSnapshot = {
  disliked: string[];
  liked: string[];
  dietaryRestrictions: string[];
  notes: string[];
  /** Explicit thumbs-down — hard exclude */
  blockedMealIds: string[];
  /** Explicit thumbs-up — modest positive weight */
  likedMealIds: string[];
  /**
   * Recent swipe-right replacements for short-term variety only.
   * Not a food-preference dislike.
   */
  recentlyReplacedMealIds: string[];
  /** @deprecated alias of recentlyReplacedMealIds */
  recentlyRejectedMealIds: string[];
  /**
   * User-specific occasion suitability overrides (win over AU defaults).
   * Keys are mealIds.
   */
  occasionOverrides: Record<
    string,
    { breakfast?: number; lunch?: number; dinner?: number }
  >;
};

export async function getPreferenceSnapshot(): Promise<PreferenceSnapshot> {
  const since = new Date();
  since.setDate(since.getDate() - VARIETY_HISTORY_WINDOW_DAYS);

  const [prefs, replaceEvents] = await Promise.all([
    prisma.preference.findMany(),
    prisma.preferenceEvent.findMany({
      where: {
        type: PreferenceEventType.MEAL_REPLACED,
        createdAt: { gte: since },
        mealId: { not: null },
      },
      select: { mealId: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const recentlyReplacedMealIds = [
    ...new Set(replaceEvents.map((e) => e.mealId!).filter(Boolean)),
  ];

  const occasionOverrides: PreferenceSnapshot["occasionOverrides"] = {};
  for (const pref of prefs.filter((p) => p.type === PreferenceType.MEAL_OCCASION_OVERRIDE)) {
    try {
      const parsed = JSON.parse(pref.value) as {
        mealId?: string;
        breakfast?: number;
        lunch?: number;
        dinner?: number;
      };
      if (!parsed.mealId) continue;
      occasionOverrides[parsed.mealId] = {
        ...(parsed.breakfast != null ? { breakfast: parsed.breakfast } : {}),
        ...(parsed.lunch != null ? { lunch: parsed.lunch } : {}),
        ...(parsed.dinner != null ? { dinner: parsed.dinner } : {}),
      };
    } catch {
      /* ignore malformed override */
    }
  }

  return {
    disliked: prefs
      .filter((p) => p.type === PreferenceType.DISLIKED_INGREDIENT)
      .map((p) => normalizeName(p.value)),
    liked: prefs
      .filter((p) => p.type === PreferenceType.LIKED_INGREDIENT)
      .map((p) => normalizeName(p.value)),
    dietaryRestrictions: prefs
      .filter((p) => p.type === PreferenceType.DIETARY_RESTRICTION)
      .map((p) => p.value),
    notes: prefs
      .filter((p) => p.type === PreferenceType.PREFERENCE_NOTE)
      .map((p) => p.value),
    blockedMealIds: prefs
      .filter((p) => p.type === PreferenceType.DISLIKED_MEAL)
      .map((p) => p.value),
    likedMealIds: prefs
      .filter((p) => p.type === PreferenceType.LIKED_MEAL)
      .map((p) => p.value),
    recentlyReplacedMealIds,
    recentlyRejectedMealIds: recentlyReplacedMealIds,
    occasionOverrides,
  };
}

export async function listRecentEvents(limit = 40) {
  return prisma.preferenceEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { meal: { select: { id: true, name: true } } },
  });
}

export function thumbForMeal(
  mealId: string,
  prefs: Pick<PreferenceSnapshot, "likedMealIds" | "blockedMealIds">,
): MealThumb {
  if (prefs.blockedMealIds.includes(mealId)) return "down";
  if (prefs.likedMealIds.includes(mealId)) return "up";
  return null;
}

/**
 * User-specific meal-type suitability override.
 * Does NOT change the global recipe classification — only this household's snapshot.
 * Example: user likes BBQ ribs for breakfast → store breakfast: 0.9 for that mealId.
 */
export async function setMealOccasionOverride(input: {
  mealId: string;
  breakfast?: number | null;
  lunch?: number | null;
  dinner?: number | null;
}) {
  const mealId = input.mealId.trim();
  if (!mealId) throw new Error("mealId is required");

  const existing = await prisma.preference.findMany({
    where: { type: PreferenceType.MEAL_OCCASION_OVERRIDE },
  });
  const match = existing.find((p) => {
    try {
      const parsed = JSON.parse(p.value) as { mealId?: string };
      return parsed.mealId === mealId;
    } catch {
      return false;
    }
  });

  const current = match
    ? (JSON.parse(match.value) as {
        mealId: string;
        breakfast?: number;
        lunch?: number;
        dinner?: number;
      })
    : { mealId };

  const next: {
    mealId: string;
    breakfast?: number;
    lunch?: number;
    dinner?: number;
  } = { mealId };

  const merge = (
    key: "breakfast" | "lunch" | "dinner",
    incoming: number | null | undefined,
    prior?: number,
  ) => {
    if (incoming === null) return; // clear this key
    if (incoming === undefined) {
      if (prior != null) next[key] = prior;
      return;
    }
    next[key] = Math.max(0, Math.min(1, incoming));
  };

  merge("breakfast", input.breakfast, current.breakfast);
  merge("lunch", input.lunch, current.lunch);
  merge("dinner", input.dinner, current.dinner);

  const hasAny =
    next.breakfast != null || next.lunch != null || next.dinner != null;

  if (!hasAny) {
    if (match) await prisma.preference.delete({ where: { id: match.id } });
    return null;
  }

  const value = JSON.stringify(next);
  if (match) {
    return prisma.preference.update({ where: { id: match.id }, data: { value } });
  }
  return prisma.preference.create({
    data: { type: PreferenceType.MEAL_OCCASION_OVERRIDE, value },
  });
}
