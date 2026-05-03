// Style Me — occasion-based outfit creator.
// Pixel-faithful port of design_handoff_burs_rn/source/extra-screens.jsx StyleMeScreen.
//
// Layout: top header (back · "Occasion" + "Style Me") → 2-col occasion grid (icon tiles) →
// weather context pill row → formality chip row (Casual → Smart Casual → Business → Formal) →
// "Generate outfit" CTA → optional result OutfitCard with action buttons.
//
// Behaviour: tapping an occasion sets local state; tapping Generate flips into a results
// view that renders an OutfitCard with the user's selections folded into the sub line.

import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { IconBtn } from '../components/IconBtn';
import { OutfitCard } from '../components/OutfitCard';
import {
  BackIcon,
  SunIcon,
  TshirtIcon,
  SuitcaseIcon,
  CalendarIcon,
  SparklesIcon,
  type IconProps,
} from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Occasion = {
  id: string;
  label: string;
  sub: string;
  Icon: React.ComponentType<IconProps>;
};

// 8 occasions, mapped to icons we already have. Where there's no perfect match the
// closest editorial glyph wins; the design's exact glyph set lives in
// extra-screens.jsx but the user's icon inventory only ships a subset to mobile.
const OCCASIONS: Occasion[] = [
  { id: 'work',     label: 'Work',     sub: 'Office, meetings',  Icon: TshirtIcon  },
  { id: 'dinner',   label: 'Dinner',   sub: 'Refined evenings',  Icon: SparklesIcon },
  { id: 'casual',   label: 'Casual',   sub: 'Errands, weekends', Icon: TshirtIcon  },
  { id: 'date',     label: 'Date',     sub: 'A bit considered',  Icon: SparklesIcon },
  { id: 'travel',   label: 'Travel',   sub: 'Light, layered',    Icon: SuitcaseIcon },
  { id: 'wedding',  label: 'Wedding',  sub: 'Sharp, soft',       Icon: SparklesIcon },
  { id: 'sport',    label: 'Sport',    sub: 'Move-friendly',     Icon: SunIcon     },
  { id: 'evening',  label: 'Evening',  sub: 'Out late',          Icon: CalendarIcon },
];

const FORMALITY = ['Casual', 'Smart casual', 'Business', 'Formal'] as const;
type Formality = typeof FORMALITY[number];

export function StyleMeScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [occId, setOccId] = useState<string>('work');
  const [formality, setFormality] = useState<Formality>('Smart casual');
  const [generated, setGenerated] = useState(false);

  const occ = OCCASIONS.find((o) => o.id === occId) ?? OCCASIONS[0];

  const generate = () => setGenerated(true);
  const restyle = () => setGenerated(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* ============ HEADER ============ */}
      <View style={[s.header, { borderBottomColor: t.border }]}>
        <IconBtn variant="ghost" onPress={() => nav.goBack()} ariaLabel="Back">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>Occasion</Eyebrow>
          <PageTitle size={26}>Style Me</PageTitle>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 18 }}
        showsVerticalScrollIndicator={false}>

        {/* ============ OCCASION GRID 2-col ============ */}
        <View>
          <Eyebrow style={{ marginBottom: 10 }}>Pick an occasion</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {OCCASIONS.map((o) => {
              const Icon = o.Icon;
              const isActive = o.id === occId;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => setOccId(o.id)}
                  style={({ pressed }) => [
                    s.occTile,
                    {
                      borderColor: isActive ? t.accent : t.border,
                      borderWidth: isActive ? 2 : 1,
                      backgroundColor: isActive ? t.accentSoft : t.card,
                      transform: pressed ? [{ scale: 0.98 }] : [],
                    },
                  ]}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radii.md,
                      backgroundColor: t.accentSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Icon color={t.accent} />
                  </View>
                  <View style={{ gap: 1 }}>
                    <Text style={{ fontFamily: fonts.uiSemi, fontSize: 14, fontWeight: '600', color: t.fg, letterSpacing: -0.14 }}>
                      {o.label}
                    </Text>
                    <Text style={{ fontFamily: fonts.ui, fontSize: 11, color: t.fg2 }} numberOfLines={1}>
                      {o.sub}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ============ WEATHER CONTEXT ============ */}
        <View
          style={[
            s.weatherRow,
            { borderColor: t.border, backgroundColor: t.card },
          ]}>
          <View style={{ width: 36, height: 36, borderRadius: radii.md, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <SunIcon color={t.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Eyebrow style={{ marginBottom: 1 }}>Weather</Eyebrow>
            <Text style={{ fontFamily: fonts.uiSemi, fontSize: 13, color: t.fg, fontWeight: '600', letterSpacing: -0.13 }}>
              14° clear · light breeze
            </Text>
          </View>
          <Pressable
            onPress={() =>
              Alert.alert('Weather', 'Weather customisation coming soon.')
            }
            accessibilityRole="button"
            accessibilityLabel="Adjust weather context"
            style={{ paddingHorizontal: 6, paddingVertical: 6 }}>
            <Text style={{ fontFamily: fonts.uiMed, fontSize: 12, color: t.accent }}>Adjust</Text>
          </Pressable>
        </View>

        {/* ============ FORMALITY ============ */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <Eyebrow>Formality</Eyebrow>
            <Caption style={{ color: t.accent }}>{formality}</Caption>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {FORMALITY.map((label) => (
              <Chip
                key={label}
                label={label}
                active={label === formality}
                onPress={() => setFormality(label)}
              />
            ))}
          </View>
        </View>

        {/* ============ GENERATE / RESULT ============ */}
        {!generated ? (
          <Button label="Generate outfit" onPress={generate} block />
        ) : (
          <View style={{ gap: 14 }}>
            <View>
              <Eyebrow style={{ marginBottom: 8 }}>Styled for you</Eyebrow>
              <OutfitCard
                name={`${occ.label} · ${formality.toLowerCase()}`}
                sub={`${occ.sub.toUpperCase()} · 14° CLEAR`}
                hues={[32, 38, 200, 28]}
                onUse={() => nav.navigate('OutfitDetail')}
                onSave={() => Alert.alert('Saved', 'Outfit saved to your collection.')}
              />
            </View>
            <Button label="Restyle" variant="outline" onPress={restyle} block />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  occTile: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '48%',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radii.xl,
    gap: 10,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
});
