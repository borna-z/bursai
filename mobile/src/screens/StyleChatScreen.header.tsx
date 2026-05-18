// StyleChatScreen — top header bar.
//
// Back + Eyebrow/Title + History glyph + Plus (new chat) button. Two
// dedicated buttons replaced the prior history-glyph + hamburger-with-
// dropdown pattern (Codex-style menu was confusing — two near-identical
// glyphs both led to History). Per direct user request 2026-05-19: keep
// the history glyph for history, surface "new chat" as a top-right "+"
// so users find it without first opening a hidden dropdown.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { IconBtn } from '../components/IconBtn';
import { BackIcon, PlusIcon } from '../components/icons';
import { t as tr } from '../lib/i18n';

export function ChatHeader({
  onBack,
  onOpenHistory,
  onNewChat,
}: {
  onBack: () => void;
  onOpenHistory: () => void;
  /** Starts a new chat — clears the current persisted thread + local state.
   *  Named for the user-facing action; the implementation in the hook is
   *  still `clearChat()`. */
  onNewChat: () => void;
}) {
  const t = useTokens();

  return (
    <View style={[s.header, { borderBottomColor: t.border }]}>
      <IconBtn variant="ghost" onPress={onBack} ariaLabel="Back">
        <BackIcon color={t.fg} />
      </IconBtn>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Eyebrow style={{ marginBottom: 1 }}>{tr('chat.eyebrow')}</Eyebrow>
        <Text
          style={{
            fontFamily: fonts.displayMedium,
            fontStyle: 'italic',
            fontWeight: '500',
            fontSize: 18,
            color: t.fg,
            letterSpacing: -0.18,
          }}>
          {tr('chat.title')}
        </Text>
      </View>
      <IconBtn
        variant="ghost"
        onPress={onOpenHistory}
        ariaLabel={tr('chat.history.openLabel')}>
        <View style={{ width: 18, height: 14, justifyContent: 'center' }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                height: 1.6,
                backgroundColor: t.fg,
                borderRadius: 1,
                marginVertical: 1.6,
                width: i === 0 ? 18 : i === 1 ? 14 : 10,
              }}
            />
          ))}
        </View>
      </IconBtn>
      <IconBtn
        variant="ghost"
        onPress={onNewChat}
        ariaLabel={tr('chat.menu.newChat')}>
        <PlusIcon size={20} color={t.fg} />
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
