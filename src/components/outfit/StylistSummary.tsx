import { 
  Briefcase, 
  Coffee, 
  PartyPopper, 
  Plane, 
  Dumbbell,
  Heart,
  Thermometer,
  ThermometerSnowflake,
  ThermometerSun,
  CheckCircle2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { WeatherWarnings, analyzeOutfitWeather } from './WeatherWarnings';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import type { Garment } from '@/hooks/useGarments';

interface OutfitItem {
  slot: string;
  garment?: Garment | null;
}

interface StylistSummaryProps {
  occasion: string;
  styleVibe?: string | null;
  weather?: { temp?: number; condition?: string; precipitation?: 'none' | 'rain' | 'snow'; wind?: 'low' | 'medium' | 'high' } | null;
  currentWeather?: { temp?: number; precipitation?: 'none' | 'rain' | 'snow'; wind?: 'low' | 'medium' | 'high' } | null;
  explanation?: string | null;
  outfitItems?: OutfitItem[];
  isLoading?: boolean;
}

const occasionIcons: Record<string, React.ElementType> = {
  jobb: Briefcase,
  vardag: Coffee,
  fest: PartyPopper,
  resa: Plane,
  träning: Dumbbell,
  dejt: Heart,
};

const OCCASION_I18N: Record<string, string> = {
  jobb: 'occasion.jobb',
  vardag: 'occasion.vardag',
  fest: 'occasion.fest',
  resa: 'occasion.resa',
  'träning': 'occasion.traning',
  dejt: 'occasion.dejt',
};

function getTemperatureIcon(temp?: number) {
  if (temp === undefined) return null;
  if (temp <= 5) return ThermometerSnowflake;
  if (temp >= 20) return ThermometerSun;
  return Thermometer;
}

function generateSummary(occasion: string, t: (key: string) => string, temp?: number): string {
  const greetingKeys = ['stylist.greeting_1', 'stylist.greeting_2', 'stylist.greeting_3', 'stylist.greeting_4'];
  const greeting = t(greetingKeys[Math.floor(Math.random() * greetingKeys.length)]);
  
  const occasionKey = `stylist.${occasion.toLowerCase()}`;
  // Try occasion-specific, fall back to default
  const occasionText = t(occasionKey) !== occasionKey ? t(occasionKey) : t('stylist.default');
  
  let summary = `${greeting} ${occasionText}`;
  
  if (temp !== undefined) {
    if (temp <= 5) summary += ` ${t('stylist.cold')}`;
    else if (temp >= 25) summary += ` ${t('stylist.hot')}`;
  }
  
  return summary;
}

export function StylistSummary({ 
  occasion, 
  styleVibe, 
  weather,
  currentWeather,
  explanation,
  outfitItems = [],
  isLoading 
}: StylistSummaryProps) {
  const { t } = useLanguage();
  const OccasionIcon = occasionIcons[occasion.toLowerCase()] || Coffee;
  const TempIcon = getTemperatureIcon(weather?.temp);
  
  const summary = explanation || generateSummary(occasion, t, weather?.temp);
  
  const warnings = outfitItems.length > 0 
    ? analyzeOutfitWeather(outfitItems, currentWeather, weather, t)
    : [];
  
  const hasWarnings = warnings.length > 0;
  const hasCriticalWarnings = warnings.some(w => w.type === 'warning');
  
  const occasionLabel = t(OCCASION_I18N[occasion.toLowerCase()] || `occasion.${occasion.toLowerCase()}`);
  const displayLabel = occasionLabel.startsWith('occasion.') ? occasion : occasionLabel;
  
  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/10">
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "overflow-hidden transition-colors",
      hasCriticalWarnings 
        ? "bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10 border-amber-200 dark:border-amber-800/50"
        : "bg-gradient-to-br from-primary/5 to-accent/5 border-primary/10"
    )}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
            hasCriticalWarnings 
              ? "bg-amber-100 dark:bg-amber-900/30" 
              : "bg-primary/10"
          )}>
            <OccasionIcon className={cn(
              "w-5 h-5",
              hasCriticalWarnings ? "text-amber-600 dark:text-amber-400" : "text-primary"
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">{t('stylist.title')}</h3>
            <p className="text-sm text-muted-foreground mt-1">{summary}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="capitalize">
            {displayLabel}
          </Badge>
          {styleVibe && (
            <Badge variant="outline" className="capitalize">
              {styleVibe}
            </Badge>
          )}
          {weather?.temp !== undefined && TempIcon && (
            <Badge variant="outline" className="flex items-center gap-1">
              <TempIcon className="w-3 h-3" />
              {weather.temp}°C
            </Badge>
          )}
          {!hasWarnings && outfitItems.length > 0 && currentWeather && (
            <Badge variant="outline" className="flex items-center gap-1 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800">
              <CheckCircle2 className="w-3 h-3" />
              {t('stylist.fits_weather')}
            </Badge>
          )}
        </div>
        
        {hasWarnings && outfitItems.length > 0 && (
          <WeatherWarnings
            outfitItems={outfitItems}
            currentWeather={currentWeather}
            outfitWeather={weather}
          />
        )}
      </CardContent>
    </Card>
  );
}