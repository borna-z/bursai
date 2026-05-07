// Style Chat — AI stylist conversation surface (M14, 8-mode contract).
//
// W4 wired SSE; M14 layers the contract end-to-end:
//   • mode pill above each assistant bubble (stylistMeta.mode → friendly label)
//   • active-look badge above the composer (current look + Clear)
//   • anchor row (long-press an assistant bubble to lock the look's main
//     piece; clear from the badge)
//   • style-memory chip row backed by `useStyleMemoryFacts`, with inline
//     "Forget" for `never_suggest_garment` chips via `useRecordMemoryEvent`
//   • hydrated history on mount (handled by useStyleChat); empty thread
//     keeps the existing welcome empty-state.
//
// Layout: top header → memory panel (collapsible) → anchor row →
// message list (FlatList, inverted) → active-look badge → suggestion chips
// → composer.
//
// Why inverted FlatList:
//   - RN keyboard handling is much smoother when the list grows from the
//     bottom up. Inverting flips the data order so item 0 is the newest
//     message at the bottom.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
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
import { useQuery } from '@tanstack/react-query';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { Caption } from '../components/Caption';
import { Chip } from '../components/Chip';
import { IconBtn } from '../components/IconBtn';
import { ShoppingResultCard } from '../components/ShoppingResultCard';
import { BackIcon, ChevronIcon } from '../components/icons';
import { useStyleChat, type ChatMessage } from '../hooks/useStyleChat';
import { useStyleMemoryFacts, type StyleMemoryFact } from '../hooks/useStyleMemoryFacts';
import { useRecordMemoryEvent } from '../hooks/useRecordMemoryEvent';
import { useAuth } from '../contexts/AuthContext';
import { SUBSCRIPTION_SENTINEL } from '../lib/edgeFunctionClient';
import { Sentry } from '../lib/sentry';
import { supabase } from '../lib/supabase';
import { hasRenderableActiveLook } from '../lib/chatActiveLook';
import { t as tr } from '../lib/i18n';
import type { StylistChatMode } from '../lib/styleChatContract';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATIC_SUGGESTIONS = [
  'What to wear today?',
  'Style me for dinner',
  'Too formal',
  'More casual',
];

// Hoisted for stable identity across renders — used by the message FlatList.
const messageKey = (m: ChatMessage) => m.id;

// Friendly labels for the 9 stylist modes. Keys mirror the
// `chat.mode.<MODE>` namespace appended to en.ts so a future translator
// pass can swap them without touching this file.
function modeLabel(mode: StylistChatMode | undefined | null): string | null {
  if (!mode) return null;
  return tr(`chat.mode.${mode}`);
}

// NOTE: Typography sizes (fontSize, lineHeight, letterSpacing) are
// hardcoded inline throughout this screen. Mobile does not yet have a
// `text` token system — every other M-wave screen uses the same inline
// pattern, and a follow-up wave will introduce typography tokens. Codex
// P2-9 acknowledged.
export function StyleChatScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const [memoryOpen, setMemoryOpen] = useState(true);
  const {
    messages,
    isStreaming,
    error,
    isHydrating,
    suggestionChips,
    activeLook,
    anchoredGarmentId,
    setAnchoredGarmentId,
    sendMessage,
    clearChat,
    stopStreaming,
    clearActiveLook,
    currentMode,
    setMode,
  } = useStyleChat();
  const { facts } = useStyleMemoryFacts();
  const forgetMutation = useRecordMemoryEvent();

  // Subscription-locked → surface the paywall via Alert. Tracking the
  // shown-once flag prevents re-firing on every render while the error
  // sentinel persists.
  const paywallShownRef = useRef(false);
  useEffect(() => {
    if (error === SUBSCRIPTION_SENTINEL && !paywallShownRef.current) {
      paywallShownRef.current = true;
      Alert.alert(
        tr('chat.error.premium.title'),
        tr('chat.error.premium.body'),
        [{ text: 'OK', style: 'default' }],
      );
    }
    if (error !== SUBSCRIPTION_SENTINEL) {
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
  // a transient failure doesn't force the user to retype.
  const lastUserMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'user') ?? null,
    [messages],
  );

  // Active-look garment titles for the badge above the composer.
  const activeLookGarmentIds = useMemo(
    () => activeLook?.active_look?.garment_ids ?? [],
    [activeLook],
  );
  // Anchor garment id collapsed into the same id-set we hydrate titles for,
  // so a single round-trip serves both surfaces.
  const titleLookupIds = useMemo(() => {
    const ids = new Set<string>(activeLookGarmentIds);
    if (anchoredGarmentId) ids.add(anchoredGarmentId);
    return Array.from(ids);
  }, [activeLookGarmentIds, anchoredGarmentId]);
  // Sort the id list before joining so the cache key is order-stable —
  // otherwise a different garment ordering in the same set would miss
  // the cache and refire the SELECT. Codex P2-5.
  const titleLookupCacheKey = useMemo(
    () => [...titleLookupIds].sort().join(','),
    [titleLookupIds],
  );
  const { data: garmentTitleRows, isFetching: garmentTitlesFetching } = useQuery({
    queryKey: ['styleChatGarmentTitles', user?.id, titleLookupCacheKey],
    enabled: !!user && titleLookupIds.length > 0,
    queryFn: async () => {
      if (!user || titleLookupIds.length === 0) return [];
      const { data, error: titleError } = await supabase
        .from('garments')
        .select('id, title')
        .in('id', titleLookupIds)
        .eq('user_id', user.id);
      if (titleError) throw titleError;
      return data ?? [];
    },
  });
  const garmentTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    (garmentTitleRows ?? []).forEach((row) => {
      if (row.id && row.title) map.set(row.id, row.title);
    });
    return map;
  }, [garmentTitleRows]);

  const activeLookTitleString = useMemo(() => {
    const titles = activeLookGarmentIds
      .map((id) => garmentTitleMap.get(id))
      .filter((s): s is string => !!s);
    return titles.join(', ');
  }, [activeLookGarmentIds, garmentTitleMap]);

  // P2-1: localized fallback (count + 'pieces') used while titles load
  // OR when none of the ids resolve. Pre-fix the badge briefly rendered
  // an empty string between paint and react-query settle, which read as
  // a layout glitch. Now we always show the count immediately and swap
  // in titles once they land.
  const activeLookCountFallback = useMemo(
    () =>
      tr('chat.active_look.fallback.template', { n: activeLookGarmentIds.length }),
    [activeLookGarmentIds.length],
  );
  const activeLookDisplayLabel =
    activeLookTitleString
    || (garmentTitlesFetching ? activeLookCountFallback : activeLookCountFallback);

  const anchoredGarmentTitle = anchoredGarmentId
    ? garmentTitleMap.get(anchoredGarmentId) ?? null
    : null;

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
    void clearChat();
    setDraft('');
  };

  // Long-press handler bound to assistant bubbles — the user explicitly
  // confirms before the anchor changes so a stray press while reading
  // doesn't quietly lock the look.
  const handleSetAnchorFromMessage = React.useCallback(
    (msg: ChatMessage) => {
      if (!msg.stylistMeta?.active_look) return;
      const candidate =
        msg.stylistMeta.active_look.anchor_garment_id
        ?? msg.stylistMeta.active_look.garment_ids?.[0]
        ?? null;
      if (!candidate) return;
      Alert.alert(
        tr('chat.anchor.set.title'),
        tr('chat.anchor.set.body'),
        [
          { text: tr('chat.anchor.set.cancel'), style: 'cancel' },
          {
            text: tr('chat.anchor.set.confirm'),
            onPress: () => setAnchoredGarmentId(candidate),
          },
        ],
      );
    },
    [setAnchoredGarmentId],
  );

  // M23 — open a shopping result's product URL in the system browser.
  // The card primitive trusts whatever URL it was handed, so this layer
  // is the URL allowlist enforcement boundary (M19 precedent — only
  // https:// links are surfaced). Linking.openURL failures fall back to
  // an inline alert so a malformed link never silently no-ops.
  const handleOpenProductLink = React.useCallback((url: string) => {
    if (typeof url !== 'string' || !url.startsWith('https://')) {
      Alert.alert(tr('shoppingChat.invalidUrl'));
      return;
    }
    Linking.openURL(url).catch((err) => {
      Sentry.withScope((s) => {
        s.setTag('mutation', 'StyleChatScreen.openProductLink');
        Sentry.captureException(err);
      });
      Alert.alert(tr('shoppingChat.invalidUrl'));
    });
  }, []);

  const handleClearActiveLook = React.useCallback(() => {
    // Local-only clear. Sending a natural-language "clear active look"
    // turn would still ship the stale active_look in the payload because
    // getLatestActiveLook walks bottom-up past empty active_looks. The
    // hook's clearActiveLook() instead stamps a wall-clock cutoff that
    // hides every prior message from the active-look derivation, so the
    // next user turn naturally won't carry a look. Codex P1-1.
    clearActiveLook();
  }, [clearActiveLook]);

  const showInlineError =
    error && error !== SUBSCRIPTION_SENTINEL ? error : null;

  // P2-4: stable renderItem reference. Inline `({item}) => <MessageItem ... />`
  // re-creates the function on every keystroke (because the screen re-renders
  // as `draft` state changes), which forces FlatList to re-mount every row's
  // cell host. The useCallback closes over `handleSetAnchorFromMessage`,
  // which is itself useCallback-stabilized on `setAnchoredGarmentId`.
  const renderMessageItem = React.useCallback(
    ({ item }: { item: ChatMessage }) => (
      <MessageItem
        msg={item}
        onLongPress={handleSetAnchorFromMessage}
        onOpenProductLink={handleOpenProductLink}
      />
    ),
    [handleSetAnchorFromMessage, handleOpenProductLink],
  );

  // Suggestion chips: server-provided takes precedence over the static fallback.
  const visibleSuggestions = suggestionChips.length > 0
    ? suggestionChips
    : STATIC_SUGGESTIONS;

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
            <Eyebrow style={{ marginBottom: 1 }}>{tr('chat.eyebrow')}</Eyebrow>
            <Text style={{ fontFamily: fonts.displayMedium, fontStyle: 'italic', fontWeight: '500', fontSize: 18, color: t.fg, letterSpacing: -0.18 }}>
              {tr('chat.title')}
            </Text>
          </View>
          <IconBtn variant="ghost" onPress={handleClear} ariaLabel="New chat">
            {/* Hamburger glyph repurposed as "new chat" — clears the active
                conversation (now persisted; the delete cascades to the row set). */}
            <View style={{ width: 18, height: 12, justifyContent: 'space-between' }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ height: 1.6, backgroundColor: t.fg, borderRadius: 1 }} />
              ))}
            </View>
          </IconBtn>
        </View>

        {/* ============ MODE TOGGLE (M23) ============ */}
        {/* Style ↔ Shopping segmented control. Tapping a segment flips
            the underlying useStyleChat() mode; the hook aborts any
            in-flight stream so the next sendMessage uses the new mode
            cleanly. The active segment renders as a filled pill (fg/bg
            inversion) to match the Chip primitive's `active` palette. */}
        <View
          style={[
            s.modeToggleRow,
            { borderBottomColor: t.border, backgroundColor: t.bg },
          ]}>
          <ModeToggleSegment
            label={tr('shoppingChat.modeLabel.style')}
            active={currentMode === 'style'}
            onPress={() => setMode('style')}
          />
          <ModeToggleSegment
            label={tr('shoppingChat.modeLabel.shopping')}
            active={currentMode === 'shopping'}
            onPress={() => setMode('shopping')}
          />
        </View>

        {/* ============ MEMORY PANEL ============ */}
        {memoryOpen ? (
          <View style={[s.memoryPanel, { borderBottomColor: t.border, backgroundColor: t.card }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Eyebrow>{tr('chat.memory.section_title')}</Eyebrow>
              <Pressable onPress={() => setMemoryOpen(false)} style={{ paddingHorizontal: 4 }} accessibilityRole="button" accessibilityLabel="Hide style memory">
                <Text style={{ fontFamily: fonts.uiMed, fontSize: 11.5, color: t.accent }}>{tr('chat.memory.toggle.hide')}</Text>
              </Pressable>
            </View>
            {facts.length === 0 ? (
              <Caption style={{ color: t.fg3 }}>{tr('chat.memory.empty')}</Caption>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {facts.map((fact) => (
                  <MemoryChipRow
                    key={fact.id}
                    fact={fact}
                    onForget={() => {
                      if (!fact.garmentId) return;
                      forgetMutation.mutate({
                        kind: 'never_suggest_garment',
                        garmentId: fact.garmentId,
                        source: 'StyleChat:chip',
                      });
                    }}
                  />
                ))}
              </View>
            )}
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
            <Eyebrow>{tr('chat.memory.section_title')}</Eyebrow>
            <Text style={{ fontFamily: fonts.uiMed, fontSize: 11.5, color: t.accent }}>{tr('chat.memory.toggle.show')}</Text>
          </Pressable>
        )}

        {/* ============ ANCHOR ROW ============ */}
        {anchoredGarmentId && anchoredGarmentTitle ? (
          <View style={[s.anchorRow, { borderBottomColor: t.border, backgroundColor: t.bg }]}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Eyebrow>{tr('chat.anchor.title')}</Eyebrow>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: fonts.uiMed,
                  fontSize: 12.5,
                  color: t.fg,
                  letterSpacing: -0.1,
                  flex: 1,
                }}>
                {anchoredGarmentTitle}
              </Text>
            </View>
            <IconBtn
              variant="ghost"
              size={28}
              onPress={() => setAnchoredGarmentId(null)}
              ariaLabel={tr('chat.anchor.clear')}>
              <Text style={{ fontFamily: fonts.uiMed, fontSize: 14, color: t.fg2 }}>×</Text>
            </IconBtn>
          </View>
        ) : null}

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
                  {tr('chat.error.retry')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* ============ MESSAGE LIST (FlatList inverted) ============ */}
        {isHydrating ? (
          <View style={s.emptyShell}>
            <ActivityIndicator color={t.accent} />
          </View>
        ) : messages.length === 0 ? (
          <View style={s.emptyShell}>
            <Eyebrow>{tr('chat.empty.title')}</Eyebrow>
            <Caption style={{ marginTop: 6, textAlign: 'center', maxWidth: 240 }}>
              {user
                ? tr('chat.empty.subtitle.auth')
                : tr('chat.empty.subtitle.unauth')}
            </Caption>
          </View>
        ) : (
          <FlatList
            data={reversed}
            keyExtractor={messageKey}
            inverted
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 8 }}
            renderItem={renderMessageItem}
          />
        )}

        {/* ============ ACTIVE-LOOK BADGE ============ */}
        {activeLook && hasRenderableActiveLook(activeLook) ? (
          <View style={[s.activeLookBar, { borderTopColor: t.border, backgroundColor: t.card }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Eyebrow>{tr('chat.active_look.title')}</Eyebrow>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: fonts.uiMed,
                  fontSize: 12.5,
                  color: t.fg,
                  letterSpacing: -0.1,
                }}>
                {activeLookDisplayLabel}
              </Text>
            </View>
            <IconBtn
              variant="ghost"
              size={28}
              onPress={handleClearActiveLook}
              ariaLabel={tr('chat.active_look.clear')}>
              <Text style={{ fontFamily: fonts.uiMed, fontSize: 12, color: t.accent }}>
                {tr('chat.active_look.clear')}
              </Text>
            </IconBtn>
          </View>
        ) : null}

        {/* ============ SUGGESTION CHIPS ============ */}
        <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}>
            {visibleSuggestions.map((sug) => (
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
              placeholder={tr('chat.composer.placeholder')}
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

// Memory chip — single fact in the style-memory panel. Only
// `never_suggest_garment` chips can be forgotten today (Phase C scope);
// other signal kinds render as read-only with an explanatory alert if
// the user taps the disabled action so they understand why.
function MemoryChipRow({
  fact,
  onForget,
}: {
  fact: StyleMemoryFact;
  onForget: () => void;
}) {
  const t = useTokens();
  const canForget = fact.signalKind === 'never_suggest_garment' && !!fact.garmentId;
  const handlePress = () => {
    if (!canForget) {
      Alert.alert(
        tr('chat.memory.disabled.title'),
        tr('chat.memory.disabled.body'),
        [{ text: 'OK', style: 'default' }],
      );
      return;
    }
    Alert.alert(
      tr('chat.memory.confirm.title'),
      tr('chat.memory.confirm.body.template', { label: fact.label }),
      [
        { text: tr('chat.anchor.set.cancel'), style: 'cancel' },
        { text: tr('chat.memory.forget_action'), onPress: onForget, style: 'destructive' },
      ],
    );
  };
  return (
    // P2-3: a single onPress is enough — long-press fired the same handler
    // before, which made every chip act like a long-press target with no
    // alternative. Drop onLongPress entirely.
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Style memory chip: ${fact.label}`}
      style={({ pressed }) => ({
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radii.pill,
        backgroundColor: t.accentSoft,
        opacity: pressed ? 0.78 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      })}>
      <Text
        style={{
          fontFamily: fonts.uiMed,
          fontSize: 11,
          color: t.accent,
          letterSpacing: -0.1,
        }}>
        {fact.label}
      </Text>
      {canForget ? (
        <Text style={{ fontFamily: fonts.uiMed, fontSize: 11, color: t.accent, opacity: 0.55 }}>
          ×
        </Text>
      ) : null}
    </Pressable>
  );
}

// Message bubble — inline so styling stays close to the parent context.
// Bubble has 18px radius with one corner squared to point toward the
// speaker (4px radius on speaker-side). Streaming assistant bubbles with
// no content yet show an animated three-dot indicator.
//
// M14: assistant bubbles render a mode-pill above the text when the
// envelope carries a recognised mode, and long-press triggers the anchor
// confirm dialog when an active-look is present.
//
// Memoized on (id, content, isStreaming, stylistMeta.mode) so the FlatList
// doesn't re-render every visible message on every SSE delta — only the
// streaming bubble at the bottom invalidates per chunk.
const MessageItem = React.memo(
  function MessageItem({
    msg,
    onLongPress,
    onOpenProductLink,
  }: {
    msg: ChatMessage;
    onLongPress: (msg: ChatMessage) => void;
    // M23 — invoked when the user taps the Open button on any
    // ShoppingResultCard rendered beneath this assistant bubble.
    onOpenProductLink: (url: string) => void;
  }) {
    const t = useTokens();
    const isUser = msg.role === 'user';
    const showTypingDots = msg.isStreaming && !msg.content;
    const mode = !isUser ? modeLabel(msg.stylistMeta?.mode) : null;
    // Synthesized SHOPPING envelopes carry a non-null `active_look` with
    // an empty `garment_ids: []`, so a Boolean() check alone returns true
    // and the screen-reader announces the long-press anchor hint even
    // though the underlying handler early-returns. Gate on a non-empty
    // garment_ids list so the gesture surface only advertises when there
    // is actually something to anchor.
    const canAnchor =
      !isUser &&
      Boolean(msg.stylistMeta?.active_look) &&
      (msg.stylistMeta?.active_look?.garment_ids?.length ?? 0) > 0;
    // M23 — shopping result cards rendered beneath the bubble. Defensive
    // accessor: the contract field is optional, may be absent or null,
    // and parseShoppingResultCards already filtered malformed entries
    // upstream.
    const shoppingCards =
      !isUser && msg.stylistMeta?.shopping_results
        ? msg.stylistMeta.shopping_results
        : null;

    const handleLongPress = () => {
      if (canAnchor) onLongPress(msg);
    };

    return (
      <View
        style={{
          alignSelf: isUser ? 'flex-end' : 'flex-start',
          maxWidth: '82%',
          gap: 8,
        }}>
        <Pressable
          onLongPress={handleLongPress}
          delayLongPress={400}
          disabled={!canAnchor}
          accessibilityHint={canAnchor ? tr('chat.anchor.gesture.hint') : undefined}>
          {mode ? (
            <Eyebrow style={{ marginBottom: 4, marginLeft: 4 }}>{mode}</Eyebrow>
          ) : null}
          <View
            style={{
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
        </Pressable>
        {/* M23 — render product cards beneath the regular text bubble.
            Each card has a stable key from the server-issued `id`. */}
        {shoppingCards && shoppingCards.length > 0 ? (
          <View style={{ gap: 8 }}>
            {shoppingCards.map((card) => (
              <ShoppingResultCard
                key={card.id}
                card={card}
                onOpen={onOpenProductLink}
              />
            ))}
          </View>
        ) : null}
      </View>
    );
  },
  (a, b) =>
    a.msg.id === b.msg.id
    && a.msg.content === b.msg.content
    && a.msg.isStreaming === b.msg.isStreaming
    && a.msg.stylistMeta?.mode === b.msg.stylistMeta?.mode
    // M23 — re-render when the shopping_results array identity changes
    // (rAF-coalesced flushes mutate-then-replace; the array ref
    // changes when new cards land, the count comparison is a fast
    // shallow check before falling back to ref equality).
    && a.msg.stylistMeta?.shopping_results === b.msg.stylistMeta?.shopping_results
    && a.onLongPress === b.onLongPress
    && a.onOpenProductLink === b.onOpenProductLink,
);

// M23 — Mode toggle segment. Mirrors the Chip primitive's active palette
// (fg/bg inversion) inline so the segmented control reads as a single
// pill instead of two separate chips. Inline because StyleChatScreen
// already inlines small primitives (MemoryChipRow, TypingDots).
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
  modeToggleRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
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
  anchorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  activeLookBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
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
