// ChatHistorySheet — modal listing the user's past chat threads grouped
// by mode + last-activity date. Mirrors web's
// `src/components/chat/ChatHistorySheet.tsx` shape (per-mode threads
// rather than per-session) since the chat_messages table only carries a
// `mode` column today, not a thread id.
//
// Triggered from StyleChatScreen's header history icon. Tapping a thread
// row calls `onSelect(mode)` which the screen pipes into setMode() —
// the existing per-mode hydration covers the message restore.
//
// Mobile bottom-sheet pattern (per `mobile/CLAUDE.md` lines 90–93):
// React Native Modal + Animated. The screen surface today does NOT use
// @gorhom/bottom-sheet for any feature, so staying with Modal keeps the
// component dependency-free and matches the style used by SettingsRow's
// confirm dialogs and GarmentSaveChoiceSheet.

import React, { useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Eyebrow } from '../Eyebrow';
import { Caption } from '../Caption';
import { IconBtn } from '../IconBtn';
import { TrashIcon } from '../icons';
import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import type { StyleChatMode } from '../../hooks/useStyleChat';
import { t as tr } from '../../lib/i18n';
import { showToast } from '../../lib/toast';

export interface ChatHistoryThread {
  /** Persisted mode value — drives both the visible badge label and the
   *  mode the screen flips to on tap. */
  mode: StyleChatMode;
  /** First user message snippet — shown as the row preview line. Empty
   *  string when the thread has only assistant turns (a server-pushed
   *  greeting or similar). */
  preview: string;
  /** ISO timestamp of the most recent message in the thread. Used for
   *  the relative-date label and for sorting threads top-down. */
  updatedAt: string;
  /** Total message count — surfaced as a tertiary hint so the user can
   *  gauge how long a thread is before tapping in. */
  messageCount: number;
}

interface ChatHistorySheetProps {
  open: boolean;
  onClose: () => void;
  threads: ChatHistoryThread[];
  activeMode: StyleChatMode;
  isLoading: boolean;
  onSelect: (mode: StyleChatMode) => void;
  /** Parity-C — invoked when the user confirms a trash-tap on a row.
   *  Caller wires this to `useDeleteChatThread` + clears the in-memory
   *  message cache so the parent screen reflects the deletion. The sheet
   *  itself handles the confirm Alert; the caller only needs to perform
   *  the actual delete. */
  onDeleteThread?: (mode: StyleChatMode) => Promise<void>;
  /** Set of modes with in-flight delete mutations; rows in this set
   *  disable their trash button + go semi-transparent. */
  deletingModes?: Set<StyleChatMode>;
}

const MODE_LABELS: Record<StyleChatMode, () => string> = {
  style: () => tr('chat.modeToggle.style'),
  shopping: () => tr('chat.modeToggle.shopping'),
};

function formatThreadDate(value: string): string {
  // Intl.DateTimeFormat is available in Hermes; the locale of the
  // device kicks in automatically so a user on Swedish locale gets
  // Swedish month abbreviations without an explicit pass-through.
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    // Hermes fall-through (older builds without Intl): use a tiny
    // locale-agnostic fallback.
    return date.toISOString().slice(0, 10);
  }
}

export function ChatHistorySheet({
  open,
  onClose,
  threads,
  activeMode,
  isLoading,
  onSelect,
  onDeleteThread,
  deletingModes,
}: ChatHistorySheetProps) {
  const t = useTokens();
  // Slide-in animation from the right. Same pattern the share sheet
  // and outfit detail confirm modals use elsewhere in the app.
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(slide, {
      toValue: open ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [open, slide]);

  const sortedThreads = useMemo(() => {
    return [...threads].sort((a, b) => {
      const ta = new Date(a.updatedAt).getTime();
      const tb = new Date(b.updatedAt).getTime();
      if (tb !== ta) return tb - ta;
      // Stable secondary sort by mode so two threads with identical
      // updatedAt timestamps don't flicker between renders. Mode is the
      // FlatList keyExtractor, so it's also guaranteed unique within
      // this list.
      return a.mode.localeCompare(b.mode);
    });
  }, [threads]);

  const handleDeletePress = (mode: StyleChatMode) => {
    if (!onDeleteThread) return;
    Alert.alert(
      tr('chat.history.delete.confirm.title'),
      tr('chat.history.delete.confirm.body'),
      [
        { text: tr('chat.history.delete.confirm.cancel'), style: 'cancel' },
        {
          text: tr('chat.history.delete.confirm.delete'),
          style: 'destructive',
          onPress: () => {
            onDeleteThread(mode).catch((err) => {
              showToast(
                'error',
                tr('chat.history.delete.failed.title'),
                err instanceof Error ? err.message : String(err),
              );
            });
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: ChatHistoryThread }) => {
    const selected = item.mode === activeMode;
    const modeLabel = MODE_LABELS[item.mode]?.() ?? item.mode;
    const deleting = deletingModes?.has(item.mode) ?? false;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 6 }}>
        <Pressable
          onPress={() => onSelect(item.mode)}
          accessibilityRole="button"
          accessibilityState={{ selected, disabled: deleting }}
          accessibilityLabel={`${modeLabel} chat — ${item.messageCount} messages`}
          disabled={deleting}
          style={({ pressed }) => [
            s.row,
            {
              flex: 1,
              backgroundColor: selected ? t.bg2 : 'transparent',
              opacity: deleting ? 0.5 : pressed ? 0.7 : 1,
              borderColor: t.border,
            },
          ]}>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={[
                  s.modeBadge,
                  {
                    borderColor: selected ? t.accent : t.border,
                    backgroundColor: selected ? t.accentSoft : t.card,
                  },
                ]}>
                <Text
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 9.5,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    color: selected ? t.accent : t.fg2,
                  }}>
                  {modeLabel}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: fonts.uiMed,
                  fontSize: 11,
                  color: t.fg3,
                }}>
                {formatThreadDate(item.updatedAt)}
              </Text>
            </View>
            <Text
              numberOfLines={2}
              style={{
                fontFamily: fonts.ui,
                fontSize: 13,
                lineHeight: 18,
                color: t.fg,
                letterSpacing: -0.1,
              }}>
              {item.preview || tr('chat.history.previewEmpty')}
            </Text>
            <Text
              style={{
                fontFamily: fonts.ui,
                fontSize: 11,
                color: t.fg3,
              }}>
              {tr('chat.history.messageCount.template', { n: item.messageCount })}
            </Text>
          </View>
        </Pressable>
        {onDeleteThread ? (
          <IconBtn
            variant="ghost"
            onPress={deleting ? undefined : () => handleDeletePress(item.mode)}
            ariaLabel={tr('chat.history.delete.action')}
            style={{ opacity: deleting ? 0.5 : 1 }}>
            <TrashIcon color={t.fg2} size={18} />
          </IconBtn>
        ) : null}
      </View>
    );
  };

  // Translate the slide value into a horizontal offset. The sheet
  // covers the full height + ~86% of the width so the right edge stays
  // tappable as a manual dismiss target (in addition to the explicit
  // close button).
  const translateX = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={onClose}>
      <View style={[s.scrim, { backgroundColor: t.scrim }]}>
        {/* Tappable backdrop — closes the sheet without committing a
            selection. Pressable rather than Pressable.opacity so VoiceOver
            announces the dismiss target. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('chat.history.close')}
          onPress={onClose}
          style={s.scrimBackdrop}
        />
        <Animated.View
          style={[
            s.sheet,
            {
              backgroundColor: t.bg,
              borderLeftColor: t.border,
              transform: [{ translateX }],
            },
          ]}>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            <View style={[s.header, { borderBottomColor: t.border }]}>
              <View style={{ flex: 1 }}>
                <Eyebrow>{tr('chat.history.eyebrow')}</Eyebrow>
                <Text
                  style={{
                    fontFamily: fonts.displayMedium,
                    fontStyle: 'italic',
                    fontWeight: '500',
                    fontSize: 20,
                    color: t.fg,
                    letterSpacing: -0.18,
                    marginTop: 2,
                  }}>
                  {tr('chat.history.title')}
                </Text>
              </View>
              <IconBtn
                variant="ghost"
                onPress={onClose}
                ariaLabel={tr('chat.history.close')}>
                <Text
                  style={{
                    fontFamily: fonts.uiMed,
                    fontSize: 18,
                    color: t.fg2,
                  }}>
                  ×
                </Text>
              </IconBtn>
            </View>

            {isLoading ? (
              <View style={s.empty}>
                <Caption style={{ color: t.fg3 }}>{tr('chat.history.loading')}</Caption>
              </View>
            ) : sortedThreads.length === 0 ? (
              <View style={s.empty}>
                <Caption style={{ color: t.fg3, textAlign: 'center' }}>
                  {tr('chat.history.empty')}
                </Caption>
              </View>
            ) : (
              <FlatList
                data={sortedThreads}
                keyExtractor={(thread) => thread.mode}
                contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12, gap: 6 }}
                renderItem={renderItem}
              />
            )}
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: {
    flex: 1,
    flexDirection: 'row',
  },
  scrimBackdrop: {
    flex: 1,
  },
  sheet: {
    width: '86%',
    maxWidth: 420,
    borderLeftWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 10,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
