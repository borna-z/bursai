import { addDays, format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CalendarDays, CalendarPlus, Check, Pencil, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { AppLayout } from '@/components/layout/AppLayout';
import { AILoadingCard } from '@/components/ui/AILoadingCard';
import { AnimatedPage } from '@/components/ui/animated-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageIntro } from '@/components/ui/page-intro';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { EASE_CURVE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { ForecastDay } from '@/hooks/useForecast';
import type { DateRange } from 'react-day-picker';

import { CapsuleOutfitCard } from '@/components/travel/CapsuleOutfitCard';
import { CapsuleSummary } from '@/components/travel/CapsuleSummary';
import { WeatherMiniIcon } from '@/components/travel/WeatherMiniIcon';
import type { CapsuleOutfit, CapsuleResult, VibeId } from './types';

type GarmentLike = { id: string; title: string; image_path: string; category: string; color_primary?: string };

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
  const { t } = useLanguage();

  return (
    <AppLayout hideNav>
      <AnimatedPage className="page-shell !px-5 !pb-36 !pt-6 page-cluster">
        <Card surface="editorial" className="space-y-5 p-5">
          <div className="flex items-center justify-between gap-3">
            <Button variant="quiet" size="icon" onClick={() => navigate(-1)} aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setResult(null)} aria-label="Edit capsule">
              <Pencil className="h-4 w-4" />
            </Button>
          </div>

          <PageIntro
            eyebrow="Travel capsule"
            meta={<span className="eyebrow-chip !bg-secondary/70 capitalize">{vibe}</span>}
            title={destination}
            description={[dateLabel, dateSublabel].filter(Boolean).join(' • ')}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="surface-inset rounded-[1.35rem] border p-4">
              <p className="label-editorial">Packed pieces</p>
              <p className="mt-2 text-[1.6rem] font-semibold tracking-[-0.05em]">{totalItems}</p>
            </div>
            <div className="surface-inset rounded-[1.35rem] border p-4">
              <p className="label-editorial">Looks planned</p>
              <p className="mt-2 text-[1.6rem] font-semibold tracking-[-0.05em]">{result.outfits.length}</p>
            </div>
            <div className="surface-inset rounded-[1.35rem] border p-4">
              <p className="label-editorial">Trip status</p>
              <p className="mt-2 text-[1.6rem] font-semibold tracking-[-0.05em]">{packedCount}/{totalItems}</p>
            </div>
          </div>

          {weatherForecast ? (
            <div className="surface-inset flex items-center gap-3 rounded-[1.35rem] border px-4 py-3">
              <WeatherMiniIcon condition={weatherForecast.condition} className="h-4 w-4" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Forecast snapshot</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {weatherForecast.temperature_min}–{weatherForecast.temperature_max}°C • {weatherForecast.condition}
                </p>
              </div>
            </div>
          ) : null}

          {tripDayForecasts.length > 0 ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {tripDayForecasts.map((forecast, index) => {
                const dayDate = dateRange?.from ? addDays(dateRange.from, index) : null;

                return (
                  <div
                    key={`forecast-${index}`}
                    className="surface-inset min-w-0 rounded-[1.2rem] border px-3 py-2 text-center"
                  >
                    <p className="label-editorial !text-[0.58rem]">
                      {dayDate ? format(dayDate, 'EEE', { locale: dateLocale }) : '—'}
                    </p>
                    <div className="mt-2 flex justify-center">
                      <WeatherMiniIcon condition={forecast?.condition} className="h-4 w-4" />
                    </div>
                    <p className="mt-2 text-xs font-medium text-foreground">
                      {forecast ? `${forecast.temperature_max}°` : '—'}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : null}
        </Card>

        <div className="surface-inset flex rounded-full border p-1.5">
          {(['packing', 'outfits'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                hapticLight();
                setActiveTab(tab);
              }}
              className={cn(
                'flex-1 rounded-full px-4 py-2.5 text-[0.74rem] font-medium uppercase tracking-[0.16em] transition-all',
                activeTab === tab
                  ? 'bg-foreground text-background shadow-[0_10px_24px_rgba(28,25,23,0.12)]'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab === 'packing' ? t('capsule.tab_packing') : t('capsule.tab_outfits')}
            </button>
          ))}
        </div>

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
              className="space-y-4"
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
                  .map(([day, outfits]) => (
                    <Card key={`day-${day}`} surface="utility" className="space-y-3 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="label-editorial">Day {day}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{outfits.length} looks planned</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {outfits.map((outfit) => {
                          const currentIndex = animationIndex;
                          animationIndex += 1;

                          return (
                            <CapsuleOutfitCard
                              key={`${day}-${currentIndex}`}
                              outfit={outfit}
                              animationIndex={currentIndex}
                              garmentMap={garmentMap}
                              allGarmentsMap={allGarmentsMap}
                            />
                          );
                        })}
                      </div>
                    </Card>
                  ));
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </AnimatedPage>

      <div className="bottom-safe-nav fixed inset-x-4 z-20">
        <div className="mx-auto max-w-md">
          <div className="action-bar-floating flex flex-wrap gap-2 rounded-[1.6rem] p-3">
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
                <Button
                  variant="outline"
                  onClick={() => {
                    setResult(null);
                    setAddedToCalendar(false);
                  }}
                >
                  Start over
                </Button>
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
