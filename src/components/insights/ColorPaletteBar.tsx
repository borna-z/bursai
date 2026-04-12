import { useLanguage } from '@/contexts/LanguageContext';

interface ColorPaletteBarProps {
  segments: { color: string; label: string; percentage: number }[];
}

export function ColorPaletteBar({ segments }: ColorPaletteBarProps) {
  const { t } = useLanguage();

  const filtered = segments.filter((s) => s.percentage > 0);
  const total = filtered.reduce((sum, s) => sum + s.percentage, 0);

  return (
    <div className="mx-[var(--page-px)] mb-4 bg-card/30 border-[0.5px] border-border/40 rounded-[18px] p-[18px]">
      <div className="mb-3">
        <span className="text-foreground font-medium" style={{ fontSize: 13 }}>
          {t('insights.yourPalette') || 'Your Palette'}
        </span>
      </div>

      {/* Stacked bar */}
      <div className="flex rounded-full overflow-hidden" style={{ height: 28 }}>
        {filtered.length === 0 ? (
          <div className="flex-1 bg-border/30 rounded-full" />
        ) : (
          filtered.map((seg, i) => {
            const widthPct = total > 0 ? (seg.percentage / total) * 100 : 100 / filtered.length;
            return (
              <div
                key={i}
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: seg.color,
                  minWidth: 4,
                }}
              />
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {filtered.map((seg, i) => (
          <div key={i} className="flex items-center gap-[6px]">
            <div
              className="rounded-full flex-shrink-0"
              style={{ width: 8, height: 8, backgroundColor: seg.color }}
            />
            <span className="text-foreground" style={{ fontSize: 10, opacity: 0.6 }}>
              {seg.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
