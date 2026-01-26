import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Sun, Snowflake, Droplets, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Chip } from '@/components/ui/chip';
import { cn } from '@/lib/utils';
import { useGarmentCount } from '@/hooks/useGarments';
import { useOutfits } from '@/hooks/useOutfits';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PaywallModal';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';

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
  const { data: outfits, isLoading: outfitsLoading } = useOutfits();
  const { needsOnboarding, state, progress } = useOnboarding();
  const { canCreateOutfit } = useSubscription();
  
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [temperature, setTemperature] = useState('');
  const [precipitation, setPrecipitation] = useState('none');
  const [wind, setWind] = useState('low');
  const [showPaywall, setShowPaywall] = useState(false);

  const lastOutfit = outfits?.[0];

  const handleGenerateOutfit = () => {
    if (!selectedOccasion) return;
    
    if (!canCreateOutfit()) {
      setShowPaywall(true);
      return;
    }
    
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

  const onboardingProgress = 
    (state.step1Done ? 33 : (Math.min(progress.garmentCount, 5) / 5) * 33) +
    (state.step2Done ? 33 : 0) +
    (state.step3Done ? 34 : 0);

  return (
    <AppLayout>
      <PageHeader title={`${getGreeting()} 👋`} />
      
      <div className="p-4 space-y-6">
        {/* Onboarding Banner */}
        {needsOnboarding && (
          <Card 
            className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20 cursor-pointer hover:shadow-md transition-all"
            onClick={() => navigate('/onboarding')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold">Kom igång</span>
                <ArrowRight className="w-4 h-4 text-primary" />
              </div>
              <Progress value={onboardingProgress} className="h-1.5 mb-2" />
              <p className="text-sm text-muted-foreground">
                {!state.step1Done 
                  ? `Lägg till ${Math.max(0, 5 - progress.garmentCount)} plagg till`
                  : !state.step2Done 
                  ? 'Skapa din första outfit'
                  : 'Slutför introduktionen'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Wardrobe Stats */}
        {!needsOnboarding && (
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-1">Din garderob</p>
              <p className="text-3xl font-bold">
                {garmentCount || 0}
                <span className="text-base font-normal text-muted-foreground ml-2">plagg</span>
              </p>
              {(garmentCount || 0) < 5 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Lägg till fler plagg för bättre outfits!
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Occasion Selection */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Vad ska du göra idag?</Label>
          <div className="flex flex-wrap gap-2">
            {occasions.map((occasion) => (
              <Chip
                key={occasion.id}
                selected={selectedOccasion === occasion.id}
                onClick={() => setSelectedOccasion(occasion.id)}
                size="lg"
              >
                {occasion.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* Weather Inputs */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Väder</CardTitle>
            <CardDescription>Hjälper AI:n välja rätt plagg</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Temperatur</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="20"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  className="w-20"
                />
                <span className="text-muted-foreground">°C</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm">Nederbörd</Label>
              <div className="flex gap-2">
                {precipitationOptions.map((option) => (
                  <Button
                    key={option.id}
                    variant={precipitation === option.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPrecipitation(option.id)}
                    className="flex-1"
                  >
                    <option.icon className="w-4 h-4 mr-1.5" />
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Vind</Label>
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
          <Label className="text-base font-semibold">Stil (valfritt)</Label>
          <div className="flex flex-wrap gap-2">
            {styleVibes.map((style) => (
              <Chip
                key={style.id}
                selected={selectedStyle === style.id}
                onClick={() => setSelectedStyle(selectedStyle === style.id ? null : style.id)}
                size="lg"
              >
                {style.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerateOutfit}
          disabled={!selectedOccasion || (garmentCount || 0) < 3}
          className="w-full h-14 text-base font-semibold shadow-lg"
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
        {outfitsLoading ? (
          <Card className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded w-24 mb-3" />
              <div className="flex gap-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-16 h-16 rounded-lg bg-muted" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : lastOutfit && (
          <Card 
            className="cursor-pointer hover:shadow-md transition-all"
            onClick={() => navigate(`/outfits/${lastOutfit.id}`)}
          >
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted-foreground mb-3">Senaste outfit</p>
              <div className="flex gap-2">
                {lastOutfit.outfit_items.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex items-center justify-center"
                  >
                    <span className="text-xs text-muted-foreground capitalize">{item.slot}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-3 capitalize">{lastOutfit.occasion}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        reason="outfits"
      />
    </AppLayout>
  );
}
