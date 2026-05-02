// LanguageStep — onboarding step 1.
// 10 supported languages, default English. Country-flag emojis are intentionally
// allowed here only (per the user's spec) — they're geographic identifiers, not
// decorative emojis. Every other screen in the app stays emoji-free.

import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import { Eyebrow } from '../../components/Eyebrow';
import { PageTitle } from '../../components/PageTitle';
import { Button } from '../../components/Button';
import { CheckIcon } from '../../components/icons';

export type LanguageCode = 'en' | 'sv' | 'fr' | 'de' | 'es' | 'it' | 'ar' | 'fa' | 'pl' | 'pt';

type LanguageEntry = { code: LanguageCode; name: string; flag: string };

const LANGUAGES: ReadonlyArray<LanguageEntry> = [
  { code: 'en', name: 'English',    flag: '🇬🇧' },
  { code: 'sv', name: 'Svenska',    flag: '🇸🇪' },
  { code: 'fr', name: 'Français',   flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch',    flag: '🇩🇪' },
  { code: 'es', name: 'Español',    flag: '🇪🇸' },
  { code: 'it', name: 'Italiano',   flag: '🇮🇹' },
  { code: 'ar', name: 'العربية',    flag: '🇸🇦' },
  { code: 'fa', name: 'فارسی',      flag: '🇮🇷' },
  { code: 'pl', name: 'Polski',     flag: '🇵🇱' },
  { code: 'pt', name: 'Português',  flag: '🇧🇷' },
];

export function LanguageStep({
  initial,
  onComplete,
}: {
  initial?: LanguageCode;
  onComplete: (code: LanguageCode) => void;
}) {
  const t = useTokens();
  const [selected, setSelected] = React.useState<LanguageCode>(initial ?? 'en');

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 20, marginBottom: 18, gap: 8 }}>
        <Eyebrow>Welcome to BURS</Eyebrow>
        <PageTitle>Choose your language</PageTitle>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 8 }}
        showsVerticalScrollIndicator={false}>
        {LANGUAGES.map((lang) => {
          const active = lang.code === selected;
          return (
            <Pressable
              key={lang.code}
              onPress={() => setSelected(lang.code)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={lang.name}
              style={({ pressed }) => ({
                height: 56,
                paddingHorizontal: 16,
                borderRadius: radii.lg,
                backgroundColor: active ? t.accentSoft : t.card,
                borderWidth: 1,
                borderColor: active ? t.accent : t.border,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                opacity: pressed ? 0.92 : 1,
              })}>
              <Text
                style={{ fontSize: 22 }}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants">
                {lang.flag}
              </Text>
              <Text
                style={{
                  flex: 1,
                  fontFamily: fonts.uiSemi,
                  fontSize: 14.5,
                  color: t.fg,
                  letterSpacing: -0.13,
                  fontWeight: '600',
                }}>
                {lang.name}
              </Text>
              {active ? <CheckIcon size={18} color={t.accent} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <Button label="Continue" variant="accent" block onPress={() => onComplete(selected)} />
      </View>
    </View>
  );
}
