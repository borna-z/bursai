// StyleChatScreen — top header bar (N13 split).
//
// Back + Eyebrow/Title + History + New-chat. Each glyph is drawn inline
// so we don't pull a fresh icon dependency just for two single-use
// hamburger-shaped affordances.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { IconBtn } from '../components/IconBtn';
import { BackIcon } from '../components/icons';
import { t as tr } from '../lib/i18n';

export function ChatHeader({
  onBack,
  onOpenHistory,
  onClearChat,
}: {
  onBack: () => void;
  onOpenHistory: () => void;
  onClearChat: () => void;
}) {
  const t = useTokens();
  return (
    <View style={[s.header, { borderBottomColor: t.border }]}>
      <IconBtn variant="ghost" onPress={onBack} ariaLabel="Back">
        <BackIcon color={t.fg} />
      </IconBtn>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Eyebrow style={{ marginBottom: 1 }}>{tr('chat.eyebrow')}</Eyebrow>
        <Text style={{ fontFamily: fonts.displayMedium, fontStyle: 'italic', fontWeight: '500', fontSize: 18, color: t.fg, letterSpacing: -0.18 }}>
          {tr('chat.title')}
        </Text>
      </View>
      {/* G1 — history affordance. Opens a side-sheet listing past chat
          threads grouped by mode. Glyph: three stacked dots + a leading
          bar (clock-without-hands feel) drawn inline. */}
      <IconBtn variant="ghost" onPress={onOpenHistory} ariaLabel={tr('chat.history.openLabel')}>
        <View
          style={{
            width: 18,
            height: 14,
            justifyContent: 'space-between',
          }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
              }}>
              <View
                style={{
                  width: 3,
                  height: 1.6,
                  backgroundColor: t.fg,
                  borderRadius: 1,
                }}
              />
              <View
                style={{
                  flex: 1,
                  height: 1.6,
                  backgroundColor: t.fg,
                  borderRadius: 1,
                  opacity: 0.55,
                }}
              />
            </View>
          ))}
        </View>
      </IconBtn>
      <IconBtn variant="ghost" onPress={onClearChat} ariaLabel="New chat">
        {/* Hamburger glyph repurposed as "new chat" — clears the active
            conversation (now persisted; the delete cascades to the row set). */}
        <View style={{ width: 18, height: 12, justifyContent: 'space-between' }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ height: 1.6, backgroundColor: t.fg, borderRadius: 1 }} />
          ))}
        </View>
      </IconBtn>
    </View>
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
});
