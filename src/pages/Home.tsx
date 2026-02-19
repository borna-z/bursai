import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useGarmentCount } from '@/hooks/useGarments';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useSubscription } from '@/hooks/useSubscription';
import { useWeather } from '@/hooks/useWeather';
import { PaywallModal } from '@/components/PaywallModal';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { SettingsGroup } from '@/components/settings/SettingsGroup';
import { WeatherWidget } from '@/components/weather/WeatherWidget';
import { useLanguage } from '@/contexts/LanguageContext';

export default function HomePage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: garmentCount } = useGarmentCount();
  const { needsOnboarding } = useOnboarding();
  const { canCreateOutfit } = useSubscription();
  const { weather } = useWeather();
  
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

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

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 10) return t('home.greeting_morning');
    if (hour < 18) return t('home.greeting_afternoon');
    return t('home.greeting_evening');
  }

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
        weather: weather ? {
          temperature: weather.temperature,
          precipitation: weather.precipitation,
          wind: weather.wind,
        } : undefined,
      },
    });
  };

  return (
    <AppLayout>
      <PageHeader title={getGreeting()} actions={null} />

      <div className="px-4 pb-6 pt-2 space-y-5 max-w-lg mx-auto">

        {/* Onboarding nudge */}
        {needsOnboarding && (
          <button
            onClick={() => navigate('/onboarding')}
            className="w-full flex items-center justify-between bg-card rounded-xl px-4 py-3 active:bg-muted/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-accent" />
              </span>
              <span className="text-sm font-medium">{t('home.get_started')}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        )}

        {/* Weather widget */}
        <WeatherWidget />

        {/* Occasion */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
            {t('home.what_today')}
          </h3>
          <SettingsGroup>
            <div className="grid grid-cols-3">
              {occasions.map((occ, i) => (
                <button
                  key={occ.id}
                  onClick={() => setSelectedOccasion(selectedOccasion === occ.id ? null : occ.id)}
                  className={cn(
                    "py-3 text-sm font-medium transition-all text-center relative",
                    selectedOccasion === occ.id
                      ? "text-accent bg-accent/5"
                      : "text-foreground active:bg-muted/60",
                    i % 3 !== 2 && "border-r border-border/50",
                    i < 3 && "border-b border-border/50",
                  )}
                >
                  {occ.label}
                </button>
              ))}
            </div>
          </SettingsGroup>
        </div>

        {/* Style */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
            {t('home.style_optional')}
          </h3>
          <SettingsGroup>
            <div className="grid grid-cols-2">
              {styleVibes.map((style, i) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(selectedStyle === style.id ? null : style.id)}
                  className={cn(
                    "py-3 text-sm font-medium transition-all text-center",
                    selectedStyle === style.id
                      ? "text-accent bg-accent/5"
                      : "text-foreground active:bg-muted/60",
                    i % 2 === 0 && "border-r border-border/50",
                    i < 2 && "border-b border-border/50",
                  )}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </SettingsGroup>
        </div>

        {/* Generate CTA */}
        <Button
          onClick={handleGenerateOutfit}
          disabled={!selectedOccasion || (garmentCount || 0) < 3}
          className="w-full h-14 text-base font-semibold bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl shadow-sm"
          size="lg"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          {t('home.create_outfit')}
        </Button>

        {(garmentCount || 0) < 3 && (
          <p className="text-xs text-center text-muted-foreground">
            {t('home.min_garments')}
          </p>
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
