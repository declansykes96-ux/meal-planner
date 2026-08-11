/** Session wheel of randomised meal options browsed per planner slot. */

export type SlotHistoryMeal = {
  id: string;
  name: string;
  imageUrl: string | null;
};

export type SlotMealWheel = {
  items: SlotHistoryMeal[];
  index: number;
};

function storageKey(slotId: string) {
  return `meal-planner-slot-wheel:${slotId}`;
}

function empty(): SlotMealWheel {
  return { items: [], index: 0 };
}

function isHistoryMeal(value: unknown): value is SlotHistoryMeal {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.name === "string";
}

export function readSlotMealWheel(slotId: string): SlotMealWheel {
  if (typeof window === "undefined") return empty();
  try {
    const raw = sessionStorage.getItem(storageKey(slotId));
    if (!raw) return migrateLegacy(slotId);
    const parsed = JSON.parse(raw) as Partial<SlotMealWheel>;
    const items = Array.isArray(parsed.items) ? parsed.items.filter(isHistoryMeal) : [];
    const index =
      typeof parsed.index === "number" && parsed.index >= 0 && parsed.index < items.length
        ? parsed.index
        : 0;
    return { items, index };
  } catch {
    return empty();
  }
}

/** One-time migrate from past/future history stacks. */
function migrateLegacy(slotId: string): SlotMealWheel {
  try {
    const legacyKey = `meal-planner-slot-history:${slotId}`;
    const raw = sessionStorage.getItem(legacyKey);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as { past?: unknown; future?: unknown };
    const past = Array.isArray(parsed.past) ? parsed.past.filter(isHistoryMeal) : [];
    const future = Array.isArray(parsed.future) ? parsed.future.filter(isHistoryMeal) : [];
    const items = [...past, ...future];
    sessionStorage.removeItem(legacyKey);
    const wheel = { items, index: Math.max(0, past.length - 1) };
    if (items.length) writeSlotMealWheel(slotId, wheel);
    return wheel;
  } catch {
    return empty();
  }
}

export function writeSlotMealWheel(slotId: string, wheel: SlotMealWheel) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(slotId), JSON.stringify(wheel));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearSlotMealWheel(slotId: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(slotId));
    sessionStorage.removeItem(`meal-planner-slot-history:${slotId}`);
  } catch {
    /* ignore */
  }
}

export function toHistoryMeal(meal: {
  id: string;
  name: string;
  imageUrl: string | null;
}): SlotHistoryMeal {
  return { id: meal.id, name: meal.name, imageUrl: meal.imageUrl };
}

/** Keep the wheel aligned with the meal currently assigned to the slot. */
export function syncWheelWithMeal(
  wheel: SlotMealWheel,
  meal: { id: string; name: string; imageUrl: string | null },
): SlotMealWheel {
  const current = toHistoryMeal(meal);
  if (wheel.items.length === 0) {
    return { items: [current], index: 0 };
  }
  const idx = wheel.items.findIndex((m) => m.id === meal.id);
  if (idx >= 0) {
    const items = wheel.items.map((m, i) => (i === idx ? current : m));
    return { items, index: idx };
  }
  // External change (library pick / regenerate) — start a fresh wheel around it
  return { items: [current], index: 0 };
}
