// Settings row — full-width pressable row used across all Settings sub-screens.
// Mirrors design_handoff_burs_rn/source/extra-screens.jsx `.settings-row` + `.sr-icon` /
// `.sr-label` / `.sr-value` / `.sr-trail`. Right slot is mutually exclusive: chevron OR
// toggle OR badge OR custom node OR nothing.
//
// Group several rows inside a `Card` to get the rounded outer container with hairline
// separators between rows. Last row in a group should pass `last={true}` to suppress
// the bottom border.

import React from 'react';
import { Pressable, Switch, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { ChevronIcon } from './icons';

type SettingsRowProps = {
  /** Optional 36px circle icon on the left, tinted with `accentSoft`. */
  icon?: React.ReactNode;
  /** Primary label (13.5px semibold). */
  title: string;
  /** Optional caption shown below the title (11.5px). */
  caption?: string;
  /** Right value text, e.g. "Metric" or "4 items". Renders before the chevron. */
  value?: string;
  /** Toggle switch — when supplied, the row no longer renders a chevron. */
  toggle?: { value: boolean; onValueChange: (v: boolean) => void };
  /** Custom right-side node (e.g. badge). Wins over chevron + value. */
  right?: React.ReactNode;
  /** Hide chevron explicitly — use for non-navigable rows like "App version". */
  hideChevron?: boolean;
  /** Suppress bottom border (last row in a group). */
  last?: boolean;
  /** Tint the title in the destructive colour (delete account, sign out). */
  destructive?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function SettingsRow({
  icon,
  title,
  caption,
  value,
  toggle,
  right,
  hideChevron = false,
  last = false,
  destructive = false,
  onPress,
  style,
}: SettingsRowProps) {
  const t = useTokens();

  const titleColor = destructive ? t.destructive : t.fg;

  // Chevron only renders when navigable AND no other trailing element wins.
  const showChevron = !hideChevron && right == null && toggle == null && onPress != null;

  const inner = (
    <>
      {icon ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: t.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {icon}
        </View>
      ) : null}

      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 13.5,
            fontWeight: '600',
            color: titleColor,
            letterSpacing: -0.13,
          }}>
          {title}
        </Text>
        {caption ? (
          <Text
            numberOfLines={2}
            style={{
              fontFamily: fonts.ui,
              fontSize: 11.5,
              lineHeight: 15,
              color: t.fg2,
              letterSpacing: -0.05,
            }}>
            {caption}
          </Text>
        ) : null}
      </View>

      {value != null ? (
        <Text
          style={{
            fontFamily: fonts.uiMed,
            fontSize: 12.5,
            color: t.fg2,
            letterSpacing: -0.1,
          }}
          numberOfLines={1}>
          {value}
        </Text>
      ) : null}

      {toggle ? (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onValueChange}
          trackColor={{ false: t.border2, true: t.accent }}
          thumbColor={t.card}
          ios_backgroundColor={t.border2}
        />
      ) : null}

      {right}

      {showChevron ? <ChevronIcon color={t.fg3} /> : null}
    </>
  );

  const shellStyle: StyleProp<ViewStyle> = [
    {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderBottomWidth: last ? 0 : 1,
      borderBottomColor: t.border,
    },
    style,
  ];

  if (!onPress) {
    return <View style={shellStyle}>{inner}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [shellStyle, { opacity: pressed ? 0.7 : 1 }]}>
      {inner}
    </Pressable>
  );
}
