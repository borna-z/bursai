import { useLanguage } from '@/contexts/LanguageContext';

interface WearFrequencyChartProps {
  data: { day: string; count: number }[];
}

export function WearFrequencyChart({ data }: WearFrequencyChartProps) {
  const { t } = useLanguage();
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="mx-[var(--page-px)] mb-4 bg-card/30 border-[0.5px] border-border/40 rounded-[18px] p-[18px]">
      <div className="flex items-center justify-between mb-4">
        <span className="text-foreground font-medium" style={{ fontSize: 13 }}>
          {t('insights.wearFrequency') || 'Wear Frequency'}
        </span>
        <span className="text-foreground" style={{ fontSize: 11, opacity: 0.45 }}>
          {t('insights.last30Days') || 'Last 30 days'}
        </span>
      </div>

      <div className="flex items-end gap-[6px] h-[64px]">
        {data.map((item, i) => {
          const opacity = item.count === 0 ? 0.12 : 0.2 + (item.count / max) * 0.8;
          const heightPct = item.count === 0 ? 8 : Math.max((item.count / max) * 100, 8);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-[6px]">
              <div className="w-full flex items-end" style={{ height: 48 }}>
                <div
                  className="w-full rounded-[4px]"
                  style={{
                    height: `${heightPct}%`,
                    background: `hsl(var(--accent) / ${opacity})`,
                    minHeight: 4,
                  }}
                />
              </div>
              <span className="text-foreground" style={{ fontSize: 8, opacity: 0.3 }}>
                {item.day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
