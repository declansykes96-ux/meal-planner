import { listMeals } from "@/lib/services/meals";
import { MealLibraryClient } from "@/components/meals/MealLibraryClient";

export const dynamic = "force-dynamic";

export default async function MealsPage() {
  const meals = await listMeals();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl sm:text-4xl">Meal Library</h1>
        <p className="mt-2 text-muted">All saved meals. Favourites get a light boost when planning.</p>
      </div>
      <MealLibraryClient
        meals={meals.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          tags: m.tags,
          favourite: m.favourite,
          prepTimeMinutes: m.prepTimeMinutes,
          cookTimeMinutes: m.cookTimeMinutes,
          timesUsed: m.timesUsed,
          source: m.source,
        }))}
      />
    </div>
  );
}
