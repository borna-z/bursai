import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { MessageCircle, Plane, Settings, Sparkles, Smile } from 'lucide-react';
import { format } from 'date-fns';
import { enUS, nb, sv, da, fi, de, fr, es, it, pt, nl, pl, ar } from 'date-fns/locale';

import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { AnimatedPage } from '@/components/ui/animated-page';
import { useGarmentCount, useFlatGarments } from '@/hooks/useGarments';
import { useOutfits } from '@/hooks/useOutfits';
import { AppLayout } from '@/components/layout/AppLayout';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { WeatherPill } from '@/components/weather/WeatherPill';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePlannedOutfitsForDate } from '@/hooks/usePlannedOutfits';
import { useInsights } from '@/hooks/useInsights';
import { useWeather } from '@/hooks/useWeather';
import { useLocation } from '@/contexts/LocationContext';
import { useCalendarEventsRange } from '@/hooks/useCalendarSync';
import { buildTodaySuggestions, type TodaySuggestion } from '@/lib/buildTodaySuggestions';
import { buildStyleFlowSearch } from '@/lib/styleFlowState';
import { hapticLight } from '@/lib/haptics';
import { HomePageSkeleton } from '@/components/ui/skeletons';
import { useStyleDNA } from '@/hooks/useStyleDNA';
import { useFirstRunCoach } from '@/hooks/useFirstRunCoach';
import { HomeCommandBoard } from '@/components/home/HomeCommandBoard';
import { HomeDnaSnapshot } from '@/components/home/HomeDnaSnapshot';
import { HomeWearNextPanel } from '@/components/home/HomeWearNextPanel';
import { HomeAskBursRail } from '@/components/home/HomeAskBursRail';
import type { HomeState } from '@/components/home/homeTypes';

const DATE_FNS_LOCALE_MAP: Record<string, typeof enUS> = { sv, no: nb, da, fi, de, fr, es, it, pt, nl, pl, ar };

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: garmentCount, isLoading: isCountLoading } = useGarmentCount();
  const { data: profile } = useProfile();
  const { data: insightsData } = useInsights();
  const { data: dna, isLoading: isDnaLoading } = useStyleDNA();
  const { data: flatGarments } = useFlatGarments();
  const { data: allOutfits } = useOutfits();
  const coach = useFirstRunCoach();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const tomorrowStr = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');
  const { data: todayOutfits, isLoading: isOutfitsLoading } = usePlannedOutfitsForDate(todayStr);
  const { data: calendarEvents } = useCalendarEventsRange(todayStr, tomorrowStr);
  const { effectiveCity } = useLocation();
  const { weather } = useWeather({ city: effectiveCity });

  const homeState = deriveHomeState(
    garmentCount,
    todayOutfits,
    weather ?? undefined,
    isCountLoading || isOutfitsLoading,
  );

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['garments-count'] }),
      queryClient.invalidateQueries({ queryKey: ['insights'] }),
      queryClient.invalidateQueries({ queryKey: ['insights-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['weather'] }),
      queryClient.invalidateQueries({ queryKey: ['outfits', user?.id] }),
      queryClient.invalidateQueries({ queryKey: ['planned-outfits-day'] }),
      queryClient.invalidateQueries({ queryKey: ['style-dna'] }),
    ]);
  }, [queryClient, user?.id]);

  function getGreeting() {
    const hour = new Date().getHours();
    const firstName = profile?.display_name?.split(' ')[0];
    const suffix = firstName ? `, ${firstName}` : '';

    if (hour < 10) return t('home.greeting_morning') + suffix;
    if (hour < 18) return t('home.greeting_afternoon') + suffix;
    return t('home.greeting_evening') + suffix;
  }

  const dateLocale = useMemo(
    () => DATE_FNS_LOCALE_MAP[locale as string] ?? enUS,
    [locale],
  );
  const formattedDate = useMemo(
    () => format(new Date(), 'EEEE, d MMMM', { locale: dateLocale }),
    [dateLocale],
  );

  const todayOutfit = todayOutfits?.[0]?.outfit ?? null;
  const recentOutfits = useMemo(() => (allOutfits ?? []).slice(0, 2), [allOutfits]);

  const fourteenDaysAgo = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 14);
    return date;
  }, []);

  const sleepingBeauties = useMemo(
    () =>
      (insightsData?.unusedGarments ?? []).filter(
        (garment) =>
          (garment.wear_count ?? 0) === 0 &&
          garment.created_at != null &&
          new Date(garment.created_at) < fourteenDaysAgo,
      ),
    [fourteenDaysAgo, insightsData?.unusedGarments],
  );

  const todayCalEvents = useMemo(
    () => (calendarEvents ?? []).filter((event) => event.date === todayStr),
    [calendarEvents, todayStr],
  );
  const tomorrowCalEvents = useMemo(
    () => (calendarEvents ?? []).filter((event) => event.date === tomorrowStr),
    [calendarEvents, tomorrowStr],
  );

  const stylistSuggestions = useMemo(
    () => buildTodaySuggestions(weather ?? undefined, todayCalEvents, tomorrowCalEvents, flatGarments ?? []),
    [flatGarments, todayCalEvents, tomorrowCalEvents, weather],
  );

  const firstSuggestion = stylistSuggestions[0] ?? null;
  const weatherSummary = weather
    ? `${Math.round(weather.temperature)}\u00B0 ${t(weather.condition)}`
    : null;

  const scheduleSummary = useMemo(() => {
    const firstEvent = todayCalEvents[0];
    if (firstEvent?.title) {
      return todayCalEvents.length > 1 ? `${firstEvent.title} + ${todayCalEvents.length - 1}` : firstEvent.title;
    }
    if (todayCalEvents.length > 0) {
      return t('home.events_today').replace('{count}', String(todayCalEvents.length));
    }
    return null;
  }, [todayCalEvents]);

  const handleSuggestion = useCallback(
    (suggestion: TodaySuggestion) => {
      hapticLight();

      if (suggestion.route === 'generate' && suggestion.garmentIds && suggestion.garmentIds.length > 0) {
        navigate(`/ai/generate${buildStyleFlowSearch(suggestion.garmentIds)}`);
        return;
      }

      navigate('/ai/chat', { state: { prefillMessage: suggestion.prefillMessage ?? suggestion.text } });
    },
    [navigate],
  );

  const primaryAction = useMemo(() => {
    if (homeState === 'empty_wardrobe') {
      return {
        label: t('home.action_add_garment'),
        onClick: () => navigate('/wardrobe/add'),
      };
    }

    if (homeState === 'outfit_planned') {
      return {
        label: t('home.action_restyle'),
        onClick: () => navigate('/ai/generate'),
      };
    }

    return {
      label: t('home.action_style_outfit'),
      onClick: () => navigate('/ai/generate'),
    };
  }, [homeState, navigate]);

  const secondaryAction = useMemo(() => {
    if (homeState === 'empty_wardrobe') {
      return {
        label: t('home.action_open_wardrobe'),
        onClick: () => navigate('/wardrobe'),
      };
    }

    if (homeState === 'outfit_planned' && todayOutfit) {
      return {
        label: t('home.action_open_outfit'),
        onClick: () => navigate(`/outfits/${todayOutfit.id}`),
      };
    }

    return {
      label: t('home.action_open_plan'),
      onClick: () => navigate('/plan'),
    };
  }, [homeState, navigate, todayOutfit]);

  if (homeState === 'loading') {
    return (
      <AppLayout>
        <PullToRefresh onRefresh={handleRefresh}>
          <AnimatedPage className="page-shell !pt-4">
            <HomePageSkeleton />
          </AnimatedPage>
        </PullToRefresh>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <AnimatedPage className="page-shell !pt-3 page-cluster">
          <motion.header
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="topbar-frost sticky top-0 z-10 -mx-5 px-5 pb-4 pt-3"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="caption-upper mb-0.5 text-muted-foreground/50">
                    {formattedDate}
                  </p>
                  <h1 className="font-display italic text-[1.55rem] leading-tight tracking-[-0.01em] text-foreground">
                    {getGreeting()}
                  </h1>
                </div>
                <div className="flex items-center gap-2">
                  <WeatherPill />
                  <button
                    onClick={() => navigate('/settings')}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-border/45 bg-background/90 transition-colors hover:bg-background active:scale-95"
                    aria-label={t('home.settings_aria')}
                  >
                    <Settings className="size-4 text-muted-foreground/70" />
                  </button>
                </div>
              </div>

              {(scheduleSummary || weatherSummary) && (
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                  {scheduleSummary && (
                    <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border/35 bg-background/70 px-2.5 py-1 text-[0.74rem] text-muted-foreground/70">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent/70 shrink-0" />
                      {scheduleSummary}
                    </span>
                  )}
                  {weatherSummary && (
                    <span className="shrink-0 rounded-full border border-border/35 bg-background/70 px-2.5 py-1 text-[0.74rem] text-muted-foreground/70">
                      {weatherSummary}
                    </span>
                  )}
                </div>
              )}
            </div>
          </motion.header>

          {/* AI Quick Access Strip */}
          <div className="grid grid-cols-4 gap-2 pb-1">
            {[
              { label: t('nav.generate') || 'Generate', icon: Sparkles, path: '/ai/generate' },
              { label: t('nav.chat') || 'Chat', icon: MessageCircle, path: '/ai/chat' },
              { label: t('ai.mood_title') || 'Mood', icon: Smile, path: '/ai/mood' },
              { label: t('travel.title') || 'Travel', icon: Plane, path: '/ai/travel' },
            ].map(({ label, icon: Icon, path }) => (
              <button
                key={path}
                type="button"
                onClick={() => { hapticLight(); navigate(path); }}
                className="flex flex-col items-center gap-1.5 rounded-[1.25rem] border border-border/35 bg-background/70 py-3 px-2 active:scale-95 transition-transform"
              >
                <Icon className="h-5 w-5 text-foreground/70" />
                <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/70 leading-none">
                  {label}
                </span>
              </button>
            ))}
          </div>

          <HomeCommandBoard
            state={homeState}
            garmentCount={garmentCount ?? 0}
            todayOutfit={todayOutfit}
            recentOutfits={recentOutfits}
            weatherSummary={weatherSummary}
            scheduleSummary={scheduleSummary}
            coachNudge={coach.isActive && !coach.hasEnoughGarments}
            primaryLabel={primaryAction.label}
            secondaryLabel={secondaryAction.label}
            onPrimaryAction={() => {
              hapticLight();
              primaryAction.onClick();
            }}
            onSecondaryAction={() => {
              hapticLight();
              secondaryAction.onClick();
            }}
          />

          <section className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <p className="label-editorial text-muted-foreground/60">{t('home.section_utilities')}</p>
              <p className="text-[0.74rem] uppercase tracking-[0.18em] text-muted-foreground/55">
                {t('home.section_utilities_sub')}
              </p>
            </div>

            <div className="app-card-grid">
              <button
                type="button"
                onClick={() => {
                  if (firstSuggestion) {
                    handleSuggestion(firstSuggestion);
                    return;
                  }

                  navigate('/ai/chat', { state: { prefillMessage: t('home.prefill_help_style') } });
                }}
                className="surface-secondary flex flex-col items-start gap-4 rounded-[1.5rem] p-4 text-left"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-secondary text-foreground">
                  <MessageCircle className="size-5" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-[1.05rem] font-semibold tracking-[-0.03em] text-foreground">
                    {t('home.ask_burs_title')}
                  </h2>
                  <p className="text-[0.86rem] leading-6 text-muted-foreground">
                    {firstSuggestion?.text ?? t('home.ask_burs_fallback')}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/ai/travel')}
                className="surface-secondary flex flex-col items-start gap-4 rounded-[1.5rem] p-4 text-left"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-secondary text-foreground">
                  <Plane className="size-5" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-[1.05rem] font-semibold tracking-[-0.03em] text-foreground">
                    {t('home.travel_capsule_title')}
                  </h2>
                  <p className="text-[0.86rem] leading-6 text-muted-foreground">
                    {t('home.travel_capsule_desc')}
                  </p>
                </div>
              </button>
            </div>

            <HomeAskBursRail
              suggestions={stylistSuggestions}
              onSelectSuggestion={handleSuggestion}
            />
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <p className="label-editorial text-muted-foreground/60">{t('home.section_insights')}</p>
              <p className="text-[0.74rem] uppercase tracking-[0.18em] text-muted-foreground/55">
                {t('home.section_insights_sub')}
              </p>
            </div>

            <HomeDnaSnapshot
              dna={dna}
              isLoading={isDnaLoading}
              onOpenInsights={() => navigate('/insights')}
            />

            <HomeWearNextPanel
              unusedGarments={sleepingBeauties}
              sleepingBeautiesCount={sleepingBeauties.length}
              onOpenUnused={() => navigate('/outfits/unused')}
              onStyleAroundGem={(garmentId) => navigate(`/ai/generate${buildStyleFlowSearch([garmentId])}`)}
            />
          </section>
        </AnimatedPage>
      </PullToRefresh>
    </AppLayout>
  );
}
