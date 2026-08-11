import { PreferenceEventType, PreferenceType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { addPreference } from "@/lib/services/preferences";
import { normalizeName } from "@/lib/utils/dates";

export type DislikeSuggestion = {
  ingredient: string;
  removalCount: number;
};

/**
 * If an ingredient was removed >= 3 times and not already disliked,
 * and the user has not dismissed a suggestion for it, surface a prompt.
 */
export async function getDislikeSuggestions(): Promise<DislikeSuggestion[]> {
  const [events, disliked, dismissals] = await Promise.all([
    prisma.preferenceEvent.findMany({
      where: {
        type: PreferenceEventType.INGREDIENT_REMOVED,
        ingredient: { not: null },
      },
      select: { ingredient: true },
    }),
    prisma.preference.findMany({
      where: { type: PreferenceType.DISLIKED_INGREDIENT },
    }),
    prisma.preferenceEvent.findMany({
      where: { type: PreferenceEventType.SUGGESTION_DISMISSED },
      select: { ingredient: true },
    }),
  ]);

  const dislikedSet = new Set(disliked.map((d) => normalizeName(d.value)));
  const dismissedSet = new Set(
    dismissals.map((d) => normalizeName(d.ingredient ?? "")).filter(Boolean),
  );

  const counts = new Map<string, { display: string; count: number }>();
  for (const event of events) {
    if (!event.ingredient) continue;
    const key = normalizeName(event.ingredient);
    if (!key || dislikedSet.has(key) || dismissedSet.has(key)) continue;
    const current = counts.get(key);
    if (current) current.count += 1;
    else counts.set(key, { display: event.ingredient.trim(), count: 1 });
  }

  return [...counts.entries()]
    .filter(([, v]) => v.count >= 3)
    .map(([, v]) => ({ ingredient: v.display, removalCount: v.count }))
    .sort((a, b) => b.removalCount - a.removalCount);
}

export async function acceptDislikeSuggestion(ingredient: string) {
  await addPreference(PreferenceType.DISLIKED_INGREDIENT, ingredient);
}

export async function dismissDislikeSuggestion(ingredient: string) {
  await prisma.preferenceEvent.create({
    data: {
      type: PreferenceEventType.SUGGESTION_DISMISSED,
      ingredient: ingredient.trim(),
      metadata: JSON.stringify({ kind: "dislike_suggestion" }),
    },
  });
}
