

# Revamp Onboarding: Only for New Accounts + Add Style Preferences

## Overview

Two changes:
1. **Onboarding only on signup** -- When a user logs in (not signs up), they skip onboarding entirely. Only brand-new accounts go through it.
2. **Add style preference steps** -- After body measurements, add steps for favorite colors, disliked colors, preferred fit, and style vibe before proceeding to the garment/outfit steps.

## How it works today vs. after

**Today**: `ProtectedRoute` checks `preferences.onboarding.completed`. Any user without it gets redirected to `/onboarding` -- including existing users who never went through it.

**After**: The `handle_new_user` database trigger automatically sets `onboarding.completed = false` for new accounts. On sign-in, we skip onboarding. On sign-up, we redirect to `/onboarding`. The `ProtectedRoute` logic stays but only new profiles will have `completed = false`.

## Technical Details

### 1. Database: Auto-mark existing users as onboarded

Run a migration that:
- Updates the `handle_new_user()` trigger to set `preferences = '{"onboarding": {"completed": false}}'` for new profiles
- Updates ALL existing profiles that don't have `onboarding.completed = true` to set it to `true` (so they never see onboarding)

### 2. Auth flow (`src/pages/Auth.tsx`)

- On successful **sign-in**: no change needed (existing users already have `completed: true` from migration)
- On successful **sign-up**: redirect to `/onboarding` (already works)

### 3. New onboarding step: Style Preferences (`src/components/onboarding/StylePreferencesStep.tsx`)

A new step component that includes:
- **Favorite colors** -- grid of color chips (same as Settings > Style)
- **Disliked colors** -- grid of color chips
- **Fit preference** -- Loose / Regular / Slim selection
- **Style vibe** -- Minimal / Street / Smart casual / Klassisk selection
- **Gender-neutral toggle** -- optional

All saved to `profile.preferences` just like the Settings page does.

### 4. Update Onboarding page (`src/pages/Onboarding.tsx`)

Add the style preferences step after body measurements and before the garment/outfit steps:

```text
Step flow:
1. Language selection (existing)
2. Accent color (existing)
3. Body measurements (existing)
4. Style preferences (NEW)
5. Garment upload + outfit + reminder (existing steps 1-3)
```

### 5. Translations (`src/i18n/translations.ts`)

Add keys for the new style step:
- `onboarding.style.title` -- "Din stil"
- `onboarding.style.subtitle` -- "Hjalp din AI-stylist forsta din smak"
- `onboarding.style.favorite_colors` -- "Favoritfarger"
- `onboarding.style.disliked_colors` -- "Farger du undviker"
- `onboarding.style.fit` -- "Passform"
- `onboarding.style.vibe` -- "Stilriktning"
- `onboarding.style.gender_neutral` -- "Konsneutrala forslag"
- `onboarding.style.continue` -- "Fortsatt"

### Files to create/modify

| File | Change |
|------|--------|
| Database migration | Mark all existing profiles as onboarded; update trigger for new users |
| `src/components/onboarding/StylePreferencesStep.tsx` | New -- color picks, fit, vibe, gender-neutral |
| `src/pages/Onboarding.tsx` | Add style step between body measurements and garment steps |
| `src/i18n/translations.ts` | Add style step translation keys (sv + en) |

No changes needed to Settings, ProtectedRoute, or Auth page.
