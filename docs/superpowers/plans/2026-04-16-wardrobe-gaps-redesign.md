# Wardrobe Gaps Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip card wrappers from the Wardrobe Gaps feature and apply the same editorial "Stylist's Pick" design DNA — cardless sections, typography-forward, breathing whitespace — matching the Travel Edit redesign.

**Architecture:** Pure frontend visual rewrite of 4 components plus minor spacing adjustments in the page. No data flow, hook, edge function, DB, or i18n changes. All existing props and interfaces stay identical.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Framer Motion

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/gaps/GapStateViews.tsx` | Rewrite | Remove StateSurface, flatten all 7 state + hero components |
| `src/components/gaps/GapHeroCard.tsx` | Rewrite | Remove card + gradient, flatten on page |
| `src/components/gaps/GapSecondaryCard.tsx` | Rewrite | Convert from 280px scroll card to flat vertical list item |
| `src/components/gaps/GapResultsPanel.tsx` | Modify | Replace horizontal scroll with vertical list, change error banner |
| `src/pages/GarmentGaps.tsx` | Minor | Adjust spacing classes |

**Not touched:** `gapTypes.ts`, `gapRouteState.ts`, `useAdvancedFeatures`, edge functions, DB, i18n files.

---

### Task 1: Rewrite GapStateViews.tsx — Remove StateSurface, Flatten All States

**Files:**
- Modify: `src/components/gaps/GapStateViews.tsx` (full rewrite, same exports)

- [ ] **Step 1: Rewrite the full file**

Replace the entire file content with:

```tsx
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  LockKeyhole,
  Plus,
  Radar,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { WardrobeProgress } from '@/components/discover/WardrobeProgress';
import { AILoadingOverlay } from '@/components/ui/AILoadingOverlay';
import { Button } from '@/components/ui/button';
import { EASE_CURVE } from '@/lib/motion';
import { useLanguage } from '@/contexts/LanguageContext';

/* ── Shared primitives ── */

function StateTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display italic text-[1.3rem] font-medium leading-tight tracking-[-0.02em] text-foreground">
      {children}
    </h2>
  );
}

function StateEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
      {children}
    </p>
  );
}

function StateIcon({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'destructive' }) {
  const toneClass =
    tone === 'destructive'
      ? 'bg-destructive/10 text-destructive'
      : 'bg-secondary/65 text-foreground/70';
  return (
    <div className={`flex size-11 shrink-0 items-center justify-center rounded-[1rem] ${toneClass}`}>
      {children}
    </div>
  );
}

/* ── Intro hero (no card wrapper) ── */

export function GapHero({
  currentCount,
  isUnlocked,
  hasSnapshot,
}: {
  currentCount: number;
  isUnlocked: boolean;
  hasSnapshot: boolean;
}) {
  const { t } = useLanguage();
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_CURVE }}
    >
      <div className="flex items-start gap-4">
        <StateIcon>
          <Radar className="size-5" />
        </StateIcon>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-display italic text-[1.05rem] leading-6 text-foreground/75">
            {t('gaps.hero_description')}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[0.76rem] text-muted-foreground/80">
        <span className="rounded-full border border-border/40 bg-background/60 px-3 py-1.5">
          {t('gaps.pieces_in_wardrobe').replace('{count}', String(currentCount))}
        </span>
        <span className="rounded-full border border-border/40 bg-background/60 px-3 py-1.5">
          {isUnlocked ? t('gaps.gap_analysis_unlocked') : t('gaps.unlocks_at_10')}
        </span>
        {hasSnapshot ? (
          <span className="rounded-full border border-border/40 bg-background/60 px-3 py-1.5">
            {t('gaps.previous_scan_ready')}
          </span>
        ) : null}
      </div>
    </motion.section>
  );
}

/* ── State views (all flat — no card wrappers) ── */

export function GapLockedState() {
  const { t } = useLanguage();
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_CURVE }}
      className="mt-5 border-t border-border/40 pt-5"
    >
      <div className="flex items-start gap-4">
        <StateIcon>
          <LockKeyhole className="size-5" />
        </StateIcon>
        <div className="space-y-2">
          <StateEyebrow>{t('gaps.locked_label')}</StateEyebrow>
          <StateTitle>{t('gaps.locked_title')}</StateTitle>
          <p className="max-w-[36rem] text-[0.94rem] leading-6 text-muted-foreground">
            {t('gaps.locked_desc')}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <WardrobeProgress compact />
      </div>
    </motion.section>
  );
}

export function GapReadyState({
  onScan,
}: {
  onScan: () => void;
}) {
  const { t } = useLanguage();
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_CURVE }}
      className="mt-5 border-t border-border/40 pt-5"
    >
      <div className="flex items-start gap-4">
        <StateIcon>
          <Sparkles className="size-5" />
        </StateIcon>
        <div className="space-y-2">
          <StateEyebrow>{t('gaps.ready_label')}</StateEyebrow>
          <StateTitle>{t('gaps.ready_title')}</StateTitle>
          <p className="max-w-[36rem] text-[0.94rem] leading-6 text-muted-foreground">
            {t('gaps.ready_desc')}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-[0.76rem] text-muted-foreground/80">
        <span className="rounded-full border border-border/40 bg-background/60 px-3 py-1.5">
          {t('gaps.chip_categories')}
        </span>
        <span className="rounded-full border border-border/40 bg-background/60 px-3 py-1.5">
          {t('gaps.chip_color')}
        </span>
        <span className="rounded-full border border-border/40 bg-background/60 px-3 py-1.5">
          {t('gaps.chip_shopping')}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2.5">
        <Button onClick={onScan} className="rounded-full px-5">
          <Search className="size-4" />
          {t('gaps.run_scan')}
        </Button>
      </div>
    </motion.section>
  );
}

export function GapAutorunState() {
  const { t } = useLanguage();
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_CURVE }}
      className="mt-5 border-t border-border/40 pt-5"
    >
      <div className="flex items-start gap-4">
        <StateIcon>
          <ArrowRight className="size-5" />
        </StateIcon>
        <div className="space-y-2">
          <StateEyebrow>{t('gaps.autorun_label')}</StateEyebrow>
          <StateTitle>{t('gaps.autorun_title')}</StateTitle>
          <p className="max-w-[36rem] text-[0.94rem] leading-6 text-muted-foreground">
            {t('gaps.autorun_desc')}
          </p>
        </div>
      </div>
    </motion.section>
  );
}

export function GapLoadingState() {
  const { t } = useLanguage();
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_CURVE }}
      className="mt-5 border-t border-border/40 pt-5"
    >
      <div className="mb-5 space-y-2">
        <StateEyebrow>{t('gaps.scanning_label')}</StateEyebrow>
        <StateTitle>{t('gaps.scanning_title')}</StateTitle>
        <p className="max-w-[36rem] text-[0.94rem] leading-6 text-muted-foreground">
          {t('gaps.scanning_desc')}
        </p>
      </div>

      <AILoadingOverlay
        variant="card"
        tone="warm"
        phases={[
          { icon: Search, label: t('gaps.scanning_phase1'), duration: 2200 },
          { icon: Sparkles, label: t('gaps.scanning_phase2'), duration: 2200 },
          { icon: ShoppingBag, label: t('gaps.scanning_phase3'), duration: 0 },
        ]}
        subtitle={t('gaps.scanning_subtitle')}
        showSkeletons={3}
        className="border-none bg-background/55 p-0 shadow-none"
      />
    </motion.section>
  );
}

export function GapErrorState({
  onRetry,
}: {
  onRetry: () => void;
}) {
  const { t } = useLanguage();
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_CURVE }}
      className="mt-5 border-t border-border/40 pt-5"
    >
      <div className="flex items-start gap-4">
        <StateIcon tone="destructive">
          <AlertCircle className="size-5" />
        </StateIcon>
        <div className="space-y-2">
          <StateEyebrow>{t('gaps.error_label')}</StateEyebrow>
          <StateTitle>{t('gaps.error_title')}</StateTitle>
          <p className="max-w-[36rem] text-[0.94rem] leading-6 text-muted-foreground">
            {t('gaps.error_desc')}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2.5">
        <Button onClick={onRetry} className="rounded-full px-5">
          <RefreshCw className="size-4" />
          {t('gaps.retry_scan')}
        </Button>
      </div>
    </motion.section>
  );
}

export function GapInsufficientWardrobeState({
  currentCount,
  requiredCount,
}: {
  currentCount?: number;
  requiredCount?: number;
}) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const current = currentCount ?? 0;
  const required = requiredCount ?? 5;
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_CURVE }}
      className="mt-5 border-t border-border/40 pt-5"
    >
      <div className="flex items-start gap-4">
        <StateIcon>
          <ShoppingBag className="size-5" />
        </StateIcon>
        <div className="space-y-2">
          <StateEyebrow>{`${current}/${required}`}</StateEyebrow>
          <StateTitle>{t('gaps.insufficient_title')}</StateTitle>
          <p className="max-w-[36rem] text-[0.94rem] leading-6 text-muted-foreground">
            {t('gaps.insufficient_desc')}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2.5">
        <Button
          onClick={() => navigate('/wardrobe/add')}
          className="rounded-full px-5"
        >
          <Plus className="size-4" />
          {t('gaps.insufficient_cta')}
        </Button>
      </div>
    </motion.section>
  );
}

export function GapNoGapsState({
  onRefresh,
}: {
  onRefresh: () => void;
}) {
  const { t } = useLanguage();
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_CURVE }}
      className="mt-5 border-t border-border/40 pt-5"
    >
      <div className="flex items-start gap-4">
        <StateIcon>
          <ShoppingBag className="size-5" />
        </StateIcon>
        <div className="space-y-2">
          <StateEyebrow>{t('gaps.balanced_label')}</StateEyebrow>
          <StateTitle>{t('gaps.no_gaps_title')}</StateTitle>
          <p className="max-w-[36rem] text-[0.94rem] leading-6 text-muted-foreground">
            {t('gaps.no_gaps_desc')}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2.5">
        <Button onClick={onRefresh} variant="outline" className="rounded-full px-5">
          <RefreshCw className="size-4" />
          {t('gaps.run_fresh_scan')}
        </Button>
      </div>
    </motion.section>
  );
}
```

Key changes:
- Deleted `StateSurface` component — replaced with `motion.section` + `mt-5 border-t border-border/40 pt-5`
- `GapHero`: removed `rounded-[1.25rem] border border-border/40 bg-card px-5 py-6` card classes
- `GapLockedState`: removed card, `WardrobeProgress` no longer inside a card wrapper
- `GapReadyState`: info chips changed from `rounded-[1.25rem] p-4` grid cards to `rounded-full px-3 py-1.5` inline pills
- All other states: same pattern — `<StateSurface>` → `<motion.section className="mt-5 border-t border-border/40 pt-5">`
- `StateTitle`, `StateEyebrow`, `StateIcon`: unchanged

- [ ] **Step 2: Run typecheck + lint + build**

```bash
npx tsc --noEmit --skipLibCheck && npx eslint src/components/gaps/GapStateViews.tsx --max-warnings 0 && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/gaps/GapStateViews.tsx
git commit -m "Prompt 42: Remove StateSurface card wrappers, flatten all gap state views"
```

---

### Task 2: Flatten GapHeroCard

**Files:**
- Modify: `src/components/gaps/GapHeroCard.tsx` (full rewrite, same exports)

- [ ] **Step 1: Rewrite the file**

Replace entire file with:

```tsx
import { motion } from 'framer-motion';
import { ExternalLink, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { EASE_CURVE } from '@/lib/motion';
import type { GapResult } from './gapTypes';
import type { GarmentBasic } from '@/hooks/useGarmentsByIds';

interface GapHeroCardProps {
  gap: GapResult;
  garmentMap: Map<string, GarmentBasic>;
}

function openGoogle(query: string) {
  window.open(
    `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    '_blank',
    'noopener',
  );
}

export function GapHeroCard({ gap, garmentMap }: GapHeroCardProps) {
  const { t } = useLanguage();
  const pairingGarments = (gap.pairing_garment_ids ?? [])
    .map((id) => garmentMap.get(id))
    .filter((g): g is GarmentBasic => !!g)
    .slice(0, 3);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_CURVE }}
      className="mt-2"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent/70">
        {t('gaps.hero_eyebrow') || 'Your next best purchase'}
      </p>

      <h3 className="mt-3 font-display italic text-[1.4rem] leading-tight tracking-[-0.02em] text-foreground">
        {gap.item}
      </h3>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.78rem] text-muted-foreground">
        <span className="rounded-full border border-border/40 bg-background/60 px-3 py-1">
          {gap.category}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/60 px-3 py-1">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full border border-border/60"
            style={{ backgroundColor: gap.color }}
          />
          {gap.color}
        </span>
      </div>

      {pairingGarments.length > 0 ? (
        <div className="mt-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
            {t('gaps.pairs_with') || 'Pairs with'}
          </p>
          <div className="mt-2 flex items-center gap-2">
            {pairingGarments.map((g) => (
              <div
                key={g.id}
                className="relative h-16 w-16 overflow-hidden rounded-[0.9rem] border border-border/40 bg-muted/30"
              >
                <LazyImageSimple
                  imagePath={getPreferredGarmentImagePath(g)}
                  alt={g.title}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
            <div className="flex h-16 w-16 items-center justify-center rounded-[0.9rem] border border-dashed border-accent/50 bg-accent/5 text-accent/70">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex items-baseline gap-2">
        <span className="font-display italic text-[1.8rem] leading-none text-accent">
          +{gap.new_outfits}
        </span>
        <span className="text-[0.82rem] text-muted-foreground">
          {t('gaps.new_outfits') || 'new outfit combinations'}
        </span>
      </div>

      {gap.key_insight ? (
        <p className="mt-4 max-w-[32rem] font-display italic text-[13px] leading-6 text-foreground/55">
          {gap.key_insight}
        </p>
      ) : (
        <p className="mt-4 max-w-[32rem] text-[0.9rem] leading-6 text-muted-foreground">
          {gap.reason}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <span className="rounded-full border border-border/40 bg-background/60 px-3 py-1.5 text-[0.78rem] text-muted-foreground">
          {gap.price_range}
        </span>
        <Button
          onClick={() => openGoogle(gap.search_query)}
          className="ml-auto rounded-full px-5"
        >
          <Search className="mr-1.5 h-4 w-4" />
          {t('gaps.find_this') || 'Find this'}
          <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </motion.article>
  );
}
```

Key changes:
- Removed: `rounded-[1.25rem] border border-border/40 bg-card p-5` card wrapper
- Removed: `<div aria-hidden>` radial gradient overlay
- Removed: inner `<div className="relative">` wrapper
- Added: `className="mt-2"` for spacing
- All inner content identical

- [ ] **Step 2: Run typecheck + lint + build**

```bash
npx tsc --noEmit --skipLibCheck && npx eslint src/components/gaps/GapHeroCard.tsx --max-warnings 0 && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/gaps/GapHeroCard.tsx
git commit -m "Prompt 42: Flatten GapHeroCard — remove card wrapper and gradient"
```

---

### Task 3: Rewrite GapSecondaryCard as Vertical List Item

**Files:**
- Modify: `src/components/gaps/GapSecondaryCard.tsx` (full rewrite, same exports)

- [ ] **Step 1: Rewrite the file**

Replace entire file with:

```tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { EASE_CURVE } from '@/lib/motion';
import { hapticLight } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import type { GapResult } from './gapTypes';

interface GapSecondaryCardProps {
  gap: GapResult;
  index: number;
}

function openGoogle(query: string) {
  window.open(
    `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    '_blank',
    'noopener',
  );
}

export function GapSecondaryCard({ gap, index }: GapSecondaryCardProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.04, ease: EASE_CURVE }}
      className="border-t border-border/20 pt-4 mt-4"
    >
      {/* Top row: item name + outfit count */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.92rem] font-medium leading-tight text-foreground">
            {gap.item}
          </p>
          <p className="mt-1 line-clamp-2 text-[0.78rem] leading-5 text-foreground/60">
            {gap.reason}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className="font-display italic text-[1.1rem] text-accent">
            +{gap.new_outfits}
          </span>
          <p className="text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground/70">
            {t('gaps.outfits_short') || 'outfits'}
          </p>
        </div>
      </div>

      {/* Meta row */}
      <div className="mt-2 flex items-center gap-2 text-[0.72rem] text-muted-foreground">
        <span className="rounded-full border border-border/40 bg-background/60 px-2.5 py-0.5">
          {gap.category}
        </span>
        <span
          aria-hidden
          className="h-2 w-2 rounded-full border border-border/60"
          style={{ backgroundColor: gap.color }}
        />
        <span>{gap.color}</span>
        <span className="text-muted-foreground/50">·</span>
        <span>{gap.price_range}</span>
      </div>

      {/* Actions row */}
      <div className="mt-2.5 flex items-center justify-between">
        {gap.key_insight ? (
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setOpen((v) => !v);
            }}
            className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-accent/70"
          >
            {t('gaps.why_this') || 'Why this?'}
            <ChevronDown
              className={cn(
                'h-3 w-3 transition-transform',
                open ? 'rotate-180' : '',
              )}
            />
          </button>
        ) : (
          <span />
        )}
        <Button
          onClick={() => openGoogle(gap.search_query)}
          variant="outline"
          size="sm"
          className="rounded-full px-3.5"
        >
          <ExternalLink className="mr-1 h-3.5 w-3.5" />
          {t('gaps.find_this') || 'Find this'}
        </Button>
      </div>

      {/* Expandable insight */}
      {gap.key_insight ? (
        <AnimatePresence initial={false}>
          {open ? (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: EASE_CURVE }}
              className="mt-2 font-display italic text-[12px] leading-5 text-foreground/70"
            >
              {gap.key_insight}
            </motion.p>
          ) : null}
        </AnimatePresence>
      ) : null}
    </motion.article>
  );
}
```

Key changes:
- Removed: `w-[280px] shrink-0 snap-start` fixed-width scroll card
- Removed: `rounded-[1.25rem] border border-border/40 bg-card p-4` card wrapper
- Removed: `flex-col gap-3` card layout
- Added: `border-t border-border/20 pt-4 mt-4` divider
- Layout restructured: item name + reason left, outfit count right, meta inline, actions inline
- Stagger capped at `Math.min(index, 8)`
- `index` prop changed from optional (`index?: number`) to required (`index: number`)
- Price moved inline to meta row (was separate footer)

- [ ] **Step 2: Run typecheck + lint + build**

```bash
npx tsc --noEmit --skipLibCheck && npx eslint src/components/gaps/GapSecondaryCard.tsx --max-warnings 0 && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/gaps/GapSecondaryCard.tsx
git commit -m "Prompt 42: Rewrite GapSecondaryCard as flat vertical list item"
```

---

### Task 4: Update GapResultsPanel — Vertical List + Error Banner

**Files:**
- Modify: `src/components/gaps/GapResultsPanel.tsx`

- [ ] **Step 1: Rewrite the file**

Replace entire file with:

```tsx
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StaleIndicator } from '@/components/ui/StaleIndicator';
import { EASE_CURVE } from '@/lib/motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGarmentsByIds, type GarmentBasic } from '@/hooks/useGarmentsByIds';
import type { GapResult } from '@/components/gaps/gapTypes';
import { GapHeroCard } from './GapHeroCard';
import { GapSecondaryCard } from './GapSecondaryCard';

interface GapResultsPanelProps {
  analyzedAt: string | null;
  hasRefreshError?: boolean;
  onRefresh: () => void;
  results: GapResult[];
}

export function GapResultsPanel({
  analyzedAt,
  hasRefreshError,
  onRefresh,
  results,
}: GapResultsPanelProps) {
  const { t } = useLanguage();

  const pairingIds = useMemo(() => {
    const set = new Set<string>();
    for (const gap of results) {
      for (const id of gap.pairing_garment_ids ?? []) set.add(id);
    }
    return Array.from(set);
  }, [results]);

  const { data: pairingGarments } = useGarmentsByIds(pairingIds);
  const garmentMap = useMemo(
    () => new Map<string, GarmentBasic>((pairingGarments ?? []).map((g) => [g.id, g])),
    [pairingGarments],
  );

  if (results.length === 0) return null;

  const [featured, ...rest] = results;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_CURVE }}
      className="mt-5 border-t border-border/40 pt-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
            {t('gaps.results_label')}
          </p>
          <h2 className="mt-1 font-display italic text-[1.3rem] tracking-[-0.02em] text-foreground">
            {t('gaps.results_title')}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StaleIndicator updatedAt={analyzedAt} />
          <Button onClick={onRefresh} variant="outline" className="rounded-full px-4">
            <RefreshCw className="size-4" />
            {t('gaps.refresh_scan')}
          </Button>
        </div>
      </div>

      {hasRefreshError ? (
        <div className="mt-3 border-l-2 border-destructive/40 py-2 pl-3 text-[0.88rem] text-foreground">
          {t('gaps.refresh_error')}
        </div>
      ) : null}

      <GapHeroCard gap={featured} garmentMap={garmentMap} />

      {rest.length > 0 ? (
        <div>
          {rest.map((gap, idx) => (
            <GapSecondaryCard key={`${idx}-${gap.search_query}`} gap={gap} index={idx} />
          ))}
        </div>
      ) : null}
    </motion.section>
  );
}
```

Key changes:
- Added: `mt-5 border-t border-border/40 pt-5` on the section (consistent with state views)
- Removed: `space-y-5` class (spacing now handled by individual components)
- Error banner: changed from `rounded-[1.2rem] border border-destructive/20 bg-destructive/5 px-4 py-3` to `border-l-2 border-destructive/40 py-2 pl-3`
- Removed: horizontal scroll container (`-mx-5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden` + `flex snap-x snap-mandatory gap-3 px-5`)
- Replaced with: simple `<div>` containing vertical `GapSecondaryCard` items

- [ ] **Step 2: Run typecheck + lint + build**

```bash
npx tsc --noEmit --skipLibCheck && npx eslint src/components/gaps/GapResultsPanel.tsx --max-warnings 0 && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/gaps/GapResultsPanel.tsx
git commit -m "Prompt 42: Replace horizontal scroll with vertical list, editorial error banner"
```

---

### Task 5: Final Verification + PR

- [ ] **Step 1: Run full QA suite**

```bash
npx tsc --noEmit --skipLibCheck
npx eslint src/ --ext .ts,.tsx --max-warnings 0
npm run build
npx vitest run
```

Expected: 0 tsc errors, 0 lint warnings, clean build, all tests pass.

- [ ] **Step 2: Create branch, push, create PR**

```bash
git checkout -b prompt-42-wardrobe-gaps-redesign main
git cherry-pick <task-1-hash> <task-2-hash> <task-3-hash> <task-4-hash>
git push origin prompt-42-wardrobe-gaps-redesign
gh pr create --title "Prompt 42: Wardrobe gaps editorial redesign" --body "$(cat <<'EOF'
## What changed

- **GapStateViews**: Removed StateSurface card wrappers from all 7 state + hero components. Flat sections with border-t dividers.
- **GapHeroCard**: Removed card wrapper and radial gradient. Hero gap now breathes on the page.
- **GapSecondaryCard**: Converted from 280px horizontal scroll cards to flat vertical list items with dividers.
- **GapResultsPanel**: Replaced horizontal scroll with vertical list. Error banner changed to left-border accent.

## What did NOT change

- No data flow, hook, or edge function changes
- No DB migrations
- No i18n changes (feature already fully internationalized)
- All component prop interfaces identical
- gapTypes, gapRouteState unchanged

## Test plan

- [ ] TypeScript: 0 errors
- [ ] Lint: 0 warnings
- [ ] Build: clean
- [ ] Tests: all pass
- [ ] Manual: all 8 view states render correctly
- [ ] Manual: hero gap displays with pairing thumbnails
- [ ] Manual: secondary gaps expand "Why this?" insight
- [ ] Manual: "Find this" opens Google search
- [ ] Manual: light + dark mode visual check
EOF
)"
```

- [ ] **Step 3: Report back**

```
✅ TypeScript: 0 errors
✅ Lint: 0 warnings
✅ Build: clean (no warnings)
✅ Tests: [passed / not applicable]
✅ Committed: [hash] on branch prompt-42-wardrobe-gaps-redesign
✅ Deployed: none
⚠️ Notes: [anything unexpected, or "none"]
PR: [URL]
```
