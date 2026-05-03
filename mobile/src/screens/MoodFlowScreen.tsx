// MoodFlow — standalone "find my mood outfit" loading + result screen.
// Pixel-faithful adaptation of design_handoff_burs_rn/source/audit-screens.jsx MoodFlowScreen.
//
// Layout: top header (back · "Mood" + "Mood Flow") → loading state (centered Spinner +
// italic Playfair "Finding your look…" + mood label) OR result state (eyebrow + Playfair
// outfit name + 4-piece thumb row in OutfitCard + mood/context chips + editorial copy +
// "Wear this" / "Restyle" / "Save" actions).
//
// Behaviour: useEffect with a 2s setTimeout flips from loading → result on mount. Tapping
// "Restyle" resets to loading and re-flips, simulating a regen.

import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { IconBtn } from '../components/IconBtn';
import { Spinner } from '../components/Spinner';
import { OutfitCard } from '../components/OutfitCard';
import { BackIcon } from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'MoodFlow'>;

// Defaults used when a caller (deep link, future test harness) lands on MoodFlow without
// supplying params. The MoodOutfitScreen entry path always passes both.
const DEFAULT_MOOD = 'Confident';
const DEFAULT_TIME = 'Day';

export function MoodFlowScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  // Read the user's selections threaded through from MoodOutfitScreen. Codex P2 on PR #706.
  const MOOD_LABEL = route.params?.moodId ?? DEFAULT_MOOD;
  const TIME_LABEL = route.params?.time ?? DEFAULT_TIME;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loading) return;
    const id = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(id);
  }, [loading]);

  const restyle = () => setLoading(true);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* ============ HEADER ============ */}
      <View style={[s.header, { borderBottomColor: t.border }]}>
        <IconBtn variant="ghost" onPress={() => nav.goBack()} ariaLabel="Back">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>{MOOD_LABEL.toUpperCase()}</Eyebrow>
          <PageTitle size={26}>Mood Flow</PageTitle>
        </View>
      </View>

      {loading ? (
        // ============ LOADING STATE ============
        <View style={s.loadingWrap}>
          <Spinner size={48} />
          <Text
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontWeight: '500',
              fontSize: 22,
              color: t.fg,
              letterSpacing: -0.22,
              textAlign: 'center',
            }}>
            Finding your look…
          </Text>
          <Text
            style={{
              fontFamily: fonts.uiMed,
              fontSize: 12,
              color: t.fg2,
              letterSpacing: -0.1,
              textAlign: 'center',
            }}>
            Pulling pieces that hold &ldquo;{MOOD_LABEL.toLowerCase()}&rdquo;
          </Text>
        </View>
      ) : (
        // ============ RESULT STATE ============
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 18 }}
          showsVerticalScrollIndicator={false}>
          <View>
            <Eyebrow style={{ marginBottom: 4 }}>Your mood outfit</Eyebrow>
            <PageTitle size={28}>{MOOD_LABEL} · soft</PageTitle>
            <Text
              style={{
                fontFamily: fonts.ui,
                fontSize: 13.5,
                lineHeight: 20,
                color: t.fg2,
                marginTop: 8,
                letterSpacing: -0.13,
              }}>
              Built around steady earth tones with a single sharp accent — the kind of fit that
              keeps you grounded but doesn&rsquo;t fade. Lean into the wool overshirt; the linen
              softens the edge.
            </Text>
          </View>

          <OutfitCard
            name={`${MOOD_LABEL.toLowerCase()} · ${TIME_LABEL.toLowerCase()}`}
            sub="4 PIECES · 14° CLEAR"
            hues={[32, 28, 200, 18]}
          />

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Chip label={MOOD_LABEL} active />
            <Chip label={TIME_LABEL} />
            <Chip label="Earth" />
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Wear this" onPress={() => nav.navigate('OutfitDetail')} block style={{ flex: 1 }} />
            <Button label="Restyle" variant="outline" onPress={restyle} />
          </View>
          <Button
            label="Save look"
            variant="outline"
            onPress={() => Alert.alert('Saved', 'Look saved to your outfits.')}
            block
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingHorizontal: 32,
  },
});
