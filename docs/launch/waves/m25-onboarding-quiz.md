# M25 — Onboarding quiz at full data capture

| Field | Value |
|---|---|
| Goal | Replace the minimal `StyleQuizStep` with the full 13+ question style profile capture from web's `StyleQuizV4`. |
| Status | DONE (PR #TBD) |
| Branch | `mobile-m25-onboarding-quiz` |
| PR count | 1 |
| Depends on | V0 |
| Complexity | M |

## Background

Web `StyleQuizV4.tsx` captures: archetype, formality range, color preferences, fits, brands, occasions, vibes (~13 questions, mostly multi-select grids). The output writes to `profiles.preferences.style_profile_v4_jsonb`. Mobile's current `StyleQuizStep` captures only 4 fields.

## Files touched

### New
- `mobile/src/screens/onboarding/StyleQuizV4Step.tsx` — full quiz, paginated per question. Reuse Chip + TogglePill primitives.
- `mobile/src/lib/styleProfileV4.ts` — port the schema (web `styleProfile.ts` v3-v4 translators are not needed mobile-side; save in v4 only).

### Modified
- `mobile/src/screens/OnboardingScreen.tsx` — replace `StyleQuizStep` with `StyleQuizV4Step` in the steps array.
- `mobile/src/lib/i18n.ts` — append all `onboarding.quiz_v4.*` keys.

## Pattern reference

Web schema lifts as-is; UI is reimplemented native using existing primitives.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: walk through onboarding → confirm 13+ questions, each multi-select grid working, profile JSONB written to `profiles.preferences.style_profile_v4`
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M25 — onboarding StyleQuizV4`
