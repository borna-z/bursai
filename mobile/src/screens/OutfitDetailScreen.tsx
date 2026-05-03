// Outfit detail — opened from OutfitsScreen, HomeScreen Today's Look, or any inline outfit card.
// Sections (top→bottom): header (back · eyebrow · italic title · share + more) · 2x2 garment thumb
// grid · meta chips row · primary actions row (Wear today / Restyle / Save) · feedback section
// (5-star rating + notes input) · pieces horizontal scroll. Sticky header is via SafeAreaView;
// the body uses a KeyboardAvoidingView so the notes input doesn't get clipped on iOS.
//
// Mirrors design_handoff_burs_rn/source/extra-screens.jsx OutfitDetailScreen + the README "Outfit
// detail" section. Data is a fixture; route param `id` is parsed and passed to a future hook.

import React from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { BackIcon, MoreIcon, ShareIcon, StarIcon } from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'OutfitDetail'>;

type OutfitFixture = {
  name: string;
  kicker: string;
  occasion: string;
  formality: string;
  wearCount: number;
  hues: [number, number, number, number];
  pieces: { id: string; name: string; sub: string; hue: number }[];
};

// Outfit fixtures keyed by the `id` that `OutfitsScreen.OUTFITS` emits, plus a default for
// callers that navigate without an id (HomeScreen Today's Look). Each piece references a
// canonical wardrobe id (`g1`–`g9`) so tapping a piece routes to the correct GarmentDetail
// fixture — Codex P1 round 4: previously pieces used opaque `p1`–`p24` ids that had no
// matching record in GarmentDetailScreen.GARMENTS, sending every tap to the unknown-id
// placeholder. Names + subs match WardrobeScreen.GARMENTS verbatim so cross-screen previews
// stay consistent.
const OUTFITS: Record<string, OutfitFixture> = {
  o1: {
    name: 'Studio brunch', kicker: "Today's look", occasion: 'Brunch', formality: 'Smart casual', wearCount: 12,
    hues: [32, 38, 200, 28],
    pieces: [
      { id: 'g5', name: 'Wool overshirt', sub: 'Outer · Wool',    hue: 32 },
      { id: 'g1', name: 'Cream tee',      sub: 'Tops · Cotton',   hue: 32 },
      { id: 'g3', name: 'Linen trouser',  sub: 'Bottoms · Linen', hue: 38 },
      { id: 'g4', name: 'Leather loafer', sub: 'Shoes · Suede',   hue: 28 },
    ],
  },
  o2: {
    name: 'Sunday casual', kicker: 'Saved look', occasion: 'Casual', formality: 'Casual', wearCount: 8,
    hues: [200, 220, 28, 45],
    pieces: [
      { id: 'g1', name: 'Cream tee',      sub: 'Tops · Cotton',   hue: 32 },
      { id: 'g7', name: 'Black denim',    sub: 'Bottoms · Denim', hue: 220 },
      { id: 'g4', name: 'Leather loafer', sub: 'Shoes · Suede',   hue: 28 },
    ],
  },
  o3: {
    name: 'Boardroom', kicker: 'Saved look', occasion: 'Office', formality: 'Business', wearCount: 4,
    hues: [215, 28, 200, 18],
    pieces: [
      { id: 'g2', name: 'Navy blazer',    sub: 'Outer · Wool',    hue: 215 },
      { id: 'g6', name: 'Striped oxford', sub: 'Tops · Cotton',   hue: 200 },
      { id: 'g3', name: 'Linen trouser',  sub: 'Bottoms · Linen', hue: 38 },
      { id: 'g4', name: 'Leather loafer', sub: 'Shoes · Suede',   hue: 28 },
    ],
  },
  o4: {
    name: 'Gallery night', kicker: 'Saved look', occasion: 'Evening', formality: 'Smart', wearCount: 6,
    hues: [18, 220, 18, 215],
    pieces: [
      { id: 'g8', name: 'Cashmere knit',  sub: 'Tops · Cashmere', hue: 18 },
      { id: 'g7', name: 'Black denim',    sub: 'Bottoms · Denim', hue: 220 },
      { id: 'g9', name: 'Suede boot',     sub: 'Shoes · Suede',   hue: 18 },
      { id: 'g2', name: 'Navy blazer',    sub: 'Outer · Wool',    hue: 215 },
    ],
  },
  o5: {
    name: 'Weekend run', kicker: 'Saved look', occasion: 'Active', formality: 'Casual', wearCount: 0,
    hues: [32, 220, 28, 32],
    pieces: [
      { id: 'g1', name: 'Cream tee',      sub: 'Tops · Cotton',   hue: 32 },
      { id: 'g7', name: 'Black denim',    sub: 'Bottoms · Denim', hue: 220 },
      { id: 'g4', name: 'Leather loafer', sub: 'Shoes · Suede',   hue: 28 },
      { id: 'g5', name: 'Wool overshirt', sub: 'Outer · Wool',    hue: 32 },
    ],
  },
  o6: {
    name: 'Date — soft', kicker: 'Saved look', occasion: 'Date', formality: 'Smart', wearCount: 2,
    hues: [18, 220, 28, 32],
    pieces: [
      { id: 'g8', name: 'Cashmere knit',  sub: 'Tops · Cashmere', hue: 18 },
      { id: 'g7', name: 'Black denim',    sub: 'Bottoms · Denim', hue: 220 },
      { id: 'g4', name: 'Leather loafer', sub: 'Shoes · Suede',   hue: 28 },
      { id: 'g5', name: 'Wool overshirt', sub: 'Outer · Wool',    hue: 32 },
    ],
  },
};
const DEFAULT_OUTFIT_ID = 'o1';

export function OutfitDetailScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const id = route.params?.id;
  // Look up by route id; fall back to default fixture so callers that navigate without an id
  // (e.g. HomeScreen "Today's Look" tile) still get a stable demo. When the backend hook lands
  // this becomes `const { data: outfit } = useOutfit(id ?? defaultId);`.
  const outfit = (id && OUTFITS[id]) || OUTFITS[DEFAULT_OUTFIT_ID]!;

  const [rating, setRating] = React.useState(0);
  const [notes, setNotes] = React.useState('');
  const [saved, setSaved] = React.useState(false);
  // "Wear today" toggle. Mirrors the `saved` toggle shape (outline → accent + label flip) so
  // visual press feedback maps to a real state change. When the wear-log mutation lands this
  // becomes a `useLogWear()` mutation hook with an optimistic `worn` flag. Codex P2 round 8.
  const [worn, setWorn] = React.useState(false);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <View style={[s.headerRow, { borderBottomColor: t.border }]}>
          <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Eyebrow>Outfit</Eyebrow>
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
              {outfit.name}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <IconBtn
              ariaLabel="Share outfit"
              variant="ghost"
              onPress={() => nav.navigate('ShareOutfit', undefined)}>
              <ShareIcon color={t.fg} />
            </IconBtn>
            <IconBtn
              ariaLabel="More options"
              variant="ghost"
              onPress={() =>
                Alert.alert('More', 'Outfit actions coming soon.')
              }>
              <MoreIcon color={t.fg} />
            </IconBtn>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 18 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View>
            <Eyebrow style={{ marginBottom: 4 }}>{outfit.kicker}</Eyebrow>
            <PageTitle>{outfit.name}</PageTitle>
          </View>

          <View style={s.thumbGrid}>
            {outfit.hues.map((h, i) => (
              <View key={i} style={[s.thumbCell, { borderColor: t.border }]}>
                <LinearGradient
                  colors={[`hsl(${h}, 38%, 78%)`, `hsl(${(h + 30) % 360}, 30%, 62%)`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ flex: 1 }}
                />
                <View style={[s.thumbLabel, { backgroundColor: t.card, borderColor: t.border }]}>
                  <Text style={[s.thumbLabelText, { color: t.fg2 }]}>
                    {outfit.pieces[i]?.sub.split(' · ')[0]?.toUpperCase() ?? ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <MetaChip label={outfit.occasion} />
            <MetaChip label={outfit.formality} />
            <MetaChip label={`${outfit.wearCount} wears`} />
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              label={worn ? 'Worn today' : 'Wear today'}
              variant={worn ? 'accent' : 'primary'}
              block
              style={{ flex: 1 }}
              onPress={() => setWorn((v) => !v)}
            />
            <Button label="Restyle" variant="outline" onPress={() => nav.navigate('OutfitGenerate')} />
            <Button
              label={saved ? 'Saved' : 'Save'}
              variant={saved ? 'accent' : 'outline'}
              onPress={() => setSaved((v) => !v)}
            />
          </View>

          <View>
            <Eyebrow style={{ marginBottom: 10 }}>How was it?</Eyebrow>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${n} of 5`}
                  onPress={() => setRating(n === rating ? 0 : n)}
                  hitSlop={6}>
                  <StarIcon size={28} color={n <= rating ? t.accent : t.fg3} active={n <= rating} />
                </Pressable>
              ))}
            </View>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add a note — what worked, what didn't"
              placeholderTextColor={t.fg3}
              multiline
              style={[
                s.notesInput,
                {
                  color: t.fg,
                  backgroundColor: t.card,
                  borderColor: t.border,
                },
              ]}
            />
          </View>

          <View>
            <View style={s.sectionHead}>
              <Eyebrow>Garments in this outfit</Eyebrow>
              <Text style={{ color: t.fg2, fontFamily: fonts.uiMed, fontSize: 11 }}>
                {outfit.pieces.length}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
              {outfit.pieces.map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.name}, ${p.sub}`}
                  // `push` not `navigate` — drill-down across detail routes. In a flow like
                  // GarmentDetail → OutfitDetail → tap piece, `navigate('GarmentDetail', …)`
                  // would collapse onto the existing GarmentDetail entry earlier in the stack,
                  // mutating its params (so the previously-viewed garment's rating/scroll/tab
                  // state would now belong to a different garment) and shortening the back
                  // stack. `push` always adds a fresh entry. Codex P1 round 9, mirrors round 7
                  // similar-items fix.
                  onPress={() => nav.push('GarmentDetail', { id: p.id })}
                  style={({ pressed }) => [
                    s.pieceCard,
                    {
                      backgroundColor: t.card,
                      borderColor: t.border,
                      transform: pressed ? [{ scale: 0.97 }] : [],
                    },
                  ]}>
                  <LinearGradient
                    colors={[`hsl(${p.hue}, 38%, 78%)`, `hsl(${(p.hue + 30) % 360}, 30%, 62%)`]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.pieceCardThumb}
                  />
                  <View style={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: fonts.uiSemi,
                        fontSize: 12.5,
                        fontWeight: '600',
                        color: t.fg,
                        letterSpacing: -0.13,
                      }}>
                      {p.name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: fonts.uiSemi,
                        fontSize: 9.5,
                        color: t.fg2,
                        letterSpacing: 1.4,
                        textTransform: 'uppercase',
                        marginTop: 2,
                      }}>
                      {p.sub}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MetaChip({ label }: { label: string }) {
  const t = useTokens();
  return (
    <View style={[s.metaChip, { backgroundColor: t.bg2, borderColor: t.border }]}>
      <Text
        style={{
          fontFamily: fonts.uiSemi,
          fontSize: 10,
          color: t.fg2,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
        }}>
        {label}
      </Text>
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
  thumbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thumbCell: {
    width: '48%',
    flexGrow: 1,
    aspectRatio: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  thumbLabelText: {
    fontFamily: fonts.uiSemi,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  metaChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  notesInput: {
    minHeight: 88,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    fontFamily: fonts.ui,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  pieceCard: {
    width: 140,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pieceCardThumb: {
    width: '100%',
    height: 100,
  },
});
