// useStyleChatHistory — fetch + parse persisted chat history.
//
// Hydrates `chat_messages` rows for the current user + mode, with the
// per-mode buffer cache and the optimistic-insert race guard preserved
// from the pre-split implementation. The orchestrator drives mode
// transitions via `setHydratedMessages` so the same cache survives
// `setMode` -> hydrate -> SELECT-tail across rapid toggles.

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { Sentry } from '../lib/sentry';
import { supabase } from '../lib/supabase';
import {
  HYDRATION_LIMIT,
  parseStoredMessage,
  persistedModeFor,
  type ChatMessage,
  type StoredRow,
  type StyleChatMode,
} from './useStyleChat.helpers';

export interface StyleChatHistoryAPI {
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  isHydrating: boolean;
  cacheKey: (uid: string, mode: StyleChatMode) => string;
  snapshotToCache: (uid: string, mode: StyleChatMode, value: ChatMessage[]) => void;
  deleteCacheEntry: (uid: string, mode: StyleChatMode) => void;
  clearAllCaches: () => void;
  bumpPendingPersist: (cacheKey: string) => void;
  releasePendingPersist: (cacheKey: string) => void;
}

export function useStyleChatHistory(
  userId: string | undefined,
  currentMode: StyleChatMode,
): StyleChatHistoryAPI {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isHydrating, setIsHydrating] = useState<boolean>(true);
  const messageCacheRef = useRef<Map<string, ChatMessage[]>>(new Map());
  const pendingPersistRef = useRef<Map<string, number>>(new Map());

  const cacheKey = useCallback(
    (uid: string, mode: StyleChatMode) => `${uid}:${persistedModeFor(mode)}`,
    [],
  );

  const snapshotToCache = useCallback(
    (uid: string, mode: StyleChatMode, value: ChatMessage[]) => {
      messageCacheRef.current.set(cacheKey(uid, mode), value);
    },
    [cacheKey],
  );
  const deleteCacheEntry = useCallback(
    (uid: string, mode: StyleChatMode) => {
      messageCacheRef.current.delete(cacheKey(uid, mode));
    },
    [cacheKey],
  );
  const clearAllCaches = useCallback(() => {
    messageCacheRef.current.clear();
    pendingPersistRef.current.clear();
  }, []);
  const bumpPendingPersist = useCallback((key: string) => {
    pendingPersistRef.current.set(
      key,
      (pendingPersistRef.current.get(key) ?? 0) + 1,
    );
  }, []);
  const releasePendingPersist = useCallback((key: string) => {
    const next = (pendingPersistRef.current.get(key) ?? 1) - 1;
    if (next <= 0) pendingPersistRef.current.delete(key);
    else pendingPersistRef.current.set(key, next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setMessages([]);
      setIsHydrating(true);
      return () => {
        cancelled = true;
      };
    }
    const cached = messageCacheRef.current.get(cacheKey(userId, currentMode));
    if (cached) {
      setMessages(cached);
      setIsHydrating(false);
    } else {
      setIsHydrating(true);
    }
    (async () => {
      const { data, error: hydrateError } = await supabase
        .from('chat_messages')
        .select('role, content, created_at')
        .eq('user_id', userId)
        .eq('mode', persistedModeFor(currentMode))
        .order('created_at', { ascending: true })
        .limit(HYDRATION_LIMIT);
      if (cancelled) return;
      if (hydrateError) {
        Sentry.withScope((s) => {
          s.setTag('mutation', 'useStyleChat.hydrate');
          Sentry.captureException(hydrateError);
        });
        if (!cached) setMessages([]);
        setIsHydrating(false);
        return;
      }
      const rows = (data ?? []) as StoredRow[];
      const parsed = rows.map((row, idx) => parseStoredMessage(row, idx));
      const cacheKeyStr = cacheKey(userId, currentMode);
      const cachedNow = messageCacheRef.current.get(cacheKeyStr);
      const cachedCount = cachedNow?.length ?? 0;
      const pendingPersist = pendingPersistRef.current.get(cacheKeyStr) ?? 0;
      if (cachedCount > parsed.length && pendingPersist > 0) {
        setIsHydrating(false);
        return;
      }
      messageCacheRef.current.set(cacheKeyStr, parsed);
      setMessages(parsed);
      setIsHydrating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, currentMode, cacheKey]);

  return {
    messages,
    setMessages,
    isHydrating,
    cacheKey,
    snapshotToCache,
    deleteCacheEntry,
    clearAllCaches,
    bumpPendingPersist,
    releasePendingPersist,
  };
}
