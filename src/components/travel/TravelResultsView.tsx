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
import { VIBES } from './types';
import type { CapsuleCoverageGap, CapsuleOutfit, CapsuleResult, VibeId } from './types';

type GarmentLike = { id: string; title: string; image_path: string; category: string; color_primary?: string };

interface TravelResultsViewProps {
  result: CapsuleResult;
  destination: string;
  vibe: VibeId;
  dateLabel: string | null;
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
          <Button variant="quiet" size="icon" onClick={() => navigate(-1)} aria-label={t('common.back')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="quiet" size="icon" onClick={() => setResult(null)} aria-label={t('capsule.edit_label')}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>

        {/* ── Destination title ── */}
        <h1 className="mt-4 font-display italic text-3xl tracking-tight text-foreground">
          {destination}
        </h1>

        {/* ── Vibe chip ── */}
        <span className="mt-2 inline-block eyebrow-chip !bg-secondary/70 capitalize">
          {VIBES.find(v => v.id === vibe)?.label ?? vibe}
        </span>

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
          <span className="font-medium text-foreground">{totalItems}</span> {t('capsule.stat_pieces')}{' · '}
          <span className="font-medium text-foreground">{result.outfits.length}</span> {t('capsule.stat_looks')}{' · '}
          <span className="font-medium text-foreground">{packedCount}/{totalItems}</span> {t('capsule.stat_packed')}
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
                        <h2 className="font-display italic text-xl text-foreground">{t('capsule.day_header').replace('{day}', String(day))}</h2>
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
                  {t('capsule.start_over')}
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
