# M40 — Privacy + Terms native renders

| Field | Value |
|---|---|
| Goal | Render Privacy Policy + Terms of Service natively in-app (no web URLs), satisfying the cut of the burs.me public marketing site. |
| Status | TODO |
| Branch | `mobile-m40-privacy-terms-native` |
| PR count | 1 |
| Depends on | V0 |
| Complexity | S |

## Background

The launch decision cuts the public marketing site at burs.me. App Store still requires visible Privacy + Terms URLs. Solution: native screens in-app, with the URL surface (`https://burs.me/privacy`, `https://burs.me/terms`) hosting only a redirect or static copy of the native content (the user owns that side; in-app side is what M40 builds).

## Files touched

### New
- `mobile/src/screens/PrivacyPolicyScreen.tsx` — full native render of the Privacy Policy text.
- `mobile/src/screens/TermsScreen.tsx` — same for Terms of Service.
- `mobile/src/lib/legalContent.ts` — long-form text, multi-locale (en + sv + fall-throughs).

### Modified
- `mobile/src/screens/SettingsPrivacyScreen.tsx` — "Privacy Policy" + "Terms of Service" rows navigate to the native screens (not external links).
- `mobile/src/screens/AuthScreen.tsx` — "By signing up you agree to..." links to native screens.
- `mobile/src/navigation/RootNavigator.tsx` — register both routes.

## Pattern reference

Static long-form content; `ScrollView` + `Caption`/`Eyebrow` typography. Translatable via M33 i18n.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: tap Privacy and Terms from Settings + AuthScreen → confirm native screens render in current locale
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M40 — Privacy + Terms native renders`
