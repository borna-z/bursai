import { Cloud, CloudRain, CloudSnow, Sun, CloudLightning, CloudFog, Loader2, AlertTriangle, Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForecast, type ForecastDay } from '@/hooks/useForecast';

interface WeatherForecastBadgeProps {
  date: string; // YYYY-MM-DD
  compact?: boolean;
  className?: string;
  showWarning?: boolean;
  originalTemp?: number; // For comparison with outfit's original weather
}

// Get weather icon based on weather code
function getWeatherIcon(code: number) {
  if (code === 0) return Sun;
  if (code <= 3) return Cloud;
  if (code <= 49) return CloudFog;
  if (code <= 69) return CloudRain;
  if (code <= 79) return CloudSnow;
  if (code >= 80) return CloudLightning;
  return Cloud;
}

// Get weather warning based on conditions
function getWeatherWarning(forecast: ForecastDay): string | null {
  if (forecast.precipitation_probability > 50) {
    return 'Ta med paraply!';
  }
  if (forecast.temperature_avg < 0) {
    return 'Kallt! Klä dig varmt';
  }
  if (forecast.temperature_avg > 28) {
    return 'Varmt! Tänk på solen';
  }
  return null;
}

export function WeatherForecastBadge({ 
  date, 
  compact = false, 
  className,
  showWarning = true,
  originalTemp,
}: WeatherForecastBadgeProps) {
  const { getForecastForDate, isLoading } = useForecast();
  
  const forecast = getForecastForDate(date);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-1 text-muted-foreground", className)}>
        <Loader2 className="w-3 h-3 animate-spin" />
        {!compact && <span className="text-xs">Laddar...</span>}
      </div>
    );
  }

  // No forecast available (date > 16 days or API error)
  if (!forecast) {
    return (
      <div className={cn("flex items-center gap-1 text-muted-foreground", className)}>
        <Cloud className="w-3.5 h-3.5 opacity-50" />
        {!compact && <span className="text-xs">Prognos ej tillgänglig</span>}
      </div>
    );
  }

  const WeatherIcon = getWeatherIcon(forecast.weather_code);
  const warning = showWarning ? getWeatherWarning(forecast) : null;
  
  // Check if temperature differs significantly from original
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
          {forecast.temperature_avg}°C · {forecast.condition}
        </span>
        {forecast.precipitation_probability > 30 && (
          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
            <Droplets className="w-3 h-3" />
            {forecast.precipitation_probability}%
          </span>
        )}
      </div>
      
      {warning && (
        <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
          <AlertTriangle className="w-3 h-3" />
          {warning}
        </div>
      )}
      
      {significantTempDiff && originalTemp !== undefined && (
        <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
          <AlertTriangle className="w-3 h-3" />
          Outfiten skapades för {originalTemp}°C
        </div>
      )}
    </div>
  );
}

// Standalone component for showing forecast in a date picker
interface ForecastPreviewProps {
  date: string;
  originalTemp?: number;
}

export function ForecastPreview({ date, originalTemp }: ForecastPreviewProps) {
  const { getForecastForDate, isLoading } = useForecast();
  const forecast = getForecastForDate(date);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Hämtar prognos...
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        Prognos ej tillgänglig för detta datum
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
        <span className="text-muted-foreground">{forecast.condition}</span>
        {forecast.precipitation_probability > 30 && (
          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
            <Droplets className="w-3 h-3" />
            {forecast.precipitation_probability}%
          </span>
        )}
      </div>
      
      {tempDiff > 10 && originalTemp !== undefined && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded">
          <AlertTriangle className="w-3 h-3" />
          Outfiten skapades för {originalTemp}°C - vädret skiljer sig {tempDiff}°
        </div>
      )}
    </div>
  );
}
