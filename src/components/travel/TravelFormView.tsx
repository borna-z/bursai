import type { Dispatch, SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarIcon, Cloud, Globe, Minus, Package, Shirt, SlidersHorizontal, Plus } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { StyleMeSubNav } from '@/components/ai/StyleMeSubNav';
import { AILoadingCard } from '@/components/ui/AILoadingCard';
import { AnimatedPage } from '@/components/ui/animated-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { LocationAutocomplete } from '@/components/ui/LocationAutocomplete';
import { PageIntro } from '@/components/ui/page-intro';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import type { ForecastDay } from '@/hooks/useForecast';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { hapticLight } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import type { LucideIcon } from 'lucide-react';

import { SavedCapsulesList } from '@/components/travel/SavedCapsulesList';
import { TravelEmptyState } from '@/components/travel/TravelEmptyState';
import { TripVibeSelector } from '@/components/travel/TripVibeSelector';
import { WeatherMiniIcon } from '@/components/travel/WeatherMiniIcon';
import type { SavedCapsule, VibeId } from './types';

interface TravelFormViewProps {
  destination: string;
  setDestination: (value: string) => void;
  dateRange: DateRange | undefined;
  setDateRange: (value: DateRange | undefined) => void;
  vibe: VibeId;
  setVibe: (value: VibeId) => void;
  outfitsPerDay: number;
  setOutfitsPerDay: (value: number) => void;
  mustHaveItems: string[];
  setMustHaveItems: Dispatch<SetStateAction<string[]>>;
  minimizeItems: boolean;
  setMinimizeItems: (value: boolean) => void;
  includeTravelDays: boolean;
  setIncludeTravelDays: (value: boolean) => void;
  destCoords: { lat: number; lon: number } | null;
  showForm: boolean;
  setShowForm: (value: boolean) => void;
  isFetchingWeather: boolean;
  weatherError: string | null;
  weatherForecast: ForecastDay | null;
  allGarments: Array<{ id: string; title: string; image_path?: string; nobg_path?: string | null; category: string }> | undefined;
  savedCapsules: SavedCapsule[];
  dateLabel: string | null;
  tripNights: number;
  tripDays: number;
  planningLookCount: number;
  dateLocale: Locale;
  handleLocationSelect: (city: string, coords: { lat: number; lon: number }) => void;
  handleGenerate: () => void;
  loadSavedCapsule: (capsule: SavedCapsule) => void;
  removeSavedCapsule: (capsuleId: string) => void;
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

  const canGenerate = destination.trim().length >= 2;
  const introTitle = showForm
    ? destination || 'Build your next trip edit'
    : 'Travel Capsule';
  const introDescription = showForm
    ? dateLabel
      ? `${dateLabel} • ${planningLookCount || 0} looks planned from the dates you picked.`
      : 'Tell BURS where you are going and for how long, then shape the capsule around the trip.'
    : 'Create a lighter, smarter packing edit from the wardrobe you already own.';

  return (
    <AppLayout hideNav>
      <StyleMeSubNav />

      <AnimatedPage className="page-shell !px-5 !pt-6 page-cluster">
        <PageIntro
          eyebrow="Travel capsule"
          meta={
            showForm && dateLabel
              ? <span className="eyebrow-chip !bg-secondary/70">{dateLabel}</span>
              : undefined
          }
          title={introTitle}
          description={introDescription}
          actions={(
            <>
              <Button variant="quiet" onClick={() => navigate(-1)}>
                Back
              </Button>
              {savedCapsules.length > 0 ? (
                <Button
                  variant="outline"
                  onClick={() => setShowForm(!showForm)}
                >
                  {showForm ? 'Saved trips' : 'Start new'}
                </Button>
              ) : null}
            </>
          )}
        />

        {!showForm ? (
          <>
            <SavedCapsulesList
              capsules={savedCapsules}
              onLoad={loadSavedCapsule}
              onRemove={removeSavedCapsule}
            />
            <TravelEmptyState onStartForm={() => setShowForm(true)} />
          </>
        ) : (
          <>
            <Card surface="editorial" className="space-y-4 p-5">
              <div className="space-y-2">
                <Label className="label-editorial">{t('capsule.destination')}</Label>
                <LocationAutocomplete
                  value={destination}
                  onChange={setDestination}
                  onSelect={handleLocationSelect}
                  placeholder={t('capsule.enter_city')}
                  icon={<Globe className="h-4 w-4" strokeWidth={1.5} />}
                  inputClassName="h-12 rounded-[1.2rem] bg-background/85 border-border/60"
                />
              </div>

              {isFetchingWeather ? (
                <AILoadingCard
                  phases={[
                    { icon: Globe, label: `${t('capsule.looking_up') || 'Looking up'} ${destination}...`, duration: 1500 },
                    { icon: Cloud, label: t('qgen.fetching_weather'), duration: 0 },
                  ]}
                />
              ) : null}

              {weatherError ? (
                <p className="text-xs text-destructive">{weatherError}</p>
              ) : null}

              {weatherForecast && !isFetchingWeather && destination ? (
                <div className="surface-inset flex items-center gap-3 rounded-[1.35rem] border px-4 py-3">
                  <WeatherMiniIcon condition={weatherForecast.condition} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{destination}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {weatherForecast.temperature_min}–{weatherForecast.temperature_max}°C • {weatherForecast.condition}
                    </p>
                  </div>
                </div>
              ) : null}
            </Card>

            <Card surface="utility" className="space-y-5 p-5">
              <div className="space-y-2">
                <Label className="label-editorial">{t('capsule.travel_dates')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'h-12 w-full justify-start rounded-[1.2rem] text-left font-normal',
                        !dateRange?.from && 'text-muted-foreground',
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground/60" />
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
                      className={cn('pointer-events-auto p-3')}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="surface-inset rounded-[1.35rem] border p-4">
                  <p className="label-editorial">Trip days</p>
                  <p className="mt-2 text-[1.6rem] font-semibold tracking-[-0.05em]">{tripDays || 0}</p>
                </div>
                <div className="surface-inset rounded-[1.35rem] border p-4">
                  <p className="label-editorial">Planned looks</p>
                  <p className="mt-2 text-[1.6rem] font-semibold tracking-[-0.05em]">{planningLookCount || 0}</p>
                </div>
                <div className="surface-inset rounded-[1.35rem] border p-4">
                  <p className="label-editorial">Travel days</p>
                  <p className="mt-2 text-[1.6rem] font-semibold tracking-[-0.05em]">{includeTravelDays ? 'On' : 'Off'}</p>
                </div>
              </div>

              <div className="space-y-3">
                <TripVibeSelector vibe={vibe} onVibeChange={setVibe} label="Trip vibe" />
              </div>

              <div className="space-y-3">
                <Label className="label-editorial">{t('capsule.outfits_per_day')}</Label>
                <p className="text-sm leading-6 text-muted-foreground">{t('capsule.outfits_per_day_desc')}</p>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setOutfitsPerDay(Math.max(1, outfitsPerDay - 1));
                    }}
                    disabled={outfitsPerDay <= 1}
                    className="surface-inset flex h-11 w-11 items-center justify-center rounded-[1rem] border disabled:opacity-35"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-[2rem] font-semibold tracking-[-0.05em]">{outfitsPerDay}</span>
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setOutfitsPerDay(Math.min(4, outfitsPerDay + 1));
                    }}
                    disabled={outfitsPerDay >= 4}
                    className="surface-inset flex h-11 w-11 items-center justify-center rounded-[1rem] border disabled:opacity-35"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>

            {(allGarments?.length ?? 0) > 0 ? (
              <Card surface="utility" className="space-y-4 p-5">
                <div className="space-y-2">
                  <Label className="label-editorial">{t('capsule.must_haves')}</Label>
                  <p className="text-sm leading-6 text-muted-foreground">{t('capsule.must_haves_desc')}</p>
                </div>

                {mustHaveItems.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {mustHaveItems.slice(0, 6).map((id) => {
                      const garment = allGarments?.find((item) => item.id === id);
                      if (!garment) return null;

                      return (
                        <div key={id} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[1rem] border border-border/70 bg-muted/20">
                          <LazyImageSimple
                            imagePath={getPreferredGarmentImagePath(garment)}
                            alt={garment.title}
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              hapticLight();
                              setMustHaveItems((current) => current.filter((itemId) => itemId !== id));
                            }}
                            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-[0.62rem] font-medium text-foreground shadow-[0_8px_18px_rgba(28,25,23,0.08)]"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                    {mustHaveItems.length > 6 ? (
                      <div className="surface-inset flex h-14 w-14 shrink-0 items-center justify-center rounded-[1rem] border">
                        <span className="text-xs font-medium text-muted-foreground">+{mustHaveItems.length - 6}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}

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
                  className="w-full"
                >
                  <Shirt className="mr-2 h-4 w-4" />
                  {t('capsule.browse_wardrobe')}
                  {mustHaveItems.length > 0 ? (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      {mustHaveItems.length}
                    </Badge>
                  ) : null}
                </Button>
              </Card>
            ) : null}

            <Card surface="utility" className="space-y-4 p-5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <p className="label-editorial">{t('capsule.preferences')}</p>
              </div>

              <div className="divide-y divide-border/50 overflow-hidden rounded-[1.35rem] border border-border/60 bg-background/75">
                <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-4">
                  <div>
                    <span className="text-sm font-medium text-foreground">{t('capsule.minimize')}</span>
                    <p className="mt-1 text-xs text-muted-foreground">{t('capsule.minimize_desc')}</p>
                  </div>
                  <Switch checked={minimizeItems} onCheckedChange={setMinimizeItems} />
                </label>

                <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-4">
                  <div>
                    <span className="text-sm font-medium text-foreground">{t('capsule.travel_days')}</span>
                    <p className="mt-1 text-xs text-muted-foreground">{t('capsule.travel_days_desc')}</p>
                  </div>
                  <Switch checked={includeTravelDays} onCheckedChange={setIncludeTravelDays} />
                </label>
              </div>
            </Card>

            <div className="sticky bottom-4 z-10">
              <div className="action-bar-floating rounded-[1.6rem] p-3">
                {isGenerating ? (
                  <div className="space-y-3">
                    <AILoadingCard phases={travelCardPhases} />
                    <p className="text-center text-sm text-muted-foreground">
                      {loadingSteps[loadingStep]}
                    </p>
                  </div>
                ) : (
                  <Button onClick={handleGenerate} disabled={!canGenerate} size="lg" className="w-full">
                    <Package className="mr-2 h-4 w-4" />
                    {t('capsule.generate_new')}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </AnimatedPage>
    </AppLayout>
  );
}
