import { useState, useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Sun, Moon, Cloud, CloudFog, CloudRain, CloudDrizzle, CloudSnow, CloudLightning,
  MapPin, X,
} from 'lucide-react';
import { getBCP47 } from '@/lib/dateLocale';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useWeather } from '@/hooks/useWeather';
import { useForecast, type ForecastDay } from '@/hooks/useForecast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation } from '@/contexts/LocationContext';

interface WeatherWidgetProps {
  onWeatherChange?: (weather: { temperature: number; precipitation: string; wind: string }) => void;
}

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

function CurrentTime() {
  const [time, setTime] = useState(format(new Date(), 'HH:mm'));
  useEffect(() => {
    const interval = setInterval(() => setTime(format(new Date(), 'HH:mm')), 60_000);
    return () => clearInterval(interval);
  }, []);
  return <span className="text-sm text-muted-foreground tabular-nums">{time}</span>;
}

function ForecastDayColumn({ day, bcp47 }: { day: ForecastDay; bcp47: string }) {
  const Icon = getWeatherIcon(day.weather_code);
  const dayDate = parseISO(day.date);
  const label = dayDate.toLocaleDateString(bcp47, { weekday: 'short' });
  const capitalised = label.charAt(0).toUpperCase() + label.slice(1);

  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <span className="text-xs text-muted-foreground">{capitalised}</span>
      <Icon className="w-5 h-5 text-foreground/70" />
      <span className="text-xs font-medium">{day.temperature_max}°</span>
      <span className="text-[11px] text-muted-foreground">{day.temperature_min}°</span>
    </div>
  );
}

export function WeatherWidget({ onWeatherChange }: WeatherWidgetProps) {
  const { t, locale } = useLanguage();
  const bcp47 = getBCP47(locale);
  const { effectiveCity, locationSource, setManualCity, clearManualCity } = useLocation();
  const [editingLocation, setEditingLocation] = useState(false);
  const [cityInput, setCityInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { weather, isLoading } = useWeather({ city: effectiveCity });
  const { forecast, isLoading: forecastLoading } = useForecast({ city: effectiveCity });

  // Notify parent of weather changes
  useEffect(() => {
    if (weather && onWeatherChange) {
      onWeatherChange({
        temperature: weather.temperature,
        precipitation: weather.precipitation,
        wind: weather.wind,
      });
    }
  }, [weather, onWeatherChange]);

  // Focus input when editing
  useEffect(() => {
    if (editingLocation) {
      inputRef.current?.focus();
    }
  }, [editingLocation]);

  const HeroIcon = weather ? getWeatherIcon(weather.weather_code, weather.is_day) : Cloud;
  const next5 = forecast.slice(1, 6);

  const handleCitySubmit = () => {
    const trimmed = cityInput.trim();
    if (trimmed) {
      setManualCity(trimmed);
    }
    setEditingLocation(false);
    setCityInput('');
  };

  const handleResetToAuto = () => {
    clearManualCity();
    setEditingLocation(false);
    setCityInput('');
  };

  // Loading skeleton (first load only)
  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="w-14 h-14 rounded-xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex justify-between pt-3 border-t border-border/50">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-3 w-6" />
              <Skeleton className="h-3 w-6" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Current weather hero */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-muted/30 backdrop-blur-sm flex items-center justify-center">
              <HeroIcon className="w-8 h-8 text-foreground/80" />
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">
                  {weather?.temperature ?? '--'}°
                </span>
              </div>
               <p className="text-sm text-muted-foreground mt-0.5">
                 {weather ? t(weather.condition) : '...'}
              </p>
            </div>
          </div>
        </div>

        {/* Location & time */}
        <div className="flex items-center justify-between mt-3">
          {editingLocation ? (
            <div className="flex items-center gap-2 flex-1 mr-3">
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
                className="h-7 text-sm px-2 py-0 flex-1"
              />
            </div>
          ) : (
            <button
              onClick={() => setEditingLocation(true)}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span className="text-sm">{weather?.location ?? 'Stockholm'}</span>
              {locationSource === 'manual' && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleResetToAuto(); }}
                  className="ml-1 p-0.5 rounded-full hover:bg-muted/60"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </button>
          )}
          <CurrentTime />
        </div>
      </div>

      {/* 5-day forecast strip */}
      {next5.length > 0 && (
        <div className="border-t border-border/50 px-5 py-4">
          <div className="flex justify-between">
            {next5.map((day) => (
              <ForecastDayColumn key={day.date} day={day} bcp47={bcp47} />
            ))}
          </div>
        </div>
      )}

      {forecastLoading && next5.length === 0 && (
        <div className="border-t border-border/50 px-5 py-4">
          <div className="flex justify-between">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <Skeleton className="h-3 w-8" />
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-3 w-6" />
                <Skeleton className="h-3 w-6" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
