import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, addDays, isSameDay } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Wand2, Shirt, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { WeekStrip } from '@/components/plan/WeekStrip';
import { DayCard } from '@/components/plan/DayCard';
import { PlanningSheet } from '@/components/plan/PlanningSheet';
import { QuickGenerateSheet } from '@/components/plan/QuickGenerateSheet';
import { SwapSheet } from '@/components/plan/SwapSheet';
import { QuickPlanSheet } from '@/components/plan/QuickPlanSheet';
import { PreselectDateSheet } from '@/components/plan/PreselectDateSheet';
import { 
  usePlannedOutfits, 
  useUpsertPlannedOutfit, 
  useDeletePlannedOutfit,
  useUpdatePlannedOutfitStatus,
  type PlannedOutfit 
} from '@/hooks/usePlannedOutfits';
import { useOutfitGenerator } from '@/hooks/useOutfitGenerator';
import { useMarkOutfitWorn, useUndoMarkWorn, type WornResult } from '@/hooks/useOutfits';
import { useGarments } from '@/hooks/useGarments';
import { useProfile } from '@/hooks/useProfile';
import { useForecast } from '@/hooks/useForecast';

// Import the Outfits page components
import OutfitsPage from '@/pages/Outfits';

export default function PlanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('plan');
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Get preselected outfit from navigation state
  const preselectedOutfitId = (location.state as { preselectedOutfitId?: string })?.preselectedOutfitId;
  
  // Sheets state
  const [planningSheetOpen, setPlanningSheetOpen] = useState(false);
  const [quickGenerateSheetOpen, setQuickGenerateSheetOpen] = useState(false);
  const [swapSheetOpen, setSwapSheetOpen] = useState(false);
  const [quickPlanSheetOpen, setQuickPlanSheetOpen] = useState(false);
  const [targetDate, setTargetDate] = useState<Date>(new Date());
  const [currentOutfitId, setCurrentOutfitId] = useState<string | null>(null);
  
  // Auto-generation state
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [generatingDayIndex, setGeneratingDayIndex] = useState(0);
  
  // Preselect sheet state
  const [preselectSheetOpen, setPreselectSheetOpen] = useState(!!preselectedOutfitId);
  
  // Data hooks
  const { data: plannedOutfits = [], isLoading } = usePlannedOutfits();
  const { data: garments = [] } = useGarments();
  const { data: profile } = useProfile();
  const { getForecastForDate } = useForecast({ homeCity: profile?.home_city });
  
  // Mutation hooks
  const upsertPlanned = useUpsertPlannedOutfit();
  const deletePlanned = useDeletePlannedOutfit();
  const updateStatus = useUpdatePlannedOutfitStatus();
  const { generateOutfit, isGenerating } = useOutfitGenerator();
  const markWorn = useMarkOutfitWorn();
  const undoMarkWorn = useUndoMarkWorn();

  // Generate days for the week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));
  }, []);

  // Get planned outfit for a specific date
  const getPlannedForDate = useCallback((date: Date): PlannedOutfit | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return plannedOutfits.find(p => p.date === dateStr) || null;
  }, [plannedOutfits]);

  // Handle plan action
  const handlePlan = (date: Date) => {
    setTargetDate(date);
    setPlanningSheetOpen(true);
  };

  // Handle quick generate
  const handleQuickGenerate = (date: Date) => {
    setTargetDate(date);
    setQuickGenerateSheetOpen(true);
  };

  // Handle select outfit from saved
  const handleSelectOutfit = async (outfitId: string) => {
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    try {
      await upsertPlanned.mutateAsync({ date: dateStr, outfitId });
      toast.success('Planerad', {
        action: {
          label: 'Ångra',
          onClick: async () => {
            const planned = getPlannedForDate(targetDate);
            if (planned) {
              await deletePlanned.mutateAsync(planned.id);
              toast.success('Ångrad');
            }
          },
        },
      });
    } catch (error) {
      toast.error('Kunde inte planera outfit');
    }
  };

  // Handle generate outfit for date
  const handleGenerateForDate = async (request: {
    occasion: string;
    style: string | null;
    temperature: number | undefined;
  }) => {
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    try {
      const outfit = await generateOutfit({
        occasion: request.occasion,
        style: request.style,
        weather: {
          temperature: request.temperature,
          precipitation: 'none',
          wind: 'low',
        },
      });
      
      await upsertPlanned.mutateAsync({ date: dateStr, outfitId: outfit.id });
      setQuickGenerateSheetOpen(false);
      toast.success('Outfit skapad och planerad');
    } catch (error) {
      toast.error('Kunde inte skapa outfit. Försök igen.');
    }
  };

  // Handle swap actions
  const handleSwap = (date: Date, outfitId: string) => {
    setTargetDate(date);
    setCurrentOutfitId(outfitId);
    setSwapSheetOpen(true);
  };

  const handleCreateSimilar = () => {
    setQuickGenerateSheetOpen(true);
  };

  const handleSelectOther = () => {
    setPlanningSheetOpen(true);
  };

  const handleGenerateNew = () => {
    setQuickGenerateSheetOpen(true);
  };

  // Handle mark as worn
  const handleMarkWorn = async (plannedOutfit: PlannedOutfit) => {
    if (!plannedOutfit.outfit) return;
    
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
    } catch (error) {
      toast.error('Kunde inte markera som använd');
    }
  };

  // Handle remove planned outfit
  const handleRemove = async (plannedOutfit: PlannedOutfit) => {
    try {
      await deletePlanned.mutateAsync(plannedOutfit.id);
      toast.success('Borttagen');
    } catch (error) {
      toast.error('Kunde inte ta bort');
    }
  };

  // Handle auto-generate week
  const handleAutoGenerateWeek = async (days: number) => {
    setIsAutoGenerating(true);
    
    const occasions = ['vardag', 'jobb', 'vardag', 'jobb', 'vardag', 'fest', 'vardag'];
    
    for (let i = 0; i < days; i++) {
      setGeneratingDayIndex(i + 1);
      const date = addDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Skip if already planned
      const existing = getPlannedForDate(date);
      if (existing?.outfit_id) continue;
      
      // Get weather for day
      const forecast = getForecastForDate(dateStr);
      const temp = forecast 
        ? Math.round((forecast.temperature_max + forecast.temperature_min) / 2)
        : 15;
      
      try {
        const outfit = await generateOutfit({
          occasion: occasions[i % occasions.length],
          style: null,
          weather: {
            temperature: temp,
            precipitation: forecast?.precipitation_probability && forecast.precipitation_probability > 50 ? 'rain' : 'none',
            wind: 'low',
          },
        });
        
        await upsertPlanned.mutateAsync({ date: dateStr, outfitId: outfit.id });
      } catch (error) {
        console.error(`Failed to generate outfit for day ${i + 1}:`, error);
      }
      
      // Small delay between generations
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setIsAutoGenerating(false);
    setGeneratingDayIndex(0);
  };

  // Check if user has garments
  const hasGarments = garments.length > 0;

  if (activeTab === 'outfits') {
    return (
      <AppLayout>
        <div className="p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="plan">Plan</TabsTrigger>
              <TabsTrigger value="outfits">Outfits</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {/* Render Outfits content without the AppLayout wrapper */}
        <OutfitsPageContent />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader 
        title="Plan"
        subtitle="Din vecka, klar på 30 sek."
        actions={
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setQuickPlanSheetOpen(true)}
            disabled={!hasGarments}
            className="active:animate-press"
          >
            <Wand2 className="w-4 h-4 mr-1.5" />
            Hela veckan
          </Button>
        }
      />
      
      <div className="p-4 space-y-4">
        {/* Tab switcher */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="outfits">Outfits</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Week strip */}
        <WeekStrip 
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          plannedOutfits={plannedOutfits}
        />

        {/* Day cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !hasGarments ? (
          <EmptyState
            icon={Shirt}
            title="Lägg till plagg först"
            description="Du behöver plagg i din garderob för att kunna planera outfits."
            action={{
              label: 'Lägg till plagg',
              onClick: () => navigate('/wardrobe/add'),
              icon: Shirt,
            }}
          />
        ) : (
          <div className="space-y-3">
            {weekDays.map((date) => {
              const planned = getPlannedForDate(date);
              return (
                <DayCard
                  key={date.toISOString()}
                  date={date}
                  plannedOutfit={planned}
                  onPlan={() => handlePlan(date)}
                  onQuickGenerate={() => handleQuickGenerate(date)}
                  onSwap={() => planned?.outfit && handleSwap(date, planned.outfit.id)}
                  onMarkWorn={() => planned && handleMarkWorn(planned)}
                  onRemove={() => planned && handleRemove(planned)}
                  isLoading={isGenerating || upsertPlanned.isPending}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Sheets */}
      <PlanningSheet
        open={planningSheetOpen}
        onOpenChange={setPlanningSheetOpen}
        date={targetDate}
        onSelectOutfit={handleSelectOutfit}
        onCreateNew={() => {
          setPlanningSheetOpen(false);
          setQuickGenerateSheetOpen(true);
        }}
      />

      <QuickGenerateSheet
        open={quickGenerateSheetOpen}
        onOpenChange={setQuickGenerateSheetOpen}
        date={targetDate}
        onGenerate={handleGenerateForDate}
        isGenerating={isGenerating}
      />

      <SwapSheet
        open={swapSheetOpen}
        onOpenChange={setSwapSheetOpen}
        outfitId={currentOutfitId || ''}
        onCreateSimilar={handleCreateSimilar}
        onSelectOther={handleSelectOther}
        onGenerateNew={handleGenerateNew}
      />

      <QuickPlanSheet
        open={quickPlanSheetOpen}
        onOpenChange={setQuickPlanSheetOpen}
        onAutoGenerate={handleAutoGenerateWeek}
        isGenerating={isAutoGenerating}
        generatingDay={generatingDayIndex}
      />

      {/* Preselect Date Sheet - shown when coming from OutfitDetail */}
      <PreselectDateSheet
        open={preselectSheetOpen}
        onOpenChange={(open) => {
          setPreselectSheetOpen(open);
          // Clear the navigation state when closing
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
            } catch (error) {
              toast.error('Kunde inte planera outfit');
            }
          }
        }}
        isLoading={upsertPlanned.isPending}
      />
    </AppLayout>
  );
}

// Separate component for Outfits content to avoid double AppLayout
function OutfitsPageContent() {
  const navigate = useNavigate();
  // This will be a simplified version - we import the actual Outfits page content
  return (
    <div className="px-4 pb-4">
      {/* The Outfits page content will be rendered here */}
      <Button 
        variant="outline" 
        className="w-full mb-4"
        onClick={() => navigate('/outfits')}
      >
        Visa alla outfits
      </Button>
    </div>
  );
}
