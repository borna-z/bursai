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
import { formatLocalizedDate } from '@/lib/dateLocale';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';
import { buildTravelCapsulePlanSummary, isCompleteTravelCapsuleOutfitIds } from '@/lib/travelCapsulePlanner';
import { useTravelCapsules } from '@/hooks/useTravelCapsules';
import type { DateRange } from 'react-day-picker';
import type {
  CapsuleResult,
  Companion,
  GarmentSelection,
  LuggageType,
  OccasionId,
  StylePreference,
  VibeId,
} from './types';

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

export function useTravelCapsule() {
  const { t, locale, dateFnsLocale: dateLocale } = useLanguage();
  const { data: profile } = useProfile();
  const { data: allGarments } = useFlatGarments();
  const {
    capsules: savedTrips,
    save: saveCapsuleToDb,
    remove: removeCapsuleFromDb,
  } = useTravelCapsules();

  // ── Form state ──
  const [destination, setDestination] = useState('');
  const [destCoords, setDestCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [vibe, setVibe] = useState<VibeId>('mixed');
  const [outfitsPerDay, setOutfitsPerDay] = useState(1);
  const [mustHaveItems, setMustHaveItems] = useState<string[]>([]);
  const [minimizeItems, setMinimizeItems] = useState(true);
  const [includeTravelDays, setIncludeTravelDays] = useState(false);
  const [luggageType, setLuggageType] = useState<LuggageType>('carry_on_personal');
  const [companions, setCompanions] = useState<Companion>('solo');
  const [stylePreference, setStylePreference] = useState<StylePreference>('balanced');
  const [occasions, setOccasions] = useState<OccasionId[]>([]);
  const [garmentSelection, setGarmentSelection] = useState<GarmentSelection | null>(null);

  // ── Loading step state ──
  const [loadingStep, setLoadingStep] = useState(0);

  // Restore form state from picker page (round-trip)
  const location = useLocation();
  const locationState = location.state as {
    mustHaveItems?: string[];
    destination?: string;
    destCoords?: { lat: number; lon: number } | null;
    dateRange?: { from: string; to: string } | null;
    vibe?: VibeId;
    minimizeItems?: boolean;
    includeTravelDays?: boolean;
    outfitsPerDay?: number;
  } | null;

  const [addedToCalendar, setAddedToCalendar] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const restoredRef = useRef(false);

  // ── Generation state ──
  const [isGenerating, setIsGenerating] = useState(false);
  const [rawResult, setRawResult] = useState<CapsuleResult | null>(null);

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
  const tripDays = tripNights > 0 ? tripNights + 1 : dateRange?.from && dateRange?.to ? 1 : 0;
  const planningLookCount = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 0;
    return buildTravelCapsulePlanSummary(
      format(dateRange.from, 'yyyy-MM-dd'),
      format(dateRange.to, 'yyyy-MM-dd'),
      outfitsPerDay,
      includeTravelDays,
    ).requiredOutfits;
  }, [dateRange, outfitsPerDay, includeTravelDays]);

  const GARMENT_CEILING = 150;
  const actualSelectedCount = useMemo(() => {
    const total = allGarments?.length ?? 0;
    if (garmentSelection) {
      const sum = Object.values(garmentSelection).reduce((a, b) => a + b, 0);
      return Math.min(sum, GARMENT_CEILING, total);
    }
    return Math.min(total, GARMENT_CEILING);
  }, [allGarments, garmentSelection]);

  const travelCardPhases = useMemo(() => [
    {
      icon: Shirt,
      label: `Scanning ${actualSelectedCount} of your ${allGarments?.length ?? 0} garments`,
      duration: 15000,
    },
    { icon: Globe, label: `Finding combinations for ${destination || 'your destination'}`, duration: 15000 },
    { icon: Package, label: 'Building your capsule', duration: 15000 },
    { icon: SlidersHorizontal, label: `Optimizing ${planningLookCount || 0} looks`, duration: 0 },
  ], [actualSelectedCount, allGarments?.length, destination, planningLookCount]);

  // ── Garment data ──
  const activeResult = useMemo(() => {
    if (!rawResult) return null;
    const inlineLookup = new Map(
      (rawResult.capsule_items || [])
        .filter((item): item is { id: string; category: string; subcategory?: string | null } => typeof item !== 'string' && Boolean(item.id))
        .map((item) => [item.id, item]),
    );
    const garmentLookup = new Map<string, { id: string; category?: string | null; subcategory?: string | null }>();
    for (const [id, item] of inlineLookup) garmentLookup.set(id, item);
    for (const garment of allGarments || []) garmentLookup.set(garment.id, garment);
    return {
      ...rawResult,
      outfits: rawResult.outfits.filter((outfit) => isCompleteTravelCapsuleOutfitIds(outfit.items, garmentLookup)),
    };
  }, [rawResult, allGarments]);
  const result = activeResult;
  const setResult = setRawResult;

  const capsuleItemIds = useMemo(
    () => (activeResult?.capsule_items || []).map(item =>
      typeof item === 'string' ? item : item.id
    ),
    [activeResult]
  );
  const inlineGarmentMap = useMemo(() => {
    const m = new Map<string, { id: string; title: string; image_path: string; category: string; color_primary?: string }>();
    for (const item of (activeResult?.capsule_items || [])) {
      if (typeof item !== 'string' && item.id) {
        m.set(item.id, { id: item.id, title: item.title, image_path: item.image_path || '', category: item.category, color_primary: item.color_primary });
      }
    }
    return m;
  }, [activeResult]);

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

  const dateLabel = useMemo(() => {
    if (!dateRange?.from) return null;
    const from = formatLocalizedDate(dateRange.from, locale, { month: 'short', day: 'numeric' });
    if (!dateRange.to) return from;
    const to = formatLocalizedDate(dateRange.to, locale, { month: 'short', day: 'numeric' });
    return `${from} – ${to}`;
  }, [dateRange, locale]);

  const dateSublabel = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return null;
    return `${tripNights} ${t('capsule.nights')} • ${result?.outfits.length || planningLookCount} ${t('capsule.outfits_count')}`;
  }, [dateRange, tripNights, planningLookCount, result, t]);

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

// Restore form state from picker page
  useEffect(() => {
    if (!locationState || restoredRef.current) return;
    restoredRef.current = true;
    setShowForm(true);
    if (locationState.mustHaveItems) setMustHaveItems(locationState.mustHaveItems);
    if (locationState.destination) setDestination(locationState.destination);
    if (locationState.destCoords) setDestCoords(locationState.destCoords);
    if (locationState.vibe) setVibe(locationState.vibe);
    if (locationState.dateRange?.from && locationState.dateRange?.to) {
      setDateRange({
        from: new Date(locationState.dateRange.from),
        to: new Date(locationState.dateRange.to),
      });
    }
    if (locationState.minimizeItems !== undefined) setMinimizeItems(locationState.minimizeItems);
    if (locationState.includeTravelDays !== undefined) setIncludeTravelDays(locationState.includeTravelDays);
    if (locationState.outfitsPerDay !== undefined) setOutfitsPerDay(locationState.outfitsPerDay);
    // Weather lookup is triggered by the existing destCoords/dateRange effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fetch weather when dates change and destination is set
  const fromTime = dateRange?.from?.getTime();
  const toTime = dateRange?.to?.getTime();
  const lat = destCoords?.lat;
  const lon = destCoords?.lon;
  useEffect(() => {
    if (destCoords && dateRange?.from && dateRange?.to) {
      lookupWeatherWithCoords(destCoords);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromTime, toTime, lat, lon]);

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
      const effectiveOccasions: string[] = occasions;
      const { data, error } = await invokeEdgeFunction<CapsuleResult & { error?: string }>('travel_capsule', {
        timeout: 75000,
        body: {
          duration_days: tripDays,
          destination,
          trip_type: VIBE_TO_TRIP_TYPE[vibe],
          occasions: effectiveOccasions,
          luggage_type: luggageType,
          companions,
          style_preference: stylePreference,
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
          garment_selection: garmentSelection ?? undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const capsuleResult = data as CapsuleResult;
      setResult(capsuleResult);
      setActiveTab('packing');
      hapticSuccess();
      toast.success(t('capsule.created'));

      // Auto-save to DB (best-effort — failures don't block the UX)
      try {
        await saveCapsuleToDb({
          destination,
          start_date: dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : null,
          end_date: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : null,
          occasions: effectiveOccasions,
          luggage_type: luggageType,
          companions,
          style_preference: stylePreference,
          result: capsuleResult,
        });
      } catch (dbErr) {
        logger.error('Failed to auto-save travel capsule:', dbErr);
      }
    } catch (err) {
      toast.error(t('capsule.create_error'));
      logger.error('Travel capsule error:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [destination, dateRange, weatherForecast, lookupWeather, profile, locale, tripDays, vibe, occasions, luggageType, companions, stylePreference, outfitsPerDay, mustHaveItems, minimizeItems, includeTravelDays, t, setResult, saveCapsuleToDb, garmentSelection]);

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
        const dedupeKey = `${capsuleOutfit.date || capsuleOutfit.day}-${capsuleOutfit.kind || 'trip_day'}-${sortedItems.join(',')}`;
        if (createdOutfitKeys.has(dedupeKey)) continue;
        createdOutfitKeys.add(dedupeKey);

        const outfitDate = capsuleOutfit.date || format(addDays(dateRange.from!, capsuleOutfit.day - 1), 'yyyy-MM-dd');
        const validItems = capsuleOutfit.items.filter(id => freshMap.has(id));
        if (!isCompleteTravelCapsuleOutfitIds(validItems, freshMap)) continue;

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
    destCoords, setDestCoords,
    dateRange, setDateRange,
    vibe, setVibe,
    outfitsPerDay, setOutfitsPerDay,
    mustHaveItems, setMustHaveItems,
    minimizeItems, setMinimizeItems,
    includeTravelDays, setIncludeTravelDays,
    showForm, setShowForm,
    luggageType, setLuggageType,
    companions, setCompanions,
    stylePreference, setStylePreference,
    occasions, setOccasions,
    garmentSelection, setGarmentSelection,

    // Saved capsules (DB)
    savedTrips,
    removeCapsuleFromDb,

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
    planningLookCount,
    dateLabel,
    dateSublabel,
    dateLocale,
    tripDayForecasts,

    // Handlers
    handleLocationSelect,
    handleGenerate,
    handleAddToCalendar,
    toggleChecked,
  };
}
