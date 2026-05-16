// Weather row + anchor picker row + formality chips for StyleMeScreen —
// extracted in Phase 3 polish. These three context sections sit between
// the occasion grid and the Generate CTA, and don't own any state of
// their own (everything is parent-derived). Pulling them out keeps the
// orchestrator focused on data + handlers.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import { Eyebrow } from '../../components/Eyebrow';
import { Caption } from '../../components/Caption';
import { Chip } from '../../components/Chip';
import { SunIcon } from '../../components/icons';
import { hapticLight } from '../../lib/haptics';
import { t as tr } from '../../lib/i18n';

export interface StyleMeWeatherRowProps {
  weatherLine: string;
  onAdjustPress: () => void;
}

export function StyleMeWeatherRow({ weatherLine, onAdjustPress }: StyleMeWeatherRowProps) {
  const t = useTokens();
  return (
    <View style={[s.weatherRow, { borderColor: t.border, backgroundColor: t.card }]}>
      <View style={{ width: 36, height: 36, borderRadius: radii.md, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <SunIcon color={t.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Eyebrow style={{ marginBottom: 1 }}>Weather</Eyebrow>
        <Text style={{ fontFamily: fonts.uiSemi, fontSize: 13, color: t.fg, fontWeight: '600', letterSpacing: -0.13 }}>
          {weatherLine}
        </Text>
      </View>
      <Pressable
        onPress={onAdjustPress}
        accessibilityRole="button"
        accessibilityLabel={tr('styleMe.weather.adjust.cta')}
        style={{ paddingHorizontal: 6, paddingVertical: 6 }}>
        <Text style={{ fontFamily: fonts.uiMed, fontSize: 12, color: t.accent }}>
          {tr('styleMe.weather.adjust.cta')}
        </Text>
      </Pressable>
    </View>
  );
}

export interface StyleMeAnchorRowProps {
  anchorIds: string[];
  anchorTitle: string | null | undefined;
  onClear: () => void;
  onOpen: () => void;
}

export function StyleMeAnchorRow({ anchorIds, anchorTitle, onClear, onOpen }: StyleMeAnchorRowProps) {
  const t = useTokens();
  const hasAnchor = anchorIds.length > 0;
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <Eyebrow>{tr('styleMe.anchor.title')}</Eyebrow>
        {hasAnchor ? (
          <Pressable onPress={onClear} accessibilityRole="button">
            <Text style={{ fontFamily: fonts.uiMed, fontSize: 12, color: t.accent }}>
              {tr('styleMe.anchor.clear')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={() => {
          hapticLight();
          onOpen();
        }}
        style={({ pressed }) => [
          s.anchorRow,
          {
            borderColor: hasAnchor ? t.accent : t.border,
            backgroundColor: hasAnchor ? t.accentSoft : t.card,
            transform: pressed ? [{ scale: 0.99 }] : [],
          },
        ]}
        accessibilityRole="button">
        <Text style={{ fontFamily: fonts.uiMed, fontSize: 13, color: t.fg }}>
          {hasAnchor ? anchorTitle || anchorIds[0] : tr('styleMe.anchor.empty')}
        </Text>
        <Text style={{ fontFamily: fonts.uiMed, fontSize: 12, color: t.accent }}>
          {tr('styleMe.anchor.cta')}
        </Text>
      </Pressable>
    </View>
  );
}

export interface StyleMeFormalityRowProps<K extends string> {
  keys: readonly K[];
  active: K;
  onSelect: (next: K) => void;
}

export function StyleMeFormalityRow<K extends string>({
  keys,
  active,
  onSelect,
}: StyleMeFormalityRowProps<K>) {
  const t = useTokens();
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <Eyebrow>Formality</Eyebrow>
        <Caption style={{ color: t.accent }}>{tr(`styleMe.formality.${active}`)}</Caption>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {keys.map((key) => (
          <Chip
            key={key}
            label={tr(`styleMe.formality.${key}`)}
            active={key === active}
            onPress={() => onSelect(key)}
          />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  anchorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
});
