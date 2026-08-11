import { getPreferenceSnapshot } from "../src/lib/services/preferences";
import { listMeals } from "../src/lib/services/meals";
import { suggestReplacementMeal } from "../src/lib/services/recommendation";
import type { MealType } from "@prisma/client";

async function main() {
  const prefs = await getPreferenceSnapshot();
  const meals = await listMeals();
  const types: MealType[] = ["BREAKFAST", "LUNCH", "DINNER"];

  for (const mealType of types) {
    const picks: string[] = [];
    const exclude: string[] = [];
    for (let i = 0; i < 12; i++) {
      const m = suggestReplacementMeal(meals, prefs, exclude, 2, "BALANCED", mealType);
      if (!m) break;
      const score =
        mealType === "BREAKFAST"
          ? m.breakfastSuitability
          : mealType === "LUNCH"
            ? m.lunchSuitability
            : m.dinnerSuitability;
      picks.push(`${m.name} (${score.toFixed(2)})`);
      exclude.push(m.id);
    }
    console.log(`\n${mealType}:`);
    for (const line of picks) console.log(` - ${line}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
