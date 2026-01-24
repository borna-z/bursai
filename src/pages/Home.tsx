import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Sparkles, Sun, Cloud, Wind, Snowflake, Droplets } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useGarmentCount } from '@/hooks/useGarments';
import { useOutfits } from '@/hooks/useOutfits';
import { AppLayout } from '@/components/layout/AppLayout';

const occasions = [
  { id: 'vardag', label: 'Vardag' },
  { id: 'jobb', label: 'Jobb' },
  { id: 'fest', label: 'Fest' },
  { id: 'dejt', label: 'Dejt' },
  { id: 'traning', label: 'Träning' },
  { id: 'resa', label: 'Resa' },
];

const styleVibes = [
  { id: 'minimal', label: 'Minimal' },
  { id: 'street', label: 'Street' },
  { id: 'smart-casual', label: 'Smart casual' },
  { id: 'klassisk', label: 'Klassisk' },
];

const precipitationOptions = [
  { id: 'none', label: 'Ingen', icon: Sun },
  { id: 'rain', label: 'Regn', icon: Droplets },
  { id: 'snow', label: 'Snö', icon: Snowflake },
];

const windOptions = [
  { id: 'low', label: 'Låg' },
  { id: 'medium', label: 'Medel' },
  { id: 'high', label: 'Hög' },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 10) return 'God morgon';
  if (hour < 18) return 'God dag';
  return 'God kväll';
}

export default function HomePage() {
  const navigate = useNavigate();
  const { data: garmentCount } = useGarmentCount();
  const { data: outfits } = useOutfits();
  
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [temperature, setTemperature] = useState('');
  const [precipitation, setPrecipitation] = useState('none');
  const [wind, setWind] = useState('low');

  const lastOutfit = outfits?.[0];

  const handleGenerateOutfit = () => {
    if (!selectedOccasion) return;
    // TODO: Navigate to outfit generation with params
    navigate('/outfits/generate', {
      state: {
        occasion: selectedOccasion,
        style: selectedStyle,
        weather: {
          temperature: temperature ? parseInt(temperature) : undefined,
          precipitation,
          wind,
        },
      },
    });
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{getGreeting()} 👋</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/settings')}
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        {/* Wardrobe Progress */}
        <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-0">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Din garderob</p>
            <p className="text-2xl font-bold">
              {garmentCount || 0} <span className="text-base font-normal text-muted-foreground">plagg</span>
            </p>
            {(garmentCount || 0) < 5 && (
              <p className="text-sm text-muted-foreground mt-1">
                Lägg till fler plagg för bättre outfits!
              </p>
            )}
          </CardContent>
        </Card>

        {/* Occasion Selection */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Vad ska du göra idag?</Label>
          <div className="flex flex-wrap gap-2">
            {occasions.map((occasion) => (
              <Badge
                key={occasion.id}
                variant={selectedOccasion === occasion.id ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer px-4 py-2 text-sm transition-all',
                  selectedOccasion === occasion.id && 'ring-2 ring-primary ring-offset-2'
                )}
                onClick={() => setSelectedOccasion(occasion.id)}
              >
                {occasion.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Weather Inputs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Väder</CardTitle>
            <CardDescription>Hjälper AI:n välja rätt plagg</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Temperatur</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="20"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  className="w-24"
                />
                <span className="text-muted-foreground">°C</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Nederbörd</Label>
              <div className="flex gap-2">
                {precipitationOptions.map((option) => (
                  <Button
                    key={option.id}
                    variant={precipitation === option.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPrecipitation(option.id)}
                    className="flex-1"
                  >
                    <option.icon className="w-4 h-4 mr-1" />
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Vind</Label>
              <div className="flex gap-2">
                {windOptions.map((option) => (
                  <Button
                    key={option.id}
                    variant={wind === option.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setWind(option.id)}
                    className="flex-1"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Style Selection */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Stil (valfritt)</Label>
          <div className="flex flex-wrap gap-2">
            {styleVibes.map((style) => (
              <Badge
                key={style.id}
                variant={selectedStyle === style.id ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer px-4 py-2 text-sm transition-all',
                  selectedStyle === style.id && 'ring-2 ring-primary ring-offset-2'
                )}
                onClick={() => setSelectedStyle(selectedStyle === style.id ? null : style.id)}
              >
                {style.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerateOutfit}
          disabled={!selectedOccasion || (garmentCount || 0) < 3}
          className="w-full h-14 text-lg"
          size="lg"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Skapa outfit
        </Button>

        {(garmentCount || 0) < 3 && (
          <p className="text-sm text-center text-muted-foreground">
            Lägg till minst 3 plagg för att generera outfits
          </p>
        )}

        {/* Last Outfit Preview */}
        {lastOutfit && (
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(`/outfits/${lastOutfit.id}`)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Senaste outfit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {lastOutfit.outfit_items.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="w-16 h-16 rounded-lg bg-secondary overflow-hidden"
                  >
                    {/* TODO: Add garment image */}
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                      {item.slot}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2 capitalize">
                {lastOutfit.occasion}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
