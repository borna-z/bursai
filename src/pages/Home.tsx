import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Sun, Snowflake, Droplets, ArrowRight, Loader2, MapPin, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Chip } from '@/components/ui/chip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useGarmentCount } from '@/hooks/useGarments';
import { useOutfits } from '@/hooks/useOutfits';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useSubscription } from '@/hooks/useSubscription';
import { useWeather } from '@/hooks/useWeather';
import { PaywallModal } from '@/components/PaywallModal';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';

import { useLanguage } from '@/contexts/LanguageContext';

export default function HomePage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: garmentCount } = useGarmentCount();
  const { data: outfits, isLoading: outfitsLoading } = useOutfits();
  const { needsOnboarding, state, progress } = useOnboarding();
  const { canCreateOutfit } = useSubscription();
  const { weather, isLoading: weatherLoading, error: weatherError, refetch: refetchWeather } = useWeather();
  
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [temperature, setTemperature] = useState('');
  const [precipitation, setPrecipitation] = useState('none');
  const [wind, setWind] = useState('low');
  const [showPaywall, setShowPaywall] = useState(false);
  const [useAutoWeather, setUseAutoWeather] = useState(true);

  const occasions = [
    { id: 'vardag', label: t('home.occasion.vardag') },
    { id: 'jobb', label: t('home.occasion.jobb') },
    { id: 'fest', label: t('home.occasion.fest') },
    { id: 'dejt', label: t('home.occasion.dejt') },
    { id: 'traning', label: t('home.occasion.traning') },
    { id: 'resa', label: t('home.occasion.resa') },
  ];

  const styleVibes = [
    { id: 'minimal', label: t('home.style.minimal') },
    { id: 'street', label: t('home.style.street') },
    { id: 'smart-casual', label: t('home.style.smart_casual') },
    { id: 'klassisk', label: t('home.style.klassisk') },
  ];

  const precipitationOptions = [
    { id: 'none', label: t('home.weather.none'), icon: Sun },
    { id: 'rain', label: t('home.weather.rain'), icon: Droplets },
    { id: 'snow', label: t('home.weather.snow'), icon: Snowflake },
  ];

  const windOptions = [
    { id: 'low', label: t('home.wind.low') },
    { id: 'medium', label: t('home.wind.medium') },
    { id: 'high', label: t('home.wind.high') },
  ];

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 10) return t('home.greeting_morning');
    if (hour < 18) return t('home.greeting_afternoon');
    return t('home.greeting_evening');
  }

  const lastOutfit = outfits?.[0];

  // Sync auto weather data
  useEffect(() => {
    if (weather && useAutoWeather) {
      setTemperature(weather.temperature.toString());
      setPrecipitation(weather.precipitation);
      setWind(weather.wind);
    }
  }, [weather, useAutoWeather]);

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
      <PageHeader 
        title={`${getGreeting()} 👋`}
        actions={null}
      />
      
      <div className="p-4 space-y-6">
        {/* Onboarding Banner */}
        {needsOnboarding && (
          <Card 
            className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20 cursor-pointer hover:shadow-md transition-all"
            onClick={() => navigate('/onboarding')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold">{t('home.get_started')}</span>
                <ArrowRight className="w-4 h-4 text-primary" />
              </div>
              <Progress value={onboardingProgress} className="h-1.5 mb-2" />
              <p className="text-sm text-muted-foreground">
                {!state.step1Done 
                  ? `${t('home.add_more')} ${Math.max(0, 5 - progress.garmentCount)} ${t('home.garments_more')}`
                  : !state.step2Done 
                  ? t('home.create_first')
                  : t('home.finish_intro')}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Wardrobe Stats */}
        {!needsOnboarding && (
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-1">{t('home.your_wardrobe')}</p>
              <p className="text-3xl font-bold">
                {garmentCount || 0}
                <span className="text-base font-normal text-muted-foreground ml-2">{t('home.garments_count')}</span>
              </p>
              {(garmentCount || 0) < 5 && (
                <p className="text-sm text-muted-foreground mt-2">
                  {t('home.add_more')}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Occasion Selection */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">{t('home.what_today')}</Label>
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{t('home.weather_title')}</CardTitle>
                <CardDescription>{t('home.weather_help')}</CardDescription>
              </div>
              {weather && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={refetchWeather}
                  disabled={weatherLoading}
                >
                  <RefreshCw className={cn("w-4 h-4", weatherLoading && "animate-spin")} />
                </Button>
              )}
            </div>
            
            {weatherLoading ? (
              <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('home.fetching_weather')}</span>
              </div>
            ) : weather ? (
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="secondary" className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" />
                  {weather.location}
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  {weather.temperature}°C · {weather.condition}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2 ml-auto"
                  onClick={() => setUseAutoWeather(!useAutoWeather)}
                >
                  {useAutoWeather ? t('home.edit_weather') : t('home.use_auto')}
                </Button>
              </div>
            ) : weatherError ? (
              <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                <span>{weatherError}</span>
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={refetchWeather}>
                  {t('home.try_again')}
                </Button>
              </div>
            ) : null}
          </CardHeader>
          
          {(!useAutoWeather || !weather) && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">{t('home.temperature')}</Label>
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
                <Label className="text-sm">{t('home.precipitation')}</Label>
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
                <Label className="text-sm">{t('home.wind')}</Label>
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
          )}
        </Card>

        {/* Style Selection */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">{t('home.style_optional')}</Label>
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
          {t('home.create_outfit')}
        </Button>

        {(garmentCount || 0) < 3 && (
          <p className="text-sm text-center text-muted-foreground">
            {t('home.min_garments')}
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
              <p className="text-sm font-medium text-muted-foreground mb-3">{t('home.latest_outfit')}</p>
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
