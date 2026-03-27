import { motion } from 'framer-motion';
import { ArrowUpRight, Dna, Sparkles } from 'lucide-react';
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
  grå: '#8D8D8A',
  beige: '#D8C6A5',
  cream: '#EFE4CC',
  navy: '#273B70',
  marinblå: '#273B70',
  blue: '#4D6EB3',
  blå: '#4D6EB3',
  green: '#6D845D',
  grön: '#6D845D',
  brown: '#7A5539',
  brun: '#7A5539',
  red: '#A44336',
  röd: '#A44336',
  pink: '#D58EAF',
  rosa: '#D58EAF',
  yellow: '#D7A73C',
  gul: '#D7A73C',
};

function getColorSwatch(color: string) {
  return COLOR_MAP[color.toLowerCase().trim()] || '#B5AFA5';
}

function getFormalityTone(value: number) {
  if (value < 2.5) return 'Relaxed';
  if (value > 3.6) return 'Polished';
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
        className="rounded-[1.75rem] border border-foreground/[0.08] bg-card p-5 shadow-[0_14px_30px_rgba(22,18,15,0.05)]"
      >
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-44" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-24 rounded-[1.2rem]" />
            <Skeleton className="h-24 rounded-[1.2rem]" />
            <Skeleton className="h-24 rounded-[1.2rem]" />
          </div>
        </div>
      </section>
    );
  }

  if (!dna) {
    return (
      <section
        data-testid="home-dna-empty"
        className="rounded-[1.75rem] border border-foreground/[0.08] bg-card p-5 shadow-[0_14px_30px_rgba(22,18,15,0.05)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label-editorial text-muted-foreground/60">Style DNA</p>
            <h2 className="mt-1 text-[1.3rem] font-semibold tracking-[-0.03em] text-foreground">
              Style DNA is taking shape
            </h2>
            <p className="mt-3 max-w-[32ch] text-[0.94rem] leading-7 text-muted-foreground">
              Wear and save a few more AI-styled looks. BURS will start surfacing your archetype, palette, and uniform patterns here.
            </p>
          </div>
          <div className="flex size-12 items-center justify-center rounded-[1rem] bg-secondary/65 text-foreground/70">
            <Dna className="size-5" />
          </div>
        </div>

        <Button onClick={onGenerateLook} className="mt-5 h-11 rounded-full px-5">
          <Sparkles className="size-4" />
          Build a look
        </Button>
      </section>
    );
  }

  const topColors = dna.signatureColors.slice(0, 3);
  const topCombo = dna.uniformCombos[0]?.combo?.join(' + ') || 'Still emerging';
  const topPattern = dna.patterns[0]?.label || getFormalityTone(dna.formalityCenter);

  return (
    <motion.section
      data-testid="home-dna-populated"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[1.75rem] border border-foreground/[0.08] bg-card p-5 shadow-[0_14px_30px_rgba(22,18,15,0.05)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-editorial text-muted-foreground/60">Style DNA</p>
          <h2 className="mt-1 text-[1.45rem] font-semibold tracking-[-0.04em] text-foreground">
            {dna.archetype}
          </h2>
          <p className="mt-2 text-[0.92rem] leading-6 text-muted-foreground">
            Built from {dna.outfitsAnalyzed} worn looks and your strongest repeat signals.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenInsights}
          className="rounded-full px-3 text-foreground/70"
        >
          Open report
          <ArrowUpRight className="size-4" />
        </Button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[1.2rem] bg-secondary/45 p-4">
          <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">Palette</p>
          <div className="mt-3 flex items-center gap-2">
            {topColors.length > 0 ? topColors.map((color) => (
              <span
                key={color.color}
                className="size-8 rounded-full border border-black/5"
                style={{ backgroundColor: getColorSwatch(color.color) }}
                aria-label={color.color}
                title={color.color}
              />
            )) : (
              <span className="text-[0.92rem] text-muted-foreground">Building palette</span>
            )}
          </div>
        </div>

        <div className="rounded-[1.2rem] bg-secondary/45 p-4">
          <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">Formula</p>
          <p className="mt-3 text-[0.96rem] leading-6 text-foreground">{topCombo}</p>
        </div>

        <div className="rounded-[1.2rem] bg-secondary/45 p-4">
          <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">Bias</p>
          <p className="mt-3 text-[0.96rem] leading-6 text-foreground">{topPattern}</p>
        </div>
      </div>
    </motion.section>
  );
}
