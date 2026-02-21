import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Sparkles, ChevronRight, BarChart3, TrendingUp, Shirt, Palette, Gem, AlertCircle, Lock, RefreshCw, ChevronDown, Sun, Briefcase, PartyPopper, Heart, Dumbbell, Plane, Trophy } from 'lucide-react';
import { AnimatedPage } from '@/components/ui/animated-page';
import { AnimatedTab } from '@/components/ui/animated-tab';
import { StaggerContainer, StaggerItem } from '@/components/ui/stagger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useGarmentCount } from '@/hooks/useGarments';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useSubscription } from '@/hooks/useSubscription';
import { useWeather } from '@/hooks/useWeather';
import { useInsights, type Garment } from '@/hooks/useInsights';
import { PaywallModal } from '@/components/PaywallModal';
import { AppLayout } from '@/components/layout/AppLayout';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { PageHeader } from '@/components/layout/PageHeader';
import { WeatherWidget } from '@/components/weather/WeatherWidget';
import { AISuggestions } from '@/components/insights/AISuggestions';
import { MiniBar, ColorBar } from '@/components/insights/MiniBar';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { StatGridSkeleton, InsightCardSkeleton } from '@/components/ui/skeletons';
import { useMemo } from 'react';

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

// ─── Compact insight widgets ────────────────────────────────
function InsightsSection({ isPremium, t }: { isPremium: boolean; t: (k: string) => string }) {
  const navigate = useNavigate();
  const { data: insights, isLoading } = useInsights();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <StatGridSkeleton />
        <InsightCardSkeleton />
        <InsightCardSkeleton />
      </div>
    );
  }

  if (!insights || insights.totalGarments === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <BarChart3 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('insights.add_garments')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="bg-muted/20 backdrop-blur-sm">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold tracking-tight">{insights.totalGarments}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t('insights.total')}</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/20 backdrop-blur-sm">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold tracking-tight text-accent">{insights.usageRate}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t('insights.usage')}</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/20 backdrop-blur-sm">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold tracking-tight">{insights.unusedGarments.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t('insights.unused')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Usage bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium">{t('insights.wardrobe_use')}</span>
            </div>
            <span className="text-sm font-semibold text-accent">{insights.usageRate}%</span>
          </div>
          <MiniBar value={insights.usageRate} color={insights.usageRate >= 50 ? 'success' : insights.usageRate >= 25 ? 'primary' : 'warning'} />
          <p className="text-xs text-muted-foreground mt-2">{insights.garmentsUsedLast30Days} {t('insights.of_garments')} {insights.totalGarments} {t('insights.used_30d_suffix')}</p>
        </CardContent>
      </Card>

      {/* Top worn */}
      {insights.topFiveWorn.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> {t('insights.top_garments')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 divide-y divide-border/50">
            {insights.topFiveWorn.slice(0, 3).map((garment, index) => (
              <div key={garment.id} className="flex items-center gap-2 py-2" onClick={() => navigate(`/wardrobe/${garment.id}`)}>
                <span className="w-4 text-center text-xs font-bold text-muted-foreground">{index + 1}</span>
                <LazyImageSimple imagePath={garment.image_path} alt={garment.title} className="w-9 h-9 rounded-lg flex-shrink-0" fallbackIcon={<Shirt className="w-4 h-4 text-muted-foreground/50" />} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{garment.title}</p>
                </div>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{garment.wearCountLast30}×</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Unused garments */}
      {insights.unusedGarments.length > 0 && (
        <Card className={cn(!isPremium && "relative overflow-hidden")}>
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <CardTitle className="text-sm">{t('insights.unused')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className={cn("px-4 pb-3 divide-y divide-border/50", !isPremium && "blur-sm select-none")}>
            {insights.unusedGarments.slice(0, 3).map((garment) => (
              <div key={garment.id} className="flex items-center gap-2 py-2" onClick={() => navigate(`/wardrobe/${garment.id}`)}>
                <LazyImageSimple imagePath={garment.image_path} alt={garment.title} className="w-9 h-9 rounded-lg flex-shrink-0" fallbackIcon={<Shirt className="w-4 h-4 text-muted-foreground/50" />} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{garment.title}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{garment.category}</p>
                </div>
              </div>
            ))}
          </CardContent>
          {!isPremium && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <div className="text-center p-3">
                <Lock className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs font-medium">{t('common.premium')}</p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* AI Suggestions */}
      <AISuggestions isPremium={isPremium} />

      {/* Full insights link */}
      <Button variant="ghost" className="w-full text-sm text-muted-foreground" onClick={() => navigate('/insights')}>
        {t('home.all_insights')} <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}

// ─── Main Home ──────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const { data: garmentCount } = useGarmentCount();
  const { needsOnboarding } = useOnboarding();
  const { canCreateOutfit, isPremium } = useSubscription();
  const { weather } = useWeather();
  const queryClient = useQueryClient();

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['garments-count'] });
    await queryClient.invalidateQueries({ queryKey: ['insights'] });
    await queryClient.invalidateQueries({ queryKey: ['weather'] });
  }, [queryClient]);

  const [activeTab, setActiveTab] = useState<'create' | 'insights'>('create');
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(() => localStorage.getItem('burs_last_occasion'));
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(() => localStorage.getItem('burs_last_style'));
  const [showPaywall, setShowPaywall] = useState(false);

  const activeOccasion = OCCASIONS.find(o => o.id === selectedOccasion);

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 10) return t('home.greeting_morning');
    if (hour < 18) return t('home.greeting_afternoon');
    return t('home.greeting_evening');
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
      <PageHeader title={getGreeting()} actions={null} />
      <PullToRefresh onRefresh={handleRefresh}>
      <AnimatedPage className="px-4 pb-6 pt-2 space-y-5 max-w-lg mx-auto">

        {/* Onboarding nudge */}
        {needsOnboarding && (
          <motion.button
            whileTap={{ scale: 0.975 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.5 }}
            onClick={() => navigate('/onboarding')}
            className="w-full flex items-center justify-between bg-card/70 backdrop-blur-sm rounded-xl px-4 py-3 border border-border/40 transition-colors will-change-transform dark:bg-white/[0.04] dark:border-white/[0.08]"
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

        {/* Tab switcher */}
        <div className="flex bg-foreground/[0.04] backdrop-blur-sm rounded-2xl p-1 gap-1 border border-border/30 dark:bg-white/[0.04] dark:border-white/[0.06]">
          <button
            onClick={() => setActiveTab('create')}
            className={cn(
              "flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200",
              activeTab === 'create'
                ? "bg-background/80 backdrop-blur-md text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-white/[0.1] dark:text-white"
                : "text-muted-foreground"
            )}
          >
            <Sparkles className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
            {t('home.tab_create')}
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={cn(
              "flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200",
              activeTab === 'insights'
                ? "bg-background/80 backdrop-blur-md text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-white/[0.1] dark:text-white"
                : "text-muted-foreground"
            )}
          >
            <BarChart3 className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
            {t('home.tab_insights')}
          </button>
        </div>

        {/* ── CREATE TAB ── */}
        <AnimatedTab tabKey={activeTab}>
        {activeTab === 'create' && (
          <div className="space-y-5">
            <WeatherWidget />

            {weather && weather.temperature <= 10 && (
              <p className="text-xs text-muted-foreground text-center -mt-2">
                {t('home.cold_hint')}
              </p>
            )}

            {/* Occasions */}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('home.what_today')}</p>
              <StaggerContainer className="grid grid-cols-3 gap-2" stagger={0.04}>
                {OCCASIONS.map((occ) => (
                  <StaggerItem key={occ.id}>
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.5 }}
                    onClick={() => handleSelectOccasion(occ.id)}
                    className={cn(
                      "w-full flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-sm font-medium transition-colors border will-change-transform",
                      selectedOccasion === occ.id
                        ? "border-accent bg-accent/5 text-accent"
                        : "border-border/40 bg-card/70 backdrop-blur-sm text-foreground dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/70"
                    )}
                  >
                    <occ.icon className="w-5 h-5" />
                    <span className="text-xs">{t(occ.labelKey)}</span>
                  </motion.button>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>

            {/* Sub-options */}
            {activeOccasion?.subOptions && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('home.specify')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeOccasion.subOptions.map((sub) => (
                    <motion.button
                      key={sub.id}
                      whileTap={{ scale: 0.93 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.5 }}
                      onClick={() => setSelectedSub(selectedSub === sub.id ? null : sub.id)}
                      className={cn(
                        "px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors border will-change-transform",
                        selectedSub === sub.id
                          ? "border-accent bg-accent/10 text-accent"
                        : "border-border/40 bg-card/70 backdrop-blur-sm text-foreground dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/70"
                      )}
                    >
                      {t(sub.labelKey)}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Styles */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('home.style_optional')}</p>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
                {STYLES.map((style) => (
                  <motion.button
                    key={style.id}
                    whileTap={{ scale: 0.93 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.5 }}
                    onClick={() => setSelectedStyle(selectedStyle === style.id ? null : style.id)}
                    className={cn(
                      "px-4 py-2 rounded-full text-xs font-medium transition-colors border whitespace-nowrap flex-shrink-0 will-change-transform",
                      selectedStyle === style.id
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border/40 bg-card/70 backdrop-blur-sm text-foreground dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/70"
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
              className="w-full h-14 text-base font-semibold rounded-full shadow-sm dark:bg-white dark:text-[#030305] dark:hover:bg-white/90"
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
        )}

        {/* ── INSIGHTS TAB ── */}
        {activeTab === 'insights' && (
          <div>
            <InsightsSection isPremium={isPremium} t={t} />
          </div>
        )}
        </AnimatedTab>
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
