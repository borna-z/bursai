// StyleChatScreen — Style ↔ Shopping segmented control (N13 split, M23).
//
// Tapping a segment flips the underlying useStyleChat() mode; the hook
// aborts any in-flight stream so the next sendMessage uses the new mode
// cleanly. The active segment renders as a filled pill (fg/bg inversion)
// to match the Chip primitive's `active` palette.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { t as tr } from '../lib/i18n';
import type { StyleChatMode } from '../hooks/useStyleChat';

export function ModeToggleRow({
  currentMode,
  onSelect,
}: {
  currentMode: StyleChatMode;
  onSelect: (mode: StyleChatMode) => void;
}) {
  const t = useTokens();
  return (
    <View
      style={[
        s.modeToggleRow,
        { borderBottomColor: t.border, backgroundColor: t.bg },
      ]}>
      <ModeToggleSegment
        label={tr('shoppingChat.modeLabel.style')}
        active={currentMode === 'style'}
        onPress={() => onSelect('style')}
      />
      <ModeToggleSegment
        label={tr('shoppingChat.modeLabel.shopping')}
        active={currentMode === 'shopping'}
        onPress={() => onSelect('shopping')}
      />
    </View>
  );
}

function ModeToggleSegment({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        flex: 1,
        height: 32,
        borderRadius: radii.pill,
        backgroundColor: active ? t.fg : 'transparent',
        borderWidth: 1,
        borderColor: active ? 'transparent' : t.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
      })}>
      <Text
        style={{
          fontFamily: fonts.uiSemi,
          fontSize: 12,
          letterSpacing: -0.1,
          color: active ? t.bg : t.fg2,
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  modeToggleRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
});
