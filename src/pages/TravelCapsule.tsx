import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { OutfitSuggestionCard } from '@/components/chat/OutfitSuggestionCard';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, differenceInCalendarDays, addDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import {
  ArrowLeft, Globe, CalendarIcon, Shirt,
  LightbulbIcon, Sun, CloudRain, Cloud,
  CalendarPlus, Package, SlidersHorizontal, Pencil,
  Check, Share2, Snowflake, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { useWardrobeUnlocks } from '@/hooks/useWardrobeUnlocks';
import { WardrobeProgress } from '@/components/discover/WardrobeProgress';
import { asPreferences } from '@/types/preferences';
import { AppLayout } from '@/components/layout/AppLayout';
import { StyleMeSubNav } from '@/components/ai/StyleMeSubNav';
import { AnimatedPage } from '@/components/ui/animated-page';
import { Button } from '@/components/ui/button';
import { LocationAutocomplete } from '@/components/ui/LocationAutocomplete';
import { Label } from '@/components/ui/label';
import { Chip } from '@/components/ui/chip';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFlatGarments } from '@/hooks/useGarments';
import { useProfile } from '@/hooks/useProfile';
import { useGarmentsByIds } from '@/hooks/useGarmentsByIds';
import { getCoordinatesFromCity, fetchForecast, fetchHistoricalWeather, type ForecastDay } from '@/hooks/useForecast';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getDateFnsLocale } from '@/lib/dateLocale';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { EASE_CURVE, STAGGER_DELAY } from '@/lib/motion';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import type { DateRange } from 'react-day-picker';
import { AILoadingCard } from '@/components/ui/AILoadingCard';

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
  { id: 'casual', labelKey: 'home.occasion.casual' },
  { id: 'work', labelKey: 'home.occasion.work' },
  { id: 'party', labelKey: 'home.occasion.party' },
  { id: 'date', labelKey: 'home.occasion.date' },
  { id: 'workout', labelKey: 'home.occasion.workout' },
  { id: 'beach', labelKey: 'capsule.occasion_beach' },
  { id: 'hiking', labelKey: 'capsule.occasion_hiking' },
  { id: 'formal', labelKey: 'capsule.occasion_formal' },
];

const TRIP_TYPES = ['business', 'casual', 'beach', 'winter', 'mixed'] as const;

const OCCASION_OPTIONS = ['Casual', 'Work', 'Dinner', 'Active', 'Beach', 'Formal'];

const LOADING_STEPS = (dest: string) => [
  `Packing for ${dest || 'your trip'}...`,
  'Scanning your wardrobe...',
  'Selecting capsule pieces...',
  'Building your outfits...',
  'Finalising packing list...',
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
  const { data: allGarments } = useFlatGarments();
  const dateLocale = getDateFnsLocale(locale);

  // ── Form state ──
  const [destination, setDestination] = useState('');
  const [destCoords, setDestCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [hasManualOccasions, setHasManualOccasions] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>(['vardag']);
  const [minimizeItems, setMinimizeItems] = useState(true);
  const [includeTravelDays, setIncludeTravelDays] = useState(false);
  const [outfitsPerDay, setOutfitsPerDay] = useState(1);
  const [mustHaveItems, setMustHaveItems] = useState<string[]>([]);

  // ── New trip type / duration / occasions state ──
  const [tripType, setTripType] = useState<string>('mixed');
  const [durationDays, setDurationDays] = useState(5);
  const [newOccasions, setNewOccasions] = useState<string[]>([]);

  // ── Past capsules state ──
  const [pastCapsules, setPastCapsules] = useState<any[]>([]);
  const [pastOpen, setPastOpen] = useState(false);

  // ── Loading step state ──
  const [loadingStep, setLoadingStep] = useState(0);

  // Restore form state from picker page (round-trip)
  const location = useLocation();
  const locationState = location.state as {
    mustHaveItems?: string[];
    destination?: string;
    destCoords?: { lat: number; lon: number } | null;
    dateRange?: { from: string; to: string } | null;
    selectedOccasions?: string[];
    minimizeItems?: boolean;
    includeTravelDays?: boolean;
    outfitsPerDay?: number;
    hasManualOccasions?: boolean;
  } | null;

  const [addedToCalendar, setAddedToCalendar] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!locationState || restoredRef.current) return;
    restoredRef.current = true;
    setShowForm(true);
    if (locationState.mustHaveItems) setMustHaveItems(locationState.mustHaveItems);
    if (locationState.destination) setDestination(locationState.destination);
    if (locationState.destCoords) setDestCoords(locationState.destCoords);
    if (locationState.dateRange?.from && locationState.dateRange?.to) {
      setDateRange({
        from: new Date(locationState.dateRange.from),
        to: new Date(locationState.dateRange.to),
      });
    }
    if (locationState.selectedOccasions) setSelectedOccasions(locationState.selectedOccasions);
    if (locationState.minimizeItems !== undefined) setMinimizeItems(locationState.minimizeItems);
    if (locationState.includeTravelDays !== undefined) setIncludeTravelDays(locationState.includeTravelDays);
    if (locationState.outfitsPerDay !== undefined) setOutfitsPerDay(locationState.outfitsPerDay);
    if (locationState.hasManualOccasions !== undefined) setHasManualOccasions(locationState.hasManualOccasions);
    // Re-trigger weather if coords were restored
    if (locationState.destCoords && locationState.dateRange?.from && locationState.dateRange?.to) {
      setTimeout(() => lookupWeatherWithCoords(locationState.destCoords!), 100);
    }
  }, []);

  // ── Generation state ──
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<CapsuleResult | null>(null);
  useState<string | null>(null); // loadingPhase - kept for future use

  // ── Derived values (moved before travelCardPhases) ──
  const tripNights = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 0;
    return differenceInCalendarDays(dateRange.to, dateRange.from);
  }, [dateRange]);

  // Context-aware travel loading phases (~60s total, last phase holds)
  const travelCardPhases = useMemo(() => [
    { icon: Shirt, label: `Scanning your ${allGarments?.length ? `${allGarments.length} ` : ''}garments`, duration: 15000 },
    { icon: Globe, label: `Finding combinations for ${destination || 'your destination'}`, duration: 15000 },
    { icon: Package, label: 'Building your capsule', duration: 15000 },
    { icon: SlidersHorizontal, label: `Optimizing for ${tripNights || 0} nights`, duration: 0 },
  ], [allGarments?.length, destination, tripNights]);

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

  // Fallback map so thumbnails render immediately from the pre-loaded wardrobe
  // before capsuleGarments finishes its async fetch
  const allGarmentsMap = useMemo(
    () => new Map((allGarments || []).map(g => [g.id, g])),
    [allGarments]
  );

  // ── Derived values (tripNights moved above travelCardPhases) ──

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

  // ── New occasions toggle (max 3) ──
  const toggleNewOccasion = (o: string) => {
    setNewOccasions(prev =>
      prev.includes(o) ? prev.filter(x => x !== o) : prev.length < 3 ? [...prev, o] : prev
    );
  };

  // ── Load a past capsule ──
  const loadCapsule = (capsule: any) => {
    setResult(capsule.result ?? null);
    if (capsule.destination) setDestination(capsule.destination);
    if (capsule.trip_type) setTripType(capsule.trip_type);
    if (capsule.duration_days) setDurationDays(capsule.duration_days);
  };

  // ── Fetch past capsules on mount ──
  useEffect(() => {
    const fetchPast = async () => {
      try {
        const { data, error } = await invokeEdgeFunction<{ capsules: any[] }>('travel_capsule', {
          body: { method: 'GET' },
        });
        if (!error && data?.capsules) setPastCapsules(data.capsules);
      } catch {}
    };
    fetchPast();
  }, []);

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
    setHasManualOccasions(true);
    setSelectedOccasions(prev =>
      prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]
    );
  };

  // ── Weather lookup — supports up to 1 year via historical data ──
  const lookupWeatherWithCoords = useCallback(async (coords: { lat: number; lon: number }) => {
    setIsFetchingWeather(true);
    setWeatherError(null);
    try {
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
        const forecast: ForecastDay = {
          date: relevantDays[0].date, temperature_max: avgMax, temperature_min: avgMin,
          temperature_avg: Math.round((avgMax + avgMin) / 2),
          weather_code: 0,
          condition, precipitation_probability: avgPrecip,
          isHistorical: hasHistorical,
        };
        setWeatherForecast(forecast);

        // Smart occasion auto-select (only on first weather load)
        if (!hasManualOccasions) {
          const auto: string[] = ['casual'];
          if (avgMax > 28) auto.push('beach');
          if (avgPrecip > 60) { /* keep casual, skip outdoor */ }
          else if (avgMax > 20 && avgMax <= 28) auto.push('hiking');
          setSelectedOccasions(prev => {
            const merged = new Set([...auto, ...prev]);
            return [...merged];
          });
        }
      }
    } catch {
      setWeatherError(t('qgen.weather_error'));
    } finally {
      setIsFetchingWeather(false);
    }
  }, [dateRange, t, hasManualOccasions]);

  const lookupWeather = useCallback(async () => {
    if (destCoords) {
      return lookupWeatherWithCoords(destCoords);
    }
    if (!destination || destination.length < 2) return;
    const coords = await getCoordinatesFromCity(destination);
    if (!coords) { setWeatherError(t('qgen.place_not_found')); return; }
    setDestCoords(coords);
    return lookupWeatherWithCoords(coords);
  }, [destination, destCoords, lookupWeatherWithCoords, t]);

  // Auto-fetch weather when dates change and destination is set
  useEffect(() => {
    if (destCoords && dateRange?.from && dateRange?.to) {
      lookupWeatherWithCoords(destCoords);
    }
  }, [dateRange?.from?.getTime(), dateRange?.to?.getTime()]);

  // ── Loading step cycle ──
  useEffect(() => {
    if (!isGenerating) { setLoadingStep(0); return; }
    const interval = setInterval(() => {
      setLoadingStep(s => Math.min(s + 1, LOADING_STEPS(destination).length - 1));
    }, 1500);
    return () => clearInterval(interval);
  }, [isGenerating, destination]);

  // Handle location autocomplete selection
  const handleLocationSelect = useCallback((_city: string, coords: { lat: number; lon: number }) => {
    setDestCoords(coords);
    lookupWeatherWithCoords(coords);
  }, [lookupWeatherWithCoords]);

  // ── Generate ──
  const handleGenerate = async () => {
    if (!destination) { toast.error(t('capsule.enter_destination')); return; }
    if (!dateRange?.from || !dateRange?.to) { toast.error(t('capsule.select_dates')); return; }
    if (!weatherForecast) await lookupWeather();
    setIsGenerating(true);
    try {
      const userLocale = (asPreferences(profile?.preferences)?.language as string) || locale;
      const { data, error } = await invokeEdgeFunction<CapsuleResult & { error?: string }>('travel_capsule', {
        timeout: 45000,
        body: {
          duration_days: durationDays || tripDays || tripNights,
          destination,
          trip_type: tripType,
          occasions: newOccasions.length > 0 ? newOccasions : selectedOccasions,
          start_date: dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
          end_date: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined,
          weather: weatherForecast ? {
            temperature_min: weatherForecast.temperature_min,
            temperature_max: weatherForecast.temperature_max,
            condition: weatherForecast.condition,
          } : null,
          outfits_per_day: outfitsPerDay,
          must_have_items: mustHaveItems.length > 0 ? mustHaveItems : undefined,
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
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('User session expired. Please log in again.');
      const userId = currentUser.id;

      // Fetch garments directly to avoid stale/empty garmentMap from async hook
      const { data: freshGarments } = await supabase
        .from('garments')
        .select('id, category')
        .in('id', result.capsule_items)
        .eq('user_id', userId);

      const freshMap = new Map((freshGarments || []).map(g => [g.id, g]));

      // Deduplicate outfits by day + sorted item fingerprint
      const createdOutfitKeys = new Set<string>();

      for (const capsuleOutfit of result.outfits) {
        const sortedItems = [...capsuleOutfit.items].sort();
        const dedupeKey = `${capsuleOutfit.day}-${sortedItems.join(',')}`;
        if (createdOutfitKeys.has(dedupeKey)) continue;
        createdOutfitKeys.add(dedupeKey);

        const outfitDate = format(addDays(dateRange.from!, capsuleOutfit.day - 1), 'yyyy-MM-dd');

        // Resolve valid garment IDs for this outfit
        const validItems = capsuleOutfit.items.filter(id => freshMap.has(id));
        if (validItems.length === 0) continue;

        // 1. Create an outfit record
        const { data: outfitRow, error: outfitErr } = await supabase
          .from('outfits')
          .insert({
            user_id: userId,
            occasion: capsuleOutfit.occasion || 'travel',
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
          top: 'top', bottom: 'bottom', shoes: 'shoes', outerwear: 'outerwear',
          accessory: 'accessory', accessories: 'accessory', dress: 'dress',
          activewear: 'top', bag: 'accessory', jewelry: 'accessory',
        };

        const outfitItems = validItems.map(gId => {
          const g = freshMap.get(gId);
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
          .insert({
            user_id: userId,
            date: outfitDate,
            outfit_id: outfitRow.id,
            note: `${destination} – ${capsuleOutfit.occasion}`,
            status: 'planned',
          });

        if (planErr) console.error('Failed to plan outfit:', planErr);
      }

      hapticSuccess();
      toast.success(t('capsule.added_to_calendar'));
      setAddedToCalendar(true);
    } catch {
      toast.error(t('capsule.calendar_error'));
    } finally {
      setIsAddingToCalendar(false);
    }
  };

  const { isUnlocked } = useWardrobeUnlocks();

  // Gate: require enough garments
  if (!isUnlocked('travel_capsule')) {
    return (
      <AppLayout hideNav>
        <AnimatedPage className="px-5 pb-8 pt-12 max-w-lg mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-muted/30 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold">{t('capsule.title')}</h1>
            </div>
          </div>
          <WardrobeProgress message={t('unlock.travel_capsule_message')} />
        </AnimatedPage>
      </AppLayout>
    );
  }

  // ─────────────── INPUT FORM ───────────────
  if (!result) {
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

          {/* Editorial empty state */}
          {!showForm && (
            <div
              style={{
                backgroundColor: '#F5F0E8',
                padding: '40px 0 32px',
                textAlign: 'center',
              }}
            >
              <h2 style={{
                fontFamily: '"Playfair Display", serif',
                fontStyle: 'italic',
                fontSize: 26,
                color: '#1C1917',
                marginBottom: 12,
                lineHeight: 1.3,
              }}>
                Pack less. Dress better.
              </h2>
              <p style={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 14,
                color: 'rgba(28,25,23,0.5)',
                lineHeight: 1.6,
                maxWidth: 300,
                margin: '0 auto 24px',
              }}>
                Tell us your destination and days — we'll build a capsule from your wardrobe.
              </p>
              <button
                onClick={() => setShowForm(true)}
                style={{
                  backgroundColor: '#1C1917',
                  color: 'white',
                  border: 'none',
                  borderRadius: 0,
                  padding: '14px 32px',
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Build a capsule
              </button>
            </div>
          )}

          {showForm && <div className="space-y-6">
            {/* Step 1: Where */}
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
                {OCCASIONS.map(o => {
                  const isSelected = selectedOccasions.includes(o.id);
                  return (
                    <Chip
                      key={o.id}
                      selected={isSelected}
                      onClick={() => { hapticLight(); toggleOccasion(o.id); }}
                      size="lg"
                      className={cn(
                        'rounded-xl',
                        isSelected
                          ? 'bg-foreground text-background border-transparent'
                          : 'bg-card border-border/20 text-foreground'
                      )}
                    >
                      {t(o.labelKey)}
                    </Chip>
                  );
                })}
              </div>
            </div>

            {/* Step 3b: Outfits per day */}
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

            {/* Step 3c: Must-haves */}
            {(allGarments?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <Label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
                  {t('capsule.must_haves')}
                </Label>
                <p className="text-[11px] text-muted-foreground/50">{t('capsule.must_haves_desc')}</p>

                {/* Selected thumbnails preview */}
                {mustHaveItems.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {mustHaveItems.slice(0, 6).map(id => {
                      const g = allGarments?.find(g => g.id === id);
                      if (!g) return null;
                      return (
                        <div key={id} className="relative flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-primary/30 bg-muted/20">
                          <LazyImageSimple imagePath={getPreferredGarmentImagePath(g)} alt={g.title} className="w-full h-full object-cover" />
                          <button
                            onClick={() => { hapticLight(); setMustHaveItems(prev => prev.filter(i => i !== id)); }}
                            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive flex items-center justify-center"
                          >
                            <span className="text-[8px] text-destructive-foreground font-bold">✕</span>
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
                        dateRange: dateRange?.from && dateRange?.to
                          ? { from: dateRange.from.toISOString(), to: dateRange.to.toISOString() }
                          : null,
                        selectedOccasions,
                        minimizeItems,
                        includeTravelDays,
                        outfitsPerDay,
                        hasManualOccasions,
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

            {/* Trip Summary */}
            {destination && dateRange?.from && dateRange?.to && weatherForecast && !isGenerating && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-card/60 border border-border/10 text-sm">
                <WeatherMiniIcon condition={weatherForecast.condition} />
                <span className="font-medium truncate">{destination}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{dateLabel}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{tripNights} {t('capsule.nights')}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{weatherForecast.temperature_min}–{weatherForecast.temperature_max}°C</span>
              </div>
            )}

            {/* Trip Type */}
            <div className="space-y-2">
              <Label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
                Trip Type
              </Label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                {TRIP_TYPES.map(t_ => (
                  <button
                    key={t_}
                    onClick={() => setTripType(t_)}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 20,
                      border: '1px solid rgba(28,25,23,0.20)',
                      background: tripType === t_ ? '#1C1917' : '#F5F0E8',
                      color: tripType === t_ ? '#F5F0E8' : '#1C1917',
                      fontFamily: 'DM Sans, sans-serif',
                      fontSize: 13,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {t_}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Stepper */}
            <div className="space-y-2">
              <Label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
                Duration
              </Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <button onClick={() => setDurationDays(d => Math.max(1, d - 1))} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(28,25,23,0.20)', background: 'transparent', cursor: 'pointer', fontSize: 18 }}>−</button>
                <span style={{ fontFamily: 'DM Sans', fontSize: 15, minWidth: 60, textAlign: 'center' }}>{durationDays} days</span>
                <button onClick={() => setDurationDays(d => Math.min(21, d + 1))} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(28,25,23,0.20)', background: 'transparent', cursor: 'pointer', fontSize: 18 }}>+</button>
              </div>
            </div>

            {/* Occasions Multi-select (max 3) */}
            <div className="space-y-2">
              <Label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
                Occasions <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(up to 3)</span>
              </Label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                {OCCASION_OPTIONS.map(o => (
                  <button
                    key={o}
                    onClick={() => toggleNewOccasion(o)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 20,
                      border: '1px solid rgba(28,25,23,0.20)',
                      background: newOccasions.includes(o) ? '#1C1917' : 'transparent',
                      color: newOccasions.includes(o) ? '#F5F0E8' : '#1C1917',
                      fontFamily: 'DM Sans, sans-serif',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate */}
            <div className="space-y-1">
              {isGenerating ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, ease: EASE_CURVE }}
                  className="space-y-3"
                >
                  <p style={{ fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 16, color: '#1C1917', textAlign: 'center', margin: '12px 0' }}>
                    {LOADING_STEPS(destination)[loadingStep]}
                  </p>
                </motion.div>
              ) : (
                <Button onClick={handleGenerate} disabled={!destination || destination.length < 2} className="w-full h-12 rounded-xl" size="lg">
                  <Package className="w-4 h-4 mr-2" />{t('capsule.generate_new')}
                </Button>
              )}
            </div>

            {/* Past Trips */}
            {pastCapsules.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <button onClick={() => setPastOpen(p => !p)} style={{ fontFamily: 'DM Sans', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: '#1C1917' }}>
                  Past Trips ({pastCapsules.length}) {pastOpen ? '▲' : '▼'}
                </button>
                {pastOpen && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pastCapsules.map((c: any) => (
                      <div key={c.id} style={{ background: '#EDE8DF', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ fontFamily: 'DM Sans', fontSize: 14, fontWeight: 500, margin: 0 }}>{c.destination}</p>
                          <p style={{ fontFamily: 'DM Sans', fontSize: 11, color: 'rgba(28,25,23,0.50)', margin: 0 }}>{c.trip_type} · {c.duration_days} days · {new Date(c.created_at).toLocaleDateString()}</p>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => loadCapsule(c)} style={{ fontFamily: 'DM Sans', fontSize: 12, background: '#1C1917', color: '#F5F0E8', border: 'none', padding: '6px 12px', cursor: 'pointer' }}>Load</button>
                          <button onClick={() => setPastCapsules(prev => prev.filter(x => x.id !== c.id))} style={{ fontFamily: 'DM Sans', fontSize: 12, background: 'transparent', border: '1px solid rgba(28,25,23,0.20)', padding: '6px 12px', cursor: 'pointer' }}>×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>}
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
                              <LazyImageSimple imagePath={getPreferredGarmentImagePath(g)} alt={g.title} className="w-full h-full" />
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

                {/* Progress indicator */}
                <p style={{ fontFamily: 'DM Sans', fontSize: 12, color: 'rgba(28,25,23,0.50)', marginBottom: 12 }}>
                  {checkedItems.size} of {totalItems} items packed
                </p>

                {/* Copy packing list */}
                <button
                  onClick={() => {
                    const garmentTitles = result.capsule_items
                      .map(id => garmentMap.get(id) ?? allGarmentsMap.get(id))
                      .filter(Boolean)
                      .map((g: any) => `- ${g.title}`)
                      .join('\n');
                    navigator.clipboard.writeText(garmentTitles);
                    toast.success('Packing list copied');
                  }}
                  style={{ fontFamily: 'DM Sans', fontSize: 13, background: '#EDE8DF', border: 'none', padding: '8px 16px', cursor: 'pointer', borderRadius: 4 }}
                >
                  Copy packing list
                </button>

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
                  const outfitGarments = outfit.items
                    .map((id: string) => garmentMap.get(id) ?? allGarmentsMap.get(id))
                    .filter(Boolean) as any[];

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * STAGGER_DELAY, duration: 0.35 }}
                    >
                      <p style={{ fontFamily: 'DM Sans', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(28,25,23,0.45)', marginBottom: 8 }}>
                        Day {Math.floor(idx / 2) + 1}
                      </p>
                      <OutfitSuggestionCard
                        garments={outfitGarments}
                        explanation={outfit.note ?? outfit.explanation ?? ''}
                        onTryOutfit={() => {}}
                        isCreating={false}
                      />
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
          {isAddingToCalendar ? (
            <div className="flex-1">
              <AILoadingCard
                phases={[
                  { icon: CalendarPlus, label: t('capsule.saving_outfits') || 'Saving outfits...', duration: 1500 },
                  { icon: CalendarIcon, label: t('capsule.planning_days') || 'Planning days...', duration: 1500 },
                  { icon: Check, label: t('capsule.syncing') || 'Syncing calendar...', duration: 0 },
                ]}
              />
            </div>
          ) : addedToCalendar ? (
            <Button
              onClick={() => {
                hapticLight();
                navigate('/plan', {
                  state: { selectedDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined },
                });
              }}
              className="flex-1 h-11 rounded-xl"
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              {t('capsule.view_in_planner') || 'View in Planner'}
            </Button>
          ) : (
            <Button
              onClick={handleAddToCalendar}
              className="flex-1 h-11 rounded-xl"
            >
              <CalendarPlus className="w-4 h-4 mr-2" />
              {t('capsule.add_to_plan')}
            </Button>
          )}
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
