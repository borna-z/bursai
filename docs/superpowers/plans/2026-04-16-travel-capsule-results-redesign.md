# Travel Capsule Results Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the travel capsule results page from a generic card-heavy dashboard into an editorial "Travel Edit" that feels like a luxury stylist packed for you, and fix the 32-garment hard cap in the must-haves picker.

**Architecture:** Pure frontend visual rewrite of two components (`TravelResultsView.tsx`, `CapsuleSummary.tsx`), a targeted one-line fix in `TravelStep2.tsx`, and one CSS utility added to `index.css`. No data flow, hook, edge function, or DB changes. All existing props and interfaces stay identical.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Framer Motion, date-fns

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/travel/TravelResultsView.tsx` | Rewrite JSX | Hero header, tab bar, outfits tab, action bar, partial-results banner |
| `src/components/travel/CapsuleSummary.tsx` | Rewrite JSX | Packing tab: progress bar, category sections, garment rows, tips, copy button |
| `src/components/travel/TravelStep2.tsx` | Edit ~3 lines | Remove `.slice(0, 32)`, add scroll container + fade |
| `src/index.css` | Append ~4 lines | `.scroll-fade-bottom` utility class |

**Not touched:** `useTravelCapsule.ts`, `CapsuleOutfitCard.tsx`, `OutfitSuggestionCard.tsx`, `GarmentSelectionPanel.tsx`, edge functions, DB, i18n files (no new keys needed — all labels use existing tokens or inline English matching the current codebase pattern).

---

### Task 1: Add `.scroll-fade-bottom` CSS utility

**Files:**
- Modify: `src/index.css` (after the `.scroll-fade-right` block at ~line 585)

- [ ] **Step 1: Add the utility class**

Open `src/index.css` and find the `.scroll-fade-right` block (around line 582). Directly after it, add:

```css
  /* Scroll-fade mask for vertical scrollable containers */
  .scroll-fade-bottom {
    -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 32px), transparent 100%);
    mask-image: linear-gradient(to bottom, black calc(100% - 32px), transparent 100%);
  }
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean build, no warnings.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "Prompt 41: Add scroll-fade-bottom CSS utility"
```

---

### Task 2: Fix garment cap in TravelStep2

**Files:**
- Modify: `src/components/travel/TravelStep2.tsx` (~lines 266-298)

- [ ] **Step 1: Replace the hard-capped grid with a scrollable container**

Find this block (around line 266):

```tsx
          {mustHavesOpen ? (
            <div className="grid grid-cols-4 gap-2">
              {(allGarments ?? []).slice(0, 32).map((garment) => {
```

Replace with:

```tsx
          {mustHavesOpen ? (
            <div className={cn(
              'max-h-[320px] overflow-y-auto scrollbar-hide',
              (allGarments ?? []).length > 16 && 'scroll-fade-bottom',
            )}>
            <div className="grid grid-cols-4 gap-2">
              {(allGarments ?? []).map((garment) => {
```

Then find the closing `</div>` for the grid (after the `.map()` ends, around line 298):

```tsx
              })}
            </div>
          ) : null}
```

Add one extra closing `</div>` for the scroll wrapper:

```tsx
              })}
            </div>
            </div>
          ) : null}
```

- [ ] **Step 2: Verify the `cn` import exists**

Check line ~6 of TravelStep2.tsx — it should already import `cn` from `@/lib/utils`. If not, add it.

- [ ] **Step 3: Run typecheck + build**

Run: `npx tsc --noEmit --skipLibCheck && npm run build`
Expected: 0 errors, clean build.

- [ ] **Step 4: Commit**

```bash
git add src/components/travel/TravelStep2.tsx
git commit -m "Prompt 41: Remove 32-garment cap in must-haves picker, add scroll"
```

---

### Task 3: Rewrite TravelResultsView — Editorial Hero + Tab Bar + Outfits Tab + Action Bar

**Files:**
- Modify: `src/components/travel/TravelResultsView.tsx` (full JSX rewrite, same props interface)

This is the largest task. The component signature and props stay identical — only the returned JSX changes.

- [ ] **Step 1: Rewrite the full component JSX**

Replace the entire return statement (everything inside `return ( ... )`) with the editorial layout. Keep all imports. Remove unused imports (`Card`, `PageIntro`). The new JSX structure:

```tsx
import { addDays, format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CalendarDays, CalendarPlus, Check, Pencil, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { AppLayout } from '@/components/layout/AppLayout';
import { AILoadingCard } from '@/components/ui/AILoadingCard';
import { AnimatedPage } from '@/components/ui/animated-page';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { EASE_CURVE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { ForecastDay } from '@/hooks/useForecast';
import type { DateRange } from 'react-day-picker';

import { CapsuleOutfitCard } from '@/components/travel/CapsuleOutfitCard';
import { CapsuleSummary } from '@/components/travel/CapsuleSummary';
import { WeatherMiniIcon } from '@/components/travel/WeatherMiniIcon';
import type { CapsuleCoverageGap, CapsuleOutfit, CapsuleResult, VibeId } from './types';

type GarmentLike = { id: string; title: string; image_path: string; category: string; color_primary?: string };

// Props interface stays EXACTLY the same — no changes
interface TravelResultsViewProps {
  result: CapsuleResult;
  destination: string;
  vibe: VibeId;
  dateLabel: string | null;
  dateSublabel: string | null;
  dateRange: DateRange | undefined;
  dateLocale: Locale;
  weatherForecast: ForecastDay | null;
  tripDayForecasts: Array<ForecastDay | null>;
  activeTab: 'packing' | 'outfits';
  setActiveTab: (tab: 'packing' | 'outfits') => void;
  groupedItems: Record<string, Array<{ id: string; title: string; image_path: string; category: string }>>;
  checkedItems: Set<string>;
  toggleChecked: (id: string) => void;
  itemOutfitCount: Map<string, number>;
  capsuleItemIds: string[];
  garmentMap: Map<string, GarmentLike>;
  allGarmentsMap: Map<string, GarmentLike>;
  totalItems: number;
  packedCount: number;
  isAddingToCalendar: boolean;
  addedToCalendar: boolean;
  handleAddToCalendar: () => void;
  setResult: (value: CapsuleResult | null) => void;
  setAddedToCalendar: (value: boolean) => void;
}

export function TravelResultsView({
  result,
  destination,
  vibe,
  dateLabel,
  dateSublabel,
  dateRange,
  dateLocale,
  weatherForecast,
  tripDayForecasts,
  activeTab,
  setActiveTab,
  groupedItems,
  checkedItems,
  toggleChecked,
  itemOutfitCount,
  capsuleItemIds,
  garmentMap,
  allGarmentsMap,
  totalItems,
  packedCount,
  isAddingToCalendar,
  addedToCalendar,
  handleAddToCalendar,
  setResult,
  setAddedToCalendar,
}: TravelResultsViewProps) {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();

  return (
    <AppLayout hideNav>
      <AnimatedPage className="page-shell !px-5 !pb-36 !pt-6 page-cluster">

        {/* ── Navigation row ── */}
        <div className="flex items-center justify-between gap-3">
          <Button variant="quiet" size="icon" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="quiet" size="icon" onClick={() => setResult(null)} aria-label="Edit capsule">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>

        {/* ── Destination title ── */}
        <h1 className="mt-4 font-display italic text-3xl tracking-tight text-foreground">
          {destination}
        </h1>

        {/* ── Vibe chip ── */}
        <span className="mt-2 inline-block eyebrow-chip !bg-secondary/70 capitalize">{vibe}</span>

        {/* ── Date + weather inline ── */}
        <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
          {dateLabel ? <span>{dateLabel}</span> : null}
          {weatherForecast ? (
            <>
              <span className="opacity-40">·</span>
              <WeatherMiniIcon condition={weatherForecast.condition} className="h-3.5 w-3.5" />
              <span>
                {weatherForecast.temperature_min}–{weatherForecast.temperature_max}°C
              </span>
              <span className="opacity-40">·</span>
              <span>{weatherForecast.condition}</span>
            </>
          ) : null}
        </div>

        {/* ── Day forecast strip ── */}
        {tripDayForecasts.length > 0 ? (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {tripDayForecasts.map((forecast, index) => {
              const dayDate = dateRange?.from ? addDays(dateRange.from, index) : null;
              return (
                <div
                  key={`forecast-${index}`}
                  className="min-w-[3.5rem] shrink-0 rounded-xl bg-secondary/40 px-3 py-2 text-center"
                >
                  <p className="label-editorial !text-[0.58rem]">
                    {dayDate ? format(dayDate, 'EEE', { locale: dateLocale }) : '—'}
                  </p>
                  <div className="mt-1.5 flex justify-center">
                    <WeatherMiniIcon condition={forecast?.condition} className="h-3.5 w-3.5" />
                  </div>
                  <p className="mt-1.5 text-xs font-medium text-foreground">
                    {forecast ? `${forecast.temperature_max}°` : '—'}
                  </p>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* ── Stats line ── */}
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{totalItems}</span> pieces{' · '}
          <span className="font-medium text-foreground">{result.outfits.length}</span> looks{' · '}
          <span className="font-medium text-foreground">{packedCount}/{totalItems}</span> packed
        </p>

        {/* ── Partial results banner ── */}
        {(() => {
          const gaps: CapsuleCoverageGap[] = result.coverage_gaps ?? [];
          if (gaps.length === 0) return null;
          const missing = gaps
            .flatMap((g) => g.missing_slots ?? [])
            .filter((s, i, arr) => Boolean(s) && arr.indexOf(s) === i);
          const lookLabel = result.outfits.length === 1
            ? t('capsule.partial_results.look_singular')
            : t('capsule.partial_results.look_plural');
          const listFormatter = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' });
          const missingSummary = listFormatter.format(missing);
          const gapMessage = missing.length > 0
            ? t('capsule.partial_results.add_more').replace('{items}', missingSummary)
            : gaps.map((g) => g.message).filter(Boolean).join(' ');
          return (
            <div className="mt-4 border-l-2 border-amber-500/40 py-2 pl-3">
              <p className="text-sm font-medium text-foreground">
                {t('capsule.partial_results.title')
                  .replace('{count}', String(result.outfits.length))
                  .replace('{lookLabel}', lookLabel)}
              </p>
              {gapMessage ? (
                <p className="mt-1 text-xs text-muted-foreground">{gapMessage}</p>
              ) : null}
            </div>
          );
        })()}

        {/* ── Divider + Tab bar ── */}
        <div className="mt-5 border-t border-border/40 pt-5">
          <div className="flex gap-8">
            {(['packing', 'outfits'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  hapticLight();
                  setActiveTab(tab);
                }}
                className={cn(
                  'pb-1 text-sm font-medium uppercase tracking-[0.12em] border-b-2 transition-colors',
                  activeTab === tab
                    ? 'text-foreground border-accent'
                    : 'text-muted-foreground hover:text-foreground border-transparent',
                )}
              >
                {tab === 'packing' ? t('capsule.tab_packing') : t('capsule.tab_outfits')}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ── */}
        <AnimatePresence mode="wait">
          {activeTab === 'packing' ? (
            <CapsuleSummary
              result={result}
              groupedItems={groupedItems}
              checkedItems={checkedItems}
              toggleChecked={toggleChecked}
              itemOutfitCount={itemOutfitCount}
              capsuleItemIds={capsuleItemIds}
              garmentMap={garmentMap}
              allGarmentsMap={allGarmentsMap}
              totalItems={totalItems}
              packedCount={packedCount}
            />
          ) : (
            <motion.div
              key="outfits"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.25, ease: EASE_CURVE }}
            >
              {(() => {
                const outfitsByDay = new Map<number, CapsuleOutfit[]>();
                for (const outfit of result.outfits) {
                  const list = outfitsByDay.get(outfit.day) || [];
                  list.push(outfit);
                  outfitsByDay.set(outfit.day, list);
                }

                let animationIndex = 0;

                return [...outfitsByDay.entries()]
                  .sort((first, second) => first[0] - second[0])
                  .map(([day, outfits], dayIdx) => {
                    const dayDate = dateRange?.from ? addDays(dateRange.from, day - 1) : null;
                    const dayForecast = tripDayForecasts[day - 1] ?? null;

                    return (
                      <div key={`day-${day}`} className={dayIdx === 0 ? 'mt-4' : 'mt-8'}>
                        {/* Day header */}
                        <h2 className="font-display italic text-xl text-foreground">Day {day}</h2>
                        <div className="mt-0.5 mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                          {dayDate ? (
                            <span>{format(dayDate, 'EEE MMM d', { locale: dateLocale })}</span>
                          ) : null}
                          {dayForecast ? (
                            <>
                              <span className="opacity-40">·</span>
                              <WeatherMiniIcon condition={dayForecast.condition} className="h-3.5 w-3.5" />
                              <span>{dayForecast.temperature_max}°C</span>
                            </>
                          ) : null}
                        </div>

                        {/* Outfits for this day */}
                        {outfits.map((outfit, outfitIdx) => {
                          const currentIndex = animationIndex;
                          animationIndex += 1;

                          return (
                            <div key={`${day}-${currentIndex}`}>
                              {outfitIdx > 0 ? (
                                <div className="border-t border-border/20 pt-3 mt-3" />
                              ) : null}
                              <CapsuleOutfitCard
                                outfit={outfit}
                                animationIndex={currentIndex}
                                garmentMap={garmentMap}
                                allGarmentsMap={allGarmentsMap}
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  });
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </AnimatedPage>

      {/* ── Floating action bar ── */}
      <div
        className="fixed inset-x-4 z-20"
        style={{ bottom: 'calc(var(--app-safe-area-bottom, 0px) + 0.75rem)' }}
      >
        <div className="mx-auto max-w-md">
          <div className="action-bar-floating flex items-center gap-2 rounded-[1.6rem] p-2">
            {isAddingToCalendar ? (
              <div className="w-full">
                <AILoadingCard
                  phases={[
                    { icon: CalendarPlus, label: t('capsule.saving_outfits') || 'Saving outfits...', duration: 1500 },
                    { icon: CalendarDays, label: t('capsule.planning_days') || 'Planning days...', duration: 1500 },
                    { icon: Check, label: t('capsule.syncing') || 'Syncing calendar...', duration: 0 },
                  ]}
                />
              </div>
            ) : addedToCalendar ? (
              <Button
                onClick={() => {
                  hapticLight();
                  navigate('/plan', {
                    state: { selectedDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined },
                  });
                }}
                className="flex-1"
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                {t('capsule.view_in_planner') || 'View in Planner'}
              </Button>
            ) : (
              <>
                <Button onClick={handleAddToCalendar} className="flex-1">
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  {t('capsule.add_to_plan')}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setResult(null);
                    setAddedToCalendar(false);
                  }}
                  className="px-3 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Start over
                </button>
              </>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                hapticLight();
                toast(t('capsule.share_coming_soon'));
              }}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
```

Key changes from the current file:
- Removed imports: `Card`, `PageIntro`
- Hero: direct typography instead of `PageIntro`, no `<Card>` wrapper
- Stats: single typographic line instead of 3-column card grid
- Weather: inline in date line + horizontal scrollable pills instead of bordered grid
- Partial results: left-border accent instead of rounded amber card
- Tab bar: underline tabs instead of pill toggle
- Outfits tab: day sections with Playfair italic headers + date/weather meta, no `<Card>` per day, dividers between multiple outfits per day
- Action bar: `p-2` instead of `p-3`, removed `flex-wrap`, "Start over" is a `<button>` styled as ghost text instead of `<Button variant="outline">`

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: 0 errors.

- [ ] **Step 3: Run lint**

Run: `npx eslint src/components/travel/TravelResultsView.tsx --max-warnings 0`
Expected: 0 warnings.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Clean build, no warnings.

- [ ] **Step 5: Commit**

```bash
git add src/components/travel/TravelResultsView.tsx
git commit -m "Prompt 41: Rewrite TravelResultsView as editorial Travel Edit layout"
```

---

### Task 4: Rewrite CapsuleSummary — Editorial Packing Tab

**Files:**
- Modify: `src/components/travel/CapsuleSummary.tsx` (full JSX rewrite, same props interface)

- [ ] **Step 1: Rewrite the full component**

Replace the entire file content with:

```tsx
import { motion } from 'framer-motion';
import { Check, LightbulbIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { hapticLight } from '@/lib/haptics';
import { EASE_CURVE, STAGGER_DELAY } from '@/lib/motion';
import { cn } from '@/lib/utils';

import type { CapsuleResult } from './types';

interface CapsuleSummaryProps {
  result: CapsuleResult;
  groupedItems: Record<string, Array<{ id: string; title: string; image_path: string; category: string }>>;
  checkedItems: Set<string>;
  toggleChecked: (id: string) => void;
  itemOutfitCount: Map<string, number>;
  capsuleItemIds: string[];
  garmentMap: Map<string, { id: string; title: string; image_path: string; category: string }>;
  allGarmentsMap: Map<string, { id: string; title: string; image_path: string; category: string }>;
  totalItems: number;
  packedCount: number;
}

export function CapsuleSummary({
  result,
  groupedItems,
  checkedItems,
  toggleChecked,
  itemOutfitCount,
  capsuleItemIds,
  garmentMap,
  allGarmentsMap,
  totalItems,
  packedCount,
}: CapsuleSummaryProps) {
  const { t } = useLanguage();

  return (
    <motion.div
      key="packing"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.25, ease: EASE_CURVE }}
    >
      {/* ── Progress indicator ── */}
      <div className="mt-4">
        <div className="h-1 overflow-hidden rounded-full bg-muted/20">
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${totalItems > 0 ? (packedCount / totalItems) * 100 : 0}%` }}
            transition={{ duration: 0.4, ease: EASE_CURVE }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{packedCount}</span> of {totalItems} packed
          </p>
          <span className="eyebrow-chip !bg-secondary/70">
            {result.outfits.length} outfits
          </span>
        </div>
      </div>

      {/* ── Category sections ── */}
      {Object.entries(groupedItems).map(([category, items], categoryIndex) => {
        const categoryOutfitUses = (items || []).reduce(
          (sum, garment) => sum + (itemOutfitCount.get(garment.id) || 0),
          0,
        );

        return (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: categoryIndex * STAGGER_DELAY, duration: 0.35 }}
            className="mt-4 border-t border-border/40 pt-4"
          >
            {/* Category header */}
            <div className="mb-3 flex items-baseline gap-2">
              <span className="label-editorial">{category}</span>
              <span className="text-xs text-muted-foreground/70">
                · {(items || []).length} pieces · {t('capsule.used_in').toLowerCase()} {categoryOutfitUses} {t('capsule.outfits_label')}
              </span>
            </div>

            {/* Garment rows */}
            {(items || []).map((garment) => (
              <button
                key={garment.id}
                onClick={() => {
                  hapticLight();
                  toggleChecked(garment.id);
                }}
                className="flex w-full items-center gap-3 rounded-xl py-2.5 px-1 text-left transition-colors hover:bg-secondary/30"
              >
                {/* Circle checkbox */}
                <div
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all',
                    checkedItems.has(garment.id)
                      ? 'border-accent bg-accent'
                      : 'border-muted-foreground/30',
                  )}
                >
                  {checkedItems.has(garment.id) ? (
                    <Check className="h-3 w-3 text-accent-foreground" />
                  ) : null}
                </div>

                {/* Thumbnail */}
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-[1rem] bg-muted/30">
                  <LazyImageSimple
                    imagePath={getPreferredGarmentImagePath(garment)}
                    alt={garment.title}
                    className="h-full w-full"
                  />
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate text-[0.85rem] font-medium',
                      checkedItems.has(garment.id)
                        ? 'text-muted-foreground line-through'
                        : 'text-foreground',
                    )}
                  >
                    {garment.title}
                  </span>
                  <span className="text-[0.72rem] text-muted-foreground/70">
                    {t('capsule.used_in')} {itemOutfitCount.get(garment.id) || 0} {t('capsule.outfits_label')}
                  </span>
                </div>
              </button>
            ))}
          </motion.div>
        );
      })}

      {/* ── Packing tips ── */}
      {result.packing_tips.length > 0 ? (
        <div className="mt-6 border-t border-border/40 pt-4">
          <div className="mb-2.5 flex items-center gap-1.5">
            <LightbulbIcon className="h-3 w-3 text-muted-foreground" />
            <span className="label-editorial">{t('capsule.tips')}</span>
          </div>
          <ul className="space-y-1.5">
            {result.packing_tips.map((tip, index) => (
              <li key={index} className="flex gap-2 text-xs text-muted-foreground/70">
                <span className="shrink-0 text-accent">·</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ── Copy packing list button ── */}
      <Button
        onClick={() => {
          hapticLight();
          const garmentTitles = capsuleItemIds
            .map((id) => garmentMap.get(id) ?? allGarmentsMap.get(id))
            .filter(Boolean)
            .map((garment) => `- ${garment!.title}`)
            .join('\n');

          navigator.clipboard.writeText(garmentTitles);
          toast.success('Packing list copied');
        }}
        variant="editorial"
        className="mt-5 w-full"
      >
        Copy packing list
      </Button>
    </motion.div>
  );
}
```

Key changes from the current file:
- Removed imports: `Card`, `Shirt`
- Removed `<Card>` wrappers from progress area, categories, and tips
- Progress bar: `h-1` (thinner) with `bg-muted/20` track instead of `bg-muted/30`
- Category sections: `border-t border-border/40` dividers instead of `<Card>` wrappers
- Category header: inline `label-editorial` + meta instead of separate header block
- Garment rows: no border (`rounded-[1.35rem] border p-3` removed), just `rounded-xl py-2.5 px-1` with hover state
- Checkbox: `rounded-full` (circle) instead of `rounded-md` (square)
- Added `hapticLight()` to checkbox tap and copy button
- Removed: coverage gaps section (shown once above tabs in TravelResultsView)
- Removed: summary footer card (`{totalItems} items · creates {n} unique outfits`)
- Tip bullets: `text-accent` instead of `text-primary`

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: 0 errors.

- [ ] **Step 3: Run lint**

Run: `npx eslint src/components/travel/CapsuleSummary.tsx --max-warnings 0`
Expected: 0 warnings.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Clean build, no warnings.

- [ ] **Step 5: Commit**

```bash
git add src/components/travel/CapsuleSummary.tsx
git commit -m "Prompt 41: Rewrite CapsuleSummary as editorial packing tab"
```

---

### Task 5: Final verification + PR

- [ ] **Step 1: Run full QA suite**

```bash
npx tsc --noEmit --skipLibCheck
npx eslint src/ --ext .ts,.tsx --max-warnings 0
npm run build
npx vitest run
```

Expected: 0 tsc errors, 0 lint warnings, clean build, all tests pass.

- [ ] **Step 2: Create PR branch and push**

```bash
git checkout -b prompt-41-travel-edit-redesign main
git cherry-pick <commit-hash-task-1> <commit-hash-task-2> <commit-hash-task-3> <commit-hash-task-4>
git push origin prompt-41-travel-edit-redesign
```

Note: If already working on a feature branch from the start, just push and create PR directly.

- [ ] **Step 3: Create PR**

```bash
gh pr create --title "Prompt 41: Travel capsule editorial redesign + garment cap fix" --body "$(cat <<'EOF'
## What changed

- **TravelResultsView**: Rewrote as editorial "Travel Edit" layout — Playfair Display hero header, inline weather + forecast strip, typographic stats line, underline tabs, cardless day-grouped outfits with date/weather meta, slimmer action bar with ghost "Start over" text
- **CapsuleSummary**: Editorial packing tab — thin progress bar, borderless garment rows with circle checkmarks, category dividers, cardless tips section, removed duplicate coverage gaps
- **TravelStep2**: Removed `.slice(0, 32)` hard cap on must-haves garment picker, added scrollable container with fade gradient
- **index.css**: Added `.scroll-fade-bottom` utility class

## What did NOT change

- No data flow, hook, or edge function changes
- No DB migrations
- `CapsuleOutfitCard`, `OutfitSuggestionCard`, `GarmentSelectionPanel` untouched
- All component prop interfaces identical

## Test plan

- [ ] TypeScript: 0 errors
- [ ] Lint: 0 warnings
- [ ] Build: clean
- [ ] Tests: all pass
- [ ] Manual: results page renders correctly for 0, 1, and multi-day outfits
- [ ] Manual: garment picker in Step 2 shows all garments (>32) with scroll
- [ ] Manual: packing checkboxes toggle correctly
- [ ] Manual: light + dark mode visual check
- [ ] Manual: action bar safe-area handling on iOS
EOF
)"
```

- [ ] **Step 4: Report back**

```
✅ TypeScript: 0 errors
✅ Lint: 0 warnings
✅ Build: clean (no warnings)
✅ Tests: [passed / not applicable]
✅ Committed: [hash] on branch prompt-41-travel-edit-redesign
✅ Deployed: none
⚠️ Notes: [anything unexpected, or "none"]
PR: [URL]
```
