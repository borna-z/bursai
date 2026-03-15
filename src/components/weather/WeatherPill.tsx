import { useState, useEffect, useRef } from 'react';
import { parseISO } from 'date-fns';
import {
  Sun, Moon, Cloud, CloudFog, CloudRain, CloudDrizzle, CloudSnow, CloudLightning,
  ChevronDown, MapPin, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getBCP47 } from '@/lib/dateLocale';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useWeather } from '@/hooks/useWeather';
import { useForecast, type ForecastDay } from '@/hooks/useForecast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation } from '@/contexts/LocationContext';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';

function getWeatherIcon(code: number, isDay = true) {
  if (code === 0) return isDay ? Sun : Moon;
  if (code <= 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 51 && code <= 57) return CloudDrizzle;
  if (code >= 61 && code <= 67) return CloudRain;
  if (code >= 71 && code <= 77) return CloudSnow;
  if (code >= 80 && code <= 82) return CloudRain;
  if (code >= 85 && code <= 86) return CloudSnow;
  if (code >= 95 && code <= 99) return CloudLightning;
  return Cloud;
}

interface WeatherPillProps {
  onWeatherChange?: (weather: { temperature: number; precipitation: string; wind: string }) => void;
}

export function WeatherPill({ onWeatherChange }: WeatherPillProps) {
  const { t, locale } = useLanguage();
  const bcp47 = getBCP47(locale);
  const { effectiveCity, locationSource, setManualCity, clearManualCity } = useLocation();
  const { data: profile } = useProfile();
  const [editingLocation, setEditingLocation] = useState(false);
  const [cityInput, setCityInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasShownLocationToast = useRef(false);

  const { weather, isLoading } = useWeather({ city: effectiveCity });
  const { forecast } = useForecast({ city: effectiveCity });


  // Show "Is this your city?" toast on first auto-detect
  useEffect(() => {
    if (
      locationSource === 'auto' &&
      weather?.location &&
      profile !== undefined &&
      !profile?.home_city &&
      !hasShownLocationToast.current
    ) {
      hasShownLocationToast.current = true;
      toast(t('weather.located_in').replace('{city}', weather.location), {
        description: t('weather.is_this_your_city'),
        duration: 8000,
        action: {
          label: t('weather.yes'),
          onClick: () => setManualCity(weather.location),
        },
        cancel: {
          label: t('weather.change'),
          onClick: () => {
            setIsOpen(true);
            setEditingLocation(true);
          },
        },
      });
    }
  }, [locationSource, weather?.location, profile, setManualCity, t]);

  useEffect(() => {
    if (weather && onWeatherChange) {
      onWeatherChange({
        temperature: weather.temperature,
        precipitation: weather.precipitation,
        wind: weather.wind,
      });
    }
  }, [weather, onWeatherChange]);

  useEffect(() => {
    if (editingLocation) inputRef.current?.focus();
  }, [editingLocation]);

  const handleCitySubmit = () => {
    const trimmed = cityInput.trim();
    if (trimmed) setManualCity(trimmed);
    setEditingLocation(false);
    setCityInput('');
  };

  const handleResetToAuto = () => {
    clearManualCity();
    setEditingLocation(false);
    setCityInput('');
  };

  if (isLoading) {
    return <Skeleton className="h-8 w-24 rounded-full" />;
  }

  if (!weather) return null;

  const Icon = getWeatherIcon(weather.weather_code, weather.is_day);
  const next3 = forecast.slice(1, 4);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.07] transition-colors text-sm">
          <Icon className="w-4 h-4 text-foreground/70" />
          <span className="font-bold tabular-nums tracking-tight">{weather.temperature}°</span>
          <span className="text-muted-foreground/70 text-[0.75rem]">{t(weather.condition)}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground/60 ml-0.5" />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3">
        <div className="rounded-xl bg-foreground/[0.02] p-4 space-y-3">
          {/* 3-day forecast */}
          {next3.length > 0 && (
            <div className="flex gap-4">
              {next3.map((day) => {
                const DayIcon = getWeatherIcon(day.weather_code);
                const dayDate = parseISO(day.date);
                const label = dayDate.toLocaleDateString(bcp47, { weekday: 'short' });
                return (
                  <div key={day.date} className="flex flex-col items-center gap-1 flex-1">
                    <span className="text-[0.6875rem] text-muted-foreground/60 capitalize font-medium">{label}</span>
                    <DayIcon className="w-4 h-4 text-foreground/60" />
                    <span className="text-[0.75rem] font-bold tabular-nums tracking-tight">{day.temperature_max}°/{day.temperature_min}°</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Location picker */}
          <div className="flex items-center gap-2 pt-1 border-t border-border/20">
            {editingLocation ? (
              <div className="flex items-center gap-2 flex-1">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder={t('weather.enter_city')}
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCitySubmit();
                    if (e.key === 'Escape') { setEditingLocation(false); setCityInput(''); }
                  }}
                  onBlur={handleCitySubmit}
                  className="h-7 text-xs px-2 py-0 flex-1"
                />
              </div>
            ) : (
              <button
                onClick={() => setEditingLocation(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <MapPin className="w-3 h-3" />
                <span>{weather.location}</span>
                {locationSource === 'manual' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleResetToAuto(); }}
                    className="ml-1 p-0.5 rounded-full hover:bg-muted/60"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </button>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
