

# Auth & Onboarding Premium Redesign

## Current State

**Auth (Auth.tsx):** Single page with login/signup tabs, OAuth buttons, glass card on noir background. Has password requirements, remember me, forgot password. ~360 lines. Works but feels dense — too many fields visible at once on signup.

**Onboarding (4 steps):** Language → Accent Color → 32-question Style Quiz → App Tutorial. The quiz is the problem — 32 questions is far too many for a first-time experience. Users will drop off. The language step uses a gradient header that doesn't match the noir aesthetic. The tutorial carousel is functional but generic.

**Reset Password:** Uses Card components with light-mode styling — completely inconsistent with the noir auth design.

## Design Problems

1. **32-question quiz is excessive** — users want value, not a form marathon. Reduce to ~8 focused questions.
2. **Language + Accent Color steps feel like setup, not onboarding** — move language to settings, keep accent color but make it lighter.
3. **App tutorial is generic** — replace with a "What do you want to do first?" action screen that gets users to value immediately.
4. **Reset Password page doesn't match noir aesthetic** — needs the same dark treatment.
5. **Auth page is solid** but could be cleaner — reduce visual noise, stronger CTA hierarchy.

## Plan

### 1. Redesign Auth Page (`src/pages/Auth.tsx`)

- Keep the noir background, aurora glow, OAuth buttons, login/signup tabs
- **Simplify signup**: remove username field (display_name from email is fine initially), remove confirm password field (reduce friction — they'll verify via email anyway)
- Keep password requirements checklist but make it more compact
- Keep remember me
- Stronger visual hierarchy: larger "Sign in" / "Create account" CTA button
- Cleaner spacing between sections

### 2. Redesign Reset Password (`src/pages/ResetPassword.tsx`)

- Apply noir background with aurora glow matching Auth page
- Replace Card/CardHeader with inline dark styling
- Fix "DRAPE" branding → use BURS logo
- Same input styling as Auth page

### 3. Redesign Onboarding Flow (`src/pages/Onboarding.tsx`)

**New 4-step flow** (down from 4 steps but with a dramatically shorter quiz):

1. **Welcome + Language** — combine into one screen: BURS logo, one-line welcome, language selector below, continue button
2. **Accent Color** — keep but with noir background styling to match auth flow
3. **Quick Style Profile** (NEW — replaces 32-question quiz) — only 8 questions across 3 screens:
   - Screen A: Gender, Age range, Climate (3 taps)
   - Screen B: Style words (pick 3), Fit preference (2 taps)  
   - Screen C: What do you want help with (bursGoal), Common occasions (hardestOccasions), Morning time (3 taps)
4. **Get Started** (NEW — replaces tutorial) — "You're ready" celebration screen with 3 first-value action cards:
   - "Add your first garment" → /wardrobe/add
   - "Generate an outfit" → /
   - "Talk to your stylist" → /ai

### 4. New Quick Style Quiz Component (`src/components/onboarding/QuickStyleQuiz.tsx`)

- Replace `StyleQuizV3` (32 questions) with a compact 3-page quiz
- Collect only the most useful fields for AI personalization: gender, ageRange, climate, styleWords, fit, bursGoal, hardestOccasions, morningTime
- Same `StyleProfileV3` interface (fill unused fields with defaults)
- One-per-screen layout with auto-advance on single-select
- Noir background styling consistent with auth
- Progress dots instead of progress bar
- Skip option on first screen

### 5. Get Started Screen (`src/components/onboarding/GetStartedStep.tsx`)

- Celebration moment: checkmark animation + "You're all set"
- 3 action cards with icons leading to first-value actions
- Tapping any card completes onboarding and navigates

### 6. Update Welcome + Language Step (`src/components/onboarding/LanguageStep.tsx`)

- Noir background (remove gradient header)
- BURS logo at top
- Compact language grid
- "Welcome to BURS" heading

### 7. Update Accent Color Step (`src/components/onboarding/AccentColorStep.tsx`)

- Noir background consistency
- Remove gradient, use subtle styling

### 8. Translation Keys (`src/i18n/translations.ts`)

- Add keys for new onboarding screens
- Add keys for GetStartedStep action cards

## Files Modified

| File | Change |
|------|--------|
| `src/pages/Auth.tsx` | Simplify signup form, polish spacing |
| `src/pages/ResetPassword.tsx` | Noir redesign, BURS branding |
| `src/pages/Onboarding.tsx` | New 4-step flow with quick quiz + get started |
| `src/components/onboarding/LanguageStep.tsx` | Noir styling, BURS logo |
| `src/components/onboarding/AccentColorStep.tsx` | Noir styling |
| `src/components/onboarding/QuickStyleQuiz.tsx` | NEW — 8-question compact quiz |
| `src/components/onboarding/GetStartedStep.tsx` | NEW — first-value action screen |
| `src/i18n/translations.ts` | New translation keys |

## What Stays the Same

- All auth logic (AuthContext, signUp, signIn, OAuth, remember me)
- Profile/preferences data model
- ProtectedRoute + onboarding check logic
- StyleProfileV3 interface (backwards compatible)
- Routing structure

## Implementation Order

1. Auth page polish (smallest change, immediate visual improvement)
2. Reset Password noir redesign
3. QuickStyleQuiz + GetStartedStep components (new files)
4. LanguageStep + AccentColorStep noir updates
5. Onboarding page rewire
6. Translation keys

