// Wardrobe color palette — horizontal segmented bar + 2-col legend grid.
// Mirrors design_handoff_burs_rn/source/screens.jsx `.palette-bar` / `.palette-legend`.
//
// Each segment's hex is data, not a token — these are the user's actual wardrobe colors,
// so they bypass the "tokens only" rule by necessity. The bar's container, separators, swatch
// borders, and text colors all come from `useTokens()`.

import React from 'react';
import { Text, View } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

export type PaletteEntry = { name: string; hex: string; pct: number };

export function PaletteBar({ data }: { data: PaletteEntry[] }) {
  const t = useTokens();
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
        {data.map((c, i) => (
          <View
            key={`${c.name}-${i}`}
            style={{
              flex: c.pct,
              height: '100%',
              backgroundColor: c.hex,
              borderRightWidth: i < data.length - 1 ? 1 : 0,
              // Subtle separator that adapts to background — uses border so it works across both themes.
              borderRightColor: t.border,
            }}
          />
        ))}
      </View>

      {/* 2-col legend grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {data.map((c, i) => (
          <View
            key={`legend-${c.name}-${i}`}
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
                backgroundColor: c.hex,
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
              {c.name}
            </Text>
            <Text
              style={{
                fontFamily: fonts.uiMed,
                fontSize: 11,
                color: t.fg2,
                fontVariant: ['tabular-nums'],
              }}>
              {c.pct}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
