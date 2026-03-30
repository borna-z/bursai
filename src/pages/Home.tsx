import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { format } from 'date-fns';
import { enUS, nb, sv, da, fi, de, fr, es, it, pt, nl, pl, ar } from 'date-fns/locale';

import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { AnimatedPage } from '@/components/ui/animated-page';
import { useGarmentCount } from '@/hooks/useGarments';
import { useOutfits } from '@/hooks/useOutfits';
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
import { HomeStatsStrip } from '@/components/home/HomeStatsStrip';
import { MessageCircle, Sparkles, Plane, Search, Compass } from 'lucide-react';
import { EASE_CURVE, STAGGER_DELAY, DURATION_MEDIUM } from '@/lib/motion';
import type { HomeState } from '@/components/home/homeTypes';

const SHORTCUTS = [
  { label: 'AI Chat', icon: MessageCircle, path: '/ai/chat' },
  { label: 'Style Me', icon: Sparkles, path: '/ai/generate' },
  { label: 'Travel Capsule', icon: Plane, path: '/plan/travel-capsule' },
  { label: 'Wardrobe Gaps', icon: Search, path: '/gaps' },
  { label: 'Discover', icon: Compass, path: '/discover' },
] as const;

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
  const { data: allOutfits } = useOutfits();
  useFirstRunCoach();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { data: todayOutfits, isLoading: isOutfitsLoading } = usePlannedOutfitsForDate(todayStr);
  const { effectiveCity } = useLocation();
  const { weather } = useWeather({ city: effectiveCity });
  const reducedMotion = !!useReducedMotion();

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

  const dateLocale = useMemo(
    () => DATE_FNS_LOCALE_MAP[locale as string] ?? enUS,
    [locale],
  );
  const formattedDate = useMemo(
    () => format(new Date(), 'EEEE, MMMM d', { locale: dateLocale }).toUpperCase(),
    [dateLocale],
  );

  const todayOutfit = todayOutfits?.[0]?.outfit ?? null;

  const weatherSummary = weather
    ? `${Math.round(weather.temperature)}\u00B0 ${t(weather.condition)}`
    : null;

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
  }, [homeState, navigate, t]);

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
  }, [homeState, navigate, todayOutfit, t]);

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
          {/* Editorial header */}
          <motion.header
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="flex items-start justify-between gap-3"
          >
            <div>
              <p className="caption-upper mb-1 text-muted-foreground/50">
                {formattedDate}
              </p>
              <h1 className="font-display italic text-[1.55rem] leading-tight tracking-[-0.01em] text-foreground">
                {getGreeting()}
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-1">
              <WeatherPill />
              {profile?.display_name && (
                <button
                  onClick={() => { hapticLight(); navigate('/settings'); }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/60 text-[14px] font-semibold text-foreground transition-transform active:scale-95 cursor-pointer"
                  aria-label={t('home.settings_aria')}
                >
                  {profile.display_name.charAt(0).toUpperCase()}
                </button>
              )}
            </div>
          </motion.header>

          {/* Hero: Today's Look */}
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

          {/* Stats strip */}
          <HomeStatsStrip
            garmentCount={garmentCount ?? 0}
            outfitCount={allOutfits?.length ?? 0}
            streakDays={todayOutfits?.filter(o => o.status === 'worn').length ? 1 : 0}
          />

          {/* Quick Shortcuts */}
          <QuickShortcuts navigate={navigate} t={t} reducedMotion={reducedMotion} />
        </AnimatedPage>
      </PullToRefresh>
    </AppLayout>
  );
}

/* ── Quick Shortcuts Grid ─────────────────────────────────── */

function QuickShortcuts({
  navigate,
  t,
  reducedMotion,
}: {
  navigate: ReturnType<typeof useNavigate>;
  t: (key: string) => string;
  reducedMotion: boolean;
}) {
  return (
    <motion.section
      initial={reducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE, delay: STAGGER_DELAY * 6 }}
    >
      <p className="label-editorial text-muted-foreground/60 mb-3">
        {t('home.quick_actions') || 'EXPLORE'}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {SHORTCUTS.map((s, i) => (
          <motion.button
            key={s.path}
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: DURATION_MEDIUM,
              ease: EASE_CURVE,
              delay: STAGGER_DELAY * (7 + i),
            }}
            onClick={() => { hapticLight(); navigate(s.path); }}
            className="surface-secondary flex items-center gap-3 rounded-[1.25rem] px-4 py-4 text-left transition-transform active:scale-[0.97] cursor-pointer"
          >
            <s.icon className="h-5 w-5 shrink-0 text-accent" strokeWidth={1.6} />
            <span className="text-[0.9rem] font-medium text-foreground">{s.label}</span>
          </motion.button>
        ))}
      </div>
    </motion.section>
  );
}
