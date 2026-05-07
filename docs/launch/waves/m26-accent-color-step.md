# M26 — AccentColorStep

| Field | Value |
|---|---|
| Goal | Port AccentColorStep so the user picks a personal accent color during onboarding (drives a subtle UI tint + memory signal). |
| Status | DONE (PR #752) |
| Branch | `mobile-m26-accent-color-step` |
| PR count | 1 |
| Depends on | V0 |
| Complexity | S |

## Background

Web `AccentColorStep.tsx` shows a swatch grid (12 curated neutrals + warm tones). The choice writes to `profiles.preferences.accent_color`. Mobile currently has the warm-gold token only; this step doesn't change the brand accent — it informs styling preferences (color memory).

## Files touched

### New
- `mobile/src/screens/onboarding/AccentColorStep.tsx` — swatch grid; on confirm, write to `profiles.preferences.accent_color`.

### Modified
- `mobile/src/screens/OnboardingScreen.tsx` — insert AccentColorStep after StyleQuizV4Step (M25).
- `mobile/src/lib/i18n.ts` — append `onboarding.accent_color.*` keys.

## Pattern reference

Web AccentColorStep is a simple swatch grid. Use existing `Card` + `Chip` primitives.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: walk onboarding → AccentColorStep renders → pick a color → confirm saved to profile
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M26 — AccentColorStep`
