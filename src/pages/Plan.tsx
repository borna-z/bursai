import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, addDays, isSameDay, isToday, isTomorrow } from 'date-fns';
import { Wand2, Shirt, Loader2, CalendarDays, Repeat, Info, Check, Trash2, Plus, Sparkles, Briefcase, PartyPopper, Heart } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/layout/EmptyState';
import { WeekStrip } from '@/components/plan/WeekStrip';
import { PlanningSheet } from '@/components/plan/PlanningSheet';
import { QuickGenerateSheet } from '@/components/plan/QuickGenerateSheet';
import { SwapSheet } from '@/components/plan/SwapSheet';
import { QuickPlanSheet } from '@/components/plan/QuickPlanSheet';
import { PreselectDateSheet } from '@/components/plan/PreselectDateSheet';
import { CalendarConnectBanner } from '@/components/plan/CalendarConnectBanner';
import { DaySummaryCard } from '@/components/plan/DaySummaryCard';
import { WeatherForecastBadge } from '@/components/outfit/WeatherForecastBadge';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useDaySummary } from '@/hooks/useDaySummary';
import { 
  usePlannedOutfits, 
  useUpsertPlannedOutfit, 
  useDeletePlannedOutfit,
  useUpdatePlannedOutfitStatus,
  type PlannedOutfit 
} from '@/hooks/usePlannedOutfits';
import { useOutfitGenerator } from '@/hooks/useOutfitGenerator';
import { useMarkOutfitWorn, useUndoMarkWorn } from '@/hooks/useOutfits';
import { useFlatGarments } from '@/hooks/useGarments';
import { useProfile } from '@/hooks/useProfile';
import { useForecast } from '@/hooks/useForecast';
import { useBackgroundSyncNotification } from '@/hooks/useCalendarSync';

const occasionIcons: Record<string, React.ElementType> = {
  jobb: Briefcase,
  fest: PartyPopper,
  dejt: Heart,
};

const OCCASION_I18N: Record<string, string> = {
  jobb: 'occasion.jobb',
  vardag: 'occasion.vardag',
  fest: 'occasion.fest',
  resa: 'occasion.resa',
  traning: 'occasion.traning',
  dejt: 'occasion.dejt',
};

export default function PlanPage() {
  useBackgroundSyncNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, locale } = useLanguage();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const preselectedOutfitId = (location.state as { preselectedOutfitId?: string })?.preselectedOutfitId;
  
  // Sheets state
  const [planningSheetOpen, setPlanningSheetOpen] = useState(false);
  const [quickGenerateSheetOpen, setQuickGenerateSheetOpen] = useState(false);
  const [swapSheetOpen, setSwapSheetOpen] = useState(false);
  const [quickPlanSheetOpen, setQuickPlanSheetOpen] = useState(false);
  const [currentOutfitId, setCurrentOutfitId] = useState<string | null>(null);
  
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [generatingDayIndex, setGeneratingDayIndex] = useState(0);
  
  const [preselectSheetOpen, setPreselectSheetOpen] = useState(!!preselectedOutfitId);
  
  // Data hooks
  const { data: plannedOutfits = [], isLoading } = usePlannedOutfits();
  const { data: garments = [] } = useFlatGarments();
  const { data: profile } = useProfile();
  const { getForecastForDate } = useForecast({ homeCity: profile?.home_city });
  
  // Selected day data
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const { data: daySummary, isLoading: isSummaryLoading } = useDaySummary(selectedDateStr);
  
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

  const plannedOutfit = getPlannedForDate(selectedDate);
  const outfit = plannedOutfit?.outfit;
  const hasOutfit = !!outfit;
  const isWorn = plannedOutfit?.status === 'worn';

  // Date label
  let dateLabel = format(selectedDate, 'EEEE d MMMM');
  if (isToday(selectedDate)) dateLabel = t('plan.today');
  else if (isTomorrow(selectedDate)) dateLabel = t('plan.tomorrow');

  const OccasionIcon = outfit?.occasion ? occasionIcons[outfit.occasion] || CalendarDays : CalendarDays;

  // Handlers
  const handleSelectOutfit = async (outfitId: string) => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    try {
      await upsertPlanned.mutateAsync({ date: dateStr, outfitId });
      toast.success(t('plan.planned'));
    } catch {
      toast.error(t('plan.plan_error'));
    }
  };

  const handleGenerateForDate = async (request: {
    occasion: string;
    style: string | null;
    temperature: number | undefined;
  }) => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    try {
      const o = await generateOutfit({
        occasion: request.occasion,
        style: request.style,
        locale,
        weather: { temperature: request.temperature, precipitation: 'none', wind: 'low' },
      });
      await upsertPlanned.mutateAsync({ date: dateStr, outfitId: o.id });
      setQuickGenerateSheetOpen(false);
      toast.success(t('plan.outfit_created'));
    } catch {
      toast.error(t('plan.create_error'));
    }
  };

  const handleMarkWorn = async () => {
    if (!plannedOutfit?.outfit) return;
    const garmentIds = plannedOutfit.outfit.outfit_items.map(item => item.garment_id);
    try {
      const result = await markWorn.mutateAsync({
        outfitId: plannedOutfit.outfit.id,
        garmentIds,
        occasion: plannedOutfit.outfit.occasion,
      });
      await updateStatus.mutateAsync({ id: plannedOutfit.id, status: 'worn' });
      toast.success(t('plan.worn'), {
        action: {
          label: t('plan.undo'),
          onClick: async () => {
            await undoMarkWorn.mutateAsync(result);
            await updateStatus.mutateAsync({ id: plannedOutfit.id, status: 'planned' });
            toast.success(t('plan.undone'));
          },
        },
      });
    } catch {
      toast.error(t('plan.worn_error'));
    }
  };

  const handleRemove = async () => {
    if (!plannedOutfit) return;
    try {
      await deletePlanned.mutateAsync(plannedOutfit.id);
      toast.success(t('plan.removed'));
    } catch {
      toast.error(t('plan.remove_error'));
    }
  };

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

  return (
    <AppLayout>
      {/* ─── Sticky header ─── */}
      <header className="sticky top-0 bg-background/95 backdrop-blur-sm border-b z-20">
        <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-70 transition-opacity press">
                <h1 className="text-lg font-semibold capitalize">{dateLabel}</h1>
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
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

          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => setQuickPlanSheetOpen(true)}
            disabled={!hasGarments}
            className="press"
          >
            <Wand2 className="w-4 h-4 text-accent" />
          </Button>
        </div>
      </header>

      {/* ─── Single-column content ─── */}
      <div className="max-w-lg mx-auto px-4 py-4 space-y-5">
        {/* Calendar connect nudge */}
        <CalendarConnectBanner />

        {/* Week navigation */}
        <WeekStrip 
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          plannedOutfits={plannedOutfits}
        />

        {/* Day content – animate on day switch */}
        <div 
          key={selectedDateStr} 
          className="space-y-5 animate-drape-in"
        >
          {/* Weather line */}
          <div className="flex items-center justify-between">
            <WeatherForecastBadge date={selectedDateStr} compact={false} />
            {isWorn && (
              <Badge variant="secondary" className="text-xs bg-success/10 text-success">
                <Check className="w-3 h-3 mr-1" />
                {t('plan.worn')}
              </Badge>
            )}
          </div>

          {/* AI Day Summary */}
          <DaySummaryCard
            summary={daySummary}
            isLoading={isSummaryLoading}
            onGenerateFromHint={() => setQuickGenerateSheetOpen(true)}
          />

          {/* Outfit section */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !hasGarments ? (
            <EmptyState
              icon={Shirt}
              title={t('plan.add_garments_first')}
              description={t('plan.need_garments')}
              action={{ label: t('wardrobe.add'), onClick: () => navigate('/wardrobe/add'), icon: Shirt }}
            />
          ) : hasOutfit ? (
            <div className="space-y-4">
              {/* Outfit image grid */}
              <div 
                className="rounded-2xl overflow-hidden glass-card cursor-pointer press"
                onClick={() => navigate(`/outfits/${outfit.id}`)}
              >
                <div className="grid grid-cols-2 gap-px bg-border">
                  {outfit.outfit_items.slice(0, 4).map((item) => (
                    <div key={item.id} className="bg-card aspect-[4/5]">
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
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="capitalize text-xs">
                  <OccasionIcon className="w-3 h-3 mr-1" />
                  {t(OCCASION_I18N[outfit.occasion?.toLowerCase()] || `occasion.${outfit.occasion}`)}
                </Badge>
                {outfit.style_vibe && (
                  <Badge variant="outline" className="text-xs">{outfit.style_vibe}</Badge>
                )}
              </div>

              {/* Explanation */}
              {outfit.explanation && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {outfit.explanation}
                </p>
              )}

              {/* Primary actions */}
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => { setCurrentOutfitId(outfit.id); setSwapSheetOpen(true); }}
                  className="flex-1 rounded-xl press"
                >
                  <Repeat className="w-4 h-4 mr-1.5" />
                  {t('plan.swap')}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate(`/outfits/${outfit.id}`)}
                  className="flex-1 rounded-xl press"
                >
                  <Info className="w-4 h-4 mr-1.5" />
                  {t('plan.details')}
                </Button>
              </div>

              {/* Secondary actions */}
              <div className="flex items-center gap-4 pt-2 border-t">
                {!isWorn && (
                  <button 
                    onClick={handleMarkWorn}
                    className="text-xs text-muted-foreground hover:text-success flex items-center gap-1.5 transition-colors press"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {t('plan.mark_worn')}
                  </button>
                )}
                <button 
                  onClick={handleRemove}
                  className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1.5 transition-colors ml-auto press"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t('plan.remove')}
                </button>
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center">
                <CalendarDays className="w-7 h-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground">{t('plan.no_outfit')}</p>
              <div className="flex flex-col items-center gap-2 w-full max-w-xs">
                <Button 
                  onClick={() => setQuickGenerateSheetOpen(true)}
                  disabled={isGenerating || upsertPlanned.isPending}
                  className="w-full rounded-xl press"
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  {t('plan.generate')}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setPlanningSheetOpen(true)}
                  disabled={isGenerating || upsertPlanned.isPending}
                  className="text-muted-foreground press"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  {t('plan.plan')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Sheets ─── */}
      <PlanningSheet
        open={planningSheetOpen}
        onOpenChange={setPlanningSheetOpen}
        date={selectedDate}
        onSelectOutfit={handleSelectOutfit}
        onCreateNew={() => { setPlanningSheetOpen(false); setQuickGenerateSheetOpen(true); }}
      />
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
        onSelectOther={() => setPlanningSheetOpen(true)}
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
            window.history.replaceState({}, document.title);
          }
        }}
        onSelectDate={async (date) => {
          if (preselectedOutfitId) {
            const dateStr = format(date, 'yyyy-MM-dd');
            try {
              await upsertPlanned.mutateAsync({ date: dateStr, outfitId: preselectedOutfitId });
              toast.success(t('plan.planned'));
              setPreselectSheetOpen(false);
              window.history.replaceState({}, document.title);
            } catch {
              toast.error(t('plan.plan_error'));
            }
          }
        }}
        isLoading={upsertPlanned.isPending}
      />
    </AppLayout>
  );
}
