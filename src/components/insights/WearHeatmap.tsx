import { CalendarDays, Flame, Lock } from 'lucide-react';
import { useWearHeatmap } from '@/hooks/useAdvancedInsights';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const STATUS_COLORS = {
  planned: 'bg-green-500',
  improvised: 'bg-primary',
  none: 'bg-muted/40',
} as const;

export function WearHeatmap({ isPremium, className }: { isPremium: boolean; className?: string }) {
  const { t } = useLanguage();
  const { data } = useWearHeatmap();

  if (!data) return null;

  // Group into weeks (7-day rows)
  const weeks: typeof data.days[] = [];
  for (let i = 0; i < data.days.length; i += 7) {
    weeks.push(data.days.slice(i, i + 7));
  }

  return (
    <div className={cn('surface-secondary space-y-4 p-4', className)}>
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-muted-foreground/50" />
        <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          {t('insights.heatmap')}
        </span>
      </div>
      <div className={cn(!isPremium && "relative")}>
        <div className={cn("space-y-4", !isPremium && "blur-sm select-none")}>
          {/* Stats row */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 flex-1 rounded-xl bg-orange-500/8 border border-orange-500/10 p-3">
              <Flame className="w-5 h-5 text-orange-500" />
              <div>
                <span className="text-lg font-bold tabular-nums">{data.streak}</span>
                <p className="text-[10px] text-muted-foreground/60">{t('insights.day_streak')}</p>
              </div>
            </div>
            <div className="flex-1 rounded-xl bg-muted/40 border border-border/10 p-3 text-center">
              <span className="text-lg font-bold tabular-nums">{data.consistency}%</span>
              <p className="text-[10px] text-muted-foreground/60">{t('insights.consistency')}</p>
            </div>
          </div>

          {/* Grid */}
          <div className="space-y-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex gap-1">
                {week.map((day) => (
                  <div
                    key={day.date}
                    className={cn(
                      "flex-1 aspect-square rounded-sm",
                      STATUS_COLORS[day.status]
                    )}
                    title={`${day.date}: ${day.status}`}
                  />
                ))}
                {/* Fill incomplete week */}
                {week.length < 7 && Array.from({ length: 7 - week.length }).map((_, i) => (
                  <div key={`pad-${i}`} className="flex-1 aspect-square" />
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 justify-center">
            {(['planned', 'improvised', 'none'] as const).map(s => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={cn("w-2.5 h-2.5 rounded-sm", STATUS_COLORS[s])} />
                <span className="text-[10px] text-muted-foreground/60">{t(`insights.heatmap_${s}`)}</span>
              </div>
            ))}
          </div>
        </div>
        {!isPremium && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Lock className="w-5 h-5 text-muted-foreground/40" />
          </div>
        )}
      </div>
    </div>
  );
}
