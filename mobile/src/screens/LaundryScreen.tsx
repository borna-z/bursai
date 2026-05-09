// Laundry queue — list of garments with `in_laundry = true`. Reachable from Wardrobe's
// "In laundry" smart tile and the "Laundry" tab chip.
//
// W2 wires real Supabase data via useFlatGarments({inLaundry:true}) + useMarkLaundry.
// "Mark clean" flips the row's in_laundry to false; "Mark all clean" iterates.
// Pull-to-refresh calls refetch().

import React from 'react';
import { Alert, FlatList, Image, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { BackIcon, CheckIcon } from '../components/icons';
import { ErrorState } from '../components/ErrorState';
import { GarmentListSkeleton } from '../components/skeletons';
import { hapticLight, hapticSuccess } from '../lib/haptics';
import { useFlatGarments, useMarkLaundry } from '../hooks/useGarments';
import { useSignedUrl } from '../hooks/useSignedUrl';
import type { Garment, GarmentFilters } from '../types/garment';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Module-scope filter constant — keeps the queryKey identity stable across
// re-renders so React Query doesn't deep-equal-compare the filter on every
// FlatList scroll event.
const LAUNDRY_FILTERS: GarmentFilters = { inLaundry: true };

function hueFromId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function LaundryRow({
  garment,
  onMarkClean,
  pending,
}: {
  garment: Garment;
  onMarkClean: () => void;
  pending: boolean;
}) {
  const t = useTokens();
  const path = garment.rendered_image_path ?? garment.original_image_path ?? null;
  const { data: url } = useSignedUrl(path);
  const hue = hueFromId(garment.id);
  const subtitle = [garment.category, garment.material].filter(Boolean).join(' · ');

  return (
    <View style={s.row}>
      <View style={[s.thumb, { borderColor: t.border, overflow: 'hidden' }]}>
        <LinearGradient
          colors={[`hsl(${hue}, 22%, 78%)`, `hsl(${(hue + 30) % 360}, 22%, 70%)`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 13.5,
            fontWeight: '600',
            color: t.fg,
            letterSpacing: -0.13,
          }}>
          {garment.title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              marginTop: 2,
              fontFamily: fonts.uiMed,
              fontSize: 11.5,
              letterSpacing: 0.4,
              color: t.fg2,
            }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Button
        label={pending ? '…' : 'Mark clean'}
        variant="outline"
        size="sm"
        onPress={onMarkClean}
        disabled={pending}
      />
    </View>
  );
}

export function LaundryScreen() {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();

  const {
    data: items,
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = useFlatGarments(LAUNDRY_FILTERS);
  const markLaundry = useMarkLaundry();

  // Track per-id pending state so the disabled "Mark clean" button only
  // disables the row that's mutating, not every row in the list.
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set());

  const onRefresh = React.useCallback(() => void refetch(), [refetch]);

  const markClean = (id: string) => {
    hapticSuccess();
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    markLaundry.mutate(
      { id, inLaundry: false },
      {
        onSettled: () => {
          setPendingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        },
        onError: (err) => {
          Alert.alert(
            'Could not mark clean',
            err instanceof Error ? err.message : 'Try again.',
          );
        },
      },
    );
  };

  // Single-flight latch for the mark-all-clean confirm flow. Without this,
  // a double-tap on the bottom CTA opens two confirm Alerts, and confirming
  // both fires the bulk mutation twice — every per-row mutation runs in
  // parallel, the second pass's mutate calls happen while the first batch
  // is still in flight, doubling network load and potentially causing
  // duplicate-marking telemetry. The latch flips synchronously inside the
  // pressable's onPress and clears in `onSettled` of the last mutation
  // (or on Cancel). (F-026 in N9 polish bundle.)
  const markAllInFlightRef = React.useRef(false);

  const markAllClean = () => {
    if (items.length === 0) return;
    if (markAllInFlightRef.current) return;
    markAllInFlightRef.current = true;
    Alert.alert('Mark all clean?', `${items.length} pieces will be moved out of laundry.`, [
      {
        text: 'Cancel',
        style: 'cancel',
        // Clear the latch on cancel so a follow-up tap reopens the confirm.
        onPress: () => {
          markAllInFlightRef.current = false;
        },
      },
      {
        text: 'Mark all clean',
        onPress: () => {
          hapticSuccess();
          // Update pendingIds in a single batch so each row's per-item button
          // disables for the duration of the bulk operation. Without this, a
          // double-tap on "Mark all clean" before invalidation lands fires 2N
          // mutations.
          const ids = items.map((g) => g.id);
          const total = ids.length;
          if (total === 0) {
            // Items emptied between tap and confirm (e.g. background
            // refetch). Clear the latch so a follow-up tap still works.
            markAllInFlightRef.current = false;
            return;
          }
          setPendingIds((prev) => {
            const next = new Set(prev);
            for (const id of ids) next.add(id);
            return next;
          });

          // Count remaining + failures so we can surface a single summary
          // Alert at the end. Without this, partial failures (3 of 10 rows
          // hit a 5xx) were invisible to the user — they'd see 7 disappear
          // and 3 remain with no explanation. (Audit UX#3.)
          let remaining = total;
          let failures = 0;
          for (const id of ids) {
            markLaundry.mutate(
              { id, inLaundry: false },
              {
                onError: () => {
                  failures += 1;
                },
                onSettled: () => {
                  setPendingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                  });
                  remaining -= 1;
                  if (remaining === 0) {
                    // Last mutation just settled — clear the bulk latch
                    // so a follow-up "Mark all clean" press opens the
                    // confirm again. Must happen regardless of failures.
                    markAllInFlightRef.current = false;
                    if (failures > 0) {
                      Alert.alert(
                        'Some items failed',
                        `${failures} of ${total} couldn't be marked clean. Pull down to refresh and try the failed rows again.`,
                      );
                    }
                  }
                },
              },
            );
          }
        },
      },
    ]);
  };

  const header = (
    <View style={s.header}>
      <IconBtn ariaLabel="Back" onPress={() => { hapticLight(); nav.goBack(); }}>
        <BackIcon color={t.fg} />
      </IconBtn>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Eyebrow>In the wash</Eyebrow>
        <PageTitle style={{ marginTop: 4 }}>Laundry</PageTitle>
      </View>
      <View
        style={[
          s.countBadge,
          { backgroundColor: items.length > 0 ? t.accent : 'transparent', borderColor: t.border },
        ]}>
        <Text
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 12,
            color: items.length > 0 ? t.accentFg : t.fg2,
            fontVariant: ['tabular-nums'],
          }}>
          {items.length}
        </Text>
      </View>
    </View>
  );

  if (isError) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        {header}
        <ErrorState onRetry={() => void refetch()} />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        {header}
        <View style={{ paddingTop: 8 }}>
          <GarmentListSkeleton rows={5} />
        </View>
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        {header}
        <View style={s.emptyShell}>
          <View style={[s.emptyCircle, { backgroundColor: t.accentSoft, borderColor: t.border }]}>
            <CheckIcon size={40} color={t.accent} />
          </View>
          <PageTitle style={{ marginTop: 24, textAlign: 'center' }}>All clean</PageTitle>
          <Text
            style={{
              marginTop: 8,
              fontFamily: fonts.ui,
              fontSize: 13,
              lineHeight: 19.5,
              color: t.fg2,
              textAlign: 'center',
            }}>
            No garments in laundry.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      {header}
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: insets.bottom + 96,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={t.accent}
            colors={[t.accent]}
          />
        }
        ItemSeparatorComponent={() => (
          <View style={{ height: 1, backgroundColor: t.border, opacity: 0.6 }} />
        )}
        renderItem={({ item }) => (
          <LaundryRow
            garment={item}
            onMarkClean={() => markClean(item.id)}
            pending={pendingIds.has(item.id)}
          />
        )}
      />
      <View
        style={[
          s.actionBar,
          {
            paddingBottom: insets.bottom + 16,
            backgroundColor: t.bg,
            borderTopColor: t.border,
          },
        ]}>
        <Button label="Mark all clean" onPress={markAllClean} block />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  countBadge: {
    minWidth: 36,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyShell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyCircle: {
    width: 96,
    height: 96,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  thumb: {
    width: 52,
    height: 68,
    borderRadius: radii.md,
    borderWidth: 1,
    flexShrink: 0,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
