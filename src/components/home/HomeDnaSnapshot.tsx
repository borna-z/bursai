import { motion } from 'framer-motion';
import { ArrowUpRight, Dna } from 'lucide-react';
import type { StyleDNA } from '@/hooks/useStyleDNA';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface HomeDnaSnapshotProps {
  dna: StyleDNA | null | undefined;
  isLoading?: boolean;
  onOpenInsights: () => void;
  onGenerateLook: () => void;
}

const COLOR_MAP: Record<string, string> = {
  black: '#1B1B1B',
  svart: '#1B1B1B',
  white: '#F5F1E8',
  vit: '#F5F1E8',
  grey: '#8D8D8A',
  gray: '#8D8D8A',
  'gr\u00e5': '#8D8D8A',
  beige: '#D8C6A5',
  cream: '#EFE4CC',
  navy: '#273B70',
  'marinbl\u00e5': '#273B70',
  blue: '#4D6EB3',
  'bl\u00e5': '#4D6EB3',
  green: '#6D845D',
  'gr\u00f6n': '#6D845D',
  brown: '#7A5539',
  brun: '#7A5539',
  red: '#A44336',
  'r\u00f6d': '#A44336',
  pink: '#D58EAF',
  rosa: '#D58EAF',
  yellow: '#D7A73C',
  gul: '#D7A73C',
};

function getColorSwatch(color: string) {
  return COLOR_MAP[color.toLowerCase().trim()] || '#B5AFA5';
}

function getBiasLabel(dna: StyleDNA) {
  if (dna.patterns[0]?.label) return dna.patterns[0].label;
  if (dna.formalityCenter < 2.5) return 'Relaxed';
  if (dna.formalityCenter > 3.6) return 'Polished';
  return 'Balanced';
}

export function HomeDnaSnapshot({
  dna,
  isLoading = false,
  onOpenInsights,
  onGenerateLook,
}: HomeDnaSnapshotProps) {
  if (isLoading) {
    return (
      <section
        data-testid="home-dna-loading"
        className="rounded-[1.6rem] border border-foreground/[0.08] bg-card p-5 shadow-[0_14px_28px_rgba(22,18,15,0.04)]"
      >
        <div className="space-y-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-20 rounded-[1rem]" />
        </div>
      </section>
    );
  }

  if (!dna) {
    return (
      <section
        data-testid="home-dna-empty"
        className="rounded-[1.6rem] border border-foreground/[0.08] bg-card p-5 shadow-[0_14px_28px_rgba(22,18,15,0.04)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label-editorial text-muted-foreground/60">Style DNA</p>
            <h2 className="mt-1 text-[1.2rem] font-semibold tracking-[-0.03em] text-foreground">
              Your signature is still forming
            </h2>
            <p className="mt-2 text-[0.92rem] leading-6 text-muted-foreground">
              Save a few more looks and BURS will start surfacing your archetype and repeat patterns.
            </p>
          </div>
          <div className="flex size-11 items-center justify-center rounded-[1rem] bg-secondary/65 text-foreground/70">
            <Dna className="size-5" />
          </div>
        </div>

        <Button onClick={onGenerateLook} variant="outline" className="mt-4 rounded-full px-4">
          Style Me
        </Button>
      </section>
    );
  }

  const topColors = dna.signatureColors.slice(0, 3);
  const topFormula = dna.uniformCombos[0]?.combo?.join(' + ') || 'Still emerging';

  return (
    <motion.section
      data-testid="home-dna-populated"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[1.6rem] border border-foreground/[0.08] bg-card p-5 shadow-[0_14px_28px_rgba(22,18,15,0.04)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-editorial text-muted-foreground/60">Style DNA</p>
          <h2 className="mt-1 text-[1.35rem] font-semibold tracking-[-0.04em] text-foreground">
            {dna.archetype}
          </h2>
          <p className="mt-1 text-[0.86rem] text-muted-foreground">
            {dna.outfitsAnalyzed} looks analyzed
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenInsights}
          className="rounded-full px-3 text-foreground/70"
        >
          Insights
          <ArrowUpRight className="size-4" />
        </Button>
      </div>

      <div className="mt-4 space-y-3 rounded-[1.2rem] bg-secondary/45 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">Formula</p>
            <p className="mt-1 text-[0.94rem] leading-6 text-foreground">{topFormula}</p>
          </div>
          <div className="text-right">
            <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">Bias</p>
            <p className="mt-1 text-[0.94rem] text-foreground">{getBiasLabel(dna)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">Palette</p>
          <div className="flex items-center gap-2">
            {topColors.length > 0 ? topColors.map((color) => (
              <span
                key={color.color}
                className="size-7 rounded-full border border-black/5"
                style={{ backgroundColor: getColorSwatch(color.color) }}
                aria-label={color.color}
                title={color.color}
              />
            )) : (
              <span className="text-[0.86rem] text-muted-foreground">Building</span>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
