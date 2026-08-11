"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { MealFormFields } from "@/components/meals/MealFormFields";
import {
  recordIngredientRemovedAction,
  toggleMealFavouriteAction,
  updateMealAction,
} from "@/lib/actions/meals";
import { totalTimeMinutes, type IngredientLine } from "@/lib/types/meal";

export function MealDetailClient({
  meal,
}: {
  meal: {
    id: string;
    name: string;
    description: string;
    instructions: string;
    prepTimeMinutes: number | null;
    cookTimeMinutes: number | null;
    servings: number;
    tags: string[];
    ingredients: IngredientLine[];
    favourite: boolean;
    timesUsed: number;
    source: string;
  };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const total = totalTimeMinutes(meal.prepTimeMinutes, meal.cookTimeMinutes);

  return (
    <div className="space-y-4">
      <Link href="/meals" className="text-sm text-accent hover:underline">
        ← Meal Library
      </Link>

      {!editing ? (
        <div className="space-y-4 rounded-lg border border-border bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl">{meal.name}</h1>
              <p className="mt-1 text-sm text-muted">
                {meal.source} · used {meal.timesUsed}×
                {total != null ? ` · ~${total} min` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await toggleMealFavouriteAction(meal.id, !meal.favourite);
                    router.refresh();
                  })
                }
              >
                {meal.favourite ? "Unfavourite" : "Favourite"}
              </Button>
              <Button type="button" onClick={() => setEditing(true)}>
                Edit
              </Button>
            </div>
          </div>
          {meal.description ? <p className="text-muted">{meal.description}</p> : null}
          <div>
            <h2 className="mb-2 text-lg">Ingredients</h2>
            <ul className="space-y-1 text-sm">
              {meal.ingredients.map((ing, i) => (
                <li key={`${ing.name}-${i}`}>
                  {ing.quantity != null ? `${ing.quantity} ` : ""}
                  {ing.unit ? `${ing.unit} ` : ""}
                  {ing.name}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-2 text-lg">Instructions</h2>
            <p className="whitespace-pre-wrap text-sm">{meal.instructions || "No instructions yet."}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-5">
          <MealFormFields
            pending={pending}
            submitLabel="Save"
            initial={meal}
            onSubmit={(data) =>
              startTransition(async () => {
                await updateMealAction({
                  id: meal.id,
                  name: data.name,
                  description: data.description,
                  instructions: data.instructions,
                  prepTimeMinutes: data.prepTimeMinutes,
                  cookTimeMinutes: data.cookTimeMinutes,
                  servings: data.servings,
                  tags: data.tags,
                  ingredients: data.ingredients,
                });
                for (const name of data.removedIngredients) {
                  await recordIngredientRemovedAction(meal.id, name);
                }
                setEditing(false);
                router.refresh();
              })
            }
          />
          <Button type="button" variant="ghost" className="mt-2" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
