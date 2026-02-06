import { useState } from 'react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Sparkles, Loader2, Thermometer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Chip } from '@/components/ui/chip';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useWeather } from '@/hooks/useWeather';
import { useProfile } from '@/hooks/useProfile';
import { useForecast } from '@/hooks/useForecast';

const OCCASIONS = [
  { id: 'vardag', label: 'Vardag' },
  { id: 'jobb', label: 'Jobb' },
  { id: 'fest', label: 'Fest' },
  { id: 'dejt', label: 'Dejt' },
  { id: 'traning', label: 'Träning' },
  { id: 'resa', label: 'Resa' },
];

const STYLE_VIBES = [
  { id: 'minimal', label: 'Minimal' },
  { id: 'street', label: 'Street' },
  { id: 'smart-casual', label: 'Smart Casual' },
  { id: 'klassisk', label: 'Klassisk' },
  { id: 'sportig', label: 'Sportig' },
  { id: 'romantisk', label: 'Romantisk' },
];

interface QuickGenerateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  onGenerate: (request: {
    occasion: string;
    style: string | null;
    temperature: number | undefined;
  }) => void;
  isGenerating: boolean;
}

export function QuickGenerateSheet({
  open,
  onOpenChange,
  date,
  onGenerate,
  isGenerating,
}: QuickGenerateSheetProps) {
  const { data: profile } = useProfile();
  const { weather } = useWeather();
  const { getForecastForDate } = useForecast({ homeCity: profile?.home_city });
  
  const [occasion, setOccasion] = useState('vardag');
  const [styleVibe, setStyleVibe] = useState<string | null>(null);
  const [useAutoWeather, setUseAutoWeather] = useState(true);
  const [customTemp, setCustomTemp] = useState('');

  const dateStr = format(date, 'yyyy-MM-dd');
  const forecast = getForecastForDate(dateStr);
  
  // Use forecast for future dates, current weather for today
  const autoTemp = forecast 
    ? Math.round((forecast.temperature_max + forecast.temperature_min) / 2)
    : weather?.temperature;

  const handleGenerate = () => {
    const temp = useAutoWeather ? autoTemp : parseInt(customTemp) || undefined;
    onGenerate({
      occasion,
      style: styleVibe,
      temperature: temp,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[85vh] rounded-t-2xl">
        <SheetHeader className="text-left pb-4">
          <SheetTitle>
            Skapa outfit för {format(date, 'd MMMM', { locale: sv })}
          </SheetTitle>
          <SheetDescription>
            Välj tillfälle och stil så skapar vi en outfit
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          {/* Occasion */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Tillfälle</Label>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((o) => (
                <Chip
                  key={o.id}
                  selected={occasion === o.id}
                  onClick={() => setOccasion(o.id)}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Style vibe */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Stil (valfritt)</Label>
            <div className="flex flex-wrap gap-2">
              {STYLE_VIBES.map((s) => (
                <Chip
                  key={s.id}
                  selected={styleVibe === s.id}
                  onClick={() => setStyleVibe(styleVibe === s.id ? null : s.id)}
                >
                  {s.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Weather */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Väder</Label>
            <div className="flex gap-2">
              <Chip
                selected={useAutoWeather}
                onClick={() => setUseAutoWeather(true)}
                className="flex-1 justify-center"
              >
                <Thermometer className="w-3.5 h-3.5 mr-1.5" />
                {autoTemp !== undefined ? `${autoTemp}°C` : 'Auto'}
              </Chip>
              <Chip
                selected={!useAutoWeather}
                onClick={() => setUseAutoWeather(false)}
                className="flex-1 justify-center"
              >
                Ange själv
              </Chip>
            </div>
            {!useAutoWeather && (
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="number"
                  placeholder="Temperatur"
                  value={customTemp}
                  onChange={(e) => setCustomTemp(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">°C</span>
              </div>
            )}
          </div>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full active:animate-press"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Skapar...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generera outfit
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
