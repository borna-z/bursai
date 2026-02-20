import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Sparkles, Loader2, Thermometer, CalendarDays, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Chip } from '@/components/ui/chip';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { useWeather } from '@/hooks/useWeather';
import { useProfile } from '@/hooks/useProfile';
import { useForecast, getCoordinatesFromCity, fetchForecast, type ForecastDay } from '@/hooks/useForecast';
import { useCalendarEvents, inferOccasionFromEvent } from '@/hooks/useCalendarSync';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();
  const { data: profile } = useProfile();
  const { weather } = useWeather();
  const { getForecastForDate } = useForecast({ homeCity: profile?.home_city });
  
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
    { id: 'vardag', label: t('home.occasion.vardag') },
    { id: 'jobb', label: t('home.occasion.jobb') },
    { id: 'fest', label: t('home.occasion.fest') },
    { id: 'dejt', label: t('home.occasion.dejt') },
    { id: 'traning', label: t('home.occasion.traning') },
    { id: 'resa', label: t('home.occasion.resa') },
  ];

  const STYLE_VIBES = [
    { id: 'minimal', label: t('home.style.minimal') },
    { id: 'street', label: 'Street' },
    { id: 'smart-casual', label: t('home.style.smart_casual') },
    { id: 'klassisk', label: t('home.style.klassisk') },
    { id: 'sportig', label: t('qgen.sporty') },
    { id: 'romantisk', label: t('qgen.romantic') },
  ];

  const lookupTravelWeather = useCallback(async (city: string, targetDate: string) => {
    if (!city || city.length < 2) { setTravelForecast(null); setTravelError(null); return; }
    setIsFetchingTravel(true); setTravelError(null);
    try {
      const coords = await getCoordinatesFromCity(city);
      if (!coords) { setTravelError(t('qgen.place_not_found')); setTravelForecast(null); return; }
      const days = await fetchForecast(coords.lat, coords.lon);
      const match = days.find(d => d.date === targetDate) || null;
      setTravelForecast(match);
      if (!match) setTravelError(t('qgen.no_forecast'));
    } catch { setTravelError(t('qgen.weather_error')); setTravelForecast(null); } finally { setIsFetchingTravel(false); }
  }, [t]);

  useEffect(() => {
    if (!isTravel || !travelCity) { setTravelForecast(null); return; }
    const timer = setTimeout(() => { lookupTravelWeather(travelCity, dateStr); }, 500);
    return () => clearTimeout(timer);
  }, [travelCity, dateStr, isTravel, lookupTravelWeather]);

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
          <SheetTitle>{t('qgen.create_for')} {date.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</SheetTitle>
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
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder={t('qgen.enter_city')} value={travelCity} onChange={(e) => setTravelCity(e.target.value)} className="pl-9" />
              </div>
              {isFetchingTravel && (<p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" />{t('qgen.fetching_weather')}</p>)}
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

          <Button onClick={handleGenerate} disabled={isGenerating} className="w-full" size="lg">
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('qgen.creating')}</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" />{t('qgen.generate_outfit')}</>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
