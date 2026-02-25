import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { TAP_TRANSITION } from '@/lib/motion';
import {
  Sparkles, ChevronRight,
  Sun, Briefcase, PartyPopper, Heart, Dumbbell, Plane,
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { AnimatedPage } from '@/components/ui/animated-page';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useGarmentCount } from '@/hooks/useGarments';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useSubscription } from '@/hooks/useSubscription';
import { useWeather } from '@/hooks/useWeather';
import { useInsights } from '@/hooks/useInsights';
import { PaywallModal } from '@/components/PaywallModal';
import { AppLayout } from '@/components/layout/AppLayout';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { WeatherPill } from '@/components/weather/WeatherPill';
import { AISuggestions } from '@/components/insights/AISuggestions';
import { useLanguage } from '@/contexts/LanguageContext';
import { SectionHeader } from '@/components/ui/section-header';

// ─── Occasion + sub-option config ────────────────────────────
interface OccasionOption {
  id: string;
  labelKey: string;
  icon: React.ElementType;
  subOptions?: { id: string; labelKey: string }[];
}

const OCCASIONS: OccasionOption[] = [
  { id: 'vardag', labelKey: 'home.occasion.vardag', icon: Sun },
  { id: 'jobb', labelKey: 'home.occasion.jobb', icon: Briefcase, subOptions: [
    { id: 'kontor', labelKey: 'home.sub.kontor' },
    { id: 'kreativt', labelKey: 'home.sub.kreativt' },
    { id: 'möte', labelKey: 'home.sub.möte' },
  ]},
  { id: 'fest', labelKey: 'home.occasion.fest', icon: PartyPopper, subOptions: [
    { id: 'middag', labelKey: 'home.sub.middag' },
    { id: 'klubb', labelKey: 'home.sub.klubb' },
    { id: 'release', labelKey: 'home.sub.release' },
    { id: 'bröllop', labelKey: 'home.sub.bröllop' },
  ]},
  { id: 'dejt', labelKey: 'home.occasion.dejt', icon: Heart, subOptions: [
    { id: 'casual-dejt', labelKey: 'home.sub.casual_dejt' },
    { id: 'fin-dejt', labelKey: 'home.sub.fin_dejt' },
  ]},
  { id: 'traning', labelKey: 'home.occasion.traning', icon: Dumbbell, subOptions: [
    { id: 'gym', labelKey: 'home.sub.gym' },
    { id: 'löpning', labelKey: 'home.sub.löpning' },
    { id: 'yoga', labelKey: 'home.sub.yoga' },
    { id: 'outdoor', labelKey: 'home.sub.outdoor' },
  ]},
  { id: 'resa', labelKey: 'home.occasion.resa', icon: Plane, subOptions: [
    { id: 'flyg', labelKey: 'home.sub.flyg' },
    { id: 'semester', labelKey: 'home.sub.semester' },
    { id: 'weekend', labelKey: 'home.sub.weekend' },
  ]},
];

const STYLES = [
  { id: 'minimal', labelKey: 'home.style.minimal' },
  { id: 'street', labelKey: 'home.style.street' },
  { id: 'smart-casual', labelKey: 'home.style.smart_casual' },
  { id: 'klassisk', labelKey: 'home.style.klassisk' },
  { id: 'sportig', labelKey: 'home.style.sportig' },
  { id: 'bohemisk', labelKey: 'home.style.bohemisk' },
  { id: 'preppy', labelKey: 'home.style.preppy' },
  { id: 'scandi', labelKey: 'home.style.scandi' },
  { id: 'glamorös', labelKey: 'home.style.glamorös' },
  { id: 'avslappnad', labelKey: 'home.style.avslappnad' },
];

// ─── Main Home ──────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const { data: garmentCount } = useGarmentCount();
  const { needsOnboarding } = useOnboarding();
  const { canCreateOutfit, isPremium } = useSubscription();
  const { weather } = useWeather();
  const { data: profile } = useProfile();
  const { data: insights } = useInsights();
  const queryClient = useQueryClient();

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['garments-count'] });
    await queryClient.invalidateQueries({ queryKey: ['insights'] });
    await queryClient.invalidateQueries({ queryKey: ['weather'] });
  }, [queryClient]);

  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(() => localStorage.getItem('burs_last_occasion'));
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(() => localStorage.getItem('burs_last_style'));
  const [showPaywall, setShowPaywall] = useState(false);

  const activeOccasion = OCCASIONS.find(o => o.id === selectedOccasion);

  function getGreeting() {
    const hour = new Date().getHours();
    const firstName = profile?.display_name?.split(' ')[0];
    const suffix = firstName ? `, ${firstName}` : '';
    if (hour < 10) return t('home.greeting_morning') + suffix;
    if (hour < 18) return t('home.greeting_afternoon') + suffix;
    return t('home.greeting_evening') + suffix;
  }

  const handleSelectOccasion = (id: string) => {
    if (selectedOccasion === id) {
      setSelectedOccasion(null);
      setSelectedSub(null);
    } else {
      setSelectedOccasion(id);
      setSelectedSub(null);
    }
  };

  const handleGenerateOutfit = () => {
    if (!selectedOccasion) return;
    if (!canCreateOutfit()) {
      setShowPaywall(true);
      return;
    }
    const occasionLabel = selectedSub || selectedOccasion;
    localStorage.setItem('burs_last_occasion', selectedOccasion);
    if (selectedStyle) localStorage.setItem('burs_last_style', selectedStyle);
    navigate('/outfits/generate', {
      state: {
        occasion: occasionLabel,
        style: selectedStyle,
        locale,
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
      <PullToRefresh onRefresh={handleRefresh}>
      <AnimatedPage className="px-4 pb-8 pt-6 space-y-6 max-w-lg mx-auto">

        {/* ── 1. Greeting + Weather Pill ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex items-center justify-between overflow-visible"
        >
          <h1 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "'Sora', sans-serif" }}>
            {getGreeting()}
          </h1>
          <WeatherPill />
        </motion.div>

        {/* Onboarding nudge */}
        {needsOnboarding && (
          <motion.button
            whileTap={{ scale: 0.975 }}
            transition={TAP_TRANSITION}
            onClick={() => navigate('/onboarding')}
            className="w-full flex items-center justify-between rounded-xl px-4 py-3 bg-foreground/[0.03] transition-colors will-change-transform"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-accent" />
              </span>
              <span className="text-sm font-medium">{t('home.get_started')}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </motion.button>
        )}

        {/* ── 2. Outfit Builder Card ── */}
        <div className="rounded-2xl bg-foreground/[0.02] border border-border/30 p-4 space-y-4">
          {/* Occasion */}
          <div className="space-y-2.5">
            <SectionHeader title={t('home.what_today')} />
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              {OCCASIONS.map((occ) => (
                <motion.button
                  key={occ.id}
                  whileTap={{ scale: 0.94 }}
                  transition={TAP_TRANSITION}
                  onClick={() => handleSelectOccasion(occ.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 will-change-transform",
                    selectedOccasion === occ.id
                      ? "bg-accent/[0.08] text-accent ring-1 ring-accent/30"
                      : "bg-foreground/[0.04] text-foreground"
                  )}
                >
                  <occ.icon className="w-4 h-4" />
                  <span className="text-xs">{t(occ.labelKey)}</span>
                </motion.button>
              ))}
            </div>

            {/* Sub-options row */}
            {activeOccasion?.subOptions && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                {activeOccasion.subOptions.map((sub) => (
                  <motion.button
                    key={sub.id}
                    whileTap={{ scale: 0.93 }}
                    transition={TAP_TRANSITION}
                    onClick={() => setSelectedSub(selectedSub === sub.id ? null : sub.id)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 will-change-transform",
                      selectedSub === sub.id
                        ? "bg-accent/10 text-accent"
                        : "bg-foreground/[0.04] text-foreground"
                    )}
                  >
                    {t(sub.labelKey)}
                  </motion.button>
                ))}
              </div>
            )}
          </div>

          {/* Style */}
          <div className="space-y-2.5">
            <SectionHeader title={t('home.style_optional')} />
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              {STYLES.map((style) => (
                <motion.button
                  key={style.id}
                  whileTap={{ scale: 0.93 }}
                  transition={TAP_TRANSITION}
                  onClick={() => setSelectedStyle(selectedStyle === style.id ? null : style.id)}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 will-change-transform",
                    selectedStyle === style.id
                      ? "bg-accent/10 text-accent"
                      : "bg-foreground/[0.04] text-foreground"
                  )}
                >
                  {t(style.labelKey)}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Generate CTA */}
          <Button
            onClick={handleGenerateOutfit}
            disabled={!selectedOccasion || (garmentCount || 0) < 3}
            className="w-full h-12 text-base font-semibold bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl"
            size="lg"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            {selectedOccasion ? t('home.create_outfit') : t('home.select_occasion_hint')}
          </Button>

          {(garmentCount || 0) < 3 && (
            <p className="text-xs text-center text-muted-foreground">
              {t('home.min_garments')}
            </p>
          )}
        </div>

        {/* Cold weather hint */}
        {weather && weather.temperature <= 10 && (
          <p className="text-xs text-muted-foreground">
            ❄️ {t('home.cold_hint')}
          </p>
        )}

        {/* ── 4. Quick Stats Strip ── */}
        {insights && insights.totalGarments > 0 && (
          <button
            onClick={() => navigate('/insights')}
            className="w-full flex items-center justify-between px-2 py-4 border-t border-b border-border/20"
          >
            <div className="flex-1 text-center">
              <p className="text-xl font-bold tracking-tight tabular-nums">{insights.totalGarments}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t('insights.total')}</p>
            </div>
            <div className="w-px h-8 bg-border/30" />
            <div className="flex-1 text-center">
              <p className="text-xl font-bold tracking-tight tabular-nums">{insights.usageRate}%</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t('insights.usage')}</p>
            </div>
            <div className="w-px h-8 bg-border/30" />
            <div className="flex-1 text-center">
              <p className="text-xl font-bold tracking-tight tabular-nums">{insights.unusedGarments.length}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t('insights.unused')}</p>
            </div>
          </button>
        )}

        {/* ── 5. AI Suggestion ── */}
        <AISuggestions isPremium={isPremium} />


      </AnimatedPage>
      </PullToRefresh>

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        reason="outfits"
      />
    </AppLayout>
  );
}
