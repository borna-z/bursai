// Wardrobe gaps — opened from HomeScreen Discover hub or Wardrobe smart tile.
// Top: hero card describing the analysis (eyebrow / italic gap count + caption / Analyse CTA).
// Body: list of detected gaps as ListRow with category icon + name + priority badge + chevron.
// Loading state shows a spinner while analysing; empty state confirms wardrobe is complete.
//
// Source: design_handoff_burs_rn/source/extra-screens.jsx WardrobeGapsScreen + handoff README §10.

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { IconBtn } from '../components/IconBtn';
import { ListRow } from '../components/ListRow';
import { Spinner } from '../components/Spinner';
import {
  BackIcon,
  HangerIcon,
  SuitcaseIcon,
  SunIcon,
  TshirtIcon,
} from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Priority = 'High' | 'Med' | 'Low';

type Gap = {
  id: string;
  name: string;
  why: string;
  priority: Priority;
  icon: 'tshirt' | 'hanger' | 'suitcase' | 'sun';
};

const GAPS: Gap[] = [
  { id: 'g1', name: 'Light raincoat',     why: 'Missed 4 forecasted rainy days', priority: 'High', icon: 'sun' },
  { id: 'g2', name: 'White button-up',    why: 'Most-worn category at 78%',      priority: 'High', icon: 'tshirt' },
  { id: 'g3', name: 'Brown leather belt', why: 'Pulls 6 outfits together',       priority: 'Med',  icon: 'hanger' },
  { id: 'g4', name: 'Wool socks',         why: 'Only 2 pairs in rotation',       priority: 'Med',  icon: 'tshirt' },
  { id: 'g5', name: 'Cap or hat',         why: 'Sun protection gap on weekends', priority: 'Low',  icon: 'suitcase' },
];

export function WardrobeGapsScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analyzed, setAnalyzed] = React.useState(true);

  const runAnalysis = () => {
    setAnalyzing(true);
    setAnalyzed(false);
    // Mock analysis. Once the gap-analysis hook lands, replace with the real fetch.
    setTimeout(() => {
      setAnalyzing(false);
      setAnalyzed(true);
    }, 900);
  };

  const priorityPalette = (p: Priority): { bg: string; fg: string } => {
    if (p === 'High') return { bg: t.accentSoft, fg: t.accent };
    if (p === 'Med') return { bg: t.bg2, fg: t.fg2 };
    return { bg: t.bg2, fg: t.fg3 };
  };

  const iconFor = (key: Gap['icon']) => {
    switch (key) {
      case 'tshirt':   return <TshirtIcon color={t.accent} size={20} />;
      case 'hanger':   return <HangerIcon color={t.accent} size={20} />;
      case 'suitcase': return <SuitcaseIcon color={t.accent} size={20} />;
      case 'sun':      return <SunIcon color={t.accent} size={20} />;
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={s.headerRow}>
        <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 4 }}>Analysis</Eyebrow>
          <PageTitle>Wardrobe Gaps</PageTitle>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 80, gap: 18 }}
        showsVerticalScrollIndicator={false}>

        <Card hero padding={20}>
          <Eyebrow style={{ marginBottom: 6 }}>Your wardrobe needs</Eyebrow>
          <Text
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 30,
              lineHeight: 32,
              fontWeight: '500',
              color: t.fg,
              letterSpacing: -0.3,
            }}>
            <Text style={{ color: t.accent }}>{GAPS.length}</Text> key pieces
          </Text>
          <Caption style={{ marginTop: 8, marginBottom: 14, lineHeight: 18 }}>
            Identified from your last 90 days of wear, weather, and missed-occasion patterns.
          </Caption>
          <Button
            label={analyzing ? 'Analysing…' : 'Analyse now'}
            disabled={analyzing}
            onPress={runAnalysis}
          />
        </Card>

        {analyzing ? (
          <View style={s.stateWrap}>
            <Spinner size={32} />
            <Caption style={{ marginTop: 14, textAlign: 'center' }}>
              Reading your patterns…
            </Caption>
          </View>
        ) : null}

        {!analyzing && analyzed && GAPS.length === 0 ? (
          <View style={s.stateWrap}>
            <PageTitle size={22}>No gaps found</PageTitle>
            <Caption style={{ marginTop: 6, textAlign: 'center', maxWidth: 240 }}>
              Your wardrobe is well-balanced for the next 90 days.
            </Caption>
          </View>
        ) : null}

        {!analyzing && analyzed && GAPS.length > 0 ? (
          <View style={[s.gapList, { backgroundColor: t.card, borderColor: t.border }]}>
            {GAPS.map((g, i) => {
              const palette = priorityPalette(g.priority);
              return (
                <ListRow
                  key={g.id}
                  title={g.name}
                  subtitle={g.why}
                  last={i === GAPS.length - 1}
                  left={
                    <View style={[s.gapIcon, { backgroundColor: t.accentSoft }]}>
                      {iconFor(g.icon)}
                    </View>
                  }
                  right={
                    <View style={[s.priBadge, { backgroundColor: palette.bg }]}>
                      <Text style={[s.priBadgeText, { color: palette.fg }]}>{g.priority}</Text>
                    </View>
                  }
                  style={{ paddingHorizontal: 14 }}
                />
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 14,
  },
  gapList: {
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  gapIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  priBadgeText: {
    fontFamily: fonts.uiSemi,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  stateWrap: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
