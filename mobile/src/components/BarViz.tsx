// Horizontal row of vertical bars — wear-frequency style chart.
// Mirrors design_handoff_burs_rn/source/screens.jsx `.bar-viz` + `.bar` / `.bar.hi`.
//
// Container: 80px tall, bars bottom-aligned, gap 6px between bars.
// Each bar's height is its value as a percentage of the max in the dataset.
// Bars whose RAW value (not normalized) crosses `threshold` (default 65) get the solid accent;
// the rest get accentSoft. This matches the prototype's `.bar.hi` rule which keys off the same
// 0..100 scale the data is already in — so pass values in 0..100 to keep that visual contract.
//
// Rounded top corners only — `borderRadius: '6px 6px 2px 2px'` in the CSS — RN supports this via
// the per-corner radius props.

import React from 'react';
import { View } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';

export function BarViz({
  values,
  threshold = 65,
}: {
  values: number[];
  threshold?: number;
}) {
  const t = useTokens();
  const max = values.length ? Math.max(...values, 1) : 1;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 6,
        height: 80,
      }}>
      {values.map((v, i) => {
        const heightPct = Math.max(0, Math.min(100, (v / max) * 100));
        const hi = v > threshold;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: `${heightPct}%`,
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
  );
}
