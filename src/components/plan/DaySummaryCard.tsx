import { Briefcase, Dumbbell, PartyPopper, Heart, ShoppingBag, ArrowRight, Shirt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import type { DaySummary, TransitionBlock } from '@/hooks/useDaySummary';

interface DaySummaryCardProps {
  summary: DaySummary | null | undefined;
  isLoading: boolean;
  onGenerateFromHint?: (occasion: string) => void;
  className?: string;
  compact?: boolean;
}

const occasionIcons: Record<string, React.ElementType> = {
  jobb: Briefcase,
  work: Briefcase,
  träning: Dumbbell,
  workout: Dumbbell,
  fest: PartyPopper,
  party: PartyPopper,
  dejt: Heart,
  date: Heart,
  vardag: ShoppingBag,
  casual: ShoppingBag,
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

function TransitionTimeline({
  blocks,
  versatilePieces,
  onGenerateFromHint,
}: {
  blocks: TransitionBlock[];
  versatilePieces: string[];
  onGenerateFromHint?: (occasion: string) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="space-y-2">
      {/* Timeline blocks */}
      <div className="relative pl-4 space-y-3">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

        {blocks.map((block, idx) => {
          const Icon = occasionIcons[block.occasion] || ShoppingBag;
          return (
            <div key={idx} className="relative">
              {/* Dot */}
              <div className={cn(
                "absolute -left-4 top-1.5 w-3 h-3 rounded-full border-2 border-background",
                idx === 0 ? "bg-primary" : "bg-muted-foreground/40"
              )} />

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[0.6875rem] font-mono text-muted-foreground/60 tabular-nums">{block.time_range}</span>
                  <Badge variant="secondary" className="text-[10px] gap-1 py-0">
                    <Icon className="w-3 h-3" />
                    {block.label}
                  </Badge>
                </div>
                <p className="text-[0.75rem] text-foreground/80 leading-relaxed">{block.style_tip}</p>
                {block.transition_tip && (
                  <p className="text-[11px] text-primary/80 flex items-center gap-1">
                    <ArrowRight className="w-3 h-3 shrink-0" />
                    {block.transition_tip}
                  </p>
                )}
              </div>

              {/* Generate button per block */}
              {onGenerateFromHint && (
                <button
                  onClick={() => onGenerateFromHint(block.occasion)}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
                >
                  <Shirt className="w-3 h-3" />
                  {t('plan.generate')}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Versatile pieces */}
      {versatilePieces.length > 0 && (
        <div className="pt-2 border-t border-border/50">
          <p className="label-editorial mb-1.5">
            {t('plan.versatile_pieces') || 'Works all day'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {versatilePieces.map((piece, idx) => (
              <Badge key={idx} variant="outline" className="text-[10px] font-normal">
                {piece}
              </Badge>
            ))}
          </div>
        </div>
      )}
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

  const hasTransitions = summary.transitions?.needs_change && summary.transitions.blocks.length > 0;

  return (
    <div className={cn(
      'rounded-xl glass-card p-5 space-y-4',
      className
    )}>
      <p className={cn(
        'text-sm text-foreground/85 leading-relaxed',
        compact && !hasTransitions && 'line-clamp-2'
      )}>
        {summary.summary}
      </p>

      {/* Multi-event transition timeline */}
      {hasTransitions && (
        <TransitionTimeline
          blocks={summary.transitions!.blocks}
          versatilePieces={summary.transitions!.versatile_pieces}
          onGenerateFromHint={onGenerateFromHint}
        />
      )}

      {/* Standard outfit hints (shown when no transitions) */}
      {!hasTransitions && summary.outfit_hints.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {summary.outfit_hints.map((hint, idx) => {
            const Icon = occasionIcons[hint.occasion] || occasionIcons.vardag;

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
