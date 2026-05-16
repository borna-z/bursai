// useStyleChat — orchestrator. Composes streaming + history + UI state.
// Hydration runs first; streaming gated on `isHydrating`; per-mode buffer
// cache survives toggles; `subscription_required` routes to paywall.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { useFlatGarments } from './useGarments';
import { supabase } from '../lib/supabase';
import type { StyleChatResponseEnvelope } from '../lib/styleChatContract';
import {
  buildSendTurnPayload,
  findStreamingAssistantPair,
  persistMessages,
  persistedModeFor,
  pruneStreamingPair,
  type ChatMessage,
  type StyleChatMode,
} from './useStyleChat.helpers';
import { buildTurnCallbacks } from './useStyleChatTurn.helpers';
import { useStyleChatHistory } from './useStyleChatHistory';
import { useStyleChatStreaming } from './useStyleChatStreaming';
import { useStyleChatUI } from './useStyleChatUI';

export { persistedModeFor, type ChatMessage, type StyleChatMode } from './useStyleChat.helpers';

export interface UseStyleChatResult {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  isHydrating: boolean;
  suggestionChips: string[];
  activeLook: StyleChatResponseEnvelope | null;
  anchoredGarmentId: string | null;
  setAnchoredGarmentId: (id: string | null) => void;
  sendMessage: (content: string) => Promise<void>;
  clearChat: () => Promise<void>;
  stopStreaming: () => void;
  clearActiveLook: () => void;
  currentMode: StyleChatMode;
  setMode: (mode: StyleChatMode) => void;
  refineMode:
    | { messageId: string; garmentIds: string[]; explanation: string; lockedIds: Set<string> }
    | null;
  enterRefineMode: (messageId: string, garmentIds: string[], explanation: string) => void;
  exitRefineMode: () => void;
  toggleLockedSlot: (garmentId: string) => void;
}

let messageIdCounter = 0;

export function useStyleChat(): UseStyleChatResult {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const garmentsQuery = useFlatGarments();
  // Memoize so a stable reference flows into `sendMessage`'s dep array;
  // without this, every render churns the callback identity (and triggers
  // a re-render in every consumer that holds onto `sendMessage`).
  const wardrobeIds = useMemo(
    () =>
      garmentsQuery.hasNextPage ? [] : (garmentsQuery.data ?? []).map((g) => g.id),
    [garmentsQuery.data, garmentsQuery.hasNextPage],
  );

  const [currentMode, setCurrentMode] = useState<StyleChatMode>('style');
  const history = useStyleChatHistory(user?.id, currentMode);
  const ui = useStyleChatUI(history.messages);
  const {
    suggestionChips, setSuggestionChips,
    anchoredGarmentId, anchorRef, setAnchoredGarmentId,
    activeLookClearedAtRef, setActiveLookClearedAt,
    activeLook, clearActiveLook,
    refineMode, refineModeRef, setRefineMode,
    enterRefineMode, exitRefineMode, toggleLockedSlot,
  } = ui;

  const currentModeRef = useRef<StyleChatMode>(currentMode);
  currentModeRef.current = currentMode;

  const { streamTurn } = useStyleChatStreaming();

  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef<boolean>(false);
  const messagesRef = useRef<ChatMessage[]>(history.messages);
  messagesRef.current = history.messages;
  // Synchronous mirror of `history.isHydrating` so `sendMessage` can gate
  // on it without taking a render-cycle dep on `history` (which would
  // make the callback churn identity on every streaming chunk).
  const isHydratingRef = useRef<boolean>(history.isHydrating);
  isHydratingRef.current = history.isHydrating;
  const setMessages = history.setMessages;

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      streamingRef.current = false;
      history.clearAllCaches();
      setIsStreaming(false);
      setMessages([]);
      setError(null);
      setSuggestionChips([]);
      setActiveLookClearedAt(null);
      setRefineMode(null);
      refineModeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setMode = useCallback((mode: StyleChatMode) => {
    setCurrentMode((prev) => {
      if (prev === mode) return prev;
      abortRef.current?.abort();
      abortRef.current = null;
      streamingRef.current = false;
      setIsStreaming(false);
      const userId = user?.id;
      if (userId) {
        history.snapshotToCache(userId, prev, pruneStreamingPair(messagesRef.current));
      }
      setMessages([]);
      setSuggestionChips([]);
      setActiveLookClearedAt(null);
      setError(null);
      setRefineMode(null);
      return mode;
    });
    // history methods (snapshotToCache, etc.) are stable useCallback refs;
    // including `history` here would churn setMode identity every render
    // because the memoized history object's deps include `messages`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const sendMessage = useCallback(async (content: string) => {
    if (!session?.access_token || !user?.id || !content.trim()) return;
    if (streamingRef.current || isStreaming) return;
    if (isHydratingRef.current) return;
    streamingRef.current = true;

    const trimmed = content.trim();
    messageIdCounter += 1;
    const turnTag = `${Date.now()}-${messageIdCounter}`;
    const userMsg: ChatMessage = {
      id: `user-${turnTag}`, role: 'user', content: trimmed, timestamp: new Date(),
    };
    const assistantId = `assistant-${turnTag}`;
    const assistantMsg: ChatMessage = {
      id: assistantId, role: 'assistant', content: '', timestamp: new Date(),
      isStreaming: true, stylistMeta: null,
    };

    const { messagesPayload, activeLookPayload, lockedSlots } = buildSendTurnPayload({
      messages: messagesRef.current,
      trimmedContent: trimmed,
      activeLookClearedAt: activeLookClearedAtRef.current,
      anchoredGarmentId: anchorRef.current,
      refineSnapshot: refineModeRef.current,
    });

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);
    setError(null);
    setSuggestionChips([]);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const turnMode = currentModeRef.current;

    await streamTurn({
      mode: turnMode,
      messagesPayload,
      anchoredGarmentId: anchorRef.current,
      activeLookPayload,
      lockedSlots,
      wardrobeGarmentIds: wardrobeIds,
      controller,
      callbacks: buildTurnCallbacks({
        assistantId,
        trimmedContent: trimmed,
        turnMode,
        userId: user.id,
        queryClient,
        history,
        setMessages,
        setSuggestionChips,
        setIsStreaming,
        setError,
        setRefineMode,
        refineModeRef,
        messagesRef,
        streamingRef,
      }),
    });
    // history methods are stable useCallback refs; isHydrating is read via
    // a synchronous ref (`isHydratingRef`) so we don't need the whole
    // `history` object in deps (it churns when `messages` updates each
    // stream chunk).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, user?.id, isStreaming, queryClient, wardrobeIds, streamTurn]);

  const clearChat = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = null;
    streamingRef.current = false;
    setMessages([]);
    setIsStreaming(false);
    setError(null);
    setSuggestionChips([]);
    setAnchoredGarmentId(null);
    setActiveLookClearedAt(null);
    setRefineMode(null);
    if (!user?.id) return;
    const turnMode = currentModeRef.current;
    history.deleteCacheEntry(user.id, turnMode);
    const { error: deleteError } = await supabase
      .from('chat_messages').delete()
      .eq('user_id', user.id).eq('mode', persistedModeFor(turnMode));
    if (deleteError) {
      console.warn('[useStyleChat] clearChat delete failed:', deleteError.message);
    }
    queryClient.invalidateQueries({ queryKey: ['chatHistory', user.id] });
    // history methods are stable useCallback refs (see sendMessage above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, queryClient]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    streamingRef.current = false;
    const pair = findStreamingAssistantPair(messagesRef.current);
    if (pair && user?.id && pair.user && (pair.assistant.content || pair.assistant.stylistMeta)) {
      void persistMessages(user.id, currentModeRef.current, [
        { role: 'user', content: pair.user.content },
        {
          role: 'assistant',
          content: pair.assistant.content,
          stylistMeta: pair.assistant.stylistMeta ?? null,
        },
      ]);
    }
    setIsStreaming(false);
    setMessages((prev) => prev.map((m) => ({ ...m, isStreaming: false })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      streamingRef.current = false;
    };
  }, []);

  return {
    messages: history.messages, isStreaming, error, isHydrating: history.isHydrating,
    suggestionChips, activeLook, anchoredGarmentId, setAnchoredGarmentId,
    sendMessage, clearChat, stopStreaming, clearActiveLook,
    currentMode, setMode, refineMode, enterRefineMode, exitRefineMode, toggleLockedSlot,
  };
}
