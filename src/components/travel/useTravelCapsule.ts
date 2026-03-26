import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { format, differenceInCalendarDays, addDays } from 'date-fns';
import { Shirt, Globe, Package, SlidersHorizontal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { asPreferences } from '@/types/preferences';
import { useFlatGarments } from '@/hooks/useGarments';
import { useProfile } from '@/hooks/useProfile';
import { useGarmentsByIds } from '@/hooks/useGarmentsByIds';
import { getCoordinatesFromCity, fetchForecast, fetchHistoricalWeather, type ForecastDay } from '@/hooks/useForecast';
import { toast } from 'sonner';
import { getDateFnsLocale } from '@/lib/dateLocale';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';
import type { DateRange } from 'react-day-picker';
import type { CapsuleResult, SavedCapsule, VibeId } from './types';

/* ─── Trip Vibe config ─── */
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

function loadSavedCapsulesFromStorage(): SavedCapsule[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCapsulesToStorage(capsules: SavedCapsule[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(capsules));
}

export function useTravelCapsule() {
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
  const [savedCapsules, setSavedCapsules] = useState<SavedCapsule[]>(() => loadSavedCapsulesFromStorage());

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

  // ── Garment data ──
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
      saveCapsulesToStorage(next);
      return next;
    });
  };

  // ── Load a saved capsule ──
  const loadSavedCapsule = (capsule: SavedCapsule) => {
    setResult(capsule.result);
    setDestination(capsule.destination);
    setVibe((capsule.vibe as VibeId) || 'mixed');
  };

  // Restore form state from picker page
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
  const handleGenerate = useCallback(async () => {
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
      setSavedCapsules(prev => {
        const updated = [saved, ...prev.filter(c => c.id !== saved.id)].slice(0, 10);
        saveCapsulesToStorage(updated);
        return updated;
      });
    } catch (err) {
      toast.error(t('capsule.create_error'));
      logger.error('Travel capsule error:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [destination, dateRange, weatherForecast, lookupWeather, profile, locale, durationDays, tripDays, tripNights, vibe, outfitsPerDay, mustHaveItems, minimizeItems, includeTravelDays, dateLabel, t]);

  // ── Add to plan ──
  const handleAddToCalendar = useCallback(async () => {
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
          logger.error('Failed to create outfit:', outfitErr);
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

        if (itemsErr) logger.error('Failed to create outfit items:', itemsErr);

        const { error: planErr } = await supabase
          .from('planned_outfits')
          .insert({
            user_id: userId,
            date: outfitDate,
            outfit_id: outfitRow.id,
            note: `${destination} – ${capsuleOutfit.occasion}`,
            status: 'planned',
          });

        if (planErr) logger.error('Failed to plan outfit:', planErr);
      }

      hapticSuccess();
      toast.success(t('capsule.added_to_calendar'));
      setAddedToCalendar(true);
    } catch {
      toast.error(t('capsule.calendar_error'));
    } finally {
      setIsAddingToCalendar(false);
    }
  }, [result, dateRange, capsuleItemIds, destination, t]);

  return {
    // Form state
    destination, setDestination,
    destCoords,
    dateRange, setDateRange,
    vibe, setVibe,
    durationDays, setDurationDays,
    outfitsPerDay, setOutfitsPerDay,
    mustHaveItems, setMustHaveItems,
    minimizeItems, setMinimizeItems,
    includeTravelDays, setIncludeTravelDays,
    showForm, setShowForm,

    // Saved capsules
    savedCapsules,

    // Loading
    loadingStep,
    isGenerating,
    travelCardPhases,
    loadingSteps: LOADING_STEPS(destination),

    // Weather
    weatherForecast,
    forecastDays,
    isFetchingWeather,
    weatherError,

    // Results
    result, setResult,
    activeTab, setActiveTab,
    checkedItems,
    isAddingToCalendar,
    addedToCalendar, setAddedToCalendar,

    // Garment data
    allGarments,
    capsuleItemIds,
    garmentMap,
    allGarmentsMap,
    groupedItems,
    itemOutfitCount,

    // Derived
    tripNights,
    tripDays,
    dateLabel,
    dateSublabel,
    dateLocale,
    tripDayForecasts,

    // Handlers
    handleLocationSelect,
    handleGenerate,
    handleAddToCalendar,
    toggleChecked,
    removeSavedCapsule,
    loadSavedCapsule,
  };
}
