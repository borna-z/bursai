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

// Shared surface for all non-hero state views. Flat editorial card:
// bg-card (no opacity), border-border/40, no light-mode shadows, default radius.
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
      className={`relative overflow-hidden rounded-[1.25rem] border border-border/40 bg-card p-5 ${className}`}
    >
      {children}
    </motion.section>
  );
}

// Section title used inside state surfaces. Playfair Display italic, medium
// weight — matches every other editorial headline in BURS.
function StateTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display italic text-[1.3rem] font-medium leading-tight tracking-[-0.02em] text-foreground">
      {children}
    </h2>
  );
}

// Small uppercase eyebrow label — DM Sans, wide tracking, muted.
function StateEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
      {children}
    </p>
  );
}

// Rounded square icon chip used in every state header.
function StateIcon({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'destructive' }) {
  const toneClass =
    tone === 'destructive'
      ? 'bg-destructive/10 text-destructive'
      : 'bg-secondary/65 text-foreground/70';
  return (
    <div className={`flex size-11 shrink-0 items-center justify-center rounded-[1rem] ${toneClass}`}>
      {children}
    </div>
  );
}

// The hero card intentionally does NOT repeat the page title shown in
// PageHeader. It's a narrative intro: icon + description + status chips.
// Flat surface, no gradients, no shadows — matches the rest of the app.
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
      className="relative overflow-hidden rounded-[1.25rem] border border-border/40 bg-card px-5 py-6"
    >
      <div className="relative flex items-start gap-4">
        <StateIcon>
          <Radar className="size-5" />
        </StateIcon>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-display italic text-[1.05rem] leading-6 text-foreground/75">
            {t('gaps.hero_description')}
          </p>
        </div>
      </div>

      <div className="relative mt-5 flex flex-wrap gap-2 text-[0.76rem] text-muted-foreground/80">
        <span className="rounded-full border border-border/40 bg-background/60 px-3 py-1.5">
          {t('gaps.pieces_in_wardrobe').replace('{count}', String(currentCount))}
        </span>
        <span className="rounded-full border border-border/40 bg-background/60 px-3 py-1.5">
          {isUnlocked ? t('gaps.gap_analysis_unlocked') : t('gaps.unlocks_at_10')}
        </span>
        {hasSnapshot ? (
          <span className="rounded-full border border-border/40 bg-background/60 px-3 py-1.5">
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
        <StateIcon>
          <LockKeyhole className="size-5" />
        </StateIcon>
        <div className="space-y-2">
          <StateEyebrow>{t('gaps.locked_label')}</StateEyebrow>
          <StateTitle>{t('gaps.locked_title')}</StateTitle>
          <p className="max-w-[36rem] text-[0.94rem] leading-6 text-muted-foreground">
            {t('gaps.locked_desc')}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-[1.25rem] border border-border/40 bg-background/60 p-4">
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
        <StateIcon>
          <Sparkles className="size-5" />
        </StateIcon>
        <div className="space-y-2">
          <StateEyebrow>{t('gaps.ready_label')}</StateEyebrow>
          <StateTitle>{t('gaps.ready_title')}</StateTitle>
          <p className="max-w-[36rem] text-[0.94rem] leading-6 text-muted-foreground">
            {t('gaps.ready_desc')}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 text-[0.88rem] text-muted-foreground sm:grid-cols-3">
        <div className="rounded-[1.25rem] border border-border/40 bg-background/60 p-4">
          {t('gaps.chip_categories')}
        </div>
        <div className="rounded-[1.25rem] border border-border/40 bg-background/60 p-4">
          {t('gaps.chip_color')}
        </div>
        <div className="rounded-[1.25rem] border border-border/40 bg-background/60 p-4">
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
        <StateIcon>
          <ArrowRight className="size-5" />
        </StateIcon>
        <div className="space-y-2">
          <StateEyebrow>{t('gaps.autorun_label')}</StateEyebrow>
          <StateTitle>{t('gaps.autorun_title')}</StateTitle>
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
        <StateEyebrow>{t('gaps.scanning_label')}</StateEyebrow>
        <StateTitle>{t('gaps.scanning_title')}</StateTitle>
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
        <StateIcon tone="destructive">
          <AlertCircle className="size-5" />
        </StateIcon>
        <div className="space-y-2">
          <StateEyebrow>{t('gaps.error_label')}</StateEyebrow>
          <StateTitle>{t('gaps.error_title')}</StateTitle>
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
        <StateIcon>
          <ShoppingBag className="size-5" />
        </StateIcon>
        <div className="space-y-2">
          <StateEyebrow>{`${current}/${required}`}</StateEyebrow>
          <StateTitle>{t('gaps.insufficient_title')}</StateTitle>
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
        <StateIcon>
          <ShoppingBag className="size-5" />
        </StateIcon>
        <div className="space-y-2">
          <StateEyebrow>{t('gaps.balanced_label')}</StateEyebrow>
          <StateTitle>{t('gaps.no_gaps_title')}</StateTitle>
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
