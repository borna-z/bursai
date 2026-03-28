import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  LockKeyhole,
  Radar,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { buildGapsPath, loadGapSnapshot, subscribeGapSnapshot } from '@/components/gaps/gapRouteState';
import { StaleIndicator } from '@/components/ui/StaleIndicator';
import { useWardrobeUnlocks } from '@/hooks/useWardrobeUnlocks';
import type { HomeGapResultSummary } from '@/components/home/homeTypes';
import { Button } from '@/components/ui/button';

type GapResult = {
  item: string;
  category: string;
  color: string;
  reason: string;
  new_outfits: number;
  price_range: string;
  search_query: string;
};

function interpolate(text: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    text,
  );
}

function toSummary(gap: GapResult): HomeGapResultSummary {
  return {
    item: gap.item,
    category: gap.category,
    color: gap.color,
    reason: gap.reason,
    newOutfits: gap.new_outfits,
    priceRange: gap.price_range,
  };
}

function getProgressPercentage(currentCount: number, targetCount: number) {
  if (targetCount <= 0) return 0;
  return Math.min((currentCount / targetCount) * 100, 100);
}

export function HomeOpportunityPanel() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isUnlocked, garmentsNeeded, currentCount } = useWardrobeUnlocks();
  const [snapshot, setSnapshot] = useState(() => loadGapSnapshot(user?.id));
  const results = snapshot?.results ?? null;
  const analysisTimestamp = snapshot?.analyzedAt ?? null;

  useEffect(() => {
    setSnapshot(loadGapSnapshot(user?.id));
  }, [user?.id]);

  useEffect(() => {
    return subscribeGapSnapshot(user?.id, () => {
      setSnapshot(loadGapSnapshot(user?.id));
    });
  }, [user?.id]);

  const state = useMemo(() => {
    if (!isUnlocked('gap_analysis')) {
      return {
        kind: 'locked' as const,
        garmentsNeeded,
        currentCount,
        targetCount: 10,
      };
    }

    if (results && results.length > 0) {
      return {
        kind: 'results' as const,
        topResult: toSummary(results[0]),
        extraCount: Math.max(results.length - 1, 0),
        analyzedAt: analysisTimestamp,
      };
    }

    if (results && results.length === 0) {
      return {
        kind: 'complete' as const,
        analyzedAt: analysisTimestamp,
      };
    }

    return { kind: 'ready' as const };
  }, [analysisTimestamp, currentCount, garmentsNeeded, isUnlocked, results]);

  function openGaps() {
    navigate(buildGapsPath());
  }

  function runScan() {
    navigate(buildGapsPath({ autorun: true }), {
      state: {
        autorun: true,
        source: 'home',
      },
    });
  }

  return (
    <section className="overflow-hidden rounded-[1.55rem] border border-foreground/[0.08] bg-card/95 shadow-[0_14px_28px_rgba(22,18,15,0.04)]">
      <div className="flex items-start justify-between gap-3 border-b border-foreground/[0.06] px-4 py-4">
        <div className="min-w-0">
          <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/65">
            {t('home.gaps.panel_kicker')}
          </p>
          <h2 className="mt-1 text-[1.08rem] font-semibold tracking-[-0.03em] text-foreground">
            {t('home.gaps.title')}
          </h2>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-secondary/70 text-foreground/70">
          <Radar className="size-4.5" />
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        {state.kind === 'locked' ? (
          <div data-testid="home-opportunity-locked" className="space-y-3">
            <div className="flex items-start gap-3 rounded-[1.1rem] bg-secondary/40 p-3.5">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[0.9rem] bg-background/75 text-foreground/70">
                <LockKeyhole className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[0.92rem] font-medium text-foreground">
                  {interpolate(t('home.gaps.locked_kicker'), { count: state.garmentsNeeded })}
                </p>
                <p className="mt-1 text-[0.82rem] leading-5 text-muted-foreground">
                  {t('home.gaps.locked_desc')}
                </p>
              </div>
            </div>

            <div className="rounded-[1.1rem] border border-foreground/[0.07] bg-background/70 p-3.5">
              <div className="flex items-center justify-between text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground/70">
                <span>{t('common.progress')}</span>
                <span>{state.currentCount}/{state.targetCount}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-foreground/[0.08]">
                <div
                  className="h-full rounded-full bg-accent/70"
                  style={{ width: `${getProgressPercentage(state.currentCount, state.targetCount)}%` }}
                />
              </div>
            </div>

            <Button onClick={() => navigate('/wardrobe/add')} variant="outline" className="h-11 w-full justify-between rounded-full px-4">
              {t('common.add_garments')}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        ) : null}

        {state.kind === 'ready' ? (
          <div data-testid="home-opportunity-ready" className="space-y-3">
            <div className="rounded-[1.1rem] bg-secondary/40 p-3.5">
              <p className="text-[0.92rem] font-medium text-foreground">
                {t('home.gaps.ready_title')}
              </p>
              <p className="mt-1 text-[0.82rem] leading-5 text-muted-foreground">
                {t('home.gaps.ready_desc')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={runScan} className="h-11 justify-between rounded-full px-4">
                {t('home.gaps.run_scan')}
                <Sparkles className="size-4" />
              </Button>
              <Button onClick={openGaps} variant="outline" className="h-11 justify-between rounded-full px-4">
                {t('home.gaps.open_full_scan')}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {state.kind === 'results' ? (
          <div data-testid="home-opportunity-results" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground/70">
                {t('home.gaps.top_unlock')}
              </p>
              <StaleIndicator updatedAt={state.analyzedAt} />
            </div>

            <div className="rounded-[1.1rem] bg-secondary/40 p-3.5">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[1.05rem] font-semibold tracking-[-0.03em] text-foreground">
                    {state.topResult.item}
                  </h3>
                  <p className="mt-1 text-[0.8rem] text-muted-foreground">
                    {state.topResult.color} / {state.topResult.category}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[1.25rem] font-semibold tracking-[-0.05em] text-foreground">
                    +{state.topResult.newOutfits}
                  </p>
                  <p className="text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground/70">
                    {t('home.gaps.looks')}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-[0.82rem] leading-5 text-muted-foreground">
                {state.topResult.reason}
              </p>
              <p className="mt-2 text-[0.76rem] text-muted-foreground/80">
                {state.topResult.priceRange}
                {state.extraCount > 0 ? ` | ${interpolate(t('home.gaps.more_ideas'), { count: state.extraCount })}` : ''}
              </p>
            </div>

            <Button onClick={openGaps} className="h-11 w-full justify-between rounded-full px-4">
              {t('home.gaps.open_full_scan')}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        ) : null}

        {state.kind === 'complete' ? (
          <div data-testid="home-opportunity-complete" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground/70">
                {t('home.gaps.complete_kicker')}
              </p>
              <StaleIndicator updatedAt={state.analyzedAt} />
            </div>

            <div className="rounded-[1.1rem] bg-secondary/40 p-3.5">
              <p className="text-[0.92rem] font-medium text-foreground">
                {t('home.gaps.complete_title')}
              </p>
              <p className="mt-1 text-[0.82rem] leading-5 text-muted-foreground">
                {t('home.gaps.complete_desc')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={openGaps} variant="outline" className="h-11 justify-between rounded-full px-4">
                {t('home.gaps.open_full_scan')}
                <ArrowRight className="size-4" />
              </Button>
              <Button onClick={runScan} className="h-11 justify-between rounded-full px-4">
                {t('home.gaps.run_fresh_scan')}
                <Sparkles className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
