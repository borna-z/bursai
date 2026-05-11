// OutfitDetailScreen — loading + not-found shells (N13 split).
//
// Two early-return surfaces: a spinner-only screen while useOutfit is
// loading, and a "not found" empty state when the id resolves to no row.
// Both share the screen's header chrome but skip the rest of the body.

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { BackIcon } from '../components/icons';
import { t as tr } from '../lib/i18n';

export function LoadingShell({ onBack }: { onBack: () => void }) {
  const t = useTokens();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.headerRow, { borderBottomColor: t.border }]}>
        <IconBtn ariaLabel="Back" onPress={onBack} variant="ghost">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }} />
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.accent} />
      </View>
    </SafeAreaView>
  );
}

export function NotFoundShell({ onBack }: { onBack: () => void }) {
  const t = useTokens();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.headerRow, { borderBottomColor: t.border }]}>
        <IconBtn ariaLabel="Back" onPress={onBack} variant="ghost">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Eyebrow>Outfit</Eyebrow>
        </View>
        <View style={{ width: 40 }} />
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 }}>
        <Text
          style={{
            fontFamily: fonts.displayMedium,
            fontStyle: 'italic',
            fontSize: 22,
            color: t.fg,
            textAlign: 'center',
            letterSpacing: -0.22,
          }}>
          {tr('outfit.detail.notFound.title')}
        </Text>
        <Text
          style={{
            fontFamily: fonts.ui,
            fontSize: 13,
            color: t.fg2,
            textAlign: 'center',
            lineHeight: 19,
          }}>
          {tr('outfit.detail.notFound.body')}
        </Text>
        <Button label={tr('common.back')} variant="outline" onPress={onBack} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
});
