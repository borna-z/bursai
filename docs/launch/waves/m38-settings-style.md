# M38 — SettingsStyle 8-section editor

| Field | Value |
|---|---|
| Goal | SettingsStyle becomes a deep editor with 8 sections (Archetype, Formality range, Color palette, Fits, Brands, Occasions, Vibes, Accent color), all editing the `style_profile_v4` JSONB. |
| Status | TODO |
| Branch | `mobile-m38-settings-style` |
| PR count | 1 |
| Depends on | V0, M29 |
| Complexity | M |

## Background

M25 captures the v4 style profile during onboarding. M38 lets the user edit it post-onboarding. Web's SettingsStyle has 8 sections with multi-select grids; mobile currently shows a static preview.

## Files touched

### Modified
- `mobile/src/screens/SettingsStyleScreen.tsx` — full rewrite into 8 collapsible sections. Each section reuses the M25 quiz UI in editor mode (preselected values).
- `mobile/src/hooks/useUpdateStyleProfile.ts` — partial-update mutation; merges into `profiles.preferences.style_profile_v4`.

## Pattern reference

Reuses the M25 question components in "edit existing values" mode.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: open SettingsStyle → 8 sections render with current values; edit color palette → confirm persists across app restart
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M38 — SettingsStyle 8-section editor`
