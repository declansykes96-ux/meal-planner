import { prisma } from "@/lib/db/prisma";
import type { PlannedOccasion } from "@/lib/services/plans";

function parseHeroes(raw: string | null | undefined): Record<string, string> {
  try {
    const parsed = JSON.parse(raw || "{}") as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function activeMealIds(occasions: PlannedOccasion[]): string[] {
  return occasions
    .filter((o) => o.enabled && o.mealId && o.meal)
    .map((o) => o.mealId!);
}

function pickStableHero(dateKey: string, mealIds: string[]): string | null {
  if (mealIds.length === 0) return null;
  if (mealIds.length === 1) return mealIds[0];
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  return mealIds[hash % mealIds.length];
}

/**
 * Resolve hero meal for a day. Keeps stored choice if still active;
 * otherwise picks a stable replacement and persists it.
 */
export async function resolveDayHeroes(
  planId: string,
  dayHeroesRaw: string,
  days: { dateKey: string; occasions: PlannedOccasion[] }[],
): Promise<Record<string, string | null>> {
  const stored = parseHeroes(dayHeroesRaw);
  const next: Record<string, string> = {};
  const result: Record<string, string | null> = {};
  let dirty = false;

  for (const day of days) {
    const ids = activeMealIds(day.occasions);
    const current = stored[day.dateKey];
    if (current && ids.includes(current)) {
      next[day.dateKey] = current;
      result[day.dateKey] = current;
      continue;
    }
    const picked = pickStableHero(day.dateKey, ids);
    result[day.dateKey] = picked;
    if (picked) next[day.dateKey] = picked;
    if (current !== (picked ?? undefined)) dirty = true;
  }

  if (
    dirty ||
    JSON.stringify(Object.keys(stored).sort()) !== JSON.stringify(Object.keys(next).sort())
  ) {
    await prisma.mealPlan.update({
      where: { id: planId },
      data: { dayHeroes: JSON.stringify(next) },
    });
  }

  return result;
}

/** After swapping day slot contents, swap stored hero meal pointers too. */
export async function swapDayHeroes(planId: string, dateKeyA: string, dateKeyB: string) {
  const plan = await prisma.mealPlan.findUnique({ where: { id: planId } });
  if (!plan) return;
  const heroes = parseHeroes(plan.dayHeroes);
  const heroA = heroes[dateKeyA];
  const heroB = heroes[dateKeyB];
  if (heroB) heroes[dateKeyA] = heroB;
  else delete heroes[dateKeyA];
  if (heroA) heroes[dateKeyB] = heroA;
  else delete heroes[dateKeyB];
  await prisma.mealPlan.update({
    where: { id: planId },
    data: { dayHeroes: JSON.stringify(heroes) },
  });
}
