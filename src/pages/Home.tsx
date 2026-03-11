import { useCallback } from 'react';
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
import { useSubscription } from '@/hooks/useSubscription';
import { AISuggestions } from '@/components/insights/AISuggestions';

import { lazy, Suspense } from 'react';

// Below-fold components – lazy loaded to speed up cold start
const SwipeSuggestions = lazy(() => import('@/components/home/SwipeSuggestions').then(m => ({ default: m.SwipeSuggestions })));
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
  const { isPremium } = useSubscription();

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['garments-count'] }),
      queryClient.invalidateQueries({ queryKey: ['insights'] }),
      queryClient.invalidateQueries({ queryKey: ['weather'] }),
      queryClient.invalidateQueries({ queryKey: ['outfits'] }),
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] }),
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

          {/* ── AI Suggestions ── */}
          {hasEnoughGarments ? (
            <AISuggestions isPremium={isPremium} />
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
            <SmartInsightCard />
            <PredictiveStylingBanner />
          </Suspense>
        </AnimatedPage>
      </PullToRefresh>
    </AppLayout>
  );
}
