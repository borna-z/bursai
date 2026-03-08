

## Fix Quick Upload Step Title & Subtitle

The translation keys `onboarding.quickUpload.title` and `onboarding.quickUpload.subtitle` don't exist in the translations file, so the raw keys are displaying instead of the fallback text. The fallback strings exist in the component but aren't rendering — likely the `t()` function returns the key string instead of `undefined` when missing.

### Changes

**1. `src/components/onboarding/QuickUploadStep.tsx`** (lines 123-130)
- Remove the `t()` calls and use direct strings with clearer, more descriptive copy:
  - **Title**: `"Upload Your First Clothes"` — immediately tells the user what to do
  - **Subtitle**: `"Take photos or pick from your gallery — up to 5 items. Our AI will recognize each piece automatically."` — explains the value

**2. `src/i18n/translations.ts`**
- Add the `onboarding.quickUpload.title` and `onboarding.quickUpload.subtitle` keys for all supported locales so the `t()` function works correctly going forward.

### Alternative (simpler)
Just bypass `t()` entirely in the component and hardcode the English strings with clear fallbacks, matching the pattern already used elsewhere in onboarding. This avoids the translation key lookup issue entirely.

