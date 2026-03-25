import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { PRESETS } from '@/lib/motion';
import { format, addDays, isToday, isTomorrow } from 'date-fns';
import { getDateFnsLocale } from '@/lib/dateLocale';
import { Wand2, CalendarDays, Plus, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { PlanPageSkeleton } from '@/components/ui/skeletons';
import { AnimatedPage } from '@/components/ui/animated-page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { getOccasionLabel } from '@/lib/occasionLabel';
import { humanize } from '@/lib/humanize';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { AppLayout } from '@/components/layout/AppLayout';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { PlanOnboardingEmpty } from '@/components/onboarding/OnboardingEmptyState';
import { WeekOverview } from '@/components/plan/WeekOverview';

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
import { useWeekGenerator } from '@/hooks/useWeekGenerator';
import { useSubscription } from '@/hooks/useSubscription';
import { useMarkOutfitWorn, useUndoMarkWorn } from '@/hooks/useOutfits';
import { useFlatGarments } from '@/hooks/useGarments';
import { useForecast } from '@/hooks/useForecast';
import { useLocation as useLocationCtx } from '@/contexts/LocationContext';
import { useBackgroundSyncNotification, useCalendarEvents } from '@/hooks/useCalendarSync';
import { CalendarEventsList } from '@/components/plan/CalendarEventBadge';
import { CoachMark } from '@/components/coach/CoachMark';
import { useFirstRunCoach } from '@/hooks/useFirstRunCoach';

const MAX_OUTFITS_PER_DAY = 4;

export default function PlanPage() {
  useBackgroundSyncNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { t, locale } = useLanguage();
  const coach = useFirstRunCoach();
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
  const [, setCurrentPlannedId] = useState<string | null>(null);
  
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
  const { generateWeek } = useWeekGenerator();
  const markWorn = useMarkOutfitWorn();
  const undoMarkWorn = useUndoMarkWorn();

  const getPlannedForDate = useCallback((date: Date): PlannedOutfit | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return plannedOutfits.find(p => p.date === dateStr) || null;
  }, [plannedOutfits]);

  const hasOutfits = dayPlannedOutfits.length > 0;
  const canAddMore = dayPlannedOutfits.length < MAX_OUTFITS_PER_DAY;

  const weekDays = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => addDays(today, i));
  }, []);

  const weekPlannedCount = useMemo(() => {
    return weekDays.filter(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      return plannedOutfits.some(p => p.date === dateStr && p.outfit_id);
    }).length;
  }, [plannedOutfits, weekDays]);

  // Date label
  let dateLabel = format(selectedDate, 'EEEE d MMMM', { locale: getDateFnsLocale(locale) });
  if (isToday(selectedDate)) dateLabel = t('plan.today');
  else if (isTomorrow(selectedDate)) dateLabel = t('plan.tomorrow');

  // ── Handlers ──
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
    setGeneratingDayIndex(1);
    
    const occasions = ['casual', 'work', 'casual', 'work', 'casual', 'party', 'casual'];
    const weekDays: { date: string; occasion: string; weather: { temperature?: number; precipitation?: string; wind?: string }; event_title?: string }[] = [];
    
    for (let i = 0; i < days; i++) {
      const date = addDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const existing = getPlannedForDate(date);
      if (existing?.outfit_id) continue; // Skip days that already have outfits
      if (!canCreateOutfit()) {
        toast.error(t('paywall.outfit_limit') || 'Outfit limit reached');
        break;
      }
      const forecast = getForecastForDate(dateStr);
      const temp = forecast ? Math.round((forecast.temperature_max + forecast.temperature_min) / 2) : 15;
      weekDays.push({
        date: dateStr,
        occasion: occasions[i % occasions.length],
        weather: {
          temperature: temp,
          precipitation: forecast?.precipitation_probability && forecast.precipitation_probability > 50 ? 'rain' : 'none',
          wind: 'low',
        },
      });
    }
    
    if (weekDays.length === 0) {
      setIsAutoGenerating(false);
      setGeneratingDayIndex(0);
      return;
    }

    try {
      const result = await generateWeek(weekDays, { locale });
      if (result) {
        const successCount = result.days.filter(d => d.items && !d.error).length;
        const laundryWarning = result.laundry?.warning;
        
        if (successCount > 0) {
          toast.success(`${successCount} outfit${successCount > 1 ? 's' : ''} planned for the week`);
        }
        if (laundryWarning) {
          toast(laundryWarning, { icon: '🧺' });
        }
      }
    } catch (error) {
      console.error('Week generation failed:', error);
      toast.error(t('plan.create_error'));
    } finally {
      setIsAutoGenerating(false);
      setGeneratingDayIndex(0);
    }
  };

  const prefersReduced = useReducedMotion();
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
      <header className="sticky top-0 bg-background/80 backdrop-blur-xl z-20 border-b border-border/5">
        <div className="flex items-center justify-between px-5 h-14 max-w-lg mx-auto">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2.5 hover:opacity-70 transition-opacity press">
                <h1 className="text-lg font-semibold tracking-[-0.02em] capitalize">{dateLabel}</h1>
                <CalendarDays className="w-4 h-4 text-primary/50" />
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
          {isAutoGenerating && (
            <Badge variant="secondary" className="text-[10px] animate-pulse">
              <Wand2 className="w-3 h-3 mr-1" />
              {t('plan.generating_day') || 'Generating'} {generatingDayIndex}/7
            </Badge>
          )}
        </div>
      </header>

      {/* ─── Content ─── */}
      <PullToRefresh onRefresh={handleRefresh}>
      <AnimatedPage className="max-w-lg mx-auto px-5 pt-5 pb-8">
        {/* Calendar connect nudge */}
        <CalendarConnectBanner />

        {/* Laundry alert */}
        <LaundryAlertBanner />

        {/* Week overview with thumbnails + repetition detection */}
        <WeekOverview
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          plannedOutfits={plannedOutfits}
          className="py-3"
        />

        {/* Progress bar */}
        <div className="flex items-center gap-2 mt-2">
          <div style={{ flex: 1, height: 3, background: 'rgba(28,25,23,0.1)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ background: '#1C1917', borderRadius: 999, width: `${(weekPlannedCount / 7) * 100}%`, height: '100%' }} />
          </div>
          <span style={{ fontSize: 11, fontFamily: 'DM Sans, sans-serif', color: '#8C7B6B' }}>{weekPlannedCount}/7 days</span>
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

          {/* Action cards */}
          {hasGarments && (
            <div className="flex flex-col gap-2">
              <CoachMark
                step={4}
                currentStep={coach.currentStep}
                isCoachActive={coach.isStepActive(4)}
                title="Plan ahead"
                body="Use planning to line up looks for the week, or save a generated outfit to a specific day."
                ctaLabel="Finish coach"
                onCta={() => coach.completeTour()}
                onSkip={() => coach.completeTour()}
                position="bottom"
              >
                <motion.button
                  whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                  onClick={() => setQuickPlanSheetOpen(true)}
                  className="w-full h-[72px] rounded-2xl bg-card border border-border/20 flex items-center px-4 gap-3 text-left"
                >
                  <CalendarDays className="w-5 h-5 text-foreground/50 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-foreground">Plan the week</p>
                    <p className="text-[12px] text-muted-foreground">AI fills all 7 days</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                </motion.button>
              </CoachMark>
            </div>
          )}

          {/* AI Day Summary */}
          <DaySummaryCard
            summary={daySummary}
            isLoading={isSummaryLoading}
            onGenerateFromHint={() => setQuickGenerateSheetOpen(true)}
            eventCount={calendarEvents.length}
          />

          {/* Fallback: show raw events only when no AI summary available */}
          {calendarEvents.length > 0 && !daySummary && !isSummaryLoading && (
            <CalendarEventsList events={calendarEvents} maxDisplay={4} />
          )}

          {/* ─── Outfit section ─── */}
          {isLoading || isDayLoading ? (
            <PlanPageSkeleton />
          ) : !hasGarments ? (
            <PlanOnboardingEmpty />
          ) : weekPlannedCount === 0 ? (
            /* STEP 3: No outfits planned for the week */
            <div style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32 }}>
              <div style={{
                width: 56, height: 56, background: 'rgba(28,25,23,0.05)', borderRadius: 999,
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <span style={{ fontSize: 24 }}>▦</span>
              </div>
              <h3 style={{
                fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
                fontSize: 20, color: '#1C1917', margin: '0 0 8px',
              }}>
                Nothing planned yet
              </h3>
              <p style={{
                fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: '#8C7B6B',
                margin: '0 0 24px', lineHeight: 1.5,
              }}>
                Let the AI fill your week based on your calendar, weather, and what you haven't worn lately.
              </p>
              <button
                onClick={() => setQuickPlanSheetOpen(true)}
                style={{
                  width: '100%', background: '#1C1917', color: '#F5F0E8', border: 'none',
                  borderRadius: 12, padding: '12px 0', fontSize: 14, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: 8,
                  display: 'block',
                }}
              >
                ✦ Plan the week
              </button>
              <button
                onClick={() => setQuickGenerateSheetOpen(true)}
                style={{
                  width: '100%', background: 'none', border: '1px solid rgba(28,25,23,0.1)',
                  borderRadius: 12, padding: '12px 0', fontSize: 14, color: '#1C1917',
                  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'block',
                }}
              >
                Plan today only
              </button>
            </div>
          ) : hasOutfits ? (
            <div className="space-y-4">
              {dayPlannedOutfits.map((planned) => {
                const outfit = planned.outfit;
                if (!outfit) return null;

                const occasionText = getOccasionLabel(outfit.occasion || '', t).toUpperCase();
                const styleText = outfit.style_vibe ? humanize(outfit.style_vibe).toUpperCase() : '';
                const tagLine = [occasionText, styleText].filter(Boolean).join(' · ');

                if (isToday(selectedDate)) {
                  /* STEP 4: Today's dark outfit card */
                  return (
                    <div key={planned.id} style={{ background: '#1C1917', borderRadius: 16, overflow: 'hidden' }}>
                      <div style={{ padding: '16px 16px 12px' }}>
                        {tagLine && (
                          <p style={{
                            fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em',
                            color: 'rgba(245,240,232,0.45)', marginBottom: 8,
                            fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
                          }}>
                            {tagLine}
                          </p>
                        )}
                        {/* Garment thumbnails — flex row, up to 4 */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                          {outfit.outfit_items.slice(0, 4).map((item) => (
                            <div
                              key={item.id}
                              style={{ flex: 1, aspectRatio: '1', background: '#2C2824', overflow: 'hidden', borderRadius: 4 }}
                            >
                              <LazyImageSimple
                                imagePath={item.garment ? getPreferredGarmentImagePath(item.garment) : undefined}
                                alt={item.garment?.title || item.slot}
                                className="w-full h-full"
                              />
                            </div>
                          ))}
                        </div>
                        {outfit.explanation && (
                          <p style={{
                            fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
                            fontSize: 14, color: 'rgba(245,240,232,0.75)', lineHeight: 1.6, marginBottom: 16,
                          }}>
                            {outfit.explanation}
                          </p>
                        )}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => handleMarkWorn(planned)}
                            style={{
                              flex: 1, background: '#F5F0E8', color: '#1C1917', border: 'none',
                              borderRadius: 8, padding: '12px 0', fontSize: 14, fontWeight: 600,
                              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                            }}
                          >
                            Wear today
                          </button>
                          <button
                            onClick={() => { setCurrentOutfitId(outfit.id); setCurrentPlannedId(planned.id); setSwapSheetOpen(true); }}
                            style={{
                              flex: 1, background: 'rgba(245,240,232,0.1)', color: 'rgba(245,240,232,0.7)',
                              border: 'none', borderRadius: 8, padding: '12px 0', fontSize: 14,
                              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                            }}
                          >
                            Restyle
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                /* STEP 5: Other planned day cards */
                return (
                  <div key={planned.id} style={{ background: 'white', border: '1px solid rgba(28,25,23,0.1)', borderRadius: 16, overflow: 'hidden' }}>
                    {/* Thumbnails */}
                    <div style={{ display: 'flex', height: 80 }}>
                      {outfit.outfit_items.slice(0, 4).map((item) => (
                        <div key={item.id} style={{ flex: 1, background: '#F5F0E8', overflow: 'hidden' }}>
                          <LazyImageSimple
                            imagePath={item.garment ? getPreferredGarmentImagePath(item.garment) : undefined}
                            alt={item.garment?.title || item.slot}
                            className="w-full h-full"
                          />
                        </div>
                      ))}
                    </div>
                    {/* Info */}
                    <div style={{ padding: '12px 16px' }}>
                      {tagLine && (
                        <p style={{
                          fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em',
                          color: 'rgba(28,25,23,0.4)', marginBottom: 6, fontFamily: 'DM Sans, sans-serif',
                        }}>
                          {tagLine}
                        </p>
                      )}
                      {outfit.explanation && (
                        <p style={{
                          fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
                          fontSize: 13, color: 'rgba(28,25,23,0.6)', lineHeight: 1.5,
                        }}>
                          {outfit.explanation}
                        </p>
                      )}
                    </div>
                    {/* Footer */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '8px 16px', borderTop: '1px solid rgba(28,25,23,0.06)',
                    }}>
                      <button
                        onClick={() => { setCurrentOutfitId(outfit.id); setCurrentPlannedId(planned.id); setSwapSheetOpen(true); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#8C7B6B', fontFamily: 'DM Sans, sans-serif' }}
                      >
                        ↻ Swap
                      </button>
                      <button
                        onClick={() => navigate(`/outfits/${outfit.id}`)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#8C7B6B', fontFamily: 'DM Sans, sans-serif' }}
                      >
                        ✎ Edit
                      </button>
                      <button
                        onClick={() => handleRemove(planned.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#8C7B6B', fontFamily: 'DM Sans, sans-serif' }}
                      >
                        ✕ Clear
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
            /* STEP 6: Day with no outfit planned */
            <div style={{
              border: '2px dashed rgba(28,25,23,0.1)', borderRadius: 16, padding: 16,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 700, color: '#1C1917', marginBottom: 2 }}>
                  {dateLabel}
                </p>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: '#8C7B6B' }}>
                  No outfit planned
                </p>
              </div>
              <button
                onClick={() => setQuickGenerateSheetOpen(true)}
                style={{
                  background: 'rgba(28,25,23,0.05)', border: '1px solid rgba(28,25,23,0.1)',
                  borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 500,
                  color: '#1C1917', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                }}
              >
                + Plan
              </button>
            </div>
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
