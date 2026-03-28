import type { ElementType } from 'react';

import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  CircleDot,
  Gauge,
  Leaf,
  Shirt,
  Sparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function UsageRing({ value, size = 132 }: { value: number; size?: number }) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color =
    value >= 55
      ? 'hsl(var(--success))'
      : value >= 30
        ? 'hsl(var(--accent))'
        : 'hsl(var(--warning))';

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={stroke}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      />
    </svg>
  );
}

interface OverviewMetricProps {
  label: string;
  value: number | string;
  hint: string;
  icon: ElementType;
  onClick?: () => void;
}

function OverviewMetric({
  label,
  value,
  hint,
  icon: Icon,
  onClick,
}: OverviewMetricProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'surface-utility group flex min-h-[84px] flex-col justify-between p-3 text-left',
        onClick ? 'press' : 'cursor-default',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.66rem] uppercase tracking-[0.16em] text-muted-foreground/70">
          {label}
        </p>
        <Icon className="size-4 text-muted-foreground/45 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
      <div className="space-y-1">
        <p className="text-[1.3rem] font-semibold tracking-[-0.05em] text-foreground">
          {value}
        </p>
        <p className="text-[0.76rem] leading-5 text-muted-foreground">{hint}</p>
      </div>
    </button>
  );
}

interface InsightsOverviewHeroProps {
  usageRate: number;
  totalGarments: number;
  activeCount: number;
  dormantCount: number;
  savedLooks: number;
  plannedThisWeek: number;
  sustainabilityScore?: number | null;
  dnaArchetype?: string | null;
  onOpenWardrobe: () => void;
  onGenerateLook: () => void;
  onOpenUsed: () => void;
  onOpenUnused: () => void;
  onOpenPlan: () => void;
  onOpenOutfits: () => void;
}

export function InsightsOverviewHero({
  usageRate,
  totalGarments,
  activeCount,
  dormantCount,
  savedLooks,
  plannedThisWeek,
  sustainabilityScore,
  dnaArchetype,
  onOpenWardrobe,
  onGenerateLook,
  onOpenUsed,
  onOpenUnused,
  onOpenPlan,
  onOpenOutfits,
}: InsightsOverviewHeroProps) {
  const rotationLabel =
    usageRate >= 60 ? 'Working well' : usageRate >= 35 ? 'Building' : 'Needs attention';

  const narrative = dnaArchetype
    ? `Rotation, DNA, gaps, and value in one working view. ${dnaArchetype} is coming through.`
    : 'Rotation, DNA, gaps, and value in one working view.';

  return (
    <section className="surface-secondary px-4 py-4">
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-border/35 bg-background/70">
                  Insights
                </Badge>
                <Badge variant="outline" className="border-border/35 bg-background/70">
                  {totalGarments} pieces
                </Badge>
                <Badge variant="secondary" className="bg-background/60 text-foreground/68">
                  {rotationLabel}
                </Badge>
              </div>
              <div className="space-y-1.5">
                <h2 className="text-[1.45rem] font-semibold leading-[1.02] tracking-[-0.055em] text-foreground">
                  See what is active, what is missing, and what is worth repeating.
                </h2>
                <p className="max-w-[28rem] text-[0.86rem] leading-5 text-muted-foreground">
                  {narrative}
                </p>
              </div>
            </div>

            <Button variant="outline" size="sm" className="shrink-0 rounded-full border-border/20 bg-background/70 px-3" onClick={onOpenWardrobe}>
              Wardrobe
              <ArrowUpRight className="size-4" />
            </Button>
          </div>

          <div className="grid items-center gap-4 sm:grid-cols-[116px_minmax(0,1fr)]">
            <div className="mx-auto">
              <div className="relative">
                <UsageRing value={usageRate} size={112} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[1.8rem] font-semibold tracking-[-0.06em] text-foreground">
                    {usageRate}
                  </span>
                  <span className="text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground/65">
                    %
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <OverviewMetric
                label="Pieces"
                value={totalGarments}
                hint="In wardrobe"
                icon={Shirt}
                onClick={onOpenWardrobe}
              />
              <OverviewMetric
                label="Active"
                value={activeCount}
                hint="Used this month"
                icon={Gauge}
                onClick={onOpenUsed}
              />
              <OverviewMetric
                label="Saved"
                value={savedLooks}
                hint="Saved looks"
                icon={Bookmark}
                onClick={onOpenOutfits}
              />
              <OverviewMetric
                label="Dormant"
                value={dormantCount}
                hint="Needs styling"
                icon={CircleDot}
                onClick={onOpenUnused}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <OverviewMetric
            label="Planned"
            value={plannedThisWeek}
            hint="This week"
            icon={CalendarDays}
            onClick={onOpenPlan}
          />
          <OverviewMetric
            label={sustainabilityScore != null ? 'Efficiency' : 'Next move'}
            value={sustainabilityScore != null ? `${sustainabilityScore}/100` : 'Style me'}
            hint={sustainabilityScore != null ? 'Wardrobe score' : 'Generate a look now'}
            icon={sustainabilityScore != null ? Leaf : Sparkles}
            onClick={onGenerateLook}
          />
        </div>
      </div>
    </section>
  );
}
