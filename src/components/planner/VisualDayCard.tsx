"use client";

import type { PlanningStyle } from "@prisma/client";
import type { OccasionSlot } from "@/components/planner/SlotSwipeCard";
import { DraggableDayCard } from "@/components/planner/DraggableDayCard";
import { Button } from "@/components/ui/Button";
import { formatDayLabel } from "@/lib/utils/dates";

export type DayCardModel = {
  dateKey: string;
  dateIso: string;
  enabled: boolean;
  weekLabel: string;
  heroImageUrl: string | null;
  /** Effective day style = override ?? week. */
  effectivePlanningStyle: PlanningStyle;
  /** Day override only; null means inherit week. */
  dayPlanningStyle: PlanningStyle | null;
  slots: OccasionSlot[];
};

function mealTypeLabel(type: string) {
  return type.charAt(0) + type.slice(1).toLowerCase();
}

export function VisualDayCard({
  day,
  pending,
  justSwapped,
  compact,
  onOpen,
  onSwapWith,
  onRemoveDay,
  onRestoreDay,
}: {
  day: DayCardModel;
  weekPlanningStyle?: PlanningStyle;
  pending?: boolean;
  justSwapped?: boolean;
  compact?: boolean;
  onOpen: () => void;
  onSwapWith: (target: string) => void;
  onRemoveDay: () => void;
  onRestoreDay: () => void;
}) {
  const label = formatDayLabel(new Date(day.dateIso));
  const filled = day.slots.filter((s) => s.meal);

  if (!day.enabled) {
    return (
      <DraggableDayCard
        dateKey={day.dateKey}
        disabled={pending}
        onOpen={onRestoreDay}
        onSwapWith={onSwapWith}
        className={`overflow-hidden rounded-3xl border border-dashed border-border bg-surface-muted/50 ${
          justSwapped ? "animate-[settle_280ms_ease]" : ""
        } ${compact ? "h-full" : ""}`}
      >
        <div
          className={`relative ${compact ? "aspect-[4/3]" : "aspect-[4/5] sm:aspect-[3/4]"} bg-cover bg-center`}
          style={{ backgroundImage: "url(/meals/empty-day.svg)" }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
            <h3 className="font-[family-name:var(--font-display)] text-2xl line-through opacity-80">
              {label}
            </h3>
            <p className="mt-1 text-sm text-white/80">Day removed — tap to restore</p>
          </div>
        </div>
      </DraggableDayCard>
    );
  }

  const hero = day.heroImageUrl || "/meals/empty-day.svg";

  return (
    <DraggableDayCard
      dateKey={day.dateKey}
      disabled={pending}
      onOpen={onOpen}
      onSwapWith={onSwapWith}
      className={`overflow-hidden rounded-3xl border border-border bg-surface shadow-md ${
        justSwapped ? "animate-[settle_280ms_ease]" : ""
      } ${compact ? "h-full" : ""}`}
    >
      <div
        className={`relative ${compact ? "aspect-[4/3]" : "aspect-[4/5] sm:aspect-[3/4]"} overflow-hidden`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5" />
        <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
          <h3 className="font-[family-name:var(--font-display)] text-3xl drop-shadow-sm">{label}</h3>
          <ul className="mt-3 space-y-1 text-sm text-white/90">
            {day.slots.map((slot) => (
              <li key={slot.id} className="flex gap-2 truncate">
                <span className="shrink-0 text-white/60">{mealTypeLabel(slot.mealType)}</span>
                <span className="truncate">{slot.meal?.name ?? "—"}</span>
              </li>
            ))}
          </ul>
          {filled.length === 0 ? (
            <p className="mt-2 text-sm text-white/70">No meals yet</p>
          ) : null}
        </div>
      </div>
      <div className="flex justify-end border-t border-border bg-surface px-3 py-2">
        <Button type="button" variant="danger" disabled={pending} onClick={onRemoveDay}>
          Remove
        </Button>
      </div>
    </DraggableDayCard>
  );
}
