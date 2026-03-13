import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, differenceInCalendarDays, addDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, MapPin, CalendarIcon, Loader2, Shirt,
  LightbulbIcon, Plane, Umbrella, Sun, CloudRain, Cloud,
  CalendarPlus, Package, SlidersHorizontal, Pencil,
  Check, Share2, Snowflake, RefreshCw,
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
import { getCoordinatesFromCity, fetchForecast, fetchHistoricalWeather, type ForecastDay } from '@/hooks/useForecast';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getDateFnsLocale } from '@/lib/dateLocale';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { EASE_CURVE, STAGGER_DELAY } from '@/lib/motion';
import type { DateRange } from 'react-day-picker';

/* ─── Types ─── */
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

/* ─── Constants ─── */
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

/* ─── Helpers ─── */
const WeatherMiniIcon = ({ condition, className }: { condition?: string; className?: string }) => {
  const cls = cn('w-3.5 h-3.5', className);
  if (!condition) return <Sun className={cn(cls, 'text-primary')} />;
  if (condition.includes('snow')) return <Snowflake className={cn(cls, 'text-accent')} />;
  if (condition.includes('rain') || condition.includes('drizzle') || condition.includes('shower')) return <CloudRain className={cn(cls, 'text-accent')} />;
  if (condition.includes('cloud') || condition.includes('fog')) return <Cloud className={cn(cls, 'text-muted-foreground')} />;
  return <Sun className={cn(cls, 'text-primary')} />;
};

/* ─── Main Component ─── */
export default function TravelCapsule() {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const { data: profile } = useProfile();
  const dateLocale = getDateFnsLocale(locale);

  // ── Form state ──
  const [destination, setDestination] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>(['vardag']);
  const [minimizeItems, setMinimizeItems] = useState(true);
  const [includeTravelDays, setIncludeTravelDays] = useState(false);

  // ── Generation state ──
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<CapsuleResult | null>(null);

  // ── Weather state ──
  const [weatherForecast, setWeatherForecast] = useState<ForecastDay | null>(null);
  const [forecastDays, setForecastDays] = useState<ForecastDay[]>([]);
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // ── Results state ──
  const [activeTab, setActiveTab] = useState<'packing' | 'outfits'>('packing');
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);

  // ── Garment data ──
  const { data: capsuleGarments } = useGarmentsByIds(result?.capsule_items || []);
  const garmentMap = useMemo(
    () => new Map((capsuleGarments || []).map(g => [g.id, g])),
    [capsuleGarments]
  );

  // ── Derived values ──
  const tripNights = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 0;
    return differenceInCalendarDays(dateRange.to, dateRange.from);
  }, [dateRange]);

  const tripDays = tripNights + (includeTravelDays ? 2 : 0);

  const dateLabel = useMemo(() => {
    if (!dateRange?.from) return null;
    const from = format(dateRange.from, 'MMM d', { locale: dateLocale });
    if (!dateRange.to) return from;
    const to = format(dateRange.to, 'MMM d', { locale: dateLocale });
    return `${from} – ${to}`;
  }, [dateRange, dateLocale]);

  const dateSublabel = useMemo(() => {
    if (!tripNights) return null;
    return `${tripNights} ${t('capsule.nights')} • ${result?.outfits.length || tripDays} ${t('capsule.outfits_count')}`;
  }, [tripNights, tripDays, result, t]);

  const isFormValid = destination.length >= 2 && dateRange?.from && dateRange?.to && selectedOccasions.length > 0;

  // ── Load packing progress from localStorage ──
  useEffect(() => {
    if (!result) return;
    const saved = localStorage.getItem(`capsule-checked-${destination}`);
    if (saved) setCheckedItems(new Set(JSON.parse(saved)));
  }, [result, destination]);

  // ── Persist packing progress ──
  const toggleChecked = (id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(`capsule-checked-${destination}`, JSON.stringify([...next]));
      hapticLight();
      return next;
    });
  };

  // ── Group capsule items by category ──
  const groupedItems = useMemo(() => {
    if (!result) return {};
    const groups: Record<string, Array<{ id: string; title: string; image_path: string; category: string }>> = {};
    for (const id of result.capsule_items) {
      const g = garmentMap.get(id);
      if (!g) continue;
      const cat = g.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(g);
    }
    return groups;
  }, [result, garmentMap]);

  // ── Count which outfits use each item ──
  const itemOutfitCount = useMemo(() => {
    if (!result) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const outfit of result.outfits) {
      for (const itemId of outfit.items) {
        counts.set(itemId, (counts.get(itemId) || 0) + 1);
      }
    }
    return counts;
  }, [result]);

  // ── Get forecast for each trip day ──
  const tripDayForecasts = useMemo(() => {
    if (!dateRange?.from || forecastDays.length === 0) return [];
    const results: Array<ForecastDay | null> = [];
    for (let i = 0; i <= tripNights; i++) {
      const date = format(addDays(dateRange.from, i), 'yyyy-MM-dd');
      results.push(forecastDays.find(f => f.date === date) || null);
    }
    return results;
  }, [dateRange, forecastDays, tripNights]);

  // ── Toggles ──
  const toggleOccasion = (id: string) => {
    setSelectedOccasions(prev =>
      prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]
    );
  };

  // ── Weather lookup — supports up to 1 year via historical data ──
  const lookupWeather = useCallback(async () => {
    if (!destination || destination.length < 2) return;
    setIsFetchingWeather(true);
    setWeatherError(null);
    try {
      const coords = await getCoordinatesFromCity(destination);
      if (!coords) { setWeatherError(t('qgen.place_not_found')); return; }

      // Fetch live 16-day forecast
      const liveDays = await fetchForecast(coords.lat, coords.lon);
      const lastLiveDate = liveDays[liveDays.length - 1]?.date;

      let allDays = liveDays;

      // If trip dates extend beyond 16-day window, fetch historical weather
      if (dateRange?.from && dateRange?.to) {
        const startStr = format(dateRange.from, 'yyyy-MM-dd');
        const endStr = format(dateRange.to, 'yyyy-MM-dd');

        if (lastLiveDate && endStr > lastLiveDate) {
          const histStart = startStr > lastLiveDate
            ? startStr
            : format(addDays(new Date(lastLiveDate), 1), 'yyyy-MM-dd');
          try {
            const historicalDays = await fetchHistoricalWeather(
              coords.lat, coords.lon, histStart, endStr
            );
            const liveSet = new Set(liveDays.map(d => d.date));
            allDays = [...liveDays, ...historicalDays.filter(h => !liveSet.has(h.date))];
          } catch {
            // Historical fetch failed — proceed with live data only
          }
        }
      }

      setForecastDays(allDays);
      if (allDays.length > 0) {
        // Filter to trip date range if available
        let relevantDays = allDays;
        if (dateRange?.from && dateRange?.to) {
          const startStr = format(dateRange.from, 'yyyy-MM-dd');
          const endStr = format(dateRange.to, 'yyyy-MM-dd');
          relevantDays = allDays.filter(d => d.date >= startStr && d.date <= endStr);
          if (relevantDays.length === 0) relevantDays = allDays;
        }
        const avgMax = Math.round(relevantDays.reduce((s, d) => s + d.temperature_max, 0) / relevantDays.length);
        const avgMin = Math.round(relevantDays.reduce((s, d) => s + d.temperature_min, 0) / relevantDays.length);
        const avgPrecip = relevantDays.reduce((s, d) => s + (d.precipitation_probability || 0), 0) / relevantDays.length;
        const condition = avgPrecip > 50 ? 'rain' : avgPrecip > 25 ? 'partly cloudy' : 'clear';
        const hasHistorical = relevantDays.some(d => d.isHistorical);
        setWeatherForecast({
          date: relevantDays[0].date, temperature_max: avgMax, temperature_min: avgMin,
          temperature_avg: Math.round((avgMax + avgMin) / 2),
          weather_code: 0,
          condition, precipitation_probability: avgPrecip,
          isHistorical: hasHistorical,
        } as ForecastDay);
      }
    } catch {
      setWeatherError(t('qgen.weather_error'));
    } finally {
      setIsFetchingWeather(false);
    }
  }, [destination, dateRange, t]);

  // ── Generate ──
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
      setActiveTab('packing');
      hapticSuccess();
      toast.success(t('capsule.created'));
    } catch (err) {
      toast.error(t('capsule.create_error'));
      console.error('Travel capsule error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Add to plan ──
  const handleAddToCalendar = async () => {
    if (!result || !dateRange?.from) return;
    setIsAddingToCalendar(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user!.id;

      for (const capsuleOutfit of result.outfits) {
        const outfitDate = format(addDays(dateRange.from!, capsuleOutfit.day - 1), 'yyyy-MM-dd');

        // Resolve valid garment IDs for this outfit
        const validItems = capsuleOutfit.items.filter(id => garmentMap.has(id));
        if (validItems.length === 0) continue;

        // 1. Create an outfit record
        const { data: outfitRow, error: outfitErr } = await supabase
          .from('outfits')
          .insert({
            user_id: userId,
            occasion: capsuleOutfit.occasion || 'vardag',
            explanation: capsuleOutfit.note || `${destination} – Day ${capsuleOutfit.day}`,
            saved: true,
            planned_for: outfitDate,
          })
          .select('id')
          .single();

        if (outfitErr || !outfitRow) {
          console.error('Failed to create outfit:', outfitErr);
          continue;
        }

        // 2. Create outfit_items with slot derived from garment category
        const slotMap: Record<string, string> = {
          tops: 'top', bottoms: 'bottom', shoes: 'shoes', outerwear: 'outerwear',
          accessories: 'accessory', dresses: 'dress', activewear: 'top',
        };

        const outfitItems = validItems.map(gId => {
          const g = garmentMap.get(gId);
          const slot = slotMap[g?.category?.toLowerCase() || ''] || 'other';
          return { outfit_id: outfitRow.id, garment_id: gId, slot };
        });

        const { error: itemsErr } = await supabase
          .from('outfit_items')
          .insert(outfitItems);

        if (itemsErr) console.error('Failed to create outfit items:', itemsErr);

        // 3. Create planned_outfit linked to the real outfit
        const { error: planErr } = await supabase
          .from('planned_outfits')
          .upsert({
            user_id: userId,
            date: outfitDate,
            outfit_id: outfitRow.id,
            note: `${destination} – ${capsuleOutfit.occasion}`,
            status: 'planned',
          }, { onConflict: 'user_id,date' });

        if (planErr) console.error('Failed to plan outfit:', planErr);
      }

      hapticSuccess();
      toast.success(t('capsule.added_to_calendar'));
    } catch {
      toast.error(t('capsule.calendar_error'));
    } finally {
      setIsAddingToCalendar(false);
    }
  };

  /* ═══════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════ */

  // ─────────────── INPUT FORM ───────────────
  if (!result) {
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

          <div className="space-y-6">
            {/* Step 1: Where */}
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
              {isFetchingWeather && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />{t('qgen.fetching_weather')}
                </p>
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

            {/* Step 2: When */}
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

            {/* Step 3: Activities */}
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

            {/* Step 4: Preferences */}
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

            {/* Generate */}
            <Button onClick={handleGenerate} disabled={isGenerating || !isFormValid} className="w-full h-12 rounded-xl" size="lg">
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('capsule.generating')}</>
              ) : (
                <><Package className="w-4 h-4 mr-2" />{t('capsule.generate_new')}</>
              )}
            </Button>
          </div>
        </AnimatedPage>
      </AppLayout>
    );
  }

  // ─────────────── RESULTS SCREEN ───────────────
  const packedCount = Object.values(groupedItems).flat().filter(g => checkedItems.has(g.id)).length;
  const totalItems = result.capsule_items.length;

  return (
    <AppLayout hideNav>
      <div className="flex flex-col h-[100dvh] max-w-lg mx-auto">
        {/* ── Sticky Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_CURVE }}
          className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/10 px-5 pt-12 pb-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-muted/30 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold">{destination} {t('capsule.trip_suffix')}</h1>
                <p className="text-[11px] text-muted-foreground">
                  {dateLabel} • {dateSublabel}
                </p>
              </div>
            </div>
            <button
              onClick={() => setResult(null)}
              className="p-2 rounded-xl hover:bg-muted/30 transition-colors"
            >
              <Pencil className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </motion.div>

        {/* ── Weather Strip ── */}
        {tripDayForecasts.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="px-5 py-2.5 border-b border-border/5"
          >
            <div className="flex gap-1 overflow-x-auto scrollbar-none -mx-1 px-1">
              {tripDayForecasts.map((forecast, i) => {
                const dayDate = dateRange?.from ? addDays(dateRange.from, i) : null;
                return (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-0.5 min-w-[48px] shrink-0 py-1"
                  >
                    <span className="text-[9px] text-muted-foreground/60 uppercase font-medium">
                      {dayDate ? format(dayDate, 'EEE', { locale: dateLocale }) : '—'}
                    </span>
                    <WeatherMiniIcon condition={forecast?.condition} className="w-3 h-3" />
                    <span className="text-[10px] font-medium text-foreground">
                      {forecast ? `${forecast.temperature_max}°` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Tab Toggle ── */}
        <div className="px-5 pt-3 pb-1">
          <div className="flex gap-1 p-0.5 rounded-xl bg-muted/20">
            {(['packing', 'outfits'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { hapticLight(); setActiveTab(tab); }}
                className={cn(
                  'flex-1 py-2 rounded-lg text-xs font-medium transition-all',
                  activeTab === tab
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground/60 hover:text-muted-foreground'
                )}
              >
                {tab === 'packing' ? t('capsule.tab_packing') : t('capsule.tab_outfits')}
              </button>
            ))}
          </div>
        </div>

        {/* ── Scrollable Content ── */}
        <div className="flex-1 overflow-y-auto px-5 pb-28">
          <AnimatePresence mode="wait">
            {activeTab === 'packing' ? (
              <motion.div
                key="packing"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.25, ease: EASE_CURVE }}
                className="space-y-5 pt-3"
              >
                {/* Packing progress */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${totalItems > 0 ? (packedCount / totalItems) * 100 : 0}%` }}
                      transition={{ duration: 0.4, ease: EASE_CURVE }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground/60 tabular-nums shrink-0">
                    {packedCount}/{totalItems}
                  </span>
                </div>

                {/* Category groups */}
                {Object.entries(groupedItems).map(([category, items], catIdx) => {
                  const catOutfitUses = (items || []).reduce(
                    (sum, g) => sum + (itemOutfitCount.get(g.id) || 0), 0
                  );
                  return (
                    <motion.div
                      key={category}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: catIdx * STAGGER_DELAY, duration: 0.35 }}
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground capitalize">
                          {category} ({(items || []).length})
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">
                          → {t('capsule.used_in')} {catOutfitUses} {t('capsule.outfits_label')}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {(items || []).map(g => (
                          <button
                            key={g.id}
                            onClick={() => toggleChecked(g.id)}
                            className={cn(
                              'w-full flex items-center gap-3 p-2.5 rounded-xl transition-all',
                              checkedItems.has(g.id)
                                ? 'bg-accent/[0.06]'
                                : 'bg-card/40 hover:bg-card/60'
                            )}
                          >
                            {/* Checkbox */}
                            <div className={cn(
                              'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all',
                              checkedItems.has(g.id)
                                ? 'bg-accent border-accent'
                                : 'border-border/30'
                            )}>
                              {checkedItems.has(g.id) && (
                                <Check className="w-3 h-3 text-accent-foreground" />
                              )}
                            </div>

                            {/* Thumbnail */}
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted/30 shrink-0">
                              <LazyImageSimple imagePath={g.image_path} alt={g.title} className="w-full h-full" />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0 text-left">
                              <span className={cn(
                                'text-[13px] font-medium block truncate',
                                checkedItems.has(g.id)
                                  ? 'text-muted-foreground line-through'
                                  : 'text-foreground'
                              )}>
                                {g.title}
                              </span>
                              <span className="text-[10px] text-muted-foreground/50">
                                {t('capsule.used_in')} {itemOutfitCount.get(g.id) || 0} {t('capsule.outfits_label')}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}

                {/* Stats bar */}
                <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-muted/10">
                  <Shirt className="w-3.5 h-3.5 text-muted-foreground/40" />
                  <span className="text-xs text-muted-foreground/60">
                    {totalItems} {t('capsule.items')} • {t('capsule.creates')} {result.outfits.length} {t('capsule.unique_outfits')}
                  </span>
                </div>

                {/* Tips */}
                {result.packing_tips.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase flex items-center gap-1.5">
                      <LightbulbIcon className="w-3 h-3" />
                      {t('capsule.tips')}
                    </h3>
                    <ul className="space-y-1.5">
                      {result.packing_tips.map((tip, idx) => (
                        <li key={idx} className="text-xs text-muted-foreground/70 flex gap-2">
                          <span className="text-primary shrink-0">•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="outfits"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.25, ease: EASE_CURVE }}
                className="space-y-3 pt-3"
              >
                {result.outfits.map((outfit, idx) => {
                  const dayDate = dateRange?.from ? addDays(dateRange.from, outfit.day - 1) : null;
                  const forecast = tripDayForecasts[outfit.day - 1] || null;

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * STAGGER_DELAY, duration: 0.35 }}
                      className="rounded-xl border border-border/10 bg-card/40 overflow-hidden"
                    >
                      {/* Day header */}
                      <div className="px-4 pt-3.5 pb-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground uppercase">
                              {dayDate ? format(dayDate, 'EEE MMM d', { locale: dateLocale }) : `${t('capsule.day_label')} ${outfit.day}`}
                            </span>
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              {outfit.occasion}
                            </Badge>
                          </div>
                          {forecast && (
                            <div className="flex items-center gap-1">
                              <WeatherMiniIcon condition={forecast.condition} className="w-3 h-3" />
                              <span className="text-[11px] text-muted-foreground">{forecast.temperature_max}°C</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Outfit thumbnails */}
                      <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-none">
                        {outfit.items.map(itemId => {
                          const g = garmentMap.get(itemId);
                          if (!g) return null;
                          return (
                            <div key={itemId} className="w-[72px] shrink-0">
                              <div className="aspect-square rounded-lg overflow-hidden bg-muted/30">
                                <LazyImageSimple imagePath={g.image_path} alt={g.title} className="w-full h-full" />
                              </div>
                              <p className="text-[9px] text-muted-foreground/60 truncate text-center mt-1">{g.title}</p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Note / activity */}
                      {outfit.note && (
                        <div className="px-4 pb-3">
                          <p className="text-[11px] text-muted-foreground/60">{outfit.note}</p>
                        </div>
                      )}

                      {/* Swap */}
                      <div className="px-4 pb-3">
                        <button
                          onClick={() => { hapticLight(); toast(t('capsule.swap_coming_soon')); }}
                          className="text-[11px] font-medium text-accent flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          {t('capsule.swap_outfit')}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Sticky Bottom Bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="sticky bottom-0 z-20 bg-background/90 backdrop-blur-xl border-t border-border/10 px-5 py-3 flex gap-2"
        >
          <Button
            onClick={handleAddToCalendar}
            disabled={isAddingToCalendar}
            className="flex-1 h-11 rounded-xl"
          >
            {isAddingToCalendar ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CalendarPlus className="w-4 h-4 mr-2" />
            )}
            {t('capsule.add_to_plan')}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-xl shrink-0"
            onClick={() => { hapticLight(); toast(t('capsule.share_coming_soon')); }}
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>
    </AppLayout>
  );
}
