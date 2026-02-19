import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, addDays, isSameDay, isToday, isTomorrow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Wand2, Shirt, Loader2, CalendarDays, Repeat, Info, Check, Trash2, Plus, Sparkles, Briefcase, PartyPopper, Heart } from 'lucide-react';
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
import { CalendarEventsList } from '@/components/plan/CalendarEventBadge';
import { SmartDayBanner } from '@/components/plan/SmartDayBanner';
import { WeatherForecastBadge } from '@/components/outfit/WeatherForecastBadge';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useCalendarEvents } from '@/hooks/useCalendarSync';
import { useSmartDayRecommendation } from '@/hooks/useSmartDayRecommendation';
import { 
  usePlannedOutfits, 
  useUpsertPlannedOutfit, 
  useDeletePlannedOutfit,
  useUpdatePlannedOutfitStatus,
  type PlannedOutfit 
} from '@/hooks/usePlannedOutfits';
import { useOutfitGenerator } from '@/hooks/useOutfitGenerator';
import { useMarkOutfitWorn, useUndoMarkWorn } from '@/hooks/useOutfits';
import { useGarments } from '@/hooks/useGarments';
import { useProfile } from '@/hooks/useProfile';
import { useForecast } from '@/hooks/useForecast';

const occasionIcons: Record<string, React.ElementType> = {
  jobb: Briefcase,
  fest: PartyPopper,
  dejt: Heart,
};

export default function PlanPage() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const { data: garments = [] } = useGarments();
  const { data: profile } = useProfile();
  const { getForecastForDate } = useForecast({ homeCity: profile?.home_city });
  
  // Selected day data
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const { data: calendarEvents } = useCalendarEvents(selectedDateStr);
  const { slots: smartSlots } = useSmartDayRecommendation(calendarEvents);
  
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
  if (isToday(selectedDate)) dateLabel = 'Idag';
  else if (isTomorrow(selectedDate)) dateLabel = 'Imorgon';

  const OccasionIcon = outfit?.occasion ? occasionIcons[outfit.occasion] || CalendarDays : CalendarDays;

  // Handlers
  const handleSelectOutfit = async (outfitId: string) => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    try {
      await upsertPlanned.mutateAsync({ date: dateStr, outfitId });
      toast.success('Planerad');
    } catch {
      toast.error('Kunde inte planera outfit');
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
      toast.success('Outfit skapad');
    } catch {
      toast.error('Kunde inte skapa outfit');
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
      toast.success('Markerat som använd', {
        action: {
          label: 'Ångra',
          onClick: async () => {
            await undoMarkWorn.mutateAsync(result);
            await updateStatus.mutateAsync({ id: plannedOutfit.id, status: 'planned' });
            toast.success('Ångrad');
          },
        },
      });
    } catch {
      toast.error('Kunde inte markera som använd');
    }
  };

  const handleRemove = async () => {
    if (!plannedOutfit) return;
    try {
      await deletePlanned.mutateAsync(plannedOutfit.id);
      toast.success('Borttagen');
    } catch {
      toast.error('Kunde inte ta bort');
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

  return (
    <AppLayout>
      {/* Minimal header */}
      <header className="sticky top-0 bg-background/95 backdrop-blur-sm border-b z-20">
        <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-70 transition-opacity">
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
            className="active:animate-press"
          >
            <Wand2 className="w-4 h-4" />
          </Button>
        </div>
      </header>
      
      <div className="p-4 space-y-5">
        {/* Calendar connect banner */}
        <CalendarConnectBanner />

        {/* Week strip */}
        <WeekStrip 
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          plannedOutfits={plannedOutfits}
        />

        {/* Weather badge */}
        <div className="flex items-center justify-between">
          <WeatherForecastBadge date={selectedDateStr} compact={false} />
          {isWorn && (
            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
              <Check className="w-3 h-3 mr-1" />
              Använd
            </Badge>
          )}
        </div>

        {/* Calendar Events for selected day */}
        {calendarEvents && calendarEvents.length > 0 && (
          <CalendarEventsList events={calendarEvents} />
        )}

        {/* Loading state */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasGarments ? (
          <EmptyState
            icon={Shirt}
            title="Lägg till plagg först"
            description="Du behöver plagg i garderoben."
            action={{ label: 'Lägg till', onClick: () => navigate('/wardrobe/add'), icon: Shirt }}
          />
        ) : hasOutfit ? (
          /* ── Expanded outfit view ── */
          <div className="space-y-4 animate-drape-in">
            {/* Outfit image grid – taller for the expanded view */}
            <div 
              className="rounded-2xl overflow-hidden bg-muted/20 cursor-pointer active:scale-[0.99] transition-transform"
              onClick={() => navigate(`/outfits/${outfit.id}`)}
            >
              <div className="grid grid-cols-2 gap-px bg-border">
                {outfit.outfit_items.slice(0, 4).map((item) => (
                  <div key={item.id} className="aspect-[4/5] bg-card">
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
                className="flex-1 active:animate-press"
              >
                <Repeat className="w-4 h-4 mr-1.5" />
                Byt
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate(`/outfits/${outfit.id}`)}
                className="flex-1 active:animate-press"
              >
                <Info className="w-4 h-4 mr-1.5" />
                Detaljer
              </Button>
            </div>

            {/* Secondary actions */}
            <div className="flex items-center gap-4 pt-2 border-t">
              {!isWorn && (
                <button 
                  onClick={handleMarkWorn}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Markera som använd
                </button>
              )}
              <button 
                onClick={handleRemove}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1.5 transition-colors ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Ta bort
              </button>
            </div>
          </div>
        ) : (
          /* ── Empty day ── */
          <div className="space-y-4 animate-drape-in">
            {smartSlots.length > 0 && (
              <SmartDayBanner
                slots={smartSlots}
                onGenerate={() => setQuickGenerateSheetOpen(true)}
              />
            )}

            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                <CalendarDays className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">Ingen outfit planerad</p>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm"
                  onClick={() => setPlanningSheetOpen(true)}
                  disabled={isGenerating || upsertPlanned.isPending}
                  className="active:animate-press"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Planera
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setQuickGenerateSheetOpen(true)}
                  disabled={isGenerating || upsertPlanned.isPending}
                  className="active:animate-press"
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Skapa åt mig
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sheets */}
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
              toast.success(`Planerad för ${format(date, 'd MMM', { locale: sv })}`);
              setPreselectSheetOpen(false);
              window.history.replaceState({}, document.title);
            } catch {
              toast.error('Kunde inte planera outfit');
            }
          }
        }}
        isLoading={upsertPlanned.isPending}
      />
    </AppLayout>
  );
}
