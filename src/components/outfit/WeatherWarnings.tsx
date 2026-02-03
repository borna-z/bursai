import { AlertTriangle, Thermometer, ThermometerSnowflake, ThermometerSun, Droplets, Wind, Shirt, Snowflake } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Garment } from '@/hooks/useGarments';

interface OutfitItem {
  slot: string;
  garment?: Garment | null;
}

interface WeatherInfo {
  temp?: number;
  temperature?: number;
  condition?: string;
  precipitation?: 'none' | 'rain' | 'snow';
  wind?: 'low' | 'medium' | 'high';
}

interface WeatherWarning {
  type: 'warning' | 'suggestion';
  icon: React.ElementType;
  message: string;
}

interface WeatherWarningsProps {
  outfitItems: OutfitItem[];
  currentWeather?: WeatherInfo | null;
  outfitWeather?: WeatherInfo | null;
  className?: string;
}

// Season tags that indicate warm clothing
const WARM_SEASONS = ['Vinter', 'Höst'];
const COLD_SEASONS = ['Sommar'];

// Categories that provide warmth
const WARM_CATEGORIES = ['outerwear'];
const LIGHT_CATEGORIES = ['t-shirt', 'shorts', 'linne'];

// Check if outfit has outerwear
function hasOuterwear(items: OutfitItem[]): boolean {
  return items.some(item => item.slot === 'outerwear' && item.garment);
}

// Check if outfit has winter-appropriate clothing
function hasWarmClothing(items: OutfitItem[]): boolean {
  return items.some(item => {
    const garment = item.garment;
    if (!garment) return false;
    
    const seasons = garment.season_tags || [];
    const hasWarmSeason = seasons.some(s => WARM_SEASONS.includes(s));
    const isWarmCategory = WARM_CATEGORIES.includes(garment.category);
    
    return hasWarmSeason || isWarmCategory;
  });
}

// Check if outfit has light summer clothing
function hasLightClothing(items: OutfitItem[]): boolean {
  return items.some(item => {
    const garment = item.garment;
    if (!garment) return false;
    
    const seasons = garment.season_tags || [];
    return seasons.some(s => COLD_SEASONS.includes(s));
  });
}

// Analyze outfit against weather and generate warnings
export function analyzeOutfitWeather(
  items: OutfitItem[],
  currentWeather?: WeatherInfo | null,
  outfitWeather?: WeatherInfo | null
): WeatherWarning[] {
  const warnings: WeatherWarning[] = [];
  
  const currentTemp = currentWeather?.temp ?? currentWeather?.temperature;
  const outfitTemp = outfitWeather?.temp ?? outfitWeather?.temperature;
  
  // No current weather = no warnings
  if (currentTemp === undefined) return warnings;
  
  // Check temperature difference from original outfit weather
  if (outfitTemp !== undefined) {
    const tempDiff = currentTemp - outfitTemp;
    
    if (tempDiff > 10) {
      warnings.push({
        type: 'warning',
        icon: ThermometerSun,
        message: `Det är ${Math.abs(tempDiff)}° varmare än när outfiten skapades`,
      });
    } else if (tempDiff < -10) {
      warnings.push({
        type: 'warning',
        icon: ThermometerSnowflake,
        message: `Det är ${Math.abs(tempDiff)}° kallare än när outfiten skapades`,
      });
    }
  }
  
  // Cold weather warnings (< 5°C)
  if (currentTemp <= 5) {
    if (!hasOuterwear(items)) {
      warnings.push({
        type: 'warning',
        icon: Snowflake,
        message: 'Kyla! Överväg att lägga till ytterkläder',
      });
    }
    if (!hasWarmClothing(items)) {
      warnings.push({
        type: 'suggestion',
        icon: ThermometerSnowflake,
        message: 'Outfiten saknar vinterplagg – klä dig varmt',
      });
    }
  }
  
  // Chilly weather (5-12°C)
  if (currentTemp > 5 && currentTemp <= 12) {
    if (!hasOuterwear(items) && !hasWarmClothing(items)) {
      warnings.push({
        type: 'suggestion',
        icon: Thermometer,
        message: 'Kan vara kyligt – ta med en jacka',
      });
    }
  }
  
  // Hot weather warnings (> 25°C)
  if (currentTemp >= 25) {
    if (hasOuterwear(items)) {
      warnings.push({
        type: 'warning',
        icon: ThermometerSun,
        message: 'Varmt väder! Ytterkläder kan bli för varmt',
      });
    }
    if (hasWarmClothing(items) && !hasLightClothing(items)) {
      warnings.push({
        type: 'suggestion',
        icon: ThermometerSun,
        message: 'Överväg lättare plagg för värmen',
      });
    }
  }
  
  // Rain warnings
  if (currentWeather?.precipitation === 'rain') {
    if (!hasOuterwear(items)) {
      warnings.push({
        type: 'warning',
        icon: Droplets,
        message: 'Regn! Ta med regnkläder eller paraply',
      });
    } else {
      warnings.push({
        type: 'suggestion',
        icon: Droplets,
        message: 'Regn väntas – se till att jackan är vattenavvisande',
      });
    }
  }
  
  // Snow warnings
  if (currentWeather?.precipitation === 'snow') {
    if (!hasWarmClothing(items)) {
      warnings.push({
        type: 'warning',
        icon: Snowflake,
        message: 'Snö! Klä dig varmt och vattentätt',
      });
    }
  }
  
  // Wind warnings
  if (currentWeather?.wind === 'high') {
    warnings.push({
      type: 'suggestion',
      icon: Wind,
      message: 'Blåsigt – välj vindtäta kläder',
    });
  }
  
  return warnings;
}

export function WeatherWarnings({ 
  outfitItems, 
  currentWeather, 
  outfitWeather,
  className 
}: WeatherWarningsProps) {
  const warnings = analyzeOutfitWeather(outfitItems, currentWeather, outfitWeather);
  
  if (warnings.length === 0) return null;
  
  return (
    <div className={cn("space-y-2", className)}>
      {warnings.map((warning, index) => {
        const Icon = warning.icon;
        const isWarning = warning.type === 'warning';
        
        return (
          <div
            key={index}
            className={cn(
              "flex items-start gap-2 text-sm p-2 rounded-lg",
              isWarning 
                ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" 
                : "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400"
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{warning.message}</span>
          </div>
        );
      })}
    </div>
  );
}

// Compact version for outfit cards
export function WeatherWarningBadge({ 
  outfitItems, 
  currentWeather, 
  outfitWeather,
}: WeatherWarningsProps) {
  const warnings = analyzeOutfitWeather(outfitItems, currentWeather, outfitWeather);
  
  const criticalWarnings = warnings.filter(w => w.type === 'warning');
  
  if (criticalWarnings.length === 0) return null;
  
  return (
    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
      <AlertTriangle className="w-3.5 h-3.5" />
      <span className="text-xs">{criticalWarnings.length} varning{criticalWarnings.length > 1 ? 'ar' : ''}</span>
    </div>
  );
}
