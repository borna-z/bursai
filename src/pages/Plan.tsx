import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, addDays, isSameDay, isToday, isTomorrow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Wand2, Shirt, Loader2, CalendarDays, Repeat, Info, Check, Trash2, Plus, Sparkles, Briefcase, PartyPopper, Heart } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/layout/EmptyState';
import { WeekStrip } from '@/components/plan/WeekStrip';
import { MiniDayCard } from '@/components/plan/MiniDayCard';
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
import { useIsMobile } from '@/hooks/use-mobile';
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

export default function PlanPage() {
  useBackgroundSyncNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { t } = useLanguage();
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

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));
  }, []);

  const getPlannedForDate = useCallback((date: Date): PlannedOutfit | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return plannedOutfits.find(p => p.date === dateStr) || null;
  }, [plannedOutfits]);

  const plannedOutfit = getPlannedForDate(selectedDate);
  const outfit = plannedOutfit?.outfit;
  const hasOutfit = !!outfit;
  const isWorn = plannedOutfit?.status === 'worn';

  // Date label
  let dateLabel = format(selectedDate, 'EEEE d MMMM', { locale: sv });
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

  // ── Shared detail content (used in both mobile and desktop) ──
  const renderDayDetail = () => (
    <>
      {/* Weather badge */}
      <div className="flex items-center justify-between">
        <WeatherForecastBadge date={selectedDateStr} compact={false} />
        {isWorn && (
          <Badge variant="secondary" className="text-xs bg-accent/10 text-accent">
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

      {/* Loading state */}
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
            className="rounded-2xl overflow-hidden bg-muted/20 cursor-pointer active:scale-[0.99] transition-transform"
            onClick={() => navigate(`/outfits/${outfit.id}`)}
          >
            <div className={cn(
              "grid grid-cols-2 gap-px bg-border",
            )}>
              {outfit.outfit_items.slice(0, 4).map((item) => (
                <div key={item.id} className={cn(
                  "bg-card",
                  isMobile ? "aspect-[4/5]" : "aspect-[3/4]"
                )}>
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
              {outfit.occasion}
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
              className="flex-1 rounded-xl"
            >
              <Repeat className="w-4 h-4 mr-1.5" />
              {t('plan.swap')}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate(`/outfits/${outfit.id}`)}
              className="flex-1 rounded-xl"
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
                className="text-xs text-muted-foreground hover:text-accent flex items-center gap-1.5 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                {t('plan.mark_worn')}
              </button>
            )}
            <button 
              onClick={handleRemove}
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1.5 transition-colors ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('plan.remove')}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
              <CalendarDays className="w-7 h-7 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">{t('plan.no_outfit')}</p>
            <div className="flex flex-col items-center gap-2 w-full max-w-xs">
              <Button 
                onClick={() => setQuickGenerateSheetOpen(true)}
                disabled={isGenerating || upsertPlanned.isPending}
                className="w-full rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                {t('plan.generate')}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setPlanningSheetOpen(true)}
                disabled={isGenerating || upsertPlanned.isPending}
                className="rounded-xl"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                {t('plan.plan')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // ── Shared sheets ──
  const renderSheets = () => (
    <>
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
              toast.success(`${t('plan.planned')} ${format(date, 'd MMM', { locale: sv })}`);
              setPreselectSheetOpen(false);
              window.history.replaceState({}, document.title);
            } catch {
              toast.error(t('plan.plan_error'));
            }
          }
        }}
        isLoading={upsertPlanned.isPending}
      />
    </>
  );

  return (
    <AppLayout>
      {/* Header */}
      <header className="sticky top-0 bg-background/95 backdrop-blur-sm border-b z-20">
        <div className={cn(
          "flex items-center justify-between px-4 h-14 mx-auto",
          isMobile ? "max-w-lg" : "max-w-5xl"
        )}>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-70 transition-opacity">
                <h1 className="text-lg font-semibold capitalize">{isMobile ? dateLabel : t('plan.plan_week')}</h1>
                <CalendarDays className="w-4 h-4 text-accent" />
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
            className=""
          >
            <Wand2 className="w-4 h-4 text-accent" />
          </Button>
        </div>
      </header>

      {isMobile ? (
        /* ═══════ MOBILE LAYOUT (unchanged) ═══════ */
        <div className="p-4 space-y-5">
          <CalendarConnectBanner />
          <WeekStrip 
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            plannedOutfits={plannedOutfits}
          />
          <div className="animate-drape-in">
            {renderDayDetail()}
          </div>
        </div>
      ) : (
        /* ═══════ DESKTOP LAYOUT ═══════ */
        <div className="max-w-5xl mx-auto p-6">
          <CalendarConnectBanner />
          <div className="grid grid-cols-[380px_1fr] gap-6 mt-4">
            {/* Left panel: week overview */}
            <div className="space-y-2 stagger-drape">
              {weekDays.map((day) => (
                <MiniDayCard
                  key={day.toISOString()}
                  date={day}
                  plannedOutfit={getPlannedForDate(day)}
                  isSelected={isSameDay(day, selectedDate)}
                  onClick={() => setSelectedDate(day)}
                />
              ))}
            </div>

            {/* Right panel: selected day detail */}
            <div 
              key={selectedDateStr} 
              className="space-y-5 animate-fade-in"
            >
              {/* Desktop date heading */}
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold capitalize">{dateLabel}</h2>
              </div>
              {renderDayDetail()}
            </div>
          </div>
        </div>
      )}

      {renderSheets()}
    </AppLayout>
  );
}
