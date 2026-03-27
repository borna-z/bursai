import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, LockKeyhole, Radar, RefreshCw, Sparkles } from 'lucide-react';
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

export function HomeOpportunityPanel() {
  const navigate = useNavigate();
  const { locale } = useLanguage();
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

  function openDiscover() {
    navigate('/discover');
  }

  function openWardrobeAdd() {
    navigate('/wardrobe/add');
  }

  return (
    <section className="rounded-[1.75rem] border border-foreground/[0.08] bg-card p-5 shadow-[0_14px_30px_rgba(22,18,15,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-editorial text-muted-foreground/60">Opportunity</p>
          <h2 className="mt-1 text-[1.3rem] font-semibold tracking-[-0.03em] text-foreground">
            Wardrobe leverage
          </h2>
        </div>
        <div className="flex size-11 items-center justify-center rounded-[1rem] bg-secondary/65 text-foreground/70">
          <Radar className="size-5" />
        </div>
      </div>

      {state.kind === 'locked' ? (
        <div data-testid="home-opportunity-locked" className="mt-5 rounded-[1.2rem] bg-secondary/45 p-4">
          <div className="flex items-center gap-2 text-[0.74rem] uppercase tracking-[0.18em] text-muted-foreground/70">
            <LockKeyhole className="size-3.5" />
            Unlocks at 10 garments
          </div>
          <p className="mt-3 text-[0.96rem] leading-7 text-foreground">
            You are {state.garmentsNeeded} garments away. Once you hit {state.targetCount}, BURS can start mapping the pieces that would unlock the most new outfits.
          </p>
          <Button onClick={openWardrobeAdd} variant="outline" className="mt-4 rounded-full px-4">
            Add garments
            <ArrowRight className="size-4" />
          </Button>
        </div>
      ) : null}

      {state.kind === 'ready' ? (
        <div data-testid="home-opportunity-ready" className="mt-5 rounded-[1.2rem] bg-secondary/45 p-4">
          <p className="text-[0.96rem] leading-7 text-foreground">
            Scan your wardrobe for the highest-leverage additions, gaps, and outfit unlocks before you shop or style.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void runScan()} className="rounded-full px-4">
              <Sparkles className="size-4" />
              Scan opportunities
            </Button>
            <Button onClick={openDiscover} variant="outline" className="rounded-full px-4">
              Open Discover
            </Button>
          </div>
        </div>
      ) : null}

      {state.kind === 'scanning' ? (
        <div data-testid="home-opportunity-scanning" className="mt-5 rounded-[1.2rem] bg-secondary/45 p-4">
          <div className="inline-flex items-center gap-2 text-[0.74rem] uppercase tracking-[0.18em] text-muted-foreground/70">
            <RefreshCw className="size-3.5 animate-spin" />
            Mapping wardrobe opportunities
          </div>
          <p className="mt-3 text-[0.96rem] leading-7 text-foreground">
            BURS is checking which missing pieces would create the biggest lift across your current wardrobe.
          </p>
        </div>
      ) : null}

      {state.kind === 'results' ? (
        <div data-testid="home-opportunity-results" className="mt-5 rounded-[1.2rem] bg-secondary/45 p-4">
          <p className="text-[0.74rem] uppercase tracking-[0.18em] text-muted-foreground/70">
            Top unlock piece
          </p>
          <h3 className="mt-2 text-[1.15rem] font-semibold tracking-[-0.025em] text-foreground">
            {state.topResult.item}
          </h3>
          <p className="mt-1 text-[0.92rem] text-muted-foreground">
            {state.topResult.color} {state.topResult.category} · +{state.topResult.newOutfits} new looks
          </p>
          <p className="mt-3 text-[0.96rem] leading-7 text-foreground">
            {state.topResult.reason}
          </p>
          <p className="mt-2 text-[0.9rem] text-muted-foreground">
            Price range: {state.topResult.priceRange}
            {state.extraCount > 0 ? ` · ${state.extraCount} more ideas waiting` : ''}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={openDiscover} className="rounded-full px-4">
              Discover all
            </Button>
            <Button onClick={() => void runScan()} variant="outline" className="rounded-full px-4">
              Refresh
            </Button>
          </div>
        </div>
      ) : null}

      {state.kind === 'complete' ? (
        <div data-testid="home-opportunity-complete" className="mt-5 rounded-[1.2rem] bg-secondary/45 p-4">
          <p className="text-[0.96rem] leading-7 text-foreground">
            Your wardrobe currently looks balanced. Open Discover for deeper gap analysis, shopping ideas, and leverage tracking.
          </p>
          <Button onClick={openDiscover} variant="outline" className="mt-4 rounded-full px-4">
            Open Discover
            <ArrowRight className="size-4" />
          </Button>
        </div>
      ) : null}

      {state.kind === 'error' ? (
        <div data-testid="home-opportunity-error" className="mt-5 rounded-[1.2rem] bg-secondary/45 p-4">
          <p className="text-[0.96rem] leading-7 text-foreground">
            BURS could not finish the scan just now. You can retry here or open Discover directly.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void runScan()} className="rounded-full px-4">
              Retry scan
            </Button>
            <Button onClick={openDiscover} variant="outline" className="rounded-full px-4">
              Open Discover
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
