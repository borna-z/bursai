

# Fix: Global Translation Key Leakage

## Root Cause

There are **two interacting bugs**:

**Bug 1 — Missing English keys.** Several translation keys used in components were never added to the English dictionary in `translations.ts`. Keys like `generate.title`, `generate.subtitle`, `generate.button`, `generate.occasion`, `generate.style`, `generate.style_optional`, `home.more_for_you`, and approximately 20 others across settings, plan, scan, insights, and quick-generate screens.

**Bug 2 — The `t()` fallback is broken by design.** When a key is missing, `t()` returns the raw key string (e.g., `"generate.title"`). Many components try to guard against this with `t('key') || 'fallback'`, but since the raw key string is truthy, the `||` fallback never executes. The user sees `generate.title` instead of `What to wear`.

These two bugs combine to produce raw developer keys in production UI across every screen where a key was missed.

## Fix Strategy

### 1. Fix `t()` to never return raw keys (LanguageContext.tsx)

Change the fallback logic: if neither the locale dict nor the English dict has the key, instead of returning the raw key, auto-generate a clean human-readable label from it.

Transform `generate.title` into `Title`, `home.more_for_you` into `More for you`, `settings.push_not_supported` into `Push not supported`. Strip the namespace prefix (everything before the last dot), replace underscores with spaces, capitalize first letter.

This is a one-line change to the `t()` function that acts as a safety net for any key missed now or in the future.

### 2. Add all missing English keys (translations.ts)

Add proper, polished English copy for every missing key. Based on the audit, these are missing from the `en` section:

**OutfitGenerate page (6 keys):**
- `generate.title` — "What to wear"
- `generate.subtitle` — "Pick a vibe and we'll style you"
- `generate.button` — "Style me"
- `generate.occasion` — "Occasion"
- `generate.style` — "Style"
- `generate.style_optional` — "Optional — leave empty for a balanced look"

**Home page (1 key):**
- `home.more_for_you` — "More for you"

**Settings notifications (~6 keys):**
- `settings.push_notifications` — "Push notifications"
- `settings.push_sublabel` — "Get outfit reminders on your device"
- `settings.push_enabled` — "Push notifications enabled"
- `settings.push_disabled` — "Push notifications disabled"
- `settings.push_denied` — "Notifications are blocked. Enable them in your browser settings."
- `settings.push_blocked` — "Blocked in browser settings"
- `settings.push_not_supported` — "Push not supported"
- `settings.push_not_supported_sub` — "Your browser does not support push notifications"

**QuickGenerateSheet (~3 keys):**
- `qgen.looking_up` — "Looking up"
- `qgen.analyzing` — "Analyzing..."
- `qgen.saving` — "Saving..."

**Insights (~3 keys):**
- `insights.analyzing_wardrobe` — "Analyzing wardrobe..."
- `insights.computing_scores` — "Computing scores..."
- `insights.writing_report` — "Writing report..."

**Also add missing Swedish equivalents** for the same keys to keep both locales in sync.

### 3. Remove redundant `|| 'fallback'` guards

After fixing `t()` and adding keys, the `|| 'fallback'` pattern throughout the codebase becomes dead code. However, since it's harmless and spread across 22+ files, I will leave them in place for now — they'll never trigger but cause no harm. The priority is fixing the user-visible bug.

## Files to Change

1. **`src/contexts/LanguageContext.tsx`** — Fix `t()` fallback to auto-humanize missing keys instead of returning raw key strings
2. **`src/i18n/translations.ts`** — Add ~20 missing English keys and ~20 matching Swedish keys

## Summary

- 2 files modified
- ~40 translation entries added
- 1 function logic fix
- Root cause: missing keys + broken fallback chain
- Safety net: any future missing key will render as clean English instead of a dotted developer key

