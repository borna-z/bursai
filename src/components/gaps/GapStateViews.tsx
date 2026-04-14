import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  LockKeyhole,
  Plus,
  Radar,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { WardrobeProgress } from '@/components/discover/WardrobeProgress';
import { AILoadingOverlay } from '@/components/ui/AILoadingOverlay';
import { Button } from '@/components/ui/button';
import { EASE_CURVE } from '@/lib/motion';
import { useLanguage } from '@/contexts/LanguageContext';

function StateSurface({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_CURVE }}
      className={`relative overflow-hidden rounded-[1.25rem] border border-foreground/[0.08] bg-card/95 p-5 shadow-[0_18px_45px_rgba(18,18,18,0.05)] ${className}`}
    >
      {children}
    </motion.section>
  );
}

export function GapHero({
  currentCount,
  isUnlocked,
  hasSnapshot,
}: {
  currentCount: number;
  isUnlocked: boolean;
  hasSnapshot: boolean;
}) {
  const { t } = useLanguage();
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_CURVE }}
      className="relative overflow-hidden rounded-[1.25rem] border border-foreground/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(205,180,142,0.18),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,244,238,0.92))] px-5 py-6 shadow-[0_24px_60px_rgba(23,18,14,0.06)]"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="max-w-[32rem]">
          <p className="text-[0.72rem] uppercase tracking-[0.24em] text-muted-foreground/65">
            {t('gaps.wardrobe_intelligence')}
          </p>
          <h1 className="mt-3 text-[2rem] font-semibold tracking-[-0.06em] text-foreground sm:text-[2.4rem]">
            {t('gaps.garment_gaps')}
          </h1>
          <p className="mt-3 max-w-[30rem] text-[0.95rem] leading-6 text-muted-foreground">
            {t('gaps.hero_description')}
          </p>
        </div>
        <div className="flex size-12 shrink-0 items-center justify-center rounded-[1.1rem] bg-background/70 text-foreground/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          <Radar className="size-5" />
        </div>
      </div>

      <div className="relative mt-6 flex flex-wrap gap-2.5 text-[0.76rem] text-muted-foreground/80">
        <span className="rounded-full border border-foreground/[0.08] bg-background/75 px-3 py-1.5">
          {t('gaps.pieces_in_wardrobe').replace('{count}', String(currentCount))}
        </span>
        <span className="rounded-full border border-foreground/[0.08] bg-background/75 px-3 py-1.5">
          {isUnlocked ? t('gaps.gap_analysis_unlocked') : t('gaps.unlocks_at_10')}
        </span>
        {hasSnapshot ? (
          <span className="rounded-full border border-foreground/[0.08] bg-background/75 px-3 py-1.5">
            {t('gaps.previous_scan_ready')}
          </span>
        ) : null}
      </div>
    </motion.section>
  );
}

export function GapLockedState() {
  const { t } = useLanguage();
  return (
    <StateSurface>
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-[1rem] bg-secondary/65 text-foreground/70">
          <LockKeyhole className="size-5" />
        </div>
        <div className="space-y-2">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
            {t('gaps.locked_label')}
          </p>
          <h2 className="text-[1.2rem] font-semibold tracking-[-0.035em] text-foreground">
            {t('gaps.locked_title')}
          </h2>
          <p className="max-w-[36rem] text-[0.94rem] leading-6 text-muted-foreground">
            {t('gaps.locked_desc')}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-[1.25rem] border border-foreground/[0.06] bg-background/70 p-4">
        <WardrobeProgress compact />
      </div>
    </StateSurface>
  );
}

export function GapReadyState({
  onScan,
}: {
  onScan: () => void;
}) {
  const { t } = useLanguage();
  return (
    <StateSurface>
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-[1rem] bg-secondary/65 text-foreground/70">
          <Sparkles className="size-5" />
        </div>
        <div className="space-y-2">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
            {t('gaps.ready_label')}
          </p>
          <h2 className="text-[1.2rem] font-semibold tracking-[-0.035em] text-foreground">
            {t('gaps.ready_title')}
          </h2>
          <p className="max-w-[36rem] text-[0.94rem] leading-6 text-muted-foreground">
            {t('gaps.ready_desc')}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 text-[0.88rem] text-muted-foreground sm:grid-cols-3">
        <div className="rounded-[1.2rem] border border-foreground/[0.06] bg-background/70 p-4">
          {t('gaps.chip_categories')}
        </div>
        <div className="rounded-[1.2rem] border border-foreground/[0.06] bg-background/70 p-4">
          {t('gaps.chip_color')}
        </div>
        <div className="rounded-[1.2rem] border border-foreground/[0.06] bg-background/70 p-4">
          {t('gaps.chip_shopping')}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <Button onClick={onScan} className="rounded-full px-5">
          <Search className="size-4" />
          {t('gaps.run_scan')}
        </Button>
      </div>
    </StateSurface>
  );
}

export function GapAutorunState() {
  const { t } = useLanguage();
  return (
    <StateSurface>
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-[1rem] bg-secondary/65 text-foreground/70">
          <ArrowRight className="size-5" />
        </div>
        <div className="space-y-2">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
            {t('gaps.autorun_label')}
          </p>
          <h2 className="text-[1.2rem] font-semibold tracking-[-0.035em] text-foreground">
            {t('gaps.autorun_title')}
          </h2>
          <p className="max-w-[36rem] text-[0.94rem] leading-6 text-muted-foreground">
            {t('gaps.autorun_desc')}
          </p>
        </div>
      </div>
    </StateSurface>
  );
}

export function GapLoadingState() {
  const { t } = useLanguage();
  return (
    <StateSurface>
      <div className="mb-5 space-y-2">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
          {t('gaps.scanning_label')}
        </p>
        <h2 className="text-[1.2rem] font-semibold tracking-[-0.035em] text-foreground">
          {t('gaps.scanning_title')}
        </h2>
        <p className="max-w-[36rem] text-[0.94rem] leading-6 text-muted-foreground">
          {t('gaps.scanning_desc')}
        </p>
      </div>

      <AILoadingOverlay
        variant="card"
        tone="warm"
        phases={[
          { icon: Search, label: t('gaps.scanning_phase1'), duration: 2200 },
          { icon: Sparkles, label: t('gaps.scanning_phase2'), duration: 2200 },
          { icon: ShoppingBag, label: t('gaps.scanning_phase3'), duration: 0 },
        ]}
        subtitle={t('gaps.scanning_subtitle')}
        showSkeletons={3}
        className="border-none bg-background/55 p-0 shadow-none"
      />
    </StateSurface>
  );
}

export function GapErrorState({
  onRetry,
}: {
  onRetry: () => void;
}) {
  const { t } = useLanguage();
  return (
    <StateSurface>
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-[1rem] bg-destructive/10 text-destructive">
          <AlertCircle className="size-5" />
        </div>
        <div className="space-y-2">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
            {t('gaps.error_label')}
          </p>
          <h2 className="text-[1.2rem] font-semibold tracking-[-0.035em] text-foreground">
            {t('gaps.error_title')}
          </h2>
          <p className="max-w-[36rem] text-[0.94rem] leading-6 text-muted-foreground">
            {t('gaps.error_desc')}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <Button onClick={onRetry} className="rounded-full px-5">
          <RefreshCw className="size-4" />
          {t('gaps.retry_scan')}
        </Button>
      </div>
    </StateSurface>
  );
}

export function GapInsufficientWardrobeState({
  currentCount,
  requiredCount,
}: {
  currentCount?: number;
  requiredCount?: number;
}) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const current = currentCount ?? 0;
  const required = requiredCount ?? 5;
  return (
    <StateSurface>
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-[1rem] bg-secondary/65 text-foreground/70">
          <ShoppingBag className="size-5" />
        </div>
        <div className="space-y-2">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
            {`${current}/${required}`}
          </p>
          <h2 className="text-[1.2rem] font-semibold tracking-[-0.035em] text-foreground">
            {t('gaps.insufficient_title')}
          </h2>
          <p className="max-w-[36rem] text-[0.94rem] leading-6 text-muted-foreground">
            {t('gaps.insufficient_desc')}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <Button
          onClick={() => navigate('/wardrobe/add')}
          className="rounded-full px-5"
        >
          <Plus className="size-4" />
          {t('gaps.insufficient_cta')}
        </Button>
      </div>
    </StateSurface>
  );
}

export function GapNoGapsState({
  onRefresh,
}: {
  onRefresh: () => void;
}) {
  const { t } = useLanguage();
  return (
    <StateSurface>
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-[1rem] bg-secondary/65 text-foreground/70">
          <ShoppingBag className="size-5" />
        </div>
        <div className="space-y-2">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
            {t('gaps.balanced_label')}
          </p>
          <h2 className="text-[1.2rem] font-semibold tracking-[-0.035em] text-foreground">
            {t('gaps.no_gaps_title')}
          </h2>
          <p className="max-w-[36rem] text-[0.94rem] leading-6 text-muted-foreground">
            {t('gaps.no_gaps_desc')}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <Button onClick={onRefresh} variant="outline" className="rounded-full px-5">
          <RefreshCw className="size-4" />
          {t('gaps.run_fresh_scan')}
        </Button>
      </div>
    </StateSurface>
  );
}
