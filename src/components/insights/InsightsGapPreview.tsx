import { useEffect, useState } from 'react';
import { ArrowUpRight, LockKeyhole, Radar, RefreshCw, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import { buildGapsPath, loadGapSnapshot, subscribeGapSnapshot } from '@/components/gaps/gapRouteState';
import { useAuth } from '@/contexts/AuthContext';
import { useGarmentCount } from '@/hooks/useGarments';
import { useWardrobeUnlocks } from '@/hooks/useWardrobeUnlocks';
import { Button } from '@/components/ui/button';

export function InsightsGapPreview() {
  const { user } = useAuth();
  const { data: garmentCount } = useGarmentCount();
  const { isUnlocked } = useWardrobeUnlocks();
  const unlocked = isUnlocked('gap_analysis');
  const [snapshot, setSnapshot] = useState(() => loadGapSnapshot(user?.id));
  const featuredGap = snapshot?.results?.[0] ?? null;

  useEffect(() => {
    setSnapshot(loadGapSnapshot(user?.id));
  }, [user?.id]);

  useEffect(() => {
    return subscribeGapSnapshot(user?.id, () => {
      setSnapshot(loadGapSnapshot(user?.id));
    });
  }, [user?.id]);

  if (!unlocked) {
    return (
      <div className="surface-secondary space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-secondary/65 text-foreground/70">
            <LockKeyhole className="size-4.5" />
          </div>
          <div className="space-y-1.5">
            <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/65">
              Gaps
            </p>
            <h3 className="text-[1.02rem] font-semibold tracking-[-0.03em] text-foreground">
              Add a little more wardrobe depth first
            </h3>
            <p className="text-[0.84rem] leading-5 text-muted-foreground">
              Gap analysis gets useful once there are enough pieces to compare.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-[1rem] bg-background/60 p-3.5">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground/65">
              Current wardrobe
            </p>
            <p className="mt-1 text-[1.15rem] font-semibold tracking-[-0.04em] text-foreground">
              {garmentCount ?? 0} pieces
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-full px-4">
            <Link to={buildGapsPath()}>
              Open gaps
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!featuredGap) {
    return (
      <div className="surface-secondary space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-secondary/65 text-foreground/70">
            <Radar className="size-4.5" />
          </div>
          <div className="space-y-1.5">
            <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/65">
              Gaps
            </p>
            <h3 className="text-[1.02rem] font-semibold tracking-[-0.03em] text-foreground">
              Run the dedicated gap scan
            </h3>
            <p className="text-[0.84rem] leading-5 text-muted-foreground">
              The full page scores missing categories, color direction, and the highest-impact addition.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button asChild className="h-11 justify-between rounded-full px-4">
            <Link to={buildGapsPath({ autorun: true })}>
              Run scan
              <Sparkles className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 justify-between rounded-full px-4">
            <Link to={buildGapsPath()}>
              Open gaps
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="surface-secondary space-y-3 p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-secondary/65 text-foreground/70">
          <Radar className="size-4.5" />
        </div>
        <div className="space-y-1.5">
          <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/65">
            Gaps
          </p>
          <h3 className="text-[1.02rem] font-semibold tracking-[-0.03em] text-foreground">
            Best next addition: {featuredGap.item}
          </h3>
          <p className="text-[0.84rem] leading-5 text-muted-foreground">
            {featuredGap.reason}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-[1rem] bg-background/60 p-3">
          <p className="text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground/65">
            Lift
          </p>
          <p className="mt-1 text-[1.12rem] font-semibold tracking-[-0.04em] text-foreground">
            +{featuredGap.new_outfits}
          </p>
        </div>
        <div className="rounded-[1rem] bg-background/60 p-3">
          <p className="text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground/65">
            Direction
          </p>
          <p className="mt-1 text-[0.86rem] font-medium text-foreground">
            {featuredGap.color}
          </p>
        </div>
        <div className="rounded-[1rem] bg-background/60 p-3">
          <p className="text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground/65">
            Budget
          </p>
          <p className="mt-1 text-[0.86rem] font-medium text-foreground">
            {featuredGap.price_range}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button asChild className="h-11 justify-between rounded-full px-4">
          <Link to={buildGapsPath()}>
            Open full scan
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11 justify-between rounded-full px-4">
          <Link to={buildGapsPath({ autorun: true })}>
            Refresh
            <RefreshCw className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
