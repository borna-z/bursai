# Mobile Launch — Overview

**Goal:** Ship `mobile/` (React Native + Expo SDK 54) to App Store + Play Store on **2026-05-31** at 119 SEK/month or 899 SEK/year.

**Branch base:** all work cuts from `feat/mobile-rn-app`. PRs target `feat/mobile-rn-app`, never `main`.

**Replaces:** Wave 9 (Capacitor migration) is dropped — `mobile/` is the actual mobile path.

**Quality bar:** nothing is "blocked." External user tasks (Apple Developer, RevenueCat dashboard, App Store Connect product registration) run as parallel checklists; **no code work waits on them**.

---

## Current Wave

| Field | Value |
|-------|-------|
| **CURRENT WAVE** | M1 — Destructive mutations: account deletion + reset style memory |
| **CURRENT WAVE FILE** | `docs/launch/mobile-w1-destructive-mutations.md` |
| **STATUS** | 🔜 TODO |
| **LAST UPDATED** | 2026-05-04 |

---

## Wave Index

| Wave | File | Status | Complexity | Blocker |
|------|------|--------|-----------|---------|
| M0 | [Sentry + onError sweep](mobile-w0-sentry.md) | ✅ DONE (PR #724, 2026-05-04) | S | — |
| M1 | [Destructive mutations: account deletion + reset style memory](mobile-w1-destructive-mutations.md) | 🔜 TODO | M | — |
| M2 | [Privacy/Terms + password reset + deep links](mobile-w2-privacy-password.md) | 🔜 TODO | M | — |
| M3 | [Travel capsule end-to-end](mobile-w3-travel-capsule.md) | 🔜 TODO | L | — |
| M4 | [Style DNA + wardrobe stats + ProfileScreen refetch](mobile-w4-style-dna.md) | 🔜 TODO | M | — |
| M5 | [Push notifications mobile-side + Expo send branch](mobile-w5-push.md) | 🔜 TODO | L | code unblocked; live APNs verify needs Apple Dev |
| M6 | [RevenueCat + paywall + webhook](mobile-w6-revenuecat.md) | ⛔ BLOCKED | L (2 PRs) | **Apple Developer + RevenueCat dashboard** |
| M7 | [i18n Swedish + English baseline](mobile-w7-i18n.md) | 🔜 TODO | M | — |
| M8 | [App.json metadata + Universal Links + privacy manifest](mobile-w8-appjson.md) | 🟡 PARTIAL | S | code unblocked; `aps-environment` + `associatedDomains` need Apple Dev |
| M9 | [Quality A: GarmentDetail tabs + StyleChat memory edit](mobile-w9-quality-a.md) | 🔜 TODO | M | — |
| M10 | [UX polish: weather + photo replace + locale parser + StyleMe persist](mobile-w10-ux-polish.md) | 🔜 TODO | M | — |
| M11 | [Notifications inbox + ShareOutfit image-share](mobile-w11-inbox-share.md) | 🔜 TODO | M | — |
| M12 | [Hardening: a11y + bundle audit + lazy loading](mobile-w12-hardening.md) | 🔜 TODO | M | — |
| M13 | [TestFlight burndown](mobile-w13-testflight.md) | ⛔ BLOCKED | running | TestFlight build (Apple Dev) |
| M14 | [App Store submission](mobile-w14-submission.md) | ⛔ BLOCKED | external | All above + Apple Dev |

**Status legend:** `[TODO]`, `[WIP]`, `[DONE]`, `[BLOCKED]` (only true external blockers), `[PARTIAL]` (code unblocked, verification waits), `[SKIP]`.

**Unblocked right now (code-only):** M0, M1, M2, M3, M4, M5, M7, M8 (most of it), M9, M10, M11, M12. **Eleven waves of pure code work** can ship before Apple Developer setup arrives.

**Genuinely blocked (waiting on you):** M6 (RevenueCat dashboard + Apple StoreKit products), M13 (TestFlight build needs Apple Dev), M14 (App Store submission). Everything else proceeds.

**Parallel-safe:** M1–M12 can run in any order after M0 lands.

---

## How an Agent Picks Up a Wave (token budget contract)

Designed so a fresh session burns ≤30k tokens per PR.

1. Read `CLAUDE.md` (always loaded — root, ~250 lines).
2. Read `mobile/CLAUDE.md` (always loaded for `mobile/` work, ~200 lines).
3. Read this file — find the **CURRENT WAVE** pointer.
4. Read **the single wave file** for the current wave. Self-contained — full code skeletons, migrations, screen diffs, acceptance, PR template.
5. Read **only the source files** named in the wave's "Files touched" section.
6. Implement → run gates → push PR.

**No exploratory reads. No searching the codebase. No reading sibling wave files.** If a wave file lacks something, fix the wave file rather than read more code.

---

## Per-PR Standing Workflow

### Before writing code
- Read only files named in the wave's "Files touched" section.
- The wave's "Code skeletons" section is the source of truth — copy verbatim.

### While writing code
- Minimum change that satisfies the acceptance criteria.
- Out-of-scope findings → log to `docs/launch/findings-log.md`. Do not fix.

### Gates before commit
```bash
cd mobile && npx tsc --noEmit          # 0 errors
```
Mobile has no eslint or build pipeline yet. Bundle health is verified at TestFlight cut (M13), not per-PR.

### Code-reviewer subagent before push (mandatory)
Use `Agent(subagent_type="superpowers:code-reviewer", ...)` with this brief verbatim:
> Review this diff against `feat/mobile-rn-app`. Check: (1) does it satisfy the wave's acceptance criteria? (2) are any callers of changed symbols broken? (3) does new code follow the `useAddGarment.ts` hook pattern (useAuth + supabase from `../lib/supabase` + captureMutationError on mutations)? (4) any drift from the wave file's skeletons? Report under 200 words.

If a regression is flagged: fix → re-run gates → re-review.

### PR body template (paste into `gh pr create --body`)
```
## Wave
M<N> — <title> (`docs/launch/mobile-w<N>-<slug>.md`)

## Problem
<1 sentence>

## Fix
- <bullet list>

## Files touched
- <list with line numbers>

## Verification
- TypeScript: 0 errors
- Manual test: <one-line path>
- Code-reviewer subagent: approved

## Out of scope
<anything spotted but not fixed; appended to findings-log.md>
```

### Tracker updates (in the same PR)
1. Flip the wave row in this file from `🔄 TODO` to `[DONE] (PR #<num>, YYYY-MM-DD)`.
2. Move `CURRENT WAVE` pointer to the next `🔜 TODO` wave.
3. Update `LAST UPDATED` to today.
4. Append a row to `docs/launch/completion-log.md`: `M<N>` row.
5. New findings → `docs/launch/findings-log.md` (Prompt column = `M<N>`).

PR number placeholder: resolve with `git commit --amend --no-edit && git push --force-with-lease` immediately after `gh pr create`.

---

## Hard Rules — Mobile-Specific (additions to root `CLAUDE.md`)

- **New edge functions allowed when they improve quality.** The mobile/CLAUDE.md "no new edge functions" rule has a launch carve-out: M6 ships `revenuecat_webhook`. Any other new function requires explicit user approval.
- **Never reach into web `src/`** except for type imports (`import type { Database } from '../../../src/integrations/supabase/types'`).
- **Never push to `main`.** All PRs target `feat/mobile-rn-app`.
- **Avatar feature is dead.** `avatars` bucket dropped 2026-04-21. The `SettingsAccountScreen.tsx` L77 row gets deleted in M10, not wired.
- **No new design primitives.** Reuse existing `Eyebrow`, `PageTitle`, `Caption`, `Button`, `IconBtn`, `Chip`, `Card`, `SettingsRow`, `ListRow`, `BottomNav`.
- **Tokens via `useTokens()` only.** Never hardcode hex values.
- **`useAuth()`** is the source of session/user/profile. **`supabase`** import comes from `../lib/supabase`. Edge functions are called via `fetch(\`${supabaseUrl}/functions/v1/<name>\`, ...)` — pattern in `mobile/src/hooks/useAddGarment.ts`.

---

## External Setup Checklist (parallel — does NOT block code)

The user runs these in parallel with M0–M12 code work. Status tracked here, not blocking.

- [ ] Apple Developer account (paid) — register `me.burs.app` bundle ID
- [ ] App Store Connect — create app record + IAP products `burs_premium_monthly_119sek`, `burs_premium_annual_899sek`
- [ ] APNs auth key generated → uploaded to Expo (push) and RevenueCat (M6)
- [ ] RevenueCat dashboard — link products to entitlement `premium`, configure webhook to Supabase
- [ ] Google Play Console — bundle `me.burs.app` + matching subscription products
- [ ] Sandbox testers (3+) for both stores
- [ ] Privacy Policy at `https://burs.me/privacy` (web side — coordinate with web Wave 11)
- [ ] Terms of Service at `https://burs.me/terms` (web side — coordinate with web Wave 11)
- [ ] `apple-app-site-association` at `https://burs.me/.well-known/` (web side, for Universal Links — M8)
- [ ] `assetlinks.json` at `https://burs.me/.well-known/` (web side, for Android App Links — M8)
- [ ] Sentry account + project `burs-mobile` + DSN copied to `EXPO_PUBLIC_SENTRY_DSN`
- [ ] Privacy manifest data disclosures decided (M8 lists what to declare)

---

## Calendar (compressed — every wave parallel-safe after M0)

```
Day 1     — M0 Sentry foundations
Day 2-4   — M1 Destructive mutations  ┐
Day 2-4   — M2 Privacy/Password       │ parallel
Day 4-7   — M3 Travel capsule         │
Day 4-7   — M4 Style DNA + stats      │
Day 5-8   — M5 Push                   │
Day 6-10  — M6 RevenueCat (2 PRs)     ┘
Day 10-12 — M7 i18n
Day 11    — M8 App.json metadata
Day 11-14 — M9 Quality A
Day 11-14 — M10 UX polish (parallel with M9)
Day 14-17 — M11 Inbox + ShareOutfit
Day 17-19 — M12 Hardening (a11y + lazy)
Day 19    — TestFlight build #1 (M13 starts)
Day 19-26 — Bug burndown across two TestFlight cycles
Day 27-28 — App Store submission window (M14 — target 2026-05-31)
```

Compressed because waves are parallel-safe — multi-agent dispatch can collapse the calendar further.

---

## Findings + Completion Logs

- Findings: `docs/launch/findings-log.md` — Prompt column prefixed `M<N>` for filterability.
- Completion: `docs/launch/completion-log.md` — one row per merged PR, `M<N>` prefix.

---

## Per-Wave Documentation Convention

Every wave file follows this shape (token-efficient):

```
# Mobile Launch — M<N> — <Title>

**Goal:** <one sentence>
**Status:** <TODO/WIP/DONE>
**Branch:** mobile-w<N>-<slug>
**PR count:** <1 or 2>
**Depends on:** <wave or none>

## Files touched
- New: <list>
- Modified: <list with line ranges>
- Migration: <SQL file if applicable>

## Code skeletons
<verbatim — every new hook, every full migration, every JSX diff>

## Acceptance gates
- TypeScript: <command>
- Manual test: <path>
- Code-reviewer: approved

## PR template
Title: feat(mobile): <description>
Body: <inline>

## Tracker updates (same PR)
- Flip M<N> status TODO → DONE in mobile-launch-overview.md
- Move CURRENT WAVE pointer to M<N+1>
- Append to completion-log.md
- New findings → findings-log.md
```
