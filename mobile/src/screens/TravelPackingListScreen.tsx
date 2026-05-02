// Travel Capsule — final step. Generated packing list grouped by category, with a packed
// checkbox per row. Mirrors design_handoff_burs_rn/source/audit-screens.jsx TravelPackingScreen.
//
// SectionList for category sections (each section is a Card with hairline-separated rows).
// "Add from wardrobe" CTA at the foot of each section + "Share packing list" sticky-style
// footer button.

import React from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
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
import { IconBtn } from '../components/IconBtn';
import { Card } from '../components/Card';
import { BackIcon, CheckIcon, ShareIcon, PlusIcon } from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type PackingItem = {
  id: string;
  name: string;
  category: string;
  hue: number;
};

type Section = {
  title: string;
  data: PackingItem[];
};

const SECTIONS: Section[] = [
  {
    title: 'Outerwear',
    data: [
      { id: 'p1', name: 'Wool overshirt', category: 'Outer · Beige', hue: 38 },
      { id: 'p2', name: 'Sand chore', category: 'Outer · Sand', hue: 45 },
    ],
  },
  {
    title: 'Tops',
    data: [
      { id: 'p3', name: 'Cream tee', category: 'Top · Cream', hue: 32 },
      { id: 'p4', name: 'Linen henley', category: 'Top · Off-white', hue: 38 },
      { id: 'p5', name: 'Black tee', category: 'Top · Black', hue: 28 },
      { id: 'p6', name: 'Striped knit', category: 'Top · Navy', hue: 200 },
    ],
  },
  {
    title: 'Bottoms',
    data: [
      { id: 'p7', name: 'Linen trouser', category: 'Bottom · Cream', hue: 38 },
      { id: 'p8', name: 'Black denim', category: 'Bottom · Black', hue: 28 },
      { id: 'p9', name: 'Walk shorts', category: 'Bottom · Khaki', hue: 32 },
    ],
  },
  {
    title: 'Shoes',
    data: [
      { id: 'p10', name: 'Bone sneaker', category: 'Shoe · Bone', hue: 32 },
      { id: 'p11', name: 'Chocolate loafer', category: 'Shoe · Brown', hue: 18 },
    ],
  },
  {
    title: 'Accessories',
    data: [
      { id: 'p12', name: 'Brown leather belt', category: 'Accessory · Brown', hue: 28 },
      { id: 'p13', name: 'Wool socks ×2', category: 'Accessory · Charcoal', hue: 220 },
      { id: 'p14', name: 'Sunglasses', category: 'Accessory · Tortoise', hue: 28 },
    ],
  },
];

const TOTAL = SECTIONS.reduce((acc, s) => acc + s.data.length, 0);

export function TravelPackingListScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [packed, setPacked] = React.useState<Set<string>>(new Set());

  // Codex audit P3.7 — share placeholder until react-native-share is wired in.
  // TODO: replace with native Share API or react-native-share once content schema lands.
  const handleShare = React.useCallback(() => {
    Alert.alert('Share packing list', 'Sharing coming soon.');
  }, []);

  const togglePacked = React.useCallback((id: string) => {
    setPacked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const packedCount = packed.size;
  // Codex audit P2.3 — guard against TOTAL===0 once the live wardrobe hook lands.
  const progress = TOTAL > 0 ? packedCount / TOTAL : 0;

  // Memoised so SectionList row memoisation isn't invalidated on parent re-renders.
  // Codex audit P2.2.
  const renderItem = React.useCallback(({ item, index, section }: { item: PackingItem; index: number; section: Section }) => {
    const isPacked = packed.has(item.id);
    const isLast = index === section.data.length - 1;
    return (
      <Pressable
        onPress={() => togglePacked(item.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isPacked }}
        accessibilityLabel={item.name}
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
        {/* Decorative gradient — hidden from screen readers. Codex audit P2.6. */}
        <LinearGradient
          colors={[`hsl(${item.hue}, 38%, 78%)`, `hsl(${(item.hue + 30) % 360}, 30%, 62%)`]}
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
            {item.name}
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
  }, [packed, t, togglePacked]);

  const renderSectionHeader = ({ section }: { section: Section }) => {
    const sectionPacked = section.data.filter((d) => packed.has(d.id)).length;
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

  const renderSectionFooter = ({ section }: { section: Section }) => (
    <View style={{ paddingHorizontal: 20, paddingTop: 6 }}>
      <Pressable
        // Wardrobe is a tab inside MainTabs, not a stack route — go via the tab container.
        // Codex audit P0.1.
        onPress={() => nav.navigate('MainTabs', { initialTab: 'wardrobe' })}
        accessibilityRole="button"
        accessibilityLabel={`Add from wardrobe to ${section.title}`}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 10,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: t.border2,
            backgroundColor: 'transparent',
            opacity: pressed ? 0.6 : 1,
          },
        ]}>
        <PlusIcon color={t.fg2} size={14} />
        <Text style={{ fontFamily: fonts.uiSemi, fontSize: 12, color: t.fg2, letterSpacing: -0.1 }}>
          Add from wardrobe
        </Text>
      </Pressable>
    </View>
  );

  const ListHeader = (
    <View style={{ paddingHorizontal: 20, paddingTop: 4, gap: 14 }}>
      <View style={s.headerRow}>
        <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 4 }}>Lisbon · 5 days</Eyebrow>
          <PageTitle>Your capsule</PageTitle>
        </View>
        <IconBtn ariaLabel="Share" onPress={handleShare}>
          <ShareIcon color={t.fg} />
        </IconBtn>
      </View>

      {/* Trip summary pill row.
          TODO: thread destination/dates/tripType from route params once the wizard wires
          its state through TravelMustHaves → TravelPackingList. Codex audit P2.9. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {['May 12 – 17', '5 nights', '18–24°', 'City'].map((label) => (
          <View
            key={label}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: radii.pill,
              borderWidth: 1,
              borderColor: t.border,
              backgroundColor: t.card,
            }}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 10.5,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                color: t.fg2,
              }}>
              {label}
            </Text>
          </View>
        ))}
      </View>

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
            <Text style={{ color: t.fg3 }}> / {TOTAL}</Text>
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
          {packedCount === TOTAL
            ? 'All packed · ready to fly'
            : `${TOTAL - packedCount} pieces left`}
        </Caption>
      </Card>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <SectionList
        sections={SECTIONS}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        renderSectionFooter={renderSectionFooter}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      />

      {/* Sticky share bar */}
      <View style={[s.stickyBar, { backgroundColor: t.bg, borderTopColor: t.border }]}>
        <Button
          label="Share packing list"
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
