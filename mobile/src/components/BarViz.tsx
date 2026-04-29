// Horizontal row of vertical bars — wear-frequency style chart.
// Mirrors design_handoff_burs_rn/source/screens.jsx `.bar-viz` + `.bar` / `.bar.hi`.
//
// Container: 80px tall, bars bottom-aligned, gap 6px between bars.
// Each value is treated as an ABSOLUTE 0–100 percentage (clamped) — matches the
// prototype's `style={{ height: \`${h}%\` }}` direct passthrough. Earlier this file
// renormalized by dataset max, which inflated every chart whose max < 100 (e.g.
// 65 rendering as ~72% when max=90 — Codex P1 on PR #702).
// Bars whose value exceeds `threshold` (default 65) get the solid accent;
// the rest get accentSoft.
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

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 6,
        height: 80,
      }}>
      {values.map((v, i) => {
        const heightPct = Math.max(0, Math.min(100, v));
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
