# Phase 3 — Per-Page Migration + Audit Sweep — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate every non-conforming page to the canonical `PageHeader` primitive, adopt the new `variant="overlay"` on hero-image detail pages, and run a parallel-subagent audit sweep across all production pages to surface unrelated UI bugs.

**Architecture:** Three sub-phases executed in order on a single branch:
1. **Migrations** — replace 9 known custom headers (D1–D9) and adopt `variant="overlay"` on 3 detail pages (GarmentDetail, OutfitDetail, PublicProfile).
2. **Audit sweep** — dispatch 3 parallel subagents, each reviewing ~10 production pages, returning a classification report (canonical / no-header / unrelated-bug / escalate). No code changes during audit.
3. **Apply findings** — fix every `unrelated-bug` (small, obvious, one-line) inline in this PR. Log every `escalate` finding as a deferred item in the PR body for its own follow-up prompt cycle.

**Tech Stack:** React 18 + TypeScript + Tailwind + Framer Motion + Vitest/@testing-library.

**Spec:** `docs/superpowers/specs/2026-04-13-header-viewport-audit-design.md` (items D1–D9, B4 adoption)

**Out of scope:**
- `OfflineBanner`, `Onboarding`, `SeedProgressPill` safe-area fixes — Phase 4.
- Any escalated bug from the audit sweep — Phase 5 (one PR per escalation).
- Frozen files: `Insights.tsx`, median hooks, locale files, supabase types.

**Branch:** `prompt-8-page-migration` (cut from current `main` head, which already includes Phase 1 and Phase 2).

## Constraint reminders

- `src/pages/Insights.tsx` — frozen, not touched.
- `src/hooks/useMedianCamera.ts`, `useMedianStatusBar.ts`, `src/lib/median.ts` — frozen.
- `src/i18n/locales/{en,sv}.ts` — append-only; if a migration adds a new translation key it must be appended at the bottom of both files.
- No new npm packages.
- No new edge functions.
- The user's escalation rule: "find any little bug that there is using subagent teams ... if you find other bugs that are bigger and needs to be fixed, fix them by adding more tasks and make a new PR for them for all the findings, don't just skip them".

## File Structure

**Modify (migrations):**
- `src/pages/AIChat.tsx` — replace custom topbar-frost div with `<PageHeader>`
- `src/pages/marketing/Terms.tsx` — replace custom header with `<PageHeader>`
- `src/pages/marketing/PrivacyPolicy.tsx` — replace custom header with `<PageHeader>`
- `src/pages/marketing/Admin.tsx` — replace custom sticky div with `<PageHeader>`
- `src/pages/ShareOutfit.tsx` — replace custom sticky div with `<PageHeader>`
- `src/pages/Outfits.tsx` — replace custom motion.header (and remove `-mx-5` hack) with `<PageHeader>`
- `src/pages/LiveScan.tsx` — unify the non-sticky `<div relative z-10>` branch (line ~515) with the `PageHeader`-using branches
- `src/pages/OutfitDetail.tsx` — unify the two custom header branches into a single `<PageHeader variant="overlay">`
- `src/pages/PublicProfile.tsx` — replace custom hero header with `<PageHeader variant="overlay">`
- `src/pages/GarmentDetail.tsx` — adopt `variant="overlay"` on the existing `<PageHeader>` calls (currently solid over a hero image)

**Create (tests):**
- `src/pages/__tests__/Outfits.migration.test.tsx` — smoke test asserting `Outfits` renders a `PageHeader` (regression guard for the negative-margin hack)
- `src/pages/__tests__/PublicProfile.migration.test.tsx` — smoke test asserting `PublicProfile` renders a `data-variant="overlay"` header
- (Existing test files — `OutfitDetail.test.tsx`, `GarmentDetail.test.tsx`, `LiveScan.test.tsx` — may need updates if they assert on the old custom-header DOM. Update where needed during migration.)

**Do NOT touch:**
- `src/pages/Insights.tsx`
- Median hooks
- Auto-generated files

---

## Task 1: Cut branch

**Files:** none (git only)

- [ ] **Step 1: Cut from main**

```bash
cd "C:/Users/borna/OneDrive/Desktop/BZ/Burs/bursai-working"
git checkout main
git pull origin main
git checkout -b prompt-8-page-migration
git status
```

Expected: clean tree on `prompt-8-page-migration`.

---

## Task 2: Migrate `AIChat.tsx`

**File:** `src/pages/AIChat.tsx` around line 669

The file currently has:
```tsx
<div className="topbar-frost sticky top-0 z-10 flex shrink-0 items-center justify-between px-[var(--page-px)] py-3 min-h-[56px]">
  {/* ...title / actions... */}
</div>
```

Replace this entire `<div ...>` (and its closing `</div>`) with a `<PageHeader>` that preserves the title text and any actions/back button currently rendered inside.

**Procedure:**
1. Read the full file or the surrounding ~30 lines so you can preserve every action and title text.
2. Identify the title text the page currently renders inside that header.
3. Identify any back button or action buttons that need to move to `actions={...}` or `showBack`.
4. Add `import { PageHeader } from '@/components/layout/PageHeader';` at the top of the file if not already imported.
5. Replace the custom `<div className="topbar-frost sticky top-0 z-10 ..."> ... </div>` block with:
   ```tsx
   <PageHeader
     title={t('chat.title') /* or whatever the existing title was */}
     showBack
     actions={/* the existing action buttons, if any */}
   />
   ```
6. Remove any leftover `topbar-frost` / `sticky top-0 z-10` classnames or wrapper divs that became dead.

**Verification:**
```bash
npx tsc --noEmit --skipLibCheck
npx eslint src/pages/AIChat.tsx --max-warnings 0
npx vitest run src/pages/__tests__ 2>&1 | grep -i "AIChat\|fail\|pass" | tail -20
```

If an existing AIChat test breaks because it asserts on the old DOM (e.g., a `topbar-frost` class on a div), update the assertion to look for the new `<header>` element from `PageHeader`. Do NOT remove the `PageHeader`.

**Commit:**
```bash
git add src/pages/AIChat.tsx
# include any updated test files
git commit -m "Prompt 8: Migrate AIChat to canonical PageHeader"
```

---

## Task 3: Migrate `marketing/Terms.tsx`

**File:** `src/pages/marketing/Terms.tsx` around line 32

Current:
```tsx
<header className="sticky top-0 z-10 topbar-frost border-b border-border/40">
  {/* ...inside content... */}
</header>
```

**Procedure:**
1. Read the file. Identify the current title text and any nav controls (likely a back button or a brand mark).
2. Add `import { PageHeader } from '@/components/layout/PageHeader';` if not already.
3. Replace the entire `<header>...</header>` block with `<PageHeader title={...} showBack />`. Use the existing translation key for the title — do NOT introduce a new one.
4. Remove any wrapper / inner classes that became dead.

**Verification:** tsc + eslint clean.

**Commit:**
```bash
git add src/pages/marketing/Terms.tsx
git commit -m "Prompt 8: Migrate marketing Terms to PageHeader"
```

---

## Task 4: Migrate `marketing/PrivacyPolicy.tsx`

**File:** `src/pages/marketing/PrivacyPolicy.tsx` around line 32

Same pattern as Terms.tsx. Custom `<header sticky top-0 z-10 topbar-frost border-b border-border/40>`. Replace with `<PageHeader title={...} showBack />`.

**Commit:**
```bash
git add src/pages/marketing/PrivacyPolicy.tsx
git commit -m "Prompt 8: Migrate marketing PrivacyPolicy to PageHeader"
```

---

## Task 5: Migrate `marketing/Admin.tsx`

**File:** `src/pages/marketing/Admin.tsx` around line 149

Current:
```tsx
<div className="sticky top-0 z-10 topbar-frost border-b border-border/40">
  {/* ...title... */}
</div>
```

Replace the `<div>` with `<PageHeader title="Admin" showBack />` (or the existing title text — read first to confirm).

**Commit:**
```bash
git add src/pages/marketing/Admin.tsx
git commit -m "Prompt 8: Migrate marketing Admin to PageHeader"
```

---

## Task 6: Migrate `ShareOutfit.tsx`

**File:** `src/pages/ShareOutfit.tsx` around line 153

Current:
```tsx
<div className="sticky top-0 z-10 topbar-frost border-b border-border/40">
  {/* ...title... */}
</div>
```

Same pattern as Admin. Replace with `<PageHeader title={...} showBack />`. Read the file to identify any actions to preserve.

**Commit:**
```bash
git add src/pages/ShareOutfit.tsx
git commit -m "Prompt 8: Migrate ShareOutfit to PageHeader"
```

---

## Task 7: Migrate `Outfits.tsx`

**File:** `src/pages/Outfits.tsx` around line 89

Current:
```tsx
<motion.header className="topbar-frost sticky top-0 z-10 -mx-5 px-5 pb-3 pt-3">
  {/* ...title... */}
</motion.header>
```

This one uses a negative-margin hack (`-mx-5`) to escape the page's horizontal padding. After migration, the parent's padding logic may need adjustment so the page content still aligns correctly.

**Procedure:**
1. Read the full Outfits.tsx file so you understand the parent container's padding scheme.
2. Replace the `<motion.header ...>` block with `<PageHeader title={...} actions={...} />`. Preserve the existing motion entrance animation if it was meaningful — `PageHeader`'s built-in `AnimatePresence` already animates the title on change, so a wrapper motion is usually unnecessary.
3. Remove the `-mx-5` negative margin hack. The new `PageHeader` is full-width by default (its inner `mx-auto max-w-lg` centers content).
4. If removing `-mx-5` causes any visual misalignment in the rest of the Outfits page, adjust the OUTER container, not the header.

**Verification:** Run any existing `Outfits` tests:
```bash
npx vitest run src/pages/__tests__/Outfits.test.tsx src/pages/__tests__/UnusedOutfits.test.tsx 2>&1 | tail -20
```

**Commit:**
```bash
git add src/pages/Outfits.tsx
git commit -m "Prompt 8: Migrate Outfits to PageHeader, remove negative margin hack"
```

---

## Task 8: Add Outfits migration regression test

**File:** Create `src/pages/__tests__/Outfits.migration.test.tsx`

Smoke test that asserts the page renders a canonical `PageHeader` and does NOT have any `-mx-5` class on a header element. Goal is to prevent regression to the old hack.

```typescript
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

// Outfits has heavy dependencies — mock just enough to render its shell
vi.mock('@/hooks/useOutfits', () => ({
  useOutfits: () => ({ data: [], isLoading: false, error: null }),
}));
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, locale: 'en' }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

import Outfits from '../Outfits';

describe('Outfits PageHeader migration', () => {
  it('renders a canonical PageHeader element', () => {
    const { container } = render(
      <MemoryRouter>
        <Outfits />
      </MemoryRouter>,
    );
    const header = container.querySelector('header[data-variant]');
    expect(header).not.toBeNull();
  });

  it('does not use the legacy -mx-5 negative-margin hack on the header', () => {
    const { container } = render(
      <MemoryRouter>
        <Outfits />
      </MemoryRouter>,
    );
    const header = container.querySelector('header');
    expect(header?.className ?? '').not.toContain('-mx-5');
  });
});
```

**Note:** Outfits.tsx may have additional context dependencies (e.g., QueryClient, Theme). If the test fails because of missing providers, add the minimum providers needed — do not delete the assertions. If providers are too involved, replace with a snapshot/structural test that doesn't render the full page but instead imports the JSX and inspects it (this requires changing the page export, which is invasive — only do this if the test cannot be made to pass otherwise; report back if blocked).

**Verification:**
```bash
npx vitest run src/pages/__tests__/Outfits.migration.test.tsx
```

**Commit:**
```bash
git add src/pages/__tests__/Outfits.migration.test.tsx
git commit -m "Prompt 8: Add Outfits PageHeader migration regression test"
```

---

## Task 9: Migrate `LiveScan.tsx` non-sticky branch

**File:** `src/pages/LiveScan.tsx` around line 515

Current (one of several header branches in LiveScan):
```tsx
<div className="relative z-10 border-b border-border/50 bg-background/80 backdrop-blur-2xl">
  {/* ...content... */}
</div>
```

The same file already uses `<PageHeader>` in 4 other branches (lines 295, 551, 565, 578). The line-515 branch is the only one that doesn't — it's a non-sticky `<div>` wrapper.

**Procedure:**
1. Read the file around line 515 to see what content this header wraps.
2. Replace the `<div relative z-10 border-b ...>` with `<PageHeader title={...} showBack />` matching the other branches' usage.
3. Remove any wrapper/styling classes that became dead.

**Verification:**
```bash
npx vitest run src/pages/__tests__/LiveScan.test.tsx 2>&1 | tail -15
```

If the LiveScan test breaks, update its DOM selectors (look for `<header>` instead of `<div class="border-b ...">`).

**Commit:**
```bash
git add src/pages/LiveScan.tsx
# include test file if updated
git commit -m "Prompt 8: Unify LiveScan non-sticky branch to PageHeader"
```

---

## Task 10: Migrate `OutfitDetail.tsx` to overlay variant

**File:** `src/pages/OutfitDetail.tsx` lines ~335 and ~391

OutfitDetail currently has TWO custom header branches in the same file:
- `:335` — `<div className="sticky top-0 z-10 p-4 flex items-center justify-between">`
- `:391` — `<div className="fixed top-0 left-0 right-0 z-20 p-4 flex items-center justify-between">`

Plus the page has a hero image (likely full-bleed at the top). Both branches should be unified into a single `<PageHeader variant="overlay" showBack title={...} />` rendered consistently.

**Procedure:**
1. Read the full file (it may be substantial — read in chunks if needed).
2. Identify what condition triggers each branch. Often it's loading vs. loaded state. Whatever the conditions are, the header itself should be the SAME across both — only the page body changes.
3. Hoist a single `<PageHeader variant="overlay" showBack title={t('outfit.detail_title') || 'Outfit'} />` to the top of the page render (above any conditional branches).
4. Remove both legacy `<div sticky top-0>` and `<div fixed top-0>` blocks.
5. Verify the hero image still extends full-bleed under the header (since overlay variant is transparent, the image should show through).

**Verification:**
```bash
npx vitest run src/pages/__tests__ 2>&1 | grep -iE "outfit|fail" | tail -20
```

If `OutfitDetail.test.tsx` exists and breaks, update its DOM selectors.

**Commit:**
```bash
git add src/pages/OutfitDetail.tsx
git commit -m "Prompt 8: Unify OutfitDetail branches under overlay PageHeader"
```

---

## Task 11: Migrate `PublicProfile.tsx` to overlay variant

**File:** `src/pages/PublicProfile.tsx` around line 144

Current:
```tsx
<div className="sticky top-0 z-10 topbar-frost border-b border-border/40">
  {/* ... */}
</div>
```

PublicProfile has a hero/banner area. Replace the custom header with `<PageHeader variant="overlay" showBack title={displayName || 'Profile'} />`.

**Procedure:**
1. Read the file to identify the current title source (probably user displayName).
2. Replace the custom `<div sticky top-0 ...>` block with `<PageHeader variant="overlay" showBack title={...} />`.
3. Remove dead wrapper classes.

**Commit:**
```bash
git add src/pages/PublicProfile.tsx
git commit -m "Prompt 8: Migrate PublicProfile to overlay PageHeader"
```

---

## Task 12: Add PublicProfile migration test

**File:** Create `src/pages/__tests__/PublicProfile.migration.test.tsx`

```typescript
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, locale: 'en' }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));
// PublicProfile likely fetches profile data — mock the loader hook.
// If it uses a different hook name, the implementer should update this mock.

import PublicProfile from '../PublicProfile';

describe('PublicProfile overlay header migration', () => {
  it('renders a PageHeader with data-variant="overlay"', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/u/test']}>
        <Routes>
          <Route path="/u/:handle" element={<PublicProfile />} />
        </Routes>
      </MemoryRouter>,
    );
    const header = container.querySelector('header[data-variant="overlay"]');
    expect(header).not.toBeNull();
  });
});
```

**Note:** PublicProfile's data dependencies may require additional mocks. If the test cannot be made to pass with reasonable mocking, mark this task DONE_WITH_CONCERNS, comment-out the failing assertion with a TODO, and report. Do NOT remove the migration code itself.

**Commit:**
```bash
git add src/pages/__tests__/PublicProfile.migration.test.tsx
git commit -m "Prompt 8: Add PublicProfile overlay migration test"
```

---

## Task 13: Adopt overlay variant on `GarmentDetail.tsx`

**File:** `src/pages/GarmentDetail.tsx` lines 234, 253, 270

GarmentDetail already uses `<PageHeader>` (3 separate calls in different branches) but on a page with a full-bleed garment hero image. Currently they render with the default `solid` variant, so the frosted header sits over the hero, which clashes with the editorial design intent.

**Procedure:**
1. Read the file around lines 234, 253, 270.
2. Add `variant="overlay"` to each `<PageHeader>` call. Preserve every other prop.
3. Verify visually (in the test suite) that no other prop is lost.

Concretely, find each:
```tsx
<PageHeader title={t('garment.garment_title')} showBack />
```
and replace with:
```tsx
<PageHeader title={t('garment.garment_title')} showBack variant="overlay" />
```

Apply the same change at all three call sites. The third call may have additional props (`actions`, `subtitle`, etc.) — preserve them.

**Verification:**
```bash
npx vitest run src/pages/__tests__/GarmentDetail.test.tsx 2>&1 | tail -15
```

If the existing GarmentDetail test asserts on solid header styling (text-foreground, topbar-frost, etc.), update it to assert on overlay (text-white, bg-transparent, data-variant="overlay").

**Commit:**
```bash
git add src/pages/GarmentDetail.tsx
# include test if updated
git commit -m "Prompt 8: Adopt overlay PageHeader variant on GarmentDetail"
```

---

## Task 14: Audit sweep — dispatch parallel subagents

**Files:** none (read-only audit)

This is the meat of the user's "find any little bug that there is using subagent teams" requirement. Three subagents review all production pages in parallel, classify findings, return reports. NO code changes during the audit.

The controller dispatches **3 subagents in parallel** (single message with 3 Agent tool calls). Each gets a slice of pages.

### Page assignment (split for ~10 pages each)

**Subagent A — Hub & list pages**
- `src/pages/Home.tsx`
- `src/pages/Wardrobe.tsx`
- `src/pages/Plan.tsx`
- `src/pages/Outfits.tsx`
- `src/pages/Discover.tsx` (if it still exists)
- `src/pages/UsedGarments.tsx`
- `src/pages/UnusedOutfits.tsx`
- `src/pages/GarmentGaps.tsx`
- `src/pages/PickMustHaves.tsx`
- `src/pages/TravelCapsule.tsx`

**Subagent B — Detail / form / flow pages**
- `src/pages/GarmentDetail.tsx`
- `src/pages/EditGarment.tsx`
- `src/pages/AddGarment.tsx`
- `src/pages/OutfitDetail.tsx`
- `src/pages/OutfitGenerate.tsx`
- `src/pages/MoodOutfit.tsx`
- `src/pages/LiveScan.tsx`
- `src/pages/AIChat.tsx`
- `src/pages/PublicProfile.tsx`
- `src/pages/ShareOutfit.tsx`

**Subagent C — Settings / auth / marketing / utility**
- `src/pages/Settings.tsx`
- `src/pages/settings/SettingsAccount.tsx`
- `src/pages/settings/SettingsAppearance.tsx`
- `src/pages/settings/SettingsNotifications.tsx`
- `src/pages/settings/SettingsPrivacy.tsx`
- `src/pages/settings/SettingsStyle.tsx`
- `src/pages/settings/SeedWardrobe.tsx`
- `src/pages/Auth.tsx`
- `src/pages/ResetPassword.tsx`
- `src/pages/marketing/Terms.tsx`
- `src/pages/marketing/PrivacyPolicy.tsx`
- `src/pages/marketing/Admin.tsx`

**NOT audited (intentionally):**
- `Insights.tsx` (frozen)
- `Index.tsx` (lazy redirect)
- `NotFound.tsx` (utility)
- `BillingCancel.tsx`, `BillingSuccess.tsx`, `GoogleCalendarCallback.tsx` (utility result screens)
- `Onboarding.tsx` (intentionally headerless full-screen)

### Subagent prompt template

Each parallel subagent gets the following prompt (substituting its page list):

```
You are auditing a slice of production pages for a header/layout audit sweep.
Working directory: C:\Users\borna\OneDrive\Desktop\BZ\Burs\bursai-working
Branch: prompt-8-page-migration

For EACH of the following pages, READ the file (Read tool) and classify it
as ONE of:

- canonical: Uses <PageHeader> from @/components/layout/PageHeader correctly.
  Confirms safe-area is handled by AppLayout (no manual safe-area-top in the
  page), and any header chrome goes through PageHeader.
- no-header: Intentionally headerless (e.g., full-bleed landing, modal-style
  flow). Confirm this is intentional and not an oversight.
- custom-header: Has its own header DOM (any element using sticky top-0 +
  topbar-frost or similar) bypassing PageHeader. Should have been caught in
  Tasks 2-13 — flag if you find one we missed.
- bug: Found a small, obvious, one-line bug worth fixing in this PR. Examples:
  - missing haptics on a tappable button
  - hard-coded color instead of a token
  - wrong px value vs. design system
  - missing aria-label
  - typo in a translation key
  - dead import
  - obvious accessibility issue
- escalate: Found a bigger bug or design issue that needs more than a
  one-line fix and its own PR. Examples:
  - broken loading state
  - layout regression on small viewports
  - missing error boundary
  - data-fetching race condition
  - significant styling drift from the design system

For each page, report:
  PAGE: <relative path>
  CLASSIFICATION: <one of the above>
  EVIDENCE: <file:line references>
  NOTE: <one sentence explaining the finding>

Pages to audit:
- <list>

DO NOT make any code changes. DO NOT touch any file. This is a READ-ONLY
review. Report findings back to the controller in plain text.

CONSTRAINTS:
- Do not audit src/pages/Insights.tsx, Index.tsx, NotFound.tsx,
  BillingCancel.tsx, BillingSuccess.tsx, GoogleCalendarCallback.tsx,
  Onboarding.tsx — these are excluded from this sweep.
- Use Read and Grep tools only.
- Stay focused on header/layout/UI bugs. Do not chase business-logic concerns.
```

The controller dispatches A, B, C in parallel (one message, three tool calls), waits for all three reports, then proceeds to Task 15.

---

## Task 15: Apply audit findings — small fixes inline

For every `bug` finding from the three subagent reports:

1. Apply the fix as a small commit per finding, with commit message `Prompt 8: Audit fix — <one-line description> in <file>`.
2. Run tsc / eslint / focused test on the touched file after each fix.
3. Keep each commit small and reviewable.

For every `escalate` finding: do NOT fix in this PR. Add it to the deferred list that goes into the PR body in Task 17. Include file:line references and a short description.

For every `custom-header` finding (a regression we missed in Tasks 2-13): treat as a bug — fix it inline as a `Prompt 8: Audit fix — migrate <page> to PageHeader` commit.

If the audit reports more than ~10 individual bug fixes, STOP and report back to the user before applying further fixes — that's a signal the PR is getting too big.

---

## Task 16: Full verification

```bash
npx tsc --noEmit --skipLibCheck
npx eslint src/ --ext .ts,.tsx --max-warnings 0
npm run build 2>&1 | tail -20
npx vitest run 2>&1 | tail -10
```

Expected: 0 errors, 0 warnings, clean build, all tests pass.

---

## Task 17: Push and open PR

```bash
git push -u origin prompt-8-page-migration
```

```bash
gh pr create --title "Prompt 8: Page migration sweep — adopt canonical PageHeader" --body "..."
```

The PR body MUST include:
- Summary of which pages were migrated (D1–D9 + 3 detail-overlay adoptions)
- Per-finding list from the audit sweep (canonical / no-header / bug-fixed / escalate)
- An "Escalations" section with each `escalate` finding — these become Phase 5 prompts
- Manual iPhone test checklist:
  - Each migrated page renders the canonical sticky frost header
  - Garment / Outfit / Public profile detail pages show transparent overlay header over the hero image
  - The back button on the overlay variant is legible against both light and dark hero images
  - Outfits page no longer has any horizontal-edge overflow from the old `-mx-5` hack

---

## Self-Review

**Spec coverage:**
- D1 (AIChat) → Task 2
- D2 (Terms) → Task 3
- D3 (PrivacyPolicy) → Task 4
- D4 (Admin) → Task 5
- D5 (ShareOutfit) → Task 6
- D6 (PublicProfile) → Task 11
- D7 (OutfitDetail) → Task 10
- D8 (Outfits) → Tasks 7, 8
- D9 (LiveScan non-sticky branch) → Task 9
- B4 adoption (overlay variant on detail pages) → Tasks 10, 11, 13

**Audit sweep** → Tasks 14, 15

**Frozen file compliance:** Insights, median, locales, types — all explicitly excluded.

**Escalation handling:** Task 15 logs `escalate` findings to PR body for Phase 5 cycles, doesn't silently drop or fix them.

**Placeholder scan:** none — every task has concrete file paths and instructions.
