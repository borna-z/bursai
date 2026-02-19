

# Fix: Onboarding Runs Only Once + Mobile-Responsive Layout

## Problems Found

### 1. Onboarding repeats on every login
Two bugs cause this:

**Bug A -- Auth.tsx line 30**: When a logged-in user visits `/auth`, they are *always* redirected to `/onboarding` regardless of whether onboarding was completed. It should go to `/` instead and let `ProtectedRoute` decide.

**Bug B -- Onboarding.tsx local state**: All the pre-steps (language, accent color, body, style, tutorial) use `useState(false)` which resets on every page load. Even if the user completed onboarding, visiting `/onboarding` restarts everything visually. The page should check `profile.preferences.onboarding.completed` and redirect to `/` immediately if already done.

### 2. Mobile layout inconsistency
The Language, Body Measurements, and Accent Color steps use a nice full-screen layout with a gradient header and centered content. But the Style Preferences step uses a different layout (`p-6 pb-32 max-w-lg`), and the main onboarding steps page (garments/outfit/reminder) has no consistent layout at all. All steps should match the same clean full-screen pattern used by `AppTutorialStep` and `BodyMeasurementsStep`.

## Solution

### File 1: `src/pages/Auth.tsx`
Change line 30 from `Navigate to="/onboarding"` to `Navigate to="/"`. The `ProtectedRoute` on `/` already checks onboarding status and redirects new users to `/onboarding` if needed.

### File 2: `src/pages/Onboarding.tsx`
- Add a check at the top: if `profile.preferences.onboarding.completed === true`, immediately `Navigate to="/"`. This prevents the onboarding from re-running for returning users.
- Redesign the main steps section (lines 189-337) to use the same full-screen layout pattern as the tutorial step: gradient header area with icon, centered content, and a fixed bottom button area.
- Apply consistent spacing and `max-w-lg mx-auto` content constraints.
- Use `safe-area-inset` padding for mobile notch/bottom bar compatibility.

### File 3: `src/components/onboarding/StylePreferencesStep.tsx`
- Restructure to match the same layout pattern as BodyMeasurementsStep: gradient header with icon at top, scrollable content area in the middle, fixed button at bottom.
- Ensure the fixed bottom button uses proper safe-area padding.
- Keep all existing functionality (color chips, fit options, vibe options, gender neutral switch).

### File 4: `src/components/onboarding/AppTutorialStep.tsx`
- Add safe-area padding at the bottom for mobile devices.
- Ensure the button area has consistent height and spacing with other steps.

### File 5: `src/components/onboarding/LanguageStep.tsx`
- Add safe-area padding at the bottom.
- Ensure consistent button height (`h-14`) matching other steps.

## Technical Details

### Auth redirect fix
```
// Auth.tsx line 30 - before:
if (user) return <Navigate to="/onboarding" replace />;

// After:
if (user) return <Navigate to="/" replace />;
```

### Onboarding completion guard
```
// Onboarding.tsx - add after loading check:
const prefs = profile?.preferences as Record<string, any> | null;
const onboardingCompleted = prefs?.onboarding?.completed === true;
if (onboardingCompleted) {
  return <Navigate to="/" replace />;
}
```

### Consistent layout pattern for all steps
Every step will follow this structure:
- Full-screen flex column container (`min-h-screen bg-background flex flex-col`)
- Gradient header area with icon, title, and subtitle
- Scrollable content area (`flex-1 overflow-y-auto px-6`)
- Fixed or sticky bottom area with the Continue button and safe-area padding

### Files changed summary

| File | Change |
|------|--------|
| `src/pages/Auth.tsx` | Redirect to `/` instead of `/onboarding` |
| `src/pages/Onboarding.tsx` | Add completion guard + redesign main steps layout |
| `src/components/onboarding/StylePreferencesStep.tsx` | Match consistent gradient-header layout |
| `src/components/onboarding/AppTutorialStep.tsx` | Add safe-area padding |
| `src/components/onboarding/LanguageStep.tsx` | Add safe-area padding |

