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
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { hapticLight } from '@/lib/haptics';
import { useMotionPreset } from '@/lib/motion';
import { getOccasionLabel } from '@/lib/occasionLabel';
import { FadeReplace } from '@/components/ui/fade-replace';
import { HomePageSkeleton } from '@/components/ui/skeletons';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
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
              <div style={{
                background: '#1C1917',
                marginLeft: '-1.25rem', marginRight: '-1.25rem',
                padding: '28px 20px', textAlign: 'center',
              }}>
                <div style={{
                  width: 48, height: 48, background: 'rgba(245,240,232,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <Shirt style={{ width: 22, height: 22, color: 'rgba(245,240,232,0.5)' }} />
                </div>
                <p style={{
                  fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
                  fontSize: 18, color: '#F5F0E8', marginBottom: 6,
                }}>
                  {t('home.min_garments')}
                </p>
                <p style={{
                  fontFamily: 'DM Sans, sans-serif', fontSize: 12,
                  color: 'rgba(245,240,232,0.5)', marginBottom: 20, lineHeight: 1.6,
                }}>
                  Add a top, a bottom, and shoes — that's all you need for your first AI-styled outfit.
                </p>
                <div style={{ maxWidth: 180, margin: '0 auto 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontFamily: 'DM Sans', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(245,240,232,0.4)' }}>Garments</span>
                    <span style={{ fontFamily: 'DM Sans', fontSize: 10, color: 'rgba(245,240,232,0.5)' }}>{garmentCount ?? 0}/3</span>
                  </div>
                  <div style={{ height: 3, background: 'rgba(245,240,232,0.12)', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(((garmentCount ?? 0) / 3) * 100, 100)}%` }}
                      transition={{ delay: 0.3, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                      style={{ height: '100%', background: '#F5F0E8' }}
                    />
                  </div>
                </div>
                <button
                  onClick={() => { hapticLight(); navigate('/wardrobe'); }}
                  style={{
                    height: 44, padding: '0 24px', background: '#F5F0E8', color: '#1C1917',
                    border: 'none', fontFamily: 'DM Sans, sans-serif', fontSize: 13,
                    fontWeight: 500, cursor: 'pointer',
                  }}
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
                style={{
                  background: '#1C1917',
                  marginLeft: '-1.25rem', marginRight: '-1.25rem',
                  width: 'calc(100% + 2.5rem)', padding: '20px',
                  display: 'block', border: 'none', textAlign: 'left', cursor: 'pointer',
                }}
              >
                {/* Thumbnail strip */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                  {todayOutfit.outfit_items.slice(0, 4).map((item) => (
                    <div key={item.id} style={{ width: 52, height: 68, overflow: 'hidden', background: '#2C2824', flexShrink: 0 }}>
                      <LazyImageSimple
                        imagePath={item.garment ? getPreferredGarmentImagePath(item.garment) : undefined}
                        alt={item.garment?.title || item.slot}
                        className="w-full h-full"
                      />
                    </div>
                  ))}
                </div>
                {/* Occasion chip */}
                <p style={{
                  fontFamily: 'DM Sans, sans-serif', fontSize: 8, fontWeight: 500,
                  textTransform: 'uppercase', letterSpacing: '0.12em',
                  color: 'rgba(245,240,232,0.5)', marginBottom: 8,
                }}>
                  {getOccasionLabel(todayOutfit.occasion || '', t)}
                </p>
                {/* Explanation */}
                {todayOutfit.explanation && (
                  <p style={{
                    fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
                    fontSize: 13, color: '#F5F0E8', marginBottom: 12, lineHeight: 1.55,
                  }}>
                    {todayOutfit.explanation}
                  </p>
                )}
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(245,240,232,0.45)' }}>
                  View full look →
                </p>
              </motion.button>
            ) : (
              /* no_outfit */
              <div style={{ background: '#1C1917', marginLeft: '-1.25rem', marginRight: '-1.25rem' }}>
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
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginTop: 16,
            }}
          >
            {stylistSuggestions.map(chip => (
              <button
                key={chip}
                onClick={() => {
                  hapticLight();
                  navigate('/ai/chat', { state: { prefillMessage: chip } });
                }}
                style={{
                  background: '#EDE8DF',
                  border: 'none',
                  padding: '10px 16px',
                  textAlign: 'left',
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 13,
                  color: '#1C1917',
                  cursor: 'pointer',
                  lineHeight: 1.45,
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* ── Zone 3: StyleDNA + quick buttons + Sleeping Beauties ── */}
          <div className="space-y-3 mt-6">
            <StyleDNACard />

            {/* Two equal surface buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => navigate('/plan')}
                style={{
                  flex: 1, height: 48, background: '#EDE8DF', border: 'none', borderRadius: 0,
                  fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 500,
                  color: '#1C1917', cursor: 'pointer',
                }}
              >
                Plan week
              </button>
              <button
                onClick={() => navigate('/ai/mood')}
                style={{
                  flex: 1, height: 48, background: '#EDE8DF', border: 'none', borderRadius: 0,
                  fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 500,
                  color: '#1C1917', cursor: 'pointer',
                }}
              >
                Mood outfit
              </button>
            </div>

            {/* Sleeping Beauties */}
            {sleepingBeauties.length >= 3 && (
              <div
                role="button"
                onClick={() => navigate('/outfits/unused')}
                style={{ background: '#EDE8DF', padding: '16px 20px', cursor: 'pointer' }}
              >
                <p style={{
                  fontFamily: 'DM Sans, sans-serif', fontSize: 10, textTransform: 'uppercase',
                  letterSpacing: '0.1em', color: 'rgba(28,25,23,0.4)', marginBottom: 6,
                }}>
                  SLEEPING BEAUTIES
                </p>
                <p style={{
                  fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
                  fontSize: 16, color: '#1C1917', marginBottom: 4,
                }}>
                  {sleepingBeauties.length} garments unworn this month
                </p>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(28,25,23,0.5)' }}>
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
