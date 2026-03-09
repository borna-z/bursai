import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { AnimatedPage } from '@/components/ui/animated-page';
import { useGarmentCount } from '@/hooks/useGarments';
import { useWeather } from '@/hooks/useWeather';
import { AppLayout } from '@/components/layout/AppLayout';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { WeatherPill } from '@/components/weather/WeatherPill';
import { useLanguage } from '@/contexts/LanguageContext';

import { lazy, Suspense } from 'react';
import { TodayOutfitCard } from '@/components/home/TodayOutfitCard';

// Below-fold components – lazy loaded to speed up cold start
const SwipeSuggestions = lazy(() => import('@/components/home/SwipeSuggestions').then(m => ({ default: m.SwipeSuggestions })));
const AdjustDaySection = lazy(() => import('@/components/home/AdjustDaySection').then(m => ({ default: m.AdjustDaySection })));
const SmartInsightCard = lazy(() => import('@/components/home/SmartInsightCard').then(m => ({ default: m.SmartInsightCard })));
const InsightsBanner = lazy(() => import('@/components/home/InsightsBanner').then(m => ({ default: m.InsightsBanner })));
const PlanTomorrowCard = lazy(() => import('@/components/home/PlanTomorrowCard').then(m => ({ default: m.PlanTomorrowCard })));
const PredictiveStylingBanner = lazy(() => import('@/components/home/PredictiveStylingBanner').then(m => ({ default: m.PredictiveStylingBanner })));

export default function HomePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { data: garmentCount } = useGarmentCount();
  const { weather } = useWeather();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  const [occasion, setOccasion] = useState<string>(
    () => localStorage.getItem('burs_last_occasion') || 'vardag'
  );
  const [style, setStyle] = useState<string | null>(
    () => localStorage.getItem('burs_last_style') || null
  );

  // Force re-key the outfit card on "Update outfit"
  const [outfitKey, setOutfitKey] = useState(0);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['garments-count'] }),
      queryClient.invalidateQueries({ queryKey: ['insights'] }),
      queryClient.invalidateQueries({ queryKey: ['weather'] }),
      queryClient.invalidateQueries({ queryKey: ['outfits'] }),
    ]);
  }, [queryClient]);

  function getGreeting() {
    const hour = new Date().getHours();
    const firstName = profile?.display_name?.split(' ')[0];
    const suffix = firstName ? `, ${firstName}` : '';
    if (hour < 10) return t('home.greeting_morning') + suffix;
    if (hour < 18) return t('home.greeting_afternoon') + suffix;
    return t('home.greeting_evening') + suffix;
  }

  const handleOccasionChange = (id: string) => {
    setOccasion(id);
    localStorage.setItem('burs_last_occasion', id);
  };

  const handleStyleChange = (id: string | null) => {
    setStyle(id);
    if (id) localStorage.setItem('burs_last_style', id);
    else localStorage.removeItem('burs_last_style');
  };

  const handleUpdateOutfit = () => {
    setOutfitKey((k) => k + 1);
  };

  const handleUseUnused = () => {
    // Generate with 'vardag' occasion – the edge function will prioritize unused items
    setOccasion('vardag');
    setOutfitKey((k) => k + 1);
  };

  const weatherData = weather
    ? { temperature: weather.temperature, precipitation: weather.precipitation, wind: weather.wind }
    : undefined;

  const hasEnoughGarments = (garmentCount || 0) >= 3;

  return (
    <AppLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <AnimatedPage className="px-4 pb-8 pt-6 space-y-6 max-w-lg mx-auto">
          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex items-center justify-between overflow-visible"
          >
            <h1 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "'Sora', sans-serif" }}>
              {getGreeting()}
            </h1>
            <div className="flex items-center gap-2">
              <WeatherPill />
              <button
                onClick={() => navigate('/settings')}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/40 transition-colors active:scale-95"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </motion.div>

          {/* ── Primary Outfit Card ── */}
          {hasEnoughGarments ? (
            <TodayOutfitCard
              key={outfitKey}
              weather={weatherData}
              occasion={occasion}
              style={style}
            />
          ) : (
            <div className="rounded-2xl bg-foreground/[0.02] border border-border/30 p-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">{t('home.min_garments')}</p>
            </div>
          )}

          {/* ── Below-fold (lazy) ── */}
          <Suspense fallback={null}>
            <SwipeSuggestions />
            <PlanTomorrowCard />
            <InsightsBanner />
            <AdjustDaySection
              occasion={occasion}
              style={style}
              onOccasionChange={handleOccasionChange}
              onStyleChange={handleStyleChange}
              onUpdate={handleUpdateOutfit}
            />
            <SmartInsightCard onUseUnused={handleUseUnused} />
            <PredictiveStylingBanner />
          </Suspense>
        </AnimatedPage>
      </PullToRefresh>
    </AppLayout>
  );
}
