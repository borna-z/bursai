// Garment detail — opened from any garment card or list row.
// Layout (top→bottom): header (back · eyebrow + italic title · edit + more) · hero image
// (aspect 0.78, radius 18) with Studio badge top-left + wear count badge top-right · 3-tab strip
// (Info / Outfits / Similar) · tab body · sticky "Wear today" CTA at the bottom safe area.
//
// Source: design_handoff_burs_rn/source/extra-screens.jsx GarmentDetailScreen + handoff README
// "Garment detail". Tabs are local UI state — there's no route param for which tab is active.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { ListRow } from '../components/ListRow';
import { GarmentCard, type GarmentCardData } from '../components/GarmentCard';
import { BackIcon, EditIcon, MoreIcon } from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'GarmentDetail'>;

type GarmentFixture = {
  name: string;
  category: string;
  subcategory: string;
  hue: number;
  wearCount: number;
  fields: { label: string; value: string }[];
  tags: string[];
  outfits: GarmentCardData[];
  similar: GarmentCardData[];
};

// Keyed by the same `id` that Wardrobe / Search / Used / Unused / OutfitDetail emit. When the
// backend hook lands this gets replaced by `useGarment(id)` — the rest of the screen reads from
// `garment` either way. Codex P1 round 2: previously the screen ignored the route `id` and
// always rendered the wool overshirt regardless of which card was tapped.
const GARMENTS: Record<string, GarmentFixture> = {
  g1: {
    name: 'Cream tee', category: 'Tops', subcategory: 'Tee', hue: 32, wearCount: 31,
    fields: [
      { label: 'Category', value: 'Tops · Tee' },
      { label: 'Color', value: 'Cream' },
      { label: 'Material', value: 'Cotton' },
      { label: 'Fit', value: 'Regular' },
      { label: 'Season', value: 'Spring · Summer' },
      { label: 'Brand', value: 'Sunspel' },
      { label: 'Price', value: '€55' },
      { label: 'Cost per wear', value: '€1.77' },
      { label: 'Last worn', value: '2 days ago' },
    ],
    tags: ['Cream', 'Cotton', 'Light-weight', 'Daily', 'SS', 'Quiet luxe'],
    outfits: [{ id: 'o2', name: 'Sunday casual', sub: '3 pieces', hue: 200 }],
    similar: [
      { id: 'g6', name: 'Striped oxford', sub: 'Tops · Cotton',   hue: 200 },
      { id: 'g8', name: 'Cashmere knit',  sub: 'Tops · Cashmere', hue: 18 },
    ],
  },
  g2: {
    name: 'Navy blazer', category: 'Outerwear', subcategory: 'Blazer', hue: 215, wearCount: 3,
    fields: [
      { label: 'Category', value: 'Outerwear · Blazer' },
      { label: 'Color', value: 'Navy' },
      { label: 'Material', value: 'Wool' },
      { label: 'Fit', value: 'Tailored' },
      { label: 'Season', value: 'Autumn · Winter' },
      { label: 'Brand', value: 'Drake\'s' },
      { label: 'Price', value: '€680' },
      { label: 'Cost per wear', value: '€226' },
      { label: 'Last worn', value: '45 days ago' },
    ],
    tags: ['Navy', 'Wool', 'Tailored', 'Office', 'FW', 'Heritage'],
    outfits: [{ id: 'o3', name: 'Boardroom', sub: '5 pieces', hue: 215 }],
    similar: [
      { id: 'g5', name: 'Wool overshirt', sub: 'Outer · Wool',    hue: 32 },
    ],
  },
  g3: {
    name: 'Linen trouser', category: 'Bottoms', subcategory: 'Trouser', hue: 38, wearCount: 14,
    fields: [
      { label: 'Category', value: 'Bottoms · Trouser' },
      { label: 'Color', value: 'Cream' },
      { label: 'Material', value: 'Linen' },
      { label: 'Fit', value: 'Regular' },
      { label: 'Season', value: 'Spring · Summer' },
      { label: 'Brand', value: 'Folk' },
      { label: 'Price', value: '€140' },
      { label: 'Cost per wear', value: '€10' },
      { label: 'Last worn', value: '4 days ago' },
    ],
    tags: ['Cream', 'Linen', 'Mid-weight', 'Daily', 'SS', 'Quiet luxe'],
    outfits: [{ id: 'o1', name: 'Studio brunch', sub: '4 pieces', hue: 32 }],
    similar: [
      { id: 'g7', name: 'Black denim', sub: 'Bottoms · Denim', hue: 220 },
    ],
  },
  g4: {
    name: 'Leather loafer', category: 'Shoes', subcategory: 'Loafer', hue: 28, wearCount: 5,
    fields: [
      { label: 'Category', value: 'Shoes · Loafer' },
      { label: 'Color', value: 'Bone' },
      { label: 'Material', value: 'Leather' },
      { label: 'Fit', value: 'Regular' },
      { label: 'Season', value: 'Spring · Autumn' },
      { label: 'Brand', value: 'Crockett & Jones' },
      { label: 'Price', value: '€420' },
      { label: 'Cost per wear', value: '€84' },
      { label: 'Last worn', value: '3 days ago' },
    ],
    tags: ['Bone', 'Leather', 'Refined', '3-season', 'Quiet luxe'],
    outfits: [{ id: 'o1', name: 'Studio brunch', sub: '4 pieces', hue: 32 }],
    similar: [{ id: 'g9', name: 'Suede boot', sub: 'Shoes · Suede', hue: 18 }],
  },
  g5: {
    name: 'Wool overshirt', category: 'Outerwear', subcategory: 'Overshirt', hue: 32, wearCount: 23,
    fields: [
      { label: 'Category', value: 'Outerwear · Overshirt' },
      { label: 'Color', value: 'Beige' },
      { label: 'Material', value: 'Wool blend' },
      { label: 'Fit', value: 'Regular' },
      { label: 'Season', value: 'Spring · Autumn' },
      { label: 'Brand', value: 'Folk' },
      { label: 'Price', value: '€189' },
      { label: 'Cost per wear', value: '€8.20' },
      { label: 'Last worn', value: '18 days ago' },
    ],
    tags: ['Beige', 'Wool', 'Mid-weight', 'Workwear', '3-season', 'Quiet luxe'],
    outfits: [
      { id: 'o1', name: 'Studio brunch', sub: '4 pieces', hue: 32 },
      { id: 'o3', name: 'Boardroom',     sub: '4 pieces', hue: 215 },
    ],
    similar: [
      { id: 'g2', name: 'Navy blazer',   sub: 'Outer · Wool',    hue: 215 },
      { id: 'g8', name: 'Cashmere knit', sub: 'Tops · Cashmere', hue: 18 },
    ],
  },
  g6: {
    name: 'Striped oxford', category: 'Tops', subcategory: 'Shirt', hue: 200, wearCount: 9,
    fields: [
      { label: 'Category', value: 'Tops · Shirt' },
      { label: 'Color', value: 'White / Blue' },
      { label: 'Material', value: 'Cotton poplin' },
      { label: 'Fit', value: 'Regular' },
      { label: 'Season', value: 'Spring · Summer · Autumn' },
      { label: 'Brand', value: 'Drake\'s' },
      { label: 'Price', value: '€220' },
      { label: 'Cost per wear', value: '€24.40' },
      { label: 'Last worn', value: '1 day ago' },
    ],
    tags: ['Striped', 'Cotton', 'Mid-weight', 'Office', '3-season', 'Heritage'],
    outfits: [{ id: 'o3', name: 'Boardroom', sub: '5 pieces', hue: 220 }],
    similar: [{ id: 'g1', name: 'Cream tee', sub: 'Tops · Cotton', hue: 32 }],
  },
  g7: {
    name: 'Black denim', category: 'Bottoms', subcategory: 'Jean', hue: 220, wearCount: 11,
    fields: [
      { label: 'Category', value: 'Bottoms · Jean' },
      { label: 'Color', value: 'Black' },
      { label: 'Material', value: 'Denim' },
      { label: 'Fit', value: 'Slim' },
      { label: 'Season', value: 'Autumn · Winter' },
      { label: 'Brand', value: 'A.P.C.' },
      { label: 'Price', value: '€220' },
      { label: 'Cost per wear', value: '€20' },
      { label: 'Last worn', value: '9 days ago' },
    ],
    tags: ['Black', 'Denim', 'Slim', 'Daily', 'FW', 'Workwear'],
    outfits: [{ id: 'o2', name: 'Sunday casual', sub: '3 pieces', hue: 200 }],
    similar: [{ id: 'g3', name: 'Linen trouser', sub: 'Bottoms · Linen', hue: 38 }],
  },
  g8: {
    name: 'Cashmere knit', category: 'Tops', subcategory: 'Knit', hue: 18, wearCount: 7,
    fields: [
      { label: 'Category', value: 'Tops · Knit' },
      { label: 'Color', value: 'Rust' },
      { label: 'Material', value: 'Cashmere' },
      { label: 'Fit', value: 'Relaxed' },
      { label: 'Season', value: 'Autumn · Winter' },
      { label: 'Brand', value: 'Folk' },
      { label: 'Price', value: '€340' },
      { label: 'Cost per wear', value: '€48.50' },
      { label: 'Last worn', value: '21 days ago' },
    ],
    tags: ['Rust', 'Cashmere', 'Soft', 'FW', 'Quiet luxe'],
    outfits: [{ id: 'o4', name: 'Gallery night', sub: '4 pieces', hue: 280 }],
    similar: [{ id: 'g6', name: 'Striped oxford', sub: 'Tops · Cotton', hue: 200 }],
  },
  g9: {
    name: 'Suede boot', category: 'Shoes', subcategory: 'Chelsea', hue: 18, wearCount: 4,
    fields: [
      { label: 'Category', value: 'Shoes · Chelsea' },
      { label: 'Color', value: 'Brown' },
      { label: 'Material', value: 'Suede' },
      { label: 'Fit', value: 'Regular' },
      { label: 'Season', value: 'Autumn · Winter' },
      { label: 'Brand', value: 'Grenson' },
      { label: 'Price', value: '€395' },
      { label: 'Cost per wear', value: '€98.75' },
      { label: 'Last worn', value: '12 days ago' },
    ],
    tags: ['Brown', 'Suede', 'Refined', 'FW', 'Quiet luxe'],
    outfits: [{ id: 'o4', name: 'Gallery night', sub: '4 pieces', hue: 280 }],
    similar: [{ id: 'g4', name: 'Leather loafer', sub: 'Shoes · Suede', hue: 28 }],
  },
};

// Stable hue derived from id hash — same id always maps to the same colour, different ids are
// reliably distinct. djb2-ish 32-bit accumulator. Used by the unknown-id fallback so users can
// see at a glance that distinct routes are landing on distinct (placeholder) detail pages,
// rather than all collapsing onto the same wool-overshirt fixture (Codex P1 round 3 #2).
function hashToHue(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

// Render a labeled placeholder when the route id isn't in `GARMENTS`. Honest about being a
// placeholder, unique per id (via the hash above), so users don't think they're seeing the
// wrong garment's data. Replaced when the real `useGarment(id)` query lands — at which point
// it can render a true 404 / not-found state instead.
function makeUnknownGarment(id: string): GarmentFixture {
  return {
    name: `Item · ${id}`,
    category: 'Wardrobe',
    subcategory: 'Demo placeholder',
    hue: hashToHue(id),
    wearCount: 0,
    fields: [
      { label: 'ID', value: id },
      { label: 'Status', value: 'Demo placeholder' },
      { label: 'Note', value: 'Real data lands once the backend hook ships' },
    ],
    tags: ['Demo'],
    outfits: [],
    similar: [],
  };
}
const DEFAULT_GARMENT_ID = 'g5';

type Tab = 'info' | 'outfits' | 'similar';

export function GarmentDetailScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const route = useRoute<Route>();
  const id = route.params?.id;
  // Three-way resolution:
  //   1. id present + matches a fixture → render that fixture (the demoable wardrobe set g1–g9)
  //   2. id present + not in fixture map → synthesize a labeled placeholder via hash-to-hue,
  //      so users see a distinct (placeholder) detail per id rather than every unmapped id
  //      collapsing onto wool-overshirt. Real backend hook replaces this with a 404 state.
  //   3. id absent (e.g. HomeScreen Today's Look) → fall back to the canonical default fixture.
  // Codex P1 round 3 #2: silent fallback to default for unknown ids was misleading.
  const garment = id
    ? (GARMENTS[id] ?? makeUnknownGarment(id))
    : GARMENTS[DEFAULT_GARMENT_ID]!;

  const [tab, setTab] = React.useState<Tab>('info');

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.headerRow, { borderBottomColor: t.border }]}>
        <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Eyebrow>{garment.category}</Eyebrow>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 18,
              lineHeight: 22,
              fontWeight: '500',
              color: t.fg,
              letterSpacing: -0.18,
            }}>
            {garment.name}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <IconBtn
            ariaLabel="Edit piece"
            variant="ghost"
            onPress={() => nav.navigate('EditGarment', id ? { id } : undefined)}>
            <EditIcon color={t.fg} />
          </IconBtn>
          <IconBtn ariaLabel="More options" variant="ghost">
            <MoreIcon color={t.fg} />
          </IconBtn>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: insets.bottom + 96,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}>
        <View style={[s.hero, { borderColor: t.border }]}>
          <LinearGradient
            colors={[
              `hsl(${garment.hue}, 38%, 78%)`,
              `hsl(${(garment.hue + 30) % 360}, 30%, 62%)`,
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
          <View style={[s.heroBadge, { backgroundColor: t.accentSoft }]}>
            <Text style={[s.heroBadgeText, { color: t.accent }]}>Studio</Text>
          </View>
          <View style={[s.heroBadgeRight, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 14,
                color: t.fg,
                letterSpacing: -0.14,
              }}>
              {garment.wearCount}
            </Text>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 8.5,
                color: t.fg2,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                marginTop: 1,
              }}>
              Wears
            </Text>
          </View>
        </View>

        <View style={[s.tabStrip, { borderColor: t.border, backgroundColor: t.card }]}>
          {(['info', 'outfits', 'similar'] as Tab[]).map((id) => {
            const active = tab === id;
            const label = id === 'info' ? 'Info' : id === 'outfits' ? 'Outfits' : 'Similar';
            return (
              <Pressable
                key={id}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: active }}
                onPress={() => setTab(id)}
                style={[
                  s.tabBtn,
                  {
                    backgroundColor: active ? t.fg : 'transparent',
                  },
                ]}>
                <Text
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 12,
                    color: active ? t.bg : t.fg2,
                    letterSpacing: -0.1,
                  }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'info' ? (
          <View style={{ gap: 12 }}>
            <View style={[s.fieldGroup, { backgroundColor: t.card, borderColor: t.border }]}>
              {garment.fields.map((f, i) => (
                <ListRow
                  key={f.label}
                  title={f.label}
                  hideChevron
                  last={i === garment.fields.length - 1}
                  right={
                    <Text
                      style={{
                        fontFamily: fonts.uiMed,
                        fontSize: 13,
                        color: t.fg,
                        letterSpacing: -0.1,
                      }}>
                      {f.value}
                    </Text>
                  }
                  style={{ paddingHorizontal: 14 }}
                />
              ))}
            </View>
            <View>
              <Eyebrow style={{ marginBottom: 8 }}>Tags</Eyebrow>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {garment.tags.map((tag) => (
                  <View
                    key={tag}
                    style={[s.tagChip, { backgroundColor: t.bg2, borderColor: t.border }]}>
                    <Text style={[s.tagChipText, { color: t.fg2 }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {tab === 'outfits' ? (
          garment.outfits.length === 0 ? (
            <EmptyTab title="Not in any outfit yet" body="Build a look featuring this piece." />
          ) : (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {garment.outfits.map((g) => (
                <View key={g.id} style={{ width: '48%', flexGrow: 1 }}>
                  <GarmentCard
                    garment={g}
                    onPress={() => nav.navigate('OutfitDetail', { id: g.id })}
                  />
                </View>
              ))}
            </View>
          )
        ) : null}

        {tab === 'similar' ? (
          garment.similar.length === 0 ? (
            <EmptyTab title="No similar pieces" body="We didn't find anything matching this style yet." />
          ) : (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {garment.similar.map((g) => (
                <View key={g.id} style={{ width: '48%', flexGrow: 1 }}>
                  <GarmentCard
                    garment={g}
                    onPress={() => nav.navigate('GarmentDetail', { id: g.id })}
                  />
                </View>
              ))}
            </View>
          )
        ) : null}
      </ScrollView>

      <View
        style={[
          s.stickyBar,
          {
            backgroundColor: t.bg,
            borderTopColor: t.border,
            paddingBottom: insets.bottom + 12,
          },
        ]}>
        <Button label="Wear today" block onPress={() => nav.navigate('OutfitDetail', undefined)} />
      </View>
    </SafeAreaView>
  );
}

function EmptyTab({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32, gap: 6 }}>
      <PageTitle size={22}>{title}</PageTitle>
      <Caption style={{ textAlign: 'center', maxWidth: 240 }}>{body}</Caption>
    </View>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  hero: {
    width: '100%',
    aspectRatio: 0.78,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  heroBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  heroBadgeText: {
    fontFamily: fonts.uiSemi,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroBadgeRight: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  tabStrip: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  tabBtn: {
    flex: 1,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGroup: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  tagChipText: {
    fontFamily: fonts.uiSemi,
    fontSize: 11,
    letterSpacing: -0.05,
  },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
