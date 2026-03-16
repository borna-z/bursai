import { motion, useReducedMotion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { EASE_CURVE } from '@/lib/motion';

/* ─── Shared stagger wrapper ─── */
function StaggerIn({ children, index, className }: { children: React.ReactNode; index: number; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? undefined : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: EASE_CURVE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Garment skeletons ─── */
export function GarmentCardSkeleton({ grid = true }: { grid?: boolean }) {
  if (!grid) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl">
        <Skeleton className="w-14 h-14 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden">
      <Skeleton className="aspect-square w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function GarmentGridSkeleton({ count = 6, grid = true }: { count?: number; grid?: boolean }) {
  return (
    <div className={cn(grid ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-2')}>
      {Array.from({ length: count }).map((_, i) => (
        <StaggerIn key={i} index={i}>
          <GarmentCardSkeleton grid={grid} />
        </StaggerIn>
      ))}
    </div>
  );
}

/* ─── Outfit skeletons ─── */
export function OutfitCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden p-4 space-y-3">
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="w-16 h-16 rounded-lg shrink-0" />
        ))}
      </div>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}

export function OutfitListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <StaggerIn key={i} index={i}>
          <OutfitCardSkeleton />
        </StaggerIn>
      ))}
    </div>
  );
}

/* ─── Insight skeletons ─── */
export function InsightCardSkeleton() {
  return (
    <div className="rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="w-4 h-4 rounded" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function StatGridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[1, 2, 3].map((i) => (
        <StaggerIn key={i} index={i}>
          <div className="rounded-xl p-4 text-center space-y-2 border border-border/5">
            <Skeleton className="h-7 w-10 mx-auto" />
            <Skeleton className="h-3 w-12 mx-auto" />
          </div>
        </StaggerIn>
      ))}
    </div>
  );
}

/* ─── Home page skeleton — mirrors hero + shortcuts layout ─── */
export function HomePageSkeleton() {
  return (
    <div className="space-y-5">
      {/* Hero card */}
      <StaggerIn index={0}>
        <div className="rounded-2xl border border-border/10 overflow-hidden">
          <div className="grid grid-cols-4 gap-0.5 p-1">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        </div>
      </StaggerIn>
      {/* Quick actions */}
      <StaggerIn index={1}>
        <div className="flex gap-2.5">
          <Skeleton className="flex-1 h-11 rounded-xl" />
          <Skeleton className="flex-1 h-11 rounded-xl" />
        </div>
      </StaggerIn>
    </div>
  );
}

/* ─── Insights page skeleton ─── */
export function InsightsPageSkeleton() {
  return (
    <div className="max-w-lg mx-auto px-4 pb-8 pt-6 space-y-10">
      {/* Usage ring */}
      <StaggerIn index={0}>
        <div className="flex flex-col items-center pb-10">
          <Skeleton className="w-[140px] h-[140px] rounded-full" />
          <Skeleton className="h-3 w-24 mt-3" />
          <div className="flex items-center w-full mt-8 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <Skeleton className="h-7 w-10" />
                <Skeleton className="h-2.5 w-12" />
              </div>
            ))}
          </div>
        </div>
      </StaggerIn>
      {/* Top worn */}
      <StaggerIn index={1}>
        <div className="space-y-4">
          <Skeleton className="h-3 w-28" />
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 py-3">
              <Skeleton className="w-6 h-4" />
              <Skeleton className="w-12 h-14 rounded-xl" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
          ))}
        </div>
      </StaggerIn>
      {/* Color bar */}
      <StaggerIn index={2}>
        <div className="space-y-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-3 w-full" />
            ))}
          </div>
        </div>
      </StaggerIn>
    </div>
  );
}

/* ─── Plan page skeleton — includes week strip ─── */
export function PlanPageSkeleton() {
  return (
    <div className="space-y-6">
      <StaggerIn index={0}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
      </StaggerIn>
      <StaggerIn index={1}>
        <div className="space-y-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </StaggerIn>
      <StaggerIn index={2}>
        <div className="rounded-2xl overflow-hidden">
          <div className="grid grid-cols-2 gap-1 p-1">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
            ))}
          </div>
        </div>
      </StaggerIn>
      <StaggerIn index={3}>
        <div className="flex gap-3">
          <Skeleton className="h-11 flex-1 rounded-xl" />
          <Skeleton className="h-11 flex-1 rounded-xl" />
        </div>
      </StaggerIn>
    </div>
  );
}

/* ─── Week strip skeleton ─── */
export function WeekStripSkeleton() {
  return (
    <div className="flex justify-between gap-1 py-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <StaggerIn key={i} index={i}>
          <div className="flex flex-col items-center gap-1.5">
            <Skeleton className="h-3 w-6" />
            <Skeleton className="w-10 h-10 rounded-full" />
          </div>
        </StaggerIn>
      ))}
    </div>
  );
}

/* ─── Settings page skeleton ─── */
export function SettingsPageSkeleton() {
  return (
    <div className="px-6 pb-8 pt-12 space-y-10 max-w-lg mx-auto">
      <StaggerIn index={0}>
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </StaggerIn>
      <StaggerIn index={1}>
        <div className="rounded-2xl border border-border/10 overflow-hidden">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="flex items-center gap-3 px-4 py-4 border-b border-border/5 last:border-0">
              <Skeleton className="w-9 h-9 rounded-xl" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="w-4 h-4" />
            </div>
          ))}
        </div>
      </StaggerIn>
    </div>
  );
}

/* ─── AI Chat skeleton ─── */
export function ChatPageSkeleton() {
  return (
    <div className="flex-1 px-4 py-6 space-y-6">
      {[1, 2, 3].map(i => (
        <StaggerIn key={i} index={i}>
          <div className={cn("flex gap-3", i % 2 === 0 ? "justify-end" : "")}>
            <div className={cn("space-y-2 max-w-[80%]", i % 2 === 0 ? "items-end" : "")}>
              <Skeleton className={cn("h-4", i % 2 === 0 ? "w-32" : "w-48")} />
              <Skeleton className={cn("h-4", i % 2 === 0 ? "w-24" : "w-40")} />
              {i === 1 && <Skeleton className="h-4 w-36" />}
            </div>
          </div>
        </StaggerIn>
      ))}
    </div>
  );
}
