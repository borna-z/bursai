
# Extract Shared Easing Curve Constant

## Problem
The easing curve `[0.25, 0.1, 0.25, 1]` is duplicated across 12 files (75 occurrences). Any future change requires updating every file manually.

## Solution
Create a single shared motion constants file and update all 12 files to import from it.

### 1. Create `src/lib/motion.ts`

```typescript
/** App-wide cubic-bezier easing curve (equivalent to CSS ease) */
export const EASE_CURVE: [number, number, number, number] = [0.25, 0.1, 0.25, 1];
```

### 2. Update all 12 files to import `EASE_CURVE`

Each file replaces its inline `[0.25, 0.1, 0.25, 1]` with the imported constant:

| File | Occurrences |
|------|-------------|
| `src/components/ui/animated-page.tsx` | 1 |
| `src/components/ui/animated-tab.tsx` | 1 |
| `src/components/ui/pressable.tsx` | 1 |
| `src/components/ui/stagger.tsx` | 1 |
| `src/components/layout/AnimatedRoutes.tsx` | 2 |
| `src/components/onboarding/AccentColorStep.tsx` | 1 |
| `src/components/onboarding/BodyMeasurementsStep.tsx` | 1 |
| `src/components/onboarding/LanguageStep.tsx` | 1 |
| `src/components/onboarding/AppTutorialStep.tsx` | 1 |
| `src/components/chat/ChatWelcome.tsx` | 1 |
| `src/pages/Onboarding.tsx` | 2 |
| `src/pages/Auth.tsx` | 2 |

## Technical Details

- The constant is typed as a tuple `[number, number, number, number]` so it satisfies framer-motion's `Easing` type directly -- no more `as const` or `as [number, ...]` casts needed at usage sites.
- Placing it in `src/lib/motion.ts` follows the existing pattern of shared utilities in `src/lib/` (like `utils.ts`, `haptics.ts`).
- Zero runtime impact -- it's just a reference to the same array.

**Total: 1 new file, 12 files updated**
