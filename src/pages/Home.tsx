import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { trackEvent } from '@/lib/analytics';

import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { AnimatedPage } from '@/components/ui/animated-page';
import { useGarmentCount } from '@/hooks/useGarments';
import { useCalendarEvents } from '@/hooks/useCalendarSync';
import { AppLayout } from '@/components/layout/AppLayout';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { WeatherPill } from '@/components/weather/WeatherPill';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePlannedOutfitsForDate } from '@/hooks/usePlannedOutfits';
import { useWeather } from '@/hooks/useWeather';
import { useLocation } from '@/contexts/LocationContext';
import { hapticLight } from '@/lib/haptics';
import { HomePageSkeleton } from '@/components/ui/skeletons';
import { useFirstRunCoach } from '@/hooks/useFirstRunCoach';
import { HomeTodayLookCard } from '@/components/home/HomeTodayLookCard';
import { HomeStylistSection } from '@/components/home/HomeStylistSection';
import { HomeDiscoverSection } from '@/components/home/HomeDiscoverSection';
import { formatLocalizedDate } from '@/lib/dateLocale';
import type { HomeState } from '@/components/home/homeTypes';

function deriveHomeState(
  garmentCount: number | undefined,
  todayOutfits: unknown[] | undefined,
  weather: { precipitation?: string } | undefined,
  isLoading: boolean,
): HomeState {
  if (isLoading) return 'loading';
  if (!garmentCount || garmentCount < 10) return 'empty_wardrobe';
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
  useFirstRunCoach();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { data: todayOutfits, isLoading: isOutfitsLoading } = usePlannedOutfitsForDate(todayStr);
  const { effectiveCity } = useLocation();
  const { weather } = useWeather({ city: effectiveCity });
  const { data: calendarEvents } = useCalendarEvents(todayStr);

  const homeState = deriveHomeState(
    garmentCount,
    todayOutfits,
    weather ?? undefined,
    isCountLoading || isOutfitsLoading,
  );

  // Track home_view once per mount (fire-and-forget)
  useEffect(() => {
    trackEvent('home_view');
  }, []);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['garments-count'] }),
      queryClient.invalidateQueries({ queryKey: ['weather'] }),
      queryClient.invalidateQueries({ queryKey: ['outfits', user?.id] }),
      queryClient.invalidateQueries({ queryKey: ['planned-outfits-day'] }),
      queryClient.invalidateQueries({ queryKey: ['planned-outfits'] }),
      queryClient.invalidateQueries({ queryKey: ['forecast'] }),
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

  const formattedDate = useMemo(
    () => formatLocalizedDate(new Date(), locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).toUpperCase(),
    [locale],
  );

  const todayOutfit = todayOutfits?.[0]?.outfit ?? null;

  const weatherSummary = weather
    ? `${Math.round(weather.temperature)}\u00B0 ${t(weather.condition)}`
    : null;

  const contextLine = useMemo(() => {
    const nextEvent = calendarEvents?.[0];
    const temp = weather ? Math.round(weather.temperature) : null;
    const condition = weather ? t(weather.condition) : null;

    if (temp !== null && condition && nextEvent) {
      return t('home.context_weather_event')
        .replace('{temp}', String(temp))
        .replace('{event}', nextEvent.title);
    }
    if (nextEvent) {
      return t('home.context_event').replace('{event}', nextEvent.title);
    }
    if (temp !== null && condition) {
      return t('home.context_weather')
        .replace('{temp}', String(temp))
        .replace('{condition}', condition);
    }
    if (garmentCount && garmentCount >= 3) {
      return t('home.context_nudge').replace('{count}', String(garmentCount));
    }
    return null;
  }, [calendarEvents, weather, garmentCount, t]);

  const hasUpcomingEvent = (calendarEvents?.length ?? 0) > 0;

  // Read last-used occasion from localStorage so generate page pre-fills context on return
  const lastOccasion = useMemo(() => {
    try { return localStorage.getItem('burs_last_occasion') ?? null; } catch { return null; }
  }, []);

  const primaryAction = useMemo(() => {
    if (homeState === 'empty_wardrobe') {
      return {
        label: t('home.action_add_garment'),
        onClick: () => navigate('/wardrobe/add'),
      };
    }
    if (homeState === 'outfit_planned') {
      return {
        label: t('plan.wear_today') || 'Wear this',
        onClick: () => navigate(todayOutfit ? `/outfits/${todayOutfit.id}` : '/outfits'),
      };
    }
    return {
      label: t('home.action_style_outfit'),
      // Pass last occasion so the generate page pre-fills it without re-asking
      onClick: () => navigate('/ai/generate', lastOccasion ? { state: { prefillOccasion: lastOccasion } } : undefined),
    };
  }, [homeState, lastOccasion, navigate, t, todayOutfit]);

  const secondaryAction = useMemo(() => {
    if (homeState === 'empty_wardrobe') {
      return {
        label: t('home.action_open_wardrobe'),
        onClick: () => navigate('/wardrobe'),
      };
    }
    if (homeState === 'outfit_planned' && todayOutfit) {
      return {
        label: t('home.action_restyle'),
        onClick: () => navigate('/ai/generate'),
      };
    }
    if (hasUpcomingEvent) {
      return {
        label: t('home.action_open_plan'),
        onClick: () => navigate('/plan'),
      };
    }
    return {
      label: t('home.action_ask_stylist'),
      onClick: () => navigate('/ai/chat'),
    };
  }, [homeState, navigate, todayOutfit, hasUpcomingEvent, t]);


  if (homeState === 'loading') {
    return (
      <AppLayout>
        <PullToRefresh onRefresh={handleRefresh}>
          <AnimatedPage className="page-shell !pt-3.5">
            <HomePageSkeleton />
          </AnimatedPage>
        </PullToRefresh>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <AnimatedPage className="page-shell !pt-2.5 page-cluster">
          {/* Editorial header */}
          <header className="px-[var(--page-px)] flex items-start justify-between gap-2.5">
            <div>
              <p
                className="text-foreground/30 mb-0.5"
                style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px' }}
              >
                {formattedDate}
              </p>
              <h1
                className="text-[24px] font-['Playfair_Display'] italic text-foreground leading-tight"
              >
                {getGreeting()}
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-0.5">
              <WeatherPill />
              <button
                onClick={() => { hapticLight(); navigate('/settings'); }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold text-foreground shrink-0 cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--accent) / 0.8))',
                }}
                aria-label={t('home.settings_aria')}
              >
                {(profile?.display_name ?? user?.email ?? 'U').charAt(0).toUpperCase()}
              </button>
            </div>
          </header>

          {/* Today's Look */}
          <HomeTodayLookCard
            state={homeState}
            todayOutfit={todayOutfit}
            garmentCount={garmentCount ?? 0}
            weatherSummary={weatherSummary}
            contextLine={contextLine}
            primaryLabel={primaryAction.label}
            secondaryLabel={secondaryAction.label}
            onPrimaryAction={() => { hapticLight(); primaryAction.onClick(); }}
            onSecondaryAction={() => { hapticLight(); secondaryAction.onClick(); }}
            onOutfitTap={todayOutfit ? () => { hapticLight(); navigate(`/outfits/${todayOutfit.id}`); } : undefined}
          />

          {/* Stylist section */}
          <HomeStylistSection />

          {/* Discover section */}
          <HomeDiscoverSection />
        </AnimatedPage>
      </PullToRefresh>
    </AppLayout>
  );
}

