"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { MealFormFields } from "@/components/meals/MealFormFields";
import { createMealAction, toggleMealFavouriteAction } from "@/lib/actions/meals";
import { totalTimeMinutes } from "@/lib/types/meal";

export type LibraryMeal = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  favourite: boolean;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  timesUsed: number;
  source: string;
};

export function MealLibraryClient({ meals }: { meals: LibraryMeal[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return meals;
    return meals.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [meals, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          className="w-full max-w-md rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          placeholder="Search by meal name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button variant="primary" onClick={() => setAddOpen(true)}>
          Add meal
        </Button>
      </div>

      <ul className="grid gap-3 md:grid-cols-2">
        {filtered.map((meal) => {
          const total = totalTimeMinutes(meal.prepTimeMinutes, meal.cookTimeMinutes);
          return (
            <li key={meal.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-lg">{meal.name}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{meal.description || "No description"}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await toggleMealFavouriteAction(meal.id, !meal.favourite);
                      router.refresh();
                    })
                  }
                >
                  {meal.favourite ? "★" : "☆"}
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                {total != null ? <span>~{total} min</span> : null}
                <span>Used {meal.timesUsed}×</span>
                <span>{meal.source}</span>
              </div>
              {meal.tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {meal.tags.map((tag) => (
                    <span key={tag} className="rounded bg-surface-muted px-2 py-0.5 text-xs text-muted">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <Link href={`/meals/${meal.id}`} className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
                View / edit
              </Link>
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 ? <p className="text-sm text-muted">No meals found.</p> : null}

      <Modal open={addOpen} title="Add meal" onClose={() => setAddOpen(false)}>
        <MealFormFields
          pending={pending}
          submitLabel="Save meal"
          onSubmit={(data) =>
            startTransition(async () => {
              const result = await createMealAction(data);
              setAddOpen(false);
              router.push(`/meals/${result.mealId}`);
              router.refresh();
            })
          }
        />
      </Modal>
    </div>
  );
}
