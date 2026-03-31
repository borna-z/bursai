import { TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InsightsValueTrackerProps {
  costPerWear?: number;
  sustainabilityScore?: number | null;
  utilizationRate?: number;
  isPremium: boolean;
}

export function InsightsValueTracker({
  costPerWear,
  sustainabilityScore,
  utilizationRate,
  isPremium,
}: InsightsValueTrackerProps) {
  const stats = [
    {
      label: 'Per wear',
      value: costPerWear != null ? `$${costPerWear.toFixed(2)}` : '—',
      icon: <TrendingDown className="h-3 w-3 text-success" />,
    },
    {
      label: 'Score',
      value: sustainabilityScore != null && sustainabilityScore >= 70 ? 'A+' : sustainabilityScore != null && sustainabilityScore >= 50 ? 'B' : 'C',
    },
    {
      label: 'Use',
      value: utilizationRate != null ? `${utilizationRate}%` : '—',
    },
  ];

  return (
    <div className={cn('surface-secondary space-y-3 p-4', !isPremium && 'relative overflow-hidden')}>
      <div className={cn(!isPremium && 'blur-sm select-none')}>
        <p className="label-editorial mb-3 text-muted-foreground/60">Value</p>
        <div className="grid grid-cols-3 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-[0.95rem] bg-background/55 p-2.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/60">
                {stat.label}
              </p>
              <div className="mt-1 flex items-center gap-1">
                <span className="text-[1rem] font-semibold tracking-[-0.04em] text-foreground">
                  {stat.value}
                </span>
                {stat.icon}
              </div>
            </div>
          ))}
        </div>
      </div>
      {!isPremium && <div className="absolute inset-0 bg-background/15" />}
    </div>
  );
}
