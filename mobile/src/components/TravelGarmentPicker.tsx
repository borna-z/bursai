// TravelGarmentPicker — reusable garment-picker grid for the travel capsule
// wizard's "Pick must-haves" step. Mirrors web's
// `src/components/travel/TravelStep2.tsx` must-haves grid (an inline panel
// inside Step 2) rather than a dedicated panel — the mobile flow promotes
// the picker to its own step in the wizard, so we stand it up as its own
// reusable component.
//
// Behavior:
//   - Toggle a garment by tapping its tile. Selection capped at `max`
//     (default 8) — matches web's `MAX_MUST_HAVES`. When the cap is reached,
//     unselected tiles render at reduced opacity and are non-interactive.
//   - Slot-based filter row at the top — All / Tops / Bottoms / Outerwear /
//     Shoes / Accessories. Filters by the canonical lower-case category enum
//     in `garments.category` plus a small alias map for the historical
//     short-form values written by the AI enrichment pipeline (matches
//     WardrobeScreen's CATEGORY_ALIAS treatment).
//   - Search by garment title substring (case-insensitive).
//   - Empty wardrobe → renders an empty-state Card with a CTA back to the
//     AddPiece flow.
//
// Pattern compliance: useTokens() throughout (no hardcoded hex), Eyebrow /
// Card / Chip / Button / GarmentCard primitives only, all copy via t().

import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from './Eyebrow';
import { Caption } from './Caption';
import { Button } from './Button';
import { Chip } from './Chip';
import { Card } from './Card';
import { GarmentCard, type GarmentCardData } from './GarmentCard';
import { hapticLight } from '../lib/haptics';
import { t as tr } from '../lib/i18n';
import type { Garment } from '../types/garment';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Slot filter buckets — each maps onto one or more canonical `garments.category`
// strings. Lower-case compare; the canonical enum is short-form ("Top",
// "Bottom", "Outer") historically authored by the AI enrichment pipeline,
// so we accept either short-form or long-form labels (matches
// WardrobeScreen's CATEGORY_ALIAS treatment).
type SlotFilter = 'all' | 'tops' | 'bottoms' | 'outerwear' | 'shoes' | 'accessories';

const SLOT_MATCHERS: Record<Exclude<SlotFilter, 'all'>, readonly string[]> = {
  tops: ['top', 'tops', 'shirt', 'blouse', 'tee', 't-shirt'],
  bottoms: ['bottom', 'bottoms', 'pants', 'trousers', 'skirt', 'shorts', 'jeans'],
  outerwear: ['outer', 'outerwear', 'jacket', 'coat'],
  shoes: ['shoes', 'shoe', 'footwear'],
  accessories: ['accessory', 'accessories', 'bag', 'belt', 'hat', 'scarf', 'jewelry'],
};

function matchesSlot(garment: Garment, slot: SlotFilter): boolean {
  if (slot === 'all') return true;
  const cat = (garment.category ?? '').trim().toLowerCase();
  if (!cat) return false;
  return SLOT_MATCHERS[slot].some((m) => cat === m || cat.includes(m));
}

const FILTER_ORDER: readonly SlotFilter[] = [
  'all',
  'tops',
  'bottoms',
  'outerwear',
  'shoes',
  'accessories',
];

const FILTER_KEY: Record<SlotFilter, string> = {
  all: 'travelGarmentPicker.filter.all',
  tops: 'travelGarmentPicker.filter.tops',
  bottoms: 'travelGarmentPicker.filter.bottoms',
  outerwear: 'travelGarmentPicker.filter.outerwear',
  shoes: 'travelGarmentPicker.filter.shoes',
  accessories: 'travelGarmentPicker.filter.accessories',
};

export interface TravelGarmentPickerProps {
  /** All wardrobe garments — the screen passes `useFlatGarments().data` so the
   *  picker doesn't need to refetch. */
  garments: Garment[];
  /** Currently-selected garment ids. */
  selectedIds: string[];
  /** Tap handler — emits the next selection (additive or removed). */
  onChange: (ids: string[]) => void;
  /** Cap on the selection count. Defaults to 8 to match web's `MAX_MUST_HAVES`. */
  max?: number;
  /** Optional outer style — lets the screen control margins / padding. */
  style?: StyleProp<ViewStyle>;
  /** True while the wardrobe query is still loading. Empty-state only renders
   *  when loading is done AND the wardrobe is genuinely empty. */
  loading?: boolean;
}

export function TravelGarmentPicker({
  garments,
  selectedIds,
  onChange,
  max = 8,
  style,
  loading = false,
}: TravelGarmentPickerProps) {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [slot, setSlot] = React.useState<SlotFilter>('all');
  const [search, setSearch] = React.useState('');

  // Defensive — `garments` should never be non-array, but the upstream hook
  // can briefly emit undefined during refetch transitions.
  const safeGarments = React.useMemo<Garment[]>(
    () => (Array.isArray(garments) ? garments : []),
    [garments],
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return safeGarments.filter((g) => {
      if (!matchesSlot(g, slot)) return false;
      if (q.length === 0) return true;
      const title = (g.title ?? '').toLowerCase();
      return title.includes(q);
    });
  }, [safeGarments, slot, search]);

  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const limitReached = selectedIds.length >= max;

  const toggle = React.useCallback(
    (id: string) => {
      hapticLight();
      if (selectedSet.has(id)) {
        onChange(selectedIds.filter((x) => x !== id));
        return;
      }
      if (selectedIds.length >= max) return;
      onChange([...selectedIds, id]);
    },
    [onChange, selectedIds, selectedSet, max],
  );

  const handleAddPiece = React.useCallback(() => {
    nav.navigate('AddPieceStep1');
  }, [nav]);

  // Empty wardrobe — show the empty-state card. We only treat the wardrobe
  // as "empty" once the query has actually settled, otherwise a brief
  // loading flash on first mount renders the wrong copy.
  if (!loading && safeGarments.length === 0) {
    return (
      <View style={style}>
        <Card padding={16}>
          <View style={{ gap: 6 }}>
            <Eyebrow>{tr('travelGarmentPicker.empty.title')}</Eyebrow>
            <Caption>{tr('travelGarmentPicker.empty.body')}</Caption>
          </View>
          <View style={{ marginTop: 14 }}>
            <Button
              label={tr('travelGarmentPicker.empty.cta')}
              variant="accent"
              onPress={handleAddPiece}
            />
          </View>
        </Card>
      </View>
    );
  }

  // Selection-count chip copy. Pluralise so "1 / 8 selected" reads cleanly.
  const selectedTemplate =
    selectedIds.length === 1
      ? tr('travelGarmentPicker.selectedTemplate.one', { max })
      : tr('travelGarmentPicker.selectedTemplate.other', {
          count: selectedIds.length,
          max,
        });

  return (
    <View style={style}>
      {/* Search input */}
      <View
        style={[
          s.searchRow,
          { backgroundColor: t.bg2, borderColor: t.border },
        ]}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={tr('travelGarmentPicker.searchPlaceholder')}
          placeholderTextColor={t.fg3}
          style={{
            flex: 1,
            color: t.fg,
            fontFamily: fonts.uiMed,
            fontSize: 14,
            padding: 0,
          }}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      {/* Slot filter row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingVertical: 8 }}
        keyboardShouldPersistTaps="handled">
        {FILTER_ORDER.map((opt) => (
          <Chip
            key={opt}
            label={tr(FILTER_KEY[opt])}
            active={slot === opt}
            onPress={() => {
              hapticLight();
              setSlot(opt);
            }}
          />
        ))}
      </ScrollView>

      {/* Tile grid — 3 columns to match GarmentCard's wardrobe density.
          Wrapped in a height-bounded inner ScrollView (G3 sub-issue 1)
          so the grid no longer escapes the outer screen ScrollView and
          becomes untappable below the fold. Mirrors web's `max-h-[320px]`.
          `nestedScrollEnabled` keeps the inner scroll responsive on
          Android even when nested inside the outer ScrollView. */}
      {filtered.length === 0 ? (
        <View style={{ marginTop: 12 }}>
          <Card padding={14}>
            <Caption>{tr('travelGarmentPicker.empty.body')}</Caption>
          </Card>
        </View>
      ) : (
        <ScrollView
          style={s.gridScroll}
          contentContainerStyle={s.grid}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator>
          {filtered.map((garment) => {
            const isSelected = selectedSet.has(garment.id);
            const dimmed = !isSelected && limitReached;
            const data: GarmentCardData = {
              id: garment.id,
              title: garment.title ?? '',
              category: garment.category ?? null,
              color_primary: garment.color_primary ?? null,
              wear_count: garment.wear_count ?? null,
              in_laundry: garment.in_laundry ?? null,
              rendered_image_path: garment.rendered_image_path ?? null,
              original_image_path: garment.original_image_path ?? null,
              created_at: garment.created_at ?? null,
            };
            return (
              <Pressable
                key={garment.id}
                onPress={() => toggle(garment.id)}
                disabled={dimmed}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected, disabled: dimmed }}
                accessibilityLabel={garment.title ?? ''}
                style={[
                  s.tileWrap,
                  {
                    opacity: dimmed ? 0.35 : 1,
                  },
                ]}>
                <View
                  style={[
                    s.tileBorder,
                    {
                      borderColor: isSelected ? t.accent : 'transparent',
                      backgroundColor: isSelected ? t.accentSoft : 'transparent',
                    },
                  ]}>
                  <GarmentCard garment={data} />
                </View>
                {isSelected ? (
                  <View
                    style={[
                      s.checkBadge,
                      { backgroundColor: t.accent, borderColor: t.bg },
                    ]}>
                    <Text
                      style={{
                        fontFamily: fonts.uiBold,
                        color: t.accentFg,
                        fontSize: 11,
                      }}>
                      {'✓'}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Selection-count chip pinned at the bottom of the picker block. */}
      <View
        style={[
          s.countChip,
          {
            backgroundColor: t.accentSoft,
            borderColor: t.accent,
          },
        ]}>
        <Text
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 11,
            letterSpacing: 0.4,
            color: t.accent,
          }}>
          {selectedTemplate}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  searchRow: {
    height: 44,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gridScroll: {
    // Height-bound the picker grid so it doesn't escape the outer screen
    // ScrollView. Without this the tiles below the fold are untappable
    // because the parent ScrollView captures the gesture and there's
    // nowhere for the user to scroll within the picker block. Mirrors
    // web's `max-h-[320px]` constraint on the must-haves grid panel.
    // G3 sub-issue 1 (audit-confirmed: TravelGarmentPicker untappable).
    maxHeight: 320,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  // 3-column layout — each tile occupies ~33% width with a small gutter.
  // Matching the wardrobe grid density so the picker visually rhymes.
  tileWrap: {
    width: '33.33%',
    paddingHorizontal: 4,
    paddingVertical: 4,
    position: 'relative',
  },
  tileBorder: {
    borderRadius: radii.lg + 2,
    borderWidth: 2,
    padding: 2,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countChip: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
