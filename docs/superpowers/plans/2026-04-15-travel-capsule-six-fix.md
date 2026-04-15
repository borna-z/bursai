# Travel Capsule Six-Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship six interlocked fixes to the BURS Travel Capsule feature in one atomic PR: cardless wizard layout, user-controlled garment selection, graceful partial results, bottom-pinned action bar, hidden "Try this" button in capsule context, and full capsule persistence.

**Architecture:** Frontend (TypeScript/React/Vite), Supabase edge function (Deno), PostgreSQL schema already in place (no migration). Follows BURS conventions: Playfair Display italic for display headlines, `label-editorial` eyebrows, `border-border/40` dividers, `hapticLight()` on taps, `EASE_CURVE` motion. TDD-first for the new `GarmentSelectionPanel` and all mutation helpers; surgical edits for existing components.

**Tech Stack:** React 18, TypeScript 5.8, Vitest + React Testing Library, Tailwind, Framer Motion, TanStack Query, Supabase JS v2, Deno (edge function).

**Spec:** `docs/superpowers/specs/2026-04-15-travel-capsule-six-fix-design.md`

---

## Preflight

### Task 0: Confirm clean starting state

**Files:** none (verification only)

- [ ] **Step 1: Verify working directory and branch**

Run:
```
cd C:\Users\borna\OneDrive\Desktop\BZ\Burs\bursai-working
git status
git branch --show-current
```
Expected: working tree clean, branch `prompt-37-travel-capsule-fix-plan` (already contains the spec). If not, `git checkout prompt-37-travel-capsule-fix-plan && git pull origin prompt-37-travel-capsule-fix-plan`.

- [ ] **Step 2: Create the implementation branch**

Run:
```
git checkout main
git pull origin main
git checkout -b prompt-38-travel-capsule-six-fix main
```

- [ ] **Step 3: Baseline TypeScript + lint**

Run:
```
npx tsc --noEmit --skipLibCheck
npx eslint src/ --ext .ts,.tsx --max-warnings 0
```
Expected: both pass. If either fails before any changes, fix or record the unrelated breakage before continuing.

---

## Phase A — Types, new panel component, hook state

### Task 1: Extend `types.ts` with `GarmentSelection` type

**Files:**
- Modify: `src/components/travel/types.ts`

- [ ] **Step 1: Add the type**

At the end of the file (after the existing exports), append:

```ts
/**
 * Per-category garment count override for the capsule generator.
 * Keys are garment category slugs (e.g. "top", "bottom", "shoes"),
 * values are the max number of items from that category to send to the AI.
 * `null` elsewhere in the app means "use defaults" (send everything, capped
 * by the 150-item safety ceiling).
 */
export type GarmentSelection = Record<string, number>;
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```
git add src/components/travel/types.ts
git commit -m "Prompt 38: Add GarmentSelection type for per-category overrides"
```

---

### Task 2: Create the `GarmentSelectionPanel` component (TDD)

**Files:**
- Create: `src/components/travel/GarmentSelectionPanel.tsx`
- Create: `src/components/travel/__tests__/GarmentSelectionPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/travel/__tests__/GarmentSelectionPanel.test.tsx`:

```tsx
import type { PropsWithChildren } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GarmentSelectionPanel } from '../GarmentSelectionPanel';

vi.mock('framer-motion', () => {
  const motionElement = ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => (
    <div {...props}>{children}</div>
  );
  return {
    AnimatePresence: ({ children }: PropsWithChildren) => <>{children}</>,
    motion: new Proxy({}, { get: () => motionElement }),
  };
});

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k }),
}));

vi.mock('@/lib/haptics', () => ({ hapticLight: vi.fn() }));

const garments = [
  { id: 't1', title: 'Tee', category: 'top', image_path: '' },
  { id: 't2', title: 'Tee 2', category: 'top', image_path: '' },
  { id: 't3', title: 'Tee 3', category: 'top', image_path: '' },
  { id: 'b1', title: 'Jeans', category: 'bottom', image_path: '' },
  { id: 'b2', title: 'Jeans 2', category: 'bottom', image_path: '' },
  { id: 's1', title: 'Sneakers', category: 'shoes', image_path: '' },
];

describe('GarmentSelectionPanel', () => {
  it('starts collapsed and shows the summary', () => {
    render(
      <GarmentSelectionPanel
        allGarments={garments}
        value={null}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/using 6 of 6 garments/i)).toBeInTheDocument();
    // The sliders should NOT be visible before expanding.
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('expands when the header is clicked and shows one slider per non-empty category', () => {
    render(
      <GarmentSelectionPanel
        allGarments={garments}
        value={null}
        onChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /customize selection/i }));
    const sliders = screen.getAllByRole('slider');
    // top, bottom, shoes → 3 sliders
    expect(sliders).toHaveLength(3);
  });

  it('omits categories with zero items', () => {
    const small = [{ id: 't1', title: 'Tee', category: 'top', image_path: '' }];
    render(
      <GarmentSelectionPanel
        allGarments={small}
        value={null}
        onChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /customize selection/i }));
    expect(screen.getAllByRole('slider')).toHaveLength(1);
  });

  it('calls onChange with the full distribution when a slider is moved', () => {
    const onChange = vi.fn();
    render(
      <GarmentSelectionPanel
        allGarments={garments}
        value={null}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /customize selection/i }));
    const [topSlider] = screen.getAllByRole('slider');
    fireEvent.change(topSlider, { target: { value: '1' } });
    expect(onChange).toHaveBeenLastCalledWith({ top: 1, bottom: 2, shoes: 1 });
  });

  it('shows the clamped warning when the running total exceeds 150', () => {
    const many = Array.from({ length: 200 }, (_, i) => ({
      id: `t${i}`,
      title: `Tee ${i}`,
      category: 'top',
      image_path: '',
    }));
    render(
      <GarmentSelectionPanel
        allGarments={many}
        value={null}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/using 150 of 200 garments/i)).toBeInTheDocument();
  });

  it('resets to defaults when Reset is clicked', () => {
    const onChange = vi.fn();
    render(
      <GarmentSelectionPanel
        allGarments={garments}
        value={{ top: 1, bottom: 1, shoes: 1 }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /customize selection/i }));
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run:
```
npx vitest run src/components/travel/__tests__/GarmentSelectionPanel.test.tsx
```
Expected: FAIL with "Cannot find module '../GarmentSelectionPanel'".

- [ ] **Step 3: Implement the component**

Create `src/components/travel/GarmentSelectionPanel.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import type { GarmentSelection } from './types';

const GARMENT_CEILING = 150;

const CATEGORY_ORDER = ['top', 'bottom', 'dress', 'shoes', 'outerwear', 'accessory'];

function normalizeCategory(raw: string | undefined): string {
  const c = (raw ?? 'other').toLowerCase();
  if (c.includes('top') || c.includes('shirt') || c.includes('blouse') || c.includes('sweater') || c.includes('t-shirt')) return 'top';
  if (c.includes('bottom') || c.includes('pant') || c.includes('jean') || c.includes('skirt') || c.includes('short')) return 'bottom';
  if (c.includes('dress')) return 'dress';
  if (c.includes('shoe') || c.includes('boot') || c.includes('sneaker') || c.includes('sandal')) return 'shoes';
  if (c.includes('outer') || c.includes('coat') || c.includes('jacket') || c.includes('blazer')) return 'outerwear';
  if (c.includes('accessory') || c.includes('bag') || c.includes('belt') || c.includes('hat') || c.includes('scarf')) return 'accessory';
  return 'other';
}

function prettyLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

interface Garment {
  id: string;
  title: string;
  category: string;
  image_path?: string;
}

interface GarmentSelectionPanelProps {
  allGarments: Garment[];
  value: GarmentSelection | null;
  onChange: (next: GarmentSelection | null) => void;
}

export function GarmentSelectionPanel({ allGarments, value, onChange }: GarmentSelectionPanelProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  // Count per normalized category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of allGarments) {
      const c = normalizeCategory(g.category);
      counts[c] = (counts[c] ?? 0) + 1;
    }
    return counts;
  }, [allGarments]);

  const orderedCategories = useMemo(() => {
    const known = CATEGORY_ORDER.filter((c) => (categoryCounts[c] ?? 0) > 0);
    const extras = Object.keys(categoryCounts)
      .filter((c) => !CATEGORY_ORDER.includes(c) && c !== 'other')
      .sort();
    const others = categoryCounts.other ? ['other'] : [];
    return [...known, ...extras, ...others];
  }, [categoryCounts]);

  // Current slider values derive from `value` OR fall back to the full count of each category.
  const currentValues = useMemo<Record<string, number>>(() => {
    const defaults: Record<string, number> = {};
    for (const c of orderedCategories) defaults[c] = categoryCounts[c] ?? 0;
    if (!value) return defaults;
    const merged: Record<string, number> = { ...defaults };
    for (const [k, v] of Object.entries(value)) {
      if (merged[k] != null) merged[k] = Math.min(v, categoryCounts[k] ?? v);
    }
    return merged;
  }, [value, orderedCategories, categoryCounts]);

  const totalGarments = allGarments.length;
  const rawSelected = orderedCategories.reduce((sum, c) => sum + (currentValues[c] ?? 0), 0);
  const clampedSelected = Math.min(rawSelected, GARMENT_CEILING);
  const capsAt150 = rawSelected > GARMENT_CEILING || totalGarments > GARMENT_CEILING;

  const emitChange = (nextValues: Record<string, number>) => {
    // If nextValues matches the full-count defaults, send null (= use defaults).
    const isDefault = orderedCategories.every(
      (c) => nextValues[c] === (categoryCounts[c] ?? 0),
    );
    if (isDefault) {
      onChange(null);
      return;
    }
    // Otherwise send only the non-zero overrides for categories that have items.
    const cleaned: GarmentSelection = {};
    for (const c of orderedCategories) cleaned[c] = nextValues[c] ?? 0;
    onChange(cleaned);
  };

  const handleSliderChange = (category: string, raw: number) => {
    const next = { ...currentValues, [category]: raw };
    emitChange(next);
  };

  const handleReset = () => {
    hapticLight();
    onChange(null);
  };

  const summary = t('capsule.using_x_of_y')
    ? t('capsule.using_x_of_y').replace('{actual}', String(capsAt150 ? GARMENT_CEILING : clampedSelected)).replace('{total}', String(totalGarments))
    : `Using ${capsAt150 ? GARMENT_CEILING : clampedSelected} of ${totalGarments} garments`;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => {
          hapticLight();
          setOpen((v) => !v);
        }}
        className="flex w-full items-center justify-between py-1 text-left"
        aria-expanded={open}
      >
        <span className="label-editorial">
          {t('capsule.customize_selection') || 'Customize selection'}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            open ? 'rotate-180' : '',
          )}
        />
      </button>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {summary}
      </p>

      {open ? (
        <div className="space-y-4 pt-1">
          {orderedCategories.map((category) => {
            const max = categoryCounts[category] ?? 0;
            const current = currentValues[category] ?? 0;
            return (
              <div key={category} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {prettyLabel(category)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {current} of {max}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={max}
                  value={current}
                  onChange={(e) => handleSliderChange(category, Number(e.target.value))}
                  className="h-1 w-full accent-accent"
                  aria-label={`${prettyLabel(category)} count`}
                />
              </div>
            );
          })}
          {capsAt150 ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('capsule.cap_warning') || 'Maximum 150 — reduce a category to send more.'}
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-medium text-accent underline-offset-2 hover:underline"
          >
            {t('capsule.reset') || 'Reset'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/travel/__tests__/GarmentSelectionPanel.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```
git add src/components/travel/GarmentSelectionPanel.tsx src/components/travel/__tests__/GarmentSelectionPanel.test.tsx
git commit -m "Prompt 38: Add GarmentSelectionPanel with per-category sliders + tests"
```

---

### Task 3: Add `garmentSelection` state to `useTravelCapsule`

**Files:**
- Modify: `src/components/travel/useTravelCapsule.ts`

- [ ] **Step 1: Import the new type**

In `src/components/travel/useTravelCapsule.ts`, update the type-only import block (lines 20-27) to include `GarmentSelection`:

```ts
import type {
  CapsuleResult,
  Companion,
  GarmentSelection,
  LuggageType,
  OccasionId,
  StylePreference,
  VibeId,
} from './types';
```

- [ ] **Step 2: Add the state**

Immediately after the existing `const [occasions, setOccasions] = useState<OccasionId[]>([]);` (currently line 78), add:

```ts
  const [garmentSelection, setGarmentSelection] = useState<GarmentSelection | null>(null);
```

- [ ] **Step 3: Compute actualSelectedCount for loading text**

Near the other `useMemo`s (below `planningLookCount`, currently around line 129), add:

```ts
  const GARMENT_CEILING = 150;
  const actualSelectedCount = useMemo(() => {
    const total = allGarments?.length ?? 0;
    if (garmentSelection) {
      const sum = Object.values(garmentSelection).reduce((a, b) => a + b, 0);
      return Math.min(sum, GARMENT_CEILING, total);
    }
    return Math.min(total, GARMENT_CEILING);
  }, [allGarments, garmentSelection]);
```

- [ ] **Step 4: Update the loading text phases**

Replace the existing `travelCardPhases` `useMemo` (currently around lines 131-136) with:

```ts
  const travelCardPhases = useMemo(() => [
    {
      icon: Shirt,
      label: `Scanning ${actualSelectedCount} of your ${allGarments?.length ?? 0} garments`,
      duration: 15000,
    },
    { icon: Globe, label: `Finding combinations for ${destination || 'your destination'}`, duration: 15000 },
    { icon: Package, label: 'Building your capsule', duration: 15000 },
    { icon: SlidersHorizontal, label: `Optimizing ${planningLookCount || 0} looks`, duration: 0 },
  ], [actualSelectedCount, allGarments?.length, destination, planningLookCount]);
```

- [ ] **Step 5: Thread `garment_selection` into the edge function request**

Inside `handleGenerate`'s `invokeEdgeFunction` call, add `garment_selection: garmentSelection ?? undefined,` immediately below the existing `locale: userLocale,` line (currently line 404):

```ts
          locale: userLocale,
          garment_selection: garmentSelection ?? undefined,
        },
      });
```

Also add `garmentSelection` to the `useCallback` dependency array at the end of `handleGenerate` (currently line 436):

```ts
  }, [destination, dateRange, weatherForecast, lookupWeather, profile, locale, tripDays, vibe, occasions, luggageType, companions, stylePreference, outfitsPerDay, mustHaveItems, minimizeItems, includeTravelDays, t, setResult, saveCapsuleToDb, garmentSelection]);
```

- [ ] **Step 6: Export the state in the return object**

Inside the return block (currently around line 538, after `occasions, setOccasions,`), add:

```ts
    garmentSelection, setGarmentSelection,
```

- [ ] **Step 7: TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS (both the new identifier and the updated signature compile).

- [ ] **Step 8: Commit**

```
git add src/components/travel/useTravelCapsule.ts
git commit -m "Prompt 38: Thread garmentSelection state through useTravelCapsule"
```

---

## Phase B — Wizard rewrite: cardless layout + selection panel

### Task 4: Thread `garmentSelection` props through `TravelWizard`

**Files:**
- Modify: `src/components/travel/TravelWizard.tsx`

- [ ] **Step 1: Extend the props interface**

In `src/components/travel/TravelWizard.tsx`, add `GarmentSelection` to the type-only imports at lines 15-20:

```ts
import type {
  Companion,
  GarmentSelection,
  LuggageType,
  OccasionId,
  StylePreference,
} from './types';
```

Then inside `TravelWizardProps`, after `allGarments: Garment[] | undefined;` (currently line 61), add:

```ts
  garmentSelection: GarmentSelection | null;
  setGarmentSelection: (v: GarmentSelection | null) => void;
```

- [ ] **Step 2: Forward them to `TravelStep2`**

In the JSX where `<TravelStep2 ... />` is rendered (currently lines 142-156), add two more props inside the element:

```tsx
                <TravelStep2
                  occasions={props.occasions}
                  setOccasions={props.setOccasions}
                  companions={props.companions}
                  setCompanions={props.setCompanions}
                  stylePreference={props.stylePreference}
                  setStylePreference={props.setStylePreference}
                  outfitsPerDay={props.outfitsPerDay}
                  setOutfitsPerDay={props.setOutfitsPerDay}
                  mustHaveItems={props.mustHaveItems}
                  setMustHaveItems={props.setMustHaveItems}
                  minimizeItems={props.minimizeItems}
                  setMinimizeItems={props.setMinimizeItems}
                  allGarments={props.allGarments}
                  garmentSelection={props.garmentSelection}
                  setGarmentSelection={props.setGarmentSelection}
                />
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: FAIL — `TravelStep2` does not yet accept `garmentSelection` / `setGarmentSelection`. This is intentional and will be fixed in the next task.

- [ ] **Step 4: Defer commit until Task 5**

Hold this change uncommitted. It will land together with the Task 5 `TravelStep2` changes.

---

### Task 5: Rewrite `TravelStep2.tsx` — cardless + selection panel

**Files:**
- Modify: `src/components/travel/TravelStep2.tsx`

- [ ] **Step 1: Update imports**

Replace the existing import block (lines 1-28) with:

```tsx
import { type Dispatch, type SetStateAction, useState } from 'react';
import {
  Briefcase,
  Wine,
  Umbrella,
  Mountain,
  Music,
  Heart,
  Map,
  Plane,
  Dumbbell,
  Minus,
  Plus,
  Shirt,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';

import { Label } from '@/components/ui/label';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { hapticLight } from '@/lib/haptics';
import { cn } from '@/lib/utils';

import { GarmentSelectionPanel } from './GarmentSelectionPanel';
import { OCCASIONS, type Companion, type GarmentSelection, type OccasionId, type StylePreference } from './types';
```

(The `Card` import is removed.)

- [ ] **Step 2: Extend the props interface**

Replace the existing `TravelStep2Props` interface (currently lines 50-64) with:

```tsx
interface TravelStep2Props {
  occasions: OccasionId[];
  setOccasions: Dispatch<SetStateAction<OccasionId[]>>;
  companions: Companion;
  setCompanions: (v: Companion) => void;
  stylePreference: StylePreference;
  setStylePreference: (v: StylePreference) => void;
  outfitsPerDay: number;
  setOutfitsPerDay: (v: number) => void;
  mustHaveItems: string[];
  setMustHaveItems: Dispatch<SetStateAction<string[]>>;
  minimizeItems: boolean;
  setMinimizeItems: (v: boolean) => void;
  allGarments: Garment[] | undefined;
  garmentSelection: GarmentSelection | null;
  setGarmentSelection: (v: GarmentSelection | null) => void;
}
```

Also add the two new destructured props in the function signature (after `allGarments,`):

```tsx
export function TravelStep2({
  occasions,
  setOccasions,
  companions,
  setCompanions,
  stylePreference,
  setStylePreference,
  outfitsPerDay,
  setOutfitsPerDay,
  mustHaveItems,
  setMustHaveItems,
  minimizeItems,
  setMinimizeItems,
  allGarments,
  garmentSelection,
  setGarmentSelection,
}: TravelStep2Props) {
```

- [ ] **Step 3: Rewrite the JSX body (cardless layout)**

Replace the entire `return (` block (currently lines 115-307) with:

```tsx
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="label-editorial text-accent/70">{t('travel.step2_title') || 'Plan your trip'}</p>
        <h2 className="font-display italic text-[1.35rem] tracking-[-0.02em] text-foreground">
          {t('travel.what_kind') || 'What kind of trip?'}
        </h2>
      </div>

      <div className="space-y-3">
        <Label className="label-editorial">{t('travel.occasions_label') || 'Occasions'}</Label>
        <div className="grid grid-cols-3 gap-2">
          {OCCASIONS.map((opt) => {
            const Icon = OCCASION_ICONS[opt.id];
            const active = occasions.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleOccasion(opt.id)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-[1.1rem] border px-2 py-3 text-center transition-colors',
                  active
                    ? 'border-accent bg-accent/10 text-foreground'
                    : 'border-border/40 bg-transparent text-foreground/70 hover:border-border/60',
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} />
                <span className="text-[11px] font-medium leading-tight">
                  {t(opt.labelKey)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 border-t border-border/40 pt-6">
        <Label className="label-editorial">{t('travel.companions_label') || 'Who are you with?'}</Label>
        <div className="flex flex-wrap gap-2">
          {COMPANION_OPTIONS.map((opt) => {
            const active = companions === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  hapticLight();
                  setCompanions(opt.id);
                }}
                className={cn(
                  'rounded-full border px-4 py-2 text-sm transition-colors',
                  active
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border/40 bg-transparent text-foreground/70 hover:border-border/60',
                )}
              >
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 border-t border-border/40 pt-6">
        <Label className="label-editorial">{t('travel.style_label') || 'Style preference'}</Label>
        <div className="flex flex-wrap gap-2">
          {STYLE_OPTIONS.map((opt) => {
            const active = stylePreference === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  hapticLight();
                  setStylePreference(opt.id);
                }}
                className={cn(
                  'rounded-full border px-4 py-2 text-sm transition-colors',
                  active
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border/40 bg-transparent text-foreground/70 hover:border-border/60',
                )}
              >
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 border-t border-border/40 pt-6">
        <div className="space-y-1">
          <Label className="label-editorial">{t('capsule.outfits_per_day')}</Label>
          <p className="text-xs text-muted-foreground">{t('capsule.outfits_per_day_desc')}</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setOutfitsPerDay(Math.max(1, outfitsPerDay - 1));
            }}
            disabled={outfitsPerDay <= 1}
            className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-border/40 disabled:opacity-35"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="font-display italic text-[1.8rem] leading-none tracking-[-0.02em]">
            {outfitsPerDay}
          </span>
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setOutfitsPerDay(Math.min(4, outfitsPerDay + 1));
            }}
            disabled={outfitsPerDay >= 4}
            className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-border/40 disabled:opacity-35"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {(allGarments?.length ?? 0) > 0 ? (
        <div className="space-y-3 border-t border-border/40 pt-6">
          <button
            type="button"
            onClick={() => setMustHavesOpen((v) => !v)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Shirt className="h-4 w-4 text-muted-foreground" />
              <span className="label-editorial">
                {t('capsule.must_haves')}
                {mustHaveItems.length > 0 ? ` · ${mustHaveItems.length}` : ''}
              </span>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                mustHavesOpen ? 'rotate-180' : '',
              )}
            />
          </button>

          {mustHavesOpen ? (
            <div className="grid grid-cols-4 gap-2">
              {(allGarments ?? []).slice(0, 32).map((garment) => {
                const active = mustHaveItems.includes(garment.id);
                const limitReached = !active && mustHaveItems.length >= MAX_MUST_HAVES;
                return (
                  <button
                    key={garment.id}
                    type="button"
                    disabled={limitReached}
                    onClick={() => toggleMustHave(garment.id)}
                    className={cn(
                      'relative aspect-square overflow-hidden rounded-[1rem] border transition-all',
                      active
                        ? 'border-accent ring-2 ring-accent/30'
                        : 'border-border/40',
                      limitReached && 'opacity-40',
                    )}
                  >
                    <LazyImageSimple
                      imagePath={getPreferredGarmentImagePath(garment)}
                      alt={garment.title}
                      className="h-full w-full object-cover"
                    />
                    {active ? (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[0.62rem] font-medium text-white">
                        ✓
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {(allGarments?.length ?? 0) > 0 ? (
        <div className="space-y-3 border-t border-border/40 pt-6">
          <GarmentSelectionPanel
            allGarments={allGarments ?? []}
            value={garmentSelection}
            onChange={setGarmentSelection}
          />
        </div>
      ) : null}

      <div className="border-t border-border/40 pt-6">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <div>
            <span className="text-sm font-medium text-foreground">{t('capsule.minimize')}</span>
            <p className="mt-1 text-xs text-muted-foreground">{t('capsule.minimize_desc')}</p>
          </div>
          <Switch checked={minimizeItems} onCheckedChange={setMinimizeItems} />
        </label>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS now that `TravelStep2`'s interface accepts the new props.

- [ ] **Step 5: Commit Step 4 + Step 5 together**

```
git add src/components/travel/TravelWizard.tsx src/components/travel/TravelStep2.tsx
git commit -m "Prompt 38: Cardless TravelStep2 + GarmentSelectionPanel wiring"
```

---

### Task 6: Rewrite `TravelStep1.tsx` — cardless layout

**Files:**
- Modify: `src/components/travel/TravelStep1.tsx`

- [ ] **Step 1: Remove the `Card` import**

Delete line 6: `import { Card } from '@/components/ui/card';`

- [ ] **Step 2: Replace the JSX body with a cardless layout**

Replace the `return (` block (currently lines 61-190) with:

```tsx
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="label-editorial text-accent/70">{t('travel.step1_title') || 'Where and when'}</p>
        <h2 className="font-display italic text-[1.35rem] tracking-[-0.02em] text-foreground">
          {t('capsule.destination') || 'Destination'}
        </h2>
      </div>

      <div className="space-y-3">
        <Label className="label-editorial">{t('capsule.destination')}</Label>
        <LocationAutocomplete
          value={destination}
          onChange={setDestination}
          onSelect={handleLocationSelect}
          placeholder={t('capsule.enter_city')}
          icon={<Globe className="h-4 w-4" strokeWidth={1.5} />}
          inputClassName="h-12 rounded-[1.25rem] bg-background/60 border-border/40"
        />
      </div>

      <div className="space-y-3 border-t border-border/40 pt-6">
        <Label className="label-editorial">{t('capsule.travel_dates')}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'h-12 w-full justify-start rounded-[1.25rem] border-border/40 text-left font-normal',
                !dateRange?.from && 'text-muted-foreground',
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground/60" />
              {dateLabel
                ? `${dateLabel} (${tripNights} ${t('capsule.nights')})`
                : t('capsule.select_dates_hint')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={1}
              disabled={(date) => date < new Date()}
              locale={dateLocale}
              className="pointer-events-auto p-3"
            />
          </PopoverContent>
        </Popover>

        {isFetchingWeather ? (
          <AILoadingCard
            phases={[
              { icon: Globe, label: `${t('capsule.looking_up') || 'Looking up'} ${destination}...`, duration: 1500 },
              { icon: Cloud, label: t('qgen.fetching_weather'), duration: 0 },
            ]}
          />
        ) : null}

        {weatherError ? (
          <p className="text-xs text-muted-foreground">{weatherError}</p>
        ) : null}

        {!isFetchingWeather && previewForecastDays.length > 0 ? (
          <div className="flex items-center gap-2 overflow-x-auto rounded-[1.25rem] border border-border/40 bg-background/60 px-3 py-3">
            {previewForecastDays.map((day) => (
              <div
                key={day.date}
                className="flex min-w-[58px] flex-col items-center gap-1 text-center"
              >
                <WeatherMiniIcon condition={day.condition} />
                <span className="text-[11px] font-medium text-foreground/80">
                  {Math.round(day.temperature_max)}°
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {Math.round(day.temperature_min)}°
                </span>
              </div>
            ))}
            {weatherForecast ? (
              <div className="ml-auto hidden flex-col text-right sm:flex">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {weatherForecast.condition}
                </span>
                <span className="text-[11px] text-foreground/70">
                  {weatherForecast.temperature_min}°–{weatherForecast.temperature_max}°
                </span>
              </div>
            ) : null}
          </div>
        ) : !isFetchingWeather && !weatherError ? (
          <p className="text-xs text-muted-foreground">
            {t('travel.weather_auto') || 'Weather loads automatically once destination and dates are set.'}
          </p>
        ) : null}
      </div>

      <div className="space-y-3 border-t border-border/40 pt-6">
        <Label className="label-editorial">{t('travel.luggage_label') || 'Luggage'}</Label>
        <div className="flex flex-wrap gap-2">
          {LUGGAGE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = luggageType === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  hapticLight();
                  setLuggageType(opt.id);
                }}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors',
                  active
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border/40 bg-transparent text-foreground/70 hover:border-border/60',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```
git add src/components/travel/TravelStep1.tsx
git commit -m "Prompt 38: Cardless TravelStep1 layout"
```

---

### Task 7: Pass `garmentSelection` from `TravelCapsule.tsx` page

**Files:**
- Modify: `src/pages/TravelCapsule.tsx`

- [ ] **Step 1: Add the two new props to the wizard element**

In `src/pages/TravelCapsule.tsx`, inside the `<TravelWizard ... />` JSX (currently lines 125-156), add two more props immediately after `allGarments={capsule.allGarments}` (currently line 153):

```tsx
                allGarments={capsule.allGarments}
                garmentSelection={capsule.garmentSelection}
                setGarmentSelection={capsule.setGarmentSelection}
                onGenerate={capsule.handleGenerate}
                isGenerating={capsule.isGenerating}
              />
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```
git add src/pages/TravelCapsule.tsx
git commit -m "Prompt 38: Wire garmentSelection through TravelCapsule page"
```

---

## Phase C — Results view fixes

### Task 8: Add `hideTryButton` prop to `OutfitSuggestionCard`

**Files:**
- Modify: `src/components/chat/OutfitSuggestionCard.tsx`

- [ ] **Step 1: Extend the interface**

In `src/components/chat/OutfitSuggestionCard.tsx`, add `hideTryButton?: boolean;` to the `OutfitSuggestionCardProps` interface (after `historyMode?: boolean;`, currently line 51):

```ts
interface OutfitSuggestionCardProps {
  garments: GarmentBasic[];
  explanation: string;
  onTryOutfit: (garmentIds: string[]) => void;
  isCreating?: boolean;
  isRefining?: boolean;
  lockedSlots?: string[];
  onRefine?: (garmentIds: string[], explanation: string) => void;
  onSave?: (garmentIds: string[]) => void;
  onToggleLock?: (garmentId: string) => void;
  isSaving?: boolean;
  isSaved?: boolean;
  changedGarmentIds?: string[];
  historyMode?: boolean;
  hideTryButton?: boolean;
}
```

- [ ] **Step 2: Destructure the new prop**

In the `OutfitSuggestionCard` function destructure block (currently lines 54-68), add `hideTryButton = false,` above the closing brace:

```tsx
export function OutfitSuggestionCard({
  garments: initialGarments,
  explanation,
  onTryOutfit,
  isCreating,
  isRefining,
  lockedSlots,
  onRefine,
  onSave,
  onToggleLock,
  isSaving,
  isSaved,
  changedGarmentIds,
  historyMode = false,
  hideTryButton = false,
}: OutfitSuggestionCardProps) {
```

- [ ] **Step 3: Gate the fallback Try-this button**

Find the `else` branch near line 367-380 that renders the bare "Try this" button:

```tsx
              ) : (
                <Button
                  size="sm"
                  className="w-full rounded-full text-[13px] h-10 gap-1.5"
                  onClick={() => onTryOutfit(garments.map(g => g.id))}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    t('outfit.try_this')
                  )}
                </Button>
```

Wrap it in a `hideTryButton ? null : (...)` guard:

```tsx
              ) : hideTryButton ? null : (
                <Button
                  size="sm"
                  className="w-full rounded-full text-[13px] h-10 gap-1.5"
                  onClick={() => onTryOutfit(garments.map(g => g.id))}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    t('outfit.try_this')
                  )}
                </Button>
```

(The missing-shoes branch and the refine/save branch are not wrapped — they represent different UX and are intentionally preserved.)

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```
git add src/components/chat/OutfitSuggestionCard.tsx
git commit -m "Prompt 38: Add hideTryButton prop to OutfitSuggestionCard"
```

---

### Task 9: Hide Try-this in `CapsuleOutfitCard`

**Files:**
- Modify: `src/components/travel/CapsuleOutfitCard.tsx`

- [ ] **Step 1: Pass the new prop**

Replace the `<OutfitSuggestionCard ... />` element (currently lines 34-40) with:

```tsx
      <OutfitSuggestionCard
        garments={outfitGarments}
        explanation={outfit.note ?? ''}
        onTryOutfit={() => {/* hidden in capsule context */}}
        isCreating={false}
        hideTryButton
      />
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```
git add src/components/travel/CapsuleOutfitCard.tsx
git commit -m "Prompt 38: Hide Try-this button in capsule outfit cards"
```

---

### Task 10: Pin the action bar to the viewport bottom + show partial-result banner

**Files:**
- Modify: `src/components/travel/TravelResultsView.tsx`

- [ ] **Step 1: Read current imports**

The file already imports `CapsuleResult` from `./types`. Add `CapsuleCoverageGap` so the banner can display gap messages:

In the type-only import block near the top, ensure `CapsuleCoverageGap` is present:

```ts
import type { CapsuleOutfit, CapsuleResult, CapsuleCoverageGap, VibeId } from './types';
```

- [ ] **Step 2: Add the partial-result banner above the tabs**

Find the `<AppLayout hideNav>` block. Immediately before the existing `<div className="flex rounded-full border p-1.5">` tab switcher (currently line 158), insert:

```tsx
        {(() => {
          const gaps: CapsuleCoverageGap[] = result.coverage_gaps ?? [];
          if (gaps.length === 0) return null;
          const missing = gaps
            .flatMap((g) => g.missing_slots ?? [])
            .filter((s, i, arr) => s && arr.indexOf(s) === i);
          const gapMessage = missing.length > 0
            ? `Add more ${missing.join(' and ')} to unlock the rest.`
            : gaps.map((g) => g.message).filter(Boolean).join(' ');
          return (
            <div className="rounded-[1.35rem] border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-foreground/80">
              <p className="font-medium text-foreground">
                We built {result.outfits.length} {result.outfits.length === 1 ? 'look' : 'looks'} from your current wardrobe.
              </p>
              {gapMessage ? (
                <p className="mt-1 text-xs text-muted-foreground">{gapMessage}</p>
              ) : null}
            </div>
          );
        })()}
```

- [ ] **Step 3: Pin the action bar to the viewport bottom**

Find the fixed action bar near line 247 and replace the outer wrapper:

Before:
```tsx
      <div className="bottom-safe-nav fixed inset-x-4 z-20">
```

After:
```tsx
      <div
        className="fixed inset-x-4 z-20"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
      >
```

- [ ] **Step 4: Pad the scroll content so nothing sits under the action bar**

The scroll region `AnimatedPage` already uses `!pb-36` (currently line 87) which is ~9rem — sufficient for the fixed bar plus safe-area. Confirm by visual check (no change needed), but verify with TypeScript compile.

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add src/components/travel/TravelResultsView.tsx
git commit -m "Prompt 38: Pin action bar to viewport bottom + partial-result banner"
```

---

## Phase D — Edge function changes

### Task 11: Accept `garment_selection`, drop 40-cap, drop category minimums

**Files:**
- Modify: `supabase/functions/travel_capsule/index.ts`

- [ ] **Step 1: Extend the request destructure**

Find the `await req.json()` block (currently lines 401-417). Add `garment_selection` to the destructured fields:

```ts
    const {
      destination,
      weather,
      occasions = [],
      locale = "en",
      outfits_per_day = 1,
      must_have_items = [],
      trip_type = "mixed",
      start_date,
      end_date,
      minimize_items = true,
      include_travel_days = false,
      transition_looks = false,
      luggage_type = "carry_on_personal",
      companions = "solo",
      style_preference = "balanced",
      garment_selection = null,
    } = await req.json();
```

- [ ] **Step 2: Rewrite `selectGarmentsForAI`**

Replace the entire body of `selectGarmentsForAI` (currently lines 197-250) with:

```ts
const GARMENT_CEILING = 150;

function selectGarmentsForAI(
  scoredGarments: ScoredGarment[],
  mustHaveIds: string[],
  _minimizeItems: boolean,
  _weatherMin: number,
  _luggageLimits: { garments: number; shoes: number } = { garments: 12, shoes: 2 },
  garmentSelection: Record<string, number> | null = null,
): GarmentRow[] {
  // Group garments by their normalized capsule slot for per-category caps.
  const bySlot = new Map<string, ScoredGarment[]>();
  for (const scored of scoredGarments) {
    const slot = classifyTravelCapsuleSlot(scored.garment.category, scored.garment.subcategory);
    const list = bySlot.get(slot) || [];
    list.push(scored);
    bySlot.set(slot, list);
  }

  const selected = new Map<string, GarmentRow>();

  if (garmentSelection && typeof garmentSelection === "object") {
    // User-controlled mode: take top N by pack-score for each category.
    for (const [category, count] of Object.entries(garmentSelection)) {
      const n = Math.max(0, Math.floor(Number(count) || 0));
      if (n === 0) continue;
      const pool = bySlot.get(category) || [];
      for (const entry of pool.slice(0, n)) {
        selected.set(entry.garment.id, entry.garment);
      }
    }
  } else {
    // Default mode: take everything, sorted by pack-worthiness.
    for (const entry of scoredGarments) {
      selected.set(entry.garment.id, entry.garment);
    }
  }

  // Always include must-haves.
  const allById = new Map(scoredGarments.map((e) => [e.garment.id, e.garment]));
  for (const id of mustHaveIds) {
    const g = allById.get(id);
    if (g) selected.set(id, g);
  }

  // Enforce the 150-item safety ceiling (top-ranked kept).
  if (selected.size > GARMENT_CEILING) {
    const ordered = scoredGarments
      .filter((e) => selected.has(e.garment.id))
      .slice(0, GARMENT_CEILING);
    const clamped = new Map<string, GarmentRow>();
    for (const e of ordered) clamped.set(e.garment.id, e.garment);
    // Ensure must-haves survive the clamp.
    for (const id of mustHaveIds) {
      const g = allById.get(id);
      if (g && !clamped.has(id) && clamped.size < GARMENT_CEILING) clamped.set(id, g);
    }
    return Array.from(clamped.values());
  }

  return Array.from(selected.values());
}
```

- [ ] **Step 3: Pass `garment_selection` into the call**

Find the call site (currently lines 489-495) and add the 6th argument:

```ts
    const garments = selectGarmentsForAI(
      scoredGarments,
      mustHaveIds,
      Boolean(minimize_items),
      weatherMin,
      luggageLimits,
      garment_selection,
    );
```

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```
git add supabase/functions/travel_capsule/index.ts
git commit -m "Prompt 38: Honor garment_selection + drop 40-cap in edge function"
```

---

### Task 12: Remove the edge-function DB insert (Fix 6 server side)

**Files:**
- Modify: `supabase/functions/travel_capsule/index.ts`

- [ ] **Step 1: Delete the `.insert(...)` block**

Remove the entire `FIX 4 — SAVE CAPSULE TO DB` block (currently lines 1079-1108). The keepers are the `packingList` computation AND the final response — only the `supabase.from('travel_capsules').insert(...)` call and its error log should be removed.

After the edit the block should read:

```ts
    // ─────────────────────────────────────────────
    // Build packing list for response
    // ─────────────────────────────────────────────

    const packingList = clampedCapsule.map((g: any) => ({
      id: g.id,
      title: g.title,
      category: g.category,
      color_primary: g.color_primary,
      image_path: g.image_path ?? null,
    }));

    return new Response(JSON.stringify({
      capsule_items: clampedCapsule,
      outfits: scheduledOutfits,
      packing_list: packingList,
      packing_tips: packing_tips || [],
      coverage_gaps,
      total_combinations: total_combinations || scheduledOutfits.length,
      reasoning: [reasoning, ...coverage_gaps.map((gap) => gap.message)].filter(Boolean).join(' ') || "",
      trip_type,
      duration_days,
      weather_min: weather?.temperature_min ?? null,
      weather_max: weather?.temperature_max ?? null,
    }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
```

Note the response now also returns `packing_list`, `trip_type`, `duration_days`, `weather_min`, and `weather_max` so the frontend hook can persist them directly. The `CapsuleResult` TS interface already tolerates extra fields (`capsule_items`, `outfits`, etc.); adding these five scalars does not break existing consumers because they're read-only additions.

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```
git add supabase/functions/travel_capsule/index.ts
git commit -m "Prompt 38: Remove edge-function DB insert (single-writer for capsule persistence)"
```

---

### Task 13: Deterministic fallback when AI returns zero outfits

**Files:**
- Modify: `supabase/functions/travel_capsule/index.ts`

- [ ] **Step 1: Locate the outfit-count guard**

Find the section that decides whether `scheduledOutfits` is usable. Search for `scheduledOutfits.length` and identify the place where, if empty, the function currently still returns (now without throwing because we took out the insert). We want to synthesize a single fallback outfit.

The simplest place to patch is immediately before `const packingList = ...` that we just edited in Task 12. Add the fallback block above it:

```ts
    // Deterministic fallback: if AI gave us nothing, pick the top-scored
    // top+bottom+shoes so the user sees at least one outfit instead of
    // an empty results screen.
    if (scheduledOutfits.length === 0) {
      const bySlot = (slot: string) => allGarments
        .filter((g) => classifyTravelCapsuleSlot(g.category, g.subcategory) === slot)
        .sort((a, b) => (scoreById.get(b.id) || 0) - (scoreById.get(a.id) || 0));
      const fallbackTop = bySlot("top")[0];
      const fallbackBottom = bySlot("bottom")[0];
      const fallbackShoes = bySlot("shoes")[0];
      if (fallbackTop && fallbackBottom && fallbackShoes) {
        scheduledOutfits.push({
          day: 1,
          date: start_date,
          kind: "trip_day",
          occasion: occasions[0] || "travel",
          items: [fallbackTop.id, fallbackBottom.id, fallbackShoes.id],
          note: "A complete travel look from your top picks.",
        });
        coverage_gaps.push({
          code: "ai_empty_fallback",
          message: `We built 1 of ${requiredOutfits} days from your current wardrobe.`,
          uncovered_outfits: Math.max(0, requiredOutfits - 1),
        });
      }
    }
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```
git add supabase/functions/travel_capsule/index.ts
git commit -m "Prompt 38: Deterministic fallback when AI returns zero outfits"
```

---

## Phase E — Client-side persistence (Fix 6)

### Task 14: Teach `useTravelCapsules.save` to write every NOT NULL column

**Files:**
- Modify: `src/hooks/useTravelCapsules.ts`

- [ ] **Step 1: Extend the mutation argument type**

Replace the `saveMutation` block (currently lines 29-57) with:

```ts
  const saveMutation = useMutation({
    mutationFn: async (capsule: {
      destination: string;
      trip_type: string;
      duration_days: number;
      weather_min: number | null;
      weather_max: number | null;
      start_date: string | null;
      end_date: string | null;
      occasions: string[];
      luggage_type: string;
      companions: string;
      style_preference: string;
      capsule_items: unknown;
      outfits: unknown;
      packing_list: unknown;
      packing_tips: string[] | null;
      total_combinations: number;
      reasoning: string | null;
      result: CapsuleResult;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const existing = query.data ?? [];
      if (existing.length >= MAX_CAPSULES) {
        const oldest = existing[existing.length - 1];
        await supabase.from('travel_capsules').delete().eq('id', oldest.id);
      }
      const { data, error } = await supabase
        .from('travel_capsules')
        .insert({ user_id: user.id, ...capsule })
        .select()
        .single();
      if (error) throw error;
      return data as TravelCapsuleRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travel-capsules', user?.id] });
    },
  });
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: FAIL — `useTravelCapsule.handleGenerate` currently calls `saveCapsuleToDb` with the old shape. This is expected and will be fixed in Task 15.

- [ ] **Step 3: Do not commit until Task 15 lands together**

---

### Task 15: Update `handleGenerate` to send the full row

**Files:**
- Modify: `src/components/travel/useTravelCapsule.ts`

- [ ] **Step 1: Replace the `saveCapsuleToDb` call**

In `handleGenerate`, locate the current try/catch that calls `saveCapsuleToDb` (currently lines 416-430). Replace it with:

```ts
      // Auto-save to DB (best-effort — failures don't block the UX)
      try {
        const enriched = capsuleResult as unknown as {
          trip_type?: string;
          duration_days?: number;
          weather_min?: number | null;
          weather_max?: number | null;
          packing_list?: unknown;
          packing_tips?: string[];
          total_combinations?: number;
          reasoning?: string;
        };
        await saveCapsuleToDb({
          destination,
          trip_type: enriched.trip_type ?? VIBE_TO_TRIP_TYPE[vibe],
          duration_days: enriched.duration_days ?? tripDays,
          weather_min: enriched.weather_min ?? weatherForecast?.temperature_min ?? null,
          weather_max: enriched.weather_max ?? weatherForecast?.temperature_max ?? null,
          start_date: dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : null,
          end_date: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : null,
          occasions: effectiveOccasions,
          luggage_type: luggageType,
          companions,
          style_preference: stylePreference,
          capsule_items: capsuleResult.capsule_items ?? [],
          outfits: capsuleResult.outfits ?? [],
          packing_list: enriched.packing_list ?? [],
          packing_tips: enriched.packing_tips ?? capsuleResult.packing_tips ?? null,
          total_combinations: enriched.total_combinations ?? capsuleResult.total_combinations ?? 0,
          reasoning: enriched.reasoning ?? capsuleResult.reasoning ?? null,
          result: capsuleResult,
        });
      } catch (dbErr) {
        logger.error('Failed to auto-save travel capsule:', dbErr);
      }
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS (the mutation signature now matches).

- [ ] **Step 3: Commit Task 14 + Task 15 together**

```
git add src/hooks/useTravelCapsules.ts src/components/travel/useTravelCapsule.ts
git commit -m "Prompt 38: Persist full capsule row via single frontend writer"
```

---

## Phase F — Test updates and full QA

### Task 16: Update existing `TravelCapsule.test.tsx`

**Files:**
- Modify: `src/pages/__tests__/TravelCapsule.test.tsx` (if it exists)

- [ ] **Step 1: Check if the test exists**

Run:
```
ls src/pages/__tests__/TravelCapsule.test.tsx
```

If it doesn't exist, skip to Step 3.

- [ ] **Step 2: Update assertions that expect the old card-based layout**

Search the file for any assertion that looks for `<Card>` wrappers, the default "Try this" button, or the hardcoded `Scanning your N garments` text. Replace those assertions with the new shape:
- For loading text: expect the new `Scanning {actualCount} of your {totalCount} garments` format
- For card assertions: delete them (cards are gone)
- For Try-this assertions: the capsule version should assert the button is NOT present

Re-run the test to confirm passing:

```
npx vitest run src/pages/__tests__/TravelCapsule.test.tsx
```

- [ ] **Step 3: Commit if changes were needed**

```
git add src/pages/__tests__/TravelCapsule.test.tsx
git commit -m "Prompt 38: Update TravelCapsule tests for cardless layout"
```

(Skip this commit if no test file existed.)

---

### Task 17: Full QA sweep

**Files:** none (verification)

- [ ] **Step 1: TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: 0 errors.

- [ ] **Step 2: Lint**

Run: `npx eslint src/ --ext .ts,.tsx --max-warnings 0`
Expected: 0 warnings.

- [ ] **Step 3: Vitest**

Run: `npm test`
Expected: all tests pass. Pay particular attention to `GarmentSelectionPanel.test.tsx` and any travel-related tests.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: build completes with no warnings (warnings count as failures per CLAUDE.md).

- [ ] **Step 5: Commit any fixes**

If any step found breakage, fix and create a dedicated commit:
```
git add -A
git commit -m "Prompt 38: Fix [specific issue] surfaced by QA sweep"
```

Re-run steps 1-4 until everything is clean.

---

## Phase G — Deploy and PR

### Task 18: Deploy the edge function

**Files:** none

- [ ] **Step 1: Deploy**

Run the exact command (per CLAUDE.md — never deviate):

```
npx supabase functions deploy travel_capsule --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
```

Expected: CLI reports a successful deploy with a new version.

- [ ] **Step 2: Smoke test**

Wait a few seconds, then in an authenticated session hit the function. A quick way is via the frontend: run `npm run dev`, open Travel Capsule, generate a small capsule, confirm it returns outfits and does not error. (This is the same verification the on-device test plan calls for — keep it focused.)

---

### Task 19: Push the branch and open the PR

**Files:** none

- [ ] **Step 1: Push**

```
git push origin prompt-38-travel-capsule-six-fix
```

- [ ] **Step 2: Open the PR**

```
gh pr create --title "Prompt 38: Travel Capsule six-fix (cardless wizard, user garment selection, partial results, bottom action bar, hide Try-this, full persistence)" --body "$(cat <<'EOF'
## Summary

Six interlocked fixes to the Travel Capsule feature, delivered as one atomic PR per the approved spec.

- Cardless wizard layout matching the rest of BURS (AddGarment / Settings) — no more invisible cards
- User-controlled garment selection with per-category sliders; default sends all garments up to a 150 safety ceiling
- Graceful partial results: banner above the tabs when coverage is incomplete instead of a hard "could not build" error; deterministic fallback outfit if the AI returns zero
- Results action bar pinned to the viewport bottom with safe-area padding
- "Try this" button hidden in the capsule context; chat behaviour preserved via new `hideTryButton` prop
- Full capsule persistence: single frontend writer sends every NOT NULL column plus `result` JSONB; edge-function duplicate insert removed

Spec: `docs/superpowers/specs/2026-04-15-travel-capsule-six-fix-design.md`
Plan: `docs/superpowers/plans/2026-04-15-travel-capsule-six-fix.md`

## Deploys in this PR

- `travel_capsule` edge function (deployed separately via `npx supabase functions deploy travel_capsule --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt`)
- No database migration (the `result JSONB` column already exists; live schema confirmed via Supabase MCP)

## Test plan

- [ ] Open the wizard and verify no card backgrounds remain; section dividers look like Settings
- [ ] Open the Customize selection panel in Step 2, confirm sliders reflect the live category counts and running total updates
- [ ] Large-wardrobe (100+) generation: loading text reads "Scanning N of your M garments"
- [ ] Wardrobe > 150: count caps at 150 in both the panel summary and the loading text
- [ ] Sparse wardrobe: partial-result banner appears above the tabs instead of a hard error
- [ ] Results screen: action bar pinned to bottom, does not overlap outfit cards
- [ ] Capsule outfit cards: no Try-this button
- [ ] AI chat: Try-this button still present and functional
- [ ] Generate a capsule, close app, reopen, select from Trip History — full capsule is restored (not just destination)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review (inline)

Walking through the spec section-by-section to confirm every requirement is covered:

**Fix 1 — cardless wizard:** Task 5 rewrites `TravelStep2` (drops Cards, section-header + divider pattern). Task 6 rewrites `TravelStep1`. ✅

**Fix 2 — user-controlled garment selection:** Task 1 adds the type. Task 2 creates the component via TDD. Task 3 adds state to the hook. Task 4 threads props through the wizard. Task 5 renders the panel inside Step 2. Task 7 passes state from the page. Task 11 honors `garment_selection` in the edge function and drops the 40-cap / category minimums. The 150 ceiling is enforced in both the panel (summary clamp) and the edge function (final safety net). ✅

**Fix 3 — graceful partial results:** Task 10 adds the partial-result banner to `TravelResultsView`. Task 13 adds the deterministic AI-empty fallback in the edge function. ✅

**Fix 4 — bottom-pinned action bar:** Task 10 (step 3) replaces the wrapper with explicit `bottom: calc(env(safe-area-inset-bottom) + 0.75rem)`. ✅

**Fix 5 — hide Try-this in capsule context:** Task 8 adds the `hideTryButton` prop to `OutfitSuggestionCard`. Task 9 passes `hideTryButton` from `CapsuleOutfitCard`. Chat-side callers default to `false` so no regression. ✅

**Fix 6 — full capsule persistence:** Task 12 removes the edge-function insert (single writer). Task 14 extends the hook mutation to send every NOT NULL column + `result`. Task 15 updates `handleGenerate` to pass the derived values. No migration needed (live schema confirmed to already have `result JSONB`). ✅

**Deploy plan:** Task 18 deploys the edge function with the exact command. ✅

**QA:** Task 17 runs tsc, eslint, vitest, build. ✅

**Placeholder scan:** No "TBD", no "similar to Task N", no "handle edge cases" — every step contains the actual diff or command. ✅

**Type consistency:** `GarmentSelection` is defined in Task 1 and consumed consistently by Tasks 3, 4, 5, 7. `hideTryButton` is defined in Task 8 and consumed by Task 9. `saveCapsuleToDb` mutation signature defined in Task 14 matches the call site in Task 15. ✅

**Spec coverage:** All six fixes, all file changes listed in the spec's "Files to change" section, the deploy plan, and the test plan have tasks. ✅

Plan is complete.
