// Home (Today) — hub screen, mirrors design_handoff_burs_rn/source/screens.jsx HomeScreen exactly.
// Sections: greeting header · Today's look hero card · Your Stylist hub grid · Discover hub grid ·
// This week mini-strip · Ask the stylist row · Your rhythm stat blocks · BottomNav.
// Source of truth for visual values: styles.css (`.card-hero`, `.hub-tile`, `.mini-day`, `.stat-block`).

import React from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import {
  ChatIcon, OutfitsIcon, TshirtIcon, SmileIcon, SuitcaseIcon, GapsIcon, GearIcon,
  SunIcon, ChevronIcon, SparklesIcon, type IconProps,
} from '../components/icons';
import type { RootStackParamList, TabName } from '../navigation/RootNavigator';

type HomeNav = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen({ goTab }: { goTab: (id: TabName) => void }) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<HomeNav>();
  const push = (route: keyof RootStackParamList) => () => nav.navigate(route as never);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 130,
          gap: 18,
        }}
        showsVerticalScrollIndicator={false}>

        {/* ============ HEADER ============ */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Eyebrow style={{ marginBottom: 4 }}>Sat · Apr 26</Eyebrow>
            <PageTitle>Good morning, Borna</PageTitle>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingTop: 2 }}>
            <Pressable
              onPress={push('Notifications')}
              style={[s.weatherPill, { borderColor: t.border, backgroundColor: t.card }]}>
              <SunIcon color={t.fg} />
              <Text style={[s.weatherText, { color: t.fg, fontFamily: fonts.uiMed }]}>14°</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Profile"
              onPress={push('Profile')}
              style={s.avatarWrap}>
              <View style={[s.avatar, { backgroundColor: t.accent }]}>
                <Text style={{ color: t.accentFg, fontWeight: '600', fontSize: 13 }}>B</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* ============ TODAY'S LOOK HERO ============ */}
        <Card hero padding={18}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <View>
              <Eyebrow style={{ marginBottom: 3 }}>Today's Look</Eyebrow>
              <Text style={{ fontFamily: fonts.displayMedium, fontStyle: 'italic', fontSize: 22, lineHeight: 24, fontWeight: '500', color: t.fg, letterSpacing: -0.22 }}>
                Studio brunch
              </Text>
            </View>
            <Pressable onPress={push('OutfitDetail')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: t.accent, fontSize: 12, fontWeight: '500', fontFamily: fonts.uiMed }}>View</Text>
              <ChevronIcon color={t.accent} />
            </Pressable>
          </View>
          <View style={s.outfitRow}>
            <OutfitThumb label="OUTER" />
            <OutfitThumb label="TOP" />
            <OutfitThumb label="BOTTOM" />
            <OutfitThumb label="SHOES" />
          </View>
          <Text style={{ fontSize: 12.5, color: t.fg2, marginVertical: 14, lineHeight: 18, fontFamily: fonts.ui }}>
            14° clear — pair the wool overshirt with cream linen for the gallery opening at 11.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Wear this" onPress={push('OutfitDetail')} block style={{ flex: 1 }} />
            <Button label="Restyle" variant="outline" onPress={push('StyleMe')} />
          </View>
        </Card>

        {/* ============ YOUR STYLIST GRID ============ */}
        <Section title="Your Stylist">
          <HubGrid>
            <HubTile icon={<ChatIcon color={t.accent} />}     label="Style Chat"   sub="Ask your AI stylist anything"  onPress={push('StyleChat')} />
            <HubTile icon={<OutfitsIcon color={t.accent} />}  label="Outfits"      sub="Your saved looks & combos"     onPress={push('Outfits')} />
            <HubTile icon={<TshirtIcon color={t.accent} />}   label="Style Me"     sub="Get styled for any occasion"   onPress={push('StyleMe')} />
            <HubTile icon={<SmileIcon color={t.accent} />}    label="Mood Outfit"  sub="Dress how you feel"            onPress={push('MoodOutfit')} />
          </HubGrid>
        </Section>

        {/* ============ DISCOVER GRID ============ */}
        <Section title="Discover">
          <HubGrid>
            <HubTile icon={<SuitcaseIcon color={t.accent} />} label="Travel Capsule" sub="Pack smart for any trip"              onPress={push('TravelCapsule')} />
            <HubTile icon={<GapsIcon color={t.accent} />}     label="Wardrobe Gaps"  sub="What's missing from your closet"      onPress={push('WardrobeGaps')} />
            <HubTile icon={<GearIcon color={t.accent} />}     label="Settings"       sub="Preferences & account"                onPress={push('Settings')} />
          </HubGrid>
        </Section>

        {/* ============ THIS WEEK MINI-STRIP ============ */}
        <View>
          <View style={s.sectionHead}>
            <Text style={[s.sectionTitle, { color: t.fg, fontFamily: fonts.displayMedium }]}>This week</Text>
            <Pressable onPress={() => goTab('plan')} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={{ color: t.accent, fontSize: 12, fontWeight: '500', fontFamily: fonts.uiMed }}>Calendar →</Text>
            </Pressable>
          </View>
          <MiniWeek onPress={() => goTab('plan')} />
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
            <Button label="Wear today" size="sm" onPress={push('OutfitDetail')} block style={{ flex: 1 }} />
            <Button label="Restyle" variant="outline" size="sm" onPress={push('StyleMe')} />
            <Button label="+ Add" variant="outline" size="sm" onPress={push('AddPieceStep1')} />
          </View>
        </View>

        {/* ============ ASK THE STYLIST ROW ============ */}
        <View>
          <View style={s.sectionHead}>
            <Text style={[s.sectionTitle, { color: t.fg, fontFamily: fonts.displayMedium }]}>Ask the stylist</Text>
            <Caption>AI</Caption>
          </View>
          <Pressable
            onPress={push('StyleChat')}
            style={[s.stylistRow, { borderColor: t.border, backgroundColor: t.card }]}>
            <View style={[s.stylistIcon, { backgroundColor: t.accentSoft }]}>
              <SparklesIcon color={t.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13.5, fontWeight: '600', color: t.fg, fontFamily: fonts.uiSemi, letterSpacing: -0.13 }}>
                What goes with my linen trousers?
              </Text>
              <Text style={{ fontSize: 11.5, color: t.fg2, marginTop: 1, fontFamily: fonts.ui }}>
                Tap to chat — context-aware
              </Text>
            </View>
            <ChevronIcon color={t.fg3} />
          </Pressable>
        </View>

        {/* ============ YOUR RHYTHM ============ */}
        <View>
          <View style={s.sectionHead}>
            <Text style={[s.sectionTitle, { color: t.fg, fontFamily: fonts.displayMedium }]}>Your rhythm</Text>
            <Pressable onPress={() => goTab('insights')}>
              <Text style={{ color: t.accent, fontSize: 12, fontWeight: '500', fontFamily: fonts.uiMed }}>Insights →</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <RhythmStat num="23" label="Outfits worn" onPress={() => goTab('insights')} />
            <RhythmStat num="68%" label="Wardrobe used" onPress={() => goTab('insights')} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ====== Sub-components (private to HomeScreen — promote to /components/ if reused) ======

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <View style={{ marginBottom: 10 }}>
        <Eyebrow>{title}</Eyebrow>
      </View>
      {children}
    </View>
  );
}

function HubGrid({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}

function HubTile({
  icon, label, sub, onPress,
}: { icon: React.ReactNode; label: string; sub: string; onPress?: () => void }) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.hubTile,
        {
          backgroundColor: t.card,
          borderColor: t.border,
          transform: pressed ? [{ scale: 0.98 }] : [],
        },
      ]}>
      <View style={[s.hubTileIcon, { backgroundColor: t.accentSoft }]}>{icon}</View>
      <View style={{ gap: 1 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '600', color: t.fg, fontFamily: fonts.uiSemi, letterSpacing: -0.15 }}>
          {label}
        </Text>
        <Text numberOfLines={2} style={{ fontSize: 11.5, color: t.fg2, lineHeight: 16, fontFamily: fonts.ui }}>
          {sub}
        </Text>
      </View>
    </Pressable>
  );
}

function OutfitThumb({ label }: { label: string }) {
  const t = useTokens();
  return (
    <View style={{ flex: 1, aspectRatio: 1, borderRadius: 14, borderWidth: 1, borderColor: t.border, backgroundColor: t.bg2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <Text style={{ fontSize: 9, fontFamily: fonts.uiSemi, letterSpacing: 1.1, color: t.fg2, opacity: 0.55, textTransform: 'uppercase' }}>
        {label}
      </Text>
    </View>
  );
}

function MiniWeek({ onPress }: { onPress: () => void }) {
  const t = useTokens();
  // [day, num, active, dot]
  const days: Array<[string, number, boolean, 'gold' | null]> = [
    ['SAT', 26, true, 'gold'],
    ['SUN', 27, false, 'gold'],
    ['MON', 28, false, 'gold'],
    ['TUE', 29, false, null],
    ['WED', 30, false, 'gold'],
    ['THU', 1,  false, null],
    ['FRI', 2,  false, null],
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {days.map(([d, n, active, dot], i) => {
        const dotColor = dot === 'gold' ? t.accent : active ? t.bg : t.fg3;
        return (
          <Pressable
            key={i}
            onPress={onPress}
            style={[
              s.miniDay,
              {
                backgroundColor: active ? t.fg : t.card,
                borderColor: active ? t.fg : t.border,
                flex: 1,
              },
            ]}>
            <Text style={{ fontSize: 9, letterSpacing: 1.3, color: active ? t.bg : t.fg2, fontFamily: fonts.uiSemi, opacity: active ? 0.75 : 1 }}>
              {d}
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '600', fontFamily: fonts.uiSemi, color: active ? t.bg : t.fg }}>
              {n}
            </Text>
            <View style={{ width: 4, height: 4, borderRadius: 4, backgroundColor: dotColor, opacity: dot ? 1 : 0.25 }} />
          </Pressable>
        );
      })}
    </View>
  );
}

function RhythmStat({ num, label, onPress }: { num: string; label: string; onPress: () => void }) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      style={[s.rhythmStat, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={{ fontFamily: fonts.displayMedium, fontStyle: 'italic', fontSize: 28, lineHeight: 28, fontWeight: '500', color: t.fg }}>
        {num}
      </Text>
      <Text style={{ fontSize: 10.5, marginTop: 6, textTransform: 'uppercase', letterSpacing: 1.7, color: t.fg2, fontFamily: fonts.uiSemi }}>
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  weatherPill: {
    height: 32,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  weatherText: { fontSize: 12, fontWeight: '500' },
  avatarWrap: { /* hit area */ },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 0,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 19, fontStyle: 'italic', fontWeight: '500', letterSpacing: -0.19 },
  hubTile: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '48%',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  hubTileIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniDay: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  stylistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  stylistIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rhythmStat: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
});
