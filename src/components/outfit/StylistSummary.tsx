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

const occasionLabels: Record<string, string> = {
  jobb: 'Jobb',
  vardag: 'Vardag',
  fest: 'Fest',
  resa: 'Resa',
  träning: 'Träning',
  dejt: 'Dejt',
};

function getTemperatureIcon(temp?: number) {
  if (temp === undefined) return null;
  if (temp <= 5) return ThermometerSnowflake;
  if (temp >= 20) return ThermometerSun;
  return Thermometer;
}

function generateSummary(occasion: string, styleVibe?: string | null, temp?: number): string {
  const greetings = ['Perfekt valt!', 'Stilrent!', 'Snyggt matchat!', 'Bra kombo!'];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];
  
  let summary = greeting;
  
  if (occasion === 'jobb') {
    summary += ' En proffsig look som funkar hela dagen.';
  } else if (occasion === 'vardag') {
    summary += ' Avslappnat men snyggt – perfekt för en vanlig dag.';
  } else if (occasion === 'fest') {
    summary += ' Du kommer sticka ut på bästa sätt.';
  } else if (occasion === 'dejt') {
    summary += ' En look som utstrålar självförtroende.';
  } else if (occasion === 'resa') {
    summary += ' Bekvämt och stilfullt för resan.';
  } else if (occasion === 'träning') {
    summary += ' Redo att prestera!';
  } else {
    summary += ' En balanserad outfit för tillfället.';
  }
  
  if (temp !== undefined) {
    if (temp <= 5) {
      summary += ' Klätt för kylan!';
    } else if (temp >= 25) {
      summary += ' Luftigt för värmen.';
    }
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
  const OccasionIcon = occasionIcons[occasion.toLowerCase()] || Coffee;
  const TempIcon = getTemperatureIcon(weather?.temp);
  
  const summary = explanation || generateSummary(occasion, styleVibe, weather?.temp);
  
  // Analyze weather warnings
  const warnings = outfitItems.length > 0 
    ? analyzeOutfitWeather(outfitItems, currentWeather, weather)
    : [];
  
  const hasWarnings = warnings.length > 0;
  const hasCriticalWarnings = warnings.some(w => w.type === 'warning');
  
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
            <h3 className="font-semibold text-sm">Stylistens sammanfattning</h3>
            <p className="text-sm text-muted-foreground mt-1">{summary}</p>
          </div>
        </div>
        
        {/* Pill row */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="capitalize">
            {occasionLabels[occasion.toLowerCase()] || occasion}
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
              Passar vädret
            </Badge>
          )}
        </div>
        
        {/* Weather warnings */}
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

// Helper for cn in this file
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
