import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Shirt } from 'lucide-react';
import { TodayOutfitHero } from '@/components/home/TodayOutfitHero';
import { format } from 'date-fns';
import { enUS, nb, sv, da, fi, de, fr, es, it, pt, nl, pl, ar } from 'date-fns/locale';

import { useProfile } from '@/hooks/useProfile';
import { AnimatedPage } from '@/components/ui/animated-page';
import { useGarmentCount, useFlatGarments } from '@/hooks/useGarments';
import { AppLayout } from '@/components/layout/AppLayout';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { WeatherPill } from '@/components/weather/WeatherPill';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePlannedOutfitsForDate } from '@/hooks/usePlannedOutfits';
import { useInsights } from '@/hooks/useInsights';
import { useWeather } from '@/hooks/useWeather';
import { useLocation } from '@/contexts/LocationContext';
import { useCalendarEventsRange } from '@/hooks/useCalendarSync';
import { buildTodaySuggestions } from '@/lib/buildTodaySuggestions';
import { hapticLight } from '@/lib/haptics';
import { useMotionPreset } from '@/lib/motion';
import { getOccasionLabel } from '@/lib/occasionLabel';
import { FadeReplace } from '@/components/ui/fade-replace';
import { HomePageSkeleton } from '@/components/ui/skeletons';
import { OutfitComposition } from '@/components/ui/OutfitComposition';
import { getStylistTip } from '@/lib/stylistCopy';
import { StyleDNACard } from '@/components/insights/StyleDNACard';
import { useStyleDNA } from '@/hooks/useStyleDNA';
import { useFirstRunCoach } from '@/hooks/useFirstRunCoach';

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

  const coach = useFirstRunCoach();

  const hero = useMotionPreset('HERO');
  const reveal = useMotionPreset('REVEAL');

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const tomorrowStr = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');
  const { data: todayOutfits, isLoading: isOutfitsLoading } = usePlannedOutfitsForDate(todayStr);
  const { data: insightsData } = useInsights();
  const { effectiveCity } = useLocation();
  const { weather } = useWeather({ city: effectiveCity });
  const { data: dna } = useStyleDNA();
  const { data: calendarEvents } = useCalendarEventsRange(todayStr, tomorrowStr);
  const { data: flatGarments } = useFlatGarments();

  const homeState = deriveHomeState(garmentCount, todayOutfits, weather ?? undefined, isCountLoading || isOutfitsLoading);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['garments-count'] }),
      queryClient.invalidateQueries({ queryKey: ['insights'] }),
      queryClient.invalidateQueries({ queryKey: ['weather'] }),
      queryClient.invalidateQueries({ queryKey: ['outfits'] }),
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

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const sleepingBeauties = (insightsData?.unusedGarments ?? []).filter(
    g => (g.wear_count ?? 0) === 0 && g.created_at != null && new Date(g.created_at) < fourteenDaysAgo,
  );

  const todayCalEvents = useMemo(
    () => (calendarEvents ?? []).filter(e => e.date === todayStr),
    [calendarEvents, todayStr],
  );
  const tomorrowCalEvents = useMemo(
    () => (calendarEvents ?? []).filter(e => e.date === tomorrowStr),
    [calendarEvents, tomorrowStr],
  );
  const stylistSuggestions = useMemo(
    () => buildTodaySuggestions(weather ?? undefined, todayCalEvents, tomorrowCalEvents, flatGarments ?? []),
    [weather, todayCalEvents, tomorrowCalEvents, flatGarments],
  );

  return (
    <AppLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <AnimatedPage className="page-container pb-28 space-y-0">

          {/* ── Greeting ── */}
          <motion.div
            variants={hero.variants}
            initial="initial"
            animate="animate"
            transition={hero.transition}
            className="flex items-center justify-between overflow-visible mb-6"
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

          {/* ── First-run garment banner ── */}
          <AnimatePresence>
            {coach.isActive && !coach.hasEnoughGarments && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="mb-6 bg-foreground text-background rounded-2xl p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-[15px] font-['Playfair_Display'] text-background">
                    Add garments to get started
                  </p>
                  <p className="text-[12px] font-['DM_Sans'] text-background/60 mt-0.5">
                    You need a top, bottom + shoes for your first outfit.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/wardrobe')}
                  className="bg-background text-foreground rounded-full px-4 h-9 text-[13px] font-medium font-['DM_Sans'] shrink-0"
                >
                  Add now →
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Zone 1: Dark hero ── */}
          <FadeReplace
            show={homeState !== 'loading'}
            contentKey={homeState}
            fallback={<HomePageSkeleton />}
          >
            {homeState === 'empty_wardrobe' ? (
              <div className="-mx-5 bg-foreground px-5 py-7 text-center">
                <div className="w-12 h-12 bg-background/[0.08] flex items-center justify-center mx-auto mb-4">
                  <Shirt className="w-[22px] h-[22px] text-background/50" />
                </div>
                <p className="font-['Playfair_Display'] italic text-[18px] text-background mb-1.5">
                  {t('home.min_garments')}
                </p>
                <p className="font-['DM_Sans'] text-[12px] text-background/50 mb-5 leading-relaxed">
                  Add a top, a bottom, and shoes — that's all you need for your first AI-styled outfit.
                </p>
                <div className="max-w-[180px] mx-auto mb-5">
                  <div className="flex justify-between mb-1.5">
                    <span className="font-['DM_Sans'] text-[10px] uppercase tracking-[0.08em] text-background/40">Garments</span>
                    <span className="font-['DM_Sans'] text-[10px] text-background/50">{garmentCount ?? 0}/3</span>
                  </div>
                  <div className="h-[3px] bg-background/[0.12] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(((garmentCount ?? 0) / 3) * 100, 100)}%` }}
                      transition={{ delay: 0.3, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                      className="h-full bg-background"
                    />
                  </div>
                </div>
                <button
                  onClick={() => { hapticLight(); navigate('/wardrobe'); }}
                  className="h-11 px-6 bg-background text-foreground border-none font-['DM_Sans'] text-[13px] font-medium cursor-pointer"
                >
                  {t('wardrobe.add')}
                </button>
              </div>
            ) : homeState === 'outfit_planned' && todayOutfit ? (
              <motion.button
                variants={reveal.variants}
                initial="initial"
                animate="animate"
                transition={reveal.transition}
                onClick={() => { hapticLight(); navigate(`/outfits/${todayOutfit.id}`); }}
                className="-mx-5 block border-none bg-foreground p-5 text-left cursor-pointer"
              >
                {/* 2×2 outfit composition */}
                <OutfitComposition
                  items={todayOutfit.outfit_items}
                  compact
                  className="mb-3.5 w-[120px]"
                />
                {/* Occasion chip */}
                <p className="font-['DM_Sans'] text-[8px] font-medium uppercase tracking-[0.12em] text-background/50 mb-2">
                  {getOccasionLabel(todayOutfit.occasion || '', t)}
                </p>
                {/* Explanation */}
                {todayOutfit.explanation && (
                  <p className="font-['Playfair_Display'] italic text-[13px] text-background mb-3 leading-[1.55]">
                    {todayOutfit.explanation}
                  </p>
                )}
                <p className="font-['DM_Sans'] text-[12px] text-background/45">
                  View full look →
                </p>
              </motion.button>
            ) : (
              /* no_outfit */
              <div className="-mx-5 bg-foreground">
                <TodayOutfitHero
                  weather={weather ?? undefined}
                  garmentCount={garmentCount ?? undefined}
                />
              </div>
            )}
          </FadeReplace>

          {/* ── Zone 2: Stylist tip ── */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-[12px] text-muted-foreground/40 italic leading-relaxed px-0.5 mt-5"
          >
            {getStylistTip({ weather: weather ?? undefined, garmentCount: garmentCount ?? undefined, archetype: dna?.archetype, topColor: dna?.signatureColors?.[0]?.color, topCombo: dna?.uniformCombos?.[0]?.combo, formalityCenter: dna?.formalityCenter })}
          </motion.p>

          {/* ── Zone 2b: Stylist suggestion chips ── */}
          <div className="flex flex-col gap-2 mt-4">
            {stylistSuggestions.map(chip => (
              <button
                key={chip}
                onClick={() => {
                  hapticLight();
                  navigate('/ai/chat', { state: { prefillMessage: chip } });
                }}
                className="bg-card border-none py-2.5 px-4 text-left font-['DM_Sans'] text-[13px] text-foreground cursor-pointer leading-[1.45]"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* ── Zone 3: StyleDNA + quick buttons + Sleeping Beauties ── */}
          <div className="space-y-3 mt-6">
            <div
              role="button"
              onClick={() => { hapticLight(); navigate('/insights'); }}
              className="cursor-pointer"
            >
              <StyleDNACard />
            </div>
            <p
              role="button"
              onClick={() => { hapticLight(); navigate('/insights'); }}
              className="font-['DM_Sans'] text-[12px] text-muted-foreground cursor-pointer -mt-1 px-0.5"
            >
              Full insights →
            </p>

            {/* Two equal surface buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/plan')}
                className="flex-1 h-12 bg-card border-none rounded-none font-['DM_Sans'] text-[13px] font-medium text-foreground cursor-pointer"
              >
                Plan week
              </button>
              <button
                onClick={() => navigate('/ai/mood')}
                className="flex-1 h-12 bg-card border-none rounded-none font-['DM_Sans'] text-[13px] font-medium text-foreground cursor-pointer"
              >
                Mood outfit
              </button>
            </div>

            {/* Sleeping Beauties */}
            {sleepingBeauties.length >= 3 && (
              <div
                role="button"
                onClick={() => navigate('/outfits/unused')}
                className="bg-card px-5 py-4 cursor-pointer"
              >
                <p className="font-['DM_Sans'] text-[10px] uppercase tracking-[0.1em] text-foreground/40 mb-1.5">
                  SLEEPING BEAUTIES
                </p>
                <p className="font-['Playfair_Display'] italic text-[16px] text-foreground mb-1">
                  {sleepingBeauties.length} garments unworn this month
                </p>
                <p className="font-['DM_Sans'] text-[12px] text-foreground/50">
                  See what's being ignored →
                </p>
              </div>
            )}
          </div>

        </AnimatedPage>
      </PullToRefresh>
    </AppLayout>
  );
}
