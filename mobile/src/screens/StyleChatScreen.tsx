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
// N13 split — sub-components live in sibling files:
//   StyleChatScreen.helpers.ts, .messageItem.tsx, .modeToggle.tsx,
//   .memoryPanel.tsx, .header.tsx, .composer.tsx
// This file is the orchestrator: useStyleChat plumbing + side effects +
// layout.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { Caption } from '../components/Caption';
import { IconBtn } from '../components/IconBtn';
import { ChatHistorySheet } from '../components/chat/ChatHistorySheet';
import { useStyleChat, type ChatMessage, type StyleChatMode } from '../hooks/useStyleChat';
import { useChatHistory, useDeleteChatThread } from '../hooks/useChatHistory';
import { usePersistGeneratedOutfit } from '../hooks/useOutfits';
import { showToast } from '../lib/toast';
import { useStyleMemoryFacts, type StyleMemoryFact } from '../hooks/useStyleMemoryFacts';
import { useRecordMemoryEvent } from '../hooks/useRecordMemoryEvent';
import { useAuth } from '../contexts/AuthContext';
import { SUBSCRIPTION_SENTINEL } from '../lib/edgeFunctionClient';
import { Sentry } from '../lib/sentry';
import { supabase } from '../lib/supabase';
import { hasRenderableActiveLook } from '../lib/chatActiveLook';
import { t as tr } from '../lib/i18n';
import type { RootStackParamList } from '../navigation/RootNavigator';

import { messageKey, STATIC_SUGGESTIONS } from './StyleChatScreen.helpers';
import { MessageItem } from './StyleChatScreen.messageItem';
import { ModeToggleRow } from './StyleChatScreen.modeToggle';
import { MemoryPanel } from './StyleChatScreen.memoryPanel';
import { ChatHeader } from './StyleChatScreen.header';
import { ChatComposer, SuggestionChipRow } from './StyleChatScreen.composer';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'StyleChat'>;

// NOTE: Typography sizes (fontSize, lineHeight, letterSpacing) are
// hardcoded inline throughout this screen. Mobile does not yet have a
// `text` token system — every other M-wave screen uses the same inline
// pattern, and a follow-up wave will introduce typography tokens. Codex
// P2-9 acknowledged.
export function StyleChatScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const [memoryOpen, setMemoryOpen] = useState(true);
  // G1 — chat history sheet visibility. Lifted to local state rather
  // than baked into the hook so the sheet can stay closed while the
  // hook still owns the (mode-aware) message buffer.
  const [historyOpen, setHistoryOpen] = useState(false);
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
    refineMode,
    enterRefineMode,
    exitRefineMode,
    toggleLockedSlot,
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

  // G1 — seed chat state from nav params on mount.
  const seededRef = useRef(false);
  useEffect(() => {
    return () => {
      seededRef.current = false;
    };
  }, []);
  useEffect(() => {
    if (seededRef.current) return;
    const params = route.params;
    if (!params) {
      seededRef.current = true;
      return;
    }
    seededRef.current = true;
    const rawMode: string | undefined = params.mode;
    const seedMode: StyleChatMode | null =
      rawMode === 'shopping'
        ? 'shopping'
        : rawMode === 'style' || rawMode === 'stylist'
          ? 'style'
          : null;
    // gapContext implies shopping-mode; let it win over an explicit mode
    // param mismatch since the gap handoff is the more specific intent.
    if (params.gapContext) {
      setMode('shopping');
      const itemName = params.gapContext.item_name;
      if (typeof itemName === 'string' && itemName.trim()) {
        setDraft(itemName.trim());
      }
    } else if (seedMode) {
      setMode(seedMode);
    }
    if (Array.isArray(params.anchorGarmentIds) && params.anchorGarmentIds.length > 0) {
      const first = params.anchorGarmentIds.find(
        (id): id is string => typeof id === 'string' && !!id,
      );
      if (first) setAnchoredGarmentId(first);
    }
  }, [route.params, setMode, setAnchoredGarmentId]);

  // G1 — chat history thread summaries.
  const { data: historyThreads, isLoading: historyLoading } = useChatHistory();
  // Parity-C — per-row delete from the history sheet. We track the set of
  // modes with an in-flight delete so the sheet can dim their trash icons.
  const deleteThreadMutation = useDeleteChatThread();
  const [deletingModes, setDeletingModes] = useState<Set<StyleChatMode>>(
    () => new Set(),
  );

  const handleSelectHistoryThread = React.useCallback(
    (mode: StyleChatMode) => {
      setHistoryOpen(false);
      setMode(mode);
    },
    [setMode],
  );

  const handleDeleteHistoryThread = React.useCallback(
    async (mode: StyleChatMode) => {
      setDeletingModes((prev) => {
        if (prev.has(mode)) return prev;
        const next = new Set(prev);
        next.add(mode);
        return next;
      });
      try {
        await deleteThreadMutation.mutateAsync(mode);
        // Mirror the local-state effect `clearChat` performs for the active
        // mode: if the user just deleted the thread they're currently in,
        // wipe the visible messages too. Otherwise the screen would keep
        // rendering the deleted history until the next mode toggle.
        if (mode === currentMode) {
          await clearChat();
        }
      } finally {
        setDeletingModes((prev) => {
          if (!prev.has(mode)) return prev;
          const next = new Set(prev);
          next.delete(mode);
          return next;
        });
      }
    },
    [deleteThreadMutation, currentMode, clearChat],
  );

  const handleTryOutfit = React.useCallback(
    (garmentIds: string[]) => {
      const first = garmentIds.find(
        (id): id is string => typeof id === 'string' && !!id,
      );
      if (first) setAnchoredGarmentId(first);
    },
    [setAnchoredGarmentId],
  );

  // Parity-D — Save handler on the inline OutfitSuggestionCard. Each message
  // tracks its own saved-state stamp + in-flight flag keyed by message id so
  // the same suggestion bubble doesn't double-persist across re-renders.
  const persistChatOutfit = usePersistGeneratedOutfit();
  const [savedOutfitByMessage, setSavedOutfitByMessage] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [savingOutfitMessages, setSavingOutfitMessages] = useState<Set<string>>(
    () => new Set(),
  );

  const handleSaveChatOutfit = React.useCallback(
    async (
      messageId: string,
      garmentIds: string[],
      ctx: { explanation: string },
    ) => {
      if (savedOutfitByMessage.has(messageId)) return;
      const items = garmentIds
        .filter((id): id is string => typeof id === 'string' && !!id)
        .map((id) => ({ garment_id: id, slot: '' }));
      if (items.length === 0) {
        showToast(
          'error',
          tr('chat.outfitCard.saveEmpty.title'),
          tr('chat.outfitCard.saveEmpty.body'),
        );
        return;
      }
      setSavingOutfitMessages((prev) => {
        if (prev.has(messageId)) return prev;
        const next = new Set(prev);
        next.add(messageId);
        return next;
      });
      try {
        const { outfitId } = await persistChatOutfit.mutateAsync({
          occasion: null,
          explanation: ctx.explanation,
          familyLabel: null,
          items,
        });
        setSavedOutfitByMessage((prev) => {
          const next = new Map(prev);
          next.set(messageId, outfitId);
          return next;
        });
        showToast(
          'success',
          tr('chat.outfitCard.saveSuccess.title'),
          tr('chat.outfitCard.saveSuccess.body'),
        );
      } catch (err) {
        showToast(
          'error',
          tr('chat.outfitCard.saveFailed.title'),
          err instanceof Error ? err.message : String(err),
        );
      } finally {
        setSavingOutfitMessages((prev) => {
          if (!prev.has(messageId)) return prev;
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
      }
    },
    [persistChatOutfit, savedOutfitByMessage],
  );

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

  // Inverted FlatList expects newest-first ordering.
  const reversed = useMemo(() => messages.slice().reverse(), [messages]);

  // Most recent user turn — used by the inline error banner's Retry pill.
  const lastUserMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'user') ?? null,
    [messages],
  );

  // Active-look garment titles for the badge above the composer.
  const activeLookGarmentIds = useMemo(
    () => activeLook?.active_look?.garment_ids ?? [],
    [activeLook],
  );
  const titleLookupIds = useMemo(() => {
    const ids = new Set<string>(activeLookGarmentIds);
    if (anchoredGarmentId) ids.add(anchoredGarmentId);
    return Array.from(ids);
  }, [activeLookGarmentIds, anchoredGarmentId]);
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
  // OR when none of the ids resolve.
  const activeLookCountFallback = useMemo(
    () => tr('chat.active_look.fallback.template', { n: activeLookGarmentIds.length }),
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
  // is the URL allowlist enforcement boundary — only https:// links are
  // surfaced.
  const handleOpenProductLink = React.useCallback((url: string) => {
    if (typeof url !== 'string' || !url.startsWith('https://')) {
      Alert.alert(tr('shoppingChat.invalidUrl'));
      return;
    }
    Linking.openURL(url).catch((err) => {
      Sentry.withScope((scope) => {
        scope.setTag('mutation', 'StyleChatScreen.openProductLink');
        Sentry.captureException(err);
      });
      Alert.alert(tr('shoppingChat.invalidUrl'));
    });
  }, []);

  const handleClearActiveLook = React.useCallback(() => {
    clearActiveLook();
  }, [clearActiveLook]);

  const handleForgetFact = React.useCallback(
    (fact: StyleMemoryFact) => {
      if (!fact.garmentId) return;
      forgetMutation.mutate({
        kind: 'never_suggest_garment',
        garmentId: fact.garmentId,
        source: 'StyleChat:chip',
      });
    },
    [forgetMutation],
  );

  const showInlineError =
    error && error !== SUBSCRIPTION_SENTINEL ? error : null;

  // Q-D2 — refine entry handler. The card emits `(messageId, ids, exp)`;
  // the screen only needs the messageId to mark which bubble is being
  // refined. Garment ids + explanation are already carried inside that
  // bubble's `stylistMeta`, so passing them again would duplicate state.
  // useCallback so MessageItem's memo doesn't re-render every row when
  // refineMode flips.
  const handleEnterRefine = React.useCallback(
    (messageId: string) => {
      enterRefineMode(messageId);
    },
    [enterRefineMode],
  );

  // Q-D2 — derive refine state per row. Identity-stable per message via
  // useCallback. `activeRefineId` lifted out so the per-message branch
  // doesn't read the closed-over refineMode object on every row render
  // (only the matched row reads `lockedIds`).
  const activeRefineId = refineMode?.messageId ?? null;
  const activeLockedIds = refineMode?.lockedIds;

  // P2-4: stable renderItem reference. Inline arrows would re-create the
  // function on every keystroke and force FlatList to re-mount every row.
  const renderMessageItem = React.useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isRefiningThisRow = activeRefineId === item.id;
      return (
        <MessageItem
          msg={item}
          onLongPress={handleSetAnchorFromMessage}
          onOpenProductLink={handleOpenProductLink}
          onTryOutfit={handleTryOutfit}
          onSaveOutfit={handleSaveChatOutfit}
          isSavingOutfit={savingOutfitMessages.has(item.id)}
          isOutfitSaved={savedOutfitByMessage.has(item.id)}
          isRefining={isRefiningThisRow}
          lockedIds={isRefiningThisRow ? activeLockedIds : undefined}
          onToggleLock={isRefiningThisRow ? toggleLockedSlot : undefined}
          onEnterRefine={handleEnterRefine}
          onCancelRefine={exitRefineMode}
        />
      );
    },
    [
      handleSetAnchorFromMessage,
      handleOpenProductLink,
      handleTryOutfit,
      handleSaveChatOutfit,
      savingOutfitMessages,
      savedOutfitByMessage,
      activeRefineId,
      activeLockedIds,
      toggleLockedSlot,
      handleEnterRefine,
      exitRefineMode,
    ],
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
        <ChatHeader
          onBack={() => nav.goBack()}
          onOpenHistory={() => setHistoryOpen(true)}
          onNewChat={handleClear}
        />

        {/* ============ MODE TOGGLE (M23) ============ */}
        <ModeToggleRow currentMode={currentMode} onSelect={setMode} />

        {/* ============ MEMORY PANEL ============ */}
        <MemoryPanel
          open={memoryOpen}
          facts={facts}
          onToggleOpen={() => setMemoryOpen((v) => !v)}
          onForget={handleForgetFact}
        />

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
        <SuggestionChipRow suggestions={visibleSuggestions} onPress={handleSuggestion} />

        {/* ============ COMPOSER ============ */}
        <ChatComposer
          draft={draft}
          isStreaming={isStreaming}
          onDraftChange={setDraft}
          onSend={handleSend}
        />
      </KeyboardAvoidingView>
      {/* G1 — chat history side sheet. Mounted outside the
          KeyboardAvoidingView so it covers the full safe-area surface
          and isn't visually compressed when the keyboard is up. */}
      <ChatHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        threads={historyThreads ?? []}
        activeMode={currentMode}
        isLoading={historyLoading}
        onSelect={handleSelectHistoryThread}
        onDeleteThread={handleDeleteHistoryThread}
        deletingModes={deletingModes}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
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
});
