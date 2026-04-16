import { useMemo } from 'react';

import { ArrowUpRight, LockKeyhole, Radar, RefreshCw, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import { buildGapsPath, loadGapSnapshot } from '@/components/gaps/gapRouteState';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGarmentCount } from '@/hooks/useGarments';
import { useWardrobeUnlocks } from '@/hooks/useWardrobeUnlocks';
import { Button } from '@/components/ui/button';

export function InsightsGapPreview() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: garmentCount } = useGarmentCount();
  const { isUnlocked } = useWardrobeUnlocks();
  const unlocked = isUnlocked('gap_analysis');
  const snapshot = useMemo(() => loadGapSnapshot(user?.id), [user?.id]);
  const featuredGap = snapshot?.results?.[0] ?? null;

  if (!unlocked) {
    return (
      <div className="surface-secondary space-y-4 p-4">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-[1rem] bg-secondary/65 text-foreground/70">
            <LockKeyhole className="size-5" />
          </div>
          <div className="space-y-1.5">
            <p className="label-editorial">{t('gaps.preview_label') || 'Gap analysis'}</p>
            <h3 className="text-[1.05rem] font-semibold tracking-[-0.03em] text-foreground">
              {t('gaps.preview_locked_title') || 'Unlock more wardrobe depth first'}
            </h3>
            <p className="text-[0.9rem] leading-6 text-muted-foreground">
              {t('gaps.preview_locked_desc') || 'Gap analysis becomes useful once the wardrobe has enough pieces to compare. Add a few more garments, then open the full gaps tool.'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-[1rem] bg-background/60 p-4">
          <div>
            <p className="text-[0.76rem] uppercase tracking-[0.18em] text-muted-foreground/65">
              {t('gaps.preview_current_wardrobe') || 'Current wardrobe'}
            </p>
            <p className="mt-1 text-[1.35rem] font-semibold tracking-[-0.04em] text-foreground">
              {garmentCount ?? 0} {t('capsule.stat_pieces') || 'pieces'}
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-full px-4">
            <Link to={buildGapsPath()}>
              {t('gaps.preview_open_tool') || 'Open gaps tool'}
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!featuredGap) {
    return (
      <div className="surface-secondary space-y-4 p-4">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-[1rem] bg-secondary/65 text-foreground/70">
            <Radar className="size-5" />
          </div>
          <div className="space-y-1.5">
            <p className="label-editorial">{t('gaps.preview_label') || 'Gap analysis'}</p>
            <h3 className="text-[1.05rem] font-semibold tracking-[-0.03em] text-foreground">
              {t('gaps.preview_ready_title') || 'Run the dedicated gaps scan'}
            </h3>
            <p className="text-[0.9rem] leading-6 text-muted-foreground">
              {t('gaps.preview_ready_desc') || 'The full gaps workflow scores missing categories, color direction, and high-impact additions, then keeps the scan results available on the dedicated page.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Button asChild className="rounded-full px-5">
            <Link to={buildGapsPath({ autorun: true })}>
              <Sparkles className="size-4" />
              {t('gaps.run_scan')}
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link to={buildGapsPath()}>
              {t('gaps.preview_open_tool') || 'Open gaps tool'}
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="surface-secondary space-y-4 p-4">
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-[1rem] bg-secondary/65 text-foreground/70">
          <Radar className="size-5" />
        </div>
        <div className="space-y-1.5">
          <p className="label-editorial">{t('gaps.preview_label') || 'Gap analysis'}</p>
          <h3 className="text-[1.05rem] font-semibold tracking-[-0.03em] text-foreground">
            {t('gaps.preview_best_addition') || 'Best next addition:'} {featuredGap.item}
          </h3>
          <p className="text-[0.9rem] leading-6 text-muted-foreground">
            {featuredGap.reason}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-[1rem] bg-background/60 p-3">
          <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/65">
            {t('gaps.preview_lift') || 'Lift'}
          </p>
          <p className="mt-1 text-[1.2rem] font-semibold tracking-[-0.04em] text-foreground">
            +{featuredGap.new_outfits}
          </p>
        </div>
        <div className="rounded-[1rem] bg-background/60 p-3">
          <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/65">
            {t('gaps.preview_direction') || 'Direction'}
          </p>
          <p className="mt-1 text-[0.95rem] font-medium text-foreground">
            {featuredGap.color} / {featuredGap.category}
          </p>
        </div>
        <div className="rounded-[1rem] bg-background/60 p-3">
          <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/65">
            {t('gaps.preview_budget') || 'Budget'}
          </p>
          <p className="mt-1 text-[0.95rem] font-medium text-foreground">
            {featuredGap.price_range}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <Button asChild className="rounded-full px-5">
          <Link to={buildGapsPath()}>
            {t('gaps.preview_open_full') || 'Open full scan'}
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full px-5">
          <Link to={buildGapsPath({ autorun: true })}>
            <RefreshCw className="size-4" />
            {t('gaps.refresh_scan')}
          </Link>
        </Button>
      </div>
    </div>
  );
}
