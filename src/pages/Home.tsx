import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Settings, Heart, Sparkles, CalendarDays, CloudRain, Shirt, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { enUS, nb, sv, da, fi, de, fr, es, it, pt, nl, pl, ar } from 'date-fns/locale';

import { useProfile } from '@/hooks/useProfile';
import { AnimatedPage } from '@/components/ui/animated-page';
import { useGarmentCount } from '@/hooks/useGarments';
import { AppLayout } from '@/components/layout/AppLayout';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { WeatherPill } from '@/components/weather/WeatherPill';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { AISuggestions } from '@/components/insights/AISuggestions';
import { QuickActionsRow } from '@/components/home/QuickActionsRow';
import { WardrobeGapSection } from '@/components/discover/WardrobeGapSection';
import { usePlannedOutfitsForDate } from '@/hooks/usePlannedOutfits';
import { useWeather } from '@/hooks/useWeather';
import { useLocation } from '@/contexts/LocationContext';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { hapticLight } from '@/lib/haptics';
import { PRESETS, useMotionPreset } from '@/lib/motion';
import { getOccasionLabel } from '@/lib/occasionLabel';
import { FadeReplace } from '@/components/ui/fade-replace';
import { HomePageSkeleton } from '@/components/ui/skeletons';
import { cn } from '@/lib/utils';

type HomeState = 'loading' | 'empty_wardrobe' | 'outfit_planned' | 'weather_alert' | 'no_outfit';

function deriveHomeState(
  garmentCount: number | undefined,
  todayOutfits: unknown[] | undefined,
  weather: { precipitation?: string } | undefined,
  isLoading: boolean,
): HomeState {
  if (isLoading) return 'loading';
  if (!garmentCount || garmentCount < 3) return 'empty_wardrobe';
  if (todayOutfits && todayOutfits.length > 0) return 'outfit_planned';
  if (weather?.precipitation === 'rain' || weather?.precipitation === 'snow') return 'weather_alert';
  return 'no_outfit';
}

export default function HomePage() {
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const { data: garmentCount, isLoading: isCountLoading } = useGarmentCount();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const { isPremium } = useSubscription();

  const hero = useMotionPreset('HERO');
  const reveal = useMotionPreset('REVEAL');
  const press = useMotionPreset('PRESS');

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { data: todayOutfits, isLoading: isOutfitsLoading } = usePlannedOutfitsForDate(todayStr);
  const { effectiveCity } = useLocation();
  const { weather } = useWeather({ city: effectiveCity });

  const homeState = deriveHomeState(garmentCount, todayOutfits, weather, isCountLoading || isOutfitsLoading);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['garments-count'] }),
      queryClient.invalidateQueries({ queryKey: ['insights'] }),
      queryClient.invalidateQueries({ queryKey: ['weather'] }),
      queryClient.invalidateQueries({ queryKey: ['outfits'] }),
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] }),
      queryClient.invalidateQueries({ queryKey: ['planned-outfits-day'] }),
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

  const dateFnsLocaleMap: Record<string, typeof enUS> = { sv, no: nb, da, fi, de, fr, es, it, pt, nl, pl, ar };
  const dateLocale = dateFnsLocaleMap[locale as string] || enUS;
  const formattedDate = format(new Date(), 'EEEE, d MMMM', { locale: dateLocale });

  const todayOutfit = todayOutfits?.[0]?.outfit;

  return (
    <AppLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <AnimatedPage className="page-container pb-28 space-y-6">
          {/* ── 1. Greeting ── */}
          <motion.div
            variants={hero.variants}
            initial="initial"
            animate="animate"
            transition={hero.transition}
            className="flex items-center justify-between overflow-visible"
          >
            <div>
              <h1 className="text-[1.625rem] font-bold tracking-[-0.025em] leading-tight">
                {getGreeting()}
              </h1>
              <p className="label-editorial mt-1.5 text-muted-foreground/60 capitalize">
                {formattedDate}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <WeatherPill />
              <button
                onClick={() => navigate('/settings')}
                className="w-9 h-9 rounded-full surface-inset flex items-center justify-center hover:bg-foreground/[0.06] transition-colors active:scale-95"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4 text-muted-foreground/70" />
              </button>
            </div>
          </motion.div>

          {/* ── Weather alert banner ── */}
          {homeState === 'weather_alert' && !todayOutfit && (
            <motion.div
              variants={reveal.variants}
              initial="initial"
              animate="animate"
              transition={reveal.transition}
              className="flex items-center gap-3 px-4 py-3 rounded-xl surface-secondary"
            >
              <CloudRain className="w-4 h-4 text-primary shrink-0" />
              <p className="text-[12px] text-foreground/80 leading-snug flex-1">
                {t('home.weather_alert_rain')}
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 h-8 text-xs text-primary"
                onClick={() => { hapticLight(); navigate('/outfits/generate'); }}
              >
                {t('home.generate_now')}
              </Button>
            </motion.div>
          )}

          {/* ── 2. Hero — state-aware with FadeReplace ── */}
          <FadeReplace
            show={homeState !== 'loading'}
            contentKey={homeState}
            fallback={<HomePageSkeleton />}
          >
            {homeState === 'empty_wardrobe' ? (
              <motion.div
                variants={reveal.variants}
                initial="initial"
                animate="animate"
                transition={reveal.transition}
                className="rounded-2xl surface-secondary p-8 text-center space-y-5"
              >
                <Shirt className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                <div className="space-y-2">
                  <h3 className="text-[15px] font-semibold">{t('home.min_garments')}</h3>
                  <p className="text-[12px] text-muted-foreground/60 max-w-[240px] mx-auto">
                    {t('home.add_first_items_desc')}
                  </p>
                </div>
                <Button
                  onClick={() => { hapticLight(); navigate('/wardrobe/add'); }}
                  className="w-full max-w-[200px] h-11"
                >
                  <Shirt className="w-4 h-4 mr-2" />
                  {t('wardrobe.add')}
                </Button>
              </motion.div>
            ) : homeState === 'outfit_planned' && todayOutfit ? (
              <motion.button
                variants={reveal.variants}
                initial="initial"
                animate="animate"
                transition={reveal.transition}
                onClick={() => { hapticLight(); navigate(`/outfits/${todayOutfit.id}`); }}
                className="w-full rounded-2xl surface-hero p-4 flex items-center gap-4 text-left cursor-pointer active:scale-[0.98] transition-transform"
              >
                {/* Horizontal thumbnail strip */}
                <div className="flex items-center gap-2 shrink-0">
                  {todayOutfit.outfit_items.slice(0, 4).map((item) => (
                    <div key={item.id} className="w-14 h-14 rounded-xl overflow-hidden bg-muted shrink-0">
                      <LazyImageSimple
                        imagePath={item.garment?.image_path}
                        alt={item.garment?.title || item.slot}
                        className="w-full h-full"
                      />
                    </div>
                  ))}
                </div>

                {/* Occasion + chevron */}
                <div className="flex-1 min-w-0">
                  <p className="label-editorial text-muted-foreground/50 mb-1">
                    {t('home.todays_outfit')}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize text-[10px] font-medium">
                      {getOccasionLabel(todayOutfit.occasion || '', t)}
                    </Badge>
                    {todayOutfit.style_vibe && (
                      <Badge variant="outline" className="text-[10px]">{todayOutfit.style_vibe}</Badge>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
              </motion.button>
            ) : (
              /* no_outfit — simple generate CTA */
              <motion.div
                variants={reveal.variants}
                initial="initial"
                animate="animate"
                transition={reveal.transition}
                className="rounded-2xl surface-secondary p-8 text-center space-y-5"
              >
                <Sparkles className="w-8 h-8 text-primary/50 mx-auto" />
                <div className="space-y-2">
                  <h3 className="text-[15px] font-semibold">{t('home.no_outfit_title')}</h3>
                  <p className="text-[12px] text-muted-foreground/60 max-w-[240px] mx-auto">
                    {t('home.no_outfit_desc')}
                  </p>
                </div>
                <Button
                  onClick={() => { hapticLight(); navigate('/outfits/generate'); }}
                  className="w-full max-w-[200px] h-11 bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {t('home.generate_now')}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>
            )}
          </FadeReplace>

          {/* ── 3. Quick Actions — secondary shortcuts ── */}
          <QuickActionsRow />

          {/* ── 3b. AI Suggestions — always visible with 3+ garments ── */}
          {(garmentCount || 0) >= 3 && (
            <AISuggestions isPremium={isPremium} />
          )}

          {/* ── 4. Tertiary: Wardrobe Gap + Mood ── */}
          {(garmentCount || 0) >= 3 && (
            <div className="space-y-4">
              <p className="label-editorial text-muted-foreground/40">{t('home.more_for_you') || 'More for you'}</p>
              {(garmentCount || 0) >= 5 && <WardrobeGapSection />}

              <motion.button
                variants={reveal.variants}
                initial="initial"
                animate="animate"
                transition={{ ...reveal.transition, delay: 0.1 }}
                whileTap={press.whileTap}
                onClick={() => { hapticLight(); navigate('/ai/mood-outfit'); }}
                className="w-full relative overflow-hidden rounded-xl surface-interactive p-5 text-left flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
                  <Heart className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[13px] font-medium text-foreground leading-tight">
                    {t('discover.tool_mood')}
                  </h4>
                  <p className="text-[11px] text-muted-foreground/60 leading-snug mt-0.5">
                    {t('discover.tool_mood_desc')}
                  </p>
                </div>
              </motion.button>
            </div>
          )}

        </AnimatedPage>
      </PullToRefresh>
    </AppLayout>
  );
}
