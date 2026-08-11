"use client";

import { PreferenceType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select, Label } from "@/components/ui/Field";
import {
  addPreferenceAction,
  deletePreferenceAction,
  updateHouseholdSizeFromPrefsAction,
  updatePreferenceAction,
} from "@/lib/actions/preferences";

type PrefRow = { id: string; value: string };

function PreferenceSection({
  title,
  hint,
  type,
  rows,
  multiline,
}: {
  title: string;
  hint: string;
  type: PreferenceType;
  rows: PrefRow[];
  multiline?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  function refresh(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-xl">{title}</h2>
      <p className="text-sm text-muted">{hint}</p>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-md border border-border/60 p-2">
            {editingId === row.id ? (
              <div className="space-y-2">
                {multiline ? (
                  <Textarea value={editingValue} onChange={(e) => setEditingValue(e.target.value)} />
                ) : (
                  <Input value={editingValue} onChange={(e) => setEditingValue(e.target.value)} />
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    disabled={pending}
                    onClick={() =>
                      refresh(async () => {
                        await updatePreferenceAction(row.id, editingValue);
                        setEditingId(null);
                      })
                    }
                  >
                    Save
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm">{row.value}</p>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    className="!px-2 !py-0.5 text-xs"
                    onClick={() => {
                      setEditingId(row.id);
                      setEditingValue(row.value);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="!px-2 !py-0.5 text-xs"
                    disabled={pending}
                    onClick={() => refresh(async () => deletePreferenceAction(row.id))}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
        {rows.length === 0 ? <li className="text-sm text-muted">None yet.</li> : null}
      </ul>
      <div className={`flex gap-2 ${multiline ? "flex-col" : ""}`}>
        {multiline ? (
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add note…" />
        ) : (
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add…" />
        )}
        <Button
          type="button"
          variant="primary"
          className={multiline ? "self-start" : ""}
          disabled={pending || !draft.trim()}
          onClick={() =>
            refresh(async () => {
              await addPreferenceAction(type, draft.trim());
              setDraft("");
            })
          }
        >
          Add
        </Button>
      </div>
    </section>
  );
}

export function PreferencesPanel({
  liked,
  disliked,
  dietary,
  notes,
  householdSize,
  preferredPlanningStyle,
  blockedMeals,
}: {
  liked: PrefRow[];
  disliked: PrefRow[];
  dietary: PrefRow[];
  notes: PrefRow[];
  householdSize: number;
  preferredPlanningStyle: "FRESH" | "BALANCED" | "STRETCH" | null;
  blockedMeals: { preferenceId: string; mealId: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3 rounded-lg border border-border bg-surface p-4 lg:col-span-2">
        <h2 className="text-xl">Household size</h2>
        <p className="text-sm text-muted">
          Used for servings, leftovers and future shopping quantities. More sizes can be added later.
        </p>
        <div className="max-w-xs">
          <Label htmlFor="household-size">People</Label>
          <Select
            id="household-size"
            defaultValue={String(householdSize)}
            disabled={pending}
            onChange={(e) =>
              startTransition(async () => {
                await updateHouseholdSizeFromPrefsAction(Number(e.target.value));
                router.refresh();
              })
            }
          >
            <option value="1">1 person</option>
            <option value="2">2 people</option>
            <option value="3">3 people</option>
            <option value="4">4 people</option>
          </Select>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-surface p-4 lg:col-span-2">
        <h2 className="text-xl">Planning style</h2>
        <p className="text-sm text-muted">
          Default for new weekly plans. Controls how strongly we favour meals that stretch into
          extra servings — not a cheap-vs-expensive budget setting.
        </p>
        <div className="max-w-xs">
          <Label htmlFor="planning-style">Default style</Label>
          <Select
            id="planning-style"
            defaultValue={preferredPlanningStyle ?? "BALANCED"}
            disabled={pending}
            onChange={(e) =>
              startTransition(async () => {
                const { updatePreferredPlanningStyleAction } = await import(
                  "@/lib/actions/plans"
                );
                await updatePreferredPlanningStyleAction(
                  e.target.value as "FRESH" | "BALANCED" | "STRETCH",
                );
                router.refresh();
              })
            }
          >
            <option value="FRESH">Fresh — mostly meals for that sitting</option>
            <option value="BALANCED">Balanced — mix of fresh and leftovers</option>
            <option value="STRETCH">Stretch — favour multi-serving meals</option>
          </Select>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-surface p-4 lg:col-span-2">
        <h2 className="text-xl">Don&apos;t suggest these meals</h2>
        <p className="text-sm text-muted">
          Meals you thumbs-downed. Separate from clearing a meal slot (scheduling) and from
          ingredient dislikes. Allow again anytime.
        </p>
        <ul className="space-y-2">
          {blockedMeals.map((row) => (
            <li
              key={row.preferenceId}
              className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2"
            >
              <span className="text-sm">{row.name}</span>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const { unblockMealAction } = await import("@/lib/actions/plans");
                    await unblockMealAction(row.mealId);
                    router.refresh();
                  })
                }
              >
                Allow again
              </Button>
            </li>
          ))}
          {blockedMeals.length === 0 ? (
            <li className="text-sm text-muted">None yet. Use 👎 on a meal card.</li>
          ) : null}
        </ul>
      </section>

      <PreferenceSection
        title="Disliked Ingredients"
        hint="Explicit ingredient exclusions only — never inferred from replacing a single meal."
        type={PreferenceType.DISLIKED_INGREDIENT}
        rows={disliked}
      />
      <PreferenceSection
        title="Liked Ingredients"
        hint="Soft boosts in recommendations."
        type={PreferenceType.LIKED_INGREDIENT}
        rows={liked}
      />
      <PreferenceSection
        title="Dietary Restrictions"
        hint="Allergies and restrictions respected by the planner."
        type={PreferenceType.DIETARY_RESTRICTION}
        rows={dietary}
      />
      <PreferenceSection
        title="Preference Notes"
        hint="Softer preferences for later smarter planning."
        type={PreferenceType.PREFERENCE_NOTE}
        rows={notes}
        multiline
      />
    </div>
  );
}
