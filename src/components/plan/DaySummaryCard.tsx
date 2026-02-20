import { Briefcase, Dumbbell, PartyPopper, Heart, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/contexts/LanguageContext';
import type { DaySummary } from '@/hooks/useDaySummary';

interface DaySummaryCardProps {
  summary: DaySummary | null | undefined;
  isLoading: boolean;
  onGenerateFromHint?: (occasion: string) => void;
  className?: string;
  compact?: boolean;
}

const occasionConfig: Record<string, { icon: React.ElementType; label: string }> = {
  jobb:     { icon: Briefcase,    label: 'Jobb' },
  träning:  { icon: Dumbbell,     label: 'Träning' },
  fest:     { icon: PartyPopper,  label: 'Fest' },
  dejt:     { icon: Heart,        label: 'Dejt' },
  vardag:   { icon: ShoppingBag,  label: 'Vardag' },
};

function SummarySkeleton({ compact }: { compact?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/40 p-4 space-y-3">
      <Skeleton className={cn("w-full", compact ? "h-8" : "h-12")} />
      <div className="flex gap-2">
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
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
  const { t } = useLanguage();
  
  if (isLoading) return <SummarySkeleton compact={compact} />;
  if (!summary) return null;

  return (
    <div className={cn(
      'rounded-xl bg-muted/40 p-4 space-y-3',
      className
    )}>
      {/* Summary text */}
      <p className={cn(
        'text-sm text-foreground/85 leading-relaxed',
        compact && 'line-clamp-2'
      )}>
        {summary.summary}
      </p>

      {/* Outfit hints as subtle outline chips */}
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
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                  'border border-border hover:bg-muted/60 transition-all',
                  'active:scale-95 text-foreground/70'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{hint.style}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
