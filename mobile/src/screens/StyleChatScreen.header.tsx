// StyleChatScreen — top header bar.
//
// Back + Eyebrow/Title + a single hamburger menu. The menu opens a Modal
// sheet with "Open history" + "Start new chat" actions; deleting individual
// past threads is handled inside ChatHistorySheet itself (per-row trash).
//
// Pre-parity-C this header carried TWO icons (history glyph + hamburger),
// where the hamburger doubled as "clear chat". User feedback called this
// confusing — both icons looked similar and the meaning of each wasn't
// discoverable. Consolidating mirrors web (`src/pages/AIChat.tsx:1250-1294`)
// which uses one dropdown for History + New chat + Clear.

import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { IconBtn } from '../components/IconBtn';
import { BackIcon } from '../components/icons';
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
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

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
        onPress={() => setMenuOpen(true)}
        ariaLabel={tr('chat.menu.openLabel')}>
        <View style={{ width: 18, height: 14, justifyContent: 'space-between' }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{ height: 1.6, backgroundColor: t.fg, borderRadius: 1 }}
            />
          ))}
        </View>
      </IconBtn>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}>
        <Pressable
          style={s.menuBackdrop}
          onPress={closeMenu}
          accessible={false}>
          <View />
        </Pressable>
        {/* Include the top edge so the menu sits below the status-bar/notch inset
            on every device. Without 'top' the absolute-positioned anchor measured
            marginTop:56 from the physical top of the window, which on notched
            devices put the menu under the status bar (Codex P2). */}
        <SafeAreaView edges={['top', 'bottom']} style={s.menuAnchor} pointerEvents="box-none">
          <View
            style={[
              s.menuCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
            pointerEvents="auto">
            <ChatMenuItem
              label={tr('chat.menu.history')}
              onPress={() => {
                closeMenu();
                onOpenHistory();
              }}
            />
            <View style={[s.menuSep, { backgroundColor: t.border }]} />
            <ChatMenuItem
              label={tr('chat.menu.newChat')}
              onPress={() => {
                closeMenu();
                onNewChat();
              }}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function ChatMenuItem({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        s.menuItem,
        { opacity: pressed ? 0.7 : 1 },
      ]}>
      <Text
        style={{
          fontFamily: fonts.uiSemi,
          fontSize: 14,
          color: t.fg,
          letterSpacing: -0.14,
        }}>
        {label}
      </Text>
    </Pressable>
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
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  menuAnchor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  menuCard: {
    marginTop: 56,
    marginRight: 12,
    alignSelf: 'flex-end',
    minWidth: 200,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuSep: {
    height: 1,
  },
});
