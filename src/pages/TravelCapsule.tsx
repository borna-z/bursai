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
  Check, Share2, Snowflake, X,
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

interface CapsuleItemObj {
  id: string;
  title: string;
  category: string;
  color_primary?: string;
  image_path?: string;
}

interface CapsuleResult {
  capsule_items: (string | CapsuleItemObj)[];
  outfits: CapsuleOutfit[];
  packing_tips: string[];
  total_combinations: number;
  reasoning: string;
}

interface SavedCapsule {
  id: string;
  destination: string;
  vibe: string;
  dateLabel: string;
  itemCount: number;
  outfitCount: number;
  result: CapsuleResult;
  created_at: string;
}

/* ─── Trip Vibe config ─── */
const VIBES = [
  { id: 'business', label: 'Business' },
  { id: 'weekend', label: 'Weekend' },
  { id: 'beach', label: 'Beach' },
  { id: 'winter', label: 'Winter' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'mixed', label: 'Mixed' },
] as const;

type VibeId = typeof VIBES[number]['id'];

const VIBE_TO_TRIP_TYPE: Record<VibeId, string> = {
  business: 'business',
  weekend: 'casual',
  beach: 'beach',
  winter: 'winter',
  adventure: 'casual',
  mixed: 'mixed',
};

const VIBE_TO_OCCASIONS: Record<VibeId, string[]> = {
  business: ['work', 'dinner'],
  weekend: ['casual', 'dinner'],
  beach: ['casual', 'active', 'beach'],
  winter: ['casual', 'work'],
  adventure: ['casual', 'active'],
  mixed: ['casual', 'work', 'dinner'],
};

const LOADING_STEPS = (dest: string) => [
  `Packing for ${dest || 'your trip'}...`,
  'Scanning your wardrobe...',
  'Selecting capsule pieces...',
  'Building your outfits...',
  'Finalising packing list...',
];

const STORAGE_KEY = 'burs_travel_capsules';

function loadSavedCapsules(): SavedCapsule[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCapsules(capsules: SavedCapsule[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(capsules));
}

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
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [vibe, setVibe] = useState<VibeId>('mixed');
  const [durationDays, setDurationDays] = useState(5);
  const [outfitsPerDay, setOutfitsPerDay] = useState(1);
  const [mustHaveItems, setMustHaveItems] = useState<string[]>([]);
  const [minimizeItems, setMinimizeItems] = useState(true);
  const [includeTravelDays, setIncludeTravelDays] = useState(false);

  // ── Past capsules (sessionStorage) ──
  const [savedCapsules, setSavedCapsules] = useState<SavedCapsule[]>(() => loadSavedCapsules());

  // ── Loading step state ──
  const [loadingStep, setLoadingStep] = useState(0);

  // Restore form state from picker page (round-trip)
  const location = useLocation();
  const locationState = location.state as {
    mustHaveItems?: string[];
    destination?: string;
    destCoords?: { lat: number; lon: number } | null;
    dateRange?: { from: string; to: string } | null;
    minimizeItems?: boolean;
    includeTravelDays?: boolean;
    outfitsPerDay?: number;
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
    if (locationState.minimizeItems !== undefined) setMinimizeItems(locationState.minimizeItems);
    if (locationState.includeTravelDays !== undefined) setIncludeTravelDays(locationState.includeTravelDays);
    if (locationState.outfitsPerDay !== undefined) setOutfitsPerDay(locationState.outfitsPerDay);
    if (locationState.destCoords && locationState.dateRange?.from && locationState.dateRange?.to) {
      setTimeout(() => lookupWeatherWithCoords(locationState.destCoords!), 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Generation state ──
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<CapsuleResult | null>(null);

  // ── Derived values ──
  const tripNights = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 0;
    return differenceInCalendarDays(dateRange.to, dateRange.from);
  }, [dateRange]);

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
  // Backend may return capsule_items as objects { id, title, ... } or string IDs
  const capsuleItemIds = useMemo(
    () => (result?.capsule_items || []).map(item =>
      typeof item === 'string' ? item : item.id
    ),
    [result]
  );
  const inlineGarmentMap = useMemo(() => {
    const m = new Map<string, { id: string; title: string; image_path: string; category: string; color_primary?: string }>();
    for (const item of (result?.capsule_items || [])) {
      if (typeof item !== 'string' && item.id) {
        m.set(item.id, { id: item.id, title: item.title, image_path: item.image_path || '', category: item.category, color_primary: item.color_primary });
      }
    }
    return m;
  }, [result]);

  const { data: capsuleGarments } = useGarmentsByIds(capsuleItemIds);
  const garmentMap = useMemo(
    () => {
      const m = new Map((capsuleGarments || []).map(g => [g.id, g]));
      // Merge inline objects for any items not fetched from DB
      for (const [id, g] of inlineGarmentMap) {
        if (!m.has(id)) m.set(id, g as never);
      }
      return m;
    },
    [capsuleGarments, inlineGarmentMap]
  );

  const allGarmentsMap = useMemo(
    () => new Map((allGarments || []).map(g => [g.id, g])),
    [allGarments]
  );

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

  // ── Remove a saved capsule ──
  const removeSavedCapsule = (capsuleId: string) => {
    setSavedCapsules(prev => {
      const next = prev.filter(c => c.id !== capsuleId);
      saveCapsules(next);
      return next;
    });
  };

  // ── Load a saved capsule ──
  const loadSavedCapsule = (capsule: SavedCapsule) => {
    setResult(capsule.result);
    setDestination(capsule.destination);
    setVibe((capsule.vibe as VibeId) || 'mixed');
  };

  // ── Group capsule items by category ──
  const groupedItems = useMemo(() => {
    if (capsuleItemIds.length === 0) return {};
    const groups: Record<string, Array<{ id: string; title: string; image_path: string; category: string }>> = {};
    for (const id of capsuleItemIds) {
      const g = garmentMap.get(id) ?? allGarmentsMap.get(id);
      if (!g) continue;
      const cat = g.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(g);
    }
    return groups;
  }, [capsuleItemIds, garmentMap, allGarmentsMap]);

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

  // ── Weather lookup ──
  const lookupWeatherWithCoords = useCallback(async (coords: { lat: number; lon: number }) => {
    setIsFetchingWeather(true);
    setWeatherError(null);
    try {
      const liveDays = await fetchForecast(coords.lat, coords.lon);
      const lastLiveDate = liveDays[liveDays.length - 1]?.date;
      let allDays = liveDays;

      if (dateRange?.from && dateRange?.to) {
        const startStr = format(dateRange.from, 'yyyy-MM-dd');
        const endStr = format(dateRange.to, 'yyyy-MM-dd');
        if (lastLiveDate && endStr > lastLiveDate) {
          const histStart = startStr > lastLiveDate
            ? startStr
            : format(addDays(new Date(lastLiveDate), 1), 'yyyy-MM-dd');
          try {
            const historicalDays = await fetchHistoricalWeather(coords.lat, coords.lon, histStart, endStr);
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
      }
    } catch {
      setWeatherError(t('qgen.weather_error'));
    } finally {
      setIsFetchingWeather(false);
    }
  }, [dateRange, t]);

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
  const fromTime = dateRange?.from?.getTime();
  const toTime = dateRange?.to?.getTime();
  useEffect(() => {
    if (destCoords && dateRange?.from && dateRange?.to) {
      lookupWeatherWithCoords(destCoords);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromTime, toTime]);

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
          trip_type: VIBE_TO_TRIP_TYPE[vibe],
          occasions: VIBE_TO_OCCASIONS[vibe],
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
      const capsuleResult = data as CapsuleResult;
      setResult(capsuleResult);
      setActiveTab('packing');
      hapticSuccess();
      toast.success(t('capsule.created'));

      // Save to sessionStorage
      const saved: SavedCapsule = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        destination,
        vibe,
        dateLabel: dateLabel || '',
        itemCount: capsuleResult.capsule_items.length,
        outfitCount: capsuleResult.outfits.length,
        result: capsuleResult,
        created_at: new Date().toISOString(),
      };
      const updated = [saved, ...savedCapsules.filter(c => c.id !== saved.id)].slice(0, 10);
      setSavedCapsules(updated);
      saveCapsules(updated);
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

      const { data: freshGarments } = await supabase
        .from('garments')
        .select('id, category')
        .in('id', capsuleItemIds)
        .eq('user_id', userId);

      const freshMap = new Map((freshGarments || []).map(g => [g.id, g]));
      const createdOutfitKeys = new Set<string>();

      for (const capsuleOutfit of result.outfits) {
        const sortedItems = [...capsuleOutfit.items].sort();
        const dedupeKey = `${capsuleOutfit.day}-${sortedItems.join(',')}`;
        if (createdOutfitKeys.has(dedupeKey)) continue;
        createdOutfitKeys.add(dedupeKey);

        const outfitDate = format(addDays(dateRange.from!, capsuleOutfit.day - 1), 'yyyy-MM-dd');
        const validItems = capsuleOutfit.items.filter(id => freshMap.has(id));
        if (validItems.length === 0) continue;

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

          {/* Saved capsules */}
          {savedCapsules.length > 0 && !showForm && (
            <div className="space-y-2">
              {savedCapsules.map(c => (
                <button
                  key={c.id}
                  onClick={() => loadSavedCapsule(c)}
                  className="w-full text-left p-4 rounded-xl bg-card/60 border border-border/10 hover:bg-card/80 transition-colors relative group"
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSavedCapsule(c.id); }}
                    className="absolute top-3 right-3 w-6 h-6 rounded-full bg-muted/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                  <p style={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: 16, color: '#1C1917', margin: 0 }}>
                    {c.destination}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span style={{
                      fontFamily: 'DM Sans, sans-serif', fontSize: 10, background: '#EDE8DF',
                      color: '#1C1917', padding: '2px 8px', textTransform: 'capitalize',
                    }}>
                      {c.vibe}
                    </span>
                    {c.dateLabel && (
                      <span className="text-[11px] text-muted-foreground/60">{c.dateLabel}</span>
                    )}
                    <span className="text-[11px] text-muted-foreground/60">
                      {c.itemCount} items · {c.outfitCount} outfits
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

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

            {/* c. TRIP VIBE — single select */}
            <div className="space-y-2">
              <Label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
                Trip vibe
              </Label>
              <div className="flex flex-wrap gap-2">
                {VIBES.map(v => (
                  <button
                    key={v.id}
                    onClick={() => { hapticLight(); setVibe(v.id); }}
                    className={cn(
                      'px-4 py-1.5 rounded-full text-[13px] font-medium transition-all border',
                      vibe === v.id
                        ? 'bg-foreground text-background border-transparent'
                        : 'bg-card/60 border-border/20 text-foreground hover:bg-card/80'
                    )}
                    style={{ fontFamily: 'DM Sans, sans-serif' }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* d. DURATION — stepper */}
            <div className="space-y-2">
              <Label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
                Duration
              </Label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => { hapticLight(); setDurationDays(d => Math.max(1, d - 1)); }}
                  disabled={durationDays <= 1}
                  className="w-10 h-10 rounded-xl bg-card/60 border border-border/15 flex items-center justify-center disabled:opacity-30 transition-opacity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-2xl font-semibold w-16 text-center tabular-nums">{durationDays} days</span>
                <button
                  onClick={() => { hapticLight(); setDurationDays(d => Math.min(21, d + 1)); }}
                  disabled={durationDays >= 21}
                  className="w-10 h-10 rounded-xl bg-card/60 border border-border/15 flex items-center justify-center disabled:opacity-30 transition-opacity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* e. OUTFITS PER DAY — stepper */}
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
                    {LOADING_STEPS(destination)[loadingStep]}
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

  // ─────────────── RESULTS SCREEN ───────────────
  const packedCount = Object.values(groupedItems).flat().filter(g => checkedItems.has(g.id)).length;
  const totalItems = capsuleItemIds.length;

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

        {/* ── Hero Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: EASE_CURVE }}
          className="mx-5 mt-4 p-5 rounded-xl bg-[#F5F0E8] border border-border/10"
        >
          <h2 style={{
            fontFamily: '"Playfair Display", serif',
            fontStyle: 'italic',
            fontSize: 22,
            color: '#1C1917',
            margin: 0,
            marginBottom: 6,
          }}>
            {destination}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {dateLabel && <span className="text-[12px] text-muted-foreground">{dateLabel}</span>}
            <span style={{
              fontFamily: 'DM Sans, sans-serif', fontSize: 10, background: '#1C1917',
              color: '#F5F0E8', padding: '2px 8px', textTransform: 'capitalize',
            }}>
              {vibe}
            </span>
            <span className="text-[12px] text-muted-foreground">
              {totalItems} items · {result.outfits.length} outfits
            </span>
          </div>
          {weatherForecast && (
            <div className="flex items-center gap-1.5 mt-2">
              <WeatherMiniIcon condition={weatherForecast.condition} className="w-3 h-3" />
              <span className="text-[11px] text-muted-foreground">
                {weatherForecast.temperature_min}–{weatherForecast.temperature_max}°C · {weatherForecast.condition}
              </span>
            </div>
          )}
        </motion.div>

        {/* ── Weather Strip ── */}
        {tripDayForecasts.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
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
                    {packedCount} of {totalItems} packed
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
                          {t('capsule.used_in')} {catOutfitUses} {t('capsule.outfits_label')}
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

                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted/30 shrink-0">
                              <LazyImageSimple imagePath={getPreferredGarmentImagePath(g)} alt={g.title} className="w-full h-full" />
                            </div>

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

                {/* Copy packing list */}
                <button
                  onClick={() => {
                    const garmentTitles = capsuleItemIds
                      .map(id => garmentMap.get(id) ?? allGarmentsMap.get(id))
                      .filter(Boolean)
                      .map((g) => `- ${g!.title}`)
                      .join('\n');
                    navigator.clipboard.writeText(garmentTitles);
                    toast.success('Packing list copied');
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#EDE8DF] text-[13px] font-medium text-foreground hover:bg-[#E5DED4] transition-colors"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
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
                {(() => {
                  // Group outfits by day to avoid duplicate day headers
                  const byDay = new Map<number, CapsuleOutfit[]>();
                  for (const outfit of result.outfits) {
                    const list = byDay.get(outfit.day) || [];
                    list.push(outfit);
                    byDay.set(outfit.day, list);
                  }
                  let animIdx = 0;
                  return [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([day, outfits]) => (
                    <div key={`day-${day}`} className="space-y-2">
                      <p style={{ fontFamily: 'DM Sans', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(28,25,23,0.45)', marginBottom: 4 }}>
                        Day {day}
                      </p>
                      {outfits.map((outfit) => {
                        const idx = animIdx++;
                        const outfitGarments = outfit.items
                          .map((id: string) => garmentMap.get(id) ?? allGarmentsMap.get(id))
                          .filter(Boolean) as Array<{ id: string; title: string; image_path: string; category: string }>;
                        return (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * STAGGER_DELAY, duration: 0.35 }}
                          >
                            <OutfitSuggestionCard
                              garments={outfitGarments}
                              explanation={outfit.note ?? ''}
                              onTryOutfit={() => {/* no-op in capsule context */}}
                              isCreating={false}
                            />
                          </motion.div>
                        );
                      })}
                    </div>
                  ));
                })()}
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
            <>
              <Button
                onClick={handleAddToCalendar}
                className="flex-1 h-11 rounded-xl"
              >
                <CalendarPlus className="w-4 h-4 mr-2" />
                {t('capsule.add_to_plan')}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setResult(null); setAddedToCalendar(false); }}
                className="h-11 rounded-xl px-4"
              >
                Start over
              </Button>
            </>
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
