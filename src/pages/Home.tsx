import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { AnimatedPage } from '@/components/ui/animated-page';
import { useGarmentCount } from '@/hooks/useGarments';
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
import { CalendarDays, Heart, MessageCircle, Search, Sparkles, type LucideIcon } from 'lucide-react';
import { formatLocalizedDate } from '@/lib/dateLocale';
import type { HomeState } from '@/components/home/homeTypes';

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
  useFirstRunCoach();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { data: todayOutfits, isLoading: isOutfitsLoading } = usePlannedOutfitsForDate(todayStr);
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
  const shortcuts = useMemo(() => ([
    { label: t('home.shortcut_chat'), icon: MessageCircle, path: '/ai/chat' },
    { label: t('home.shortcut_style'), icon: Sparkles, path: '/ai/generate' },
    { label: t('home.shortcut_plan'), icon: CalendarDays, path: '/plan' },
    { label: t('home.shortcut_discover'), icon: Heart, path: '/ai/mood' },
    { label: t('home.shortcut_gaps') || 'Wardrobe gaps', icon: Search, path: '/gaps' },
  ]), [t]);

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
      onClick: () => navigate('/ai/generate'),
    };
  }, [homeState, navigate, t, todayOutfit]);

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
    return {
      label: t('home.action_open_plan'),
      onClick: () => navigate('/plan'),
    };
  }, [homeState, navigate, todayOutfit, t]);


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
          <header className="flex items-start justify-between gap-2.5">
            <div>
              <p className="caption-upper mb-0.5 text-muted-foreground/50">
                {formattedDate}
              </p>
              <h1 className="font-display italic text-[1.45rem] leading-tight tracking-[-0.01em] text-foreground sm:text-[1.55rem]">
                {getGreeting()}
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-0.5">
              <WeatherPill />
              {profile?.display_name && (
                <button
                  onClick={() => { hapticLight(); navigate('/settings'); }}
                  className="flex h-9.5 w-9.5 items-center justify-center rounded-full bg-secondary/60 text-[13px] font-semibold text-foreground transition-transform active:scale-95 cursor-pointer"
                  aria-label={t('home.settings_aria')}
                >
                  {profile.display_name.charAt(0).toUpperCase()}
                </button>
              )}
            </div>
          </header>

          {/* Quick Shortcuts */}
          <QuickShortcuts shortcuts={shortcuts} navigate={navigate} t={t} />

          {/* Today's Look — compact */}
          <HomeTodayLookCard
            state={homeState}
            todayOutfit={todayOutfit}
            garmentCount={garmentCount ?? 0}
            weatherSummary={weatherSummary}
            primaryLabel={primaryAction.label}
            secondaryLabel={secondaryAction.label}
            onPrimaryAction={() => { hapticLight(); primaryAction.onClick(); }}
            onSecondaryAction={() => { hapticLight(); secondaryAction.onClick(); }}
          />
        </AnimatedPage>
      </PullToRefresh>
    </AppLayout>
  );
}

/* ── Quick Shortcuts Grid ─────────────────────────────────── */

function QuickShortcuts({
  shortcuts,
  navigate,
  t,
}: {
  shortcuts: Array<{ label: string; icon: LucideIcon; path: string }>;
  navigate: ReturnType<typeof useNavigate>;
  t: (key: string) => string;
}) {
  return (
    <section>
      <div className="grid grid-cols-2 gap-2.5">
        {shortcuts.map((s) => (
          <button
            key={s.path}
            onClick={() => { hapticLight(); navigate(s.path); }}
            className="flex min-h-[4.15rem] items-center gap-3 rounded-[1.2rem] px-3.5 py-3.5 text-left transition-colors active:bg-secondary/50 cursor-pointer"
          >
            <s.icon className="h-5 w-5 shrink-0 text-accent" strokeWidth={1.6} />
            <span className="text-[0.9rem] font-medium text-foreground">{s.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
