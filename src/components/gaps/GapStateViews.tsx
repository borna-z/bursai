import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  LockKeyhole,
  Radar,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

import { WardrobeProgress } from '@/components/wardrobe/WardrobeProgress';
import { AILoadingOverlay } from '@/components/ui/AILoadingOverlay';
import { Button } from '@/components/ui/button';
import { EASE_CURVE } from '@/lib/motion';

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
      className={`relative overflow-hidden rounded-[1.55rem] border border-foreground/[0.08] bg-card/95 p-4 shadow-[0_18px_45px_rgba(18,18,18,0.05)] ${className}`}
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
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_CURVE }}
      className="relative overflow-hidden rounded-[1.8rem] border border-foreground/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(205,180,142,0.18),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,244,238,0.92))] px-4 py-5 shadow-[0_24px_60px_rgba(23,18,14,0.06)]"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />
      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="max-w-[30rem]">
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
              Wardrobe intelligence
            </p>
            <h2 className="mt-2 text-[1.4rem] font-semibold tracking-[-0.06em] text-foreground">
              Scan before you buy
            </h2>
            <p className="mt-2 text-[0.84rem] leading-5 text-muted-foreground">
              BURS scores the missing additions that unlock the most complete looks from what you already own.
            </p>
          </div>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-background/70 text-foreground/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <Radar className="size-4.5" />
          </div>
        </div>

        <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 text-[0.76rem] text-muted-foreground/80">
          <span className="rounded-full border border-foreground/[0.08] bg-background/75 px-3 py-1.5">
            {currentCount} pieces
          </span>
          <span className="rounded-full border border-foreground/[0.08] bg-background/75 px-3 py-1.5">
            {isUnlocked ? 'Gap scan unlocked' : 'Unlocks at 10 pieces'}
          </span>
          {hasSnapshot ? (
            <span className="rounded-full border border-foreground/[0.08] bg-background/75 px-3 py-1.5">
              Last scan ready
            </span>
          ) : null}
        </div>
      </div>
    </motion.section>
  );
}

export function GapLockedState() {
  return (
    <StateSurface>
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-secondary/65 text-foreground/70">
          <LockKeyhole className="size-4.5" />
        </div>
        <div className="space-y-1.5">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
            Locked
          </p>
          <h2 className="text-[1.08rem] font-semibold tracking-[-0.035em] text-foreground">
            Add a little more wardrobe depth first
          </h2>
          <p className="text-[0.84rem] leading-5 text-muted-foreground">
            Gap analysis starts making sense once BURS has enough pieces to compare across your closet.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-[1.2rem] border border-foreground/[0.06] bg-background/70 p-4">
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
  return (
    <StateSurface>
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-secondary/65 text-foreground/70">
          <Sparkles className="size-4.5" />
        </div>
        <div className="space-y-1.5">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
            Ready
          </p>
          <h2 className="text-[1.08rem] font-semibold tracking-[-0.035em] text-foreground">
            Run a focused wardrobe scan
          </h2>
          <p className="text-[0.84rem] leading-5 text-muted-foreground">
            The scan finds missing categories, color direction, and the pieces that create the biggest outfit lift.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-[0.82rem] text-muted-foreground">
        <div className="rounded-[1rem] border border-foreground/[0.06] bg-background/70 p-3">
          Missing categories
        </div>
        <div className="rounded-[1rem] border border-foreground/[0.06] bg-background/70 p-3">
          Color direction that works now
        </div>
        <div className="rounded-[1rem] border border-foreground/[0.06] bg-background/70 p-3">
          Fast shopping follow-through
        </div>
      </div>

      <div className="mt-4">
        <Button onClick={onScan} className="h-11 w-full justify-between rounded-full px-5">
          Run scan
          <Search className="size-4" />
        </Button>
      </div>
    </StateSurface>
  );
}

export function GapAutorunState({
  source = 'unknown',
}: {
  source?: string;
}) {
  const sourceLabel = source === 'insights' ? 'DNA' : 'Home';

  return (
    <StateSurface>
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-secondary/65 text-foreground/70">
          <ArrowRight className="size-4.5" />
        </div>
        <div className="space-y-1.5">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
            Autorun
          </p>
          <h2 className="text-[1.08rem] font-semibold tracking-[-0.035em] text-foreground">
            Starting your gap scan
          </h2>
          <p className="text-[0.84rem] leading-5 text-muted-foreground">
            Opening from {sourceLabel}. This page keeps results, refresh state, and shopping follow-through in one place.
          </p>
        </div>
      </div>
    </StateSurface>
  );
}

export function GapLoadingState() {
  return (
    <StateSurface>
      <div className="mb-4 space-y-1.5">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
          Scanning
        </p>
          <h2 className="text-[1.08rem] font-semibold tracking-[-0.035em] text-foreground">
            Reading your wardrobe for the best missing additions
          </h2>
          <p className="text-[0.84rem] leading-5 text-muted-foreground">
            This compares the pieces you already own and the additions that unlock the most complete new looks.
          </p>
        </div>

      <AILoadingOverlay
        variant="card"
        tone="warm"
        phases={[
          { icon: Search, label: 'Reviewing categories', duration: 2200 },
          { icon: Sparkles, label: 'Scoring missing essentials', duration: 2200 },
          { icon: ShoppingBag, label: 'Preparing the best additions', duration: 0 },
        ]}
        subtitle="This can take a moment on larger wardrobes."
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
  return (
    <StateSurface>
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-destructive/10 text-destructive">
          <AlertCircle className="size-4.5" />
        </div>
        <div className="space-y-1.5">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
            Error
          </p>
          <h2 className="text-[1.08rem] font-semibold tracking-[-0.035em] text-foreground">
            The scan did not finish
          </h2>
          <p className="text-[0.84rem] leading-5 text-muted-foreground">
            Nothing changed. Retry the scan and BURS will rerun the same wardrobe analysis without losing this page context.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <Button onClick={onRetry} className="h-11 w-full justify-between rounded-full px-5">
          Retry scan
          <RefreshCw className="size-4" />
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
  return (
    <StateSurface>
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-secondary/65 text-foreground/70">
          <ShoppingBag className="size-4.5" />
        </div>
        <div className="space-y-1.5">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
            Balanced
          </p>
          <h2 className="text-[1.08rem] font-semibold tracking-[-0.035em] text-foreground">
            No urgent gaps right now
          </h2>
          <p className="text-[0.84rem] leading-5 text-muted-foreground">
            Your current wardrobe is covering itself well. Run a fresh scan after adding new pieces.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <Button onClick={onRefresh} variant="outline" className="h-11 w-full justify-between rounded-full px-5">
          Run fresh scan
          <RefreshCw className="size-4" />
        </Button>
      </div>
    </StateSurface>
  );
}
