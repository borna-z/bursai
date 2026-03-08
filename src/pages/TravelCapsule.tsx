import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, Sparkles, Loader2, Luggage, Shirt, LightbulbIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { AnimatedPage } from '@/components/ui/animated-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Chip } from '@/components/ui/chip';
import { Badge } from '@/components/ui/badge';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProfile } from '@/hooks/useProfile';
import { useGarmentsByIds } from '@/hooks/useGarmentsByIds';
import { getCoordinatesFromCity, fetchForecast, type ForecastDay } from '@/hooks/useForecast';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
];

export default function TravelCapsule() {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const { data: profile } = useProfile();

  const [destination, setDestination] = useState('');
  const [days, setDays] = useState(5);
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>(['vardag', 'jobb']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<CapsuleResult | null>(null);
  const [weatherForecast, setWeatherForecast] = useState<ForecastDay | null>(null);
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  // Resolve garment data for capsule items
  const { data: capsuleGarments } = useGarmentsByIds(result?.capsule_items || []);

  const garmentMap = new Map((capsuleGarments || []).map(g => [g.id, g]));

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
      // Use average of available days
      if (forecastDays.length > 0) {
        const avgMax = Math.round(forecastDays.reduce((s, d) => s + d.temperature_max, 0) / forecastDays.length);
        const avgMin = Math.round(forecastDays.reduce((s, d) => s + d.temperature_min, 0) / forecastDays.length);
        const avgPrecip = forecastDays.reduce((s, d) => s + (d.precipitation_probability || 0), 0) / forecastDays.length;
        setWeatherForecast({
          date: forecastDays[0].date,
          temperature_max: avgMax,
          temperature_min: avgMin,
          condition: avgPrecip > 50 ? 'rain' : 'clear',
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

    // Fetch weather if not already done
    if (!weatherForecast) await lookupWeather();

    setIsGenerating(true);
    try {
      const userLocale = (profile?.preferences as Record<string, string> | null)?.locale || locale;

      const { data, error } = await supabase.functions.invoke('travel_capsule', {
        body: {
          duration_days: days,
          destination,
          weather: weatherForecast ? {
            temperature_min: weatherForecast.temperature_min,
            temperature_max: weatherForecast.temperature_max,
            condition: weatherForecast.condition,
          } : null,
          occasions: selectedOccasions,
          locale: userLocale,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult(data as CapsuleResult);
      toast.success(t('capsule.created'));
    } catch (err) {
      toast.error(t('capsule.create_error'));
      console.error('Travel capsule error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AppLayout hideNav>
      <AnimatedPage className="px-6 pb-8 pt-12 max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-muted press">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold">{t('capsule.title')}</h1>
            <p className="text-xs text-muted-foreground">{t('capsule.subtitle')}</p>
          </div>
        </div>

        {!result ? (
          /* ─── Input Form ─── */
          <div className="space-y-5">
            {/* Destination */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('capsule.destination')}</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('capsule.enter_city')}
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  onBlur={() => lookupWeather()}
                  className="pl-9"
                />
              </div>
              {isFetchingWeather && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />{t('qgen.fetching_weather')}
                </p>
              )}
              {weatherError && <p className="text-xs text-destructive">{weatherError}</p>}
              {weatherForecast && !isFetchingWeather && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 text-sm">
                  <span>{weatherForecast.temperature_min}–{weatherForecast.temperature_max}°C</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{weatherForecast.condition}</span>
                </div>
              )}
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('capsule.duration')}</Label>
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div className="flex items-center gap-2">
                  {[3, 5, 7, 10, 14].map(d => (
                    <Chip key={d} selected={days === d} onClick={() => setDays(d)} size="lg">
                      {d} {t('capsule.days')}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>

            {/* Occasions */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('capsule.occasions')}</Label>
              <div className="flex flex-wrap gap-2">
                {OCCASIONS.map(o => (
                  <Chip
                    key={o.id}
                    selected={selectedOccasions.includes(o.id)}
                    onClick={() => toggleOccasion(o.id)}
                    size="lg"
                  >
                    {t(o.labelKey)}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Generate */}
            <Button onClick={handleGenerate} disabled={isGenerating || !destination} className="w-full h-12 rounded-xl" size="lg">
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('capsule.generating')}</>
              ) : (
                <><Luggage className="w-4 h-4 mr-2" />{t('capsule.generate')}</>
              )}
            </Button>
          </div>
        ) : (
          /* ─── Results ─── */
          <div className="space-y-6">
            {/* Summary */}
            <div className="rounded-xl glass-card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Luggage className="w-5 h-5 text-primary" />
                <span className="font-medium">{destination} · {days} {t('capsule.days')}</span>
              </div>
              <p className="text-sm text-foreground/80">{result.reasoning}</p>
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

            {/* Capsule garments grid */}
            <div>
              <h2 className="text-sm font-medium mb-3">{t('capsule.pack_these')}</h2>
              <div className="grid grid-cols-4 gap-2">
                {result.capsule_items.map(id => {
                  const g = garmentMap.get(id);
                  if (!g) return null;
                  return (
                    <div key={id} className="space-y-1">
                      <div className="aspect-square rounded-xl overflow-hidden bg-muted">
                        <LazyImageSimple imagePath={g.image_path} alt={g.title} className="w-full h-full" />
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate text-center">{g.title}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Day-by-day outfits */}
            <div>
              <h2 className="text-sm font-medium mb-3">{t('capsule.day_plan')}</h2>
              <div className="space-y-2">
                {result.outfits.map((outfit, idx) => (
                  <div key={idx} className="rounded-xl border border-border/50 overflow-hidden">
                    <button
                      onClick={() => setExpandedDay(expandedDay === outfit.day ? null : outfit.day)}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{t('capsule.day_label')} {outfit.day}</span>
                        <Badge variant="secondary" className="text-[10px] capitalize">{outfit.occasion}</Badge>
                      </div>
                      {expandedDay === outfit.day ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                    {expandedDay === outfit.day && (
                      <div className="px-3 pb-3 space-y-2">
                        <div className="flex gap-2">
                          {outfit.items.map(itemId => {
                            const g = garmentMap.get(itemId);
                            if (!g) return null;
                            return (
                              <div key={itemId} className="w-16">
                                <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                                  <LazyImageSimple imagePath={g.image_path} alt={g.title} className="w-full h-full" />
                                </div>
                                <p className="text-[9px] text-muted-foreground truncate text-center mt-0.5">{g.title}</p>
                              </div>
                            );
                          })}
                        </div>
                        {outfit.note && (
                          <p className="text-xs text-muted-foreground">{outfit.note}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Packing tips */}
            {result.packing_tips.length > 0 && (
              <div>
                <h2 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <LightbulbIcon className="w-4 h-4 text-primary" />
                  {t('capsule.tips')}
                </h2>
                <ul className="space-y-1.5">
                  {result.packing_tips.map((tip, idx) => (
                    <li key={idx} className="text-xs text-muted-foreground flex gap-2">
                      <span className="text-primary">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Reset */}
            <Button variant="outline" onClick={() => setResult(null)} className="w-full rounded-xl">
              {t('capsule.new_trip')}
            </Button>
          </div>
        )}
      </AnimatedPage>
    </AppLayout>
  );
}
