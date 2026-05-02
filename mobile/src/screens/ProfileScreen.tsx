// Profile — your at-a-glance view: avatar, style summary, wardrobe stats, settings shortcuts.
// Mirrors design_handoff_burs_rn/source/extra-screens.jsx ProfileScreen.

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { IconBtn } from '../components/IconBtn';
import { Button } from '../components/Button';
import { StatBlock } from '../components/StatBlock';
import { SettingsRow } from '../components/SettingsRow';
import { BackIcon, GearIcon, TshirtIcon } from '../components/icons';
import { FAVORITE_COLOR_SAMPLES } from '../theme/styleColors';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ARCHETYPES = ['Minimal', 'Editorial', 'Earth tones'];
// Sourced from `theme/styleColors.ts` (single source of truth shared with SettingsStyleScreen).
const FAVORITE_COLORS = FAVORITE_COLOR_SAMPLES.slice(0, 5);
const FORMALITY_LEVELS = ['Casual', 'Smart casual', 'Business'];
const CURRENT_FORMALITY = 'Smart casual';

export function ProfileScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 18 }}
        showsVerticalScrollIndicator={false}>
        {/* ============ HEADER ============ */}
        <View style={s.headerRow}>
          <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1 }}>
            <Eyebrow style={{ marginBottom: 4 }}>Your profile</Eyebrow>
            <PageTitle>Borna Krneta</PageTitle>
          </View>
          <Button label="Edit" variant="outline" size="sm" onPress={() => {}} />
        </View>

        {/* ============ AVATAR + IDENTITY ============ */}
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 12 }}>
          <View
            style={[
              s.avatar,
              { backgroundColor: t.accent },
            ]}>
            <Text style={{ color: t.accentFg, fontFamily: fonts.uiSemi, fontSize: 32, fontWeight: '600' }}>
              B
            </Text>
          </View>
          <Text
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 14.5,
              color: t.fg,
              fontWeight: '600',
              letterSpacing: -0.15,
            }}>
            Borna Krneta
          </Text>
          <Caption>borna@example.com · Member since 2024</Caption>
        </View>

        {/* ============ STYLE SUMMARY ============ */}
        <Card hero padding={18}>
          <Eyebrow style={{ marginBottom: 8 }}>Style DNA</Eyebrow>
          <Text
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 22,
              fontWeight: '500',
              color: t.fg,
              letterSpacing: -0.22,
              marginBottom: 14,
            }}>
            Quiet luxe
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {ARCHETYPES.map((a) => (
              <Chip key={a} label={a} active />
            ))}
          </View>

          <Eyebrow style={{ marginBottom: 8 }}>Favorite colors</Eyebrow>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {FAVORITE_COLORS.map((color) => (
              <View
                key={color}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: color,
                  borderWidth: 1,
                  borderColor: t.border,
                }}
              />
            ))}
          </View>

          <Eyebrow style={{ marginBottom: 8 }}>Formality</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {FORMALITY_LEVELS.map((level) => (
              <Chip key={level} label={level} active={level === CURRENT_FORMALITY} />
            ))}
          </View>
        </Card>

        {/* ============ STATS ============ */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <StatBlock num="142" label="Garments" style={{ flex: 1 }} />
          <StatBlock num="38" label="Outfits" style={{ flex: 1 }} />
          <StatBlock num="186" label="Wears" style={{ flex: 1 }} />
        </View>

        {/* ============ SETTINGS LINKS ============ */}
        <Card padding={4}>
          <SettingsRow
            icon={<GearIcon size={18} color={t.accent} />}
            title="Account settings"
            caption="Email, password, connected accounts"
            onPress={() => nav.navigate('SettingsAccount')}
          />
          <SettingsRow
            icon={<TshirtIcon size={18} color={t.accent} />}
            title="Style profile"
            caption="Aesthetic, sizes, color preferences"
            last
            onPress={() => nav.navigate('SettingsStyle')}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
