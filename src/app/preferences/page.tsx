import { PreferenceType } from "@prisma/client";
import { listAllPreferences, listBlockedMeals } from "@/lib/services/preferences";
import { getDislikeSuggestions } from "@/lib/services/preference-learning";
import { getHouseholdSettings } from "@/lib/services/household";
import { PreferencesPanel } from "@/components/preferences/PreferencesPanel";
import { LearningSuggestions } from "@/components/preferences/LearningSuggestions";

export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const [prefs, suggestions, household, blockedMeals] = await Promise.all([
    listAllPreferences(),
    getDislikeSuggestions(),
    getHouseholdSettings(),
    listBlockedMeals(),
  ]);

  const by = (type: PreferenceType) =>
    prefs.filter((p) => p.type === type).map((p) => ({ id: p.id, value: p.value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl sm:text-4xl">Preferences</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Household size, planning style, thumbs-downed meals and ingredient likes/dislikes.
          Clearing a slot or swiping for another option is not a food dislike — use 👎 for that.
        </p>
      </div>
      <LearningSuggestions suggestions={suggestions} />
      <PreferencesPanel
        liked={by(PreferenceType.LIKED_INGREDIENT)}
        disliked={by(PreferenceType.DISLIKED_INGREDIENT)}
        dietary={by(PreferenceType.DIETARY_RESTRICTION)}
        notes={by(PreferenceType.PREFERENCE_NOTE)}
        householdSize={household.householdSize}
        preferredPlanningStyle={household.preferredPlanningStyle}
        blockedMeals={blockedMeals}
      />
    </div>
  );
}
