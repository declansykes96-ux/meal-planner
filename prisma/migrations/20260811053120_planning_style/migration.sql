-- AlterTable
ALTER TABLE "PlannedMeal" ADD COLUMN "planningStyle" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HouseholdSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdSize" INTEGER NOT NULL DEFAULT 2,
    "rememberHouseholdSize" BOOLEAN NOT NULL DEFAULT false,
    "householdPromptCompleted" BOOLEAN NOT NULL DEFAULT false,
    "preferredPlanningStyle" TEXT,
    "rememberPlanningStyle" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_HouseholdSettings" ("createdAt", "householdPromptCompleted", "householdSize", "id", "rememberHouseholdSize", "updatedAt") SELECT "createdAt", "householdPromptCompleted", "householdSize", "id", "rememberHouseholdSize", "updatedAt" FROM "HouseholdSettings";
DROP TABLE "HouseholdSettings";
ALTER TABLE "new_HouseholdSettings" RENAME TO "HouseholdSettings";
CREATE TABLE "new_Meal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "ingredients" TEXT NOT NULL DEFAULT '[]',
    "instructions" TEXT NOT NULL DEFAULT '',
    "prepTimeMinutes" INTEGER,
    "cookTimeMinutes" INTEGER,
    "servings" INTEGER NOT NULL DEFAULT 4,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "favourite" BOOLEAN NOT NULL DEFAULT false,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "imageUrl" TEXT,
    "goodForLeftovers" BOOLEAN NOT NULL DEFAULT false,
    "leftoverStorageDays" INTEGER,
    "reheatsWell" BOOLEAN NOT NULL DEFAULT false,
    "batchFriendly" BOOLEAN NOT NULL DEFAULT false,
    "estimatedIngredientCost" REAL,
    "suitableForLunch" BOOLEAN NOT NULL DEFAULT true,
    "suitableForDinner" BOOLEAN NOT NULL DEFAULT true,
    "suitableForBreakfast" BOOLEAN NOT NULL DEFAULT false,
    "sourceTitle" TEXT,
    "sourceUrl" TEXT,
    "discoveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Meal" ("cookTimeMinutes", "createdAt", "description", "discoveredAt", "favourite", "goodForLeftovers", "id", "imageUrl", "ingredients", "instructions", "lastUsedAt", "leftoverStorageDays", "name", "prepTimeMinutes", "servings", "source", "sourceTitle", "sourceUrl", "suitableForBreakfast", "suitableForDinner", "suitableForLunch", "tags", "timesUsed", "updatedAt") SELECT "cookTimeMinutes", "createdAt", "description", "discoveredAt", "favourite", "goodForLeftovers", "id", "imageUrl", "ingredients", "instructions", "lastUsedAt", "leftoverStorageDays", "name", "prepTimeMinutes", "servings", "source", "sourceTitle", "sourceUrl", "suitableForBreakfast", "suitableForDinner", "suitableForLunch", "tags", "timesUsed", "updatedAt" FROM "Meal";
DROP TABLE "Meal";
ALTER TABLE "new_Meal" RENAME TO "Meal";
CREATE TABLE "new_MealPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startDate" DATETIME NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "householdSize" INTEGER NOT NULL DEFAULT 2,
    "planningStyle" TEXT NOT NULL DEFAULT 'BALANCED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dayHeroes" TEXT NOT NULL DEFAULT '{}',
    "dayPlanningStyles" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_MealPlan" ("createdAt", "dayHeroes", "durationDays", "householdSize", "id", "isActive", "startDate", "updatedAt") SELECT "createdAt", "dayHeroes", "durationDays", "householdSize", "id", "isActive", "startDate", "updatedAt" FROM "MealPlan";
DROP TABLE "MealPlan";
ALTER TABLE "new_MealPlan" RENAME TO "MealPlan";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
