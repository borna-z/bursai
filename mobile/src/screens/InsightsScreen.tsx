// Insights — wired to real Supabase data via useInsightsDashboard (W6).
// Sections: header (eyebrow + title) · 2-col stats · 3-col gauges · palette card ·
// wear-frequency card · most-worn list (real garments, navigate to GarmentDetail) ·
// cost-per-wear quote.
//
// All metrics derive from the user's garments + last-30-days wear_logs in a single
// round-trip — see the hook for why we don't hit the insights_dashboard edge function
// here. Loading uses skeletons, errors show ErrorState with retry, an empty wardrobe
// surfaces a CTA back to AddPiece.
//
// BottomNav lives in MainTabsScreen, NOT here — that's the parent tab container's job.
// Per HARD RULE: SafeAreaView wraps the screen. We restrict edges to ['top'] so the
// floating BottomNav (absolute-positioned in MainTabsScreen) keeps its own bottom-inset
// spacing without a double-pad.

import React from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import { StatBlock } from '../components/StatBlock';
import { Gauge } from '../components/Gauge';
import { PaletteBar } from '../components/PaletteBar';
import { BarViz } from '../components/BarViz';
import { Skeleton, StatRowSkeleton, GarmentListSkeleton } from '../components/skeletons';
import { ErrorState } from '../components/ErrorState';
import { ChevronIcon } from '../components/icons';
import { WardrobeAgingPanel } from '../components/WardrobeAgingPanel';
import {
  useInsightsDashboard,
  type InsightsMostWorn,
} from '../hooks/useInsightsDashboard';
import { useSignedUrls } from '../hooks/useSignedUrl';
import { useNow } from '../hooks/useNow';
import { t as tr } from '../lib/i18n';
import {
  useWardrobeAging,
  WardrobeAgingSubscriptionError,
  type WardrobeAgingBucketId,
} from '../hooks/useWardrobeAging';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// "Last 30 days" — header eyebrow. Constant string today, but kept in this module so
// the call site reads as data, not a literal.
function buildHeaderEyebrow(): string {
  return 'Last 30 days';
}

// Returns localized "Mar 28" / "28 mars" / "3月28日" for the wear-chart range labels.
// Locale-aware — `undefined` = device locale, so the order ("Mar 28" vs "28 mars")
// follows the user's region naturally.
function formatRangeDate(today: Date, daysAgo: number): string {
  const d = new Date(today);
  d.setDate(today.getDate() - daysAgo);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function MostWornRow({
  item,
  imageUrl,
  onPress,
  showSeparator,
}: {
  item: InsightsMostWorn;
  imageUrl: string | null;
  onPress: () => void;
  showSeparator: boolean;
}) {
  const t = useTokens();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.wearCount} wears`}
      style={({ pressed }) => [
        s.mostWornRow,
        {
          borderBottomColor: t.border,
          borderBottomWidth: showSeparator ? 1 : 0,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      {/* Photo thumb — gradient fallback only renders while the signed URL is
          unresolved (or missing entirely), so loaded rows don't pay for an
          off-screen LinearGradient on every re-render. */}
      <View
        style={[
          s.mostWornThumb,
          { backgroundColor: t.bg2, borderColor: t.border },
        ]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={[t.card2, t.bg2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
      </View>
      {/* Text */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 13.5,
            fontWeight: '600',
            color: t.fg,
            letterSpacing: -0.135,
          }}>
          {item.title}
        </Text>
        {item.category ? <Caption>{item.category}</Caption> : null}
      </View>
      {/* Wear count badge */}
      <View
        style={{
          backgroundColor: t.accentSoft,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
        }}>
        <Text
          style={{
            fontFamily: fonts.displayMedium,
            fontStyle: 'italic',
            fontSize: 15,
            fontWeight: '500',
            color: t.accent,
            letterSpacing: -0.15,
          }}>
          {item.wearCount}
        </Text>
      </View>
      <View style={{ paddingLeft: 4 }}>
        <ChevronIcon color={t.fg3} />
      </View>
    </Pressable>
  );
}

// `active` reflects whether this tab is currently shown — MainTabsScreen keeps every tab
// mounted but hides inactive ones with `display: 'none'`, so the parent must tell us when
// we're actually visible. Defaults to true so standalone usage (tests / future routes) works.
export function InsightsScreen({ active = true }: { active?: boolean } = {}) {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const { width: screenWidth } = useWindowDimensions();
  // Reactive `now` so the eyebrow + range labels recompute when the date
  // rolls over while the screen is mounted. Same fix HomeScreen / PlanScreen
  // got — keep behaviour consistent.
  const now = useNow();
  const headerEyebrow = buildHeaderEyebrow();
  // Wear-frequency card spans the last 7 days (matches what `BarViz` renders),
  // so the bracketing labels also show that window — not the full 30d eyebrow.
  const rangeStart = formatRangeDate(now, 6);
  const rangeEnd = formatRangeDate(now, 0);

  const { data, isLoading, isError, refetch, isRefetching } = useInsightsDashboard();

  // M22 — wardrobe aging panel. Independent React Query call (1h
  // staleTime) so the heavy insights dashboard query can fire in
  // parallel. Subscription_required flips the user into the paywall
  // exactly once per error window via a sticky ref — same pattern
  // WardrobeGaps uses, so the gate looks identical wherever a paid
  // surface is gated.
  const aging = useWardrobeAging();
  const agingPaywallShownRef = React.useRef(false);
  const agingSubscriptionLocked = aging.error instanceof WardrobeAgingSubscriptionError;
  React.useEffect(() => {
    if (agingSubscriptionLocked && !agingPaywallShownRef.current) {
      agingPaywallShownRef.current = true;
      nav.navigate('Paywall');
    }
    if (!agingSubscriptionLocked) {
      agingPaywallShownRef.current = false;
    }
  }, [agingSubscriptionLocked, nav]);

  const onAgingRowTap = React.useCallback(
    (bucketId: WardrobeAgingBucketId) => {
      nav.navigate('UnusedGarments', { bucketId });
    },
    [nav],
  );

  // Batch the most-worn signed URLs into a single Storage round-trip instead
  // of N parallel lookups. Empty list when data hasn't landed yet — the hook
  // returns a path → url map keyed on the requested paths.
  const mostWornPaths = React.useMemo(
    () => (data?.mostWorn ?? []).map((m) => m.imagePath).filter((p): p is string => Boolean(p)),
    [data?.mostWorn],
  );
  const { data: mostWornUrls } = useSignedUrls(mostWornPaths);

  const onRefresh = React.useCallback(() => {
    void refetch();
  }, [refetch]);

  // Currency formatter for the cost-per-wear quote. Falls back to the device
  // locale's default currency code when no garment carries a recorded one,
  // and to plain decimal formatting if the device doesn't recognise the code.
  const formatMoney = React.useCallback(
    (value: number, currency: string | null): string => {
      const code = currency ?? 'USD';
      try {
        return new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: code,
          maximumFractionDigits: 2,
        }).format(value);
      } catch {
        return value.toFixed(2);
      }
    },
    [],
  );

  // Three-column gauge row math: card_width = (screenWidth - 40 horizontal padding - 16 inter-card gap) / 3.
  // Each Gauge needs SVG 78 + horizontal padding 24 ≈ 102px to render without clipping.
  // Solving 102 ≤ (W - 56) / 3 gives W ≥ 362, so phones at 320 (SE) and 360 (common Android)
  // overflow. Below ≈380 we drop to a 2+1 stack: the third gauge spans the full row.
  const compactGauges = screenWidth < 380;

  const headerBlock = (
    <View style={s.header}>
      <Eyebrow style={{ marginBottom: 4 }}>{headerEyebrow}</Eyebrow>
      <PageTitle>{tr('insights.title')}</PageTitle>
    </View>
  );

  // Error state — pull-to-refresh stays available so a transient failure recovers
  // without the user needing to leave the screen.
  if (isError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: 8,
            paddingHorizontal: 20,
            paddingBottom: 130,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor={t.accent}
              colors={[t.accent]}
            />
          }>
          {headerBlock}
          <ErrorState onRetry={() => void refetch()} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Loading state — skeletons mirror the final layout so the transition is calm.
  if (isLoading || !data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{
            paddingTop: 8,
            paddingHorizontal: 20,
            paddingBottom: 130,
            gap: 18,
          }}
          showsVerticalScrollIndicator={false}>
          {headerBlock}
          <StatRowSkeleton count={2} />
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              flexWrap: compactGauges ? 'wrap' : 'nowrap',
            }}>
            <Skeleton radius={14} height={140} style={{ flex: 1 }} />
            <Skeleton radius={14} height={140} style={{ flex: 1 }} />
            <Skeleton
              radius={14}
              height={140}
              style={compactGauges ? { width: '100%' } : { flex: 1 }}
            />
          </View>
          <Skeleton radius={14} height={120} style={{ width: '100%' }} />
          <Skeleton radius={14} height={140} style={{ width: '100%' }} />
          <GarmentListSkeleton rows={3} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Empty state — no garments at all → push the user toward AddPiece.
  if (data.totalGarments === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: 8,
            paddingHorizontal: 20,
            paddingBottom: 130,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor={t.accent}
              colors={[t.accent]}
            />
          }>
          {headerBlock}
          <View style={s.emptyWrap}>
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 24,
                lineHeight: 28,
                fontWeight: '500',
                color: t.fg,
                letterSpacing: -0.24,
                textAlign: 'center',
              }}>
              {tr('insights.empty.title')}
            </Text>
            <Caption style={{ textAlign: 'center', marginTop: 8, maxWidth: 260 }}>
              {tr('insights.empty.body')}
            </Caption>
            <View style={{ marginTop: 18 }}>
              <Button label={tr('insights.empty.cta')} onPress={() => nav.navigate('AddPieceStep1')} />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: 8,
          paddingHorizontal: 20,
          paddingBottom: 130,
          gap: 18,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={t.accent}
            colors={[t.accent]}
          />
        }
        showsVerticalScrollIndicator={false}>

        {/* ============ HEADER ============ */}
        {headerBlock}

        {/* ============ STATS — 2 col ============ */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <StatBlock num={data.totalWears} label={tr('insights.stat.outfitsWorn')} style={{ flex: 1 }} />
          <StatBlock
            num={`${data.wardrobeUsagePct}%`}
            label={tr('insights.stat.wardrobeUsed')}
            style={{ flex: 1 }}
          />
        </View>

        {/* ============ GAUGES — 3 col on ≥380dp, 2+1 stack on narrower phones ============ */}
        {/* `visible={active}` re-runs the ring animation each time the tab becomes active.
            Without this, the mount-time animation runs once while Insights is hidden behind
            the default Today tab — by the time the user lands here, the rings are already
            at their target offset. */}
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            flexWrap: compactGauges ? 'wrap' : 'nowrap',
          }}>
          {data.gauges.map((g, i) => {
            const wrapStyle =
              compactGauges && i === data.gauges.length - 1
                ? { width: '100%' as const }
                : { flex: 1, minWidth: 0 };
            return (
              <View
                key={`${g.label}-${i}`}
                style={wrapStyle}
                accessible
                accessibilityLabel={`${g.label}: ${g.value}${g.unit ?? ''}. ${g.delta}`}>
                <Gauge
                  value={g.value}
                  max={g.max}
                  unit={g.unit}
                  label={g.label}
                  delta={g.delta}
                  deltaDir={g.deltaDir}
                  visible={active}
                />
              </View>
            );
          })}
        </View>

        {/* ============ PALETTE CARD ============ */}
        <Card>
          <View style={[s.sectionHead, { marginBottom: 12 }]}>
            <Eyebrow>{tr('insights.palette.title')}</Eyebrow>
            <Caption>{tr('insights.palette.caption')}</Caption>
          </View>
          <PaletteBar entries={data.palette} />
        </Card>

        {/* ============ WEAR FREQUENCY CARD ============ */}
        <Card>
          <View style={[s.sectionHead, { marginBottom: 12 }]}>
            <Eyebrow>{tr('insights.wearFrequency.title')}</Eyebrow>
            <Caption>{tr('insights.wearFrequency.caption')}</Caption>
          </View>
          {data.weeklyBars.length > 0 ? (
            <BarViz bars={data.weeklyBars} />
          ) : (
            <Caption>{tr('insights.wearFrequency.empty')}</Caption>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
            <Caption>{rangeStart}</Caption>
            <Caption>{rangeEnd}</Caption>
          </View>
        </Card>

        {/* ============ WARDROBE AGING (M22) ============ */}
        {/* The panel itself is presentation-only — subscription_required
            errors are intercepted above (sticky-ref → Paywall), so we
            forward `null` for that case to keep the section quiet while
            the paywall modal opens. All other errors render the panel's
            own subtle inline caption.

            Note: the panel's internal loading skeleton (isLoading + no
            result) is rarely visible because Insights gates the entire
            screen on `dashboard.isLoading` above and the screen-level
            skeletons render in its place. The aging skeleton only shows
            on a manual refetch where dashboard data is already cached
            but aging data isn't (e.g. cleared cache between sessions).
            Acceptable; kept as a fallback so the panel remains
            self-contained and renderable in isolation. */}
        <WardrobeAgingPanel
          result={aging.data ?? null}
          isLoading={aging.isLoading}
          error={agingSubscriptionLocked ? null : aging.error}
          onRowTap={onAgingRowTap}
        />

        {/* ============ MOST WORN LIST ============ */}
        {data.mostWorn.length > 0 ? (
          <View>
            <Eyebrow style={{ marginBottom: 10 }}>{tr('insights.mostWorn.title')}</Eyebrow>
            <View>
              {data.mostWorn.map((item, i) => (
                <MostWornRow
                  key={item.garmentId}
                  item={item}
                  imageUrl={(item.imagePath && mostWornUrls?.[item.imagePath]) || null}
                  showSeparator={i < data.mostWorn.length - 1}
                  onPress={() => nav.navigate('GarmentDetail', { id: item.garmentId })}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* ============ QUIET WIN — card hero quote ============ */}
        {data.avgCostPerWear !== null ? (
          <Card hero padding={18}>
            <Eyebrow style={{ marginBottom: 8 }}>{tr('insights.quietWin.title')}</Eyebrow>
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 19,
                lineHeight: 25,
                fontWeight: '500',
                color: t.fg,
                letterSpacing: -0.19,
              }}>
              {tr('insights.quietWin.prefix')}{' '}
              <Text style={{ color: t.accent }}>
                {formatMoney(data.avgCostPerWear, data.avgCostPerWearCurrency)}
              </Text>{' '}
              {tr('insights.quietWin.suffix')}
            </Text>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    paddingTop: 4,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  mostWornRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  mostWornThumb: {
    width: 44,
    height: 56,
    borderRadius: radii.lg - 3,
    overflow: 'hidden',
    flexShrink: 0,
    borderWidth: 1,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
});
