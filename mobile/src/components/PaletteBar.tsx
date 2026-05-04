// Wardrobe color palette — horizontal segmented bar + 2-col legend grid.
// Mirrors design_handoff_burs_rn/source/screens.jsx `.palette-bar` / `.palette-legend`.
//
// Each segment's hex is data, not a token — these are the user's actual wardrobe colors,
// so they bypass the "tokens only" rule by necessity. The bar's container, separators, swatch
// borders, and text colors all come from `useTokens()`.
//
// W6: switched from the design-handoff `{ name, hex, pct }` shape to the
// hook-native `InsightsPaletteEntry` (`{ color, label, percent }`). Empty
// arrays render an inline caption instead of a zero-segment bar.

import React from 'react';
import { Text, View } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Caption } from './Caption';
import type { InsightsPaletteEntry } from '../hooks/useInsightsDashboard';

export type PaletteEntry = InsightsPaletteEntry;

export function PaletteBar({ entries }: { entries: InsightsPaletteEntry[] }) {
  const t = useTokens();

  if (!entries || entries.length === 0) {
    return (
      <Caption style={{ paddingVertical: 8 }}>
        Wear more garments to build your color profile.
      </Caption>
    );
  }

  return (
    <View style={{ flexDirection: 'column', gap: 10 }}>
      {/* Segmented horizontal bar */}
      <View
        style={{
          flexDirection: 'row',
          height: 36,
          borderRadius: 10,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: t.border,
        }}>
        {entries.map((c, i) => (
          <View
            key={`${c.label}-${i}`}
            style={{
              flex: c.percent,
              height: '100%',
              backgroundColor: c.color,
              borderRightWidth: i < entries.length - 1 ? 1 : 0,
              borderRightColor: t.border,
            }}
          />
        ))}
      </View>

      {/* 2-col legend grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {entries.map((c, i) => (
          <View
            key={`legend-${c.label}-${i}`}
            style={{
              width: '50%',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 4,
              paddingRight: 8,
            }}>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 4,
                backgroundColor: c.color,
                borderWidth: 1,
                borderColor: t.border,
              }}
            />
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontFamily: fonts.uiMed,
                fontSize: 11.5,
                color: t.fg,
                letterSpacing: -0.11,
              }}>
              {c.label}
            </Text>
            <Text
              style={{
                fontFamily: fonts.uiMed,
                fontSize: 11,
                color: t.fg2,
                fontVariant: ['tabular-nums'],
              }}>
              {c.percent}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
