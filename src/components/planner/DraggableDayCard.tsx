"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { previewTransform, useDayDrag } from "@/components/planner/day-drag-context";

/** Start drag once the pointer moves this far (desktop + touch). */
const DRAG_THRESHOLD_PX = 6;
/**
 * Touch-only: short arm window so a quick horizontal flick can scroll the
 * carousel instead of lifting the card. Movement past the threshold with a
 * clear horizontal bias cancels before this fires.
 */
const TOUCH_ARM_MS = 140;
const SCROLL_ANGLE_RATIO = 1.35;
const PREVIEW_MS = 200;

type GhostState = {
  x: number;
  y: number;
  width: number;
  height: number;
  grabOffsetX: number;
  grabOffsetY: number;
};

/**
 * Whole-card direct manipulation with live swap preview:
 * hovering another day slides that card into the source slot before release.
 */
export function DraggableDayCard({
  dateKey,
  disabled,
  className,
  children,
  onOpen,
  onSwapWith,
}: {
  dateKey: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  onOpen: () => void;
  onSwapWith: (targetDateKey: string) => void;
}) {
  const dayDrag = useDayDrag();
  const [active, setActive] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [ghost, setGhost] = useState<GhostState | null>(null);

  const shellRef = useRef<HTMLDivElement>(null);
  const origin = useRef({ x: 0, y: 0, key: dateKey, pointerType: "mouse" });
  const armTimer = useRef<number | null>(null);
  const touchArmed = useRef(false);
  const session = useRef<"idle" | "pressing" | "dragging">("idle");
  const onOpenRef = useRef(onOpen);
  const onSwapRef = useRef(onSwapWith);
  const hoverKeyRef = useRef<string | null>(null);

  useEffect(() => {
    onOpenRef.current = onOpen;
    onSwapRef.current = onSwapWith;
  }, [onOpen, onSwapWith]);

  useEffect(() => {
    origin.current.key = dateKey;
  }, [dateKey]);

  function clearArmTimer() {
    if (armTimer.current != null) {
      window.clearTimeout(armTimer.current);
      armTimer.current = null;
    }
  }

  function endSession() {
    clearArmTimer();
    touchArmed.current = false;
    session.current = "idle";
    hoverKeyRef.current = null;
    setActive(false);
    setDragging(false);
    setGhost(null);
    dayDrag?.endDrag();
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }

  function beginDrag(clientX: number, clientY: number) {
    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect) return;
    clearArmTimer();
    session.current = "dragging";
    setDragging(true);
    const originRect = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
    dayDrag?.beginDrag(dateKey, originRect);
    setGhost({
      x: clientX,
      y: clientY,
      width: rect.width,
      height: rect.height,
      grabOffsetX: clientX - rect.left,
      grabOffsetY: clientY - rect.top,
    });
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  }

  function updateDropTarget(clientX: number, clientY: number) {
    const el = document.elementFromPoint(clientX, clientY);
    const dayEl = el?.closest("[data-day-key]") as HTMLElement | null;
    const key = dayEl?.dataset.dayKey;
    const next = key && key !== origin.current.key ? key : null;
    if (hoverKeyRef.current === next) return;
    hoverKeyRef.current = next;
    dayDrag?.setHoverKey(next);
  }

  useEffect(() => {
    if (!active) return;

    function onMove(e: PointerEvent) {
      if (session.current === "pressing") {
        const dx = e.clientX - origin.current.x;
        const dy = e.clientY - origin.current.y;
        const dist = Math.hypot(dx, dy);
        if (dist < DRAG_THRESHOLD_PX) return;

        const isTouch = origin.current.pointerType === "touch";
        if (isTouch && !touchArmed.current) {
          if (Math.abs(dx) > Math.abs(dy) * SCROLL_ANGLE_RATIO) {
            endSession();
            return;
          }
        }

        e.preventDefault();
        beginDrag(e.clientX, e.clientY);
        updateDropTarget(e.clientX, e.clientY);
        return;
      }

      if (session.current !== "dragging") return;
      e.preventDefault();
      setGhost((prev) =>
        prev
          ? {
              ...prev,
              x: e.clientX,
              y: e.clientY,
            }
          : prev,
      );
      updateDropTarget(e.clientX, e.clientY);
    }

    function onUp(e: PointerEvent) {
      const mode = session.current;
      const startKey = origin.current.key;
      const dropKey = hoverKeyRef.current;

      if (mode === "pressing") {
        endSession();
        onOpenRef.current();
        return;
      }

      if (mode !== "dragging") {
        endSession();
        return;
      }

      // Prefer live hover target; fall back to hit-test under pointer
      let key = dropKey;
      if (!key) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const dayEl = el?.closest("[data-day-key]") as HTMLElement | null;
        const hit = dayEl?.dataset.dayKey;
        if (hit && hit !== startKey) key = hit;
      }

      endSession();
      if (key && key !== startKey) onSwapRef.current(key);
    }

    function onCancel() {
      endSession();
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, dayDrag]);

  function onPointerDown(e: React.PointerEvent) {
    if (disabled) return;
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea, [role='listbox'], [role='option']")) {
      return;
    }

    session.current = "pressing";
    touchArmed.current = false;
    origin.current = {
      x: e.clientX,
      y: e.clientY,
      key: dateKey,
      pointerType: e.pointerType || "mouse",
    };
    document.body.style.userSelect = "none";
    setActive(true);

    clearArmTimer();
    if (e.pointerType === "touch") {
      armTimer.current = window.setTimeout(() => {
        if (session.current !== "pressing") return;
        touchArmed.current = true;
      }, TOUCH_ARM_MS);
    }
  }

  const snapshot = dayDrag?.snapshot ?? null;
  const isSource = snapshot?.sourceKey === dateKey;
  const isHoverTarget = snapshot?.hoverKey === dateKey;
  const move = previewTransform(snapshot, dateKey);

  const ghostNode =
    typeof document !== "undefined" && dragging && ghost
      ? createPortal(
          <div
            aria-hidden
            className="pointer-events-none fixed z-[120] overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl ring-2 ring-accent/35"
            style={{
              left: ghost.x - ghost.grabOffsetX,
              top: ghost.y - ghost.grabOffsetY,
              width: ghost.width,
              height: ghost.height,
              transform: "scale(1.04)",
              opacity: 0.98,
              willChange: "left, top",
            }}
          >
            <div className="h-full w-full">{children}</div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={shellRef}
        data-day-key={dateKey}
        data-day-source={isSource ? "true" : undefined}
        data-day-preview={isHoverTarget ? "true" : undefined}
        className={`relative h-full w-full ${
          dragging || isSource ? "" : "cursor-grab active:cursor-grabbing"
        }`}
        style={{
          touchAction: dragging || isSource ? "none" : "pan-x pan-y",
          zIndex: isHoverTarget ? 40 : isSource ? 0 : undefined,
        }}
        onPointerDown={onPointerDown}
      >
        {isSource ? (
          <div
            aria-hidden
            className="box-border rounded-3xl border-2 border-dashed border-border/70 bg-surface-muted/35"
            style={{
              width: "100%",
              height: snapshot?.originRect.height,
              minHeight: snapshot?.originRect.height,
            }}
          />
        ) : (
          <div
            className={`h-full will-change-transform ${className ?? ""}`}
            style={{
              transform: move?.transform ?? "none",
              transformOrigin: "top left",
              zIndex: move?.zIndex,
              transition: `transform ${PREVIEW_MS}ms ease`,
              position: move ? "relative" : undefined,
            }}
          >
            {children}
          </div>
        )}
      </div>
      {ghostNode}
    </>
  );
}
