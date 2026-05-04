# Mobile Launch — M7 — i18n Swedish + English baseline

**Goal:** Sweden launch ships in Swedish. Establish the locale-file convention in `mobile/src/i18n/locales/`, wrap every Settings/Profile/Travel screen string in `tr()`, and ship `en.ts` + `sv.ts` baselines covering at least the Settings + Profile + Travel + Paywall surfaces.

**Status:** 🔜 TODO
**Branch:** `mobile-w7-i18n`
**PR count:** 1
**Depends on:** M0; aware of M3/M4 string churn (run after them when possible to avoid translating throwaway literals)
**Complexity:** M

---

## Files touched

**New:**
- `mobile/src/i18n/locales/en.ts` (mirror web's structure)
- `mobile/src/i18n/locales/sv.ts`
- `mobile/src/i18n/index.ts` (if not already present — register locales with the existing `mobile/src/lib/i18n.ts` runtime)

**Modified:**
- `mobile/src/screens/Settings*.tsx` (5 files) — wrap every `<Text>...</Text>` and `accessibilityLabel="..."` with `tr('...')`
- `mobile/src/screens/ProfileScreen.tsx`
- `mobile/src/screens/Travel*.tsx` (3 files)
- `mobile/src/screens/PaywallScreen.tsx`
- `mobile/src/screens/AuthScreen.tsx` + `ResetPasswordScreen.tsx`
- `mobile/src/lib/i18n.ts` — extend to load both locales; default to device locale via `expo-localization`

**Tracker (same PR):** standard.

---

## Translation key conventions (mirror web)

- Namespace by screen: `settings.account.label`, `profile.archetypes.title`, `travel.must_haves.next_button`
- Avoid sentence concatenation — each user-visible string is one key
- Pluralization via `tr('settings.notifications.count', { count: n })`
- Dates/numbers via `expo-localization` formatters (not in i18n strings)

---

## Locale file shape

```ts
// mobile/src/i18n/locales/en.ts
export const en = {
  settings: {
    title: 'Settings',
    account: {
      title: 'Account',
      delete: 'Delete account',
      delete_confirm_title: 'Delete account',
      delete_confirm_body: 'This permanently removes your wardrobe, outfits, plans, style memory, and subscription. This cannot be undone.',
      // ...
    },
    privacy: { /* ... */ },
    notifications: { /* ... */ },
    style: { /* ... */ },
    appearance: { /* ... */ },
  },
  profile: { /* ... */ },
  travel: { /* ... */ },
  paywall: { /* ... */ },
  auth: { /* ... */ },
} as const;

export type Locale = typeof en;
```

`sv.ts` exports the same shape with Swedish translations. TypeScript ensures parity (`Locale` type guards against drift).

---

## i18n runtime extension (`mobile/src/lib/i18n.ts`)

If the existing implementation only loads English, extend to:
1. Detect device locale via `expo-localization`'s `Localization.locale`
2. Map `sv-*` → `sv`, everything else → `en`
3. Expose `tr(key, params?)` function that nested-lookups the key

Verify the existing runtime first by reading `mobile/src/lib/i18n.ts` — it may already have most of this. Don't reinvent.

---

## Acceptance gates

```bash
cd mobile && npx tsc --noEmit
```
0 errors (TypeScript catches en/sv shape mismatches via the `Locale` type).

**Grep verification — no English literals in the wrapped screens:**
```bash
grep -nE "<Text[^>]*>[A-Z][a-z]" mobile/src/screens/{Settings,Profile,Travel,Paywall,Auth,ResetPassword}*.tsx | grep -v "tr("
```
Expected: zero hits (every literal goes through `tr()`).

**Manual smoke test:**
1. iOS Simulator → Settings → General → Language → Svenska. Reopen app.
2. Every wrapped screen renders Swedish.
3. Switch back to English — renders English.

**Code-reviewer subagent:** mandatory.

---

## PR template

**Title:** `feat(mobile): M7 — i18n Swedish + English baseline (Settings/Profile/Travel/Paywall/Auth)`

**Body:** Problem (Sweden launches in English-only). Fix (en.ts + sv.ts locale files + tr() wrapping across 12 screens + device-locale runtime detection). Verification above. Out of scope: Home, Wardrobe, Plan, Insights screen i18n (deferred to v1.0.1 polish — those screens use few literals and most are dynamic data).

---

## Tracker updates (in this PR)

- mobile-launch-overview.md: M7 → DONE, pointer → M8.
- completion-log.md: M7 row.
- CLAUDE.md root: CURRENT WAVE → `Mobile Launch M8 — App.json metadata`.
