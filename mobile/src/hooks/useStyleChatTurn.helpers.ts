// Helpers consumed only by `useStyleChat`'s sendMessage orchestration —
// kept out of the React file so the orchestrator stays focused on
// state composition.

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { QueryClient } from '@tanstack/react-query';

import { t as tr } from '../lib/i18n';
import { SUBSCRIPTION_SENTINEL } from '../lib/edgeFunctionClient';
import type { StyleChatResponseEnvelope } from '../lib/styleChatContract';
import {
  advanceRefineFromEnvelope,
  persistMessages,
  type ChatMessage,
  type StyleChatMode,
} from './useStyleChat.helpers';
import type { RefineModeState } from './useStyleChatUI';
import type { StyleChatHistoryAPI } from './useStyleChatHistory';
import type { StreamTurnArgs } from './useStyleChatStreaming';
import { CACHE_KEYS } from './cacheKeys';

export function applyAssistantPatch(
  messages: ChatMessage[],
  assistantId: string,
  patch: Partial<ChatMessage>,
): ChatMessage[] {
  return messages.map((m) => (m.id !== assistantId ? m : { ...m, ...patch }));
}

export function patchAssistantSeed(
  messages: ChatMessage[],
  assistantId: string,
  next: { content: string; stylistMeta: StyleChatResponseEnvelope | null },
): ChatMessage[] {
  return applyAssistantPatch(messages, assistantId, {
    content: next.content || messages.find((m) => m.id === assistantId)?.content || '',
    stylistMeta: next.stylistMeta,
  });
}

export function patchAssistantChunk(
  messages: ChatMessage[],
  assistantId: string,
  snapshot: { content: string; stylistMeta: StyleChatResponseEnvelope | null },
): ChatMessage[] {
  return applyAssistantPatch(messages, assistantId, snapshot);
}

export function patchAssistantFinal(
  messages: ChatMessage[],
  assistantId: string,
  next: { finalContent: string; finalMeta: StyleChatResponseEnvelope | null },
): ChatMessage[] {
  const existing = messages.find((m) => m.id === assistantId);
  return applyAssistantPatch(messages, assistantId, {
    content: next.finalContent || existing?.content || '',
    stylistMeta: next.finalMeta,
    isStreaming: false,
  });
}

export function buildErrorPatch(err: Error): {
  fallbackContent: string;
  surfacedError: string;
  isPaywall: boolean;
} {
  const isPaywall = err.message === SUBSCRIPTION_SENTINEL;
  const surfacedError = isPaywall
    ? err.message
    : err.message || tr('chat.error.generic');
  const fallbackContent = isPaywall
    ? tr('chat.error.premium.body')
    : tr('chat.error.inlineFallback');
  return { fallbackContent, surfacedError, isPaywall };
}

export interface BuildTurnCallbacksDeps {
  assistantId: string;
  trimmedContent: string;
  turnMode: StyleChatMode;
  userId: string;
  queryClient: QueryClient;
  history: StyleChatHistoryAPI;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setSuggestionChips: (chips: string[]) => void;
  setIsStreaming: (v: boolean) => void;
  setError: (e: string | null) => void;
  setRefineMode: Dispatch<SetStateAction<RefineModeState | null>>;
  refineModeRef: MutableRefObject<RefineModeState | null>;
  messagesRef: MutableRefObject<ChatMessage[]>;
  streamingRef: MutableRefObject<boolean>;
}

export function buildTurnCallbacks(deps: BuildTurnCallbacksDeps): StreamTurnArgs['callbacks'] {
  const {
    assistantId, trimmedContent, turnMode, userId, queryClient, history,
    setMessages, setSuggestionChips, setIsStreaming, setError, setRefineMode,
    refineModeRef, messagesRef, streamingRef,
  } = deps;

  return {
    onBubbleSeed: (next) =>
      setMessages((prev) => patchAssistantSeed(prev, assistantId, next)),
    onSuggestionChips: setSuggestionChips,
    onChunkScheduled: (snapshot) =>
      setMessages((prev) => patchAssistantChunk(prev, assistantId, snapshot)),
    onComplete: ({ finalContent, finalMeta }) => {
      streamingRef.current = false;
      setMessages((prev) =>
        patchAssistantFinal(prev, assistantId, { finalContent, finalMeta }),
      );
      setIsStreaming(false);
      const refineDelta = advanceRefineFromEnvelope(refineModeRef.current, finalMeta);
      if (refineDelta.kind === 'clear') setRefineMode(null);
      else if (refineDelta.kind === 'advance') setRefineMode(refineDelta.next);
      if (finalContent || finalMeta) {
        const persistKey = history.cacheKey(userId, turnMode);
        history.bumpPendingPersist(persistKey);
        void persistMessages(userId, turnMode, [
          { role: 'user', content: trimmedContent },
          { role: 'assistant', content: finalContent, stylistMeta: finalMeta },
        ])
          .then(() => queryClient.invalidateQueries({ queryKey: CACHE_KEYS.chatHistory(userId) }))
          .finally(() => history.releasePendingPersist(persistKey));
      }
      queueMicrotask(() => {
        history.snapshotToCache(
          userId, turnMode,
          messagesRef.current.filter((m) => !m.isStreaming),
        );
      });
    },
    onError: (err) => {
      streamingRef.current = false;
      const { fallbackContent, surfacedError } = buildErrorPatch(err);
      setError(surfacedError);
      setIsStreaming(false);
      setMessages((prev) => applyAssistantPatch(prev, assistantId, {
        content: fallbackContent,
        isStreaming: false,
        isErrored: true,
        stylistMeta: null,
      }));
    },
  };
}
