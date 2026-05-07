# M27 — Coach tour

| Field | Value |
|---|---|
| Goal | First-run coach overlay (web's CoachTourStep + PhotoTutorialStep) — short walkthrough of Home, Wardrobe, Add, Outfits. |
| Status | DONE (PR #TBD) |
| Branch | `mobile-m27-coach-tour` |
| PR count | 1 |
| Depends on | V0 |
| Complexity | M |

## Background

Web `CoachTourStep.tsx` + `PhotoTutorialStep.tsx` show post-onboarding coachmarks and a one-screen "how to take garment photos" tutorial. Mobile has neither. First-run UX feels abrupt without it.

## Files touched

### New
- `mobile/src/components/CoachOverlay.tsx` — reusable overlay primitive: dimmed background, target hole, caption, "Next/Skip".
- `mobile/src/hooks/useFirstRunCoach.ts` — reads `profiles.preferences.coach_tour_completed_at`; gates the overlay sequence.
- `mobile/src/screens/onboarding/PhotoTutorialStep.tsx` — single-screen tutorial illustrating good/bad garment photos.

### Modified
- `mobile/src/screens/HomeScreen.tsx` — coachmark on first visit ("Today's outfit goes here"). Step 1.
- `mobile/src/screens/WardrobeScreen.tsx` — Step 2 ("Your garments live here").
- `mobile/src/screens/MainTabsScreen.tsx` — Step 3 (FAB "Tap (+) to add a piece").
- `mobile/src/screens/OutfitsScreen.tsx` — Step 4 ("Saved outfits land here").
- `mobile/src/screens/OnboardingScreen.tsx` — insert PhotoTutorialStep before StudioSelectionStep.

## Pattern reference

CoachOverlay can use React Native's `Modal` + an absolute-positioned target rect, measured via `onLayout` + `measureInWindow`.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: fresh install → walk onboarding → photo tutorial appears → 4-step coach overlay sequences through tabs → "completed" persists; second launch → no overlay
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M27 — coach tour + photo tutorial`
