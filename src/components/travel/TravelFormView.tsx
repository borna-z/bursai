import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import {
  ArrowLeft, Globe, CalendarIcon, Shirt,
  Cloud, Package, SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LocationAutocomplete } from '@/components/ui/LocationAutocomplete';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { StyleMeSubNav } from '@/components/ai/StyleMeSubNav';
import { AnimatedPage } from '@/components/ui/animated-page';
import { AILoadingCard } from '@/components/ui/AILoadingCard';
import { TripVibeSelector } from '@/components/travel/TripVibeSelector';
import { WeatherMiniIcon } from '@/components/travel/WeatherMiniIcon';
import { SavedCapsulesList } from '@/components/travel/SavedCapsulesList';
import { TravelEmptyState } from '@/components/travel/TravelEmptyState';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { hapticLight } from '@/lib/haptics';
import { EASE_CURVE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import type { ForecastDay } from '@/hooks/useForecast';
import type { SavedCapsule, VibeId } from './types';
import type { LucideIcon } from 'lucide-react';

interface TravelFormViewProps {
  /* Form state */
  destination: string;
  setDestination: (v: string) => void;
  dateRange: DateRange | undefined;
  setDateRange: (v: DateRange | undefined) => void;
  vibe: VibeId;
  setVibe: (v: VibeId) => void;
  outfitsPerDay: number;
  setOutfitsPerDay: (v: number) => void;
  mustHaveItems: string[];
  setMustHaveItems: React.Dispatch<React.SetStateAction<string[]>>;
  minimizeItems: boolean;
  setMinimizeItems: (v: boolean) => void;
  includeTravelDays: boolean;
  setIncludeTravelDays: (v: boolean) => void;
  destCoords: { lat: number; lon: number } | null;
  showForm: boolean;
  setShowForm: (v: boolean) => void;

  /* Weather */
  isFetchingWeather: boolean;
  weatherError: string | null;
  weatherForecast: ForecastDay | null;

  /* Data */
  allGarments: Array<{ id: string; title: string; image_path?: string; nobg_path?: string | null; category: string }> | undefined;
  savedCapsules: SavedCapsule[];
  dateLabel: string | null;
  tripNights: number;
  tripDays: number;
  planningLookCount: number;
  dateLocale: Locale;

  /* Handlers */
  handleLocationSelect: (city: string, coords: { lat: number; lon: number }) => void;
  handleGenerate: () => void;
  loadSavedCapsule: (capsule: SavedCapsule) => void;
  removeSavedCapsule: (capsuleId: string) => void;

  /* Loading */
  isGenerating: boolean;
  loadingStep: number;
  loadingSteps: string[];
  travelCardPhases: Array<{ icon: LucideIcon; label: string; duration: number }>;
}

export function TravelFormView({
  destination,
  setDestination,
  dateRange,
  setDateRange,
  vibe,
  setVibe,
  outfitsPerDay,
  setOutfitsPerDay,
  mustHaveItems,
  setMustHaveItems,
  minimizeItems,
  setMinimizeItems,
  includeTravelDays,
  setIncludeTravelDays,
  destCoords,
  showForm,
  setShowForm,
  isFetchingWeather,
  weatherError,
  weatherForecast,
  allGarments,
  savedCapsules,
  dateLabel,
  tripNights,
  tripDays,
  planningLookCount,
  dateLocale,
  handleLocationSelect,
  handleGenerate,
  loadSavedCapsule,
  removeSavedCapsule,
  isGenerating,
  loadingStep,
  loadingSteps,
  travelCardPhases,
}: TravelFormViewProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <AppLayout hideNav>
      <StyleMeSubNav />
      <AnimatedPage className="px-5 pb-8 pt-12 max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-muted/30 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 style={{
              fontFamily: '"Playfair Display", serif',
              fontStyle: 'italic',
              fontSize: 22,
              color: '#1C1917',
              margin: 0,
            }}>
              Travel Capsule
            </h1>
            <p style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 13,
              color: 'rgba(28,25,23,0.5)',
              margin: 0,
            }}>
              A wardrobe built for the trip
            </p>
          </div>
        </div>

        {/* Saved capsules */}
        {!showForm && (
          <SavedCapsulesList
            capsules={savedCapsules}
            onLoad={loadSavedCapsule}
            onRemove={removeSavedCapsule}
          />
        )}

        {/* Editorial empty state */}
        {!showForm && <TravelEmptyState onStartForm={() => setShowForm(true)} />}

        {showForm && <div className="space-y-6">
          {/* a. DESTINATION */}
          <div className="space-y-2">
            <Label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
              {t('capsule.destination')}
            </Label>
            <LocationAutocomplete
              value={destination}
              onChange={setDestination}
              onSelect={handleLocationSelect}
              placeholder={t('capsule.enter_city')}
              icon={<Globe className="w-4 h-4" strokeWidth={1.5} />}
              inputClassName="h-12 rounded-xl bg-card/60 border-border/15"
            />
            {isFetchingWeather && (
              <AILoadingCard
                phases={[
                  { icon: Globe, label: `${t('capsule.looking_up') || 'Looking up'} ${destination}...`, duration: 1500 },
                  { icon: Cloud, label: t('qgen.fetching_weather'), duration: 0 },
                ]}
                className="mt-1"
              />
            )}
            {weatherError && <p className="text-xs text-destructive">{weatherError}</p>}
            {weatherForecast && !isFetchingWeather && destination && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-card/60 border border-border/10">
                <WeatherMiniIcon condition={weatherForecast.condition} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{destination}</span>
                  <span className="text-muted-foreground text-sm ml-1.5">
                    {weatherForecast.temperature_min}–{weatherForecast.temperature_max}°C
                  </span>
                </div>
                <span className="text-xs text-muted-foreground/60 capitalize">{weatherForecast.condition}</span>
              </div>
            )}
          </div>

          {/* b. TRAVEL DATES */}
          <div className="space-y-2">
            <Label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
              {t('capsule.travel_dates')}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full h-12 rounded-xl justify-start text-left font-normal bg-card/60 border-border/15',
                    !dateRange?.from && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="w-4 h-4 mr-2 text-muted-foreground/50" />
                  {dateLabel ? `${dateLabel} (${tripNights} ${t('capsule.nights')})` : t('capsule.select_dates_hint')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={1}
                  disabled={(date) => date < new Date()}
                  locale={dateLocale}
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* c. TRIP VIBE */}
          <TripVibeSelector vibe={vibe} onVibeChange={setVibe} label="Trip vibe" />

          {/* d. TRIP SUMMARY */}
          <div className="space-y-2">
            <Label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
              Trip summary
            </Label>
            <div className="rounded-xl border border-border/10 bg-card/60 px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Trip days</span>
                <span className="font-medium tabular-nums">{tripDays || 0}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Planned looks</span>
                <span className="font-medium tabular-nums">{planningLookCount || 0}</span>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground/60">
                Selected dates drive the capsule length. Travel days add extra looks, not extra trip dates.
              </p>
            </div>
          </div>

          {/* e. OUTFITS PER DAY */}
          <div className="space-y-2">
            <Label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
              {t('capsule.outfits_per_day')}
            </Label>
            <p className="text-[11px] text-muted-foreground/50">{t('capsule.outfits_per_day_desc')}</p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => { hapticLight(); setOutfitsPerDay(Math.max(1, outfitsPerDay - 1)); }}
                disabled={outfitsPerDay <= 1}
                className="w-10 h-10 rounded-xl bg-card/60 border border-border/15 flex items-center justify-center disabled:opacity-30 transition-opacity"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-2xl font-semibold w-8 text-center">{outfitsPerDay}</span>
              <button
                onClick={() => { hapticLight(); setOutfitsPerDay(Math.min(4, outfitsPerDay + 1)); }}
                disabled={outfitsPerDay >= 4}
                className="w-10 h-10 rounded-xl bg-card/60 border border-border/15 flex items-center justify-center disabled:opacity-30 transition-opacity"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* f. MUST-HAVES */}
          {(allGarments?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <Label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
                {t('capsule.must_haves')}
              </Label>
              <p className="text-[11px] text-muted-foreground/50">{t('capsule.must_haves_desc')}</p>

              {mustHaveItems.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {mustHaveItems.slice(0, 6).map(id => {
                    const g = allGarments?.find(gar => gar.id === id);
                    if (!g) return null;
                    return (
                      <div key={id} className="relative flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-primary/30 bg-muted/20">
                        <LazyImageSimple imagePath={getPreferredGarmentImagePath(g)} alt={g.title} className="w-full h-full object-cover" />
                        <button
                          onClick={() => { hapticLight(); setMustHaveItems(prev => prev.filter(i => i !== id)); }}
                          className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive flex items-center justify-center"
                        >
                          <span className="text-[8px] text-destructive-foreground font-bold">x</span>
                        </button>
                      </div>
                    );
                  })}
                  {mustHaveItems.length > 6 && (
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted/30 border border-border/10 flex items-center justify-center">
                      <span className="text-xs text-muted-foreground font-medium">+{mustHaveItems.length - 6}</span>
                    </div>
                  )}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  hapticLight();
                  navigate('/plan/travel-capsule/pick-must-haves', {
                    state: {
                      mustHaveItems,
                      destination,
                      destCoords,
                      vibe,
                      dateRange: dateRange?.from && dateRange?.to
                        ? { from: dateRange.from.toISOString(), to: dateRange.to.toISOString() }
                        : null,
                      minimizeItems,
                      includeTravelDays,
                      outfitsPerDay,
                    },
                  });
                }}
                className="w-full h-11 rounded-xl bg-card/60 border-border/15 text-sm"
              >
                <Shirt className="w-4 h-4 mr-2" />
                {t('capsule.browse_wardrobe')}
                {mustHaveItems.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">{mustHaveItems.length}</Badge>
                )}
              </Button>
            </div>
          )}

          {/* g. PACKING PREFERENCES */}
          <div className="space-y-3">
            <Label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase flex items-center gap-1.5">
              <SlidersHorizontal className="w-3 h-3" />
              {t('capsule.preferences')}
            </Label>
            <div className="rounded-xl border border-border/10 bg-card/60 divide-y divide-border/10">
              <label className="flex items-center justify-between px-4 py-3.5 cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-foreground">{t('capsule.minimize')}</span>
                  <p className="text-[11px] text-muted-foreground/60">{t('capsule.minimize_desc')}</p>
                </div>
                <Switch checked={minimizeItems} onCheckedChange={setMinimizeItems} />
              </label>
              <label className="flex items-center justify-between px-4 py-3.5 cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-foreground">{t('capsule.travel_days')}</span>
                  <p className="text-[11px] text-muted-foreground/60">{t('capsule.travel_days_desc')}</p>
                </div>
                <Switch checked={includeTravelDays} onCheckedChange={setIncludeTravelDays} />
              </label>
            </div>
          </div>

          {/* h. Generate */}
          <div className="space-y-1">
            {isGenerating ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, ease: EASE_CURVE }}
                className="space-y-3"
              >
                <AILoadingCard phases={travelCardPhases} />
                <p style={{ fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 16, color: '#1C1917', textAlign: 'center', margin: '12px 0' }}>
                  {loadingSteps[loadingStep]}
                </p>
              </motion.div>
            ) : (
              <Button onClick={handleGenerate} disabled={!destination || destination.length < 2} className="w-full h-12 rounded-xl" size="lg">
                <Package className="w-4 h-4 mr-2" />{t('capsule.generate_new')}
              </Button>
            )}
          </div>
        </div>}
      </AnimatedPage>
    </AppLayout>
  );
}
