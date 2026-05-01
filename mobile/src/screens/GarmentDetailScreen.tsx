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

const GARMENT = {
  name: 'Wool overshirt',
  category: 'Outerwear',
  subcategory: 'Overshirt',
  hue: 32,
  wearCount: 23,
  fields: [
    { label: 'Category', value: 'Outerwear' },
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
    { id: 'o1', name: 'Studio brunch', sub: '4 pieces',  hue: 32 },
    { id: 'o3', name: 'Boardroom',     sub: '5 pieces',  hue: 220 },
  ] satisfies GarmentCardData[],
  similar: [
    { id: 's1', name: 'Sand chore',     sub: 'Outer · Cotton', hue: 45 },
    { id: 's2', name: 'Camel cardigan', sub: 'Knit · Wool',    hue: 38 },
    { id: 's3', name: 'Brown blazer',   sub: 'Outer · Wool',   hue: 18 },
  ] satisfies GarmentCardData[],
};

type Tab = 'info' | 'outfits' | 'similar';

export function GarmentDetailScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  // Route param plumbed for future hook lookup.
  useRoute<Route>();

  const [tab, setTab] = React.useState<Tab>('info');

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.headerRow, { borderBottomColor: t.border }]}>
        <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Eyebrow>{GARMENT.category}</Eyebrow>
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
            {GARMENT.name}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <IconBtn
            ariaLabel="Edit piece"
            variant="ghost"
            onPress={() => nav.navigate('EditGarment', undefined)}>
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
              `hsl(${GARMENT.hue}, 38%, 78%)`,
              `hsl(${(GARMENT.hue + 30) % 360}, 30%, 62%)`,
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
              {GARMENT.wearCount}
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
              {GARMENT.fields.map((f, i) => (
                <ListRow
                  key={f.label}
                  title={f.label}
                  hideChevron
                  last={i === GARMENT.fields.length - 1}
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
                {GARMENT.tags.map((tag) => (
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
          GARMENT.outfits.length === 0 ? (
            <EmptyTab title="Not in any outfit yet" body="Build a look featuring this piece." />
          ) : (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {GARMENT.outfits.map((g) => (
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
          GARMENT.similar.length === 0 ? (
            <EmptyTab title="No similar pieces" body="We didn't find anything matching this style yet." />
          ) : (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {GARMENT.similar.map((g) => (
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
