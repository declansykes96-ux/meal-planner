"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { completeHouseholdPromptAction } from "@/lib/actions/plans";

const OPTIONS = [
  { size: 1, label: "1 person" },
  { size: 2, label: "2 people" },
] as const;

export function HouseholdPrompt({ open }: { open: boolean }) {
  const router = useRouter();
  const [size, setSize] = useState(2);
  const [remember, setRemember] = useState(true);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-2xl">How many people are we planning for?</h2>
        <p className="mt-2 text-sm text-muted">
          This scales servings, leftovers and future shopping quantities. You can change it later in
          Preferences.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {OPTIONS.map((opt) => (
            <button
              key={opt.size}
              type="button"
              onClick={() => setSize(opt.size)}
              className={`rounded-xl border px-4 py-6 text-lg font-medium transition ${
                size === opt.size
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border hover:bg-surface-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
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
        <Button
          type="button"
          variant="primary"
          className="mt-5 w-full !py-3"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await completeHouseholdPromptAction({ householdSize: size, remember });
              router.refresh();
            })
          }
        >
          {pending ? "Saving…" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
