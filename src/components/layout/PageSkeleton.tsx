import { Skeleton } from '@/components/ui/skeleton';

export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header skeleton */}
      <div className="px-6 pt-14 pb-6 space-y-4">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
      {/* Content skeleton */}
      <div className="flex-1 px-6 space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  );
}
