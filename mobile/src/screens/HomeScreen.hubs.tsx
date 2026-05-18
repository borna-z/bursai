// HomeScreen — hub grids + ask-stylist row (N13 split).
//
// Renders the "Your Stylist" 4-tile grid, the "Discover" 3-tile grid, and
// the "Ask the stylist" CTA row. The Section + HubGrid + HubTile primitives
// are shared between the two grids; nothing here owns state.

import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { Caption } from '../components/Caption';
import {
  ChatIcon, OutfitsIcon, TshirtIcon, SmileIcon, SuitcaseIcon, GapsIcon, GearIcon,
  ChevronIcon, SparklesIcon,
} from '../components/icons';
import { t as tr } from '../lib/i18n';
import type { RootStackParamList } from '../navigation/RootNavigator';

type RouteName = keyof RootStackParamList;
type GoRoute = (route: RouteName) => () => void;

export function StylistHubsSection({ goRoute }: { goRoute: GoRoute }) {
  const t = useTokens();
  return (
    <Section title={tr('home.section.stylist')}>
      <HubGrid>
        <HubTile icon={<ChatIcon color={t.accent} />}     label={tr('home.tile.styleChat.label')}   sub={tr('home.tile.styleChat.sub')}  onPress={goRoute('StyleChat')} />
        <HubTile icon={<OutfitsIcon color={t.accent} />}  label={tr('home.tile.outfits.label')}      sub={tr('home.tile.outfits.sub')}     onPress={goRoute('Outfits')} />
        <HubTile icon={<TshirtIcon color={t.accent} />}   label={tr('home.tile.styleMe.label')}     sub={tr('home.tile.styleMe.sub')}   onPress={goRoute('StyleMe')} />
        <HubTile icon={<SmileIcon color={t.accent} />}    label={tr('home.tile.moodOutfit.label')}  sub={tr('home.tile.moodOutfit.sub')}            onPress={goRoute('MoodOutfit')} />
      </HubGrid>
    </Section>
  );
}

export function DiscoverHubsSection({ goRoute }: { goRoute: GoRoute }) {
  const t = useTokens();
  return (
    <Section title={tr('home.section.discover')}>
      <HubGrid>
        <HubTile icon={<SuitcaseIcon color={t.accent} />} label={tr('home.tile.travelCapsule.label')} sub={tr('home.tile.travelCapsule.sub')}              onPress={goRoute('TravelCapsule')} />
        <HubTile icon={<GapsIcon color={t.accent} />}     label={tr('home.tile.wardrobeGaps.label')}  sub={tr('home.tile.wardrobeGaps.sub')}      onPress={goRoute('WardrobeGaps')} />
        <HubTile icon={<GearIcon color={t.accent} />}     label={tr('home.tile.settings.label')}       sub={tr('home.tile.settings.sub')}                onPress={goRoute('Settings')} />
      </HubGrid>
    </Section>
  );
}

export function AskStylistRow({
  promptKey,
  onPress,
}: {
  /** i18n key for the prompt copy shown on the row AND seeded into the
   *  chat composer when tapped. Caller picks a fresh key per mount via
   *  `useStylistPromptKey()` so users see a different starter every
   *  time they land on Home. Falls back to the static example when
   *  omitted (legacy callers / tests). */
  promptKey?: string;
  onPress: () => void;
}) {
  const t = useTokens();
  const promptText = tr(promptKey ?? 'home.askStylist.exampleSeed');
  return (
    <View>
      <View style={s.sectionHead}>
        <Text style={[s.sectionTitle, { color: t.fg, fontFamily: fonts.displayMedium }]}>{tr('home.section.askStylist')}</Text>
        <Caption>AI</Caption>
      </View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${promptText}. ${tr('home.askStylist.tapHint')}`}
        style={[s.stylistRow, { borderColor: t.border, backgroundColor: t.card }]}>
        <View style={[s.stylistIcon, { backgroundColor: t.accentSoft }]}>
          <SparklesIcon color={t.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13.5, fontWeight: '600', color: t.fg, fontFamily: fonts.uiSemi, letterSpacing: -0.13 }}>
            {promptText}
          </Text>
          <Text style={{ fontSize: 11.5, color: t.fg2, marginTop: 1, fontFamily: fonts.ui }}>
            {tr('home.askStylist.tapHint')}
          </Text>
        </View>
        <ChevronIcon color={t.fg3} />
      </Pressable>
    </View>
  );
}

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
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${sub}`}
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

const s = StyleSheet.create({
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
});
