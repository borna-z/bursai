// Travel Capsule — per-day outfits view. Mirrors web's
// `src/components/travel/TravelResultsView.tsx` Outfits tab (lines
// 223-287): groups `capsule.outfits[]` by `.day`, renders a Day header
// (Day N + date + weather summary if available) followed by a stack of
// OutfitCard components — one per outfit — composed from the actual
// wardrobe garments referenced in `outfit.items`.
//
// G3 sub-issue 6. Reachable from TravelPackingListScreen via an "Outfits"
// header tab so the user can flip between the category-grouped checklist
// and the day-by-day style breakdown.
//
// Hydration:
//   - `outfit.items` is an array of garment ids (verified at
//     `mobile/src/hooks/useTravelCapsules.ts` parseOutfits — each entry
//     is filtered to `typeof === 'string'`).
//   - Garment objects come from `useFlatGarments()`, which is already
//     cached after the user has opened the wizard once. Missing ids
//     fall through to the OutfitCard's gradient placeholder so a stale
//     reference doesn't break the row.

import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { IconBtn } from '../components/IconBtn';
import { Card } from '../components/Card';
import { OutfitCard, type OutfitCardGarment } from '../components/OutfitCard';
import { BackIcon } from '../components/icons';
import { t as tr } from '../lib/i18n';
import {
  useTravelCapsule,
  type TravelCapsuleOutfit,
} from '../hooks/useTravelCapsules';
import { useFlatGarments } from '../hooks/useGarments';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'TravelOutfits'>;

// Group outfits by day, preserving insertion order within each day so
// the AI's outfit_index sort survives the bucket. Days arrive in 1..N
// order from the edge function's loop (see
// `supabase/functions/travel_capsule/index.ts:600`), but we sort defensively
// so a future shape change doesn't shuffle Day 5 before Day 2.
function groupByDay(outfits: TravelCapsuleOutfit[]): { day: number; items: TravelCapsuleOutfit[] }[] {
  const map = new Map<number, TravelCapsuleOutfit[]>();
  for (const outfit of outfits) {
    const list = map.get(outfit.day) ?? [];
    list.push(outfit);
    map.set(outfit.day, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, items]) => ({ day, items }));
}

// Best-effort short-form date label. Mirrors TravelCapsuleScreen's
// shortDateLabel helper but inlined here so this screen doesn't import
// across screen boundaries.
function shortDateLabel(iso: string | undefined): string | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function TravelOutfitsScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const capsuleId = route.params?.capsuleId;
  const { capsule, isLoading } = useTravelCapsule(capsuleId);
  // Wardrobe map for hydrating outfit items by id. The query is normally
  // already populated from the user's prior visit; if not, the loading
  // branch below gates on `capsule` resolution so we don't render an
  // outfit row with no garments.
  const { data: allGarments = [], isLoading: garmentsLoading } = useFlatGarments();

  const garmentById = React.useMemo(() => {
    const map = new Map<string, OutfitCardGarment>();
    for (const g of allGarments) {
      if (!g?.id) continue;
      map.set(g.id, {
        id: g.id,
        rendered_image_path: g.rendered_image_path ?? null,
        original_image_path: g.original_image_path ?? null,
      });
    }
    return map;
  }, [allGarments]);

  const grouped = React.useMemo(
    () => (capsule ? groupByDay(capsule.outfits) : []),
    [capsule],
  );

  // Direct deep-link entry without a capsuleId — bounce back to the
  // wizard so the navigator types stay honest.
  if (!capsuleId) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <Header onBack={() => nav.goBack()} />
        <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 12 }}>
          <Caption>{tr('travelMustHaves.empty.body')}</Caption>
        </View>
      </SafeAreaView>
    );
  }

  const showLoading = isLoading || (!capsule && garmentsLoading);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 18 }}
        showsVerticalScrollIndicator={false}>
        <Header onBack={() => nav.goBack()} />

        <View style={{ gap: 6 }}>
          <Eyebrow>{capsule?.destination ?? ''}</Eyebrow>
          <PageTitle>{tr('travel.outfits.tab')}</PageTitle>
        </View>

        {showLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={t.accent} />
          </View>
        ) : grouped.length === 0 ? (
          <Card padding={16}>
            <View style={{ gap: 6 }}>
              <Eyebrow>{tr('travelMustHaves.empty.title')}</Eyebrow>
              <Caption>{tr('travelMustHaves.empty.body')}</Caption>
            </View>
          </Card>
        ) : (
          grouped.map(({ day, items }) => (
            <View key={`day-${day}`} style={{ gap: 10 }}>
              <DayHeader day={day} dateISO={items[0]?.date} />
              <View style={{ gap: 12 }}>
                {items.map((outfit, idx) => {
                  const garments = outfit.items
                    .map((id) => garmentById.get(id))
                    .filter((g): g is OutfitCardGarment => g !== undefined);
                  const name =
                    outfit.note && outfit.note.trim().length > 0
                      ? outfit.note
                      : tr('travel.outfits.dayLabel', { day });
                  // Capitalize occasion for the eyebrow line — the edge
                  // function emits lower-case strings ("work", "dinner")
                  // and we want sentence-case in UI.
                  const occasion = outfit.occasion
                    ? outfit.occasion.charAt(0).toUpperCase() + outfit.occasion.slice(1)
                    : '';
                  return (
                    <OutfitCard
                      key={`day-${day}-outfit-${idx}`}
                      name={name}
                      sub={occasion}
                      garments={garments}
                    />
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  const t = useTokens();
  return (
    <View style={s.headerRow}>
      <IconBtn ariaLabel="Back" onPress={onBack} variant="ghost">
        <BackIcon color={t.fg} />
      </IconBtn>
    </View>
  );
}

function DayHeader({ day, dateISO }: { day: number; dateISO?: string }) {
  const t = useTokens();
  const dateLabel = shortDateLabel(dateISO);
  return (
    <View style={{ gap: 2 }}>
      <Text
        style={{
          fontFamily: fonts.displayMedium,
          fontStyle: 'italic',
          fontSize: 22,
          color: t.fg,
          letterSpacing: -0.2,
        }}>
        {tr('travel.outfits.dayLabel', { day })}
      </Text>
      {dateLabel ? <Caption>{dateLabel}</Caption> : null}
    </View>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingTop: 4,
  },
});
