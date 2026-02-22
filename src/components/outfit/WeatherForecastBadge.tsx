import { Cloud, CloudRain, CloudSnow, CloudDrizzle, Sun, CloudLightning, CloudFog, Loader2, AlertTriangle, Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation } from '@/contexts/LocationContext';
import { useForecast, type ForecastDay } from '@/hooks/useForecast';

interface WeatherForecastBadgeProps {
  date: string;
  compact?: boolean;
  className?: string;
  showWarning?: boolean;
  originalTemp?: number;
}

function getWeatherIcon(code: number) {
  if (code === 0) return Sun;
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

function useWeatherWarning(forecast: ForecastDay | undefined) {
  const { t } = useLanguage();
  if (!forecast) return null;
  if (forecast.precipitation_probability > 50) return t('weather.bring_umbrella');
  if (forecast.temperature_avg < 0) return t('weather.cold_warning');
  if (forecast.temperature_avg > 28) return t('weather.hot_warning');
  return null;
}

export function WeatherForecastBadge({ 
  date, 
  compact = false, 
  className,
  showWarning = true,
  originalTemp,
}: WeatherForecastBadgeProps) {
  const { t } = useLanguage();
  const { effectiveCity } = useLocation();
  const { getForecastForDate, isLoading, error } = useForecast({ city: effectiveCity });
  const forecast = getForecastForDate(date);
  const warning = showWarning ? useWeatherWarning(forecast) : null;

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-1 text-muted-foreground", className)}>
        <Loader2 className="w-3 h-3 animate-spin" />
        {!compact && <span className="text-xs">{t('common.loading')}</span>}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-center gap-1 text-destructive/70", className)}>
        <AlertTriangle className="w-3.5 h-3.5" />
        {!compact && <span className="text-xs">{t('weather.unavailable')}</span>}
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className={cn("flex items-center gap-1 text-muted-foreground", className)}>
        <Cloud className="w-3.5 h-3.5 opacity-50" />
        {!compact && <span className="text-xs">{t('weather.unavailable')}</span>}
      </div>
    );
  }

  const WeatherIcon = getWeatherIcon(forecast.weather_code);
  const tempDiff = originalTemp !== undefined ? Math.abs(forecast.temperature_avg - originalTemp) : 0;
  const significantTempDiff = tempDiff > 10;

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <WeatherIcon className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">{forecast.temperature_avg}°</span>
        {forecast.precipitation_probability > 50 && (
          <Droplets className="w-3 h-3 text-blue-500" />
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2">
        <WeatherIcon className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm">
          {forecast.temperature_avg}°C · {t(forecast.condition)}
        </span>
        {forecast.precipitation_probability > 30 && (
          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
            <Droplets className="w-3 h-3" />
            {forecast.precipitation_probability}%
          </span>
        )}
      </div>
      
      {warning && (
        <div className="flex items-center gap-1 text-xs text-warning">
          <AlertTriangle className="w-3 h-3" />
          {warning}
        </div>
      )}
      
      {significantTempDiff && originalTemp !== undefined && (
        <div className="flex items-center gap-1 text-xs text-warning">
          <AlertTriangle className="w-3 h-3" />
          {t('weather.outfit_created_for')} {originalTemp}°C
        </div>
      )}
    </div>
  );
}

interface ForecastPreviewProps {
  date: string;
  originalTemp?: number;
}

export function ForecastPreview({ date, originalTemp }: ForecastPreviewProps) {
  const { t } = useLanguage();
  const { effectiveCity } = useLocation();
  const { getForecastForDate, isLoading, error } = useForecast({ city: effectiveCity });
  const forecast = getForecastForDate(date);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t('weather.fetching')}
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        {t('weather.unavailable')}
      </div>
    );
  }

  const WeatherIcon = getWeatherIcon(forecast.weather_code);
  const tempDiff = originalTemp !== undefined ? Math.abs(forecast.temperature_avg - originalTemp) : 0;

  return (
    <div className="space-y-2 py-2">
      <div className="flex items-center gap-2 text-sm">
        <WeatherIcon className="w-5 h-5 text-muted-foreground" />
        <span className="font-medium">{forecast.temperature_avg}°C</span>
        <span className="text-muted-foreground">{t(forecast.condition)}</span>
        {forecast.precipitation_probability > 30 && (
          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
            <Droplets className="w-3 h-3" />
            {forecast.precipitation_probability}%
          </span>
        )}
      </div>
      
      {tempDiff > 10 && originalTemp !== undefined && (
        <div className="flex items-center gap-1.5 text-xs text-warning bg-warning/10 px-2 py-1 rounded">
          <AlertTriangle className="w-3 h-3" />
          {t('weather.outfit_created_for')} {originalTemp}°C — {t('weather.differs')} {tempDiff}°
        </div>
      )}
    </div>
  );
}
