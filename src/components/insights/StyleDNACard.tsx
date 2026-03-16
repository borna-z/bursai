import { motion } from 'framer-motion';
import { Dna, Fingerprint } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStyleDNA, type StyleDNA } from '@/hooks/useStyleDNA';
import { Skeleton } from '@/components/ui/skeleton';

const COLOR_MAP: Record<string, string> = {
  black: 'bg-gray-900', white: 'bg-gray-100 border border-border/20', grey: 'bg-gray-400', navy: 'bg-blue-900',
  blue: 'bg-blue-500', red: 'bg-red-500', green: 'bg-green-600', beige: 'bg-amber-100',
  brown: 'bg-amber-800', pink: 'bg-pink-400', purple: 'bg-purple-500', yellow: 'bg-yellow-400',
  orange: 'bg-orange-500', cream: 'bg-amber-50 border border-border/20', olive: 'bg-green-700',
  svart: 'bg-gray-900', vit: 'bg-gray-100 border border-border/20', grå: 'bg-gray-400',
  marinblå: 'bg-blue-900', blå: 'bg-blue-500', röd: 'bg-red-500', grön: 'bg-green-600',
};

function PatternBar({ pattern }: { pattern: { label: string; strength: number; detail: string } }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-foreground/80">{pattern.label}</span>
        <span className="text-[11px] text-muted-foreground/50 tabular-nums">{pattern.strength}%</span>
      </div>
      <div className="h-[3px] rounded-full bg-muted/20 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-primary/60"
          initial={{ width: 0 }}
          animate={{ width: `${pattern.strength}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground/40 leading-relaxed">{pattern.detail}</p>
    </div>
  );
}

export function StyleDNACard() {
  const { data: dna, isLoading } = useStyleDNA();

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-card/60 border border-border/10 p-5 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!dna) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/10 overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dna className="w-4 h-4 text-primary" />
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/40 font-semibold">
              Style DNA
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground/30">
            {dna.outfitsAnalyzed} outfits
          </span>
        </div>

        {/* Archetype badge */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center">
            <Fingerprint className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-[18px] font-bold tracking-tight text-foreground">{dna.archetype}</p>
            <p className="text-[11px] text-muted-foreground/50">
              {dna.formalitySpread === 'narrow' ? 'Consistent formality' :
               dna.formalitySpread === 'wide' ? 'Wide range dresser' : 'Balanced range'}
              {' · '}F{dna.formalityCenter.toFixed(1)}
            </p>
          </div>
        </div>
      </div>

      {/* Signature palette */}
      <div className="px-5 pb-4">
        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/30 font-medium mb-2">
          Signature palette
        </p>
        <div className="flex items-center gap-1.5">
          {dna.signatureColors.map(({ color, percentage }) => (
            <div key={color} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'rounded-full',
                  COLOR_MAP[color.toLowerCase()] || 'bg-muted'
                )}
                style={{
                  width: Math.max(20, Math.min(40, percentage * 0.8)),
                  height: Math.max(20, Math.min(40, percentage * 0.8)),
                }}
              />
              <span className="text-[9px] text-muted-foreground/40 capitalize">{color}</span>
              <span className="text-[8px] text-muted-foreground/25 tabular-nums">{percentage}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Uniform combos */}
      {dna.uniformCombos.length > 0 && (
        <div className="px-5 pb-4">
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/30 font-medium mb-2">
            Go-to formulas
          </p>
          <div className="space-y-1.5">
            {dna.uniformCombos.map(({ combo, count }, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <span className="text-[12px] text-foreground/70 capitalize">
                  {combo.join(' + ')}
                </span>
                <span className="text-[10px] text-muted-foreground/40 tabular-nums">
                  {count}×
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Patterns */}
      {dna.patterns.length > 0 && (
        <div className="px-5 pb-5 space-y-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/30 font-medium">
            Detected patterns
          </p>
          {dna.patterns.map((p, i) => (
            <PatternBar key={i} pattern={p} />
          ))}
        </div>
      )}
    </motion.div>
  );
}
