import { Sparkles, Briefcase, Dumbbell, PartyPopper, Heart, ShoppingBag, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { DaySummary } from '@/hooks/useDaySummary';

interface DaySummaryCardProps {
  summary: DaySummary | null | undefined;
  isLoading: boolean;
  onGenerateFromHint?: (occasion: string) => void;
  className?: string;
  compact?: boolean;
}

const occasionConfig: Record<string, { icon: React.ElementType; label: string; colorClass: string }> = {
  jobb:     { icon: Briefcase,    label: 'Jobb',     colorClass: 'text-blue-600 dark:text-blue-400 bg-blue-500/10' },
  träning:  { icon: Dumbbell,     label: 'Träning',  colorClass: 'text-green-600 dark:text-green-400 bg-green-500/10' },
  fest:     { icon: PartyPopper,  label: 'Fest',     colorClass: 'text-purple-600 dark:text-purple-400 bg-purple-500/10' },
  dejt:     { icon: Heart,        label: 'Dejt',     colorClass: 'text-rose-600 dark:text-rose-400 bg-rose-500/10' },
  vardag:   { icon: ShoppingBag,  label: 'Vardag',   colorClass: 'text-muted-foreground bg-muted' },
};

function SummarySkeleton({ compact }: { compact?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="w-4 h-4 rounded-full" />
        <Skeleton className="h-3.5 w-20" />
      </div>
      <Skeleton className={cn("w-full", compact ? "h-8" : "h-12")} />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function DaySummaryCard({
  summary,
  isLoading,
  onGenerateFromHint,
  className,
  compact = false,
}: DaySummaryCardProps) {
  if (isLoading) return <SummarySkeleton compact={compact} />;
  if (!summary) return null;

  return (
    <div className={cn(
      'rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-3',
      className
    )}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-accent" />
        <span className="text-xs font-semibold text-accent">Din dag</span>
      </div>

      {/* Summary text */}
      <p className={cn(
        'text-sm text-foreground/90 leading-relaxed',
        compact && 'line-clamp-2'
      )}>
        {summary.summary}
      </p>

      {/* Outfit hints as actionable chips */}
      {summary.outfit_hints.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {summary.outfit_hints.map((hint, idx) => {
            const config = occasionConfig[hint.occasion] || occasionConfig.vardag;
            const Icon = config.icon;

            return (
              <button
                key={idx}
                onClick={() => onGenerateFromHint?.(hint.occasion)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                  'hover:scale-[1.03] active:scale-[0.97]',
                  config.colorClass
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{hint.style}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* CTA */}
      {!compact && onGenerateFromHint && summary.outfit_hints.length > 0 && (
        <button
          onClick={() => onGenerateFromHint(summary.outfit_hints[0].occasion)}
          className="flex items-center gap-1 text-xs text-accent font-medium hover:underline active:opacity-70 transition-opacity pt-1"
        >
          Planera utifrån detta
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
