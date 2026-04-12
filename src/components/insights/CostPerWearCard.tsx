import { useLanguage } from '@/contexts/LanguageContext';

interface CostPerWearCardProps {
  bestValue: number;
  average: number;
  worst: number;
  currency?: string;
}

export function CostPerWearCard({ bestValue, average, worst, currency = '' }: CostPerWearCardProps) {
  const { t } = useLanguage();

  const maxVal = Math.max(worst, average, bestValue, 1);

  const rows = [
    {
      label: t('insights.bestValue') || 'Best value',
      value: bestValue,
      color: 'hsl(142 71% 45%)',
      barColor: 'hsl(142 71% 45% / 0.75)',
    },
    {
      label: t('insights.average') || 'Average',
      value: average,
      color: 'hsl(var(--accent))',
      barColor: 'hsl(var(--accent) / 0.75)',
    },
    {
      label: t('insights.worst') || 'Worst',
      value: worst,
      color: 'hsl(0 72% 51%)',
      barColor: 'hsl(0 72% 51% / 0.75)',
    },
  ];

  const fmt = (v: number) =>
    v > 0 ? `${currency}${v.toFixed(2)}` : '—';

  return (
    <div className="bg-card/30 border-[0.5px] border-border/40 rounded-[18px] p-[14px] flex flex-col">
      <span className="text-foreground font-medium mb-3" style={{ fontSize: 12 }}>
        {t('insights.costPerWear') || 'Cost / Wear'}
      </span>

      <div className="flex flex-col gap-3 flex-1 justify-center">
        {rows.map(({ label, value, barColor }) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-foreground" style={{ fontSize: 9, opacity: 0.5 }}>
                {label}
              </span>
              <span className="text-foreground font-medium" style={{ fontSize: 10 }}>
                {fmt(value)}
              </span>
            </div>
            <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: 'hsl(var(--border) / 0.3)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(value / maxVal) * 100}%`,
                  background: barColor,
                  minWidth: value > 0 ? 4 : 0,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
