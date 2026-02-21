import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface GarmentSkeletonProps {
  count?: number;
  grid?: boolean;
}

export function GarmentCardSkeleton({ grid = true }: { grid?: boolean }) {
  if (!grid) {
    return (
      <div className="flex items-center gap-3 p-3 glass-card rounded-xl">
        <Skeleton className="w-14 h-14 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    );
  }

  return (
      <div className="glass-card rounded-xl overflow-hidden">
        <Skeleton className="aspect-square w-full" />
        <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function GarmentGridSkeleton({ count = 6, grid = true }: GarmentSkeletonProps) {
  return (
    <div className={cn(grid ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-2')}>
      {Array.from({ length: count }).map((_, i) => (
        <GarmentCardSkeleton key={i} grid={grid} />
      ))}
    </div>
  );
}

export function OutfitCardSkeleton() {
  return (
    <div className="glass-card rounded-xl overflow-hidden p-4 space-y-3">
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
        <OutfitCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function InsightCardSkeleton() {
  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
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
        <div key={i} className="glass-card rounded-xl p-4 text-center space-y-2">
          <Skeleton className="h-7 w-10 mx-auto" />
          <Skeleton className="h-3 w-12 mx-auto" />
        </div>
      ))}
    </div>
  );
}
