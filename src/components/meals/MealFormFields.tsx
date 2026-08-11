"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Field";
import type { IngredientLine } from "@/lib/types/meal";

export function IngredientEditor({
  value,
  onChange,
  onRemoveIngredient,
}: {
  value: IngredientLine[];
  onChange: (next: IngredientLine[]) => void;
  onRemoveIngredient?: (name: string) => void;
}) {
  return (
    <div className="space-y-2">
      {value.map((line, index) => (
        <div key={`${line.name}-${index}`} className="grid grid-cols-12 gap-2">
          <Input
            className="col-span-5"
            placeholder="Name"
            value={line.name}
            onChange={(e) => {
              const next = [...value];
              next[index] = { ...line, name: e.target.value };
              onChange(next);
            }}
          />
          <Input
            className="col-span-3"
            placeholder="Qty"
            value={line.quantity ?? ""}
            onChange={(e) => {
              const next = [...value];
              const n = e.target.value === "" ? null : Number(e.target.value);
              next[index] = { ...line, quantity: Number.isNaN(n as number) ? null : n };
              onChange(next);
            }}
          />
          <Input
            className="col-span-2"
            placeholder="Unit"
            value={line.unit ?? ""}
            onChange={(e) => {
              const next = [...value];
              next[index] = { ...line, unit: e.target.value || null };
              onChange(next);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            className="col-span-2 !px-2"
            onClick={() => {
              onRemoveIngredient?.(line.name);
              onChange(value.filter((_, i) => i !== index));
            }}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() => onChange([...value, { name: "", quantity: null, unit: null }])}
      >
        Add ingredient
      </Button>
    </div>
  );
}

export function MealFormFields({
  initial,
  onSubmit,
  submitLabel,
  pending,
}: {
  initial?: {
    name?: string;
    description?: string;
    instructions?: string;
    prepTimeMinutes?: number | null;
    cookTimeMinutes?: number | null;
    servings?: number;
    tags?: string[];
    ingredients?: IngredientLine[];
  };
  onSubmit: (data: {
    name: string;
    description: string;
    instructions: string;
    prepTimeMinutes: number | null;
    cookTimeMinutes: number | null;
    servings: number;
    tags: string[];
    ingredients: IngredientLine[];
    removedIngredients: string[];
  }) => void;
  submitLabel: string;
  pending?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [prep, setPrep] = useState(initial?.prepTimeMinutes?.toString() ?? "");
  const [cook, setCook] = useState(initial?.cookTimeMinutes?.toString() ?? "");
  const [servings, setServings] = useState((initial?.servings ?? 4).toString());
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [ingredients, setIngredients] = useState<IngredientLine[]>(
    initial?.ingredients?.length ? initial.ingredients : [{ name: "", quantity: null, unit: null }],
  );
  const [removed, setRemoved] = useState<string[]>([]);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name: name.trim(),
          description: description.trim(),
          instructions: instructions.trim(),
          prepTimeMinutes: prep ? Number(prep) : null,
          cookTimeMinutes: cook ? Number(cook) : null,
          servings: Number(servings) || 4,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          ingredients: ingredients.filter((i) => i.name.trim()),
          removedIngredients: removed,
        });
      }}
    >
      <div>
        <Label>Name</Label>
        <Input required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label>Prep (min)</Label>
          <Input value={prep} onChange={(e) => setPrep(e.target.value)} />
        </div>
        <div>
          <Label>Cook (min)</Label>
          <Input value={cook} onChange={(e) => setCook(e.target.value)} />
        </div>
        <div>
          <Label>Servings</Label>
          <Input value={servings} onChange={(e) => setServings(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Tags (comma separated)</Label>
        <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="chicken, quick" />
      </div>
      <div>
        <Label>Ingredients</Label>
        <IngredientEditor
          value={ingredients}
          onChange={setIngredients}
          onRemoveIngredient={(n) => {
            if (n.trim()) setRemoved((r) => [...r, n.trim()]);
          }}
        />
      </div>
      <div>
        <Label>Instructions</Label>
        <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </div>
      <Button type="submit" variant="primary" disabled={pending || !name.trim()}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
