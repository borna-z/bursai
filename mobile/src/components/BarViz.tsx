// Horizontal row of vertical bars — wear-frequency style chart.
// Mirrors design_handoff_burs_rn/source/screens.jsx `.bar-viz` + `.bar` / `.bar.hi`.
//
// W6: switched from `values: number[]` (absolute 0–100) to `bars: InsightsBarDay[]`
// — `{ label, value, max }` from useInsightsDashboard. Bars scale to the
// dataset's `max`, so a sparse week still produces full-height peaks instead
// of pinning to a hardcoded 100. A min-height of 2px guarantees an empty bar
// is still visible (otherwise `value=0` would render nothing and the row
// would silently collapse).
//
// Container: 80px tall, bars bottom-aligned, gap 6px between bars. Bars whose
// share exceeds `threshold` (default 0.65 of max) get the solid accent; the
// rest get accentSoft. Optional weekday labels render below each bar.

import React from 'react';
import { Text, View } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import type { InsightsBarDay } from '../hooks/useInsightsDashboard';

export function BarViz({
  bars,
  threshold = 0.65,
  showLabels = true,
}: {
  bars: InsightsBarDay[];
  threshold?: number;
  showLabels?: boolean;
}) {
  const t = useTokens();

  return (
    <View style={{ gap: 6 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 6,
          height: 80,
        }}>
        {bars.map((b, i) => {
          const safeMax = Math.max(1, b.max);
          const ratio = Math.max(0, Math.min(1, b.value / safeMax));
          // 2px floor so an empty bar stays visible — otherwise the row
          // silently collapses to nothing on a slow week.
          const heightPct = Math.max(2 / 80, ratio); // 2px / 80px container
          const hi = ratio >= threshold;
          return (
            <View
              key={`${b.label}-${i}`}
              style={{
                flex: 1,
                height: `${heightPct * 100}%`,
                backgroundColor: hi ? t.accent : t.accentSoft,
                borderTopLeftRadius: 6,
                borderTopRightRadius: 6,
                borderBottomLeftRadius: 2,
                borderBottomRightRadius: 2,
              }}
            />
          );
        })}
      </View>
      {showLabels ? (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {bars.map((b, i) => (
            <Text
              key={`label-${b.label}-${i}`}
              numberOfLines={1}
              style={{
                flex: 1,
                textAlign: 'center',
                fontFamily: fonts.uiMed,
                fontSize: 10,
                color: t.fg3,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}>
              {b.label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
