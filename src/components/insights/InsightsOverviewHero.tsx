import type { ElementType } from 'react';

import { motion } from 'framer-motion';
import { ArrowUpRight, Bookmark, CalendarDays, CircleDot, Gauge, Leaf, Shirt, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function UsageRing({ value, size = 144 }: { value: number; size?: number }) {
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
        'surface-secondary group flex min-h-[104px] flex-col justify-between p-4 text-left',
        onClick ? 'press' : 'cursor-default',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">
          {label}
        </p>
        <Icon className="size-4 text-muted-foreground/45 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
      <div className="space-y-1">
        <p className="text-[1.7rem] font-semibold tracking-[-0.05em] text-foreground">
          {value}
        </p>
        <p className="text-[0.82rem] leading-5 text-muted-foreground">{hint}</p>
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
    usageRate >= 60 ? 'Healthy rotation' : usageRate >= 35 ? 'Building rotation' : 'Dormant wardrobe';

  const narrative = dnaArchetype
    ? `${activeCount} pieces are active right now and your wardrobe reads ${dnaArchetype.toLowerCase()}.`
    : `${activeCount} pieces are active right now. Save more worn looks to sharpen your DNA.`;

  return (
    <section className="surface-hero relative overflow-hidden px-5 py-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--accent)/0.14),transparent_42%),linear-gradient(180deg,hsl(var(--background)/0),hsl(var(--background)/0.72))]" />

      <div className="relative space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-border/40 bg-background/55">
                Last 30 days
              </Badge>
              <Badge variant="secondary" className="bg-background/60">
                {rotationLabel}
              </Badge>
            </div>
            <div className="space-y-2">
              <h2 className="text-[1.9rem] font-semibold leading-[1.02] tracking-[-0.055em] text-foreground">
                Rotation, DNA, and value in one working view.
              </h2>
              <p className="max-w-[30rem] text-[0.96rem] leading-6 text-muted-foreground">
                {narrative}
              </p>
            </div>
          </div>

          <Button variant="ghost" size="sm" className="shrink-0 rounded-full px-3" onClick={onOpenWardrobe}>
            Wardrobe
            <ArrowUpRight className="size-4" />
          </Button>
        </div>

        <div className="grid gap-6 sm:grid-cols-[156px_1fr] sm:items-center">
          <div className="mx-auto">
            <div className="relative">
              <UsageRing value={usageRate} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[2.4rem] font-semibold tracking-[-0.06em] text-foreground">
                  {usageRate}
                </span>
                <span className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
                  %
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <OverviewMetric
              label="Total pieces"
              value={totalGarments}
              hint="Full wardrobe count"
              icon={Shirt}
              onClick={onOpenWardrobe}
            />
            <OverviewMetric
              label="Active rotation"
              value={activeCount}
              hint="Worn in the last month"
              icon={Gauge}
              onClick={onOpenUsed}
            />
            <OverviewMetric
              label="Saved looks"
              value={savedLooks}
              hint="Reusable complete outfits"
              icon={Bookmark}
              onClick={onOpenOutfits}
            />
            <OverviewMetric
              label="Dormant"
              value={dormantCount}
              hint="Pieces waiting to be styled"
              icon={CircleDot}
              onClick={onOpenUnused}
            />
            <OverviewMetric
              label="Planned this week"
              value={plannedThisWeek}
              hint="Looks already on the calendar"
              icon={CalendarDays}
              onClick={onOpenPlan}
            />
            <OverviewMetric
              label={sustainabilityScore != null ? 'Sustainability' : 'Next move'}
              value={sustainabilityScore != null ? `${sustainabilityScore}/100` : 'Style me'}
              hint={sustainabilityScore != null ? 'Wardrobe efficiency score' : 'Generate a look from what you own'}
              icon={sustainabilityScore != null ? Leaf : Sparkles}
              onClick={onGenerateLook}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
