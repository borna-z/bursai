// Wardrobe gaps — opened from HomeScreen Discover hub or Wardrobe smart tile.
// W4: wired to the real `wardrobe_gap_analysis` edge function via
// useWardrobeGaps. The hero still shows a static count copy until analysis
// resolves; the gap list, loading, empty and error states all feed off the
// hook.

import React, { useEffect, useMemo, useRef } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { ErrorState } from '../components/ErrorState';
import { useWardrobeGaps, type WardrobeGap } from '../hooks/useWardrobeGaps';
import { useGarmentCount } from '../hooks/useGarmentCount';
import type { RootStackParamList } from '../navigation/RootNavigator';

// Web parity: gap analysis is meaningless on a near-empty wardrobe — it would
// flag every basic category as a "gap". Web gates the CTA at 5 garments.
const MIN_GARMENTS_FOR_GAP_ANALYSIS = 5;


type Nav = NativeStackNavigationProp<RootStackParamList>;
type DisplayPriority = 'High' | 'Med' | 'Low';
type IconKey = 'tshirt' | 'hanger' | 'suitcase' | 'sun';

function categoryToIcon(category: string): IconKey {
  const c = category.toLowerCase();
  if (c.includes('shoe')) return 'sun';
  if (c.includes('outer')) return 'suitcase';
  if (c.includes('accessor') || c.includes('belt') || c.includes('bag')) return 'hanger';
  return 'tshirt';
}

function priorityLabel(p: WardrobeGap['priority']): DisplayPriority {
  if (p === 'high') return 'High';
  if (p === 'medium') return 'Med';
  return 'Low';
}

export function WardrobeGapsScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const { gaps, isLoading, error, analyzed, analyze, reset } = useWardrobeGaps();
  const { data: garmentCount, isFetching: isCountFetching } = useGarmentCount();
  const paywallShownRef = useRef(false);

  // `isFetching` (not `isLoading`) is the right signal here. After
  // useAddGarment / useDeleteGarment invalidate ['garments-count'], React
  // Query keeps the previous (stale) data on the next mount while it
  // refetches in the background — Codex P2 round 2. If we trusted the
  // value during that window, a delete that just took the wardrobe under
  // the threshold could still pass the gate before the refetch lands.
  // Treat the count as unknown while a fetch is in flight.
  const hasEnoughGarments =
    !isCountFetching &&
    typeof garmentCount === 'number' &&
    garmentCount >= MIN_GARMENTS_FOR_GAP_ANALYSIS;


  // Auto-run analysis when the screen mounts WITHOUT cached gaps. The hook
  // is React-Query backed so a return visit reads from cache instead of
  // burning the rate-limited endpoint (15/hr base). If the session hasn't
  // rehydrated yet, retry once it does — analyze() short-circuits without
  // a token, and the effect re-fires when accessToken flips truthy.
  // Codex audit P0-1 (audit 2) + P1-4 (audit 2).
  // Gate: don't auto-run on a near-empty wardrobe — gap analysis on <5
  // garments is noise. The user has to add more pieces first.
  useEffect(() => {
    if (analyzed || isLoading || error) return;
    if (!hasEnoughGarments) return;
    void analyze();
  }, [analyzed, isLoading, error, analyze, hasEnoughGarments]);
  // No unmount reset — the React Query cache is the cross-mount memory.

  useEffect(() => {
    if (error === 'subscription_required' && !paywallShownRef.current) {
      paywallShownRef.current = true;
      Alert.alert(
        'Premium feature',
        'Wardrobe Gap analysis is part of BURS Premium. Upgrade to unlock recommendations.',
        [{ text: 'OK' }],
      );
    }
    if (error !== 'subscription_required') {
      paywallShownRef.current = false;
    }
  }, [error]);

  const priorityPalette = (p: DisplayPriority): { bg: string; fg: string } => {
    if (p === 'High') return { bg: t.accentSoft, fg: t.accent };
    if (p === 'Med') return { bg: t.bg2, fg: t.fg2 };
    return { bg: t.bg2, fg: t.fg3 };
  };

  const iconFor = (key: IconKey) => {
    switch (key) {
      case 'tshirt':   return <TshirtIcon color={t.accent} size={20} />;
      case 'hanger':   return <HangerIcon color={t.accent} size={20} />;
      case 'suitcase': return <SuitcaseIcon color={t.accent} size={20} />;
      case 'sun':      return <SunIcon color={t.accent} size={20} />;
    }
  };

  const gapDisplays = useMemo(
    () =>
      gaps.map((g, i) => ({
        id: `${g.category}-${i}`,
        name: g.item_name,
        why: g.reason,
        priority: priorityLabel(g.priority),
        icon: categoryToIcon(g.category),
        price: g.estimated_price,
      })),
    [gaps],
  );

  // Codex P2: cached gaps must hide when the wardrobe drops below the
  // threshold. The React Query cache persists across mounts, so a delete that
  // takes the user under 5 garments would otherwise leave the stale gap list
  // rendered while the caption tells them to add more pieces — contradictory
  // UX. Gating the display (not the cache) keeps the count cheap to recover
  // if the user adds garments back.
  const showCachedAnalysis = hasEnoughGarments && analyzed;
  const heroCount = showCachedAnalysis ? gapDisplays.length : '—';
  const heroPiecesPluralized = showCachedAnalysis && gapDisplays.length === 1 ? '' : 's';

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

        {error && error !== 'subscription_required' ? (
          <ErrorState onRetry={() => analyze()} body={error} />
        ) : (
          <>
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
                <Text style={{ color: t.accent }}>{heroCount}</Text> key piece
                {heroPiecesPluralized}
              </Text>
              <Caption style={{ marginTop: 8, marginBottom: 14, lineHeight: 18 }}>
                {hasEnoughGarments
                  ? 'Identified from your last 90 days of wear, weather, and missed-occasion patterns.'
                  : `Add at least ${MIN_GARMENTS_FOR_GAP_ANALYSIS} garments so the analysis has enough signal to find real gaps.`}
              </Caption>
              <Button
                label={isLoading ? 'Analysing…' : 'Analyse now'}
                disabled={isLoading || !hasEnoughGarments}
                onPress={() => {
                  reset();
                  void analyze();
                }}
              />
            </Card>

            {isLoading ? (
              <View style={s.stateWrap}>
                <Spinner size={32} />
                <Caption style={{ marginTop: 14, textAlign: 'center' }}>
                  Reading your patterns…
                </Caption>
              </View>
            ) : null}

            {!isLoading && showCachedAnalysis && gapDisplays.length === 0 ? (
              <View style={s.stateWrap}>
                <PageTitle size={22}>No gaps found</PageTitle>
                <Caption style={{ marginTop: 6, textAlign: 'center', maxWidth: 240 }}>
                  Your wardrobe is well-balanced for the next 90 days.
                </Caption>
              </View>
            ) : null}

            {!isLoading && showCachedAnalysis && gapDisplays.length > 0 ? (
              <View style={[s.gapList, { backgroundColor: t.card, borderColor: t.border }]}>
                {gapDisplays.map((g, i) => {
                  const palette = priorityPalette(g.priority);
                  return (
                    <ListRow
                      key={g.id}
                      title={g.name}
                      subtitle={g.why}
                      last={i === gapDisplays.length - 1}
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
          </>
        )}
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
