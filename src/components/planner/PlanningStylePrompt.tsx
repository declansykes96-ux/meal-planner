"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PlanningStyle } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { completePlanningStylePromptAction } from "@/lib/actions/plans";
import { PLANNING_STYLE_META, PLANNING_STYLES } from "@/lib/planning-style";

export function PlanningStylePrompt({
  open,
  durationDays,
  initialStyle = "BALANCED",
  onClose,
}: {
  open: boolean;
  durationDays: 7 | 14;
  initialStyle?: PlanningStyle;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [style, setStyle] = useState<PlanningStyle>(initialStyle);
  const [remember, setRemember] = useState(true);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-2xl">How should we plan this week?</h2>
        <p className="mt-2 text-sm text-muted">
          Choose how strongly we prioritise meals that stretch into extra servings. You can override
          this per day or meal later.
        </p>
        <div className="mt-5 grid gap-3">
          {PLANNING_STYLES.map((opt) => {
            const meta = PLANNING_STYLE_META[opt];
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setStyle(opt)}
                className={`rounded-xl border px-4 py-4 text-left transition ${
                  style === opt
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border hover:bg-surface-muted"
                }`}
              >
                <span className="block text-lg font-medium">{meta.label}</span>
                <span
                  className={`mt-1 block text-sm ${style === opt ? "text-accent/80" : "text-muted"}`}
                >
                  {meta.blurb}
                </span>
              </button>
            );
          })}
        </div>
        <label className="mt-5 flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="size-4 accent-[var(--accent)]"
          />
          Remember this
        </label>
        <div className="mt-5 flex gap-2">
          <Button
            type="button"
            variant="ghost"
            className="flex-1 !py-3"
            disabled={pending}
            onClick={() => onClose?.()}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            className="flex-1 !py-3"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await completePlanningStylePromptAction({
                  planningStyle: style,
                  remember,
                  durationDays,
                });
                onClose?.();
                router.refresh();
              })
            }
          >
            {pending ? "Generating…" : "Generate plan"}
          </Button>
        </div>
      </div>
    </div>
  );
}
