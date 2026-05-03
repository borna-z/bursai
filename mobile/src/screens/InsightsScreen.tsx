// Insights — pixel-faithful port of design_handoff_burs_rn/source/screens.jsx InsightsScreen.
// Sections: header (eyebrow + title) · 2-col stats · 3-col gauges · palette card ·
// wear-frequency card · most-worn list · cost-per-wear quote (card-hero).
//
// All time-dependent strings derive from `new Date()` at render so the UI doesn't drift
// (header eyebrow + the wear-chart's 30-day window labels). The palette + bar values + most-worn
// list are placeholder data — real data wires up once Insights is fed by the existing web hooks.
//
// BottomNav lives in MainTabsScreen, NOT here — that's the parent tab container's job.
// Per HARD RULE: SafeAreaView wraps the screen. We restrict edges to ['top'] so the floating
// BottomNav (absolute-positioned in MainTabsScreen) keeps its own bottom-inset spacing
// without a double-pad.

import React from 'react';
import { RefreshControl, ScrollView, Text, useWindowDimensions, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Card } from '../components/Card';
import { StatBlock } from '../components/StatBlock';
import { Gauge } from '../components/Gauge';
import { PaletteBar, type PaletteEntry } from '../components/PaletteBar';
import { BarViz } from '../components/BarViz';
import { Skeleton, StatRowSkeleton } from '../components/skeletons';
import { ErrorState } from '../components/ErrorState';
import { useMockRefresh } from '../hooks/useMockRefresh';

// "Last 30 days" — header eyebrow. Constant string today, but kept in this module so
// the call site reads as data, not a literal. Future: derive from a date range setting.
function buildHeaderEyebrow(): string {
  return 'Last 30 days';
}

// Returns localized "Mar 28" / "28 mars" / "3月28日" for the wear-chart range labels —
// short month + day-of-month, formatted in the device locale. `daysAgo` is subtracted
// from `today` via setDate so DST transitions don't skip a day.
//
// Passing `undefined` to toLocaleDateString uses the runtime's default locale (the device
// locale on RN+Hermes); we then format `month` and `day` together in one call so the locale's
// natural ordering wins (e.g. "28 mars" in fr, "3月28日" in ja). Codex P2 on PR #702 — the
// previous "en-US" hardcode forced English on every device.
function formatRangeDate(today: Date, daysAgo: number): string {
  const d = new Date(today);
  d.setDate(today.getDate() - daysAgo);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Placeholder palette — represents the user's actual wardrobe color share, ordered by share desc.
// Hex values are real-color data, not token-derivable. Bypasses the "tokens only" rule by design
// (see PaletteBar.tsx for the same note).
const PLACEHOLDER_PALETTE: PaletteEntry[] = [
  { name: 'Cream',    hex: '#EDE3D2', pct: 28 },
  { name: 'Charcoal', hex: '#2A2622', pct: 22 },
  { name: 'Camel',    hex: '#B98E5A', pct: 16 },
  { name: 'Olive',    hex: '#6B6B3F', pct: 12 },
  { name: 'Slate',    hex: '#7A8089', pct: 10 },
  { name: 'Rust',     hex: '#A85432', pct:  7 },
  { name: 'Other',    hex: '#C9C0AE', pct:  5 },
];

const WEAR_BARS = [40, 65, 30, 80, 55, 72, 90, 48, 60, 35, 70, 55];

const MOST_WORN: { title: string; wears: string }[] = [
  { title: 'Cream linen trouser', wears: '11 wears' },
  { title: 'Wool overshirt',      wears: '9 wears'  },
  { title: 'White oxford',        wears: '7 wears'  },
];

// `active` reflects whether this tab is currently shown — MainTabsScreen keeps every tab
// mounted but hides inactive ones with `display: 'none'`, so the parent must tell us when
// we're actually visible. Defaults to true so standalone usage (tests / future routes) works.
export function InsightsScreen({ active = true }: { active?: boolean } = {}) {
  const t = useTokens();
  const { width: screenWidth } = useWindowDimensions();
  const now = new Date();
  const headerEyebrow = buildHeaderEyebrow();
  const rangeStart = formatRangeDate(now, 29); // 30 days inclusive of today
  const rangeEnd   = formatRangeDate(now, 0);

  const { refreshing, loading, error, onRefresh, retry } = useMockRefresh(1000);

  // Three-column gauge row math: card_width = (screenWidth - 40 horizontal padding - 16 inter-card gap) / 3.
  // Each Gauge needs SVG 78 + horizontal padding 24 ≈ 102px to render without clipping.
  // Solving 102 ≤ (W - 56) / 3 gives W ≥ 362, so phones at 320 (SE) and 360 (common Android)
  // overflow. Below ≈380 we drop to a 2+1 stack: the third gauge spans the full row.
  // Codex P2 on PR #702.
  const compactGauges = screenWidth < 380;

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingTop: 8, paddingHorizontal: 20, paddingBottom: 130 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />
          }>
          <View style={s.header}>
            <Eyebrow style={{ marginBottom: 4 }}>{headerEyebrow}</Eyebrow>
            <PageTitle>Insights</PageTitle>
          </View>
          <ErrorState onRetry={retry} />
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />
        }
        showsVerticalScrollIndicator={false}>

        {/* ============ HEADER ============ */}
        <View style={s.header}>
          <Eyebrow style={{ marginBottom: 4 }}>{headerEyebrow}</Eyebrow>
          <PageTitle>Insights</PageTitle>
        </View>

        {/* ============ STATS — 2 col ============ */}
        {loading ? (
          <StatRowSkeleton count={2} />
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatBlock num={23}    label="Outfits worn"   style={{ flex: 1 }} />
            <StatBlock num="68%"   label="Wardrobe used"  style={{ flex: 1 }} />
          </View>
        )}

        {/* ============ GAUGES — 3 col on ≥380dp, 2+1 stack on narrower phones ============ */}
        {/* `visible={active}` re-runs the ring animation each time the tab becomes active.
            Without this, the mount-time animation runs once while Insights is hidden behind
            the default Today tab — by the time the user lands here, the rings are already
            at their target offset. */}
        {loading ? (
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              flexWrap: compactGauges ? 'wrap' : 'nowrap',
            }}>
            <Skeleton radius={14} height={140} style={{ flex: 1 }} />
            <Skeleton radius={14} height={140} style={{ flex: 1 }} />
            <Skeleton radius={14} height={140} style={compactGauges ? { width: '100%' } : { flex: 1 }} />
          </View>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              flexWrap: compactGauges ? 'wrap' : 'nowrap',
            }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Gauge value={82} max={100} unit="%" label="Cost / wear efficiency" delta="18%"           deltaDir="up"   visible={active} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Gauge value={47} max={100} unit="%" label="Outfit variety"          delta="6 new combos" deltaDir="up"   visible={active} />
            </View>
            <View style={compactGauges ? { width: '100%' } : { flex: 1, minWidth: 0 }}>
              <Gauge value={91} max={100} unit="%" label="Care & laundry on time"  delta="2 overdue"    deltaDir="down" visible={active} />
            </View>
          </View>
        )}

        {/* ============ PALETTE CARD ============ */}
        <Card>
          <View style={[s.sectionHead, { marginBottom: 12 }]}>
            <Eyebrow>Your palette</Eyebrow>
            <Caption>Share of wears</Caption>
          </View>
          <PaletteBar data={PLACEHOLDER_PALETTE} />
        </Card>

        {/* ============ WEAR FREQUENCY CARD ============ */}
        <Card>
          <View style={[s.sectionHead, { marginBottom: 12 }]}>
            <Eyebrow>Wear frequency</Eyebrow>
            <Caption>Top categories</Caption>
          </View>
          <BarViz values={WEAR_BARS} threshold={65} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
            <Caption>{rangeStart}</Caption>
            <Caption>{rangeEnd}</Caption>
          </View>
        </Card>

        {/* ============ MOST WORN LIST ============ */}
        <View>
          <Eyebrow style={{ marginBottom: 10 }}>Most worn</Eyebrow>
          <View>
            {MOST_WORN.map((item, i) => (
              <View
                key={item.title}
                style={[
                  s.mostWornRow,
                  {
                    borderBottomColor: t.border,
                    borderBottomWidth: i < MOST_WORN.length - 1 ? 1 : 0,
                  },
                ]}>
                <View
                  style={[
                    s.mostWornThumb,
                    { backgroundColor: t.bg2, borderColor: t.border },
                  ]}>
                  {/* Placeholder striped thumb — replaced by garment image once wired. */}
                  <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]}>
                    <View
                      style={[
                        StyleSheet.absoluteFillObject,
                        {
                          // Diagonal stripe approximation — RN can't do
                          // `repeating-linear-gradient`, but two stacked gradients cover the look.
                          backgroundColor: t.card2,
                          opacity: 0.55,
                        },
                      ]}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
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
                  <Text
                    style={{
                      fontFamily: fonts.ui,
                      fontSize: 11,
                      color: t.fg2,
                      marginTop: 2,
                    }}>
                    {item.wears}
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: fonts.displayMedium,
                    fontStyle: 'italic',
                    fontSize: 18,
                    fontWeight: '500',
                    color: t.accent,
                    fontVariant: ['tabular-nums'],
                  }}>
                  {i + 1}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ============ QUIET WIN — card hero quote ============ */}
        <Card hero padding={18}>
          <Eyebrow style={{ marginBottom: 8 }}>Quiet win</Eyebrow>
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
            Your cost-per-wear dropped 18% — the cashmere is finally pulling its weight.
          </Text>
        </Card>
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
    height: 44,
    borderRadius: radii.lg - 3, // 11 — matches CSS borderRadius: 11.
    overflow: 'hidden',
    flexShrink: 0,
    borderWidth: 1,
  },
});
