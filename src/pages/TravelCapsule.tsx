import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, differenceInCalendarDays, addDays } from 'date-fns';
import {
  ArrowLeft, MapPin, CalendarIcon, Sparkles, Loader2, Luggage, Shirt,
  LightbulbIcon, ChevronDown, ChevronUp, Plane, Umbrella, Sun,
  CloudRain, CalendarPlus, Package, SlidersHorizontal,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { AnimatedPage } from '@/components/ui/animated-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Chip } from '@/components/ui/chip';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProfile } from '@/hooks/useProfile';
import { useGarmentsByIds } from '@/hooks/useGarmentsByIds';
import { usePlannedOutfits } from '@/hooks/usePlannedOutfits';
import { getCoordinatesFromCity, fetchForecast, type ForecastDay } from '@/hooks/useForecast';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getDateFnsLocale } from '@/lib/dateLocale';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import type { DateRange } from 'react-day-picker';

interface CapsuleOutfit {
  day: number;
  occasion: string;
  items: string[];
  note: string;
}

interface CapsuleResult {
  capsule_items: string[];
  outfits: CapsuleOutfit[];
  packing_tips: string[];
  total_combinations: number;
  reasoning: string;
}

const OCCASIONS = [
  { id: 'vardag', labelKey: 'home.occasion.vardag' },
  { id: 'jobb', labelKey: 'home.occasion.jobb' },
  { id: 'fest', labelKey: 'home.occasion.fest' },
  { id: 'dejt', labelKey: 'home.occasion.dejt' },
  { id: 'traning', labelKey: 'home.occasion.traning' },
  { id: 'beach', labelKey: 'capsule.occasion_beach' },
  { id: 'hiking', labelKey: 'capsule.occasion_hiking' },
  { id: 'formal', labelKey: 'capsule.occasion_formal' },
];

const WeatherIcon = ({ condition }: { condition?: string }) => {
  if (!condition) return <Sun className="w-4 h-4 text-primary" />;
  if (condition.includes('rain')) return <CloudRain className="w-4 h-4 text-accent" />;
  if (condition.includes('cloud')) return <Umbrella className="w-4 h-4 text-muted-foreground" />;
  return <Sun className="w-4 h-4 text-primary" />;
};

export default function TravelCapsule() {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const { data: profile } = useProfile();
  const dateLocale = getDateFnsLocale(locale);

  const [destination, setDestination] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>(['vardag']);
  const [minimizeItems, setMinimizeItems] = useState(true);
  const [includeTravelDays, setIncludeTravelDays] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<CapsuleResult | null>(null);
  const [weatherForecast, setWeatherForecast] = useState<ForecastDay | null>(null);
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);

  const { data: capsuleGarments } = useGarmentsByIds(result?.capsule_items || []);
  const garmentMap = new Map((capsuleGarments || []).map(g => [g.id, g]));

  // Calculate trip duration from date range
  const tripNights = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 0;
    return differenceInCalendarDays(dateRange.to, dateRange.from);
  }, [dateRange]);

  const tripDays = tripNights + (includeTravelDays ? 2 : 0);

  const toggleOccasion = (id: string) => {
    setSelectedOccasions(prev =>
      prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]
    );
  };

  const lookupWeather = useCallback(async () => {
    if (!destination || destination.length < 2) return;
    setIsFetchingWeather(true);
    setWeatherError(null);
    try {
      const coords = await getCoordinatesFromCity(destination);
      if (!coords) { setWeatherError(t('qgen.place_not_found')); return; }
      const forecastDays = await fetchForecast(coords.lat, coords.lon);
      if (forecastDays.length > 0) {
        const avgMax = Math.round(forecastDays.reduce((s, d) => s + d.temperature_max, 0) / forecastDays.length);
        const avgMin = Math.round(forecastDays.reduce((s, d) => s + d.temperature_min, 0) / forecastDays.length);
        const avgPrecip = forecastDays.reduce((s, d) => s + (d.precipitation_probability || 0), 0) / forecastDays.length;
        const condition = avgPrecip > 50 ? 'rain' : avgPrecip > 25 ? 'partly cloudy' : 'clear';
        setWeatherForecast({
          date: forecastDays[0].date,
          temperature_max: avgMax,
          temperature_min: avgMin,
          condition,
          precipitation_probability: avgPrecip,
        } as ForecastDay);
      }
    } catch {
      setWeatherError(t('qgen.weather_error'));
    } finally {
      setIsFetchingWeather(false);
    }
  }, [destination, t]);

  const handleGenerate = async () => {
    if (!destination) { toast.error(t('capsule.enter_destination')); return; }
    if (!dateRange?.from || !dateRange?.to) { toast.error(t('capsule.select_dates')); return; }

    if (!weatherForecast) await lookupWeather();

    setIsGenerating(true);
    try {
      const userLocale = (profile?.preferences as Record<string, string> | null)?.locale || locale;

      const { data, error } = await supabase.functions.invoke('travel_capsule', {
        body: {
          duration_days: tripDays || tripNights,
          destination,
          start_date: format(dateRange.from, 'yyyy-MM-dd'),
          end_date: format(dateRange.to, 'yyyy-MM-dd'),
          weather: weatherForecast ? {
            temperature_min: weatherForecast.temperature_min,
            temperature_max: weatherForecast.temperature_max,
            condition: weatherForecast.condition,
          } : null,
          occasions: selectedOccasions,
          minimize_items: minimizeItems,
          include_travel_days: includeTravelDays,
          locale: userLocale,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult(data as CapsuleResult);
      hapticSuccess();
      toast.success(t('capsule.created'));
    } catch (err) {
      toast.error(t('capsule.create_error'));
      console.error('Travel capsule error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddToCalendar = async () => {
    if (!result || !dateRange?.from) return;
    setIsAddingToCalendar(true);
    try {
      const rows = result.outfits.map(outfit => ({
        date: format(addDays(dateRange.from!, outfit.day - 1), 'yyyy-MM-dd'),
        note: `${destination} – ${outfit.occasion}`,
        status: 'planned' as const,
      }));

      // Use planned_outfits to schedule
      for (const row of rows) {
        await supabase.from('planned_outfits').insert({
          user_id: (await supabase.auth.getUser()).data.user!.id,
          date: row.date,
          note: row.note,
          status: row.status,
        });
      }

      hapticSuccess();
      toast.success(t('capsule.added_to_calendar'));
    } catch {
      toast.error(t('capsule.calendar_error'));
    } finally {
      setIsAddingToCalendar(false);
    }
  };

  const dateLabel = useMemo(() => {
    if (!dateRange?.from) return null;
    const from = format(dateRange.from, 'MMM d', { locale: dateLocale });
    if (!dateRange.to) return from;
    const to = format(dateRange.to, 'MMM d', { locale: dateLocale });
    return `${from} – ${to} (${tripNights} ${t('capsule.nights')})`;
  }, [dateRange, tripNights, t, dateLocale]);

  const isFormValid = destination.length >= 2 && dateRange?.from && dateRange?.to && selectedOccasions.length > 0;

  // Group capsule items by category for results
  const groupedItems = useMemo(() => {
    if (!result) return {};
    const groups: Record<string, typeof capsuleGarments> = {};
    for (const id of result.capsule_items) {
      const g = garmentMap.get(id);
      if (!g) continue;
      const cat = g.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat]!.push(g);
    }
    return groups;
  }, [result, garmentMap, capsuleGarments]);

  return (
    <AppLayout hideNav>
      <AnimatedPage className="px-5 pb-8 pt-12 max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-muted/30 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold">{t('capsule.title')}</h1>
            <p className="text-xs text-muted-foreground">{t('capsule.subtitle')}</p>
          </div>
        </div>

        {!result ? (
          /* ─── Input Form ─── */
          <div className="space-y-6">

            {/* ── Step 1: Where ── */}
            <div className="space-y-2">
              <Label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
                {t('capsule.destination')}
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                <Input
                  placeholder={t('capsule.enter_city')}
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  onBlur={() => lookupWeather()}
                  className="pl-9 h-12 rounded-xl bg-card/60 border-border/15"
                />
              </div>

              {/* Weather preview */}
              {isFetchingWeather && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />{t('qgen.fetching_weather')}
                </p>
              )}
              {weatherError && <p className="text-xs text-destructive">{weatherError}</p>}
              {weatherForecast && !isFetchingWeather && destination && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-card/60 border border-border/10">
                  <WeatherIcon condition={weatherForecast.condition} />
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

            {/* ── Step 2: When ── */}
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
                    {dateLabel || t('capsule.select_dates_hint')}
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
              {dateLabel && (
                <p className="text-xs text-muted-foreground/60 pl-1">{dateLabel}</p>
              )}
            </div>

            {/* ── Step 3: What activities ── */}
            <div className="space-y-2">
              <Label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
                {t('capsule.occasions')}
              </Label>
              <p className="text-[11px] text-muted-foreground/50">{t('capsule.occasions_hint')}</p>
              <div className="flex flex-wrap gap-2">
                {OCCASIONS.map(o => (
                  <Chip
                    key={o.id}
                    selected={selectedOccasions.includes(o.id)}
                    onClick={() => { hapticLight(); toggleOccasion(o.id); }}
                    size="lg"
                  >
                    {t(o.labelKey)}
                  </Chip>
                ))}
              </div>
            </div>

            {/* ── Step 4: Packing preferences ── */}
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

            {/* ── Generate button ── */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !isFormValid}
              className="w-full h-12 rounded-xl"
              size="lg"
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('capsule.generating')}</>
              ) : (
                <><Package className="w-4 h-4 mr-2" />{t('capsule.generate_new')}</>
              )}
            </Button>
          </div>
        ) : (
          /* ─── Results ─── */
          <div className="space-y-6">

            {/* Summary card */}
            <div className="rounded-xl border border-border/10 bg-card/60 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Plane className="w-5 h-5 text-primary" />
                <span className="font-medium">{destination}</span>
              </div>
              {dateLabel && (
                <p className="text-xs text-muted-foreground">{dateLabel}</p>
              )}
              <p className="text-sm text-foreground/80 leading-relaxed">{result.reasoning}</p>
              <div className="flex gap-3 pt-1">
                <Badge variant="secondary" className="text-xs">
                  <Shirt className="w-3 h-3 mr-1" />
                  {result.capsule_items.length} {t('capsule.items')}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {result.total_combinations} {t('capsule.combinations')}
                </Badge>
              </div>
            </div>

            {/* Packing list grouped by category */}
            <div className="space-y-3">
              <h2 className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
                {t('capsule.pack_these')}
              </h2>
              {Object.entries(groupedItems).map(([category, items]) => (
                <div key={category} className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground capitalize">{category}</span>
                  <div className="grid grid-cols-4 gap-2">
                    {(items || []).map(g => (
                      <div key={g.id} className="space-y-1">
                        <div className="aspect-square rounded-xl overflow-hidden bg-muted/30">
                          <LazyImageSimple imagePath={g.image_path} alt={g.title} className="w-full h-full" />
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate text-center">{g.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Day-by-day outfits */}
            <div className="space-y-3">
              <h2 className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
                {t('capsule.day_plan')}
              </h2>
              <div className="space-y-2">
                {result.outfits.map((outfit, idx) => {
                  const dayDate = dateRange?.from ? format(addDays(dateRange.from, outfit.day - 1), 'EEE, MMM d', { locale: dateLocale }) : null;
                  return (
                    <div key={idx} className="rounded-xl border border-border/10 overflow-hidden bg-card/40">
                      <button
                        onClick={() => { hapticLight(); setExpandedDay(expandedDay === outfit.day ? null : outfit.day); }}
                        className="w-full flex items-center justify-between p-3.5 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-[11px] font-mono text-muted-foreground/60 w-6">{outfit.day}</span>
                          <div className="text-left">
                            {dayDate && <span className="text-xs text-foreground block">{dayDate}</span>}
                            <Badge variant="secondary" className="text-[10px] capitalize mt-0.5">{outfit.occasion}</Badge>
                          </div>
                        </div>
                        {expandedDay === outfit.day ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground/40" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground/40" />
                        )}
                      </button>
                      {expandedDay === outfit.day && (
                        <div className="px-3.5 pb-3.5 space-y-2">
                          <div className="flex gap-2 overflow-x-auto scrollbar-none">
                            {outfit.items.map(itemId => {
                              const g = garmentMap.get(itemId);
                              if (!g) return null;
                              return (
                                <div key={itemId} className="w-16 shrink-0">
                                  <div className="aspect-square rounded-lg overflow-hidden bg-muted/30">
                                    <LazyImageSimple imagePath={g.image_path} alt={g.title} className="w-full h-full" />
                                  </div>
                                  <p className="text-[9px] text-muted-foreground truncate text-center mt-0.5">{g.title}</p>
                                </div>
                              );
                            })}
                          </div>
                          {outfit.note && (
                            <p className="text-xs text-muted-foreground/70">{outfit.note}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Packing tips */}
            {result.packing_tips.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase flex items-center gap-1.5">
                  <LightbulbIcon className="w-3 h-3" />
                  {t('capsule.tips')}
                </h2>
                <ul className="space-y-1.5">
                  {result.packing_tips.map((tip, idx) => (
                    <li key={idx} className="text-xs text-muted-foreground/80 flex gap-2">
                      <span className="text-primary">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-2">
              <Button
                onClick={handleAddToCalendar}
                disabled={isAddingToCalendar}
                className="w-full h-11 rounded-xl"
                variant="outline"
              >
                {isAddingToCalendar ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CalendarPlus className="w-4 h-4 mr-2" />
                )}
                {t('capsule.add_to_calendar')}
              </Button>
              <Button variant="ghost" onClick={() => setResult(null)} className="w-full rounded-xl text-muted-foreground">
                {t('capsule.new_trip')}
              </Button>
            </div>
          </div>
        )}
      </AnimatedPage>
    </AppLayout>
  );
}
