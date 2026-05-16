// useStyleChatUI — mode pills, suggestion chips, active-look badge,
// refine-mode. Pure state machine over user actions; no I/O.

import {
  useCallback, useMemo, useRef, useState,
  type Dispatch, type MutableRefObject, type SetStateAction,
} from 'react';

import { getLatestActiveLook } from '../lib/chatActiveLook';
import type { StyleChatResponseEnvelope } from '../lib/styleChatContract';
import type { ChatMessage } from './useStyleChat.helpers';

export interface RefineModeState {
  messageId: string;
  garmentIds: string[];
  explanation: string;
  lockedIds: Set<string>;
}

export interface StyleChatUIAPI {
  suggestionChips: string[];
  setSuggestionChips: Dispatch<SetStateAction<string[]>>;
  anchoredGarmentId: string | null;
  anchorRef: MutableRefObject<string | null>;
  setAnchoredGarmentId: (id: string | null) => void;
  activeLookClearedAt: number | null;
  activeLookClearedAtRef: MutableRefObject<number | null>;
  setActiveLookClearedAt: Dispatch<SetStateAction<number | null>>;
  activeLook: StyleChatResponseEnvelope | null;
  clearActiveLook: () => void;
  refineMode: RefineModeState | null;
  refineModeRef: MutableRefObject<RefineModeState | null>;
  setRefineMode: Dispatch<SetStateAction<RefineModeState | null>>;
  enterRefineMode: (
    messageId: string,
    garmentIds: string[],
    explanation: string,
  ) => void;
  exitRefineMode: () => void;
  toggleLockedSlot: (garmentId: string) => void;
}

export function useStyleChatUI(messages: ChatMessage[]): StyleChatUIAPI {
  const [suggestionChips, setSuggestionChips] = useState<string[]>([]);

  const [anchoredGarmentId, setAnchoredGarmentIdState] = useState<string | null>(null);
  const anchorRef = useRef<string | null>(anchoredGarmentId);
  anchorRef.current = anchoredGarmentId;
  const setAnchoredGarmentId = useCallback((id: string | null) => {
    setAnchoredGarmentIdState(id);
  }, []);

  const [activeLookClearedAt, setActiveLookClearedAt] = useState<number | null>(null);
  const activeLookClearedAtRef = useRef<number | null>(activeLookClearedAt);
  activeLookClearedAtRef.current = activeLookClearedAt;

  const visibleMessagesForActiveLook = useMemo(() => {
    if (activeLookClearedAt === null) return messages;
    return messages.filter((m) => m.timestamp.getTime() >= activeLookClearedAt);
  }, [messages, activeLookClearedAt]);
  const activeLook = useMemo(
    () => getLatestActiveLook(visibleMessagesForActiveLook),
    [visibleMessagesForActiveLook],
  );
  const clearActiveLook = useCallback(() => {
    setActiveLookClearedAt(Date.now());
    setAnchoredGarmentIdState(null);
  }, []);

  const [refineMode, setRefineMode] = useState<RefineModeState | null>(null);
  const refineModeRef = useRef<RefineModeState | null>(refineMode);
  refineModeRef.current = refineMode;

  const enterRefineMode = useCallback(
    (messageId: string, garmentIds: string[], explanation: string) => {
      setRefineMode({
        messageId,
        garmentIds: garmentIds.slice(),
        explanation,
        lockedIds: new Set<string>(),
      });
    },
    [],
  );
  const exitRefineMode = useCallback(() => {
    setRefineMode(null);
  }, []);
  const toggleLockedSlot = useCallback((garmentId: string) => {
    setRefineMode((prev) => {
      if (!prev) return prev;
      const nextLocked = new Set(prev.lockedIds);
      if (nextLocked.has(garmentId)) {
        nextLocked.delete(garmentId);
      } else {
        nextLocked.add(garmentId);
      }
      return { ...prev, lockedIds: nextLocked };
    });
  }, []);

  // Memoize so the orchestrator can include `ui` (or any destructured
  // setters/methods) in deps without churning identity per render.
  return useMemo(
    () => ({
      suggestionChips,
      setSuggestionChips,
      anchoredGarmentId,
      anchorRef,
      setAnchoredGarmentId,
      activeLookClearedAt,
      activeLookClearedAtRef,
      setActiveLookClearedAt,
      activeLook,
      clearActiveLook,
      refineMode,
      refineModeRef,
      setRefineMode,
      enterRefineMode,
      exitRefineMode,
      toggleLockedSlot,
    }),
    [
      suggestionChips,
      anchoredGarmentId,
      anchorRef,
      setAnchoredGarmentId,
      activeLookClearedAt,
      activeLookClearedAtRef,
      activeLook,
      clearActiveLook,
      refineMode,
      refineModeRef,
      enterRefineMode,
      exitRefineMode,
      toggleLockedSlot,
    ],
  );
}
