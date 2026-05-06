# Mobile Launch — Overview

Single source of truth for the mobile launch. Wave files in `waves/` are self-contained — read this file once, then read the current wave file, then implement.

**Branch base:** all PRs target `main`. (Prior policy targeted a `feat/mobile-rn-app` launch branch; retired 2026-05-06 per user direction.)

**Quality bar:** mobile must reach 100% feature parity with the web `src/` tree (modulo cuts below) before web is deleted post-launch. Sequencing is by dependency only — no calendar, no estimates.

---

## Current wave

| Field | Value |
|-------|-------|
| **CURRENT WAVE** | M19 — Visual Search → AddPiece |
| **CURRENT WAVE FILE** | [`waves/m19-visual-search.md`](waves/m19-visual-search.md) |
| **STATUS** | TODO |

> **Wave skip note (overnight, 2026-05-06):** M6 + M7 stay TODO but are deferred for the user — both require physical Vision Camera testing on an EAS dev build (Vision Camera doesn't run in Expo Go, and the wave's acceptance gate is "lay 4 garments side by side, confirm app detects each in turn"). M8 depends on M7 so it stays TODO too. Pointer skipped past them to the next agent-doable wave per the same precedent set on M9 (PR #733). The user will run M6/M7/M8 on hardware.

The next agent reads this file → reads the wave file → implements.

---

## Scope decisions (binding inputs)

### Cut from launch — not deferred, actually cut
- Discover tab as a destination
- Social features (OutfitReactions, public profiles, follow graph)
- Style Twin
- Insights 36-panel web depth (mobile InsightsScreen current depth stays)
- Public marketing site at burs.me (Privacy + Terms render natively in-app)

### Discover features distributed contextually (no Discover tab)
| Feature | Destination |
|---|---|
| Visual Search | AddPiece flow as a third entry mode |
| Import garments from links | AddPiece flow |
| Assess garment condition | GarmentDetail entry |
| Wardrobe Aging | Insights or Profile entry |
| Shopping Chat | AIChat as a mode (extends 8-mode chat contract) |
| Pick Must-Haves | WardrobeGapsScreen follow-up after gap analysis |
| Wardrobe gap analysis | Stays where currently is |

### Kept and ported (everything else web has)
Photo feedback (selfie comparison), outfit pool / week generator / generate flatlay / suggest accessories / suggest combinations / clone outfit DNA, full 8-mode chat contract, outfit anchor locking + outfit rules engine on client, day intelligence depth, edge function client wrapper, memory event queue, onboarding quiz at full data capture, AccentColorStep, localized pricing, Privacy + Terms native renders, performance optimization pass.

---

## Already merged outside the wave sequence

These shipped before the unified plan was written. They are foundation; new waves build on them.

| PR | Title | What it covers |
|---|---|---|
| #715 | feat(mobile): complete frontend | pull-to-refresh, loading skeletons, error states, last dead button fixed |
| #713 | feat(mobile): missing screens + dead buttons | MonthCalendar, OutfitGenerate, Laundry, ShareOutfit, LiveScan, navigation gaps |
| #716 | feat(mobile): W1 — auth wiring | sign in/up/out, session persistence, onboarding save, profile data |
| #717 | feat(mobile): W2 — garment data wiring | `useGarments`, `useSignedUrl`, all wardrobe screens |
| #718 | feat(mobile): W3 — outfits + planning | `useOutfits`, `usePlannedOutfits`, all plan screens |
| #719 | feat(mobile): W4 — AI features | SSE wrapper, basic style chat, mood, generate, gaps |
| #720 | feat(mobile): W5 — Add Garment + Live Scan | upload + analyze + save + render queue (single-shot) |
| #721 | feat(mobile): W6 — Insights wired | `useInsightsDashboard`, real gauges, palette, most-worn, weekly bars |
| #724 | feat(mobile): M0 — Sentry foundations | `@sentry/react-native`, `captureMutationError` across 13 mutation sites |
| (PR 1) | feat(mobile): add-garment depth chain PR 1 | parallel analyze + studio choice sheet + post-save enrichment trigger; Codex round 1–7 fixes folded |

The remaining 8 PRs of the add-garment depth chain are now M1–M8 in the wave sequence below.

---

## Wave index

Status legend: `TODO` → `WIP` → `DONE` (PR #N). `BLOCKED` only for true external blockers. `CUT` if scoped out post-creation.

### Pre-launch foundation
| Wave | File | Status | Depends on |
|---|---|---|---|
| V0 | [CI/CD foundations](waves/m-v0-ci-foundations.md) | DONE (PR #727) | — |

### Add-garment depth chain (remaining 8)
| Wave | File | Status | Depends on |
|---|---|---|---|
| M1 | [Render polling](waves/m1-render-polling.md) | DONE (PR #728) | V0 |
| M2 | [Signed-URL cache](waves/m2-signed-url-cache.md) | DONE (PR #729) | V0 |
| M3 | [useGarmentCount](waves/m3-garment-count.md) | DONE (PR #730) | V0 |
| M4 | [Duplicate detection](waves/m4-duplicate-detection.md) | DONE (PR #731) | V0 |
| M5 | [Offline queue](waves/m5-offline-queue.md) | DONE (PR #732) | V0 |
| M6 | [Multi-garment LiveScan continuous-scan](waves/m6-livescan-continuous.md) | TODO | V0, M1 |
| M7 | [Batch add flow](waves/m7-batch-add.md) | TODO | V0, M4, M5 |
| M8 | [Add-garment UX polish](waves/m8-add-garment-polish.md) | TODO | V0, M1–M7 |

### Foundation infrastructure
| Wave | File | Status | Depends on |
|---|---|---|---|
| M9 | [Edge function client wrapper](waves/m9-edge-fn-client.md) | DONE (PR #733) | V0 |
| M10 | [Memory event queue](waves/m10-memory-event-queue.md) | DONE (PR #734) | V0, M5 |

### Required platform mutations (App Store / privacy)
| Wave | File | Status | Depends on |
|---|---|---|---|
| M11 | [Account deletion + reset style memory](waves/m11-destructive-mutations.md) | DONE (PR #735) | V0 |
| M12 | [Password reset + deep links](waves/m12-password-reset.md) | DONE (PR #736) | V0 |

### Style + intelligence depth
| Wave | File | Status | Depends on |
|---|---|---|---|
| M13 | [Outfit anchor locking + rules engine](waves/m13-outfit-rules-anchor.md) | DONE (PR #737) | V0, M9 |
| M14 | [8-mode chat contract + AIChat depth](waves/m14-chat-8-mode.md) | DONE (PR #739) | V0, M9, M10 |
| M15 | [Day intelligence depth](waves/m15-day-intelligence.md) | DONE (PR #740) | V0, M9 |

### Generators
| Wave | File | Status | Depends on |
|---|---|---|---|
| M16 | [Outfit pool + week generator](waves/m16-pool-week-generators.md) | DONE (PR #742) | V0, M13, M15 |
| M17 | [Compositional helpers (flatlay + accessories + combinations + clone DNA)](waves/m17-composition-helpers.md) | DONE (PR #743) | V0, M13 |

### Photo + visual
| Wave | File | Status | Depends on |
|---|---|---|---|
| M18 | [Photo feedback / selfie comparison](waves/m18-photo-feedback.md) | DONE (PR #TBD) | V0, M10 |

### Distributed Discover
| Wave | File | Status | Depends on |
|---|---|---|---|
| M19 | [Visual Search → AddPiece](waves/m19-visual-search.md) | TODO | V0, M9 |
| M20 | [Import garments from links → AddPiece](waves/m20-import-from-links.md) | TODO | V0, M9 |
| M21 | [Assess condition → GarmentDetail](waves/m21-assess-condition.md) | TODO | V0, M9 |
| M22 | [Wardrobe Aging → Insights](waves/m22-wardrobe-aging.md) | TODO | V0, M9 |
| M23 | [Shopping Chat → AIChat mode](waves/m23-shopping-chat.md) | TODO | V0, M14 |
| M24 | [Pick Must-Haves → WardrobeGaps follow-up](waves/m24-pick-must-haves.md) | TODO | V0 |

### Onboarding parity
| Wave | File | Status | Depends on |
|---|---|---|---|
| M25 | [Onboarding quiz at full data capture](waves/m25-onboarding-quiz.md) | TODO | V0 |
| M26 | [AccentColorStep](waves/m26-accent-color-step.md) | TODO | V0 |
| M27 | [Coach tour](waves/m27-coach-tour.md) | TODO | V0 |

### Existing baseline depth (ported from prior M0–M14 plan)
| Wave | File | Status | Depends on |
|---|---|---|---|
| M28 | [Travel capsule end-to-end](waves/m28-travel-capsule.md) | TODO | V0 |
| M29 | [Style DNA + wardrobe stats](waves/m29-style-dna.md) | TODO | V0 |
| M30 | [Push notifications + Expo send branch](waves/m30-push.md) | TODO | V0 |
| M31 | [RevenueCat + paywall + webhook](waves/m31-revenuecat.md) | TODO | V0 |
| M32 | [Restore Purchases](waves/m32-restore-purchases.md) | TODO | V0, M31 |
| M33 | [i18n Swedish + English baseline](waves/m33-i18n.md) | TODO | V0 |
| M34 | [App.json metadata + Universal Links + privacy manifest](waves/m34-appjson.md) | TODO | V0 |

### Path B extra screens
| Wave | File | Status | Depends on |
|---|---|---|---|
| M35 | [Home depth (smart day banner + weather)](waves/m35-home-depth.md) | TODO | V0, M15 |
| M36 | [Calendar sync (Google OAuth)](waves/m36-calendar-sync.md) | TODO | V0 |
| M37 | [Outfit detail slots (full composition + anchor UI)](waves/m37-outfit-detail-slots.md) | TODO | V0, M13 |
| M38 | [SettingsStyle 8-section editor](waves/m38-settings-style.md) | TODO | V0, M29 |

### Pricing & legal
| Wave | File | Status | Depends on |
|---|---|---|---|
| M39 | [Localized pricing](waves/m39-localized-pricing.md) | TODO | V0, M33 |
| M40 | [Privacy + Terms native renders](waves/m40-privacy-terms-native.md) | TODO | V0 |

### Inbox + share
| Wave | File | Status | Depends on |
|---|---|---|---|
| M41 | [Notifications inbox + ShareOutfit image-share](waves/m41-inbox-share.md) | TODO | V0, M30 |

### Performance
| Wave | File | Status | Depends on |
|---|---|---|---|
| M42 | [Performance optimization pass](waves/m42-performance.md) | TODO | V0, all functional waves |

### External setup (final two — sequential, user runs the dashboard work)
| Wave | File | Status | Depends on |
|---|---|---|---|
| M43 | [Apple Developer + EAS dev build](waves/m43-apple-eas.md) | TODO (external) | V0, all functional waves |
| M44 | [RevenueCat sandbox + final smoke + App Store submission](waves/m44-revenuecat-sandbox-submission.md) | TODO (external) | M43 |

---

## How an agent picks up a wave

1. Read root `CLAUDE.md` — repo context, current wave pointer.
2. Read `mobile/CLAUDE.md` — patterns and conventions for the RN app.
3. Read this file — find CURRENT WAVE pointer above.
4. Read the wave file — self-contained: goal, files touched, skeletons, acceptance.
5. Read only the source files named in the wave's "Files touched" section.
6. Implement → CI green → code-reviewer subagent → push → tracker updates.

No exploratory reads. No sibling wave files. If a wave file lacks something, fix the wave file rather than read more code.

---

## Per-PR workflow (every wave PR)

### Acceptance gates (V0 CI runs them; same locally)
```bash
cd mobile && npx tsc --noEmit          # 0 errors
cd mobile && npx eslint src --ext .ts,.tsx --max-warnings 0   # 0 warnings (V0+)
cd mobile && npx expo-doctor           # passes (Sentry pinned, excluded)
cd mobile && npx expo export -p ios -o /tmp/expo-export       # bundle size assertion
```
Migrations: `npx supabase migration list --linked` clean; `npx supabase db push --linked --dry-run --yes` lists only the wave's new migrations.
Edge function changes: `deno check supabase/functions/<name>/index.ts`.

### Code-reviewer subagent before push (mandatory)
The verbatim brief lives in `mobile/CLAUDE.md` under "Code-reviewer subagent brief." Paste into `Agent(subagent_type="superpowers:code-reviewer", ...)`.

If the reviewer flags a regression: fix → re-run gates → re-review.

### Tracker updates (in the same PR)
1. Flip the wave row in this file from `TODO` to `DONE (PR #<num>)`.
2. Move CURRENT WAVE pointer to the next `TODO` wave in dependency order.
3. Append to `completion-log.md` with `M<N>` prefix.
4. New findings → `findings-log.md` with `M<N>` prefix.

PR-number placeholder resolved with `git commit --amend --no-edit && git push --force-with-lease` immediately after `gh pr create`.

### PR body template
```
## Wave
M<N> — <title> (`docs/launch/waves/m<N>-<slug>.md`)

## Problem
<1 sentence>

## Fix
- <bullet list>

## Files touched
- <list>

## Verification
- TypeScript: 0 errors
- V0 CI gates: all green
- Manual test: <one-line>
- Code-reviewer subagent: approved

## Out of scope
<anything spotted but not fixed; appended to findings-log.md>
```

---

## Post-launch cleanup (follows M44 — separate PR, not a wave)

Once the App Store + Play Store reviews land and the mobile launch is live, a single follow-up PR deletes the web `src/` tree and decommissions Stripe entirely. Stripe migration is a non-issue because there are no real users yet — only test accounts — so the cutover is a hard delete with no grandfathering.

That cleanup PR's scope:

- Delete `src/` (every Stripe call site goes with it: `create_checkout_session`, `create_portal_session`, `restore_subscription` web, `PaywallModal`, web `useSubscription` legacy paths).
- Delete Stripe edge functions: `create_checkout_session`, `create_portal_session`, `restore_subscription`, `stripe_webhook`.
- Migration: drop `profiles.stripe_customer_id`, drop the `stripe_events` table, drop Stripe-only columns from `subscriptions` (RevenueCat now writes the same table via M31's webhook).
- Supabase secrets: remove `STRIPE_*` env vars (`STRIPE_MODE`, `STRIPE_SECRET_KEY_*`, `STRIPE_WEBHOOK_SECRET_*`, `STRIPE_PRICE_ID_*`).
- Stripe Dashboard: archive products + webhooks (user step).
- Vercel project: deprovision the web app.

`enforceSubscription` keeps working unchanged — once Stripe writers are gone, `subscriptions` is purely RevenueCat-fed, and the gate semantics don't change.

## Logs (append-only)

- [`completion-log.md`](completion-log.md) — one row per merged PR. `M<N>` prefix on the Prompt column for filterability.
- [`findings-log.md`](findings-log.md) — open findings + resolutions. `M<N>` prefix on the Prompt column.

Old planning artifacts that informed this rebuild are archived at [`_archive/`](_archive/).
