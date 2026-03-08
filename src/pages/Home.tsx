import { useState, useCallback } from 'react';
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

import { TodayOutfitCard } from '@/components/home/TodayOutfitCard';
import { QuickActionsGrid } from '@/components/home/QuickActionsGrid';
import { RecentGarments } from '@/components/home/RecentGarments';
import { SwipeSuggestions } from '@/components/home/SwipeSuggestions';

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

  const [outfitKey, setOutfitKey] = useState(0);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['garments-count'] }),
      queryClient.invalidateQueries({ queryKey: ['garments'] }),
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
    setOutfitKey((k) => k + 1);
  };

  const weatherData = weather
    ? { temperature: weather.temperature, precipitation: weather.precipitation, wind: weather.wind }
    : undefined;

  const hasEnoughGarments = (garmentCount || 0) >= 3;

  return (
    <AppLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <AnimatedPage className="px-4 pb-8 pt-6 space-y-8 max-w-lg mx-auto">
          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex items-center justify-between"
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

          {/* ── Today's Outfit Hero ── */}
          {hasEnoughGarments ? (
            <TodayOutfitCard
              key={outfitKey}
              weather={weatherData}
              occasion={occasion}
              onOccasionChange={handleOccasionChange}
            />
          ) : (
            <div className="rounded-2xl bg-card border border-border/20 p-8 text-center space-y-2">
              <p className="text-sm text-muted-foreground">{t('home.min_garments')}</p>
            </div>
          )}

          {/* ── Quick Actions ── */}
          <QuickActionsGrid />

          {/* ── Recent Garments ── */}
          <RecentGarments />

          {/* ── Saved Outfits ── */}
          <SwipeSuggestions />
        </AnimatedPage>
      </PullToRefresh>
    </AppLayout>
  );
}
