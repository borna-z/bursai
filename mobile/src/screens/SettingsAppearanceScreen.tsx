// Settings · Appearance — pick light / dark / system theme.
// Drives ThemeProvider via setMode(). System uses native Appearance scheme.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme, useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { IconBtn } from '../components/IconBtn';
import { BackIcon, CheckIcon, SunRayIcon, MoonIcon, GearIcon } from '../components/icons';
import { t as tr } from '../lib/i18n';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type ThemeOption = {
  id: 'light' | 'dark' | 'system';
  label: string;
  caption: string;
  Icon: typeof SunRayIcon;
};

const OPTIONS: ThemeOption[] = [
  {
    id: 'light',
    label: tr('settings.appearance.theme.light.label'),
    caption: tr('settings.appearance.theme.light.caption'),
    Icon: SunRayIcon,
  },
  {
    id: 'dark',
    label: tr('settings.appearance.theme.dark.label'),
    caption: tr('settings.appearance.theme.dark.caption'),
    Icon: MoonIcon,
  },
  {
    id: 'system',
    label: tr('settings.appearance.theme.system.label'),
    caption: tr('settings.appearance.theme.system.caption'),
    Icon: GearIcon,
  },
];

export function SettingsAppearanceScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const { mode, setMode } = useTheme();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 18 }}
        showsVerticalScrollIndicator={false}>
        {/* ============ HEADER ============ */}
        <View style={s.headerRow}>
          <IconBtn ariaLabel={tr('common.back')} onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1 }}>
            <Eyebrow style={{ marginBottom: 4 }}>{tr('settings.appearance.headerEyebrow')}</Eyebrow>
            <PageTitle>{tr('settings.appearance.headerTitle')}</PageTitle>
          </View>
        </View>

        {/* ============ THEME OPTIONS ============ */}
        <View style={{ gap: 10 }}>
          <Eyebrow>{tr('settings.appearance.theme.eyebrow')}</Eyebrow>
          {/* radiogroup role lets VoiceOver/TalkBack announce position ("1 of 3").
              Codex audit P2.5. */}
          <View
            style={{ gap: 8 }}
            accessibilityRole="radiogroup"
            accessibilityLabel={tr('settings.appearance.theme.eyebrow')}>
            {OPTIONS.map((option) => {
              const isActive = mode === option.id;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={option.label}
                  onPress={() => setMode(option.id)}
                  style={({ pressed }) => [
                    s.card,
                    {
                      backgroundColor: t.card,
                      borderColor: isActive ? t.accent : t.border,
                      borderWidth: isActive ? 2 : 1,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}>
                  <View
                    style={[
                      s.iconCircle,
                      { backgroundColor: t.accentSoft },
                    ]}>
                    <option.Icon color={t.accent} size={20} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={{
                        fontFamily: fonts.uiSemi,
                        fontSize: 14.5,
                        color: t.fg,
                        letterSpacing: -0.15,
                        fontWeight: '600',
                      }}>
                      {option.label}
                    </Text>
                    <Caption>{option.caption}</Caption>
                  </View>
                  {isActive ? (
                    <View style={[s.checkBadge, { backgroundColor: t.accent }]}>
                      <CheckIcon color={t.accentFg} size={14} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radii.lg,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
