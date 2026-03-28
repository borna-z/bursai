import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  CalendarRange,
  Plane,
  Radar,
  Settings,
  Shirt,
  SmilePlus,
} from 'lucide-react';
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
import { HomeQuickActions } from '@/components/home/HomeQuickActions';
import { HomeDnaSnapshot } from '@/components/home/HomeDnaSnapshot';
import { HomeOpportunityPanel } from '@/components/home/HomeOpportunityPanel';
import { HomeWearNextPanel } from '@/components/home/HomeWearNextPanel';
import { HomeAskBursRail } from '@/components/home/HomeAskBursRail';
import type { HomeQuickAction, HomeState } from '@/components/home/homeTypes';

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
  const recentOutfits = useMemo(() => (allOutfits ?? []).slice(0, 3), [allOutfits]);

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

  const weatherSummary = weather
    ? `${Math.round(weather.temperature)}\u00B0 ${t(weather.condition)}`
    : null;

  const scheduleSummary = useMemo(() => {
    const firstEvent = todayCalEvents[0];
    if (firstEvent?.title) {
      return todayCalEvents.length > 1 ? `${firstEvent.title} + ${todayCalEvents.length - 1}` : firstEvent.title;
    }
    if (todayCalEvents.length > 0) {
      return `${todayCalEvents.length} today`;
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

  const secondaryAction = useMemo(() => {
    if (homeState === 'empty_wardrobe') {
      return {
        label: 'Wardrobe',
        onClick: () => navigate('/wardrobe'),
      };
    }

    if (homeState === 'outfit_planned' && todayOutfit) {
      return {
        label: 'Today\'s look',
        onClick: () => navigate(`/outfits/${todayOutfit.id}`),
      };
    }

    return {
      label: 'Plan',
      onClick: () => navigate('/plan'),
    };
  }, [homeState, navigate, todayOutfit]);

  const quickActions = useMemo<HomeQuickAction[]>(() => [
    {
      id: 'gaps',
      title: 'Garment gaps',
      description: 'Find the next buy',
      icon: Radar,
      toneClass: 'bg-secondary/70',
      onClick: () => navigate('/gaps'),
    },
    {
      id: 'travel',
      title: 'Travel',
      description: 'Pack smarter',
      icon: Plane,
      toneClass: 'bg-secondary/70',
      onClick: () => navigate('/ai/travel'),
    },
    {
      id: 'plan',
      title: 'Plan',
      description: 'Week ahead',
      icon: CalendarRange,
      toneClass: 'bg-secondary/70',
      onClick: () => navigate('/plan'),
    },
    {
      id: 'mood',
      title: 'Mood',
      description: 'Dress the vibe',
      icon: SmilePlus,
      toneClass: 'bg-secondary/70',
      onClick: () => navigate('/ai/mood'),
    },
    {
      id: 'wardrobe',
      title: 'Wardrobe',
      description: 'Add and edit',
      icon: Shirt,
      toneClass: 'bg-secondary/70',
      onClick: () => navigate('/wardrobe'),
    },
  ], [navigate]);

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
        <AnimatedPage className="page-shell !pt-4 flex flex-col gap-5">
          <motion.header
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="topbar-frost sticky top-0 z-10 -mx-4 px-4 pb-4 pt-3"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/55">
                    Today
                  </p>
                  <h1 className="text-[1.68rem] font-semibold leading-tight tracking-[-0.055em]">
                    {getGreeting()}
                  </h1>
                </div>
                <div className="flex items-center gap-2">
                  <WeatherPill />
                  <button
                    onClick={() => navigate('/settings')}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-border/45 bg-background/90 transition-colors hover:bg-background active:scale-95"
                    aria-label="Settings"
                  >
                    <Settings className="size-4 text-muted-foreground/70" />
                  </button>
                </div>
              </div>

              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <span className="rounded-full border border-border/45 bg-background/80 px-3 py-1.5 text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground/70 capitalize">
                  {formattedDate}
                </span>
                {scheduleSummary ? (
                  <span className="rounded-full border border-border/45 bg-background/80 px-3 py-1.5 text-[0.82rem] text-muted-foreground">
                    {scheduleSummary}
                  </span>
                ) : null}
              </div>
            </div>
          </motion.header>

          <HomeCommandBoard
            state={homeState}
            garmentCount={garmentCount ?? 0}
            todayOutfit={todayOutfit}
            recentOutfits={recentOutfits}
            weatherSummary={weatherSummary}
            scheduleSummary={scheduleSummary}
            coachNudge={coach.isActive && !coach.hasEnoughGarments}
            secondaryLabel={secondaryAction.label}
            onPrimaryAction={() => {
              hapticLight();
              navigate('/ai/generate');
            }}
            onSecondaryAction={() => {
              hapticLight();
              secondaryAction.onClick();
            }}
          />

          <HomeQuickActions actions={quickActions} />

          <HomeAskBursRail
            suggestions={stylistSuggestions.slice(0, 3)}
            onSelectSuggestion={handleSuggestion}
          />

          <section className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <p className="label-editorial text-muted-foreground/60">Signals</p>
              <p className="text-[0.74rem] uppercase tracking-[0.18em] text-muted-foreground/55">
                DNA, gaps, wear next
              </p>
            </div>

            <HomeDnaSnapshot
              dna={dna}
              isLoading={isDnaLoading}
              onOpenInsights={() => navigate('/insights')}
              onGenerateLook={() => navigate('/ai/generate')}
            />
            <HomeOpportunityPanel />
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
