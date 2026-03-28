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
import { WardrobeProgress } from '@/components/discover/WardrobeProgress';
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
            Wardrobe Intelligence
          </p>
          <h1 className="mt-3 text-[2rem] font-semibold tracking-[-0.06em] text-foreground sm:text-[2.4rem]">
            Garment gaps
          </h1>
          <p className="mt-3 max-w-[30rem] text-[0.95rem] leading-6 text-muted-foreground">
            Scan your wardrobe before you buy. BURS highlights the missing pieces that unlock the
            most real outfits instead of adding more noise.
          </p>
        </div>
        <div className="flex size-12 shrink-0 items-center justify-center rounded-[1.1rem] bg-background/70 text-foreground/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          <Radar className="size-5" />
        </div>
      </div>

      <div className="relative mt-6 flex flex-wrap gap-2.5 text-[0.76rem] text-muted-foreground/80">
        <span className="rounded-full border border-foreground/[0.08] bg-background/75 px-3 py-1.5">
          {currentCount} pieces in wardrobe
        </span>
        <span className="rounded-full border border-foreground/[0.08] bg-background/75 px-3 py-1.5">
          {isUnlocked ? 'Gap analysis unlocked' : 'Unlocks at 10 garments'}
        </span>
        {hasSnapshot ? (
          <span className="rounded-full border border-foreground/[0.08] bg-background/75 px-3 py-1.5">
            Previous scan ready to review
          </span>
        ) : null}
      </div>
    </motion.section>
  );
}

export function GapLockedState() {
  return (
    <StateSurface>
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-[1rem] bg-secondary/65 text-foreground/70">
          <LockKeyhole className="size-5" />
        </div>
        <div className="space-y-2">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
            Locked
          </p>
          <h2 className="text-[1.2rem] font-semibold tracking-[-0.035em] text-foreground">
            Add a little more wardrobe depth first
          </h2>
          <p className="max-w-[36rem] text-[0.94rem] leading-6 text-muted-foreground">
            Gap analysis starts making sense once BURS has enough pieces to compare across your
            closet. Hit the next milestone and this page will map the highest-impact additions.
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
  return (
    <StateSurface>
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-[1rem] bg-secondary/65 text-foreground/70">
          <Sparkles className="size-5" />
        </div>
        <div className="space-y-2">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
            Ready
          </p>
          <h2 className="text-[1.2rem] font-semibold tracking-[-0.035em] text-foreground">
            Run a focused wardrobe scan
          </h2>
          <p className="max-w-[36rem] text-[0.94rem] leading-6 text-muted-foreground">
            The scan looks for the missing categories, colors, and versatile pieces that create the
            biggest outfit lift across what you already own.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 text-[0.88rem] text-muted-foreground sm:grid-cols-3">
        <div className="rounded-[1.2rem] border border-foreground/[0.06] bg-background/70 p-4">
          High-impact categories
        </div>
        <div className="rounded-[1.2rem] border border-foreground/[0.06] bg-background/70 p-4">
          Color direction that works now
        </div>
        <div className="rounded-[1.2rem] border border-foreground/[0.06] bg-background/70 p-4">
          Fast shopping follow-through
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <Button onClick={onScan} className="rounded-full px-5">
          <Search className="size-4" />
          Run scan
        </Button>
      </div>
    </StateSurface>
  );
}

export function GapAutorunState() {
  return (
    <StateSurface>
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-[1rem] bg-secondary/65 text-foreground/70">
          <ArrowRight className="size-5" />
        </div>
        <div className="space-y-2">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
            Autorun
          </p>
          <h2 className="text-[1.2rem] font-semibold tracking-[-0.035em] text-foreground">
            Starting your gap scan
          </h2>
          <p className="max-w-[36rem] text-[0.94rem] leading-6 text-muted-foreground">
            Opening directly from Home. BURS is kicking off the full scan so this page keeps the
            results, refresh state, and shopping actions in one place.
          </p>
        </div>
      </div>
    </StateSurface>
  );
}

export function GapLoadingState() {
  return (
    <StateSurface>
      <div className="mb-5 space-y-2">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
          Scanning
        </p>
        <h2 className="text-[1.2rem] font-semibold tracking-[-0.035em] text-foreground">
          Reading your wardrobe for the best missing additions
        </h2>
        <p className="max-w-[36rem] text-[0.94rem] leading-6 text-muted-foreground">
          This compares the pieces you already own, the gaps between them, and the additions that
          would create the most complete new outfits.
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
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-[1rem] bg-destructive/10 text-destructive">
          <AlertCircle className="size-5" />
        </div>
        <div className="space-y-2">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
            Error
          </p>
          <h2 className="text-[1.2rem] font-semibold tracking-[-0.035em] text-foreground">
            The scan did not finish
          </h2>
          <p className="max-w-[36rem] text-[0.94rem] leading-6 text-muted-foreground">
            Nothing has been changed. Retry the scan and BURS will rerun the same wardrobe analysis
            without losing this page context.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <Button onClick={onRetry} className="rounded-full px-5">
          <RefreshCw className="size-4" />
          Retry scan
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
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-[1rem] bg-secondary/65 text-foreground/70">
          <ShoppingBag className="size-5" />
        </div>
        <div className="space-y-2">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
            Balanced
          </p>
          <h2 className="text-[1.2rem] font-semibold tracking-[-0.035em] text-foreground">
            No urgent gaps right now
          </h2>
          <p className="max-w-[36rem] text-[0.94rem] leading-6 text-muted-foreground">
            Your current wardrobe is covering itself well. If you have added pieces recently, run a
            fresh scan to see whether new gaps or upgrade opportunities appear.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <Button onClick={onRefresh} variant="outline" className="rounded-full px-5">
          <RefreshCw className="size-4" />
          Run fresh scan
        </Button>
      </div>
    </StateSurface>
  );
}
