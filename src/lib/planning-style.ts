import type { PlanningStyle } from "@prisma/client";

export const PLANNING_STYLES: PlanningStyle[] = ["FRESH", "BALANCED", "STRETCH"];

export const PLANNING_STYLE_META: Record<
  PlanningStyle,
  { label: string; short: string; blurb: string }
> = {
  FRESH: {
    label: "Fresh",
    short: "Fresh",
    blurb: "Mostly meals for that sitting",
  },
  BALANCED: {
    label: "Balanced",
    short: "Balanced",
    blurb: "A mix of fresh meals and useful leftovers",
  },
  STRETCH: {
    label: "Stretch",
    short: "Stretch",
    blurb: "Favour meals that feed us more than once",
  },
};

export function isPlanningStyle(value: unknown): value is PlanningStyle {
  return value === "FRESH" || value === "BALANCED" || value === "STRETCH";
}

export function parseDayPlanningStyles(raw: string | null | undefined): Record<string, PlanningStyle> {
  try {
    const parsed = JSON.parse(raw || "{}") as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, PlanningStyle> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isPlanningStyle(value)) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeDayPlanningStyles(map: Record<string, PlanningStyle>): string {
  return JSON.stringify(map);
}

/**
 * MEAL SLOT → DAY → WEEK
 * Most specific wins. Null overrides mean inherit from the parent level.
 */
export function resolveEffectivePlanningStyle(input: {
  weekStyle: PlanningStyle;
  dayStyle?: PlanningStyle | null;
  slotStyle?: PlanningStyle | null;
}): PlanningStyle {
  if (input.slotStyle) return input.slotStyle;
  if (input.dayStyle) return input.dayStyle;
  return input.weekStyle || "BALANCED";
}

/** Parent value for a meal slot (day override ?? week). */
export function resolveParentPlanningStyle(input: {
  weekStyle: PlanningStyle;
  dayStyle?: PlanningStyle | null;
}): PlanningStyle {
  return input.dayStyle ?? input.weekStyle ?? "BALANCED";
}

/** Label for the inherit menu action at day or meal level. */
export function inheritSettingLabel(input: {
  level: "day" | "meal";
  weekStyle: PlanningStyle;
  dayStyle?: PlanningStyle | null;
}): string {
  if (input.level === "day") {
    return `Use weekly setting — ${PLANNING_STYLE_META[input.weekStyle].short}`;
  }
  if (input.dayStyle) {
    return `Use day setting — ${PLANNING_STYLE_META[input.dayStyle].short}`;
  }
  return `Use weekly setting — ${PLANNING_STYLE_META[input.weekStyle].short}`;
}
