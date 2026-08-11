/**
 * Preference signals — keep food taste separate from scheduling.
 *
 * NO SIGNAL (scheduling)
 *   Swipe left / remove slot / "Remove Tuesday lunch"
 *   → MEAL_SLOT_CLEARED. Never scores meals.
 *
 * VARIETY ONLY (not a dislike)
 *   Swipe right / "Give me something else for Tuesday dinner"
 *   → MEAL_REPLACED with signal: "variety_only".
 *   Short-term history for novelty; NOT a persistent meal dislike.
 *
 * THUMBS UP (explicit positive)
 *   👍 / "I love beef ragu"
 *   → PreferenceType.LIKED_MEAL + MEAL_ACCEPTED.
 *   Modest positive ranking. Undo by tapping again.
 *
 * THUMBS DOWN (explicit negative)
 *   👎 / "Don't suggest this meal" / "I hate tuna bake"
 *   → PreferenceType.DISLIKED_MEAL + MEAL_BLOCKED.
 *   Hard-excludes that meal until cleared. Never infers ingredient dislikes.
 *
 * EXPLICIT INGREDIENT
 *   "I hate tuna" / Preferences
 *   → PreferenceType.DISLIKED_INGREDIENT. Separate from meal thumbs.
 */

export type MealThumb = "up" | "down" | null;

export type PreferenceSignalStrength =
  | "none"
  | "variety"
  | "thumbs_up"
  | "thumbs_down"
  | "ingredient";

/** Modest boost — liked meals rank better without dominating. */
export const LIKED_MEAL_SCORE_BONUS = 5;

/** Soft tag/protein affinity from liked meals (future similarity). */
export const LIKED_SIMILARITY_SCORE_BONUS = 1.5;

export const VARIETY_HISTORY_WINDOW_DAYS = 7;
