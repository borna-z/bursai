// Travel Capsule — Step 2 of 3. Pick the wardrobe pieces that must come.
// Mirrors design_handoff_burs_rn/source/extra-screens.jsx capsule must-haves panel.
//
// 3-col GarmentCard grid with checkmark overlay on selected items + sticky bottom
// continue bar. Backed by `useFlatGarments({ inLaundry: false })` — the real
// non-laundered wardrobe — so the user picks from pieces they actually own.
// Selected garment IDs are threaded into the next step via route params.

import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { IconBtn } from '../components/IconBtn';
import { GarmentCard, type GarmentCardData } from '../components/GarmentCard';
import { BackIcon, CheckIcon } from '../components/icons';
import { useFlatGarments } from '../hooks/useGarments';
import type { Garment, GarmentFilters } from '../types/garment';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Hoisted to module scope so the queryKey for `useFlatGarments` is stable across
// re-renders — same convention as WardrobeScreen. We only show non-laundered
// pieces because the user can't realistically pack what's currently dirty.
const WARDROBE_FILTERS: GarmentFilters = { inLaundry: false };

// Filter chips. Values match the canonical short-form categories the AI
// enrichment writes to `garments.category` ("Top", "Bottom", "Outer", "Shoes",
// "Dress"). 'All' is the no-filter pass-through. Compared case-insensitively
// to defend against any historical row that used a different cap convention.
const FILTERS = ['All', 'Top', 'Bottom', 'Shoes', 'Outer', 'Dress'] as const;
type FilterKey = (typeof FILTERS)[number];

export function TravelMustHavesScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [filter, setFilter] = React.useState<FilterKey>('All');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const { data: garments, isLoading } = useFlatGarments(WARDROBE_FILTERS);

  // Apply category chip after fetch — server returns the full list, we slice
  // client-side so chip switches don't refetch. Matches the WardrobeScreen
  // pattern (in-memory category narrowing post-pagination).
  const visible = React.useMemo<Garment[]>(() => {
    if (filter === 'All') return garments;
    const wanted = filter.toLowerCase();
    return garments.filter((g) => (g.category ?? '').trim().toLowerCase() === wanted);
  }, [garments, filter]);

  const toggle = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const header = (
    <View style={{ paddingHorizontal: 20, paddingBottom: 14, gap: 14 }}>
      <View style={s.headerRow}>
        <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 4 }}>Step 2 of 3</Eyebrow>
          <PageTitle>Must-haves</PageTitle>
        </View>
      </View>
      <Caption>Which pieces must come with you?</Caption>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {FILTERS.map((key) => (
          <Chip key={key} label={key} active={filter === key} onPress={() => setFilter(key)} />
        ))}
      </View>
      <Eyebrow>{selected.size} selected</Eyebrow>
    </View>
  );

  // Memoised renderTile — preserves FlatList row memoisation across parent re-renders.
  // Codex audit P2.2.
  const renderTile = React.useCallback(({ item }: { item: Garment }) => {
    const isSelected = selected.has(item.id);
    // GarmentCardData is a strict subset of Garment with the right photo/wear
    // fields, so a direct hand-off works — no fixture mapping needed.
    const cardData: GarmentCardData = item;
    return (
      <Pressable
        onPress={() => toggle(item.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected }}
        accessibilityLabel={item.title}
        style={({ pressed }) => [
          {
            flex: 1,
            transform: pressed ? [{ scale: 0.98 }] : [],
          },
        ]}>
        <View
          style={[
            s.tile,
            {
              borderColor: isSelected ? t.accent : t.border,
              borderWidth: isSelected ? 2 : 1,
              borderRadius: radii.lg,
              overflow: 'hidden',
            },
          ]}>
          <GarmentCard garment={cardData} />
          {isSelected ? (
            <View style={[s.checkBadge, { backgroundColor: t.accent }]}>
              <CheckIcon color={t.accentFg} size={14} />
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  }, [selected, toggle, t.accent, t.accentFg, t.border]);

  // First-run / empty wardrobe state. We don't ship fake fixtures any more, so
  // a user with zero non-laundered garments needs a real path forward — point
  // them at AddPieceStep1. We only show this once the fetch settles, so the
  // initial-load flash doesn't briefly look like an empty wardrobe.
  const showEmpty = !isLoading && garments.length === 0;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      {showEmpty ? (
        <View style={{ flex: 1 }}>
          {header}
          <View style={{ alignItems: 'center', paddingHorizontal: 32, paddingTop: 8, gap: 14 }}>
            <Eyebrow>Empty wardrobe</Eyebrow>
            <Caption style={{ textAlign: 'center', maxWidth: 260 }}>
              Add a few pieces to your wardrobe before building a travel capsule.
            </Caption>
            <Button
              label="Add a piece"
              variant="accent"
              onPress={() => nav.navigate('AddPieceStep1')}
            />
          </View>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(g) => g.id}
          numColumns={3}
          ListHeaderComponent={header}
          renderItem={renderTile}
          columnWrapperStyle={{ gap: 8, paddingHorizontal: 20 }}
          contentContainerStyle={{ gap: 8, paddingBottom: 130 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ============ STICKY CONTINUE BAR ============ */}
      {/* Hidden in the empty state — there's nothing to select, so the
          Continue affordance has no meaning. */}
      {showEmpty ? null : (
        <View style={[s.stickyBar, { backgroundColor: t.bg, borderTopColor: t.border }]}>
          <View style={{ flex: 1 }}>
            <Eyebrow>{selected.size} pieces selected</Eyebrow>
            <Caption style={{ marginTop: 2 }}>
              {selected.size === 0
                ? 'Pick at least one to continue'
                : selected.size < 5
                  ? 'Add a few more for variety'
                  : 'Looking good — ready to pack'}
            </Caption>
          </View>
          <Button
            label="Continue"
            variant="accent"
            disabled={selected.size === 0}
            // Thread the selection forward as garment IDs so the packing-list
            // step actually knows what the user picked — previously this Set
            // was lost when the user navigated away.
            onPress={() =>
              nav.navigate('TravelPackingList', { selectedIds: Array.from(selected) })
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 4 },
  tile: {
    position: 'relative',
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
