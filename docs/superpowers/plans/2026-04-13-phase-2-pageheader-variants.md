# Phase 2 — PageHeader Variants — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a canonical `variant` prop to `PageHeader` (`solid` default, `overlay` for hero-image detail pages) and deprecate `sticky` so future pages can no longer opt out, without touching frozen files.

**Architecture:** `PageHeader` gets a new `variant?: 'solid' | 'overlay'` prop. `solid` keeps current behavior (frost background via `topbar-frost`, sticky, full chrome). `overlay` is transparent, sits over a hero image, and gives the back button a translucent-blur pill so it stays legible against any photo. The `sticky` prop is retained as a deprecated no-op (always sticky) because `src/pages/Insights.tsx` still passes `sticky={false}` and is frozen per `CLAUDE.md` — removing the prop would break Insights.

**Tech Stack:** React 18 + TypeScript + Tailwind + Framer Motion + Vitest/@testing-library.

**Spec:** `docs/superpowers/specs/2026-04-13-header-viewport-audit-design.md` (items B2 partial, B4)

**Out of scope for this plan:**
- Migrating `GarmentDetail`, `OutfitDetail`, `PublicProfile` to use `variant="overlay"` — that's Phase 3 (per-page migration sweep).
- Hard removal of the `sticky` prop — blocked by the Insights freeze. Will be revisited if/when Insights is unfrozen.
- Per-page custom-header migrations (Phase 3).

**Branch:** `prompt-7-pageheader-variants` (cut from current state of `prompt-6-foundation-safe-area`, since Phase 2 builds on Phase 1's primitive updates and Phase 1 is not yet merged to `main`).

**PR base:** `prompt-6-foundation-safe-area`. Once Phase 1 merges to main, GitHub will auto-rebase / Phase 2's PR can be retargeted to main.

## Constraint Notes

- **`src/pages/Insights.tsx` is frozen.** It calls `<PageHeader ... sticky={false} ... />` at line ~71. We must NOT touch this file. Therefore the `sticky` prop must remain in `PageHeader`'s public API and accept both `true` and `false` without TypeScript errors.
- **`src/pages/Wardrobe.tsx`** is NOT frozen and currently passes `sticky={false}` at line 109. We will remove that prop usage so Wardrobe gets the canonical sticky frost behavior.
- The existing test `src/components/layout/__tests__/PageHeader.test.tsx` has assertions about `sticky={false}` rendering non-sticky chrome. After Phase 2 these assertions become wrong (the prop is now a no-op). Update the test to assert the new invariants instead.

## File Structure

**Modify:**
- `src/components/layout/PageHeader.tsx` — add `variant` prop, mark `sticky` as deprecated, always render sticky/frost/safe-area-aware chrome
- `src/components/layout/__tests__/PageHeader.test.tsx` — replace stale `sticky={false}` assertions with variant assertions
- `src/components/layout/__tests__/PageHeader.safe-area.test.tsx` — add a regression test for the overlay variant
- `src/pages/Wardrobe.tsx:109` — remove `sticky={false}` (now a no-op)

**Do NOT touch:**
- `src/pages/Insights.tsx` (frozen)
- Any detail page (Phase 3)
- Median hooks, locales, supabase types

---

## Task 1: Cut work branch

**Files:** none (git only)

- [ ] **Step 1: Cut the branch from current Phase 1 head**

```bash
cd "C:/Users/borna/OneDrive/Desktop/BZ/Burs/bursai-working"
git checkout prompt-6-foundation-safe-area
git checkout -b prompt-7-pageheader-variants
git status
```

Expected: clean tree on `prompt-7-pageheader-variants`. The branch has all of Phase 1's commits as its base.

---

## Task 2: Add `variant` prop and deprecate `sticky`

**Files:**
- Modify: `src/components/layout/PageHeader.tsx`

- [ ] **Step 1: Replace the file**

Replace the entire file `src/components/layout/PageHeader.tsx` with:

```typescript
import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/lib/haptics';

export type PageHeaderVariant = 'solid' | 'overlay';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  showBack?: boolean;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
  /**
   * Visual variant.
   *
   * - `solid` (default): frost background, border-bottom, full editorial chrome.
   *   Use for hub, list, form, and settings pages.
   * - `overlay`: transparent background, circular blur-pill back button, sits
   *   over a hero image. Use for detail pages with full-bleed hero photography
   *   (GarmentDetail, OutfitDetail, PublicProfile).
   */
  variant?: PageHeaderVariant;
  /**
   * @deprecated The header is always sticky. This prop is retained only for
   * backward compatibility with `src/pages/Insights.tsx` (frozen file) and
   * has no effect — the header always sticks to the top of its scroll
   * container. Remove from new callers.
   */
  sticky?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  showBack = false,
  actions,
  className,
  titleClassName,
  variant = 'solid',
}: PageHeaderProps) {
  const navigate = useNavigate();

  const isOverlay = variant === 'overlay';

  return (
    <header
      className={cn(
        'sticky top-0',
        isOverlay ? 'bg-transparent' : 'topbar-frost',
        className,
      )}
      style={{ zIndex: 'var(--z-header)' } as React.CSSProperties}
      data-variant={variant}
    >
      <div
        className={cn(
          'mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-[var(--page-px)]',
          subtitle || eyebrow ? 'min-h-[68px] py-2.5' : 'h-[60px]',
        )}
        style={{ paddingTop: '12px' }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {showBack && (
            <button
              type="button"
              onClick={() => { hapticLight(); navigate(-1); }}
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:scale-95 transition-transform',
                isOverlay
                  // Translucent blur pill so the back button stays legible
                  // over any hero image. White-tinted because hero images
                  // can be either dark or light.
                  ? 'border border-white/30 bg-black/35 text-white backdrop-blur-md'
                  : 'border border-border/70 bg-background/88 text-foreground',
              )}
              aria-label="Go back"
            >
              <ArrowLeft className="w-[18px] h-[18px]" />
            </button>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <p
                className={cn(
                  'caption-upper mb-0.5',
                  isOverlay ? 'text-white/70' : 'text-muted-foreground/60',
                )}
              >
                {eyebrow}
              </p>
            )}
            <AnimatePresence mode="wait">
              <motion.h1
                key={title}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.18 }}
                className={cn(
                  'truncate font-display italic text-[1.24rem] font-medium leading-tight sm:text-[1.3rem]',
                  isOverlay ? 'text-white' : 'text-foreground',
                  titleClassName,
                )}
              >
                {title}
              </motion.h1>
            </AnimatePresence>
            {subtitle && (
              <p
                className={cn(
                  'mt-0.5 max-w-[30ch] text-[0.78rem] leading-5',
                  isOverlay ? 'text-white/70' : 'text-muted-foreground/62',
                )}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
```

Key changes vs. Phase 1's `PageHeader.tsx`:
1. New `variant?: 'solid' | 'overlay'` prop, default `'solid'`.
2. `sticky` prop is still in the type definition (with a `@deprecated` JSDoc) but is no longer destructured / used. The header is unconditionally sticky.
3. `topbar-frost` is conditional on `variant === 'solid'`. Overlay variant uses `bg-transparent`.
4. Back button has two visual treatments: solid (existing) and overlay (translucent black blur pill with white icon and white border).
5. Title, eyebrow, and subtitle text colors switch to white-tinted variants when `isOverlay`.
6. New `data-variant={variant}` attribute on the root `<header>` for test selectors and runtime hooks.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit --skipLibCheck
npx eslint src/components/layout/PageHeader.tsx --max-warnings 0
```

Expected: 0 errors, 0 warnings. The `sticky` prop being declared but unused is allowed because it's still part of the type signature (we just don't destructure it).

If eslint complains about an unused prop in destructuring, ensure `sticky` is NOT included in the destructure list — it remains in the interface for type-compatibility only.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/PageHeader.tsx
git commit -m "Prompt 7: Add PageHeader variant prop, deprecate sticky"
```

---

## Task 3: Update Wardrobe — drop the no-op `sticky={false}`

**Files:**
- Modify: `src/pages/Wardrobe.tsx:109`

- [ ] **Step 1: Inspect**

```bash
sed -n '100,115p' src/pages/Wardrobe.tsx
```

Expected to find a `<PageHeader ...>` element with `sticky={false}` on a line near 109.

- [ ] **Step 2: Remove the `sticky={false}` prop**

Edit `src/pages/Wardrobe.tsx` to remove the literal `sticky={false}` line/prop from the `<PageHeader>` invocation. Preserve every other prop. The remaining call should be a clean `<PageHeader title=... ... />` with no `sticky` prop at all.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit --skipLibCheck
npx eslint src/pages/Wardrobe.tsx --max-warnings 0
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Wardrobe.tsx
git commit -m "Prompt 7: Drop no-op sticky={false} from Wardrobe PageHeader"
```

---

## Task 4: Update existing PageHeader test for new behavior

**Files:**
- Modify: `src/components/layout/__tests__/PageHeader.test.tsx`

The current test asserts that `sticky={false}` produces non-sticky chrome. After Phase 2 that's no longer true (the prop is a deprecated no-op). Replace those assertions.

- [ ] **Step 1: Replace the file**

Replace `src/components/layout/__tests__/PageHeader.test.tsx` with:

```typescript
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { PageHeader } from '../PageHeader';

describe('PageHeader', () => {
  it('always renders frost sticky chrome regardless of deprecated sticky prop', () => {
    render(
      <MemoryRouter>
        {/* sticky prop is deprecated but still accepted (Insights compat). It is now a no-op. */}
        <PageHeader title="Wardrobe" sticky={false} />
      </MemoryRouter>,
    );

    const header = screen.getByRole('banner');
    expect(header.className).toContain('topbar-frost');
    expect(header.className).toContain('sticky');
    expect(header.getAttribute('data-variant')).toBe('solid');
  });

  it('renders the solid variant by default', () => {
    render(
      <MemoryRouter>
        <PageHeader title="Plan" />
      </MemoryRouter>,
    );

    const header = screen.getByRole('banner');
    expect(header.className).toContain('topbar-frost');
    expect(header.className).toContain('sticky');
    expect(header.getAttribute('data-variant')).toBe('solid');
  });
});
```

- [ ] **Step 2: Run**

```bash
npx vitest run src/components/layout/__tests__/PageHeader.test.tsx
```

Expected: PASS both assertions.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/__tests__/PageHeader.test.tsx
git commit -m "Prompt 7: Update PageHeader test to assert deprecated sticky no-op"
```

---

## Task 5: Add overlay variant test

**Files:**
- Modify: `src/components/layout/__tests__/PageHeader.safe-area.test.tsx`

- [ ] **Step 1: Add overlay variant assertions**

Append to `src/components/layout/__tests__/PageHeader.safe-area.test.tsx` (inside the existing `describe` block, as new `it` cases):

```typescript
  it('renders the overlay variant with transparent background', () => {
    const { container } = render(
      <MemoryRouter>
        <PageHeader title="Garment" variant="overlay" showBack />
      </MemoryRouter>,
    );
    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    expect(header?.getAttribute('data-variant')).toBe('overlay');
    expect(header?.className ?? '').toContain('bg-transparent');
    expect(header?.className ?? '').not.toContain('topbar-frost');
  });

  it('overlay variant back button uses image-friendly blur pill styling', () => {
    const { container } = render(
      <MemoryRouter>
        <PageHeader title="Garment" variant="overlay" showBack />
      </MemoryRouter>,
    );
    const backButton = container.querySelector('button[aria-label="Go back"]');
    expect(backButton).not.toBeNull();
    const cls = backButton?.className ?? '';
    expect(cls).toContain('backdrop-blur');
    expect(cls).toContain('text-white');
  });

  it('solid variant back button uses standard editorial styling', () => {
    const { container } = render(
      <MemoryRouter>
        <PageHeader title="Wardrobe" variant="solid" showBack />
      </MemoryRouter>,
    );
    const backButton = container.querySelector('button[aria-label="Go back"]');
    expect(backButton).not.toBeNull();
    const cls = backButton?.className ?? '';
    expect(cls).toContain('text-foreground');
    expect(cls).not.toContain('backdrop-blur');
  });
```

- [ ] **Step 2: Run**

```bash
npx vitest run src/components/layout/__tests__/PageHeader.safe-area.test.tsx
```

Expected: PASS all assertions (the original two from Phase 1, plus the three new ones).

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/__tests__/PageHeader.safe-area.test.tsx
git commit -m "Prompt 7: Add overlay variant tests for PageHeader"
```

---

## Task 6: Full verification

- [ ] **Step 1: TypeScript / lint / build / full test suite**

```bash
npx tsc --noEmit --skipLibCheck
npx eslint src/ --ext .ts,.tsx --max-warnings 0
npm run build 2>&1 | tail -20
npx vitest run 2>&1 | tail -10
```

Expected: 0 errors, 0 warnings, clean build, all tests pass.

- [ ] **Step 2: Confirm Insights still compiles**

Insights is frozen, but Phase 2's deprecation should not break it.

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep -i insights || echo "no insights errors"
```

Expected: `no insights errors`.

---

## Task 7: Push and open PR

- [ ] **Step 1: Push**

```bash
git push -u origin prompt-7-pageheader-variants
```

- [ ] **Step 2: Open PR with base = `prompt-6-foundation-safe-area`**

```bash
gh pr create --base prompt-6-foundation-safe-area --title "Prompt 7: PageHeader variant prop, deprecate sticky" --body "$(cat <<'EOF'
## Summary

Phase 2 of the header/viewport/safe-area audit (spec: `docs/superpowers/specs/2026-04-13-header-viewport-audit-design.md`, plan: `docs/superpowers/plans/2026-04-13-phase-2-pageheader-variants.md`).

- Adds `variant?: 'solid' | 'overlay'` to `PageHeader`.
- `solid` (default) is the existing frost editorial chrome. Used by hub, list, form, and settings pages.
- `overlay` is transparent with a translucent blur back-button pill, designed to sit over hero images. Will be adopted by detail pages in Phase 3.
- Deprecates the `sticky` prop. The header is now always sticky. The prop remains in the public type signature only so `src/pages/Insights.tsx` (frozen) keeps compiling.
- Drops the now-no-op `sticky={false}` from `Wardrobe.tsx`.
- New tests cover both variants and assert the deprecated `sticky` prop has no behavioral effect.

## PR base

This PR targets `prompt-6-foundation-safe-area` (Phase 1's branch) because Phase 1 has not yet merged to `main`. After Phase 1 merges, this PR can be retargeted to `main` automatically.

## Test plan

### Automated

- [x] `npx tsc --noEmit --skipLibCheck` — 0 errors
- [x] `npx eslint src/ --max-warnings 0` — 0 warnings
- [x] `npm run build` — clean, no warnings
- [x] `npx vitest run` — full suite passes
- [x] New test: overlay variant renders with `bg-transparent` and `data-variant="overlay"`
- [x] New test: overlay variant back button uses `backdrop-blur` + `text-white`
- [x] New test: solid variant back button uses `text-foreground`
- [x] Updated test: deprecated `sticky={false}` is a no-op

### Manual device checks (please run after merge)

- [ ] Wardrobe header is sticky and frost-styled (was previously non-sticky due to `sticky={false}`).
- [ ] Insights (frozen page) still renders correctly with no console errors.
- [ ] No existing `PageHeader` caller has visual regressions.

### Deferred

- **Phase 3:** Migrate `GarmentDetail`, `OutfitDetail`, `PublicProfile` to `variant="overlay"`, plus the per-page audit sweep of all 9 custom-header pages and any unrelated bugs surfaced.
- **Phase 4:** Floating-component safe-area fixes (`OfflineBanner`, `Onboarding`, `SeedProgressPill`).
- **Phase 5:** Any escalated findings from Phase 3.
- **Future:** Hard removal of the `sticky` prop after `Insights.tsx` is unfrozen.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Final report**

Report status in the standard `CLAUDE.md` format.

---

## Self-Review

**Spec coverage:**
- B2 (remove sticky prop) → **partially**: prop deprecated as no-op, fully removable only when Insights is unfrozen ✓ (constraint flagged)
- B4 (overlay variant) → Task 2 ✓

**Placeholder scan:** none.

**Type consistency:** `variant: PageHeaderVariant` exported and used consistently. `sticky` retained in interface but not destructured (silently accepts but ignores).

**Constraint compliance:** No frozen files modified.
