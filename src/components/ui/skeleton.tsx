import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[var(--radius,0.5rem)] bg-muted skeleton-shimmer", className)} {...props} />;
}

export { Skeleton };
