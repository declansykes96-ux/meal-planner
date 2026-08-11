-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlannedMeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mealPlanId" TEXT NOT NULL,
    "mealId" TEXT,
    "date" DATETIME NOT NULL,
    "mealType" TEXT NOT NULL DEFAULT 'DINNER',
    "kind" TEXT NOT NULL DEFAULT 'COOK',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cookedMealBatchId" TEXT,
    CONSTRAINT "PlannedMeal_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlannedMeal_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlannedMeal_cookedMealBatchId_fkey" FOREIGN KEY ("cookedMealBatchId") REFERENCES "CookedMealBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PlannedMeal" ("cookedMealBatchId", "date", "id", "kind", "locked", "mealId", "mealPlanId", "mealType") SELECT "cookedMealBatchId", "date", "id", "kind", "locked", "mealId", "mealPlanId", "mealType" FROM "PlannedMeal";
DROP TABLE "PlannedMeal";
ALTER TABLE "new_PlannedMeal" RENAME TO "PlannedMeal";
CREATE INDEX "PlannedMeal_mealPlanId_idx" ON "PlannedMeal"("mealPlanId");
CREATE UNIQUE INDEX "PlannedMeal_mealPlanId_date_mealType_key" ON "PlannedMeal"("mealPlanId", "date", "mealType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
