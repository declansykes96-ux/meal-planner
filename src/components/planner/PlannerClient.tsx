"use client";

import { useCallback, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PlanningStyle } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { HouseholdPrompt } from "@/components/planner/HouseholdPrompt";
import { PlanningStylePrompt } from "@/components/planner/PlanningStylePrompt";
import { LearningSuggestions } from "@/components/preferences/LearningSuggestions";
import { DayDragProvider } from "@/components/planner/day-drag-context";
import { VisualDayCard, type DayCardModel } from "@/components/planner/VisualDayCard";
import {
  MealDetailPanel,
  SlotSwipeCard,
  type LibraryOption,
  type SlotMeal,
} from "@/components/planner/SlotSwipeCard";
import {
  generatePlanAction,
  setWeekPlanningStyleAction,
  swapDaysAction,
  toggleDayEnabledAction,
} from "@/lib/actions/plans";
import { PLANNING_STYLE_META } from "@/lib/planning-style";
import { formatDayLabel } from "@/lib/utils/dates";

export type DayCardData = DayCardModel;

type WeekLayout = "scroll" | "week";

const LAYOUT_KEY = "meal-planner-week-layout";

function getLayoutSnapshot(): WeekLayout {
  try {
    const stored = window.localStorage.getItem(LAYOUT_KEY);
    if (stored === "week" || stored === "scroll") return stored;
  } catch {
    /* ignore */
  }
  return "scroll";
}

function subscribeLayout(onStoreChange: () => void) {
  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener("meal-planner-layout", handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("meal-planner-layout", handler);
  };
}

export function PlannerClient({
  planId,
  days,
  currentDuration,
  weekPlanningStyle,
  showHouseholdPrompt,
  householdSize,
  rememberPlanningStyle,
  preferredPlanningStyle,
  libraryMeals,
  suggestions,
}: {
  planId: string | null;
  days: DayCardData[];
  currentDuration?: number | null;
  weekPlanningStyle: PlanningStyle;
  showHouseholdPrompt: boolean;
  householdSize: number;
  rememberPlanningStyle: boolean;
  preferredPlanningStyle: PlanningStyle | null;
  libraryMeals: LibraryOption[];
  suggestions: { ingredient: string; removalCount: number }[];
}) {
  const router = useRouter();
  const [duration, setDuration] = useState<7 | 14>(currentDuration === 14 ? 14 : 7);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openDateKey, setOpenDateKey] = useState<string | null>(null);
  const [openMeal, setOpenMeal] = useState<SlotMeal | null>(null);
  const [justSwapped, setJustSwapped] = useState<Set<string>>(new Set());
  const [stylePromptOpen, setStylePromptOpen] = useState(false);
  const layout = useSyncExternalStore(subscribeLayout, getLayoutSnapshot, () => "scroll");

  function setPreferredLayout(next: WeekLayout) {
    try {
      window.localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event("meal-planner-layout"));
  }

  const openDay = useMemo(
    () => days.find((d) => d.dateKey === openDateKey) ?? null,
    [days, openDateKey],
  );

  const weeks = useMemo(() => {
    const map = new Map<string, DayCardData[]>();
    for (const day of days) {
      const list = map.get(day.weekLabel) ?? [];
      list.push(day);
      map.set(day.weekLabel, list);
    }
    return [...map.entries()];
  }, [days]);

  const performSwap = useCallback(
    (fromKey: string, toKey: string) => {
      if (!planId || fromKey === toKey || pending) return;
      setError(null);
      startTransition(async () => {
        try {
          await swapDaysAction(planId, fromKey, toKey);
          setJustSwapped(new Set([fromKey, toKey]));
          window.setTimeout(() => setJustSwapped(new Set()), 350);
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not swap days");
        }
      });
    },
    [planId, pending, router],
  );

  function goBackFromDay() {
    setOpenMeal(null);
    setOpenDateKey(null);
  }

  function requestGenerate() {
    setError(null);
    setOpenDateKey(null);
    setOpenMeal(null);
    if (rememberPlanningStyle && preferredPlanningStyle) {
      startTransition(async () => {
        try {
          await generatePlanAction(duration, preferredPlanningStyle);
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to generate");
        }
      });
      return;
    }
    setStylePromptOpen(true);
  }

  const inDayFocus = Boolean(openDay);

  return (
    <div className="space-y-6">
      <HouseholdPrompt open={showHouseholdPrompt} />
      <PlanningStylePrompt
        open={stylePromptOpen && !showHouseholdPrompt}
        durationDays={duration}
        initialStyle={preferredPlanningStyle ?? weekPlanningStyle ?? "BALANCED"}
        onClose={() => setStylePromptOpen(false)}
      />

      {!inDayFocus ? (
        <>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Weekly plan</p>
            <h1 className="text-3xl sm:text-4xl">Your week on a plate</h1>
            <p className="max-w-xl text-sm text-muted">
              Browse the week visually, open a day for meals, then open a meal for the full recipe.
              Drag any day card onto another to swap. Planning for {householdSize}{" "}
              {householdSize === 1 ? "person" : "people"}.
            </p>
          </div>

          <LearningSuggestions suggestions={suggestions} />

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-full border border-border bg-surface p-1">
              {([7, 14] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`rounded-full px-4 py-1.5 text-sm transition ${
                    duration === d ? "bg-accent text-white" : "text-muted hover:text-foreground"
                  }`}
                >
                  {d === 7 ? "1 Week" : "Fortnight"}
                </button>
              ))}
            </div>
            {planId && days.length ? (
              <div className="inline-flex rounded-full border border-border bg-surface p-1">
                {(["FRESH", "BALANCED", "STRETCH"] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        await setWeekPlanningStyleAction(planId, style);
                        router.refresh();
                      });
                    }}
                    className={`rounded-full px-4 py-1.5 text-sm transition disabled:opacity-50 ${
                      weekPlanningStyle === style
                        ? "bg-accent text-white"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {PLANNING_STYLE_META[style].short}
                  </button>
                ))}
              </div>
            ) : null}
            <Button
              variant="primary"
              disabled={pending || showHouseholdPrompt || stylePromptOpen}
              onClick={requestGenerate}
            >
              {pending ? "Randomizing…" : "Meal randomizer"}
            </Button>
          </div>
        </>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {days.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/70 px-6 py-16 text-center">
          <p className="text-muted">Generate a week or fortnight to start planning.</p>
        </div>
      ) : openMeal && openDay ? (
        <MealDetailPanel
          meal={openMeal}
          dayLabel={formatDayLabel(new Date(openDay.dateIso))}
          onBack={() => setOpenMeal(null)}
          onBackToPlanner={goBackFromDay}
        />
      ) : openDay ? (
        <DayFocusView
          day={openDay}
          libraryMeals={libraryMeals}
          onBack={goBackFromDay}
          onOpenMeal={setOpenMeal}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">
              Tap a day to open · drag a day onto another to swap
            </p>
            <div className="inline-flex rounded-full border border-border bg-surface p-1">
              <button
                type="button"
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  layout === "scroll" ? "bg-accent text-white" : "text-muted hover:text-foreground"
                }`}
                onClick={() => setPreferredLayout("scroll")}
              >
                Scroll View
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  layout === "week" ? "bg-accent text-white" : "text-muted hover:text-foreground"
                }`}
                onClick={() => setPreferredLayout("week")}
              >
                View Week
              </button>
            </div>
          </div>

          {weeks.map(([label, weekDays]) => (
            <section key={label} className="space-y-3">
              {weeks.length > 1 ? (
                <h2 className="border-b border-border pb-2 text-2xl">{label}</h2>
              ) : null}

              <DayDragProvider>
                {layout === "scroll" ? (
                  <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:thin] sm:mx-0 sm:px-0">
                    {weekDays.map((day) => (
                      <div
                        key={day.dateKey}
                        className="w-[85vw] max-w-sm shrink-0 snap-center sm:w-72 md:w-80"
                      >
                        <VisualDayCard
                          day={day}
                          pending={pending || !planId}
                          justSwapped={justSwapped.has(day.dateKey)}
                          onOpen={() => setOpenDateKey(day.dateKey)}
                          onSwapWith={(target) => performSwap(day.dateKey, target)}
                          onRemoveDay={() => {
                            if (!planId) return;
                            startTransition(async () => {
                              await toggleDayEnabledAction(planId, day.dateKey, false);
                              router.refresh();
                            });
                          }}
                          onRestoreDay={() => {
                            if (!planId) return;
                            startTransition(async () => {
                              await toggleDayEnabledAction(planId, day.dateKey, true);
                              router.refresh();
                            });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {weekDays.map((day) => (
                      <VisualDayCard
                        key={day.dateKey}
                        day={day}
                        compact
                        pending={pending || !planId}
                        justSwapped={justSwapped.has(day.dateKey)}
                        onOpen={() => setOpenDateKey(day.dateKey)}
                        onSwapWith={(target) => performSwap(day.dateKey, target)}
                        onRemoveDay={() => {
                          if (!planId) return;
                          startTransition(async () => {
                            await toggleDayEnabledAction(planId, day.dateKey, false);
                            router.refresh();
                          });
                        }}
                        onRestoreDay={() => {
                          if (!planId) return;
                          startTransition(async () => {
                            await toggleDayEnabledAction(planId, day.dateKey, true);
                            router.refresh();
                          });
                        }}
                      />
                    ))}
                  </div>
                )}
              </DayDragProvider>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function DayFocusView({
  day,
  libraryMeals,
  onBack,
  onOpenMeal,
}: {
  day: DayCardData;
  libraryMeals: LibraryOption[];
  onBack: () => void;
  onOpenMeal: (meal: SlotMeal) => void;
}) {
  const label = formatDayLabel(new Date(day.dateIso));

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-30 -mx-4 border-b border-border bg-[var(--background)]/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <Button type="button" variant="primary" onClick={onBack}>
          ← Back to planner
        </Button>
      </div>

      <div>
        <h2 className="text-3xl">{label}</h2>
        <p className="mt-2 text-sm text-muted">
          Tap for the recipe · swipe either way through meal options · desktop arrows work the same
        </p>
      </div>

      <div className="mx-auto grid max-w-xl gap-6">
        {day.slots.map((slot) => (
          <SlotSwipeCard
            key={slot.id}
            slot={slot}
            libraryMeals={libraryMeals}
            onOpenMeal={onOpenMeal}
          />
        ))}
      </div>
    </div>
  );
}
