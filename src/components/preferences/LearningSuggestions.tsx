"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  acceptDislikeSuggestionAction,
  dismissDislikeSuggestionAction,
} from "@/lib/actions/preferences";

export function LearningSuggestions({
  suggestions,
}: {
  suggestions: { ingredient: string; removalCount: number }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-2">
      {suggestions.slice(0, 2).map((s) => (
        <div
          key={s.ingredient}
          className="flex flex-col gap-3 rounded-lg border border-accent/30 bg-accent-soft/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm">
            You&apos;ve removed <strong>{s.ingredient}</strong> from recipes several times (
            {s.removalCount}). Add it as an ingredient dislike? (This is separate from clearing a
            meal slot or asking for another suggestion.)
          </p>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await acceptDislikeSuggestionAction(s.ingredient);
                  router.refresh();
                })
              }
            >
              Add to dislikes
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await dismissDislikeSuggestionAction(s.ingredient);
                  router.refresh();
                })
              }
            >
              Dismiss
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
