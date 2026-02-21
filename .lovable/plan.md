

## Expanded Style Onboarding (25 Questions) + Smarter AI Integration

### Overview
Replace the current simple 5-question style step with a comprehensive, multi-page style quiz (25 questions across 6 themed pages). All answers are stored in `profiles.preferences.styleProfile` and fed into both the `generate_outfit` and `style_chat` edge functions for dramatically smarter AI recommendations.

The quiz uses a swipeable page-by-page format (one theme per page) so it feels quick and engaging despite having many questions.

---

### The 25 Questions (grouped into 6 pages)

**Page 1 -- Colors (5 questions)**
1. Favorite colors (multi-select chips, 38 colors)
2. Colors you avoid (multi-select chips)
3. Do you prefer neutral/earth tones or bold/saturated colors? (single choice)
4. How do you feel about patterns? (love / neutral / avoid)
5. Which patterns do you like? (stripes, checks, florals, abstract, animal print -- multi-select, shown if not "avoid")

**Page 2 -- Fit and Silhouette (4 questions)**
6. Preferred fit: loose / regular / slim / mix
7. Top length preference: cropped / regular / oversized
8. Bottom length preference: ankle / full-length / shorts / mix
9. Layering preference: minimal layers / love layering

**Page 3 -- Style Identity (5 questions)**
10. Which style words describe you best? (minimal, street, preppy, bohemian, classic, sporty, edgy, romantic, scandi -- multi-select, max 3)
11. Style icons or brands you admire? (free text, optional)
12. How adventurous are you with fashion? (play it safe / occasionally try new things / love experimenting)
13. Gender-neutral styling? (yes/no toggle)
14. Do you follow fashion trends? (always / sometimes / prefer timeless)

**Page 4 -- Lifestyle and Context (4 questions)**
15. Typical weekday context? (office / remote work / student / active/outdoors / mix)
16. Typical weekend context? (casual outings / sports / going out / family time / mix)
17. How formal is your workplace? (very casual / business casual / formal / varies)
18. How important is comfort vs. style? (slider: comfort <-> style)

**Page 5 -- Wardrobe Goals (4 questions)**
19. What's your biggest wardrobe frustration? ("nothing to wear" / too many similar items / hard to combine / items don't fit lifestyle -- multi-select)
20. Are you trying to build a capsule wardrobe? (yes / no / what's that?)
21. Budget mindset: fast fashion / mid-range / investment pieces / mix
22. Sustainability importance: very important / somewhat / not a priority

**Page 6 -- Personal Details (3 questions)**
23. Age range: 16-24 / 25-34 / 35-44 / 45-54 / 55+
24. Climate you dress for most: Nordic cold / temperate / warm / varies a lot
25. Any specific style goals? (free text, optional -- e.g., "dress more professionally", "find my signature look")

---

### Technical Details

#### New file: `src/components/onboarding/StyleQuizStep.tsx`
- Multi-page quiz component with 6 pages, each showing 3-5 questions
- Progress indicator (dots or mini progress bar) at top
- "Next" button advances pages; "Back" available; "Skip" skips all
- All state managed locally until the last page, then saved in one batch to `profiles.preferences`
- Question types: chip multi-select, single-select buttons, toggle, slider, free text input
- Each page has a themed icon and title header matching existing onboarding design
- Bottom sticky button bar (matches existing pattern)

#### Modified file: `src/pages/Onboarding.tsx`
- Replace the `StylePreferencesStep` with the new `StyleQuizStep`
- The `StyleQuizStep` returns a `StyleProfile` object (all 25 answers) which gets saved to `profiles.preferences.styleProfile`
- Keep existing `favoriteColors`, `dislikedColors`, `fitPreference`, `styleVibe`, `genderNeutral` fields for backward compatibility (map from new quiz data)

#### Modified file: `supabase/functions/generate_outfit/index.ts`
- Expand the system prompt to include ALL style profile data from `preferences.styleProfile`
- Add trend awareness instructions: tell the AI to consider current season trends, color theory, and style coherence
- Include lifestyle context (weekday/weekend, formality level) in the prompt so the AI picks occasion-appropriate garments
- Add layering and silhouette preferences so the AI respects fit choices
- Include the user's style goals for more personalized explanations

#### Modified file: `supabase/functions/style_chat/index.ts`
- Same expansion: include full `styleProfile` in the system prompt
- Add instructions for the AI to reference the user's specific preferences when making suggestions
- Add trend-awareness instructions

#### Modified file: `src/components/onboarding/StylePreferencesStep.tsx`
- Keep the file but it becomes unused (replaced by StyleQuizStep)
- Or delete it entirely since it's replaced

#### Data structure stored in `profiles.preferences.styleProfile`:
```json
{
  "favoriteColors": ["svart", "marinblå"],
  "dislikedColors": ["gul"],
  "colorTone": "neutral",
  "patternFeeling": "neutral",
  "likedPatterns": ["stripes", "checks"],
  "fit": "regular",
  "topLength": "regular",
  "bottomLength": "full-length",
  "layering": "love",
  "styleWords": ["minimal", "scandi", "classic"],
  "styleIcons": "COS, Arket",
  "adventurousness": "occasionally",
  "genderNeutral": false,
  "trendFollowing": "sometimes",
  "weekdayContext": "office",
  "weekendContext": "casual",
  "workFormality": "business-casual",
  "comfortVsStyle": 60,
  "frustrations": ["nothing-to-wear", "hard-to-combine"],
  "capsuleWardrobe": "no",
  "budgetMindset": "mid-range",
  "sustainability": "somewhat",
  "ageRange": "25-34",
  "climate": "nordic",
  "styleGoals": "find a more polished everyday look"
}
```

### Files summary (4 modified/deleted, 1 new)
1. **New**: `src/components/onboarding/StyleQuizStep.tsx` -- 6-page, 25-question style quiz
2. `src/pages/Onboarding.tsx` -- swap StylePreferencesStep for StyleQuizStep
3. `supabase/functions/generate_outfit/index.ts` -- expanded AI prompt with full style profile + trend awareness
4. `supabase/functions/style_chat/index.ts` -- expanded AI prompt with full style profile
5. `src/components/onboarding/StylePreferencesStep.tsx` -- removed (replaced)
