import { useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, CalendarIcon, Pencil,
  CalendarPlus, Check, Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { AILoadingCard } from '@/components/ui/AILoadingCard';
import { CapsuleOutfitCard } from '@/components/travel/CapsuleOutfitCard';
import { CapsuleSummary } from '@/components/travel/CapsuleSummary';
import { WeatherMiniIcon } from '@/components/travel/WeatherMiniIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { EASE_CURVE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ForecastDay } from '@/hooks/useForecast';
import type { CapsuleOutfit, CapsuleResult, VibeId } from './types';
import type { DateRange } from 'react-day-picker';

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
  setResult: (v: CapsuleResult | null) => void;
  setAddedToCalendar: (v: boolean) => void;
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
      <div className="flex flex-col h-[100dvh] max-w-lg mx-auto">
        {/* Sticky Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_CURVE }}
          className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/10 px-5 pt-12 pb-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-muted/30 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold">{destination} {t('capsule.trip_suffix')}</h1>
                <p className="text-[11px] text-muted-foreground">
                  {dateLabel} • {dateSublabel}
                </p>
              </div>
            </div>
            <button
              onClick={() => setResult(null)}
              className="p-2 rounded-xl hover:bg-muted/30 transition-colors"
            >
              <Pencil className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </motion.div>

        {/* Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: EASE_CURVE }}
          className="mx-5 mt-4 p-5 rounded-xl bg-[#F5F0E8] border border-border/10"
        >
          <h2 style={{
            fontFamily: '"Playfair Display", serif',
            fontStyle: 'italic',
            fontSize: 22,
            color: '#1C1917',
            margin: 0,
            marginBottom: 6,
          }}>
            {destination}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {dateLabel && <span className="text-[12px] text-muted-foreground">{dateLabel}</span>}
            <span style={{
              fontFamily: 'DM Sans, sans-serif', fontSize: 10, background: '#1C1917',
              color: '#F5F0E8', padding: '2px 8px', textTransform: 'capitalize',
            }}>
              {vibe}
            </span>
            <span className="text-[12px] text-muted-foreground">
              {totalItems} items · {result.outfits.length} outfits
            </span>
          </div>
          {weatherForecast && (
            <div className="flex items-center gap-1.5 mt-2">
              <WeatherMiniIcon condition={weatherForecast.condition} className="w-3 h-3" />
              <span className="text-[11px] text-muted-foreground">
                {weatherForecast.temperature_min}–{weatherForecast.temperature_max}°C · {weatherForecast.condition}
              </span>
            </div>
          )}
        </motion.div>

        {/* Weather Strip */}
        {tripDayForecasts.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="px-5 py-2.5 border-b border-border/5"
          >
            <div className="flex gap-1 overflow-x-auto scrollbar-none -mx-1 px-1">
              {tripDayForecasts.map((forecast, i) => {
                const dayDate = dateRange?.from ? addDays(dateRange.from, i) : null;
                return (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-0.5 min-w-[48px] shrink-0 py-1"
                  >
                    <span className="text-[9px] text-muted-foreground/60 uppercase font-medium">
                      {dayDate ? format(dayDate, 'EEE', { locale: dateLocale }) : '—'}
                    </span>
                    <WeatherMiniIcon condition={forecast?.condition} className="w-3 h-3" />
                    <span className="text-[10px] font-medium text-foreground">
                      {forecast ? `${forecast.temperature_max}°` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Tab Toggle */}
        <div className="px-5 pt-3 pb-1">
          <div className="flex gap-1 p-0.5 rounded-xl bg-muted/20">
            {(['packing', 'outfits'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { hapticLight(); setActiveTab(tab); }}
                className={cn(
                  'flex-1 py-2 rounded-lg text-xs font-medium transition-all',
                  activeTab === tab
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground/60 hover:text-muted-foreground'
                )}
              >
                {tab === 'packing' ? t('capsule.tab_packing') : t('capsule.tab_outfits')}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-28">
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
                className="space-y-3 pt-3"
              >
                {(() => {
                  const byDay = new Map<number, CapsuleOutfit[]>();
                  for (const outfit of result.outfits) {
                    const list = byDay.get(outfit.day) || [];
                    list.push(outfit);
                    byDay.set(outfit.day, list);
                  }
                  let animIdx = 0;
                  return [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([day, outfits]) => (
                    <div key={`day-${day}`} className="space-y-2">
                      <p style={{ fontFamily: 'DM Sans', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(28,25,23,0.45)', marginBottom: 4 }}>
                        Day {day}
                      </p>
                      {outfits.map((outfit) => {
                        const idx = animIdx++;
                        return (
                          <CapsuleOutfitCard
                            key={idx}
                            outfit={outfit}
                            animationIndex={idx}
                            garmentMap={garmentMap}
                            allGarmentsMap={allGarmentsMap}
                          />
                        );
                      })}
                    </div>
                  ));
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sticky Bottom Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="sticky bottom-0 z-20 bg-background/90 backdrop-blur-xl border-t border-border/10 px-5 py-3 flex gap-2"
        >
          {isAddingToCalendar ? (
            <div className="flex-1">
              <AILoadingCard
                phases={[
                  { icon: CalendarPlus, label: t('capsule.saving_outfits') || 'Saving outfits...', duration: 1500 },
                  { icon: CalendarIcon, label: t('capsule.planning_days') || 'Planning days...', duration: 1500 },
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
              className="flex-1 h-11 rounded-xl"
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              {t('capsule.view_in_planner') || 'View in Planner'}
            </Button>
          ) : (
            <>
              <Button
                onClick={handleAddToCalendar}
                className="flex-1 h-11 rounded-xl"
              >
                <CalendarPlus className="w-4 h-4 mr-2" />
                {t('capsule.add_to_plan')}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setResult(null); setAddedToCalendar(false); }}
                className="h-11 rounded-xl px-4"
              >
                Start over
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-xl shrink-0"
            onClick={() => { hapticLight(); toast(t('capsule.share_coming_soon')); }}
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>
    </AppLayout>
  );
}
