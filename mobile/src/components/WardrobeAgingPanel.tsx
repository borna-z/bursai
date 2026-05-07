// WardrobeAgingPanel — three-row preview of the wardrobe_aging buckets.
// Composed onto InsightsScreen below the wear-frequency card.
//
// Pure presentation: the consuming screen owns subscription/paywall
// routing (sticky-ref pattern). This component renders exactly four
// states — loading, error, empty (zero garments anywhere), and ready —
// from the props it's handed. No data fetching, no navigation, no
// side-effects. The screen wires `onRowTap` to a route push.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from './Eyebrow';
import { PageTitle } from './PageTitle';
import { Caption } from './Caption';
import { ChevronIcon } from './icons';
import { Skeleton } from './Skeleton';
import { t as tr } from '../lib/i18n';
import type {
  WardrobeAgingBucketId,
  WardrobeAgingResult,
} from '../hooks/useWardrobeAging';

interface RowDisplay {
  id: WardrobeAgingBucketId;
  label: string;
  count: number;
  caption: string;
  disabled: boolean;
}

function bucketLabelKey(id: WardrobeAgingBucketId): string {
  if (id === 'aged') return 'wardrobeAging.bucket.aged';
  if (id === 'unworn') return 'wardrobeAging.bucket.unworn';
  return 'wardrobeAging.bucket.retire';
}

interface PanelProps {
  result: WardrobeAgingResult | null;
  isLoading: boolean;
  error: Error | null;
  onRowTap: (bucketId: WardrobeAgingBucketId) => void;
}

export function WardrobeAgingPanel({
  result,
  isLoading,
  error,
  onRowTap,
}: PanelProps) {
  const t = useTokens();

  const header = (
    <View style={s.header}>
      <Eyebrow>{tr('wardrobeAging.eyebrow')}</Eyebrow>
      <PageTitle size={22}>{tr('wardrobeAging.title')}</PageTitle>
    </View>
  );

  // Loading — three skeleton rows that match the final layout shape
  // (label · count badge · chevron column). Header stays solid so the
  // section doesn't look like it's still resolving.
  // Skeleton row dimensions intentionally match the populated row so the
  // loading→ready transition doesn't shift any pixels: label height 13.5,
  // caption height 11.5, badge minWidth 36 + paddingVertical 4 → 23px tall.
  if (isLoading && !result) {
    return (
      <View>
        {header}
        <View style={[s.list, { backgroundColor: t.card, borderColor: t.border }]}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                s.row,
                {
                  borderBottomColor: t.border,
                  borderBottomWidth: i < 2 ? 1 : 0,
                },
              ]}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Skeleton radius={4} height={13.5} style={{ width: '55%' }} />
                <Skeleton radius={4} height={11.5} style={{ width: '80%' }} />
              </View>
              <Skeleton radius={999} height={23} style={{ width: 36 }} />
              <View style={{ paddingLeft: 4, width: 20 }} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Error — subtle inline caption, no destructive UI. Pull-to-refresh
  // on the host screen recovers; we don't surface a retry button here
  // because the panel is one section in a larger scroll surface.
  if (error) {
    return (
      <View>
        {header}
        <View style={[s.errorBox, { backgroundColor: t.card, borderColor: t.border }]}>
          <Caption>{tr('wardrobeAging.error.network')}</Caption>
        </View>
      </View>
    );
  }

  if (!result) return null;

  const totalGarments = result.buckets.reduce((sum, b) => sum + b.count, 0);

  // Empty — every bucket sits at zero. Wardrobe is in great shape.
  if (totalGarments === 0) {
    return (
      <View>
        {header}
        <View style={[s.emptyBox, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 19,
              lineHeight: 24,
              fontWeight: '500',
              color: t.fg,
              letterSpacing: -0.19,
            }}>
            {tr('wardrobeAging.empty.title')}
          </Text>
          <Caption style={{ marginTop: 6 }}>{tr('wardrobeAging.empty.body')}</Caption>
        </View>
      </View>
    );
  }

  // Ready — render every bucket. Empty buckets stay visible (count 0
  // with a soft caption) so the layout is stable across re-fetches.
  const rows: RowDisplay[] = result.buckets.map((bucket) => ({
    id: bucket.id,
    label: tr(bucketLabelKey(bucket.id)),
    count: bucket.count,
    caption:
      bucket.count === 0
        ? tr('wardrobeAging.empty.body')
        : bucket.rationale ?? tr('wardrobeAging.openHint'),
    disabled: bucket.count === 0,
  }));

  return (
    <View>
      {header}
      <View style={[s.list, { backgroundColor: t.card, borderColor: t.border }]}>
        {rows.map((row, i) => {
          const isLast = i === rows.length - 1;
          return (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              accessibilityLabel={`${row.count} ${row.label}`}
              accessibilityHint={tr('wardrobeAging.openHint')}
              accessibilityState={{ disabled: row.disabled }}
              disabled={row.disabled}
              onPress={() => onRowTap(row.id)}
              style={({ pressed }) => [
                s.row,
                {
                  borderBottomColor: t.border,
                  borderBottomWidth: isLast ? 0 : 1,
                  opacity: row.disabled ? 0.5 : pressed ? 0.7 : 1,
                },
              ]}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 13.5,
                    fontWeight: '600',
                    color: t.fg,
                    letterSpacing: -0.135,
                  }}>
                  {row.label}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: fonts.ui,
                    fontSize: 11.5,
                    color: t.fg2,
                    letterSpacing: -0.05,
                  }}>
                  {row.caption}
                </Text>
              </View>
              <View
                // Inner badge has no own accessibilityLabel — the parent
                // Pressable already announces "{label}, {count}" so an
                // additional generic "garments in bucket" announcement
                // would just clutter VoiceOver. The badge is decorative
                // duplicate visual information at this level.
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[
                  s.countBadge,
                  {
                    backgroundColor: row.count > 0 ? t.accentSoft : t.bg2,
                  },
                ]}>
                <Text
                  style={{
                    fontFamily: fonts.displayMedium,
                    fontStyle: 'italic',
                    fontSize: 15,
                    fontWeight: '500',
                    color: row.count > 0 ? t.accent : t.fg3,
                    letterSpacing: -0.15,
                  }}>
                  {row.count}
                </Text>
              </View>
              <View style={{ paddingLeft: 4 }}>
                <ChevronIcon color={row.disabled ? t.fg3 : t.fg2} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    marginBottom: 10,
    gap: 4,
  },
  list: {
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  countBadge: {
    minWidth: 36,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 16,
  },
  emptyBox: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 18,
    alignItems: 'flex-start',
  },
});
