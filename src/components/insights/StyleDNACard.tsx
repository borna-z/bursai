import type { ReactNode } from 'react';

import { Dna, Fingerprint } from 'lucide-react';

import type { StyleDNA } from '@/hooks/useInsightsDashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const COLOR_MAP: Record<string, string> = {
  black: 'bg-gray-900',
  white: 'bg-gray-100 border border-border/20',
  grey: 'bg-gray-400',
  navy: 'bg-blue-900',
  blue: 'bg-blue-500',
  red: 'bg-red-500',
  green: 'bg-green-600',
  beige: 'bg-amber-100',
  brown: 'bg-amber-800',
  pink: 'bg-pink-400',
  purple: 'bg-purple-500',
  yellow: 'bg-yellow-400',
  orange: 'bg-orange-500',
  cream: 'bg-amber-50 border border-border/20',
  olive: 'bg-green-700',
  svart: 'bg-gray-900',
  vit: 'bg-gray-100 border border-border/20',
  'gr\u00e5': 'bg-gray-400',
  'marinbl\u00e5': 'bg-blue-900',
  'bl\u00e5': 'bg-blue-500',
  'r\u00f6d': 'bg-red-500',
  'gr\u00f6n': 'bg-green-600',
};

function PatternBar({ pattern }: { pattern: { label: string; strength: number; detail: string } }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-foreground/80">{pattern.label}</span>
        <span className="text-[11px] tabular-nums text-muted-foreground/50">{pattern.strength}%</span>
      </div>
      <div className="h-[3px] overflow-hidden rounded-full bg-muted/20">
        <div
          className="h-full rounded-full bg-primary/60"
          style={{ width: `${pattern.strength}%` }}
        />
      </div>
    </div>
  );
}

interface StyleDNACardProps {
  dna?: StyleDNA | null;
  isLoading?: boolean;
  className?: string;
  emptyState?: ReactNode;
}

export function StyleDNACard({
  dna,
  isLoading = false,
  className,
  emptyState,
}: StyleDNACardProps) {
  if (isLoading) {
    return (
      <div className={cn('rounded-[1.25rem] border border-border/10 bg-card/60 p-5 space-y-4', className)}>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!dna) {
    if (!emptyState) return null;

    return (
      <div className={cn('rounded-[1.25rem] border border-border/10 bg-card/60 p-5', className)}>
        {emptyState}
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden', className)}>
      <div className="space-y-3 pb-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dna className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/40">
              Style DNA
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground/30">
            {dna.outfitsAnalyzed} looks
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/8">
            <Fingerprint className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-foreground">{dna.archetype}</p>
            <p className="text-[11px] text-muted-foreground/50">
              {dna.formalitySpread === 'narrow'
                ? 'Consistent'
                : dna.formalitySpread === 'wide'
                  ? 'Wide range'
                  : 'Balanced'}
              {' \u00b7 '}F{dna.formalityCenter.toFixed(1)}
            </p>
          </div>
        </div>
      </div>

      <div className="pb-4">
        <p className="mb-2 text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground/30">
          Palette
        </p>
        <div className="flex items-center gap-1.5">
          {dna.signatureColors.map(({ color, percentage }) => (
            <div key={color} className="flex flex-col items-center gap-1">
              <div
                className={cn('rounded-full', COLOR_MAP[color.toLowerCase()] || 'bg-muted')}
                style={{
                  width: Math.max(20, Math.min(40, percentage * 0.8)),
                  height: Math.max(20, Math.min(40, percentage * 0.8)),
                }}
              />
              <span className="text-[9px] capitalize text-muted-foreground/40">{color}</span>
              <span className="text-[8px] tabular-nums text-muted-foreground/25">{percentage}%</span>
            </div>
          ))}
        </div>
      </div>

      {dna.uniformCombos.length > 0 ? (
        <div className="pb-4">
          <p className="mb-2 text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground/30">
            Formulas
          </p>
          <div className="space-y-1.5">
            {dna.uniformCombos.slice(0, 2).map(({ combo, count }, index) => (
              <div key={index} className="flex items-center justify-between py-1.5">
                <span className="text-[12px] capitalize text-foreground/70">
                  {combo.join(' + ')}
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground/40">
                  {count}x
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {dna.patterns.length > 0 ? (
        <div className="space-y-2.5 pb-4">
          <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground/30">
            Patterns
          </p>
          {dna.patterns.slice(0, 2).map((pattern, index) => (
            <PatternBar key={index} pattern={pattern} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
