import { Lock } from 'lucide-react';

import { ColorBar } from '@/components/insights/MiniBar';
import { useLanguage } from '@/contexts/LanguageContext';
import type { ColorTemperatureData } from '@/hooks/useInsights';
import { cn } from '@/lib/utils';

import type { DashboardColorBar } from './useInsightsDashboardAdapter';

interface InsightsPalettePanelProps {
  bars: DashboardColorBar[];
  entries: Array<[string, number]>;
  total: number;
  colorTemperature: ColorTemperatureData;
  isPremium: boolean;
}

const COLOR_I18N: Record<string, string> = {
  black: 'color.black',
  white: 'color.white',
  grey: 'color.grey',
  navy: 'color.navy',
  blue: 'color.blue',
  red: 'color.red',
  green: 'color.green',
  beige: 'color.beige',
  brown: 'color.brown',
  pink: 'color.pink',
  yellow: 'color.yellow',
  orange: 'color.orange',
  purple: 'color.purple',
  svart: 'color.black',
  vit: 'color.white',
  'gr\u00e5': 'color.grey',
  'marinbl\u00e5': 'color.navy',
  'bl\u00e5': 'color.blue',
  'r\u00f6d': 'color.red',
  'gr\u00f6n': 'color.green',
  brun: 'color.brown',
  rosa: 'color.pink',
  gul: 'color.yellow',
  lila: 'color.purple',
};

function getPaletteSummary(dominantPalette: ColorTemperatureData['dominantPalette']) {
  if (dominantPalette === 'warm') return 'Warm-led';
  if (dominantPalette === 'cool') return 'Cool-led';
  if (dominantPalette === 'neutral') return 'Neutral-led';
  return 'Balanced';
}

export function InsightsPalettePanel({
  bars,
  entries,
  total,
  colorTemperature,
  isPremium,
}: InsightsPalettePanelProps) {
  const { t } = useLanguage();

  if (total === 0 || bars.length === 0) return null;

  return (
    <div className={cn('surface-secondary relative space-y-3 p-4', !isPremium && 'overflow-hidden')}>
      <div className={cn('space-y-3', !isPremium && 'blur-sm select-none')}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[1rem] font-semibold tracking-[-0.03em] text-foreground">
            Palette
          </h3>
          <p className="text-[0.78rem] text-muted-foreground">
            {getPaletteSummary(colorTemperature.dominantPalette)}
          </p>
        </div>

        <ColorBar colors={bars} total={total} />

        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground/65">Warm</p>
            <p className="mt-1 text-[1rem] font-semibold tracking-[-0.04em] text-foreground">
              {colorTemperature.warmCount}
            </p>
          </div>
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground/65">Cool</p>
            <p className="mt-1 text-[1rem] font-semibold tracking-[-0.04em] text-foreground">
              {colorTemperature.coolCount}
            </p>
          </div>
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground/65">Neutral</p>
            <p className="mt-1 text-[1rem] font-semibold tracking-[-0.04em] text-foreground">
              {colorTemperature.neutralCount}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {entries.map(([color, count]) => (
            <div key={color} className="flex items-center justify-between gap-3 text-[0.78rem]">
              <span className="truncate capitalize text-muted-foreground">
                {t(COLOR_I18N[color] || color)}
              </span>
              <span className="tabular-nums text-foreground/80">
                {Math.round((count / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {!isPremium ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background/15">
          <div className="rounded-full border border-border/50 bg-background/85 p-3">
            <Lock className="size-5 text-muted-foreground/60" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
