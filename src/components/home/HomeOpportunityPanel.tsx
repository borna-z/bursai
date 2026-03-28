import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  LockKeyhole,
  Radar,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWardrobeUnlocks } from '@/hooks/useWardrobeUnlocks';
import { useWardrobeGapAnalysis } from '@/hooks/useAdvancedFeatures';
import type { HomeGapResultSummary, HomeOpportunityState } from '@/components/home/homeTypes';
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
  const { t, locale } = useLanguage();
  const { isUnlocked, garmentsNeeded, currentCount } = useWardrobeUnlocks();
  const gapAnalysis = useWardrobeGapAnalysis();
  const [results, setResults] = useState<GapResult[] | null>(null);

  const state = useMemo<HomeOpportunityState>(() => {
    if (!isUnlocked('gap_analysis')) {
      return {
        kind: 'locked',
        garmentsNeeded,
        currentCount,
        targetCount: 10,
      };
    }

    if (gapAnalysis.isPending) return { kind: 'scanning' };
    if (gapAnalysis.isError) return { kind: 'error' };
    if (results && results.length > 0) {
      return {
        kind: 'results',
        topResult: toSummary(results[0]),
        extraCount: Math.max(results.length - 1, 0),
      };
    }
    if (results && results.length === 0) return { kind: 'complete' };
    return { kind: 'ready' };
  }, [currentCount, gapAnalysis.isError, gapAnalysis.isPending, garmentsNeeded, isUnlocked, results]);

  async function runScan() {
    const data = await gapAnalysis.mutateAsync({ locale });
    setResults(data.gaps || []);
  }

  return (
    <section className="rounded-[1.6rem] border border-foreground/[0.08] bg-card p-5 shadow-[0_14px_28px_rgba(22,18,15,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-editorial text-muted-foreground/60">{t('home.opportunity_discover')}</p>
          <h2 className="mt-1 text-[1.25rem] font-semibold tracking-[-0.03em] text-foreground">
            {t('home.opportunity_wardrobe_gaps')}
          </h2>
        </div>
        <div className="flex size-11 items-center justify-center rounded-[1rem] bg-secondary/65 text-foreground/70">
          <Radar className="size-5" />
        </div>
      </div>

      {state.kind === 'locked' ? (
        <div data-testid="home-opportunity-locked" className="mt-4 space-y-4 rounded-[1.2rem] bg-secondary/45 p-4">
          <div className="inline-flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">
            <LockKeyhole className="size-3.5" />
            {t('home.opportunity_to_unlock').replace('{count}', String(state.garmentsNeeded))}
          </div>
          <p className="text-[0.94rem] leading-6 text-foreground">
            {t('home.opportunity_locked_desc')}
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">
              <span>{t('home.opportunity_progress')}</span>
              <span>{state.currentCount}/{state.targetCount}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-foreground/[0.08]">
              <div
                className="h-full rounded-full bg-accent/65"
                style={{ width: `${getProgressPercentage(state.currentCount, state.targetCount)}%` }}
              />
            </div>
          </div>
          <Button onClick={() => navigate('/wardrobe/add')} variant="outline" className="rounded-full px-4">
            {t('home.opportunity_add_garments')}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      ) : null}

      {state.kind === 'ready' ? (
        <div data-testid="home-opportunity-ready" className="mt-4 rounded-[1.2rem] bg-secondary/45 p-4">
          <p className="text-[0.94rem] leading-6 text-foreground">
            {t('home.opportunity_ready_desc')}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void runScan()} className="rounded-full px-4">
              <Sparkles className="size-4" />
              {t('home.opportunity_run_scan')}
            </Button>
            <Button onClick={() => navigate('/discover')} variant="outline" className="rounded-full px-4">
              {t('home.opportunity_open_discover')}
            </Button>
          </div>
        </div>
      ) : null}

      {state.kind === 'scanning' ? (
        <div data-testid="home-opportunity-scanning" className="mt-4 rounded-[1.2rem] bg-secondary/45 p-4">
          <div className="inline-flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">
            <RefreshCw className="size-3.5 animate-spin" />
            {t('home.opportunity_scanning')}
          </div>
          <p className="mt-3 text-[0.94rem] leading-6 text-foreground">
            {t('home.opportunity_scanning_desc')}
          </p>
        </div>
      ) : null}

      {state.kind === 'results' ? (
        <div data-testid="home-opportunity-results" className="mt-4 rounded-[1.2rem] bg-secondary/45 p-4">
          <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">
            {t('home.opportunity_top_unlock')}
          </p>
          <h3 className="mt-2 text-[1.12rem] font-semibold tracking-[-0.025em] text-foreground">
            {state.topResult.item}
          </h3>
          <p className="mt-1 text-[0.88rem] text-muted-foreground">
            {state.topResult.color} {state.topResult.category} · {t('home.opportunity_looks').replace('{count}', String(state.topResult.newOutfits))}
          </p>
          <p className="mt-3 text-[0.94rem] leading-6 text-foreground">
            {state.topResult.reason}
          </p>
          <p className="mt-2 text-[0.86rem] text-muted-foreground">
            {state.topResult.priceRange}
            {state.extraCount > 0 ? ` · ${t('home.opportunity_more_ideas').replace('{count}', String(state.extraCount))}` : ''}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => navigate('/discover')} className="rounded-full px-4">
              {t('home.opportunity_discover_all')}
            </Button>
            <Button onClick={() => void runScan()} variant="outline" className="rounded-full px-4">
              {t('home.opportunity_refresh')}
            </Button>
          </div>
        </div>
      ) : null}

      {state.kind === 'complete' ? (
        <div data-testid="home-opportunity-complete" className="mt-4 rounded-[1.2rem] bg-secondary/45 p-4">
          <p className="text-[0.94rem] leading-6 text-foreground">
            {t('home.opportunity_complete_desc')}
          </p>
          <Button onClick={() => navigate('/discover')} variant="outline" className="mt-4 rounded-full px-4">
            {t('home.opportunity_open_discover')}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      ) : null}

      {state.kind === 'error' ? (
        <div data-testid="home-opportunity-error" className="mt-4 rounded-[1.2rem] bg-secondary/45 p-4">
          <p className="text-[0.94rem] leading-6 text-foreground">
            {t('home.opportunity_error_desc')}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void runScan()} className="rounded-full px-4">
              {t('home.opportunity_retry')}
            </Button>
            <Button onClick={() => navigate('/discover')} variant="outline" className="rounded-full px-4">
              {t('home.opportunity_open_discover')}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
