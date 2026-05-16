// Occasion grid + Custom input row for StyleMeScreen — extracted in
// Phase 3 polish. The orchestrator owns occasion / custom-text state;
// this component renders the 6 canonical occasions + the `Custom…`
// 7th tile + the inline TextInput that appears when `custom` is active.
//
// Behaviour parity:
//   • Tile press emits `hapticLight()` through `onSelect` (the parent
//     handler unchanged).
//   • Custom text trim-on-blur stays here so the parent doesn't need
//     to wire onBlur — the parent's `setCustomOccasion` setter is the
//     same one used for change events.

import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import { Eyebrow } from '../../components/Eyebrow';
import { SparklesIcon, type IconProps } from '../../components/icons';
import { t as tr } from '../../lib/i18n';

export type OccasionId = 'casual' | 'work' | 'evening' | 'date' | 'workout' | 'travel' | 'custom';

export interface OccasionOption {
  id: OccasionId;
  labelKey: string;
  subKey: string;
  Icon: React.ComponentType<IconProps>;
}

export interface StyleMeOccasionGridProps {
  occasions: OccasionOption[];
  occId: OccasionId;
  customOccasion: string;
  onSelect: (id: OccasionId) => void;
  onCustomChange: (next: string) => void;
}

export function StyleMeOccasionGrid({
  occasions,
  occId,
  customOccasion,
  onSelect,
  onCustomChange,
}: StyleMeOccasionGridProps) {
  const t = useTokens();
  return (
    <View>
      <Eyebrow style={{ marginBottom: 10 }}>Pick an occasion</Eyebrow>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {occasions.map((o) => {
          const Icon = o.Icon;
          const isActive = o.id === occId;
          return (
            <Pressable
              key={o.id}
              onPress={() => onSelect(o.id)}
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
                  {tr(o.labelKey)}
                </Text>
                <Text style={{ fontFamily: fonts.ui, fontSize: 11, color: t.fg2 }} numberOfLines={1}>
                  {tr(o.subKey)}
                </Text>
              </View>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => onSelect('custom')}
          style={({ pressed }) => [
            s.occTile,
            {
              borderColor: occId === 'custom' ? t.accent : t.border,
              borderWidth: occId === 'custom' ? 2 : 1,
              backgroundColor: occId === 'custom' ? t.accentSoft : t.card,
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
            <SparklesIcon color={t.accent} />
          </View>
          <View style={{ gap: 1 }}>
            <Text style={{ fontFamily: fonts.uiSemi, fontSize: 14, fontWeight: '600', color: t.fg, letterSpacing: -0.14 }}>
              {tr('styleMe.occasion.custom')}
            </Text>
            <Text style={{ fontFamily: fonts.ui, fontSize: 11, color: t.fg2 }} numberOfLines={1}>
              {customOccasion.trim().length > 0 ? customOccasion : tr('styleMe.occasion.customPlaceholder')}
            </Text>
          </View>
        </Pressable>
      </View>
      {occId === 'custom' ? (
        <View style={[s.customInputRow, { borderColor: t.border, backgroundColor: t.card }]}>
          <TextInput
            value={customOccasion}
            onChangeText={onCustomChange}
            onBlur={() => onCustomChange(customOccasion.trim())}
            placeholder={tr('styleMe.occasion.customPlaceholder')}
            placeholderTextColor={t.fg3}
            maxLength={50}
            style={{
              flex: 1,
              color: t.fg,
              fontFamily: fonts.uiMed,
              fontSize: 14,
              padding: 0,
            }}
            autoFocus
            autoCapitalize="sentences"
            returnKeyType="done"
          />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  occTile: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '48%',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radii.xl,
    gap: 10,
  },
  customInputRow: {
    marginTop: 10,
    height: 44,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
