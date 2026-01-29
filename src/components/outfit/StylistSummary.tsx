import { 
  Briefcase, 
  Coffee, 
  PartyPopper, 
  Plane, 
  Dumbbell,
  Heart,
  Thermometer,
  ThermometerSnowflake,
  ThermometerSun
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface StylistSummaryProps {
  occasion: string;
  styleVibe?: string | null;
  weather?: { temp?: number; condition?: string } | null;
  explanation?: string | null;
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
  explanation,
  isLoading 
}: StylistSummaryProps) {
  const OccasionIcon = occasionIcons[occasion.toLowerCase()] || Coffee;
  const TempIcon = getTemperatureIcon(weather?.temp);
  
  const summary = explanation || generateSummary(occasion, styleVibe, weather?.temp);
  
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
    <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/10 overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <OccasionIcon className="w-5 h-5 text-primary" />
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
        </div>
      </CardContent>
    </Card>
  );
}
