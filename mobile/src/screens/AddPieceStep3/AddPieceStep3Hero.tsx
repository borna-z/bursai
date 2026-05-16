// Phase 6 — AddPiece Step 3 hero block. Extracted from the orchestrator JSX
// (no logic changes) so the orchestrator stays under the 600-line target
// while the visual surface remains byte-for-byte identical with the
// pre-refactor screen.

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import { Eyebrow } from '../../components/Eyebrow';
import { Chip } from '../../components/Chip';
import { t as tr } from '../../lib/i18n';

interface AddPieceStep3HeroProps {
  photoUri: string;
  maskedSignedUrl: string | null | undefined;
  title: string | null | undefined;
  category: string | null | undefined;
  colorPrimary: string | null | undefined;
  confidence: number | null | undefined;
}

function titleCase(value: string | null | undefined): string {
  if (!value) return tr('common.empty');
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function AddPieceStep3Hero({
  photoUri,
  maskedSignedUrl,
  title,
  category,
  colorPrimary,
  confidence,
}: AddPieceStep3HeroProps) {
  const t = useTokens();
  // Missing confidence (`null`) is treated as low — the badge surfaces a
  // prompt to review fields rather than the auto-confirmed copy.
  const confidenceHigh = typeof confidence === 'number' && confidence >= 0.7;

  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View
        style={[s.heroImage, { borderColor: t.border, backgroundColor: t.bg2 }]}>
        <Image
          source={{ uri: maskedSignedUrl ?? photoUri }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      </View>
      <View style={{ flex: 1, paddingTop: 4 }}>
        <Eyebrow style={{ marginBottom: 4 }}>{tr('addpiece.step3.detected')}</Eyebrow>
        <Text
          style={{
            fontFamily: fonts.displayMedium,
            fontStyle: 'italic',
            fontWeight: '500',
            fontSize: 22,
            lineHeight: 26,
            letterSpacing: -0.22,
            color: t.fg,
          }}>
          {title || tr('addpiece.step3.untitled')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
          <View
            accessible
            accessibilityLabel={
              confidenceHigh
                ? tr('addpiece.step3.confidence.high.aria')
                : tr('addpiece.step3.confidence.low.aria')
            }
            style={[
              s.confidenceBadge,
              {
                backgroundColor: confidenceHigh ? t.accentSoft : t.destructiveSoft,
                borderColor: confidenceHigh ? t.accent : t.destructive,
              },
            ]}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 10,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: confidenceHigh ? t.accent : t.destructive,
              }}>
              {confidenceHigh
                ? tr('addpiece.step3.confidence.high')
                : tr('addpiece.step3.confidence.low')}
            </Text>
          </View>
          <Chip label={titleCase(category)} />
          {colorPrimary ? <Chip label={titleCase(colorPrimary)} /> : null}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  heroImage: {
    width: 100,
    height: 130,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
