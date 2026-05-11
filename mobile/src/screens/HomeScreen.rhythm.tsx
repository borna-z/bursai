// HomeScreen — "Your rhythm" stat blocks (N13 split).
//
// Two stat tiles: pieces in wardrobe + wardrobe-used %. Loading uses a
// skeleton row; state derivation lives in the parent.

import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { StatRowSkeleton } from '../components/skeletons';
import { t as tr } from '../lib/i18n';

export type RhythmSectionProps = {
  loading: boolean;
  garmentTotal: string;
  wardrobeStatsAuthoritative: boolean;
  wardrobeUsedPct: number;
  onSeeInsights: () => void;
};

export function RhythmSection({
  loading,
  garmentTotal,
  wardrobeStatsAuthoritative,
  wardrobeUsedPct,
  onSeeInsights,
}: RhythmSectionProps) {
  const t = useTokens();
  return (
    <View>
      <View style={s.sectionHead}>
        <Text style={[s.sectionTitle, { color: t.fg, fontFamily: fonts.displayMedium }]}>{tr('home.section.rhythm')}</Text>
        <Pressable onPress={onSeeInsights}>
          <Text style={{ color: t.accent, fontSize: 12, fontWeight: '500', fontFamily: fonts.uiMed }}>{tr('home.rhythm.insightsLink')}</Text>
        </Pressable>
      </View>
      {loading ? (
        <StatRowSkeleton count={2} />
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <RhythmStat
            num={garmentTotal}
            label={tr('home.rhythm.piecesLabel')}
            onPress={onSeeInsights}
          />
          <RhythmStat
            num={wardrobeStatsAuthoritative ? `${wardrobeUsedPct}%` : '—'}
            label={tr('home.rhythm.usedLabel')}
            onPress={onSeeInsights}
          />
        </View>
      )}
    </View>
  );
}

function RhythmStat({ num, label, onPress }: { num: string; label: string; onPress: () => void }) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      style={[s.rhythmStat, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={{ fontFamily: fonts.displayMedium, fontStyle: 'italic', fontSize: 28, lineHeight: 28, fontWeight: '500', color: t.fg }}>
        {num}
      </Text>
      <Text style={{ fontSize: 10.5, marginTop: 6, textTransform: 'uppercase', letterSpacing: 1.7, color: t.fg2, fontFamily: fonts.uiSemi }}>
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 19, fontStyle: 'italic', fontWeight: '500', letterSpacing: -0.19 },
  rhythmStat: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
});
