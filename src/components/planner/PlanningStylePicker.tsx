"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { PlanningStyle } from "@prisma/client";
import { PLANNING_STYLE_META, PLANNING_STYLES } from "@/lib/planning-style";

/**
 * Single compact Planning Style control used at week, day, and meal-slot levels.
 * Shows the effective style as a chip; menu offers Fresh / Balanced / Stretch
 * plus an optional "Use inherited setting — …" action.
 */
export function PlanningStyleControl({
  effectiveStyle,
  override,
  inheritLabel,
  disabled,
  onChange,
  tone = "surface",
  align = "left",
  appearance = "chip",
  menuPlacement = "bottom",
}: {
  /** Currently effective style shown on the chip. */
  effectiveStyle: PlanningStyle;
  /** Explicit override at this level; null = inheriting (or N/A for week root). */
  override: PlanningStyle | null;
  /**
   * Inherit menu label, e.g. "Use weekly setting — Stretch".
   * Pass null for the week root (no inheritance).
   */
  inheritLabel: string | null;
  disabled?: boolean;
  onChange: (next: PlanningStyle | null) => void;
  tone?: "onImage" | "surface";
  align?: "left" | "right";
  /** chip = compact badge; button = matches Remove/Add meal/Lock toolbar */
  appearance?: "chip" | "button";
  /** Open above the trigger when the control sits near the bottom of a card. */
  menuPlacement?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const canInherit = inheritLabel != null;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const triggerClass =
    appearance === "button"
      ? "inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent bg-surface-muted px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-accent hover:bg-border/60 disabled:cursor-not-allowed disabled:opacity-50"
      : tone === "onImage"
        ? "rounded-full border border-white/25 bg-black/35 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/95 backdrop-blur-sm transition hover:bg-black/50"
        : "rounded-full border border-border bg-surface px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted transition hover:border-accent hover:text-foreground";

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="listbox"
        title="Planning style"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className={triggerClass}
      >
        {PLANNING_STYLE_META[effectiveStyle].short}
        {canInherit && override && appearance === "chip" ? (
          <span className="ml-1 opacity-60">·</span>
        ) : null}
      </button>

      {open ? (
        <div
          id={menuId}
          role="listbox"
          className={`absolute z-50 min-w-[13rem] overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg ${
            menuPlacement === "top" ? "bottom-full mb-1" : "top-full mt-1"
          } ${align === "right" ? "right-0" : "left-0"}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {PLANNING_STYLES.map((style) => {
            const isActive = effectiveStyle === style;
            const isOverride = canInherit && override === style;
            return (
              <button
                key={style}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-muted ${
                  isActive ? "text-accent" : "text-foreground"
                }`}
                onClick={() => {
                  onChange(style);
                  setOpen(false);
                }}
              >
                <span>{PLANNING_STYLE_META[style].label}</span>
                {canInherit && isOverride ? (
                  <span className="text-[10px] uppercase text-muted">Override</span>
                ) : null}
              </button>
            );
          })}
          {canInherit ? (
            <>
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                role="option"
                aria-selected={override == null}
                disabled={override == null}
                className="flex w-full px-3 py-2 text-left text-sm text-muted hover:bg-surface-muted disabled:opacity-40"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                {inheritLabel}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated use PlanningStyleControl — kept as alias during migration */
export function DayPlanningStyleChip({
  effectiveStyle,
  override,
  weekStyle,
  disabled,
  onChange,
  tone = "onImage",
}: {
  effectiveStyle: PlanningStyle;
  override: PlanningStyle | null;
  weekStyle: PlanningStyle;
  disabled?: boolean;
  onChange: (next: PlanningStyle | null) => void;
  tone?: "onImage" | "surface";
}) {
  return (
    <PlanningStyleControl
      effectiveStyle={effectiveStyle}
      override={override}
      inheritLabel={`Use weekly setting — ${PLANNING_STYLE_META[weekStyle].short}`}
      disabled={disabled}
      onChange={onChange}
      tone={tone}
    />
  );
}

/** @deprecated use PlanningStyleControl for the week root */
export function PlanningStylePicker({
  value,
  disabled,
  onChange,
}: {
  value: PlanningStyle | null;
  inheritedLabel?: string;
  disabled?: boolean;
  allowClear?: boolean;
  onChange: (next: PlanningStyle | null) => void;
  size?: "sm" | "md";
}) {
  if (!value) return null;
  return (
    <PlanningStyleControl
      effectiveStyle={value}
      override={value}
      inheritLabel={null}
      disabled={disabled}
      onChange={(next) => {
        if (next) onChange(next);
      }}
    />
  );
}
