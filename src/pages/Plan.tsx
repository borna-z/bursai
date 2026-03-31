import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, addDays, isToday, isTomorrow } from 'date-fns';
import { formatLocalizedDate } from '@/lib/dateLocale';
import { CalendarDays, Plus, Sparkles, Wand2 } from 'lucide-react';

import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
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
  type PlannedOutfit,
} from '@/hooks/usePlannedOutfits';
import { useOutfitGenerator } from '@/hooks/useOutfitGenerator';
import { useWeekGenerator } from '@/hooks/useWeekGenerator';
import { useSubscription } from '@/hooks/useSubscription';
import { useMarkOutfitWorn, useUndoMarkWorn } from '@/hooks/useOutfits';
import { useFlatGarments } from '@/hooks/useGarments';
import { useForecast } from '@/hooks/useForecast';
import { useLocation as useLocationCtx } from '@/contexts/LocationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBackgroundSyncNotification, useCalendarEvents } from '@/hooks/useCalendarSync';
import { logger } from '@/lib/logger';

const MAX_OUTFITS_PER_DAY = 4;

export default function PlanPage() {
  useBackgroundSyncNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const initialDate = (location.state as { initialDate?: string })?.initialDate;
  const [selectedDate, setSelectedDate] = useState(() =>
    initialDate ? new Date(initialDate) : new Date(),
  );
  const [calendarOpen, setCalendarOpen] = useState(false);

  const preselectedOutfitId = (location.state as { preselectedOutfitId?: string })?.preselectedOutfitId;

  const [quickGenerateSheetOpen, setQuickGenerateSheetOpen] = useState(false);
  const [swapSheetOpen, setSwapSheetOpen] = useState(false);
  const [quickPlanSheetOpen, setQuickPlanSheetOpen] = useState(false);
  const [currentOutfitId, setCurrentOutfitId] = useState<string | null>(null);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [generatingDayIndex, setGeneratingDayIndex] = useState(0);
  const [preselectSheetOpen, setPreselectSheetOpen] = useState(!!preselectedOutfitId);

  const { data: plannedOutfits = [], isLoading } = usePlannedOutfits();
  const { data: garments = [], isLoading: isGarmentsLoading } = useFlatGarments();
  const { effectiveCity } = useLocationCtx();
  const { getForecastForDate } = useForecast({ city: effectiveCity });

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const { data: dayPlannedOutfits = [], isLoading: isDayLoading } = usePlannedOutfitsForDate(selectedDateStr);
  const { data: daySummary } = useDaySummary(selectedDateStr);
  useCalendarEvents(selectedDateStr);

  const upsertPlanned = useUpsertPlannedOutfit();
  const deletePlanned = useDeletePlannedOutfit();
  const updateStatus = useUpdatePlannedOutfitStatus();
  const { generateOutfit, isGenerating } = useOutfitGenerator();
  const { generateWeek } = useWeekGenerator();
  const markWorn = useMarkOutfitWorn();
  const undoMarkWorn = useUndoMarkWorn();

  const getPlannedForDate = useCallback((date: Date): PlannedOutfit | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return plannedOutfits.find((planned) => planned.date === dateStr) || null;
  }, [plannedOutfits]);

  const hasOutfits = dayPlannedOutfits.length > 0;
  const canAddMore = dayPlannedOutfits.length < MAX_OUTFITS_PER_DAY;

  const weekDays = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => addDays(today, i));
  }, []);

  const weekPlannedCount = useMemo(() => {
    return weekDays.filter((date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return plannedOutfits.some((planned) => planned.date === dateStr && planned.outfit_id);
    }).length;
  }, [plannedOutfits, weekDays]);

  let dateLabel = formatLocalizedDate(selectedDate, locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  if (isToday(selectedDate)) dateLabel = t('plan.today');
  else if (isTomorrow(selectedDate)) dateLabel = t('plan.tomorrow');

  const handleGenerateForDate = async (request: {
    occasion: string;
    style: string | null;
    temperature: number | undefined;
  }) => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const topEventTitle = daySummary?.priorities?.[0]?.title || null;
    try {
      const outfit = await generateOutfit({
        occasion: request.occasion,
        style: request.style,
        locale,
        eventTitle: topEventTitle,
        dayContext: daySummary?.intelligence ?? null,
        weather: { temperature: request.temperature, precipitation: 'none', wind: 'low' },
      });
      await upsertPlanned.mutateAsync({ date: dateStr, outfitId: outfit.id });
      setQuickGenerateSheetOpen(false);
      toast.success(t('plan.outfit_created'));
    } catch {
      toast.error(t('plan.create_error'));
    }
  };

  const handleMarkWorn = async (planned: PlannedOutfit) => {
    if (!planned.outfit) return;
    const garmentIds = planned.outfit.outfit_items.map((item) => item.garment_id);
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
      toast.success(t('plan.removed'));
    } catch {
      toast.error(t('plan.remove_error'));
    }
  };

  const { canCreateOutfit } = useSubscription();

  const handleAutoGenerateWeek = async (days: number) => {
    setIsAutoGenerating(true);
    setGeneratingDayIndex(1);

    const occasions = ['casual', 'work', 'casual', 'work', 'casual', 'party', 'casual'];
    const requestDays: { date: string; occasion: string; weather: { temperature?: number; precipitation?: string; wind?: string }; event_title?: string }[] = [];

    for (let i = 0; i < days; i++) {
      const date = addDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const existing = getPlannedForDate(date);
      if (existing?.outfit_id) continue;
      if (!canCreateOutfit()) {
        toast.error(t('paywall.outfit_limit'));
        break;
      }
      const forecast = getForecastForDate(dateStr);
      const temp = forecast ? Math.round((forecast.temperature_max + forecast.temperature_min) / 2) : 15;
      requestDays.push({
        date: dateStr,
        occasion: occasions[i % occasions.length],
        weather: {
          temperature: temp,
          precipitation: forecast?.precipitation_probability && forecast.precipitation_probability > 50 ? 'rain' : 'none',
          wind: 'low',
        },
      });
    }

    if (requestDays.length === 0) {
      setIsAutoGenerating(false);
      setGeneratingDayIndex(0);
      return;
    }

    try {
      const result = await generateWeek(requestDays, { locale });
      if (result) {
        const successCount = result.days.filter((day) => day.items && !day.error).length;
        const laundryWarning = result.laundry?.warning;

        if (successCount > 0) {
          toast.success(
            successCount === 1
              ? t('plan.week_success_one')
              : t('plan.week_success_many').replace('{count}', String(successCount))
          );
        }
        if (laundryWarning) {
          toast(laundryWarning);
        }
      }
    } catch (error) {
      logger.error('Week generation failed:', error);
      toast.error(t('plan.create_error'));
    } finally {
      setIsAutoGenerating(false);
      setGeneratingDayIndex(0);
    }
  };

  const hasGarments = garments.length > 0 || isGarmentsLoading;
  const primaryPlanned = dayPlannedOutfits[0] ?? null;
  const additionalPlanned = dayPlannedOutfits.slice(1);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['planned-outfits'] }),
      queryClient.invalidateQueries({ queryKey: ['planned-outfits-day'] }),
      queryClient.invalidateQueries({ queryKey: ['garments', user?.id] }),
      queryClient.invalidateQueries({ queryKey: ['day-summary'] }),
    ]);
  }, [queryClient, user?.id]);

  const renderPlannedPanel = () => {
    if (!primaryPlanned?.outfit) return null;

    const outfit = primaryPlanned.outfit;
    const occasionText = getOccasionLabel(outfit.occasion || '', t).toUpperCase();
    const styleText = outfit.style_vibe ? humanize(outfit.style_vibe).toUpperCase() : '';
    const tagLine = [occasionText, styleText].filter(Boolean).join(' · ');

    return (
      <section className="surface-editorial premium-highlight rounded-[1.35rem] p-4.5">
        <div className="space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow-chip">{t('plan.planned_day')}</span>
                {tagLine ? (
                  <span className="eyebrow-chip border-transparent bg-secondary/85 text-foreground/58">
                    {tagLine}
                  </span>
                ) : null}
              </div>
              <h2 className="text-[1.22rem] font-semibold tracking-[-0.04em] text-foreground">
                {isToday(selectedDate) ? t('plan.today_styled') : t('plan.date_planned').replace('{date}', dateLabel)}
              </h2>
              <p className="line-clamp-2 min-h-[2.5rem] max-w-[34ch] text-[0.88rem] leading-5 text-muted-foreground">
                {daySummary?.summary ?? '\u00A0'}
              </p>
            </div>

            <WeatherForecastBadge date={selectedDateStr} compact={false} />
          </div>

          <div className="surface-media space-y-3.5 p-3.5">
            <div className="grid grid-cols-4 gap-1.5">
              {outfit.outfit_items.slice(0, 4).map((item) => (
                <div key={item.id} className="aspect-square overflow-hidden rounded-[1.1rem] bg-background/75">
                  <LazyImageSimple
                    imagePath={item.garment ? getPreferredGarmentImagePath(item.garment) : undefined}
                    alt={item.garment?.title || item.slot}
                    className="h-full w-full"
                  />
                </div>
              ))}
            </div>

            {outfit.explanation ? (
              <p className="line-clamp-3 text-[0.86rem] leading-5 text-foreground/80">
                {outfit.explanation}
              </p>
            ) : null}
          </div>

          {additionalPlanned.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground/65">
                {t('plan.also_planned')}
              </p>
              <div className="app-chip-row">
                {additionalPlanned.map((planned) => (
                  <button
                    key={planned.id}
                    type="button"
                    onClick={() => planned.outfit && navigate(`/outfits/${planned.outfit.id}`)}
                    className="rounded-full border border-border/55 bg-background/82 px-3 py-1.5 text-[0.78rem] text-foreground"
                  >
                    {planned.outfit?.occasion ? getOccasionLabel(planned.outfit.occasion, t) : t('plan.open_outfit')}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-2.5">
            <Button
              className="h-11 w-full rounded-full"
              onClick={() => {
                if (isToday(selectedDate)) {
                  void handleMarkWorn(primaryPlanned);
                  return;
                }
                navigate(`/outfits/${outfit.id}`);
              }}
            >
              {isToday(selectedDate) ? t('plan.wear_today') : t('plan.open_outfit')}
            </Button>

            <div className="flex flex-wrap items-center gap-3.5 text-[0.82rem] font-medium text-muted-foreground">
              <button
                type="button"
                onClick={() => {
                  setCurrentOutfitId(outfit.id);
                  setSwapSheetOpen(true);
                }}
                className="underline underline-offset-4"
              >
                {t('plan.restyle')}
              </button>
              <button
                type="button"
                onClick={() => void handleRemove(primaryPlanned.id)}
                className="underline underline-offset-4"
              >
                {t('plan.clear')}
              </button>
              {canAddMore ? (
                <button
                  type="button"
                  onClick={() => setQuickGenerateSheetOpen(true)}
                  className="underline underline-offset-4"
                >
                  {t('plan.add_another')}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderEmptyDayPanel = () => {
    const emptyWeek = weekPlannedCount === 0;

    return (
      <section className="surface-editorial premium-highlight rounded-[1.35rem] p-4.5">
        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow-chip">{emptyWeek ? t('plan.week_reset') : t('plan.open_day')}</span>
              <WeatherForecastBadge date={selectedDateStr} compact={false} />
            </div>
            <h2 className="text-[1.22rem] font-semibold tracking-[-0.04em] text-foreground">
              {emptyWeek ? t('plan.nothing_planned') : t('plan.nothing_planned_for').replace('{date}', dateLabel)}
            </h2>
            <p className="line-clamp-2 min-h-[2.5rem] max-w-[34ch] text-[0.88rem] leading-5 text-muted-foreground">
              {daySummary?.summary
                ?? (emptyWeek
                  ? t('plan.empty_week_hint')
                  : t('plan.empty_day_hint'))}
            </p>
          </div>

          <div className="space-y-2.5">
            <Button
              className="h-11 w-full rounded-full"
              onClick={() => emptyWeek ? setQuickPlanSheetOpen(true) : setQuickGenerateSheetOpen(true)}
            >
              {emptyWeek ? t('plan.plan_the_week') : t('plan.plan_this_day')}
            </Button>

            <div className="flex flex-wrap items-center gap-3.5 text-[0.82rem] font-medium text-muted-foreground">
              <button
                type="button"
                onClick={() => emptyWeek ? setQuickGenerateSheetOpen(true) : setQuickPlanSheetOpen(true)}
                className="underline underline-offset-4"
              >
                {emptyWeek ? t('plan.plan_today_only') : t('plan.auto_plan_week')}
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  };

  const monthYearLabel = formatLocalizedDate(selectedDate, locale, {
    month: 'long',
    year: 'numeric',
  });

  const comingUpOutfits = useMemo(() => {
    const todayDateStr = format(new Date(), 'yyyy-MM-dd');
    return plannedOutfits
      .filter((p) => p.date > todayDateStr && p.outfit_id && p.outfit)
      .slice(0, 3);
  }, [plannedOutfits]);

  return (
    <AppLayout>
      <header className="topbar-frost sticky top-0 z-20 -mx-4 px-4 pb-2.5 pt-2.5 sm:-mx-5 sm:px-5 sm:pb-3 sm:pt-3">
        <div className="mx-auto flex max-w-lg items-start justify-between gap-3">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="flex h-10.5 min-h-[44px] items-center gap-2 transition-opacity hover:opacity-75 cursor-pointer">
                <div>
                  <p className="caption-upper mb-0.5 text-muted-foreground/50">{monthYearLabel}</p>
                  <h1 className="font-display italic text-[1.42rem] leading-tight text-foreground sm:text-[1.55rem]">
                    {t('plan.your_week') || 'Your Week'}
                  </h1>
                </div>
                <CalendarDays className="h-4 w-4 text-muted-foreground/40" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date);
                    setCalendarOpen(false);
                  }
                }}
                className="pointer-events-auto p-3"
              />
            </PopoverContent>
          </Popover>
          {isAutoGenerating ? (
            <Badge variant="secondary" className="h-10.5 min-h-[44px] text-[10px] uppercase tracking-[0.14em]">
              <Wand2 className="mr-1 h-3 w-3" />
              {generatingDayIndex}/7
            </Badge>
          ) : null}
        </div>
      </header>

      <PullToRefresh onRefresh={handleRefresh}>
        <AnimatedPage className="page-shell page-cluster">
          <WeekOverview
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            plannedOutfits={plannedOutfits}
          />

          <div className="app-notice-stack">
            <CalendarConnectBanner />
            <LaundryAlertBanner />
          </div>

          <div key={selectedDateStr}>
            {isLoading || isDayLoading || isGarmentsLoading ? (
              <PlanPageSkeleton />
            ) : !hasGarments ? (
              <PlanOnboardingEmpty />
            ) : hasOutfits ? (
              renderPlannedPanel()
            ) : (
              renderEmptyDayPanel()
            )}
          </div>

          {hasGarments && !hasOutfits && canAddMore ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickGenerateSheetOpen(true)}
              disabled={isGenerating || upsertPlanned.isPending}
              className="h-10.5 rounded-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('plan.add_outfit')}
            </Button>
          ) : null}

          {/* Coming Up section */}
          {comingUpOutfits.length > 0 && (
            <section className="space-y-3">
              <p className="label-editorial text-muted-foreground/60">
                {t('plan.coming_up') || 'Coming Up'}
              </p>
              <div className="space-y-2">
                {comingUpOutfits.map((planned) => {
                  const planDate = new Date(planned.date + 'T00:00:00');
                  const dayLabel = formatLocalizedDate(planDate, locale, {
                    weekday: 'short',
                    day: 'numeric',
                  }).toUpperCase();
                  const firstItem = planned.outfit?.outfit_items?.[0];
                  const imgPath = firstItem?.garment ? getPreferredGarmentImagePath(firstItem.garment) : undefined;

                  return (
                    <button
                      key={planned.id}
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setSelectedDate(planDate);
                      }}
                      className="flex w-full items-center gap-3 rounded-[1.05rem] surface-secondary p-2.5 text-left transition-colors cursor-pointer"
                    >
                      {imgPath && (
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[0.75rem] bg-secondary/40">
                          <LazyImageSimple imagePath={imgPath} alt="" className="h-full w-full" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55">{dayLabel}</p>
                        <p className="truncate text-[14px] font-semibold text-foreground">
                          {planned.outfit?.occasion ? getOccasionLabel(planned.outfit.occasion, t) : t('plan.planned_outfit')}
                        </p>
                      </div>
                      <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* AI plan banner */}
          {hasGarments && weekPlannedCount < 5 && (
            <button
              type="button"
              onClick={() => { hapticLight(); setQuickPlanSheetOpen(true); }}
              className="flex w-full items-center gap-3 rounded-[1.1rem] surface-editorial p-3.5 text-left transition-colors cursor-pointer"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.85rem] bg-accent/15">
                <Sparkles className="h-5 w-5 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-foreground">
                  {t('plan.ai_plan_week') || 'Let AI plan your whole week'}
                </p>
              </div>
            </button>
          )}
        </AnimatedPage>
      </PullToRefresh>

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
