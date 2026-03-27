import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass,
  Plus,
  Settings,
  Sparkles,
  CalendarRange,
  Plane,
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
import { getStylistTip } from '@/lib/stylistCopy';
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

  const stylistLine = useMemo(
    () =>
      getStylistTip({
        weather: weather ?? undefined,
        garmentCount: garmentCount ?? undefined,
        archetype: dna?.archetype,
        topColor: dna?.signatureColors?.[0]?.color,
        topCombo: dna?.uniformCombos?.[0]?.combo,
        formalityCenter: dna?.formalityCenter,
      }),
    [dna?.archetype, dna?.formalityCenter, dna?.signatureColors, dna?.uniformCombos, garmentCount, weather],
  );

  const weatherSummary = weather
    ? `${Math.round(weather.temperature)}°C · ${t(weather.condition)}`
    : null;

  const scheduleSummary = useMemo(() => {
    const firstEvent = todayCalEvents[0];
    if (firstEvent?.title) {
      return todayCalEvents.length > 1 ? `${firstEvent.title} + ${todayCalEvents.length - 1} more` : firstEvent.title;
    }
    if (todayCalEvents.length > 0) {
      return `${todayCalEvents.length} events today`;
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
        label: 'Add garments',
        onClick: () => navigate('/wardrobe/add'),
      };
    }

    if (homeState === 'outfit_planned' && todayOutfit) {
      return {
        label: "Open today's look",
        onClick: () => navigate(`/outfits/${todayOutfit.id}`),
      };
    }

    return {
      label: 'Open plan',
      onClick: () => navigate('/plan'),
    };
  }, [homeState, navigate, todayOutfit]);

  const quickActions = useMemo<HomeQuickAction[]>(() => {
    const actions: HomeQuickAction[] = [
      {
        id: 'discover',
        title: 'Discover',
        description: 'Open wardrobe opportunities, gaps, and unlock paths from one deeper intelligence view.',
        icon: Compass,
        accentClass: 'from-[#d8dff7] via-[#e8ecfb] to-[#f5f1e8]',
        featured: true,
        onClick: () => navigate('/discover'),
      },
      {
        id: 'travel',
        title: 'Travel capsule',
        description: 'Build a tighter, smarter travel pack around dates, weather, and reuse.',
        icon: Plane,
        accentClass: 'from-[#e5edd5] via-[#eef4e6] to-[#f5f1e8]',
        onClick: () => navigate('/ai/travel'),
      },
      {
        id: 'mood',
        title: 'Mood outfit',
        description: 'Let the vibe lead and generate a look from how you want to feel today.',
        icon: SmilePlus,
        accentClass: 'from-[#f6dfd7] via-[#f7ebe6] to-[#f5f1e8]',
        onClick: () => navigate('/ai/mood'),
      },
      {
        id: 'plan',
        title: 'Plan week',
        description: 'Spread strong looks across the week and keep your calendar styling-ready.',
        icon: CalendarRange,
        accentClass: 'from-[#eadfcf] via-[#f2ebe1] to-[#f5f1e8]',
        onClick: () => navigate('/plan'),
      },
    ];

    if ((garmentCount ?? 0) < 10 || homeState === 'empty_wardrobe') {
      actions.push({
        id: 'add',
        title: 'Add item',
        description: 'Keep cataloguing the wardrobe so more styling and insight systems unlock.',
        icon: Plus,
        accentClass: 'from-[#dddaf7] via-[#ece9fb] to-[#f5f1e8]',
        onClick: () => navigate('/wardrobe/add'),
      });
    }

    return actions;
  }, [garmentCount, homeState, navigate]);

  if (homeState === 'loading') {
    return (
      <AppLayout>
        <PullToRefresh onRefresh={handleRefresh}>
          <AnimatedPage className="page-container pb-28">
            <HomePageSkeleton />
          </AnimatedPage>
        </PullToRefresh>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <AnimatedPage className="page-container space-y-6 pb-28">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="flex items-center justify-between gap-4 overflow-visible"
          >
            <div>
              <h1 className="text-[1.75rem] font-bold tracking-[-0.04em] leading-tight">
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
                className="flex h-10 w-10 items-center justify-center rounded-full surface-inset transition-colors hover:bg-foreground/[0.06] active:scale-95"
                aria-label="Settings"
              >
                <Settings className="size-4 text-muted-foreground/70" />
              </button>
            </div>
          </motion.div>

          <AnimatePresence>
            {coach.isActive && !coach.hasEnoughGarments && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="rounded-[1.55rem] bg-foreground px-5 py-4 text-background"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-['Playfair_Display'] text-[1rem] text-background">
                      Add garments to get started
                    </p>
                    <p className="mt-1 text-[0.82rem] text-background/70">
                      You need a top, bottom, and shoes for your first complete AI-styled outfit.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/wardrobe/add')}
                    className="h-10 shrink-0 rounded-full bg-background px-4 text-[0.85rem] font-medium text-foreground"
                  >
                    Add now
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <HomeCommandBoard
            state={homeState}
            garmentCount={garmentCount ?? 0}
            todayOutfit={todayOutfit}
            recentOutfits={recentOutfits}
            weatherSummary={weatherSummary}
            scheduleSummary={scheduleSummary}
            stylistLine={stylistLine}
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

          <HomeAskBursRail
            suggestions={stylistSuggestions}
            onSelectSuggestion={handleSuggestion}
          />

          <HomeQuickActions actions={quickActions} />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
            <HomeDnaSnapshot
              dna={dna}
              isLoading={isDnaLoading}
              onOpenInsights={() => navigate('/insights')}
              onGenerateLook={() => navigate('/ai/generate')}
            />
            <HomeOpportunityPanel />
          </div>

          <HomeWearNextPanel
            unusedGarments={sleepingBeauties}
            sleepingBeautiesCount={sleepingBeauties.length}
            onOpenUnused={() => navigate('/outfits/unused')}
            onStyleAroundGem={(garmentId) => navigate(`/ai/generate${buildStyleFlowSearch([garmentId])}`)}
          />

          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
            onClick={() => navigate('/insights')}
            className="flex w-full items-center justify-between rounded-[1.35rem] border border-foreground/[0.08] bg-card px-5 py-4 text-left shadow-[0_12px_26px_rgba(22,18,15,0.04)]"
          >
            <div>
              <p className="label-editorial text-muted-foreground/60">Birdview</p>
              <p className="mt-1 text-[1rem] font-medium text-foreground">
                Open the full insights report
              </p>
            </div>
            <Sparkles className="size-4 text-muted-foreground/60" />
          </motion.button>
        </AnimatedPage>
      </PullToRefresh>
    </AppLayout>
  );
}
