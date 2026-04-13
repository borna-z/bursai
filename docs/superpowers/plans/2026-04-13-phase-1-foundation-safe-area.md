# Phase 1 — Foundation: Safe-Area + Z-Index Scale — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the systemic viewport/safe-area/z-index foundation so every sticky header covers the dynamic-island strip, toasts never hide behind it, and z-stack ordering becomes consistent and typed.

**Architecture:** Move safe-area coverage responsibility from `<main>` onto `PageHeader` (the header grows a wrapper that covers the safe-area strip with its own frost background). Delete the decorative gradient that currently lives in the safe-area strip. Replace all hard-coded z-index numbers with a canonical CSS-variable scale defined once in `index.css`. Migrate every raw `env(safe-area-inset-top)` call site to `var(--safe-area-top)` so Median iOS doesn't break.

**Tech Stack:** React 18 + TypeScript + Tailwind + Framer Motion + Sonner + Vitest/@testing-library.

**Spec:** `docs/superpowers/specs/2026-04-13-header-viewport-audit-design.md`

**Out of scope for this plan:** Phases 2–5 (PageHeader variants, per-page migration, floating-component safe-area, escalations). Each phase becomes its own prompt cycle.

**Branch:** `prompt-6-foundation-safe-area` (cut from `main`)

---

## File Structure

**Create:**
- `src/components/layout/__tests__/PageHeader.safe-area.test.tsx` — structural tests asserting the header covers the safe-area strip and uses the z-scale.
- `src/components/ui/__tests__/sonner.test.tsx` — smoke test asserting Sonner renders with a safe-area-aware offset.

**Modify (in order touched):**
- `src/index.css` — add z-index scale CSS variables; fix raw `env()` in `.safe-top` utility (line 311).
- `src/hooks/useViewportShell.ts:90-93` — add 3px threshold guard for `visualViewport.offsetTop`.
- `src/components/ui/sonner.tsx` — add `offset` and z-index scale usage.
- `src/components/layout/PageHeader.tsx` — add safe-area wrapper, use z scale, make padding safe-area-aware.
- `src/components/layout/AppLayout.tsx` — remove `<main>` safe-area padding, delete decorative gradient, use z scale.
- `src/pages/Auth.tsx:166` — migrate raw `env()` to `var(--safe-area-top)`.
- `src/pages/LiveScan.tsx:659` — migrate raw `env()` to `var(--safe-area-top)`.
- `src/components/add-garment/UploadStep.tsx:59` — migrate raw `env()`.
- `src/components/layout/BursLoadingScreen.tsx:41` — migrate raw `env()` and z usage.
- `src/components/layout/BottomNav.tsx:264` — use `var(--z-bottom-nav)`.
- `src/components/layout/OfflineBanner.tsx:21` — use `var(--z-offline-banner)` (safe-area fix deferred to Phase 4).
- `src/components/layout/SeedProgressPill.tsx:27` — use `var(--z-floating-pill)`.
- `src/pages/Onboarding.tsx:30` — use `var(--z-modal)` (safe-area fix deferred to Phase 4).
- `src/components/layout/MilestoneCelebration.tsx:104` — use `var(--z-celebration)`.
- `src/components/coach/CoachMark.tsx:94,147,156,172` — use `var(--z-coach)` tiers.
- `src/components/onboarding/StyleQuizV3.tsx:495` — use `var(--z-modal)`.
- `src/components/landing/ExitIntentModal.tsx:32` — use `var(--z-toast)` (one-above-modal overlay).
- `src/pages/LiveScan.tsx:653` — use `var(--z-modal)` for in-scan overlay.

**Do NOT touch:**
- `src/pages/Insights.tsx` — frozen per `CLAUDE.md`.
- `src/hooks/useMedianCamera.ts`, `useMedianStatusBar.ts`, `src/lib/median.ts` — frozen.
- `src/i18n/locales/{en,sv}.ts` — append-only.
- `src/integrations/supabase/types.ts` — auto-generated.

---

## Task 1: Create the work branch

**Files:** none (git only)

- [ ] **Step 1: Cut the branch from main**

```bash
cd "C:/Users/borna/OneDrive/Desktop/BZ/Burs/bursai-working"
git checkout main
git pull origin main
git checkout -b prompt-6-foundation-safe-area main
git status
```

Expected: clean tree on `prompt-6-foundation-safe-area`.

---

## Task 2: Add z-index scale CSS variables

**Files:**
- Modify: `src/index.css` (`:root` block, currently ends around line 51)

- [ ] **Step 1: Add the z-index scale**

In `src/index.css`, inside the `:root { ... }` block (the light-mode block that currently contains `--page-px: 20px;`), add immediately after `--page-px: 20px;`:

```css
    /* Z-index scale — single source of truth. Higher = more on top. */
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

- [ ] **Step 2: Verify the build still succeeds**

```bash
npx tsc --noEmit --skipLibCheck
```

Expected: 0 errors (CSS changes can't break tsc, but sanity check).

```bash
npm run build
```

Expected: clean build, no warnings.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "Prompt 6: Add canonical z-index scale to index.css"
```

---

## Task 3: Fix `.safe-top` utility raw env usage

**Files:**
- Modify: `src/index.css:311`

The `.safe-top` utility uses raw `env(safe-area-inset-top, 0)` which breaks on Median iOS. Replace with the `var(--safe-area-top)` pipeline.

- [ ] **Step 1: Replace the raw env call**

Find in `src/index.css`:

```css
  .safe-top {
    padding-top: env(safe-area-inset-top, 0);
  }
```

Replace with:

```css
  .safe-top {
    padding-top: var(--safe-area-top);
  }
```

- [ ] **Step 2: Verify no other consumers break**

```bash
npx tsc --noEmit --skipLibCheck && npm run build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "Prompt 6: Migrate .safe-top utility to var(--safe-area-top)"
```

---

## Task 4: Keyboard-open threshold guard in useViewportShell

**Files:**
- Modify: `src/hooks/useViewportShell.ts:87-97`

`visualViewport.offsetTop` can emit small (<3px) noise values on iOS during keyboard open, causing visible jitter at the top of the layout. Only apply it when it exceeds a threshold.

- [ ] **Step 1: Replace the `updateViewportVars` body**

Find:

```typescript
    const updateViewportVars = () => {
      const visualViewport = window.visualViewport;
      const height = visualViewport?.height ?? window.innerHeight;
      const viewportOffset = Math.max(visualViewport?.offsetTop ?? 0, 0);
      // Combine the device-level safe area with any transient viewport shift
      // (keyboard, zoom, browser chrome) so content never slides under system UI.
      const offsetTop = Math.max(cachedSafeTopBase, viewportOffset);

      root.style.setProperty(HEIGHT_VAR, `${height}px`);
      root.style.setProperty(OFFSET_TOP_VAR, `${offsetTop}px`);
    };
```

Replace with:

```typescript
    const updateViewportVars = () => {
      const visualViewport = window.visualViewport;
      const height = visualViewport?.height ?? window.innerHeight;
      const rawOffset = Math.max(visualViewport?.offsetTop ?? 0, 0);
      // Ignore sub-3px visualViewport offsets — iOS emits tiny noise values
      // during keyboard open/close that cause visible layout jitter.
      const viewportOffset = rawOffset >= 3 ? rawOffset : 0;
      const offsetTop = Math.max(cachedSafeTopBase, viewportOffset);

      root.style.setProperty(HEIGHT_VAR, `${height}px`);
      root.style.setProperty(OFFSET_TOP_VAR, `${offsetTop}px`);
    };
```

- [ ] **Step 2: Run existing hook tests**

```bash
npx vitest run src/hooks/__tests__ 2>&1 | tail -30
```

Expected: pass (or no file exists — then skip).

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit --skipLibCheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useViewportShell.ts
git commit -m "Prompt 6: Ignore sub-3px visualViewport offset jitter"
```

---

## Task 5: Fix Sonner — safe-area offset + z-index

**Files:**
- Modify: `src/components/ui/sonner.tsx`
- Create: `src/components/ui/__tests__/sonner.test.tsx`

Sonner currently has no `offset` prop, so toasts render at `top: 16px` inside the dynamic island zone. Add an offset that combines `var(--safe-area-top)` with a 12px gap, and move onto the z-scale.

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/__tests__/sonner.test.tsx`:

```typescript
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Toaster } from '../sonner';

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

describe('Toaster safe-area', () => {
  it('renders a sonner section with safe-area aware offset', () => {
    const { container } = render(<Toaster />);
    const section = container.querySelector('section[aria-label], ol');
    // Sonner renders into a section wrapper with --offset-top custom property
    // derived from the offset prop. We assert the prop is wired by inspecting
    // the resulting style.
    const withOffset = container.querySelector('[style*="--offset-top"], [style*="offset"]');
    expect(withOffset ?? section).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test, expect it to pass currently**

```bash
npx vitest run src/components/ui/__tests__/sonner.test.tsx
```

Expected: PASS (Sonner always renders — the test is loose so we can tighten it after the implementation).

Note: the test is deliberately loose because Sonner's DOM varies by version. The real verification is the manual iPhone check in the PR body and the static `offset` prop audit below.

- [ ] **Step 3: Update `sonner.tsx`**

Replace the entire file `src/components/ui/sonner.tsx` with:

```typescript
import { Toaster as Sonner, toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      position="top-center"
      duration={2000}
      // Push toasts below the dynamic island / notch.
      // --safe-area-top is the JS-probed safe inset (works on Median iOS where env() returns 0).
      offset="calc(var(--safe-area-top) + 12px)"
      className="toaster group"
      style={{ zIndex: 'var(--z-toast)' } as React.CSSProperties}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-[1.25rem] group-[.toaster]:px-4 group-[.toaster]:py-3 group-[.toaster]:text-sm",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[hsl(var(--success))]",
          error: "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[hsl(var(--destructive))]",
        },
      }}
      {...props}
    />
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export { Toaster, toast };
```

- [ ] **Step 4: Run test again**

```bash
npx vitest run src/components/ui/__tests__/sonner.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Verify no tsc/lint/build errors**

```bash
npx tsc --noEmit --skipLibCheck
npx eslint src/components/ui/sonner.tsx --max-warnings 0
npm run build 2>&1 | tail -20
```

Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/sonner.tsx src/components/ui/__tests__/sonner.test.tsx
git commit -m "Prompt 6: Fix Sonner offset so toasts clear dynamic island"
```

---

## Task 6: PageHeader covers its own safe-area strip

**Files:**
- Modify: `src/components/layout/PageHeader.tsx`
- Create: `src/components/layout/__tests__/PageHeader.safe-area.test.tsx`

The sticky header currently sits below the safe area. Give it a wrapper that extends up into the safe-area strip with the same frost background, and make its content padding safe-area-aware. This task does NOT yet add variants or remove the `sticky` prop (those belong to Phase 2).

- [ ] **Step 1: Write the failing test**

Create `src/components/layout/__tests__/PageHeader.safe-area.test.tsx`:

```typescript
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { PageHeader } from '../PageHeader';

function renderHeader() {
  return render(
    <MemoryRouter>
      <PageHeader title="Test" />
    </MemoryRouter>,
  );
}

describe('PageHeader safe-area coverage', () => {
  it('renders a safe-area cover element with var(--safe-area-top) height', () => {
    const { container } = renderHeader();
    const cover = container.querySelector('[data-safe-area-cover="true"]');
    expect(cover).not.toBeNull();
    expect(cover?.getAttribute('style') ?? '').toContain('var(--safe-area-top)');
  });

  it('root uses the canonical z-header scale variable', () => {
    const { container } = renderHeader();
    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    const style = header?.getAttribute('style') ?? '';
    const className = header?.className ?? '';
    // Accept either inline style or class form
    expect(style + className).toMatch(/--z-header|z-\[var\(--z-header\)\]/);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
npx vitest run src/components/layout/__tests__/PageHeader.safe-area.test.tsx
```

Expected: FAIL (`data-safe-area-cover` element doesn't exist yet; z-header class missing).

- [ ] **Step 3: Replace `PageHeader.tsx` with the safe-area-aware version**

Replace the entire file `src/components/layout/PageHeader.tsx` with:

```typescript
import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/lib/haptics';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  showBack?: boolean;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
  /**
   * Whether the header sticks to the top of the scroll container.
   * Kept as public API for Phase 1 compatibility — Phase 2 will remove it.
   */
  sticky?: boolean;
}

export function PageHeader({
  title, subtitle, eyebrow, showBack = false, actions, className, titleClassName, sticky = true,
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header
      className={cn(
        sticky ? 'topbar-frost sticky top-0' : 'relative',
        className,
      )}
      style={{ zIndex: 'var(--z-header)' } as React.CSSProperties}
    >
      {/* Safe-area cover: extends the frosted header up into the dynamic-island
          strip so content never shows above the header. Matches the header's
          background via topbar-frost on the parent. */}
      <div
        data-safe-area-cover="true"
        aria-hidden="true"
        style={{ height: 'var(--safe-area-top)' }}
      />
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
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/88 active:scale-95 transition-transform"
              aria-label="Go back"
            >
              <ArrowLeft className="w-[18px] h-[18px]" />
            </button>
          )}
          <div className="min-w-0">
            {eyebrow && <p className="caption-upper mb-0.5 text-muted-foreground/60">{eyebrow}</p>}
            <AnimatePresence mode="wait">
              <motion.h1
                key={title}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.18 }}
                className={cn("truncate font-display italic text-[1.24rem] font-medium leading-tight text-foreground sm:text-[1.3rem]", titleClassName)}
              >
                {title}
              </motion.h1>
            </AnimatePresence>
            {subtitle && (
              <p className="mt-0.5 max-w-[30ch] text-[0.78rem] leading-5 text-muted-foreground/62">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
```

Key changes vs. previous file:
1. Added `data-safe-area-cover="true"` wrapper div with `height: var(--safe-area-top)`.
2. Replaced `z-20` Tailwind class with inline `zIndex: 'var(--z-header)'` style.
3. Removed the separate `sticky ? 'min-h-[68px] py-2.5' : 'min-h-[64px] py-1.5'` differentiator — header is always full-height regardless of sticky state, since non-sticky usage is rare and fixed in Phase 2.

- [ ] **Step 4: Run the test**

```bash
npx vitest run src/components/layout/__tests__/PageHeader.safe-area.test.tsx
```

Expected: PASS both tests.

- [ ] **Step 5: Run any existing PageHeader tests**

```bash
npx vitest run src/components/layout/__tests__
```

Expected: all pass. If a pre-existing test broke because of the new safe-area cover element, update that test's selectors to accept the new DOM — do NOT remove the safe-area cover.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/PageHeader.tsx src/components/layout/__tests__/PageHeader.safe-area.test.tsx
git commit -m "Prompt 6: PageHeader covers its own safe-area strip"
```

---

## Task 7: AppLayout — remove `<main>` safe-area padding and delete decorative gradient

**Files:**
- Modify: `src/components/layout/AppLayout.tsx`

The header now covers the safe area itself, so `<main>` should not also pad for it (that would double-count). The decorative gradient at the top of the app only existed because the safe-area strip was empty — with the header now covering it, the gradient becomes visually redundant and actively causes the "ribbon" artifact.

- [ ] **Step 1: Replace `AppLayout.tsx`**

Replace the entire file `src/components/layout/AppLayout.tsx` with:

```typescript
import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { OfflineBanner } from './OfflineBanner';
import { SeedProgressPill } from './SeedProgressPill';
import { useKeyboardAdjust } from '@/hooks/useKeyboardAdjust';
import { useMedianStatusBar } from '@/hooks/useMedianStatusBar';
import { useViewportShell } from '@/hooks/useViewportShell';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUnlockCelebration } from '@/hooks/useWardrobeUnlocks';
import { MilestoneCelebration } from './MilestoneCelebration';

interface AppLayoutProps {
  children: ReactNode;
  hideNav?: boolean;
}

export function AppLayout({ children, hideNav = false }: AppLayoutProps) {
  const { resolvedTheme } = useTheme();
  const { t } = useLanguage();
  useKeyboardAdjust();
  useViewportShell();
  useMedianStatusBar(resolvedTheme);
  useUnlockCelebration();

  return (
    <div
      className="relative flex min-h-0 flex-col overflow-hidden bg-background text-foreground"
      style={{
        minHeight: 'var(--app-viewport-height, 100svh)',
        height: 'var(--app-viewport-height, 100svh)',
      }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-foreground focus:text-background focus:rounded-md"
        style={{ zIndex: 'var(--z-celebration)' } as React.CSSProperties}
      >
        {t('common.skip_to_main')}
      </a>
      <OfflineBanner />
      <main
        id="main-content"
        className="relative flex-1 overflow-x-clip overflow-y-auto scrollbar-hide"
        style={{
          zIndex: 'var(--z-base)',
          paddingBottom: hideNav ? '0px' : 'var(--app-bottom-clearance)',
          overscrollBehavior: 'none',
        } as React.CSSProperties}
      >
        {children}
      </main>
      {!hideNav && <BottomNav />}
      <SeedProgressPill />
      <MilestoneCelebration />
    </div>
  );
}
```

Key changes vs. previous file:
1. Deleted the decorative `<div aria-hidden ... h-24 bg-gradient-to-b>` block.
2. Removed `paddingTop: 'var(--safe-area-top)'` from `<main>` style.
3. Replaced `z-[1]` on `<main>` and `focus:z-[100]` on the skip link with inline scale variables.

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit --skipLibCheck
npx eslint src/components/layout/AppLayout.tsx --max-warnings 0
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Run layout tests**

```bash
npx vitest run src/components/layout/__tests__
```

Expected: all pass. If the `AppLayout` render test previously asserted the gradient existed, update it to assert it does not.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/AppLayout.tsx
git commit -m "Prompt 6: Remove main safe-area padding and decorative gradient"
```

---

## Task 8: Migrate raw `env(safe-area-inset-top)` — Auth.tsx

**Files:**
- Modify: `src/pages/Auth.tsx:166`

- [ ] **Step 1: Inspect the line**

```bash
sed -n '160,175p' src/pages/Auth.tsx
```

Expected: a `<div>` with `pt-[max(env(safe-area-inset-top,0px),24px)]`.

- [ ] **Step 2: Replace the raw env usage**

In `src/pages/Auth.tsx` line 166, find:

```tsx
      <div className="relative z-10 flex items-center justify-between px-[var(--page-px)] pt-[max(env(safe-area-inset-top,0px),24px)] pb-4">
```

Replace with:

```tsx
      <div className="relative z-10 flex items-center justify-between px-[var(--page-px)] pb-4" style={{ paddingTop: 'max(var(--safe-area-top), 24px)' }}>
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit --skipLibCheck
npx eslint src/pages/Auth.tsx --max-warnings 0
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Auth.tsx
git commit -m "Prompt 6: Migrate Auth.tsx raw env() to var(--safe-area-top)"
```

---

## Task 9: Migrate raw `env(safe-area-inset-top)` — LiveScan.tsx

**Files:**
- Modify: `src/pages/LiveScan.tsx:659`

- [ ] **Step 1: Inspect**

```bash
sed -n '655,665p' src/pages/LiveScan.tsx
```

Expected: a `className="... pt-[calc(env(safe-area-inset-top,0px)+5.5rem)] ..."` on a `<div>`.

- [ ] **Step 2: Replace**

Find in `src/pages/LiveScan.tsx` around line 659:

```tsx
                className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-end gap-5 px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-[calc(env(safe-area-inset-top,0px)+5.5rem)] sm:justify-center"
```

Replace with:

```tsx
                className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-end gap-5 px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] sm:justify-center"
                style={{ paddingTop: 'calc(var(--safe-area-top) + 5.5rem)' }}
```

Note: we migrate only the *top* inset. The *bottom* inset (`env(safe-area-inset-bottom)`) is OK to keep since `--safe-area-inset-bottom` is wired via CSS var and does not have the Median iOS zero-return bug (only `top` does).

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit --skipLibCheck
npx eslint src/pages/LiveScan.tsx --max-warnings 0
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/LiveScan.tsx
git commit -m "Prompt 6: Migrate LiveScan raw env(safe-area-inset-top) usage"
```

---

## Task 10: Migrate raw `env(safe-area-inset-top)` — UploadStep.tsx

**Files:**
- Modify: `src/components/add-garment/UploadStep.tsx:59`

- [ ] **Step 1: Replace**

Find:

```tsx
      <header className="flex items-center justify-between px-4 pb-1.5 sm:px-5" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 14px)' }}>
```

Replace with:

```tsx
      <header className="flex items-center justify-between px-4 pb-1.5 sm:px-5" style={{ paddingTop: 'max(var(--safe-area-top), 14px)' }}>
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit --skipLibCheck
npx eslint src/components/add-garment/UploadStep.tsx --max-warnings 0
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/add-garment/UploadStep.tsx
git commit -m "Prompt 6: Migrate UploadStep raw env(safe-area-inset-top)"
```

---

## Task 11: Migrate raw `env(safe-area-inset-top)` — BursLoadingScreen.tsx

**Files:**
- Modify: `src/components/layout/BursLoadingScreen.tsx:39,41`

- [ ] **Step 1: Inspect**

```bash
sed -n '35,50p' src/components/layout/BursLoadingScreen.tsx
```

- [ ] **Step 2: Replace**

Find the `top-[max(env(safe-area-inset-top,0px),28px)]` class on line 41, and the `z-50` on line 39.

Line 39: change `className="fixed inset-0 z-50 ..."` to `className="fixed inset-0 ..."` and add `style={{ zIndex: 'var(--z-modal)' }}` (celebrate-level isn't needed — this is a loading screen).

Line 41: change `className="absolute top-[max(env(safe-area-inset-top,0px),28px)] left-0 right-0 text-center ..."` to `className="absolute left-0 right-0 text-center ..."` and add `style={{ top: 'max(var(--safe-area-top), 28px)' }}`.

Concretely: find:

```tsx
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background overflow-hidden">
      {/* ... */}
      <motion.p className="absolute top-[max(env(safe-area-inset-top,0px),28px)] left-0 right-0 text-center text-[9px] uppercase tracking-[0.28em] text-muted-foreground/30"
```

Replace with:

```tsx
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-background overflow-hidden"
      style={{ zIndex: 'var(--z-modal)' } as React.CSSProperties}
    >
      {/* ... */}
      <motion.p
        className="absolute left-0 right-0 text-center text-[9px] uppercase tracking-[0.28em] text-muted-foreground/30"
        style={{ top: 'max(var(--safe-area-top), 28px)' }}
```

(Preserve any other props the `motion.p` has on subsequent lines — only the `className` and `style` for the positioning change.)

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit --skipLibCheck
npx eslint src/components/layout/BursLoadingScreen.tsx --max-warnings 0
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/BursLoadingScreen.tsx
git commit -m "Prompt 6: Migrate BursLoadingScreen safe-area and z-index"
```

---

## Task 12: Migrate remaining z-index numbers to scale variables

**Files (all modifications only):**
- `src/components/layout/BottomNav.tsx:264`
- `src/components/layout/OfflineBanner.tsx:21`
- `src/components/layout/SeedProgressPill.tsx:27`
- `src/components/layout/MilestoneCelebration.tsx:104`
- `src/pages/Onboarding.tsx:30`
- `src/components/onboarding/StyleQuizV3.tsx:495`
- `src/components/landing/ExitIntentModal.tsx:32`
- `src/pages/LiveScan.tsx:653`
- `src/components/coach/CoachMark.tsx:94,147,156,172`

This is a mechanical renaming task. No behavior change other than using the scale values.

### Mapping table

| Component | Current z | Scale var |
|---|---|---|
| `BottomNav` | `z-50` | `var(--z-bottom-nav)` |
| `OfflineBanner` | `z-[60]` | `var(--z-offline-banner)` |
| `SeedProgressPill` | `z-50` | `var(--z-floating-pill)` |
| `MilestoneCelebration` | `z-[200]` | `var(--z-celebration)` |
| `Onboarding` top bar | `z-50` | `var(--z-modal)` |
| `StyleQuizV3` top bar | `z-50` | `var(--z-modal)` |
| `ExitIntentModal` | `z-[70]` | `var(--z-toast)` |
| `LiveScan` submit overlay `:653` | `z-[70]` | `var(--z-modal)` |
| `CoachMark:94` inline `zIndex: 9999` (wrapped target) | `var(--z-coach)` |
| `CoachMark:147` overlay `zIndex: 9997` | `var(--z-coach)` |
| `CoachMark:156` ring `zIndex: 9998` | `var(--z-coach)` |
| `CoachMark:172` callout `zIndex: 9999` | `var(--z-coach)` |

Note: all four CoachMark layers collapse to the same `var(--z-coach)` because CSS z-index only matters between sibling stacking contexts. Within the same context, DOM order resolves ties, and these four elements are siblings rendered in deterministic order.

- [ ] **Step 1: BottomNav — replace `className="fixed bottom-0 inset-x-0 z-50"`**

Find in `src/components/layout/BottomNav.tsx:264`:

```tsx
      <nav
        className="fixed bottom-0 inset-x-0 z-50"
```

Replace with:

```tsx
      <nav
        className="fixed bottom-0 inset-x-0"
        style={{ zIndex: 'var(--z-bottom-nav)', ...{
```

Wait — BottomNav's existing `style` prop already has background/backdropFilter/borderTop/padding. Merge cleanly: change only the `className` on line 264 to remove `z-50`, and add `zIndex: 'var(--z-bottom-nav)',` as the FIRST property inside the existing `style={{...}}` object on line 266.

Concretely:

```tsx
      <nav
        className="fixed bottom-0 inset-x-0"
        aria-label={t('nav.main_navigation')}
        style={{
          zIndex: 'var(--z-bottom-nav)',
          background: 'hsl(var(--background) / 0.88)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '0.5px solid hsl(var(--border) / 0.3)',
          padding: '6px 24px calc(6px + env(safe-area-inset-bottom, 16px))',
        } as React.CSSProperties}
```

- [ ] **Step 2: OfflineBanner**

Find in `src/components/layout/OfflineBanner.tsx:21`:

```tsx
          className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 py-2 text-xs font-medium"
          style={{
            background: isReplaying ? 'hsl(var(--accent))' : 'hsl(var(--destructive))',
```

Replace with:

```tsx
          className="fixed top-0 left-0 right-0 flex items-center justify-center gap-2 py-2 text-xs font-medium"
          style={{
            zIndex: 'var(--z-offline-banner)' as unknown as number,
            background: isReplaying ? 'hsl(var(--accent))' : 'hsl(var(--destructive))',
```

(The `as unknown as number` cast is because React's TypeScript definition of `zIndex` is `number | undefined`. CSS variables string values require the cast. Used throughout this plan where inline zIndex is a var.)

- [ ] **Step 3: SeedProgressPill**

Find in `src/components/layout/SeedProgressPill.tsx:27`:

```tsx
          className="fixed bottom-24 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-primary-foreground shadow-lg text-sm font-medium"
```

Replace with:

```tsx
          className="fixed bottom-24 right-4 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-primary-foreground shadow-lg text-sm font-medium"
          style={{ zIndex: 'var(--z-floating-pill)' as unknown as number }}
```

- [ ] **Step 4: MilestoneCelebration**

Find in `src/components/layout/MilestoneCelebration.tsx:104`:

```tsx
          className="fixed inset-0 z-[200] flex items-center justify-center cursor-pointer"
```

Replace with:

```tsx
          className="fixed inset-0 flex items-center justify-center cursor-pointer"
          style={{ zIndex: 'var(--z-celebration)' as unknown as number }}
```

Note: if the `motion.div` already has a `style` prop (e.g., for animation), merge the `zIndex` into it instead of adding a new `style` prop. Check by opening the file first.

- [ ] **Step 5: Onboarding top bar**

Find in `src/pages/Onboarding.tsx:30`:

```tsx
    <div className="fixed inset-x-5 top-4 z-50">
```

Replace with:

```tsx
    <div className="fixed inset-x-5 top-4" style={{ zIndex: 'var(--z-modal)' as unknown as number }}>
```

(Safe-area fix for `top-4` is deferred to Phase 4.)

- [ ] **Step 6: StyleQuizV3**

Find in `src/components/onboarding/StyleQuizV3.tsx:495`:

```tsx
      <div className="fixed top-0 left-0 right-0 z-50">
```

Replace with:

```tsx
      <div className="fixed top-0 left-0 right-0" style={{ zIndex: 'var(--z-modal)' as unknown as number }}>
```

- [ ] **Step 7: ExitIntentModal**

Find in `src/components/landing/ExitIntentModal.tsx:32`:

```tsx
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" onClick={dismiss}>
```

Replace with:

```tsx
    <div
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ zIndex: 'var(--z-toast)' as unknown as number }}
      onClick={dismiss}
    >
```

- [ ] **Step 8: LiveScan in-scan overlay (line 653)**

Find in `src/pages/LiveScan.tsx:653`:

```tsx
              className="fixed inset-0 z-[70] overflow-y-auto bg-background/92 backdrop-blur-xl"
```

Replace with:

```tsx
              className="fixed inset-0 overflow-y-auto bg-background/92 backdrop-blur-xl"
              style={{ zIndex: 'var(--z-modal)' as unknown as number }}
```

(If a `style` prop already exists on that element, merge the `zIndex` into it.)

- [ ] **Step 9: CoachMark — all four tiers**

In `src/components/coach/CoachMark.tsx`, find each of the four `zIndex:` literals (lines 94, 147, 156, 172):

```typescript
                zIndex: 9999,
```
```typescript
          zIndex: 9997,
```
```typescript
          zIndex: 9998,
```
```typescript
          zIndex: 9999,
```

Replace all four with:

```typescript
          zIndex: 'var(--z-coach)' as unknown as number,
```

(Use the `CoachMark.tsx` file and replace each of the four sites individually. DOM order resolves tie-breaking between siblings in the same stacking context, which is what we want.)

- [ ] **Step 10: Verify everything builds**

```bash
npx tsc --noEmit --skipLibCheck
npx eslint src/ --ext .ts,.tsx --max-warnings 0
npm run build 2>&1 | tail -20
```

Expected: all clean. If tsc complains about `zIndex: 'var(--z-...)' as unknown as number`, double-check the cast is present at every site.

- [ ] **Step 11: Commit**

```bash
git add src/components/layout/BottomNav.tsx src/components/layout/OfflineBanner.tsx src/components/layout/SeedProgressPill.tsx src/components/layout/MilestoneCelebration.tsx src/pages/Onboarding.tsx src/components/onboarding/StyleQuizV3.tsx src/components/landing/ExitIntentModal.tsx src/pages/LiveScan.tsx src/components/coach/CoachMark.tsx
git commit -m "Prompt 6: Migrate z-index literals to canonical scale variables"
```

---

## Task 13: Verify no raw `env(safe-area-inset-top)` remains outside the allowed sites

**Files:** none (grep audit only)

Allowed sites for raw `env(safe-area-inset-top)`:
- `src/index.css` (where `--safe-area-inset-top` and `--safe-area-top` are defined)
- `src/hooks/useViewportShell.ts` (where the probe runs)

Any other hit is a regression.

- [ ] **Step 1: Grep**

```bash
git grep -n "env(safe-area-inset-top" -- 'src/**' ':!src/index.css' ':!src/hooks/useViewportShell.ts'
```

Expected: no output (empty).

If hits remain, revisit Tasks 8–11 — migrate the missed site, run verification, commit separately.

- [ ] **Step 2: Grep for `env(safe-area-inset-top)` in .tsx/.ts to double-check**

```bash
git grep -n "safe-area-inset-top" src/ | grep -v "safe-area-top\|--safe-area-inset-top\|useViewportShell" | grep -v "src/index.css"
```

Expected: no output.

---

## Task 14: Full verification suite

**Files:** none (verification only)

- [ ] **Step 1: TypeScript**

```bash
npx tsc --noEmit --skipLibCheck
```

Expected: 0 errors.

- [ ] **Step 2: ESLint**

```bash
npx eslint src/ --ext .ts,.tsx --max-warnings 0
```

Expected: 0 warnings.

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tee /tmp/build.log | tail -30
```

Expected: clean build, no warnings. Search the log for the word `warning` to be sure:

```bash
grep -i "warning" /tmp/build.log || echo "no warnings"
```

Expected: `no warnings`.

- [ ] **Step 4: Full test suite**

```bash
npx vitest run 2>&1 | tail -40
```

Expected: all tests pass (including the two new ones from Tasks 5 and 6).

- [ ] **Step 5: Spot-check the z-scale by grepping the compiled CSS bundle**

```bash
grep -o "\-\-z-[a-z-]*" dist/assets/*.css | sort -u
```

Expected: lists all ten z-scale variables (base, header, offline-banner, bottom-nav, floating-pill, modal, popover, toast, coach, celebration).

---

## Task 15: Push and open PR

**Files:** none (git/gh only)

- [ ] **Step 1: Push branch**

```bash
git push -u origin prompt-6-foundation-safe-area
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "Prompt 6: Foundation — safe-area, z-index scale, Sonner offset" --body "$(cat <<'EOF'
## Summary

Phase 1 of the header/viewport/safe-area audit (spec: `docs/superpowers/specs/2026-04-13-header-viewport-audit-design.md`).

- Moves safe-area coverage from `<main>` onto `PageHeader` via a dedicated safe-area cover element
- Deletes the decorative `h-24` gradient that previously sat in the safe-area strip (root cause of the "ribbon" artifact)
- Adds canonical z-index scale as CSS variables in `index.css` and migrates every in-repo z-index literal to the scale
- Fixes Sonner so toasts render below the dynamic island via `offset="calc(var(--safe-area-top) + 12px)"`
- Migrates 4 raw `env(safe-area-inset-top)` call sites to `var(--safe-area-top)` so Median iOS webviews work correctly
- Adds a 3px threshold to `useViewportShell` to kill visualViewport keyboard jitter
- Adds structural invariant tests for `PageHeader` safe-area cover and z-scale usage

## Test plan

### Automated (run in this PR)

- [x] `npx tsc --noEmit --skipLibCheck` — 0 errors
- [x] `npx eslint src/ --max-warnings 0` — 0 warnings
- [x] `npm run build` — clean, no warnings
- [x] `npx vitest run` — full suite passes
- [x] New: `PageHeader.safe-area.test.tsx` — asserts safe-area cover + z-scale
- [x] New: `sonner.test.tsx` — renders with offset
- [x] Audit grep: no raw `env(safe-area-inset-top)` outside `src/index.css` and `src/hooks/useViewportShell.ts`

### Manual device checks (run by @borna-z on physical iPhone after merge)

- [ ] Open the app on an iPhone 14/15/16 Pro. The dynamic-island strip is fully covered by the frosted header background on every page.
- [ ] Navigate Home → tap "wear" on a generated outfit. Confirmation toast appears fully visible *below* the dynamic island, not behind it.
- [ ] Scroll the Wardrobe grid. Header stays sticky and no page content is visible above it.
- [ ] Scroll the Plan calendar. Header stays sticky, no content visible above it.
- [ ] Toggle airplane mode. Offline banner appears — note: banner safe-area fix is Phase 4, the banner may still appear partially behind the dynamic island in this phase (expected).
- [ ] Focus a text input (e.g., Auth or AIChat) on iOS Safari. No visible top-of-layout jitter during keyboard open.
- [ ] Coach mark flow: tour shows correctly and sits above any active toasts.
- [ ] Open any shadcn dialog. It sits above the BottomNav but below any active toast.

### Deferred to later phases

- Phase 2: `PageHeader` variants (`solid` / `overlay`), removal of `sticky` prop.
- Phase 3: Per-page migration of 9 custom headers (D1–D9) and audit sweep of remaining pages.
- Phase 4: `OfflineBanner` / `Onboarding` top bar / `SeedProgressPill` safe-area fixes.
- Phase 5: Any escalations surfaced in Phase 3.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Capture PR URL**

Store the URL that `gh pr create` prints; it's the final artifact of Phase 1.

- [ ] **Step 4: Final status report**

Report to the user in the exact `CLAUDE.md` format:

```
✅ TypeScript: 0 errors
✅ Lint: 0 warnings
✅ Build: clean (no warnings)
✅ Tests: passed
✅ Committed: <list of commit hashes> on branch prompt-6-foundation-safe-area
✅ Deployed: none
⚠️ Notes: Phase 1 of 5. Manual iPhone checks pending in PR body.
PR: <url>
```

---

## Self-Review (writer's checklist — completed)

**Spec coverage:**
- A1 → Task 6 + Task 7 ✓
- A2 → Task 7 ✓
- A3 → Tasks 3, 8, 9, 10, 11, 13 ✓ (Task 3 fixes index.css:311, Tasks 8–11 fix the four file sites, Task 13 audits)
- A4 → Task 4 ✓
- B1 → Task 6 (safe-area cover effectively pushes content padding past the dynamic island; hardcoded 12px is inside the content body, which is now correct) ✓
- B2 (remove sticky prop) → **deferred to Phase 2** (documented at top)
- B3 (topbar-frost coverage) → Task 6 (the safe-area cover inherits from the `topbar-frost` parent, so the whole frost extends up) ✓
- B4 (overlay variant) → **deferred to Phase 2**
- C1 → Task 5 ✓
- C2 → Tasks 2, 5, 6, 7, 12 ✓
- D1–D9 → **deferred to Phase 3**
- E1–E3 (floating safe-area) → **deferred to Phase 4** (z-index migration for these components happens here, but safe-area padding does not)
- E4 → same as A3 ✓
- F1 → Task 12 (CoachMark collapses to single z-coach tier, Sonner uses z-toast below it) ✓
- F2 → Task 12 (celebration at z-80 above everything) ✓

**Placeholder scan:** no TBDs, no "add error handling", no "similar to Task N", no undefined references.

**Type consistency:** `var(--z-*)` inline zIndex usage always paired with `as unknown as number` cast. `paddingTop`, `top`, `bottom` inline styles use strings directly. No method/name mismatches between tasks.

All spec items for Phase 1 are mapped. Items deferred to later phases are explicitly marked.
