

# Hide Language Selection for Non-Admin Users

## Problem
Language switching UI is visible to all users across 3 locations. The user wants it hidden for everyone except the admin account (borna8688@gmail.com) while the app is being built.

## Locations to change

| Location | Current behavior | Change |
|----------|-----------------|--------|
| **Onboarding** (`Onboarding.tsx`) | First step is `LanguageStep` | Skip the language step entirely for non-admin users (auto-complete it) |
| **Settings → Appearance** (`SettingsAppearance.tsx`) | Language selector always visible | Conditionally render the language `SettingsGroup` only for admin |
| **Landing footer** (`FooterCTA.tsx`) | `<LanguageSwitcher />` shown | Remove the `LanguageSwitcher` component from the footer (landing page has no auth context, so no way to check admin — just hide it) |

## Approach

Use the existing `is_admin` RPC (already used in `Settings.tsx`) to gate the language UI. Create a small shared hook or inline the check.

### Files to change

| File | Change |
|------|--------|
| `src/pages/Onboarding.tsx` | Import `useAuth` + `useIsAdmin` pattern. If not admin, auto-set `languageStepDone = true` on mount so the step is skipped. |
| `src/pages/settings/SettingsAppearance.tsx` | Add `useIsAdmin` check; wrap the language `SettingsGroup` in `{isAdmin && ...}` |
| `src/components/landing/FooterCTA.tsx` | Remove `<LanguageSwitcher />` import and usage from footer |

No database changes needed — the `is_admin` RPC already exists.

