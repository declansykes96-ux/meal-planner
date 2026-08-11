"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { PlanningStyle } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PlanningStyleControl } from "@/components/planner/PlanningStylePicker";
import {
  assignMealToSlotAction,
  removeMealSlotAction,
  restoreSlotMealAction,
  setMealThumbAction,
  setSlotPlanningStyleAction,
  toggleLockAction,
} from "@/lib/actions/plans";
import { inheritSettingLabel } from "@/lib/planning-style";
import type { MealThumb } from "@/lib/preference-signals";
import {
  clearSlotMealWheel,
  readSlotMealWheel,
  syncWheelWithMeal,
  toHistoryMeal,
  writeSlotMealWheel,
  type SlotHistoryMeal,
  type SlotMealWheel,
} from "@/lib/slot-meal-history";
import { totalTimeMinutes, type IngredientLine } from "@/lib/types/meal";

export type SlotMeal = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  servings: number;
  tags: string[];
  favourite: boolean;
  /** Explicit thumbs preference for this meal */
  thumb: MealThumb;
  goodForLeftovers: boolean;
  reheatsWell: boolean;
  batchFriendly: boolean;
  imageUrl: string | null;
  source: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  ingredients: IngredientLine[];
};

export type NextMealPreview = {
  id: string;
  name: string;
  imageUrl: string | null;
};

export type OccasionSlot = {
  id: string;
  mealType: "BREAKFAST" | "LUNCH" | "DINNER";
  locked: boolean;
  enabled: boolean;
  /** Slot override; null = inherit day/week. */
  planningStyle: PlanningStyle | null;
  effectivePlanningStyle: PlanningStyle;
  /** Day override for inherit label (may be null). */
  dayPlanningStyle: PlanningStyle | null;
  weekPlanningStyle: PlanningStyle;
  meal: SlotMeal | null;
  /** Peek candidates for either side of the option wheel. */
  nextMeal?: NextMealPreview | null;
  prevMeal?: NextMealPreview | null;
};

export type LibraryOption = { id: string; name: string; tags: string[] };

function mealTypeLabel(type: OccasionSlot["mealType"]) {
  return type.charAt(0) + type.slice(1).toLowerCase();
}

function subscribeFinePointer(onChange: () => void) {
  const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getFinePointerSnapshot() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function unusedPeek(
  peek: NextMealPreview | null | undefined,
  wheelIds: Set<string>,
  otherPeekId?: string | null,
): NextMealPreview | null {
  if (!peek) return null;
  if (wheelIds.has(peek.id)) return null;
  if (otherPeekId && peek.id === otherPeekId) return null;
  return peek;
}

/** Drag distance (px) that maps to full horizontal progress ±1. */
const WHEEL_DRAG_RANGE = 160;
/** Release past this |progress| commits a wheel step. */
const WHEEL_COMMIT_PROGRESS = 0.42;
const WHEEL_SETTLE_MS = 220;
/** Vertical drag distance (px) that maps to full like/dislike progress ±1. */
const VERT_DRAG_RANGE = 110;
/** Release past this |vertical progress| commits like (up) / dislike (down). */
const VERT_COMMIT_PROGRESS = 0.48;
/** Ignore jitter until the pointer moves this far. */
const AXIS_LOCK_PX = 12;
/** Require this dominance ratio before locking an axis. */
const AXIS_LOCK_RATIO = 1.15;

type DragAxis = "x" | "y" | null;

type WheelFaceStyle = {
  transform: string;
  opacity: number;
  zIndex: number;
  filter: string;
};

/**
 * Face slots at rest: -1 = next (left), 0 = current, +1 = previous (right).
 * Finger-following carousel (progress = dx / range):
 *   swipe left  (progress → -1) → previous (right face) comes to center
 *   swipe right (progress → +1) → next (left face) comes to center
 */
function wheelFaceStyle(slot: -1 | 0 | 1, progress: number): WheelFaceStyle {
  const t = slot + progress;
  const dominance = Math.max(0, 1 - Math.min(1, Math.abs(t)));
  const xPercent = t * 22;
  const scale = 0.88 + dominance * 0.12;
  const opacity = 0.4 + dominance * 0.6;
  const zIndex = 5 + Math.round(dominance * 20);
  const blur = (1 - dominance) * 0.6;
  return {
    transform: `translate3d(${xPercent}%, 0, 0) scale(${scale})`,
    opacity,
    zIndex,
    filter: blur > 0.05 ? `blur(${blur}px)` : "none",
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function stubMealFromPreview(preview: SlotHistoryMeal | NextMealPreview): SlotMeal {
  return {
    id: preview.id,
    name: preview.name,
    description: "",
    instructions: "",
    prepTimeMinutes: null,
    cookTimeMinutes: null,
    servings: 0,
    tags: [],
    favourite: false,
    thumb: null,
    goodForLeftovers: false,
    reheatsWell: false,
    batchFriendly: false,
    imageUrl: preview.imageUrl,
    source: "library",
    sourceTitle: null,
    sourceUrl: null,
    ingredients: [],
  };
}

function WheelFace({
  meal,
  label,
  style,
  interactive,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onOpen,
  children,
}: {
  meal: { name: string; imageUrl: string | null };
  label?: string;
  style: WheelFaceStyle;
  interactive?: boolean;
  onPointerDown?: (e: ReactPointerEvent) => void;
  onPointerMove?: (e: ReactPointerEvent) => void;
  onPointerUp?: (e: ReactPointerEvent) => void;
  onPointerCancel?: (e: ReactPointerEvent) => void;
  onOpen?: () => void;
  children?: ReactNode;
}) {
  const photo = meal.imageUrl || "/meals/plate-warm.svg";
  return (
    <article
      className="absolute inset-y-0 left-[14%] right-[14%] overflow-hidden rounded-2xl border border-border bg-surface shadow-md will-change-transform"
      style={{
        transform: style.transform,
        opacity: style.opacity,
        zIndex: style.zIndex,
        filter: style.filter,
        pointerEvents: interactive ? "auto" : "none",
      }}
    >
      <div
        className={interactive ? "cursor-grab touch-none active:cursor-grabbing" : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <button
          type="button"
          className="block w-full text-left"
          tabIndex={interactive ? 0 : -1}
          onClick={() => {
            if (!interactive) return;
            onOpen?.();
          }}
        >
          <div className="relative h-44 overflow-hidden sm:h-52">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="h-full w-full object-cover" draggable={false} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              {label ? (
                <p className="text-[10px] font-medium uppercase tracking-wide text-white/70">{label}</p>
              ) : null}
              <h4 className="font-[family-name:var(--font-display)] text-2xl leading-tight">
                {meal.name}
              </h4>
            </div>
          </div>
        </button>
      </div>
      {children}
    </article>
  );
}

export function SlotSwipeCard({
  slot,
  libraryMeals,
  onOpenMeal,
}: {
  slot: OccasionSlot;
  libraryMeals: LibraryOption[];
  onOpenMeal: (meal: SlotMeal) => void;
}) {
  const router = useRouter();
  const showArrows = useSyncExternalStore(subscribeFinePointer, getFinePointerSnapshot, () => false);
  const [pending, startTransition] = useTransition();
  const [pickOpen, setPickOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [progress, setProgress] = useState(0);
  const [vertProgress, setVertProgress] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const [thumbOverride, setThumbOverride] = useState<{ id: string; thumb: MealThumb } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wheel, setWheel] = useState<SlotMealWheel>(() => {
    const stored = readSlotMealWheel(slot.id);
    return slot.meal ? syncWheelWithMeal(stored, slot.meal) : stored;
  });
  const [optimistic, setOptimistic] = useState<SlotHistoryMeal | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const dragAxis = useRef<DragAxis>(null);
  const dragging = useRef(false);
  const skipClick = useRef(false);
  const wheelRef = useRef(wheel);
  const saveGen = useRef(0);
  const browseLock = useRef(false);
  const progressRef = useRef(0);
  const vertRef = useRef(0);
  const settleRaf = useRef<number | null>(null);
  const dragRaf = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const flashTimer = useRef<number | null>(null);

  const meal =
    optimistic && optimistic.id !== slot.meal?.id
      ? stubMealFromPreview(optimistic)
      : slot.meal;
  const total = meal ? totalTimeMinutes(meal.prepTimeMinutes, meal.cookTimeMinutes) : null;
  const displayThumb: MealThumb =
    meal && thumbOverride && thumbOverride.id === meal.id
      ? thumbOverride.thumb
      : (meal?.thumb ?? null);

  const viewWheel = meal ? syncWheelWithMeal(wheel, meal) : wheel;
  const wheelIds = useMemo(() => new Set(viewWheel.items.map((m) => m.id)), [viewWheel.items]);
  const prevFromWheel = viewWheel.index > 0 ? viewWheel.items[viewWheel.index - 1]! : null;
  const nextFromWheel =
    viewWheel.index < viewWheel.items.length - 1 ? viewWheel.items[viewWheel.index + 1]! : null;

  const edgeNext = unusedPeek(slot.nextMeal, wheelIds);
  const edgePrev = unusedPeek(slot.prevMeal, wheelIds, edgeNext?.id);

  let peekPrev: SlotHistoryMeal | NextMealPreview | null = prevFromWheel;
  let peekNext: SlotHistoryMeal | NextMealPreview | null = nextFromWheel;
  if (!peekNext && edgeNext && edgeNext.id !== peekPrev?.id) peekNext = edgeNext;
  if (!peekPrev && edgePrev && edgePrev.id !== peekNext?.id) peekPrev = edgePrev;
  if (!peekNext && edgePrev && edgePrev.id !== peekPrev?.id) peekNext = edgePrev;
  if (!peekPrev && edgeNext && edgeNext.id !== peekNext?.id) peekPrev = edgeNext;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return libraryMeals
      .filter(
        (m) =>
          !q ||
          m.name.toLowerCase().includes(q) ||
          m.tags.some((t) => t.toLowerCase().includes(q)),
      )
      .slice(0, 30);
  }, [libraryMeals, search]);

  function persistWheel(next: SlotMealWheel) {
    wheelRef.current = next;
    setWheel(next);
    writeSlotMealWheel(slot.id, next);
  }

  function cancelSettle() {
    if (settleRaf.current != null) {
      window.cancelAnimationFrame(settleRaf.current);
      settleRaf.current = null;
    }
    if (dragRaf.current != null) {
      window.cancelAnimationFrame(dragRaf.current);
      dragRaf.current = null;
    }
  }

  function setProgressBoth(next: number) {
    progressRef.current = next;
    setProgress(next);
  }

  function setVertBoth(next: number) {
    vertRef.current = next;
    setVertProgress(next);
  }

  /** Coalesce pointer moves to one style update per frame. */
  function setProgressOnDrag(next: number) {
    progressRef.current = next;
    if (dragRaf.current != null) return;
    dragRaf.current = window.requestAnimationFrame(() => {
      dragRaf.current = null;
      setProgress(progressRef.current);
      setVertProgress(vertRef.current);
    });
  }

  function setVertOnDrag(next: number) {
    vertRef.current = next;
    if (dragRaf.current != null) return;
    dragRaf.current = window.requestAnimationFrame(() => {
      dragRaf.current = null;
      setProgress(progressRef.current);
      setVertProgress(vertRef.current);
    });
  }

  function animateProgressTo(target: number, onDone?: () => void) {
    cancelSettle();
    const from = progressRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / WHEEL_SETTLE_MS);
      const eased = 1 - (1 - t) ** 3;
      setProgressBoth(lerp(from, target, eased));
      if (t < 1) {
        settleRaf.current = window.requestAnimationFrame(tick);
      } else {
        settleRaf.current = null;
        onDone?.();
      }
    };
    settleRaf.current = window.requestAnimationFrame(tick);
  }

  function animateVertTo(target: number, onDone?: () => void) {
    cancelSettle();
    const from = vertRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / WHEEL_SETTLE_MS);
      const eased = 1 - (1 - t) ** 3;
      setVertBoth(lerp(from, target, eased));
      if (t < 1) {
        settleRaf.current = window.requestAnimationFrame(tick);
      } else {
        settleRaf.current = null;
        onDone?.();
      }
    };
    settleRaf.current = window.requestAnimationFrame(tick);
  }

  function showFlash(kind: "up" | "down") {
    if (flashTimer.current != null) window.clearTimeout(flashTimer.current);
    setFlash(kind);
    flashTimer.current = window.setTimeout(() => {
      setFlash(null);
      flashTimer.current = null;
    }, 700);
  }

  useEffect(
    () => () => {
      cancelSettle();
      if (flashTimer.current != null) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
        setProgressBoth(0);
        setVertBoth(0);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        setProgressBoth(0);
        setVertBoth(0);
      }
    });
  }

  function persistBrowse(mealId: string) {
    const gen = ++saveGen.current;
    setError(null);
    void (async () => {
      try {
        await restoreSlotMealAction(slot.id, mealId);
        if (gen !== saveGen.current) return;
        router.refresh();
      } catch (e) {
        if (gen !== saveGen.current) return;
        setError(e instanceof Error ? e.message : "Something went wrong");
        setOptimistic(null);
        setProgressBoth(0);
      }
    })();
  }

  function removeSlot() {
    if (slot.locked || pending || !meal) return;
    clearSlotMealWheel(slot.id);
    persistWheel({ items: [], index: 0 });
    setOptimistic(null);
    run(async () => removeMealSlotAction(slot.id));
  }

  /** Commit one step: prev = earlier option, next = newer option. */
  function commitStep(direction: "prev" | "next") {
    if (slot.locked || !meal) return;
    const current = syncWheelWithMeal(wheelRef.current, meal);
    const peek = direction === "prev" ? peekPrev : peekNext;
    const towardIndex = direction === "prev" ? current.index - 1 : current.index + 1;

    let target: SlotHistoryMeal | NextMealPreview | null = null;
    let nextWheel: SlotMealWheel | null = null;

    if (towardIndex >= 0 && towardIndex < current.items.length) {
      target = current.items[towardIndex]!;
      nextWheel = { ...current, index: towardIndex };
    } else if (peek) {
      const nextItems =
        direction === "prev"
          ? [toHistoryMeal(peek), ...current.items]
          : [...current.items, toHistoryMeal(peek)];
      target = peek;
      nextWheel = {
        items: nextItems,
        index: direction === "prev" ? 0 : nextItems.length - 1,
      };
    }

    if (!target || !nextWheel) {
      browseLock.current = false;
      animateProgressTo(0);
      return;
    }

    browseLock.current = true;
    persistWheel(nextWheel);
    setOptimistic(toHistoryMeal(target));
    setThumbOverride(null);
    setProgressBoth(0);
    setVertBoth(0);
    window.setTimeout(() => {
      browseLock.current = false;
    }, WHEEL_SETTLE_MS);
    persistBrowse(target.id);
  }

  function goPrev() {
    if (slot.locked || browseLock.current || !canGoPrev) return;
    animateProgressTo(-1, () => {
      commitStep("prev");
    });
  }

  function goNext() {
    if (slot.locked || browseLock.current || !canGoNext) return;
    animateProgressTo(1, () => {
      commitStep("next");
    });
  }

  function applyLike() {
    if (!meal || slot.locked || browseLock.current) return;
    setThumbOverride({ id: meal.id, thumb: "up" });
    showFlash("up");
    setError(null);
    void (async () => {
      try {
        await setMealThumbAction(meal.id, "up");
        router.refresh();
      } catch (e) {
        setThumbOverride(null);
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    })();
  }

  function applyDislike() {
    if (!meal || slot.locked || browseLock.current) return;
    setThumbOverride({ id: meal.id, thumb: "down" });
    showFlash("down");
    setError(null);
    browseLock.current = true;
    const advance = canGoNext;
    void (async () => {
      try {
        await setMealThumbAction(meal.id, "down");
        browseLock.current = false;
        if (advance) {
          goNext();
        } else {
          router.refresh();
        }
      } catch (e) {
        browseLock.current = false;
        setThumbOverride(null);
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    })();
  }

  function finishDrag() {
    if (dragRaf.current != null) {
      window.cancelAnimationFrame(dragRaf.current);
      dragRaf.current = null;
    }
    const axis = dragAxis.current;
    dragAxis.current = null;
    setProgress(progressRef.current);
    setVertProgress(vertRef.current);

    if (axis === "y") {
      const v = vertRef.current;
      // vertProgress = dy / range: negative = swipe up (like), positive = down (dislike)
      if (v <= -VERT_COMMIT_PROGRESS) {
        animateVertTo(-1, () => {
          applyLike();
          animateVertTo(0);
        });
        return;
      }
      if (v >= VERT_COMMIT_PROGRESS) {
        animateVertTo(1, () => {
          setVertBoth(0);
          applyDislike();
        });
        return;
      }
      animateVertTo(0);
      return;
    }

    if (axis === "x") {
      const p = progressRef.current;
      // progress = dx / range: negative = swipe left (prev), positive = swipe right (next)
      if (p <= -WHEEL_COMMIT_PROGRESS && canGoPrev) {
        animateProgressTo(-1, () => commitStep("prev"));
        return;
      }
      if (p >= WHEEL_COMMIT_PROGRESS && canGoNext) {
        animateProgressTo(1, () => commitStep("next"));
        return;
      }
      animateProgressTo(0);
      return;
    }

    setProgressBoth(0);
    setVertBoth(0);
  }

  function onWheelKeyDown(e: ReactKeyboardEvent) {
    if (slot.locked || cardBusy || browseLock.current || !meal) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goNext();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      applyLike();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      applyDislike();
    }
  }

  const canGoPrev = Boolean(peekPrev) && !slot.locked;
  const canGoNext = Boolean(peekNext) && !slot.locked;
  const showPeeks = !slot.locked && (Boolean(peekPrev) || Boolean(peekNext));
  const cardBusy = pending && !optimistic;
  const centerDominance = Math.max(0, 1 - Math.min(1, Math.abs(progress)));
  const gestureBusy = swiping || Math.abs(progress) > 0.02 || Math.abs(vertProgress) > 0.02;

  const clampedProgress = (() => {
    let p = progress;
    if (!canGoPrev && p < 0) p = Math.max(p, -0.15);
    if (!canGoNext && p > 0) p = Math.min(p, 0.15);
    return p;
  })();

  const nextStyle = wheelFaceStyle(-1, clampedProgress);
  const prevStyle = wheelFaceStyle(1, clampedProgress);
  const currentStyle = (() => {
    const base = wheelFaceStyle(0, clampedProgress);
    const y = vertProgress * 42;
    const likeBoost = Math.max(0, -vertProgress);
    const dislikeBoost = Math.max(0, vertProgress);
    const opacity = Math.max(0.35, base.opacity - (likeBoost + dislikeBoost) * 0.15);
    return {
      ...base,
      transform: base.transform.replace(
        /translate3d\(([^,]+),\s*[^,]+,/,
        `translate3d($1, ${y}px,`,
      ),
      opacity,
    };
  })();

  const likeHint = Math.max(0, Math.min(1, -vertProgress));
  const dislikeHint = Math.max(0, Math.min(1, vertProgress));
  const flashUp = flash === "up" ? 1 : likeHint;
  const flashDown = flash === "down" ? 1 : dislikeHint;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {mealTypeLabel(slot.mealType)}
        </h3>
        {slot.locked ? <span className="text-xs font-medium text-danger">Locked</span> : null}
      </div>

      {!meal ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/70 p-6 text-center">
          <p className="text-sm text-muted">Empty slot</p>
          <Button
            type="button"
            className="mt-3"
            variant="primary"
            disabled={pending || slot.locked}
            onClick={() => setPickOpen(true)}
          >
            Add meal
          </Button>
        </div>
      ) : (
        <div className="flex items-stretch gap-2">
          {showArrows ? (
            <button
              type="button"
              aria-label="Previous meal option"
              disabled={gestureBusy || !canGoPrev}
              onClick={goPrev}
              className="hidden w-10 shrink-0 items-center justify-center self-center rounded-full border border-border bg-surface text-xl text-foreground transition hover:border-accent hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-30 sm:flex"
            >
              ‹
            </button>
          ) : null}

          <div className="min-w-0 flex-1">
            <div
              ref={stageRef}
              tabIndex={meal && !slot.locked ? 0 : -1}
              onKeyDown={onWheelKeyDown}
              aria-label={`${mealTypeLabel(slot.mealType)} meal selector. Arrow keys: left previous, right next, up like, down dislike.`}
              className={`relative overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${slot.locked ? "rounded-2xl ring-2 ring-danger/50" : ""} ${cardBusy ? "pointer-events-none" : ""}`}
              style={{ height: "13.5rem" }}
            >
              {showPeeks && peekNext ? (
                <WheelFace meal={peekNext} label="Also try" style={nextStyle} />
              ) : null}
              {showPeeks && peekPrev ? (
                <WheelFace meal={peekPrev} label="Also try" style={prevStyle} />
              ) : null}
              <WheelFace
                meal={{ name: meal.name, imageUrl: meal.imageUrl }}
                style={currentStyle}
                interactive={!slot.locked && !cardBusy}
                onOpen={() => {
                  if (skipClick.current) return;
                  if (Math.abs(progressRef.current) > 0.08 || Math.abs(vertRef.current) > 0.08) return;
                  onOpenMeal(meal);
                }}
                onPointerDown={(e) => {
                  if (slot.locked || cardBusy || browseLock.current) return;
                  cancelSettle();
                  dragging.current = true;
                  dragAxis.current = null;
                  skipClick.current = false;
                  setSwiping(true);
                  startX.current = e.clientX;
                  startY.current = e.clientY;
                  setProgressBoth(0);
                  setVertBoth(0);
                  stageRef.current?.focus({ preventScroll: true });
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!dragging.current) return;
                  const dx = e.clientX - startX.current;
                  const dy = e.clientY - startY.current;
                  const absX = Math.abs(dx);
                  const absY = Math.abs(dy);

                  if (!dragAxis.current) {
                    if (absX < AXIS_LOCK_PX && absY < AXIS_LOCK_PX) return;
                    if (absX >= absY * AXIS_LOCK_RATIO) dragAxis.current = "x";
                    else if (absY >= absX * AXIS_LOCK_RATIO) dragAxis.current = "y";
                    else return;
                    skipClick.current = true;
                  }

                  if (dragAxis.current === "x") {
                    let next = dx / WHEEL_DRAG_RANGE;
                    if (!canGoPrev && next < 0) next = Math.max(next, -0.12);
                    if (!canGoNext && next > 0) next = Math.min(next, 0.12);
                    next = Math.max(-1.15, Math.min(1.15, next));
                    vertRef.current = 0;
                    setProgressOnDrag(next);
                  } else if (dragAxis.current === "y") {
                    let next = dy / VERT_DRAG_RANGE;
                    next = Math.max(-1.15, Math.min(1.15, next));
                    progressRef.current = 0;
                    setVertOnDrag(next);
                  }
                }}
                onPointerUp={() => {
                  if (!dragging.current) return;
                  dragging.current = false;
                  setSwiping(false);
                  finishDrag();
                }}
                onPointerCancel={() => {
                  dragging.current = false;
                  dragAxis.current = null;
                  setSwiping(false);
                  cancelSettle();
                  setProgressBoth(0);
                  setVertBoth(0);
                }}
              >
                {/* Vertical preference hints */}
                <div
                  className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center"
                  aria-hidden
                  style={{
                    opacity: flash === "up" ? 1 : likeHint,
                    transform: `translateY(${(1 - (flash === "up" ? 1 : likeHint)) * 8}px) scale(${0.85 + flashUp * 0.2})`,
                    transition: swiping ? "none" : "opacity 160ms ease, transform 160ms ease",
                  }}
                >
                  <span
                    className={`rounded-full px-3 py-1.5 text-lg shadow-md backdrop-blur-sm ${
                      flash === "up" || displayThumb === "up"
                        ? "bg-accent text-white"
                        : "bg-black/45 text-white"
                    }`}
                  >
                    👍
                  </span>
                </div>
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center"
                  aria-hidden
                  style={{
                    opacity: flash === "down" ? 1 : dislikeHint,
                    transform: `translateY(${(1 - (flash === "down" ? 1 : dislikeHint)) * -8}px) scale(${0.85 + flashDown * 0.2})`,
                    transition: swiping ? "none" : "opacity 160ms ease, transform 160ms ease",
                  }}
                >
                  <span
                    className={`rounded-full px-3 py-1.5 text-lg shadow-md backdrop-blur-sm ${
                      flash === "down" || displayThumb === "down"
                        ? "bg-danger text-white"
                        : "bg-black/45 text-white"
                    }`}
                  >
                    👎
                  </span>
                </div>

                <div
                  className="absolute right-3 top-3 z-20 flex gap-1.5"
                  style={{ opacity: centerDominance * (1 - Math.max(likeHint, dislikeHint) * 0.7) }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    disabled={pending || gestureBusy}
                    aria-label="Thumbs up — I like this meal"
                    aria-pressed={displayThumb === "up"}
                    title="I like this meal (↑)"
                    className={`rounded-full border px-2.5 py-1.5 text-base shadow-sm backdrop-blur-sm transition ${
                      displayThumb === "up"
                        ? "border-accent bg-accent text-white"
                        : "border-white/30 bg-black/40 text-white hover:border-accent hover:bg-black/55"
                    }`}
                    onClick={() => {
                      if (displayThumb === "up") {
                        setThumbOverride({ id: meal.id, thumb: null });
                        run(async () => {
                          await setMealThumbAction(meal.id, null);
                        });
                      } else {
                        applyLike();
                      }
                    }}
                  >
                    👍
                  </button>
                  <button
                    type="button"
                    disabled={pending || gestureBusy}
                    aria-label="Thumbs down — I do not like this meal"
                    aria-pressed={displayThumb === "down"}
                    title="I do not like this meal (↓)"
                    className={`rounded-full border px-2.5 py-1.5 text-base shadow-sm backdrop-blur-sm transition ${
                      displayThumb === "down"
                        ? "border-danger bg-danger text-white"
                        : "border-white/30 bg-black/40 text-white hover:border-accent hover:bg-black/55"
                    }`}
                    onClick={() => {
                      if (displayThumb === "down") {
                        setThumbOverride({ id: meal.id, thumb: null });
                        run(async () => {
                          await setMealThumbAction(meal.id, null);
                        });
                      } else {
                        applyDislike();
                      }
                    }}
                  >
                    👎
                  </button>
                </div>
              </WheelFace>
            </div>

            <div
              className={`relative z-20 rounded-b-2xl border border-t-0 border-border bg-surface px-4 py-3 shadow-md ${
                showPeeks ? "mx-[14%]" : ""
              }`}
              style={{
                opacity: 0.55 + centerDominance * 0.45,
                transition: swiping ? "none" : "opacity 160ms ease",
              }}
            >
              {total != null ? <p className="mb-2 text-xs text-muted">~{total} min</p> : null}
              <div className="flex flex-wrap items-center gap-2">
                <PlanningStyleControl
                  effectiveStyle={slot.effectivePlanningStyle}
                  override={slot.planningStyle}
                  inheritLabel={inheritSettingLabel({
                    level: "meal",
                    weekStyle: slot.weekPlanningStyle,
                    dayStyle: slot.dayPlanningStyle,
                  })}
                  disabled={pending}
                  appearance="button"
                  menuPlacement="top"
                  onChange={(next) =>
                    run(async () => {
                      await setSlotPlanningStyleAction(slot.id, next);
                    })
                  }
                />
                <Button type="button" disabled={pending || slot.locked} onClick={() => setPickOpen(true)}>
                  Add meal
                </Button>
                <Button
                  type="button"
                  variant={slot.locked ? "danger" : "secondary"}
                  disabled={pending}
                  onClick={() => run(async () => toggleLockAction(slot.id, !slot.locked))}
                  className={
                    slot.locked
                      ? "border-danger bg-danger text-white hover:border-danger hover:bg-danger/90"
                      : undefined
                  }
                >
                  {slot.locked ? "Unlock" : "Lock"}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={pending || slot.locked}
                  className="ml-auto"
                  onClick={removeSlot}
                >
                  Clear slot
                </Button>
              </div>
            </div>
          </div>

          {showArrows ? (
            <button
              type="button"
              aria-label="Next meal option"
              disabled={gestureBusy || !canGoNext}
              onClick={goNext}
              className="hidden w-10 shrink-0 items-center justify-center self-center rounded-full border border-border bg-surface text-xl text-foreground transition hover:border-accent hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-30 sm:flex"
            >
              ›
            </button>
          ) : null}
        </div>
      )}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Modal
        open={pickOpen}
        title={meal ? "Replace with a meal" : "Add a meal"}
        onClose={() => setPickOpen(false)}
      >
        <Label>Search library</Label>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" />
        <ul className="mt-3 max-h-72 overflow-auto rounded-md border border-border">
          {filtered.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted"
                disabled={pending}
                onClick={() => {
                  const picked = {
                    id: m.id,
                    name: m.name,
                    imageUrl: null as string | null,
                  };
                  persistWheel({ items: [picked], index: 0 });
                  run(async () => {
                    await assignMealToSlotAction(slot.id, m.id);
                    setPickOpen(false);
                  });
                }}
              >
                <span>{m.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </section>
  );
}

export function MealDetailPanel({
  meal,
  dayLabel,
  onBack,
  onBackToPlanner,
}: {
  meal: SlotMeal;
  dayLabel?: string;
  onBack: () => void;
  onBackToPlanner?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const photo = meal.imageUrl || "/meals/plate-warm.svg";
  const total = totalTimeMinutes(meal.prepTimeMinutes, meal.cookTimeMinutes);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="sticky top-0 z-30 -mx-4 border-b border-border bg-[var(--background)]/95 px-4 py-3 backdrop-blur-sm sm:mx-0 sm:rounded-xl sm:border sm:px-3">
        <div className="flex flex-wrap gap-2">
          {onBackToPlanner ? (
            <Button type="button" variant="primary" onClick={onBackToPlanner}>
              ← Back to planner
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={onBack}>
            {dayLabel ? `← ${dayLabel}` : "← Back to day"}
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="" className="h-56 w-full object-cover sm:h-72" />
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-3xl">{meal.name}</h2>
              {meal.description ? <p className="mt-2 text-muted">{meal.description}</p> : null}
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                disabled={pending}
                aria-label="Thumbs up"
                aria-pressed={meal.thumb === "up"}
                className={`rounded-full border px-2.5 py-1.5 text-base transition ${
                  meal.thumb === "up"
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-surface-muted hover:border-accent"
                }`}
                onClick={() => {
                  startTransition(async () => {
                    await setMealThumbAction(meal.id, meal.thumb === "up" ? null : "up");
                    router.refresh();
                  });
                }}
              >
                👍
              </button>
              <button
                type="button"
                disabled={pending}
                aria-label="Thumbs down"
                aria-pressed={meal.thumb === "down"}
                className={`rounded-full border px-2.5 py-1.5 text-base transition ${
                  meal.thumb === "down"
                    ? "border-danger bg-danger text-white"
                    : "border-border bg-surface-muted hover:border-accent"
                }`}
                onClick={() => {
                  startTransition(async () => {
                    await setMealThumbAction(meal.id, meal.thumb === "down" ? null : "down");
                    router.refresh();
                  });
                }}
              >
                👎
              </button>
            </div>
          </div>
          <p className="text-sm text-muted">
            {meal.servings} servings
            {total != null ? ` · ~${total} min` : ""}
            {meal.tags.length ? ` · ${meal.tags.join(", ")}` : ""}
          </p>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Ingredients</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {meal.ingredients.map((ing, i) => (
                <li key={`${ing.name}-${i}`}>
                  {ing.quantity != null ? `${ing.quantity} ` : ""}
                  {ing.unit ? `${ing.unit} ` : ""}
                  {ing.name}
                </li>
              ))}
            </ul>
          </div>
          {meal.instructions ? (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Method</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{meal.instructions}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
