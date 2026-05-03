// Style Chat — AI stylist conversation surface.
// W4: wired to the real `style_chat` edge function via useStyleChat (SSE
// streaming). The screen hydrates from a fresh empty conversation each
// mount; persistent chat sessions land in a future wave.
//
// Layout: top header (back · "AI" + "Style Chat" · clear button) →
// memory panel (collapsible chip row showing remembered facts + Edit) →
// message list (FlatList, inverted, keeps newest at the bottom and scrolls
// correctly with the keyboard) → suggestion chip row → composer.
//
// Why inverted FlatList:
//   - RN's keyboard handling is much smoother when the list grows from the
//     bottom up. Inverting flips the data order so item 0 is the newest
//     message at the bottom.
//   - We render the messages array in REVERSE chronological order (newest
//     first) so the inverted list visually places the newest at the bottom.
// KeyboardAvoidingView wraps the screen so the composer + last messages stay
// visible when the keyboard rises. iOS uses `padding`, Android uses `height`
// per the standard RN guidance.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { Caption } from '../components/Caption';
import { Chip } from '../components/Chip';
import { IconBtn } from '../components/IconBtn';
import { BackIcon, ChevronIcon } from '../components/icons';
import { useStyleChat, type ChatMessage } from '../hooks/useStyleChat';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const SUGGESTIONS = [
  'What to wear today?',
  'Style me for dinner',
  'Too formal',
  'More casual',
];

const MEMORY_FACTS = [
  'Editorial · earth tones',
  'Top M · Bottom 32',
  'Avoids loud prints',
];

export function StyleChatScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [draft, setDraft] = useState('');
  const [memoryOpen, setMemoryOpen] = useState(true);
  const { messages, isStreaming, error, sendMessage, clearChat, stopStreaming } =
    useStyleChat();

  // Subscription-locked → surface the paywall via Alert. Tracking the
  // shown-once flag prevents re-firing on every render while the error
  // sentinel persists.
  const paywallShownRef = useRef(false);
  useEffect(() => {
    if (error === 'subscription_required' && !paywallShownRef.current) {
      paywallShownRef.current = true;
      Alert.alert(
        'Premium feature',
        'Style Chat is part of BURS Premium. Upgrade to keep talking with your stylist.',
        [{ text: 'OK', style: 'default' }],
      );
    }
    if (error !== 'subscription_required') {
      paywallShownRef.current = false;
    }
  }, [error]);

  // Cancel any in-flight stream when the user navigates away — prevents
  // setState on unmounted component.
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, [stopStreaming]);

  // Track the suggestion-chip auto-send timer so we can cancel it on unmount.
  const sendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (sendTimerRef.current) {
        clearTimeout(sendTimerRef.current);
        sendTimerRef.current = null;
      }
    },
    [],
  );

  // Inverted FlatList expects newest-first ordering. Reversing without
  // mutating the underlying array via slice().reverse().
  const reversed = useMemo(() => messages.slice().reverse(), [messages]);

  // Most recent user turn — used by the inline error banner's Retry pill so
  // a transient failure doesn't force the user to retype. Codex audit P1-5
  // (audit 3).
  const lastUserMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'user') ?? null,
    [messages],
  );

  const handleSend = () => {
    if (!draft.trim() || isStreaming) return;
    void sendMessage(draft);
    setDraft('');
  };

  const handleSuggestion = React.useCallback(
    (text: string) => {
      if (isStreaming) return;
      setDraft(text);
      if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
      sendTimerRef.current = setTimeout(() => {
        sendTimerRef.current = null;
        void sendMessage(text);
        setDraft('');
      }, 150);
    },
    [sendMessage, isStreaming],
  );

  const handleClear = () => {
    clearChat();
    setDraft('');
  };

  const showInlineError =
    error && error !== 'subscription_required' ? error : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}>

        {/* ============ HEADER ============ */}
        <View style={[s.header, { borderBottomColor: t.border }]}>
          <IconBtn variant="ghost" onPress={() => nav.goBack()} ariaLabel="Back">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Eyebrow style={{ marginBottom: 1 }}>AI</Eyebrow>
            <Text style={{ fontFamily: fonts.displayMedium, fontStyle: 'italic', fontWeight: '500', fontSize: 18, color: t.fg, letterSpacing: -0.18 }}>
              Style Chat
            </Text>
          </View>
          <IconBtn variant="ghost" onPress={handleClear} ariaLabel="New chat">
            {/* Hamburger glyph repurposed as "new chat" — clears the active
                conversation. Persistent history lives in a future wave. */}
            <View style={{ width: 18, height: 12, justifyContent: 'space-between' }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ height: 1.6, backgroundColor: t.fg, borderRadius: 1 }} />
              ))}
            </View>
          </IconBtn>
        </View>

        {/* ============ MEMORY PANEL ============ */}
        {memoryOpen ? (
          <View style={[s.memoryPanel, { borderBottomColor: t.border, backgroundColor: t.card }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Eyebrow>Style memory</Eyebrow>
              <Pressable onPress={() => setMemoryOpen(false)} style={{ paddingHorizontal: 4 }} accessibilityRole="button" accessibilityLabel="Hide style memory">
                <Text style={{ fontFamily: fonts.uiMed, fontSize: 11.5, color: t.accent }}>Hide</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {MEMORY_FACTS.map((fact) => (
                <View
                  key={fact}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: radii.pill,
                    backgroundColor: t.accentSoft,
                  }}>
                  <Text style={{ fontFamily: fonts.uiMed, fontSize: 11, color: t.accent, letterSpacing: -0.1 }}>
                    {fact}
                  </Text>
                </View>
              ))}
              <Pressable
                onPress={() =>
                  Alert.alert('Coming soon', 'Style memory editing coming soon.')
                }
                accessibilityRole="button"
                accessibilityLabel="Edit style memory"
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  borderColor: t.border,
                }}>
                <Text style={{ fontFamily: fonts.uiMed, fontSize: 11, color: t.fg2, letterSpacing: -0.1 }}>
                  Edit
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setMemoryOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Show style memory"
            style={({ pressed }) => [
              s.memoryRailRow,
              { borderBottomColor: t.border, backgroundColor: t.bg, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Eyebrow>Style memory</Eyebrow>
            <Text style={{ fontFamily: fonts.uiMed, fontSize: 11.5, color: t.accent }}>Show</Text>
          </Pressable>
        )}

        {/* ============ ERROR BANNER ============ */}
        {showInlineError ? (
          <View
            style={[
              s.errorBanner,
              { borderBottomColor: t.border, backgroundColor: t.bg2 },
            ]}>
            <Caption style={{ color: t.fg2, flex: 1 }}>{showInlineError}</Caption>
            {lastUserMessage ? (
              <Pressable
                onPress={() => {
                  if (isStreaming) return;
                  void sendMessage(lastUserMessage.content);
                }}
                accessibilityRole="button"
                accessibilityLabel="Retry last message"
                style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ fontFamily: fonts.uiMed, fontSize: 12, color: t.accent }}>
                  Retry
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* ============ MESSAGE LIST (FlatList inverted) ============ */}
        {messages.length === 0 ? (
          <View style={s.emptyShell}>
            <Eyebrow>Start a conversation</Eyebrow>
            <Caption style={{ marginTop: 6, textAlign: 'center', maxWidth: 240 }}>
              Ask your stylist anything — outfit picks, packing lists, what fits the weather.
            </Caption>
          </View>
        ) : (
          <FlatList
            data={reversed}
            keyExtractor={(m) => m.id}
            inverted
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 8 }}
            renderItem={({ item }) => <MessageItem msg={item} />}
          />
        )}

        {/* ============ SUGGESTION CHIPS ============ */}
        <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}>
            {SUGGESTIONS.map((sug) => (
              <Chip
                key={sug}
                label={sug}
                onPress={() => handleSuggestion(sug)}
              />
            ))}
          </ScrollView>
        </View>

        {/* ============ COMPOSER ============ */}
        <View style={[s.composer, { borderTopColor: t.border, backgroundColor: t.bg }]}>
          <View
            style={[
              s.inputPill,
              { backgroundColor: t.card, borderColor: t.border },
            ]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask your stylist…"
              placeholderTextColor={t.fg3}
              editable={!isStreaming}
              multiline
              style={{
                flex: 1,
                fontFamily: fonts.ui,
                fontSize: 14,
                color: t.fg,
                paddingVertical: 8,
                paddingHorizontal: 4,
                maxHeight: 100,
              }}
            />
          </View>
          <Pressable
            onPress={handleSend}
            disabled={!draft.trim() || isStreaming}
            accessibilityRole="button"
            accessibilityLabel={isStreaming ? 'Sending' : 'Send'}
            accessibilityState={{ disabled: !draft.trim() || isStreaming, busy: isStreaming }}
            style={({ pressed }) => [
              s.sendBtn,
              {
                backgroundColor: draft.trim() && !isStreaming ? t.accent : t.bg2,
                opacity: pressed ? 0.85 : 1,
              },
            ]}>
            {isStreaming ? (
              <ActivityIndicator size="small" color={t.accentFg} />
            ) : (
              <ChevronIcon color={draft.trim() ? t.accentFg : t.fg3} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Message bubble — inline so styling stays close to the parent context.
// Bubble has 18px radius with one corner squared to point toward the
// speaker (4px radius on speaker-side). Streaming assistant bubbles with
// no content yet show an animated three-dot indicator.
//
// Memoized on (id, content, isStreaming) so the FlatList doesn't re-render
// every visible message on every SSE delta — only the streaming bubble at
// the bottom invalidates per chunk. Codex audit P2-2 (audit 3).
const MessageItem = React.memo(
  function MessageItem({ msg }: { msg: ChatMessage }) {
    const t = useTokens();
    const isUser = msg.role === 'user';
    const showTypingDots = msg.isStreaming && !msg.content;

    return (
      <View
        style={{
          alignSelf: isUser ? 'flex-end' : 'flex-start',
          maxWidth: '82%',
          paddingHorizontal: 14,
          paddingVertical: 10,
          backgroundColor: isUser ? t.fg : t.card,
          borderRadius: 18,
          borderBottomRightRadius: isUser ? 4 : 18,
          borderBottomLeftRadius: isUser ? 18 : 4,
          borderWidth: isUser ? 0 : 1,
          borderColor: t.border,
        }}>
        {showTypingDots ? (
          <TypingDots color={t.fg2} />
        ) : (
          <Text
            style={{
              fontFamily: fonts.ui,
              fontSize: 13.5,
              lineHeight: 19,
              color: isUser ? t.bg : t.fg,
              letterSpacing: -0.13,
            }}>
            {msg.content}
            {msg.isStreaming && msg.content ? (
              <Text style={{ color: t.fg3 }}> ▋</Text>
            ) : null}
          </Text>
        )}
      </View>
    );
  },
  (a, b) =>
    a.msg.id === b.msg.id
    && a.msg.content === b.msg.content
    && a.msg.isStreaming === b.msg.isStreaming,
);

// Three-dot typing indicator. Uses simple opacity cycling rather than a
// full Animated.loop so the assistant bubble doesn't pay the cost of a
// running spring during a normal text response.
function TypingDots({ color }: { color: string }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 3), 350);
    return () => clearInterval(id);
  }, []);
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel="Stylist is typing"
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', gap: 4, paddingVertical: 4 }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: color,
            opacity: tick === i ? 0.95 : 0.35,
          }}
        />
      ))}
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
  memoryPanel: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  memoryRailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  emptyShell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 6,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
  },
  inputPill: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
