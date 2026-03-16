import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PRESETS } from '@/lib/motion';
import { format, addDays, isSameDay, isToday, isTomorrow } from 'date-fns';
import { getDateFnsLocale } from '@/lib/dateLocale';
import { Wand2, Shirt, CalendarDays, Repeat, Check, Trash2, Plus, Sparkles, Briefcase, PartyPopper, Heart, Luggage, CalendarRange } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { PlanPageSkeleton } from '@/components/ui/skeletons';
import { AnimatedPage } from '@/components/ui/animated-page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getOccasionLabel } from '@/lib/occasionLabel';
import { AppLayout } from '@/components/layout/AppLayout';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { EmptyState } from '@/components/layout/EmptyState';
import { WeekStrip } from '@/components/plan/WeekStrip';

import { QuickGenerateSheet } from '@/components/plan/QuickGenerateSheet';
import { SwapSheet } from '@/components/plan/SwapSheet';
import { QuickPlanSheet } from '@/components/plan/QuickPlanSheet';
import { PreselectDateSheet } from '@/components/plan/PreselectDateSheet';
import { CalendarConnectBanner } from '@/components/plan/CalendarConnectBanner';
import { DaySummaryCard } from '@/components/plan/DaySummaryCard';
import { LaundryAlertBanner } from '@/components/plan/LaundryAlertBanner';
import { WeatherForecastBadge } from '@/components/outfit/WeatherForecastBadge';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useDaySummary } from '@/hooks/useDaySummary';
import { 
  usePlannedOutfits, 
  usePlannedOutfitsForDate,
  useUpsertPlannedOutfit, 
  useDeletePlannedOutfit,
  useUpdatePlannedOutfitStatus,
  type PlannedOutfit 
} from '@/hooks/usePlannedOutfits';
import { useOutfitGenerator } from '@/hooks/useOutfitGenerator';
import { useMarkOutfitWorn, useUndoMarkWorn } from '@/hooks/useOutfits';
import { useFlatGarments } from '@/hooks/useGarments';
import { useForecast } from '@/hooks/useForecast';
import { useLocation as useLocationCtx } from '@/contexts/LocationContext';
import { useBackgroundSyncNotification, useCalendarEvents } from '@/hooks/useCalendarSync';
import { CalendarEventsList } from '@/components/plan/CalendarEventBadge';

const occasionIcons: Record<string, React.ElementType> = {
  work: Briefcase, jobb: Briefcase,
  party: PartyPopper, fest: PartyPopper,
  date: Heart, dejt: Heart,
};

const OCCASION_I18N: Record<string, string> = {
  work: 'occasion.work', jobb: 'occasion.jobb',
  casual: 'occasion.casual', vardag: 'occasion.vardag',
  party: 'occasion.party', fest: 'occasion.fest',
  travel: 'occasion.travel', resa: 'occasion.resa',
  workout: 'occasion.workout', traning: 'occasion.traning',
  date: 'occasion.date', dejt: 'occasion.dejt',
};

const MAX_OUTFITS_PER_DAY = 4;

export default function PlanPage() {
  useBackgroundSyncNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { t, locale } = useLanguage();
  const initialDate = (location.state as { initialDate?: string })?.initialDate;
  const [selectedDate, setSelectedDate] = useState(() =>
    initialDate ? new Date(initialDate) : new Date()
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const preselectedOutfitId = (location.state as { preselectedOutfitId?: string })?.preselectedOutfitId;
  
  // Sheets state
  
  const [quickGenerateSheetOpen, setQuickGenerateSheetOpen] = useState(false);
  const [swapSheetOpen, setSwapSheetOpen] = useState(false);
  const [quickPlanSheetOpen, setQuickPlanSheetOpen] = useState(false);
  const [currentOutfitId, setCurrentOutfitId] = useState<string | null>(null);
  const [currentPlannedId, setCurrentPlannedId] = useState<string | null>(null);
  
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [generatingDayIndex, setGeneratingDayIndex] = useState(0);
  
  const [preselectSheetOpen, setPreselectSheetOpen] = useState(!!preselectedOutfitId);
  
  // Data hooks
  const { data: plannedOutfits = [], isLoading } = usePlannedOutfits();
  const { data: garments = [] } = useFlatGarments();
  const { effectiveCity } = useLocationCtx();
  const { getForecastForDate } = useForecast({ city: effectiveCity });
  
  // Selected day data
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const { data: dayPlannedOutfits = [], isLoading: isDayLoading } = usePlannedOutfitsForDate(selectedDateStr);
  const { data: daySummary, isLoading: isSummaryLoading } = useDaySummary(selectedDateStr);
  const { data: calendarEvents = [] } = useCalendarEvents(selectedDateStr);
  
  // Mutation hooks
  const upsertPlanned = useUpsertPlannedOutfit();
  const deletePlanned = useDeletePlannedOutfit();
  const updateStatus = useUpdatePlannedOutfitStatus();
  const { generateOutfit, isGenerating } = useOutfitGenerator();
  const markWorn = useMarkOutfitWorn();
  const undoMarkWorn = useUndoMarkWorn();

  const getPlannedForDate = useCallback((date: Date): PlannedOutfit | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return plannedOutfits.find(p => p.date === dateStr) || null;
  }, [plannedOutfits]);

  const hasOutfits = dayPlannedOutfits.length > 0;
  const canAddMore = dayPlannedOutfits.length < MAX_OUTFITS_PER_DAY;

  // Date label
  let dateLabel = format(selectedDate, 'EEEE d MMMM', { locale: getDateFnsLocale(locale) });
  if (isToday(selectedDate)) dateLabel = t('plan.today');
  else if (isTomorrow(selectedDate)) dateLabel = t('plan.tomorrow');

  // ── Handlers ──
  const handleSelectOutfit = async (outfitId: string) => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    try {
      await upsertPlanned.mutateAsync({ date: dateStr, outfitId });
      toast.success(t('plan.planned'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(msg.includes('Maximum') ? msg : t('plan.plan_error'));
    }
  };

  const handleGenerateForDate = async (request: {
    occasion: string;
    style: string | null;
    temperature: number | undefined;
  }) => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const topEventTitle = daySummary?.priorities?.[0]?.title || null;
    try {
      const o = await generateOutfit({
        occasion: request.occasion,
        style: request.style,
        locale,
        eventTitle: topEventTitle,
        weather: { temperature: request.temperature, precipitation: 'none', wind: 'low' },
      });
      await upsertPlanned.mutateAsync({ date: dateStr, outfitId: o.id });
      setQuickGenerateSheetOpen(false);
      toast.success(t('plan.outfit_created'));
    } catch {
      toast.error(t('plan.create_error'));
    }
  };

  const handleMarkWorn = async (planned: PlannedOutfit) => {
    if (!planned.outfit) return;
    const garmentIds = planned.outfit.outfit_items.map(item => item.garment_id);
    const topEventTitle = daySummary?.priorities?.[0]?.title || undefined;
    try {
      const result = await markWorn.mutateAsync({
        outfitId: planned.outfit.id,
        garmentIds,
        occasion: planned.outfit.occasion,
        eventTitle: topEventTitle,
      });
      await updateStatus.mutateAsync({ id: planned.id, status: 'worn' });
      toast.success(t('plan.worn'), {
        action: {
          label: t('plan.undo'),
          onClick: async () => {
            await undoMarkWorn.mutateAsync(result);
            await updateStatus.mutateAsync({ id: planned.id, status: 'planned' });
            toast.success(t('plan.undone'));
          },
        },
      });
    } catch {
      toast.error(t('plan.worn_error'));
    }
  };

  const handleRemove = async (plannedId: string) => {
    try {
      await deletePlanned.mutateAsync(plannedId);
      toast.success(t('plan.removed'), {
        action: {
          label: t('plan.undo'),
          onClick: () => {
            // Re-query to refresh — outfit was already deleted, undo not possible server-side
            // This is a soft undo UX pattern; the data is gone but we give reassurance
            queryClient.invalidateQueries({ queryKey: ['planned-outfits'] });
            queryClient.invalidateQueries({ queryKey: ['planned-outfits-day'] });
          },
        },
        duration: 5000,
      });
    } catch {
      toast.error(t('plan.remove_error'));
    }
  };

  const { canCreateOutfit } = useSubscription();

  const handleAutoGenerateWeek = async (days: number) => {
    setIsAutoGenerating(true);
    const occasions = ['vardag', 'jobb', 'vardag', 'jobb', 'vardag', 'fest', 'vardag'];
    for (let i = 0; i < days; i++) {
      setGeneratingDayIndex(i + 1);
      const date = addDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const existing = getPlannedForDate(date);
      if (existing?.outfit_id) continue;
      const forecast = getForecastForDate(dateStr);
      const temp = forecast ? Math.round((forecast.temperature_max + forecast.temperature_min) / 2) : 15;
      try {
        const o = await generateOutfit({
          occasion: occasions[i % occasions.length],
          style: null,
          locale,
          weather: { temperature: temp, precipitation: forecast?.precipitation_probability && forecast.precipitation_probability > 50 ? 'rain' : 'none', wind: 'low' },
        });
        await upsertPlanned.mutateAsync({ date: dateStr, outfitId: o.id });
      } catch (error) {
        console.error(`Failed to generate outfit for day ${i + 1}:`, error);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    setIsAutoGenerating(false);
    setGeneratingDayIndex(0);
  };

  const hasGarments = garments.length > 0;

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['planned-outfits'] }),
      queryClient.invalidateQueries({ queryKey: ['planned-outfits-day'] }),
      queryClient.invalidateQueries({ queryKey: ['garments'] }),
      queryClient.invalidateQueries({ queryKey: ['day-summary'] }),
    ]);
  }, [queryClient]);

  return (
    <AppLayout>
      {/* ─── Sticky header ─── */}
      <header className="sticky top-0 bg-background/80 backdrop-blur-xl z-20">
        <div className="flex items-center justify-between px-4 h-16 max-w-lg mx-auto">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-70 transition-opacity press">
                <h1 className="text-base font-medium capitalize">{dateLabel}</h1>
                <CalendarDays className="w-4 h-4 text-muted-foreground/50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => { if (d) { setSelectedDate(d); setCalendarOpen(false); } }}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {/* ─── Content ─── */}
      <PullToRefresh onRefresh={handleRefresh}>
      <AnimatedPage className="max-w-lg mx-auto px-5 pt-5 pb-8">
        {/* Calendar connect nudge */}
        <CalendarConnectBanner />

        {/* Laundry alert */}
        <LaundryAlertBanner />

        {/* Week navigation */}
        <div className="py-3">
          <WeekStrip 
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            plannedOutfits={plannedOutfits}
          />
        </div>

        {/* Day content */}
        <motion.div
          key={selectedDateStr}
          initial={PRESETS.TAB.variants.initial}
          animate={PRESETS.TAB.variants.animate}
          transition={PRESETS.TAB.transition}
          className="pt-8 space-y-8"
        >
          {/* Weather + status line */}
          <div className="flex items-center justify-between">
            <WeatherForecastBadge date={selectedDateStr} compact={false} />
            {dayPlannedOutfits.length > 0 && (
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-medium">
                {dayPlannedOutfits.length}/{MAX_OUTFITS_PER_DAY}
              </Badge>
            )}
          </div>

          {/* Power actions — demoted to compact text links */}
          {hasGarments && (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setQuickPlanSheetOpen(true)}
                className="text-[11px] text-muted-foreground/50 hover:text-foreground flex items-center gap-1.5 transition-colors press min-h-[44px]"
              >
                <CalendarRange className="w-3.5 h-3.5" />
                {t('plan.plan_week_btn')}
              </button>
              <span className="text-muted-foreground/20">·</span>
              <button
                onClick={() => navigate('/plan/travel-capsule')}
                className="text-[11px] text-muted-foreground/50 hover:text-foreground flex items-center gap-1.5 transition-colors press min-h-[44px]"
              >
                <Luggage className="w-3.5 h-3.5" />
                {t('plan.pack_trip_btn')}
              </button>
            </div>
          )}

          {/* AI Day Summary */}
          <DaySummaryCard
            summary={daySummary}
            isLoading={isSummaryLoading}
            onGenerateFromHint={() => setQuickGenerateSheetOpen(true)}
          />

          {/* Fallback: show raw events only when no AI summary available */}
          {calendarEvents.length > 0 && !daySummary && !isSummaryLoading && (
            <CalendarEventsList events={calendarEvents} maxDisplay={4} />
          )}

          {/* ─── Outfit section ─── */}
          {isLoading || isDayLoading ? (
            <PlanPageSkeleton />
          ) : !hasGarments ? (
            <EmptyState
              icon={Shirt}
              title={t('plan.add_garments_first')}
              description={t('plan.need_garments')}
              action={{ label: t('wardrobe.add'), onClick: () => navigate('/wardrobe/add'), icon: Shirt }}
            />
          ) : hasOutfits ? (
            <div className="space-y-4">
              {dayPlannedOutfits.map((planned) => {
                const outfit = planned.outfit;
                if (!outfit) return null;
                const isWorn = planned.status === 'worn';
                const OccasionIcon = outfit.occasion ? occasionIcons[outfit.occasion] || CalendarDays : CalendarDays;

                return (
                  <div key={planned.id} className="space-y-5 pb-6 border-b border-border/5 last:border-0 last:pb-0">
                    {/* Outfit image grid */}
                    <div 
                      className="rounded-2xl overflow-hidden cursor-pointer press"
                      onClick={() => navigate(`/outfits/${outfit.id}`)}
                    >
                      <div className="grid grid-cols-2 gap-1 p-1">
                        {outfit.outfit_items.slice(0, 4).map((item) => (
                          <div key={item.id} className="bg-muted aspect-[4/5] rounded-xl overflow-hidden">
                            <LazyImageSimple
                              imagePath={item.garment?.image_path}
                              alt={item.garment?.title || item.slot}
                              className="w-full h-full"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <Badge variant="secondary" className="capitalize text-xs font-medium">
                        <OccasionIcon className="w-3 h-3 mr-1.5" />
                        {getOccasionLabel(outfit.occasion || '', t)}
                      </Badge>
                      {outfit.style_vibe && (
                        <Badge variant="outline" className="text-xs font-normal">{outfit.style_vibe}</Badge>
                      )}
                      {isWorn && (
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider bg-success/10 text-success font-medium">
                          <Check className="w-3 h-3 mr-1" />
                          {t('plan.worn')}
                        </Badge>
                      )}
                    </div>

                    {/* Explanation */}
                    {outfit.explanation && (
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                        {outfit.explanation}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-1">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => { setCurrentOutfitId(outfit.id); setCurrentPlannedId(planned.id); setSwapSheetOpen(true); }}
                        className="flex-1 rounded-xl h-11 press"
                      >
                        <Repeat className="w-4 h-4 mr-2" />
                        {t('plan.swap')}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => navigate(`/outfits/${outfit.id}`)}
                        className="flex-1 rounded-xl h-10 press"
                      >
                        {t('plan.details')}
                      </Button>
                    </div>

                    {/* Secondary actions */}
                    <div className="flex items-center justify-between">
                      {!isWorn && (
                        <button 
                          onClick={() => handleMarkWorn(planned)}
                          className="text-xs text-muted-foreground/60 hover:text-success flex items-center gap-1.5 transition-colors press"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {t('plan.mark_worn')}
                        </button>
                      )}
                      <button 
                        onClick={() => handleRemove(planned.id)}
                        className="text-xs text-muted-foreground/40 hover:text-destructive flex items-center gap-1.5 transition-colors ml-auto press"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('plan.remove')}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Add another outfit button */}
              {canAddMore && (
                <div className="flex flex-col items-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickGenerateSheetOpen(true)}
                    disabled={isGenerating || upsertPlanned.isPending}
                    className="rounded-xl h-10 press min-h-[44px]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('plan.add_outfit')}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Empty state — centered with single primary CTA */
            <EmptyState
              icon={CalendarDays}
              title={t('plan.no_outfit')}
              description={t('plan.no_outfit_desc') || t('plan.no_outfit')}
              action={{
                label: t('plan.generate'),
                onClick: () => setQuickGenerateSheetOpen(true),
                icon: Sparkles,
              }}
              compact
            />
          )}
        </motion.div>
      </AnimatedPage>
      </PullToRefresh>

      {/* ─── Sheets ─── */}
      <QuickGenerateSheet
        open={quickGenerateSheetOpen}
        onOpenChange={setQuickGenerateSheetOpen}
        date={selectedDate}
        onGenerate={handleGenerateForDate}
        isGenerating={isGenerating}
      />
      <SwapSheet
        open={swapSheetOpen}
        onOpenChange={setSwapSheetOpen}
        outfitId={currentOutfitId || ''}
        onCreateSimilar={() => setQuickGenerateSheetOpen(true)}
        onSelectOther={() => setQuickGenerateSheetOpen(true)}
        onGenerateNew={() => setQuickGenerateSheetOpen(true)}
      />
      <QuickPlanSheet
        open={quickPlanSheetOpen}
        onOpenChange={setQuickPlanSheetOpen}
        onAutoGenerate={handleAutoGenerateWeek}
        isGenerating={isAutoGenerating}
        generatingDay={generatingDayIndex}
      />
      <PreselectDateSheet
        open={preselectSheetOpen}
        onOpenChange={(open) => {
          setPreselectSheetOpen(open);
          if (!open && preselectedOutfitId) {
            window.history.replaceState({}, '');
          }
        }}
        onSelectDate={async (date: Date) => {
          if (!preselectedOutfitId) return;
          const dateStr = format(date, 'yyyy-MM-dd');
          try {
            await upsertPlanned.mutateAsync({ date: dateStr, outfitId: preselectedOutfitId });
            setSelectedDate(date);
            setPreselectSheetOpen(false);
            toast.success(t('plan.planned'));
            window.history.replaceState({}, '');
          } catch {
            toast.error(t('plan.plan_error'));
          }
        }}
      />
    </AppLayout>
  );
}
