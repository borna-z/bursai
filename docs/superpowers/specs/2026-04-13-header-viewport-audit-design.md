# Header / Viewport / Safe-Area Audit — Design Spec

**Date:** 2026-04-13
**Branch base:** `main`
**Working branch prefix:** `prompt-6-*` (one PR per phase)
**Author:** brainstorming session with user

## Goal

Fix systemic header, safe-area, and z-index bugs across the app and bring every page onto a single canonical header primitive. Current design, layout, hierarchy, and UX are preserved — only the underlying structural behavior changes.

## Concrete user-visible symptoms (from the user)

- Toast notifications (e.g. the "wear" confirmation) render *behind* the iPhone dynamic island.
- Headers on some pages scroll away with the page; headers on other pages are sticky — the app has no consistent rule.
- Headers look like a "ribbon": a band where the title sits, but page content is still visible above the header instead of being covered by it.
- The whole header/viewport system feels underdeveloped.

## Root cause diagnosis

24 concrete bugs across 6 layers. Every item below has file:line evidence from the current codebase.

### Layer A — Viewport & safe-area foundation

- **A1.** `src/components/layout/AppLayout.tsx:48` applies `paddingTop: var(--safe-area-top)` to `<main>`. Every sticky header inside `<main>` therefore sits *below* the safe area; nothing visually covers the dynamic-island strip.
- **A2.** `src/components/layout/AppLayout.tsx:36-38` renders a decorative `h-24` gradient `div` at the top of the app. Combined with A1, this gradient *is* the "ribbon" the user sees around the dynamic island.
- **A3.** `src/hooks/useViewportShell.ts` maintains a JS-probed `--app-viewport-offset-top` because Median iOS returns 0 from CSS `env(safe-area-inset-top)`. But raw `env(safe-area-inset-top)` is still used in 5 places, which all break under Median iOS:
  - `src/pages/Auth.tsx:166`
  - `src/pages/LiveScan.tsx:659`
  - `src/components/add-garment/UploadStep.tsx:59`
  - `src/components/layout/BursLoadingScreen.tsx:41`
  - `src/index.css:311`
- **A4.** `src/hooks/useViewportShell.ts:90-93` — `max(safeTopBase, visualViewport.offsetTop)` can produce a visible jump on iOS keyboard open, because `visualViewport.offsetTop` is noisy for values < ~3 px.

### Layer B — `PageHeader` primitive

- **B1.** `src/components/layout/PageHeader.tsx:30` — hardcoded `style={{ paddingTop: '12px' }}`. Not safe-area-aware.
- **B2.** `src/components/layout/PageHeader.tsx:20` — `sticky = true` is public API. Pages can opt out with `sticky={false}`. Source of "some headers scroll, some don't."
- **B3.** `src/index.css:452-454` — `.topbar-frost` is `backdrop-blur-xl` with `border-b`. Combined with A1, the frost starts *below* the notch, so the area above it is never covered.
- **B4.** No `variant="overlay"` for detail pages with hero images. `GarmentDetail`, `OutfitDetail`, `PublicProfile` currently hand-roll their own overlay headers, which is the primary source of D6–D8.

### Layer C — Portal / z-index layer

- **C1.** `src/components/ui/sonner.tsx:10-14` — `position="top-center"`, no `offset` prop. Sonner's default `top: 16px` sits *inside* the iPhone 14/15/16 Pro dynamic-island zone. This is literally why the "wear" toast vanishes.
- **C2.** Z-index is fragmented across 11+ tiers with no canonical scale:
  - `PageHeader` z-20
  - Custom sticky headers z-10
  - `BottomNav` z-50
  - `SeedProgressPill` z-50
  - `OfflineBanner` z-[60]
  - `BursLoadingScreen` z-50
  - `StyleQuizV3` z-50
  - `Onboarding` top bar z-50
  - `ExitIntentModal` z-[70], `LiveScan` submit overlay z-[70]
  - skip-link z-[100]
  - `MilestoneCelebration` z-[200]
  - `CoachMark` z-9997 / 9998 / 9999
  - Sonner default z-9999
  - shadcn `Dialog`, `AlertDialog`, `Drawer`, `Dropdown`, `ContextMenu`, `HoverCard` all z-50

### Layer D — Pages that bypass `PageHeader`

- **D1.** `src/pages/AIChat.tsx:669` — custom `topbar-frost sticky top-0 z-10` div.
- **D2.** `src/pages/marketing/Terms.tsx:32` — custom `<header sticky top-0 z-10 topbar-frost>`.
- **D3.** `src/pages/marketing/PrivacyPolicy.tsx:32` — same.
- **D4.** `src/pages/marketing/Admin.tsx:149` — custom sticky div.
- **D5.** `src/pages/ShareOutfit.tsx:153` — custom sticky div.
- **D6.** `src/pages/PublicProfile.tsx:144` — custom sticky div over hero.
- **D7.** `src/pages/OutfitDetail.tsx:335` *and* `:391` — has **both** a `sticky top-0 z-10` header in one branch and a `fixed top-0 z-20` header in another branch of the same file.
- **D8.** `src/pages/Outfits.tsx:89` — `motion.header topbar-frost sticky top-0 z-10 -mx-5` — uses a negative-margin hack to escape page padding.
- **D9.** `src/pages/LiveScan.tsx:515` — `relative z-10` header that is not sticky at all, while the same file uses `PageHeader` in four other branches (lines 295, 551, 565, 578).

### Layer E — Floating / fixed-position components with their own safe-area bugs

- **E1.** `src/components/layout/OfflineBanner.tsx:21` — `fixed top-0` with no safe-area padding. When offline, the banner renders behind the dynamic island.
- **E2.** `src/pages/Onboarding.tsx:30` — `fixed inset-x-5 top-4 z-50`. Hardcoded 16 px from viewport top sits inside the dynamic-island zone on iPhone Pros.
- **E3.** `src/components/layout/SeedProgressPill.tsx:27` — `fixed bottom-24 right-4`. Hardcoded `bottom-24` (96 px) can overlap `BottomNav` on devices with home indicators where `--app-bottom-clearance` exceeds 96 px.
- **E4.** Each of the 5 raw `env(safe-area-inset-top)` call sites listed in A3 is counted as a separate fix target in the per-site migration.

### Layer F — Overlay stack conflicts

- **F1.** `src/components/coach/CoachMark.tsx:94-172` uses zIndex 9997–9999, which collides with Sonner's default z-9999. Toast vs. coach-mark stack order is unpredictable.
- **F2.** `src/components/layout/MilestoneCelebration.tsx:104` — z-[200]. Below `CoachMark` (9997) and below Sonner (9999). A milestone celebration cannot visually appear while a coach mark or toast is active.

## Out-of-scope symptoms not covered here

- Median iOS native camera bridge. `useMedianCamera` / `useMedianStatusBar` / `src/lib/median.ts` are frozen per `CLAUDE.md` until the Capacitor migration.
- `src/pages/Insights.tsx` is frozen per `CLAUDE.md` — audited for header drift but not touched.
- Auto-generated files (`src/integrations/supabase/types.ts`, `src/i18n/locales/{en,sv}.ts`) — not touched.

## Target design

### Canonical rules after this work

1. **Safe-area belongs to the header, not to `<main>`.** `AppLayout` stops padding `<main>`. `PageHeader` covers the safe-area strip itself with a frost-backed extension that reaches `top: 0` of the physical viewport.
2. **One header primitive.** `PageHeader` with two variants:
   - `variant="solid"` (default): frost background, border-bottom, always sticky. For hub/list/form pages.
   - `variant="overlay"`: transparent background, circular back button, sits over a hero image. Still sticky. Still covers safe-area. For `GarmentDetail`, `OutfitDetail`, `PublicProfile`.
3. **No `sticky={false}` option.** All headers are sticky. The API no longer offers an opt-out.
4. **One z-index scale.** Defined once as CSS custom properties in `index.css`. Every `z-*` class or `zIndex:` inline style migrates to the scale.
5. **`var(--safe-area-top)` everywhere.** Raw `env(safe-area-inset-top)` is forbidden outside `index.css` (where the variable is defined) and `useViewportShell.ts` (where it is probed).
6. **Floating components respect safe-area.** `OfflineBanner`, `Onboarding` top bar, `SeedProgressPill`, and any other `fixed top-*` / `fixed bottom-*` component either uses `var(--safe-area-top)` / `var(--app-bottom-clearance)`, or documents why it intentionally doesn't.

### Proposed z-index scale (CSS vars in `index.css`)

```css
--z-base: 1;
--z-header: 20;
--z-offline-banner: 30;
--z-bottom-nav: 40;
--z-floating-pill: 45;
--z-modal: 50;
--z-popover: 55;
--z-toast: 60;
--z-coach: 70;
--z-celebration: 80;
```

Rationale: offline banner above header (so it can cover the title area briefly); bottom nav below modals; toasts above modals so confirmation feedback is visible during dialogs; coach marks above toasts so onboarding can't be hidden; celebration above everything because it's a momentary full-screen event.

### Canonical `PageHeader` shape (post-refactor)

```tsx
<PageHeader
  title="Wardrobe"
  subtitle="124 items"
  eyebrow="Browse"
  showBack={false}
  variant="solid" // or "overlay"
  actions={<SearchButton />}
/>
```

- Always renders a safe-area-covering extension at the top.
- Always sticky, always z-[var(--z-header)].
- `overlay` variant swaps the frost background for transparency and gives the back button a circular pill affordance that reads over images.

## Work plan — 5 phases, 5+ PRs

Each phase is its own branch and its own PR. Order is strict: phase N+1 depends on phase N's foundation.

### Phase 1 — Foundation: safe-area + z-index scale

**Branch:** `prompt-6-foundation-safe-area`
**PR title:** `Prompt 6: Fix safe-area layer, canonical z-index scale, Sonner offset`

1. Move safe-area coverage from `<main>` (remove `paddingTop` at `AppLayout.tsx:48`) to `PageHeader` (header covers its own safe-area strip via a wrapper div whose height is `var(--safe-area-top)` and whose background matches the header variant).
2. Delete the decorative gradient `div` at `AppLayout.tsx:36-38`.
3. Add the z-index scale to `index.css`. Migrate every in-repo `z-[number]` / `z-N` / `zIndex:` usage to the scale:
   - `PageHeader.tsx:24`
   - `AppLayout.tsx:37, 40, 46`
   - `BottomNav.tsx:264`
   - `OfflineBanner.tsx:21`
   - `SeedProgressPill.tsx:27`
   - `BursLoadingScreen.tsx:39`
   - `StyleQuizV3.tsx:495`
   - `Onboarding.tsx:30`
   - `ExitIntentModal.tsx:32`
   - `LiveScan.tsx:653`
   - `MilestoneCelebration.tsx:104`
   - `CoachMark.tsx:94, 147, 156, 172`
   - `sonner.tsx` (new)
4. Fix Sonner: `offset="calc(var(--safe-area-top) + 12px)"`, className includes `z-[var(--z-toast)]`.
5. Migrate raw `env(safe-area-inset-top)` usages in shared / layout code (A3 / E4 list).
6. Add a 3 px threshold guard in `useViewportShell.ts:93` — only apply `visualViewport.offsetTop` when it exceeds the threshold.
7. New unit tests (structural invariants):
   - `PageHeader` renders with `z-[var(--z-header)]` class.
   - `PageHeader` wrapper has safe-area height.
   - Toast container class list contains `z-[var(--z-toast)]`.
   - `OfflineBanner` top offset is `var(--safe-area-top)`.

Fixes **A1, A2, A3 (shared call sites), A4, B1 (via wrapper), B3, C1, C2, F1, F2**.

### Phase 2 — Canonical `PageHeader` primitive

**Branch:** `prompt-6-pageheader-variants`
**PR title:** `Prompt 6: PageHeader variants — remove sticky prop, add overlay variant`

1. Remove the `sticky` prop from `PageHeader`. Always sticky.
2. Add `variant?: 'solid' | 'overlay'` (default `'solid'`).
3. Implement the overlay variant: transparent background, circular back button, back button contrast tuned for image backgrounds (white/80 fill with blur).
4. Update existing `PageHeader` callers if any currently pass `sticky={false}` (audit target).
5. Add snapshot / structural tests for both variants.

Fixes **B2, B4**.

### Phase 3 — Per-page migration + full audit sweep

**Branch:** `prompt-6-page-migration`
**PR title:** `Prompt 6: Migrate all pages to canonical PageHeader`

1. Migrate all 9 known custom-header sites (D1–D9) to `PageHeader`.
2. Dispatch 3–4 parallel subagents. Each reviews ~10 pages and produces a classification report per page:
   - `canonical` — uses `PageHeader` correctly.
   - `custom-header` — has its own header, needs migration.
   - `no-header` — intentionally headerless (Onboarding, loading, full-bleed Index).
   - `unrelated-bug` — any small, obvious, unambiguous bug found during the sweep (one-line fixes, typos, missing haptics, broken padding, wrong token).
   - `escalate` — any larger bug that needs its own PR.
3. Apply all `custom-header` migrations and all `unrelated-bug` fixes in this PR.
4. Log every `escalate` finding in the PR description as a deferred list.
5. Fixes **D1–D9** plus whatever the sweep surfaces.

Subagent prompt template (to be written out in the plan): "Review these N pages. For each, classify as one of {canonical, custom-header, no-header, unrelated-bug, escalate}. Report file:line for every finding. Do not make code changes."

### Phase 4 — Floating-component safe-area fixes

**Branch:** `prompt-6-floating-safe-area`
**PR title:** `Prompt 6: Safe-area fixes for OfflineBanner, Onboarding, SeedProgressPill`

1. `OfflineBanner.tsx:21` — add `paddingTop: 'var(--safe-area-top)'`, keep `top-0`.
2. `Onboarding.tsx:30` — change `top-4` to `top: calc(var(--safe-area-top) + 16px)`.
3. `SeedProgressPill.tsx:27` — change `bottom-24` to `bottom: calc(var(--app-bottom-clearance) + 16px)`.
4. Sweep `src/components/` for any additional `fixed top-*` or `fixed bottom-*` that bypasses safe-area. Fix or escalate.

Fixes **E1, E2, E3**.

### Phase 5 — Escalated bugs from Phase 3

**Branches:** one per escalated finding, e.g. `prompt-7-<slug>`, `prompt-8-<slug>`, etc.
Each gets its own PR with a focused scope. Nothing is skipped; nothing is silently merged. This phase is planned but not executed as part of the initial write-up — each escalation becomes its own prompt cycle.

## Verification

Per phase, before committing:

- `npx tsc --noEmit --skipLibCheck` → 0 errors
- `npx eslint src/ --ext .ts,.tsx --max-warnings 0` → 0 warnings
- `npm run build` → clean, no warnings
- `npx vitest run` on the full suite → pass (existing tests, no regressions)
- New phase-specific unit tests → pass

Each PR body includes a **manual iPhone verification checklist** for the user to run on physical hardware after merge (code tests cannot verify "the toast appears below the dynamic island" — that is ultimately a visual check):

- Toast triggered from Home "wear" action appears fully visible below the dynamic island.
- `/wardrobe` header stays sticky when scrolling the grid.
- `/plan` header stays sticky when scrolling the calendar.
- `/insights` header stays sticky (Insights page is frozen — visual check only).
- Garment detail header renders over the hero image with a legible back button.
- Outfit detail header behaves the same as garment detail.
- Toggling airplane mode shows the offline banner below the dynamic island (E1).
- Seed progress pill does not overlap the bottom nav on a device with a home indicator (E3).
- Onboarding's top bar is fully visible on an iPhone 14 Pro (E2).

## Scope discipline

Per user rule:

- Small / obvious / one-line bugs found during the sweep get fixed in Phase 3.
- Larger bugs get escalated to their own PR (Phase 5). Nothing is skipped.
- Median-specific files are not touched (`useMedianCamera.ts`, `useMedianStatusBar.ts`, `lib/median.ts`).
- `src/pages/Insights.tsx`, `src/integrations/supabase/types.ts`, and locale files are not touched.
- No new npm dependencies added.

## Risks

- **Header height change may affect page content top spacing.** Pages that assume the old header did not cover the safe-area may render with content slightly shifted. Mitigation: visual check on every migrated page, fix on the spot.
- **Z-index scale migration is mechanical but wide.** Regression risk is low if each migration is a pure rename, but the PR will touch many files. Mitigation: keep Phase 1 diff focused and grep-auditable.
- **Subagent sweep may flood with unrelated-bug findings.** If Phase 3 balloons, split it into 3a (migrations only) and 3b (unrelated fixes only).
- **Overlay variant back button contrast** must work on *any* hero image. Mitigation: use a backdrop-blur pill with a translucent fill so it adapts; tested against dark and light hero images.

## Open items (none blocking implementation)

- The exact visual treatment of the overlay variant's back button (solid circle vs. pill, border vs. no border) should be finalized during Phase 2 implementation. Match existing `PageHeader` back button as closely as possible.
