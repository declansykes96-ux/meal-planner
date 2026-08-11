-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MealPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startDate" DATETIME NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "householdSize" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dayHeroes" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_MealPlan" ("createdAt", "durationDays", "householdSize", "id", "isActive", "startDate", "updatedAt") SELECT "createdAt", "durationDays", "householdSize", "id", "isActive", "startDate", "updatedAt" FROM "MealPlan";
DROP TABLE "MealPlan";
ALTER TABLE "new_MealPlan" RENAME TO "MealPlan";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
