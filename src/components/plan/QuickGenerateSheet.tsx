import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Sparkles, Thermometer, CalendarDays, MapPin } from 'lucide-react';
import { AILoadingCard } from '@/components/ui/AILoadingCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LocationAutocomplete } from '@/components/ui/LocationAutocomplete';
import { Chip } from '@/components/ui/chip';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { useWeather } from '@/hooks/useWeather';
import { useForecast, type ForecastDay } from '@/hooks/useForecast';
import { Label } from '@/components/ui/label';
import { useCalendarEvents, inferOccasionFromEvent } from '@/hooks/useCalendarSync';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation } from '@/contexts/LocationContext';
import { getBCP47 } from '@/lib/dateLocale';

function getSuggestedOccasion(events: { title: string }[]): { occasion: string; source: string } | null {
  let bestMatch: { occasion: string; formality: number; source: string } | null = null;
  for (const event of events) {
    const inferred = inferOccasionFromEvent(event.title);
    if (inferred && (!bestMatch || inferred.formality > bestMatch.formality)) {
      bestMatch = { occasion: inferred.occasion, formality: inferred.formality, source: event.title };
    }
  }
  return bestMatch ? { occasion: bestMatch.occasion, source: bestMatch.source } : null;
}

interface QuickGenerateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  onGenerate: (request: { occasion: string; style: string | null; temperature: number | undefined }) => void;
  isGenerating: boolean;
}

export function QuickGenerateSheet({ open, onOpenChange, date, onGenerate, isGenerating }: QuickGenerateSheetProps) {
  const { t, locale } = useLanguage();
  const { effectiveCity } = useLocation();
  const { weather } = useWeather({ city: effectiveCity });
  const { getForecastForDate } = useForecast({ city: effectiveCity });
  
  const dateStr = format(date, 'yyyy-MM-dd');
  const { data: calendarEvents } = useCalendarEvents(dateStr);
  
  const [occasion, setOccasion] = useState('vardag');
  const [styleVibe, setStyleVibe] = useState<string | null>(null);
  const [useAutoWeather, setUseAutoWeather] = useState(true);
  const [customTemp, setCustomTemp] = useState('');
  const [calendarSuggestion, setCalendarSuggestion] = useState<{ occasion: string; source: string } | null>(null);
  const [travelCity, setTravelCity] = useState('');
  const [travelForecast, setTravelForecast] = useState<ForecastDay | null>(null);
  const [isFetchingTravel, setIsFetchingTravel] = useState(false);
  const [travelError, setTravelError] = useState<string | null>(null);

  const isTravel = occasion === 'resa';

  const OCCASIONS = [
    { id: 'casual', label: t('home.occasion.casual') },
    { id: 'work', label: t('home.occasion.work') },
    { id: 'party', label: t('home.occasion.party') },
    { id: 'date', label: t('home.occasion.date') },
    { id: 'workout', label: t('home.occasion.workout') },
    { id: 'travel', label: t('home.occasion.travel') },
  ];

  const STYLE_VIBES = [
    { id: 'minimal', label: t('home.style.minimal') },
    { id: 'street', label: t('home.style.street') },
    { id: 'smart-casual', label: t('home.style.smart_casual') },
    { id: 'classic', label: t('home.style.klassisk') },
    { id: 'sporty', label: t('qgen.sporty') },
    { id: 'romantic', label: t('qgen.romantic') },
  ];

  const lookupTravelWeather = useCallback(async (coords: { lat: number; lon: number }, targetDate: string) => {
    setIsFetchingTravel(true); setTravelError(null);
    try {
      const { fetchForecast, fetchHistoricalWeather } = await import('@/hooks/useForecast');
      const days = await fetchForecast(coords.lat, coords.lon);
      let match = days.find(d => d.date === targetDate) || null;
      if (!match) {
        try {
          const historicalDays = await fetchHistoricalWeather(coords.lat, coords.lon, targetDate, targetDate);
          match = historicalDays.find(d => d.date === targetDate) || null;
        } catch { /* Historical fetch failed */ }
      }
      setTravelForecast(match);
      if (!match) setTravelError(t('qgen.no_forecast'));
    } catch { setTravelError(t('qgen.weather_error')); setTravelForecast(null); } finally { setIsFetchingTravel(false); }
  }, [t]);

  const handleTravelSelect = useCallback((city: string, coords: { lat: number; lon: number }) => {
    lookupTravelWeather(coords, dateStr);
  }, [lookupTravelWeather, dateStr]);

  useEffect(() => {
    if (!isTravel) { setTravelCity(''); setTravelForecast(null); setTravelError(null); }
  }, [isTravel]);

  useEffect(() => {
    if (calendarEvents && calendarEvents.length > 0) {
      const suggestion = getSuggestedOccasion(calendarEvents);
      if (suggestion) { setCalendarSuggestion(suggestion); setOccasion(suggestion.occasion); }
      else { setCalendarSuggestion(null); }
    } else { setCalendarSuggestion(null); }
  }, [calendarEvents]);

  const forecast = getForecastForDate(dateStr);
  const activeForecast = isTravel && travelForecast ? travelForecast : forecast;
  const autoTemp = activeForecast ? Math.round((activeForecast.temperature_max + activeForecast.temperature_min) / 2) : weather?.temperature;

  const handleGenerate = () => {
    const temp = useAutoWeather ? autoTemp : parseInt(customTemp) || undefined;
    onGenerate({ occasion, style: styleVibe, temperature: temp });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[85vh] rounded-t-2xl">
        <SheetHeader className="text-left pb-4">
          <SheetTitle>{t('qgen.create_for')} {date.toLocaleDateString(getBCP47(locale), { day: 'numeric', month: 'long' })}</SheetTitle>
          <SheetDescription>{t('qgen.choose_occasion')}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          {calendarSuggestion && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <CalendarDays className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t('qgen.suggested')}: {OCCASIONS.find(o => o.id === calendarSuggestion.occasion)?.label}</p>
                <p className="text-xs text-muted-foreground">{t('qgen.based_on')} "{calendarSuggestion.source}"</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('home.occasion')}</Label>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((o) => (
                <Chip key={o.id} selected={occasion === o.id} onClick={() => setOccasion(o.id)} size="lg">{o.label}</Chip>
              ))}
            </div>
          </div>

          {isTravel && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('qgen.destination')}</Label>
              <LocationAutocomplete
                value={travelCity}
                onChange={setTravelCity}
                onSelect={handleTravelSelect}
                placeholder={t('qgen.enter_city')}
              />
              {isFetchingTravel && (
                <AILoadingCard
                  phases={[
                    { icon: MapPin, label: `${t('qgen.looking_up') || 'Looking up'} ${travelCity}...`, duration: 1500 },
                    { icon: Thermometer, label: t('qgen.fetching_weather'), duration: 0 },
                  ]}
                  className="mt-1"
                />
              )}
              {travelError && (<p className="text-xs text-destructive">{travelError}</p>)}
              {travelForecast && !isFetchingTravel && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 text-sm">
                  <Thermometer className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{travelForecast.temperature_min}–{travelForecast.temperature_max}°C, {t(travelForecast.condition).toLowerCase()}</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('home.style_optional')}</Label>
            <div className="flex flex-wrap gap-2">
              {STYLE_VIBES.map((s) => (
                <Chip key={s.id} selected={styleVibe === s.id} onClick={() => setStyleVibe(styleVibe === s.id ? null : s.id)} size="lg">{s.label}</Chip>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('home.weather')}</Label>
            <div className="flex gap-2">
              <Chip selected={useAutoWeather} onClick={() => setUseAutoWeather(true)} className="flex-1 justify-center" size="lg">
                <Thermometer className="w-3.5 h-3.5 mr-1.5" />{autoTemp !== undefined ? `${autoTemp}°C` : 'Auto'}
              </Chip>
              <Chip selected={!useAutoWeather} onClick={() => setUseAutoWeather(false)} className="flex-1 justify-center" size="lg">
                {t('qgen.enter_manually')}
              </Chip>
            </div>
            {!useAutoWeather && (
              <div className="flex items-center gap-2 mt-2">
                <Input type="number" placeholder={t('home.temperature')} value={customTemp} onChange={(e) => setCustomTemp(e.target.value)} className="w-24" />
                <span className="text-sm text-muted-foreground">°C</span>
              </div>
            )}
          </div>

          {isGenerating ? (
            <AILoadingCard
              phases={[
                { icon: Sparkles, label: t('qgen.analyzing') || 'Analyzing...', duration: 1200 },
                { icon: Sparkles, label: t('qgen.creating'), duration: 1500 },
                { icon: Sparkles, label: t('qgen.saving') || 'Saving...', duration: 0 },
              ]}
              subtitle={OCCASIONS.find(o => o.id === occasion)?.label}
            />
          ) : (
            <Button onClick={handleGenerate} className="w-full" size="lg">
              <Sparkles className="w-4 h-4 mr-2" />{t('qgen.generate_outfit')}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
