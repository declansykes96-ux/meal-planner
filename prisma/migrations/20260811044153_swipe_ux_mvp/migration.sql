-- CreateTable
CREATE TABLE "HouseholdSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdSize" INTEGER NOT NULL DEFAULT 2,
    "rememberHouseholdSize" BOOLEAN NOT NULL DEFAULT false,
    "householdPromptCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Meal" (
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
    "suitableForLunch" BOOLEAN NOT NULL DEFAULT true,
    "suitableForDinner" BOOLEAN NOT NULL DEFAULT true,
    "suitableForBreakfast" BOOLEAN NOT NULL DEFAULT false,
    "sourceTitle" TEXT,
    "sourceUrl" TEXT,
    "discoveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MealPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startDate" DATETIME NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "householdSize" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CookedMealBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mealPlanId" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "recipeServings" INTEGER NOT NULL,
    "servingsConsumed" INTEGER NOT NULL DEFAULT 0,
    "servingsRemaining" INTEGER NOT NULL,
    "cookedOn" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CookedMealBatch_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CookedMealBatch_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlannedMeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mealPlanId" TEXT NOT NULL,
    "mealId" TEXT,
    "date" DATETIME NOT NULL,
    "mealType" TEXT NOT NULL DEFAULT 'DINNER',
    "kind" TEXT NOT NULL DEFAULT 'COOK',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "cookedMealBatchId" TEXT,
    CONSTRAINT "PlannedMeal_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlannedMeal_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlannedMeal_cookedMealBatchId_fkey" FOREIGN KEY ("cookedMealBatchId") REFERENCES "CookedMealBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Preference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PreferenceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "mealId" TEXT,
    "ingredient" TEXT,
    "replacementIngredient" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PreferenceEvent_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CookedMealBatch_mealPlanId_idx" ON "CookedMealBatch"("mealPlanId");

-- CreateIndex
CREATE INDEX "PlannedMeal_mealPlanId_idx" ON "PlannedMeal"("mealPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedMeal_mealPlanId_date_mealType_key" ON "PlannedMeal"("mealPlanId", "date", "mealType");

-- CreateIndex
CREATE INDEX "Preference_type_idx" ON "Preference"("type");

-- CreateIndex
CREATE INDEX "PreferenceEvent_type_idx" ON "PreferenceEvent"("type");

-- CreateIndex
CREATE INDEX "PreferenceEvent_ingredient_idx" ON "PreferenceEvent"("ingredient");

-- CreateIndex
CREATE INDEX "PreferenceEvent_createdAt_idx" ON "PreferenceEvent"("createdAt");
