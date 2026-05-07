// Travel Capsule — final step. Real packing list grouped by category,
// with a packed checkbox per row. Mirrors design_handoff_burs_rn/source/
// audit-screens.jsx TravelPackingScreen.
//
// M28 wired this screen to a saved capsule row. The previous version
// rendered hardcoded SECTIONS placeholders so the user always saw the
// same 14 fictional pieces no matter what trip they planned. Now the
// screen reads `capsuleId` from route params, looks up the row via
// useTravelCapsule(), groups the real packing_list by category, and
// persists per-item checkbox state into `result.packed_state` JSONB.
//
// Persistence is debounced (300ms) so a user mashing through 20 items
// doesn't fire 20 server writes — useUpdateTravelCapsulePackedState
// also runs optimistically so the checkbox flips instantly while the
// debounced write goes out behind it.

import React from 'react';
import { Alert, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { Card } from '../components/Card';
import { BackIcon, CheckIcon, ShareIcon } from '../components/icons';
import { t as tr } from '../lib/i18n';
import {
  useTravelCapsule,
  useUpdateTravelCapsulePackedState,
  TRAVEL_CAPSULE_SAVE_CONFLICT,
  type PackedState,
  type TravelCapsulePackingItem,
} from '../hooks/useTravelCapsules';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'TravelPackingList'>;

type Section = {
  title: string;
  data: TravelCapsulePackingItem[];
};

const PACKED_DEBOUNCE_MS = 300;

// Stable hash from a string into a hue (0-360). Used for the gradient
// thumbnail when no real image_path is wired in. Not security-relevant
// — just a deterministic placeholder colour.
function hashHue(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

function groupByCategory(items: TravelCapsulePackingItem[]): Section[] {
  const map = new Map<string, TravelCapsulePackingItem[]>();
  for (const item of items) {
    const cat = (item.category || 'other').trim();
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(item);
  }
  // Stable category ordering — match the canonical wardrobe outline so
  // the user reads the list in the same order as the wardrobe tab.
  const order = ['outer', 'top', 'bottom', 'dress', 'shoes', 'accessory', 'accessories'];
  const sortedKeys = Array.from(map.keys()).sort((a, b) => {
    const ai = order.indexOf(a.toLowerCase());
    const bi = order.indexOf(b.toLowerCase());
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  return sortedKeys.map((title) => ({
    // Capitalise the first letter for display ("Top" vs "top"). The
    // original category string survives in each item for accessibility.
    title: title.charAt(0).toUpperCase() + title.slice(1),
    data: map.get(title) ?? [],
  }));
}

function durationLabel(durationDays: number | null, startISO: string | null, endISO: string | null): string {
  if (typeof durationDays === 'number' && durationDays > 0) {
    if (durationDays === 1) return tr('travelPackingList.daysTemplate.one');
    return tr('travelPackingList.daysTemplate.other', { count: durationDays });
  }
  if (startISO && endISO && startISO === endISO) {
    return tr('travelPackingList.daysTemplate.zero');
  }
  return tr('travelPackingList.daysTemplate.other', { count: 0 });
}

export function TravelPackingListScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const capsuleId = route.params?.capsuleId;
  const { capsule, isLoading, refetch } = useTravelCapsule(capsuleId);
  const updatePackedState = useUpdateTravelCapsulePackedState();

  // Local mirror of packed_state — flips instantly on tap, the debounced
  // write below picks up the latest snapshot. Initialised from the row.
  const [packed, setPacked] = React.useState<PackedState>({});
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    if (!capsule) return;
    setPacked(capsule.packed_state);
    setHydrated(true);
  }, [capsule?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced server write — accumulate rapid toggles into one PATCH.
  // The ref dance keeps the timer cancellable across renders without
  // re-creating it on every state change.
  const writeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPackedRef = React.useRef<PackedState>({});
  // Track the last-saved snapshot so onError can revert local `packed`
  // back to the server-truth state. The cached row's packed_state is
  // restored by the mutation hook's optimistic-rollback; this ref
  // mirrors it for the screen-local mirror.
  const lastSavedPackedRef = React.useRef<PackedState>({});
  // Dedupe Alert prompts so a debounced retry storm doesn't fire 5 dialogs.
  const lastAlertKeyRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    latestPackedRef.current = packed;
  }, [packed]);
  // Hydrate the last-saved snapshot whenever the server-truth row lands
  // back in the cache (initial mount + after a successful invalidate).
  React.useEffect(() => {
    if (!capsule) return;
    lastSavedPackedRef.current = capsule.packed_state;
  }, [capsule?.id, capsule?.packed_state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build a stable mutate call so the unmount-flush effect below can
  // call it without retriggering on every render.
  const persistPacked = React.useCallback(
    (state: PackedState) => {
      if (!capsuleId) return;
      updatePackedState.mutate(
        { capsuleId, packedState: state },
        {
          onError: (err) => {
            // Revert local state — the cache rollback inside the
            // mutation hook handles `capsule.packed_state`, but the
            // screen mirror would otherwise stay stale (it's only
            // hydrated from the cached row on capsule.id change).
            setPacked(lastSavedPackedRef.current ?? {});
            const key = err.message || 'unknown';
            if (lastAlertKeyRef.current === key) return;
            lastAlertKeyRef.current = key;
            const isConflict = err.message === TRAVEL_CAPSULE_SAVE_CONFLICT;
            Alert.alert(
              tr(
                isConflict
                  ? 'travelPackingList.saveConflictTitle'
                  : 'travelPackingList.saveFailedTitle',
              ),
              tr(
                isConflict
                  ? 'travelPackingList.saveConflictBody'
                  : 'travelPackingList.saveFailedBody',
              ),
            );
          },
          onSuccess: () => {
            lastSavedPackedRef.current = state;
            lastAlertKeyRef.current = null;
          },
        },
      );
    },
    [capsuleId, updatePackedState],
  );

  // Mirror persistPacked into a ref so the unmount cleanup (which
  // doesn't list it in its deps to avoid re-running on every render)
  // calls the latest closure rather than a stale first-render copy.
  const persistPackedRef = React.useRef(persistPacked);
  React.useEffect(() => {
    persistPackedRef.current = persistPacked;
  }, [persistPacked]);

  // Flush any pending debounced write on unmount so a back-button tap
  // doesn't drop the user's last toggle. Fire-and-forget — the screen
  // is tearing down, awaiting the mutation would race the navigator.
  React.useEffect(() => {
    return () => {
      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current);
        writeTimerRef.current = null;
        // Snapshot the latest packed state and fire a write before the
        // screen tears down. React Query keeps the in-flight mutation
        // alive past unmount.
        persistPackedRef.current(latestPackedRef.current);
      }
    };
  }, []);

  const schedulePersist = React.useCallback(() => {
    if (!capsuleId) return;
    if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    writeTimerRef.current = setTimeout(() => {
      writeTimerRef.current = null;
      persistPacked(latestPackedRef.current);
    }, PACKED_DEBOUNCE_MS);
  }, [capsuleId, persistPacked]);

  const togglePacked = React.useCallback(
    (id: string) => {
      setPacked((prev) => {
        const next = { ...prev };
        if (next[id]) delete next[id];
        else next[id] = true;
        return next;
      });
      schedulePersist();
    },
    [schedulePersist],
  );

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleShare = React.useCallback(() => {
    Alert.alert(tr('travelPackingList.shareCta'), tr('travelPackingList.shareSoon'));
  }, []);

  const sections = React.useMemo<Section[]>(
    () => groupByCategory(capsule?.packing_list ?? []),
    [capsule?.packing_list],
  );

  const total = capsule?.packing_list.length ?? 0;
  const packedCount = React.useMemo(
    () => Object.values(packed).filter(Boolean).length,
    [packed],
  );
  const progress = total > 0 ? packedCount / total : 0;

  // No capsule id in scope — bounce the user back to the wizard.
  if (!capsuleId) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 14 }}>
          <Header onBack={() => nav.goBack()} onShare={handleShare} eyebrow="" title="" />
          <Caption>{tr('travelPackingList.empty.body')}</Caption>
          <Button label="Back to wizard" variant="accent" onPress={() => nav.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const showEmpty = hydrated && total === 0;

  const renderItem = ({ item, index, section }: { item: TravelCapsulePackingItem; index: number; section: Section }) => {
    const isPacked = !!packed[item.id];
    const isLast = index === section.data.length - 1;
    const hue = hashHue(item.id);
    return (
      <Pressable
        onPress={() => togglePacked(item.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isPacked }}
        accessibilityLabel={item.title}
        accessibilityHint={tr('travelPackingList.toggleAria')}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 10,
            paddingHorizontal: 24,
            borderBottomWidth: isLast ? 0 : 1,
            borderBottomColor: t.border,
            opacity: pressed ? 0.7 : isPacked ? 0.55 : 1,
          },
        ]}>
        {/* Decorative gradient — hidden from screen readers. */}
        <LinearGradient
          colors={[`hsl(${hue}, 38%, 78%)`, `hsl(${(hue + 30) % 360}, 30%, 62%)`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 44, height: 44, borderRadius: radii.md }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 13.5,
              color: t.fg,
              letterSpacing: -0.13,
              fontWeight: '600',
              textDecorationLine: isPacked ? 'line-through' : 'none',
            }}>
            {item.title || 'Untitled piece'}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 10.5,
              color: t.fg2,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
            }}>
            {item.category}
            {item.color_primary ? ` · ${item.color_primary}` : ''}
          </Text>
        </View>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            borderWidth: isPacked ? 0 : 1.5,
            borderColor: t.border2,
            backgroundColor: isPacked ? t.accent : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {isPacked ? <CheckIcon color={t.accentFg} size={14} /> : null}
        </View>
      </Pressable>
    );
  };

  const renderSectionHeader = ({ section }: { section: Section }) => {
    const sectionPacked = section.data.filter((d) => packed[d.id]).length;
    return (
      <View style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Eyebrow>
            {section.title} · {section.data.length}
          </Eyebrow>
          <Caption>
            {sectionPacked}/{section.data.length}
          </Caption>
        </View>
      </View>
    );
  };

  const eyebrow = capsule
    ? tr('travelPackingList.eyebrowTemplate', {
        destination: capsule.destination,
        duration: durationLabel(capsule.duration_days, capsule.start_date, capsule.end_date),
      })
    : '';

  const ListHeader = (
    <View style={{ paddingHorizontal: 20, paddingTop: 4, gap: 14 }}>
      <Header
        onBack={() => nav.goBack()}
        onShare={handleShare}
        eyebrow={eyebrow}
        title="Your capsule"
      />

      {/* Progress card */}
      <Card padding={16}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Eyebrow>Packing progress</Eyebrow>
          <Text
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 16,
              color: t.fg,
              letterSpacing: -0.16,
            }}>
            <Text style={{ color: t.accent }}>{packedCount}</Text>
            <Text style={{ color: t.fg3 }}> / {total}</Text>
          </Text>
        </View>
        <View
          style={{
            marginTop: 12,
            height: 6,
            borderRadius: 3,
            backgroundColor: t.bg2,
            overflow: 'hidden',
          }}>
          <View
            style={{
              width: `${progress * 100}%`,
              height: '100%',
              backgroundColor: t.accent,
            }}
          />
        </View>
        <Caption style={{ marginTop: 8 }}>
          {total === 0
            ? ''
            : packedCount === total
              ? tr('travelPackingList.allPacked')
              : total - packedCount === 1
                ? tr('travelPackingList.itemsLeftOne')
                : tr('travelPackingList.itemsLeftTemplate', { count: total - packedCount })}
        </Caption>
      </Card>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      {showEmpty ? (
        <View style={{ flex: 1 }}>
          {ListHeader}
          <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 8 }}>
            <Eyebrow>{tr('travelPackingList.empty.title')}</Eyebrow>
            <Caption>{tr('travelPackingList.empty.body')}</Caption>
          </View>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={ListHeader}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 130 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || isLoading}
              onRefresh={onRefresh}
              tintColor={t.accent}
              colors={[t.accent]}
            />
          }
          style={{ flex: 1 }}
        />
      )}

      {/* Sticky share bar */}
      <View style={[s.stickyBar, { backgroundColor: t.bg, borderTopColor: t.border }]}>
        <Button
          label={tr('travelPackingList.shareCta')}
          variant="accent"
          block
          leadingIcon={<ShareIcon color={t.accentFg} size={14} />}
          onPress={handleShare}
          style={{ flex: 1 }}
        />
      </View>
    </SafeAreaView>
  );
}

function Header({
  onBack,
  onShare,
  eyebrow,
  title,
}: {
  onBack: () => void;
  onShare: () => void;
  eyebrow: string;
  title: string;
}) {
  const t = useTokens();
  return (
    <View style={s.headerRow}>
      <IconBtn ariaLabel="Back" onPress={onBack} variant="ghost">
        <BackIcon color={t.fg} />
      </IconBtn>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Eyebrow style={{ marginBottom: 4 }}>{eyebrow}</Eyebrow> : null}
        {title ? <PageTitle>{title}</PageTitle> : null}
      </View>
      <IconBtn ariaLabel={tr('travelPackingList.shareCta')} onPress={onShare}>
        <ShareIcon color={t.fg} />
      </IconBtn>
    </View>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 4 },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
