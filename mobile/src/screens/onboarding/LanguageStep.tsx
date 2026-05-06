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
import { getLocale, setLocale, t as tr } from '../../lib/i18n';
import { hapticLight, hapticSelection } from '../../lib/haptics';

export type LanguageCode = 'en' | 'sv' | 'fr' | 'de' | 'es' | 'it' | 'ar' | 'fa' | 'pl' | 'pt';

type LanguageEntry = { code: LanguageCode; name: string; flag: string };

const LANGUAGES: readonly LanguageEntry[] = [
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
  // Default to the detected system locale (set at import in lib/i18n.ts) so a
  // Swedish-system user sees Svenska pre-selected, not English. Caller-supplied
  // `initial` still wins (used for re-entry from a persisted draft). System
  // locales outside the 10-language whitelist (e.g. `'ja'`) fall back to
  // English so Continue never emits an unsupported code.
  const [selected, setSelected] = React.useState<LanguageCode>(() => {
    if (initial) return initial;
    const detected = getLocale();
    const match = LANGUAGES.find((l) => l.code === detected);
    return match ? match.code : 'en';
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 20, marginBottom: 18, gap: 8 }}>
        <Eyebrow>{tr('language.eyebrow')}</Eyebrow>
        <PageTitle>{tr('language.title')}</PageTitle>
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
              onPress={() => { hapticSelection(); setSelected(lang.code); }}
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
        <Button
          label={tr('language.continue')}
          variant="accent"
          block
          onPress={() => {
            hapticLight();
            // Activate the selected locale immediately so the rest of onboarding
            // renders in it. (i18n shim today returns English regardless of
            // setLocale; once dictionaries land per locale this becomes a real
            // language flip.)
            setLocale(selected);
            onComplete(selected);
          }}
        />
      </View>
    </View>
  );
}
