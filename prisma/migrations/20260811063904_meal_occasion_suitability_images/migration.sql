-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "imageSource" TEXT,
    "imageAttribution" TEXT,
    "goodForLeftovers" BOOLEAN NOT NULL DEFAULT false,
    "leftoverStorageDays" INTEGER,
    "reheatsWell" BOOLEAN NOT NULL DEFAULT false,
    "batchFriendly" BOOLEAN NOT NULL DEFAULT false,
    "estimatedIngredientCost" REAL,
    "breakfastSuitability" REAL NOT NULL DEFAULT 0,
    "lunchSuitability" REAL NOT NULL DEFAULT 0.5,
    "dinnerSuitability" REAL NOT NULL DEFAULT 0.5,
    "suitableForLunch" BOOLEAN NOT NULL DEFAULT true,
    "suitableForDinner" BOOLEAN NOT NULL DEFAULT true,
    "suitableForBreakfast" BOOLEAN NOT NULL DEFAULT false,
    "sourceTitle" TEXT,
    "sourceUrl" TEXT,
    "discoveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Meal" ("batchFriendly", "cookTimeMinutes", "createdAt", "description", "discoveredAt", "estimatedIngredientCost", "favourite", "goodForLeftovers", "id", "imageUrl", "ingredients", "instructions", "lastUsedAt", "leftoverStorageDays", "name", "prepTimeMinutes", "reheatsWell", "servings", "source", "sourceTitle", "sourceUrl", "suitableForBreakfast", "suitableForDinner", "suitableForLunch", "tags", "timesUsed", "updatedAt") SELECT "batchFriendly", "cookTimeMinutes", "createdAt", "description", "discoveredAt", "estimatedIngredientCost", "favourite", "goodForLeftovers", "id", "imageUrl", "ingredients", "instructions", "lastUsedAt", "leftoverStorageDays", "name", "prepTimeMinutes", "reheatsWell", "servings", "source", "sourceTitle", "sourceUrl", "suitableForBreakfast", "suitableForDinner", "suitableForLunch", "tags", "timesUsed", "updatedAt" FROM "Meal";
DROP TABLE "Meal";
ALTER TABLE "new_Meal" RENAME TO "Meal";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
