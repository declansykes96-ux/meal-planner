import {
  getActivePlan,
  groupPlanByDays,
  peekNextMealsForPlan,
} from "@/lib/services/plans";
import { resolveDayHeroes } from "@/lib/services/day-heroes";
import { getHouseholdSettings } from "@/lib/services/household";
import { getDislikeSuggestions } from "@/lib/services/preference-learning";
import { listMeals } from "@/lib/services/meals";
import { getPreferenceSnapshot, thumbForMeal } from "@/lib/services/preferences";
import { PlannerClient, type DayCardData } from "@/components/planner/PlannerClient";
import {
  parseDayPlanningStyles,
  resolveEffectivePlanningStyle,
} from "@/lib/planning-style";
import { localNoonIso } from "@/lib/utils/dates";
import type { OccasionSlot } from "@/components/planner/SlotSwipeCard";

export const dynamic = "force-dynamic";

function toSlot(o: {
  id: string;
  mealType: string;
  locked: boolean;
  enabled: boolean;
  planningStyle: OccasionSlot["planningStyle"];
  effectivePlanningStyle: OccasionSlot["effectivePlanningStyle"];
  dayPlanningStyle: OccasionSlot["dayPlanningStyle"];
  weekPlanningStyle: OccasionSlot["weekPlanningStyle"];
  meal: DayCardData["slots"][number]["meal"];
  nextMeal?: OccasionSlot["nextMeal"];
  prevMeal?: OccasionSlot["prevMeal"];
}): OccasionSlot {
  return {
    id: o.id,
    mealType: o.mealType as OccasionSlot["mealType"],
    locked: o.locked,
    enabled: o.enabled,
    planningStyle: o.planningStyle,
    effectivePlanningStyle: o.effectivePlanningStyle,
    dayPlanningStyle: o.dayPlanningStyle,
    weekPlanningStyle: o.weekPlanningStyle,
    meal: o.meal,
    nextMeal: o.nextMeal ?? null,
    prevMeal: o.prevMeal ?? null,
  };
}

export default async function PlannerPage() {
  const [plan, household, suggestions, meals, prefs] = await Promise.all([
    getActivePlan(),
    getHouseholdSettings(),
    getDislikeSuggestions(),
    listMeals(),
    getPreferenceSnapshot(),
  ]);

  const showHouseholdPrompt = !household.householdPromptCompleted;
  const daySummaries = plan ? groupPlanByDays(plan.plannedMeals) : [];
  const weekStyle = plan?.planningStyle ?? "BALANCED";
  const dayStyles = plan ? parseDayPlanningStyles(plan.dayPlanningStyles) : {};

  const [heroByDay, peeksBySlot] = plan
    ? await Promise.all([
        daySummaries.length
          ? resolveDayHeroes(
              plan.id,
              plan.dayHeroes,
              daySummaries.map((d) => ({ dateKey: d.dateKey, occasions: d.occasions })),
            )
          : Promise.resolve({} as Record<string, string | null>),
        peekNextMealsForPlan(plan),
      ])
    : [{}, {} as Record<string, { next: null; prev: null }>];

  const days: DayCardData[] = daySummaries.map((day, index) => {
    const weekLabel = index < 7 ? "Week 1" : "Week 2";
    const heroMealId = heroByDay[day.dateKey] ?? null;
    const heroMeal = heroMealId
      ? day.occasions.find((o) => o.mealId === heroMealId)?.meal
      : null;
    const dayOverride = dayStyles[day.dateKey] ?? null;
    const dayEffective = resolveEffectivePlanningStyle({
      weekStyle,
      dayStyle: dayOverride,
    });

    return {
      dateKey: day.dateKey,
      dateIso: localNoonIso(day.date),
      enabled: day.enabled,
      weekLabel,
      heroImageUrl: heroMeal?.imageUrl ?? null,
      effectivePlanningStyle: dayEffective,
      dayPlanningStyle: dayOverride,
      slots: day.occasions.map((o) => {
        const slotEffective = resolveEffectivePlanningStyle({
          weekStyle,
          dayStyle: dayOverride,
          slotStyle: o.planningStyle,
        });
        return toSlot({
          id: o.id,
          mealType: o.mealType,
          locked: o.locked,
          enabled: o.enabled,
          planningStyle: o.planningStyle,
          effectivePlanningStyle: slotEffective,
          dayPlanningStyle: dayOverride,
          weekPlanningStyle: weekStyle,
          nextMeal: peeksBySlot[o.id]?.next ?? null,
          prevMeal: peeksBySlot[o.id]?.prev ?? null,
          meal: o.meal
            ? {
                id: o.meal.id,
                name: o.meal.name,
                description: o.meal.description,
                instructions: o.meal.instructions,
                prepTimeMinutes: o.meal.prepTimeMinutes,
                cookTimeMinutes: o.meal.cookTimeMinutes,
                servings: o.meal.servings,
                tags: o.meal.tags,
                favourite: o.meal.favourite,
                thumb: thumbForMeal(o.meal.id, prefs),
                goodForLeftovers: o.meal.goodForLeftovers,
                reheatsWell: o.meal.reheatsWell,
                batchFriendly: o.meal.batchFriendly,
                imageUrl: o.meal.imageUrl,
                source: o.meal.source,
                sourceTitle: o.meal.sourceTitle,
                sourceUrl: o.meal.sourceUrl,
                ingredients: o.meal.ingredients,
              }
            : null,
        });
      }),
    };
  });

  return (
    <PlannerClient
      planId={plan?.id ?? null}
      days={days}
      currentDuration={plan?.durationDays}
      weekPlanningStyle={weekStyle}
      showHouseholdPrompt={showHouseholdPrompt}
      householdSize={household.householdSize}
      rememberPlanningStyle={household.rememberPlanningStyle}
      preferredPlanningStyle={household.preferredPlanningStyle}
      libraryMeals={meals.map((m) => ({ id: m.id, name: m.name, tags: m.tags }))}
      suggestions={suggestions}
    />
  );
}
