// SettingsStyleScreen — Style DNA summary card (N13 split).
//
// Hero card at the top of the screen: shows the user's current archetype,
// freshness caption, vibes chip strip, signature color swatches, and a
// formality bucket strip. Sources from `useStyleDNA().data` (passed in by
// the parent so the parent owns the query).

import React from 'react';
import { Text, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { styleColorToHex } from '../theme/styleColors';
import { Eyebrow } from '../components/Eyebrow';
import { Caption } from '../components/Caption';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { Skeleton } from '../components/Skeleton';
import { FORMALITY_BUCKETS_DISPLAY } from '../hooks/useStyleDNA';
import { t as tr } from '../lib/i18n';
import { formatUpdatedAgo } from './SettingsStyleScreen.helpers';

export type DnaSummary = {
  archetype: string;
  updatedAt: string | null;
  vibes: readonly string[];
  signatureColors: readonly string[];
  formality: string;
};

export function DnaSummaryCard({ dna }: { dna: DnaSummary | undefined }) {
  const t = useTokens();
  return (
    <Card hero padding={18}>
      <Eyebrow style={{ marginBottom: 8 }}>{tr('settingsStyle.dnaPreview.title')}</Eyebrow>
      {dna ? (
        <>
          <Text
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 22,
              fontWeight: '500',
              color: t.fg,
              letterSpacing: -0.22,
              marginBottom: 4,
            }}>
            {dna.archetype}
          </Text>
          {(() => {
            const updatedAgo = formatUpdatedAgo(dna.updatedAt);
            return updatedAgo ? (
              <Caption style={{ marginBottom: 14 }}>{updatedAgo}</Caption>
            ) : (
              <View style={{ marginBottom: 14 }} />
            );
          })()}
        </>
      ) : (
        <Skeleton radius={4} height={26} style={{ width: 180, marginBottom: 14 }} />
      )}

      <Eyebrow style={{ marginBottom: 8 }}>Archetypes</Eyebrow>
      {dna && dna.vibes.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {dna.vibes.map((vibe) => (
            <Chip key={vibe} label={vibe} active />
          ))}
        </View>
      ) : dna ? (
        <Caption style={{ marginBottom: 16 }}>
          {tr('settingsStyle.dnaPreview.empty')}
        </Caption>
      ) : (
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
          <Skeleton radius={14} height={28} style={{ width: 80 }} />
          <Skeleton radius={14} height={28} style={{ width: 80 }} />
          <Skeleton radius={14} height={28} style={{ width: 80 }} />
        </View>
      )}

      {dna && dna.signatureColors.length > 0 ? (
        <>
          <Eyebrow style={{ marginBottom: 8 }}>Favorite colors</Eyebrow>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {dna.signatureColors.map((colorName) => (
              <View
                key={colorName}
                accessibilityLabel={colorName}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: styleColorToHex(colorName),
                  borderWidth: 1,
                  borderColor: t.border,
                }}
              />
            ))}
          </View>
        </>
      ) : null}

      <Eyebrow style={{ marginBottom: 8 }}>Formality</Eyebrow>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {FORMALITY_BUCKETS_DISPLAY.map((level) => (
          <Chip key={level} label={level} active={dna ? level === dna.formality : false} />
        ))}
      </View>
    </Card>
  );
}
