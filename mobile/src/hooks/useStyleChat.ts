// useStyleChat — drives StyleChatScreen via the streaming `style_chat` edge
// function with the M14 8-mode contract.
//
// Beyond M9's basic SSE plumbing, this hook now:
//   • hydrates persisted chat history on mount (chat_messages where
//     mode = 'stylist'), so the user resumes mid-conversation across cold
//     starts;
//   • parses each row through `parseStoredMessage` (the same wire format
//     web's AIChat persists — stylist envelopes encoded as JSON
//     PersistedStyleChatMessage records);
//   • routes the new SSE event types (`stylist_response` envelope,
//     `suggestions` chips) into UI-visible state for mode pills,
//     active-look badge, and dynamic suggestion chips;
//   • carries `selected_garment_ids` + `active_look` on every send so
//     the server can honour anchor locking + look refinement without the
//     UI having to re-send the full envelope each turn;
//   • persists each completed turn to `chat_messages` so a refresh
//     resumes the conversation faithfully.
//
// SSE shape the function emits (verified by reading
// supabase/functions/style_chat/index.ts):
//   1. `data: {"type":"stylist_response","payload":envelope}\n\n`
//      — full envelope first; we attach it to the streaming bubble's
//        `stylistMeta` and seed `content = envelope.assistant_text` so the
//        bubble can render the mode pill + active-look immediately even
//        before any deltas land.
//   2. zero-or-more `data: {"choices":[{"delta":{"content":"..."}}]}`
//      — OpenAI-style streamed text; concatenated and rAF-coalesced into
//        the assistant bubble.
//   3. `data: {"type":"suggestions","chips":[...]}` — replaces the static
//      suggestion-chip rail in the screen.
//   4. `data: [DONE]\n\n` — close.
//
// Subscription-locked → onError fires with sentinel 'subscription_required'.
// AbortController is exposed via stopStreaming() and clearChat() so the
// screen unmount effect can cancel an in-flight stream cleanly.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { SUBSCRIPTION_SENTINEL } from '../lib/edgeFunctionClient';
import { t as tr } from '../lib/i18n';
import { Sentry } from '../lib/sentry';
import { supabase } from '../lib/supabase';
import type {
  StyleChatActiveLookInput,
  StyleChatResponseEnvelope,
} from '../lib/styleChatContract';
import { getLatestActiveLook } from '../lib/chatActiveLook';
import {
  finalizeEnvelopeForMode,
  HISTORY_TURNS,
  HYDRATION_LIMIT,
  parseStoredMessage,
  persistedModeFor,
  persistMessages,
  ROUTE_BY_MODE,
  type ChatMessage,
  type StoredRow,
  type StyleChatMode,
} from './useStyleChat.helpers';
import {
  buildRequestBody,
  fetchSSE,
  handleStreamChunk,
  makeAccumulator,
} from './useStyleChat.stream';

export {
  persistedModeFor,
  type ChatMessage,
  type StyleChatMode,
} from './useStyleChat.helpers';

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
  // M23 — chat-mode toggle. `currentMode` drives both the request route
  // (style_chat vs shopping_chat) and the StyleChatScreen segmented
  // control. `setMode(next)` aborts any in-flight stream so the next
  // sendMessage uses the new mode cleanly without a half-streamed bubble
  // bleeding across modes.
  currentMode: StyleChatMode;
  setMode: (mode: StyleChatMode) => void;
  /** Q-D2 — refine-mode state. `null` when not refining. When non-null,
   *  the user has tapped Refine on a chat outfit suggestion: `messageId`
   *  identifies which assistant bubble owns the look being refined,
   *  `garmentIds` + `explanation` are snapshots of that card's outfit at
   *  refine-entry (so a stale active_look from a NEWER turn never gets
   *  paired with these `lockedIds` — Codex P2 round 1 on Q-D2), and
   *  `lockedIds` is the set of garment ids the user has tapped to lock
   *  for the next generation (mirrors web `useRefineMode.lockedSlots`).
   *  The next `sendMessage` call attaches `locked_slots: [...]` to the
   *  `style_chat` request body so the engine swaps only the unlocked
   *  slots, with `active_look` rebuilt from the refine snapshot. */
  refineMode: {
    messageId: string;
    garmentIds: string[];
    explanation: string;
    lockedIds: Set<string>;
  } | null;
  enterRefineMode: (messageId: string, garmentIds: string[], explanation: string) => void;
  exitRefineMode: () => void;
  toggleLockedSlot: (garmentId: string) => void;
}

// Module-level monotonic counter — combined with Date.now() to keep
// generated message ids unique even when sendMessage is called twice in
// the same millisecond (rapid-tap, scripted retry, etc.). Previously the
// id collided which made FlatList drop one of the two bubbles. Codex P2-10.
let messageIdCounter = 0;

export function useStyleChat(): UseStyleChatResult {
  const { user, session } = useAuth();
  // G1 — invalidate the chat history thread summary on send/clear so
  // ChatHistorySheet's row list reflects the latest activity stamp +
  // message count without the consumer wiring it up by hand.
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState<boolean>(true);
  const [suggestionChips, setSuggestionChips] = useState<string[]>([]);
  const [anchoredGarmentId, setAnchoredGarmentIdState] = useState<string | null>(null);
  // M23 — Chat mode. Defaults to 'style' so existing callers behave
  // identically to the M14 baseline. The screen's segmented control
  // calls setMode() to flip between style_chat and shopping_chat.
  const [currentMode, setCurrentModeState] = useState<StyleChatMode>('style');
  // Wall-clock timestamp of the most recent local Clear-active-look action.
  // Any prior assistant message is treated as if it had no active_look so
  // subsequent sends won't ship a stale look in the payload, and the
  // active-look badge above the composer disappears immediately. Codex P1-1.
  const [activeLookClearedAt, setActiveLookClearedAt] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Latest messages snapshot — used inside sendMessage to assemble the
  // history payload + active-look without re-binding sendMessage on every
  // append (which would re-render every consumer of the hook on every chunk).
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const anchorRef = useRef<string | null>(null);
  anchorRef.current = anchoredGarmentId;
  // Synchronous mirror of `currentMode`. sendMessage closes over this so
  // a mode flip mid-render lands in the next request without a callback
  // identity churn. Codex P2-7 pattern (same as streamingRef).
  const currentModeRef = useRef<StyleChatMode>(currentMode);
  currentModeRef.current = currentMode;
  const activeLookClearedAtRef = useRef<number | null>(null);
  activeLookClearedAtRef.current = activeLookClearedAt;
  // Synchronous mirror of `isStreaming`. Used inside sendMessage to early-
  // return on rapid double-tap before the React state batch has flushed —
  // the state check alone races when the user taps Send twice in <16ms.
  // Codex P2-7.
  const streamingRef = useRef<boolean>(false);

  // Q-D2 — refine-mode state. The synchronous ref lets `sendMessage`
  // attach `locked_slots: [...]` to the request body without re-binding
  // the callback per toggle (matches the `streamingRef` / `currentModeRef`
  // / `anchorRef` pattern used elsewhere in this hook).
  const [refineMode, setRefineMode] = useState<
    | {
        messageId: string;
        garmentIds: string[];
        explanation: string;
        lockedIds: Set<string>;
      }
    | null
  >(null);
  const refineModeRef = useRef<
    | {
        messageId: string;
        garmentIds: string[];
        explanation: string;
        lockedIds: Set<string>;
      }
    | null
  >(null);
  refineModeRef.current = refineMode;

  // ─── Hydration ─────────────────────────────────────────────────────────
  // Restore the user's prior chat for the current mode on mount and on
  // every mode flip. Gated on user.id so a sign-out → sign-in cycle
  // re-hydrates against the correct row set.
  //
  // G1 — also re-runs whenever `currentMode` changes. setMode() seeds
  // messages from the per-mode buffer cache before this effect fires so
  // the user sees an instant swap; the SELECT then refreshes the cached
  // buffer with whatever the server has on file (covers cross-device or
  // post-sign-in drift).
  //
  // Per-mode message buffer cache. Re-hydration on mode toggle reads from
  // this cache first so toggling Style → Shopping → Style is instant
  // instead of incurring two SELECTs. The cache is keyed by user.id +
  // chat mode so a different signed-in user never sees the prior user's
  // buffer (the auth-change cleanup wipes it explicitly).
  const messageCacheRef = useRef<Map<string, ChatMessage[]>>(new Map());
  // Codex P2 round 5 on PR #789: track in-flight persistMessages
  // INSERTs per cacheKey so the hydration effect can distinguish a
  // legitimate remote shrink (clearChat on web, retention) from the
  // optimistic-insert race the round-4 fix targeted. Incremented on
  // sendMessage onDone before kicking off the persist; decremented in
  // the persist promise's then(). When zero, a smaller DB row count is
  // trusted as the source of truth and the cache + UI are refreshed.
  const pendingPersistRef = useRef<Map<string, number>>(new Map());
  const cacheKey = useCallback(
    (uid: string, mode: StyleChatMode) => `${uid}:${persistedModeFor(mode)}`,
    [],
  );
  useEffect(() => {
    let cancelled = false;
    const userId = user?.id;
    if (!userId) {
      // Signed-out cold start: hold `isHydrating: true` so the screen
      // stays in spinner mode until AuthContext resolves either way.
      // Acceptable trade-off — signed-out users see a brief spinner
      // before the empty welcome (no auth restore actually runs but
      // AuthContext's loading flag covers the wait). Codex P2-6.
      setMessages([]);
      setIsHydrating(true);
      return () => {
        cancelled = true;
      };
    }
    // G1 — seed from cache so the bubble swap is instant. The SELECT
    // below still runs to keep the cache fresh, but the user sees their
    // prior thread immediately.
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
        // Hydration failure is silent: the user gets an empty conversation
        // and can still type — we don't want to block the screen on a
        // transient SELECT error.
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
      // Codex P2 round 4 on PR #789: don't overwrite a fresher cached
      // buffer with a stale SELECT. After sendMessage settles we
      // optimistically update the cache while the persistMessages
      // INSERT is still in flight; if the user toggles modes quickly
      // (away → back) before the INSERT lands, this SELECT returns the
      // pre-turn row set and would otherwise wipe the just-completed
      // assistant reply until a manual refresh. The cache only ever
      // grows monotonically per turn, so a "cache has more settled
      // messages than DB returned" comparison reliably detects this
      // race. We still update the cache + visible state when the DB
      // wins on count (cross-device append, explicit refetch, etc.).
      const cacheKeyStr = cacheKey(userId, currentMode);
      const cachedNow = messageCacheRef.current.get(cacheKeyStr);
      const cachedCount = cachedNow?.length ?? 0;
      const pendingPersist = pendingPersistRef.current.get(cacheKeyStr) ?? 0;
      if (cachedCount > parsed.length && pendingPersist > 0) {
        // Stale SELECT during an optimistic-insert race — keep cache.
        // Outside that race window (cross-device clear / retention /
        // legitimate remote shrink), the smaller DB result wins so
        // deleted history doesn't ghost back. Codex P2 round 5+6 on
        // PR #789.
        setIsHydrating(false);
        return;
      }
      messageCacheRef.current.set(cacheKeyStr, parsed);
      setMessages(parsed);
      setIsHydrating(false);
    })();
    return () => {
      // G1 — minimal per-run cleanup. Just cancel the in-flight SELECT so
      // a late result doesn't repaint stale messages after a mode toggle
      // (or user-id change). The heavier auth-change wipe lives in a
      // separate effect keyed on user?.id alone — running it on every
      // mode toggle would blow away the active stream and visible
      // messages mid-flip, defeating the per-mode buffer cache.
      cancelled = true;
    };
  }, [user?.id, currentMode, cacheKey]);

  // G1 — auth-identity cleanup. Runs only when the signed-in user
  // changes (sign-in, sign-out, account swap). Mirrors the prior
  // hydration cleanup that ran on every effect tick: aborts any
  // in-flight stream, wipes per-mode caches, clears visible state so
  // the new user starts fresh. Splitting this out from the
  // mode-aware hydration effect lets the mode toggle reload history
  // without nuking the screen state. Codex P1-4 invariant preserved.
  useEffect(() => {
    // Capture the cache ref inside the effect — eslint's
    // react-hooks/exhaustive-deps rule warns that
    // `messageCacheRef.current` could point to a different Map by the
    // time the cleanup fires. The ref is module-scoped to this hook
    // instance so the captured value is the same Map for the cleanup,
    // but binding it locally makes the lifetime explicit.
    const cache = messageCacheRef.current;
    const pending = pendingPersistRef.current;
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      streamingRef.current = false;
      cache.clear();
      pending.clear();
      setIsStreaming(false);
      setMessages([]);
      setError(null);
      setSuggestionChips([]);
      setActiveLookClearedAt(null);
      setIsHydrating(true);
      // Q-D2 — refine state is scoped to the current user's thread. If the
      // user signs out (or switches account) `refineMode.messageId` still
      // points at a bubble id from the prior user's history and
      // `lockedIds` would ride into the new user's first send via
      // `refineModeRef.current`. Clear both the React state and the
      // synchronous ref so the next `sendMessage` starts clean. Codex
      // P1 round 1 on PR (Q-D2 — refine-mode parity).
      setRefineMode(null);
      refineModeRef.current = null;
    };
  }, [user?.id]);

  const setAnchoredGarmentId = useCallback((id: string | null) => {
    setAnchoredGarmentIdState(id);
  }, []);

  // M23/G1 — Mode toggle. Aborting any in-flight stream guarantees the
  // next sendMessage uses the new mode cleanly: a half-streamed
  // style_chat bubble is dropped (the assistant placeholder is filtered
  // on abort), and the user can immediately compose a shopping prompt
  // without a stale style_chat envelope landing late and overwriting the
  // screen. G1 layering: the prior mode's buffer is captured into the
  // per-mode cache so toggling back is instant; the hydration effect
  // (keyed on currentMode) then refreshes the new mode's thread from
  // the database.
  const setMode = useCallback(
    (mode: StyleChatMode) => {
      setCurrentModeState((prev) => {
        if (prev === mode) return prev;
        abortRef.current?.abort();
        abortRef.current = null;
        streamingRef.current = false;
        setIsStreaming(false);
        // Snapshot the prior mode's settled messages into the cache so
        // toggling back is instant. We strip any in-flight streaming
        // bubble and its orphaned user pair (the same trim sendMessage
        // would do via setMessages below) before caching, so the cached
        // buffer is always a clean settled history.
        const userId = user?.id;
        if (userId) {
          const snapshot = messagesRef.current;
          const streamingIdx = snapshot.findIndex((m) => m.isStreaming);
          let cleaned = snapshot;
          if (streamingIdx >= 0) {
            const prior = streamingIdx > 0 ? snapshot[streamingIdx - 1] : null;
            const orphanedUser =
              prior && prior.role === 'user' ? streamingIdx - 1 : -1;
            cleaned = snapshot.filter(
              (_, i) => i !== streamingIdx && i !== orphanedUser,
            );
          }
          messageCacheRef.current.set(cacheKey(userId, prev), cleaned);
        }
        // Clear local UI state so the hydration effect (keyed on
        // currentMode) takes over and seeds either from cache or DB.
        setMessages([]);
        // Suggestion chips are mode-specific (style_chat ships them; the
        // current shopping_chat function does not). Reset so the static
        // fallbacks render until the next turn settles.
        setSuggestionChips([]);
        // The active-look derivation walks the visible message list, so
        // a stale cleared-at from the prior mode is harmless once we
        // wipe the messages, but resetting it keeps the badge math
        // honest after the next mode's history hydrates.
        setActiveLookClearedAt(null);
        setError(null);
        // Q-D2 — refine state is per-thread and per-mode (refine targets a
        // message id in the current thread). A mode flip wipes messages,
        // so the refine target is gone too; drop refine state so the
        // hidden `locked_slots` payload doesn't ride into a different
        // mode's first turn.
        setRefineMode(null);
        return mode;
      });
    },
    [user?.id, cacheKey],
  );

  // Filter out any message whose timestamp predates the most recent local
  // Clear-active-look. Without this filter, getLatestActiveLook walks
  // bottom-up and skips messages whose `active_look.garment_ids.length === 0`,
  // so an OLDER look-bearing message is still picked as "latest" and the
  // stale active_look ships in subsequent payloads. Codex P1-1.
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

  // Q-D2 — Refine-mode transitions. Pulled out as `useCallback`s so the
  // OutfitSuggestionCard's `onPress` props stay referentially stable
  // (the card is memoized).
  const enterRefineMode = useCallback(
    (messageId: string, garmentIds: string[], explanation: string) => {
      // Fresh lock set — entering refine mode never inherits state from a
      // previous refine session, matching web `useRefineMode.enterRefineMode`.
      // Snapshot the card's garment ids + explanation so the next refine
      // send can rebuild `active_look` against THIS card (rather than the
      // last assistant envelope's, which `getLatestActiveLook` returns and
      // could belong to a newer turn). Codex P2 round 1 on Q-D2.
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

  const sendMessage = useCallback(
    async (content: string) => {
      if (!session?.access_token || !user?.id || !content.trim()) return;
      // Synchronous double-fire guard. Without this, a rapid double-tap
      // on Send (or two suggestion chips fired back-to-back from the
      // 150ms auto-send timer) can race two streams because `isStreaming`
      // is React state and only flips after a render commit. Codex P2-7.
      if (streamingRef.current || isStreaming) return;
      streamingRef.current = true;

      const trimmed = content.trim();
      messageIdCounter += 1;
      const turnTag = `${Date.now()}-${messageIdCounter}`;
      const userMsg: ChatMessage = {
        id: `user-${turnTag}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };

      const assistantId = `assistant-${turnTag}`;
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
        stylistMeta: null,
      };

      // Build the history payload from the PRIOR snapshot so the new turn
      // doesn't poison the request body. messagesRef holds the last-rendered
      // state — see edge contract (supabase/functions/style_chat/index.ts:933-946)
      // for the strict shape. Q-D1 also strips `isErrored` placeholders so
      // the localized UI fallback (e.g. "Couldn't generate a reply…") never
      // leaks into the AI's view of the conversation as if the assistant
      // actually said it. Codex P2 round 1 on PR #827.
      const priorHistory = messagesRef.current
        .filter((m) => !m.isStreaming && !m.isErrored)
        .slice(-HISTORY_TURNS)
        .map((m) => ({ role: m.role, content: m.content }));
      const messagesPayload = [
        ...priorHistory,
        { role: 'user' as const, content: trimmed },
      ];

      // Active-look propagation: derive from the prior messages so the
      // server keeps the same look in flight when the user is iterating
      // ("warmer", "swap the shoes"). The anchor flags ride along with the
      // current anchoredGarmentId so the server can lock that piece even
      // when the look is otherwise being refreshed. Honour any local
      // Clear-active-look so the next turn doesn't ship a stale look.
      // Codex P1-1.
      const clearedAt = activeLookClearedAtRef.current;
      // Q-D1 — also strip `isErrored` messages so a failed turn's partial
      // envelope (if any landed before the stream errored) can't become
      // the active look the next turn refines around. Codex P2 round 1
      // on PR #827.
      const lookSourceMessages = (clearedAt === null
        ? messagesRef.current
        : messagesRef.current.filter((m) => m.timestamp.getTime() >= clearedAt)
      ).filter((m) => !m.isErrored);
      const latestLook = getLatestActiveLook(lookSourceMessages);
      const activeLookPayload: StyleChatActiveLookInput | undefined = latestLook
        ? {
            garment_ids: latestLook.active_look?.garment_ids?.length
              ? latestLook.active_look.garment_ids
              : latestLook.outfit_ids,
            explanation:
              latestLook.active_look?.explanation
              ?? latestLook.outfit_explanation
              ?? null,
            source: 'mobile_chat_thread',
            anchor_garment_id: anchorRef.current,
            anchor_locked: Boolean(anchorRef.current),
          }
        : undefined;

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      setError(null);
      setSuggestionChips([]);

      abortRef.current?.abort();
      // Capture a local handle so the SSE callbacks honor the right signal
      // even if clearChat()/stopStreaming() null abortRef mid-flight.
      const controller = new AbortController();
      abortRef.current = controller;

      // Streaming strategy: prefer streamed deltas (visible streaming feel).
      // The envelope's full assistant_text comes first but is the SAME text
      // the deltas reconstruct chunk-by-chunk — using both would either
      // double-render or flash-then-collapse. We hold the envelope as a
      // fallback in case zero deltas arrive (degraded path); deltas, when
      // they land, overwrite the placeholder progressively.
      const acc = makeAccumulator();
      // M23 — capture the active mode at send time so the route + the
      // persisted envelope reflect what the user chose, even if they
      // toggle modes mid-stream (which also fires the abort path above).
      const turnMode = currentModeRef.current;
      const turnFunctionName = ROUTE_BY_MODE[turnMode];

      // rAF-coalesced flush — a 200-token reply arrives as ~200 micro-tasks
      // resolving at sub-frame intervals; firing setMessages per chunk costs
      // 200 renders. We accumulate the rolling content and let a single
      // rAF tick land it on the next frame (~16ms cap, ~60 renders/sec
      // worst case). Codex audit P2-3.
      let pendingFlush = false;
      const flushBubble = () => {
        if (controller.signal.aborted) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: acc.deltaAccumulated,
                  stylistMeta:
                    acc.envelopeMeta && acc.shoppingResults && acc.shoppingResults.length > 0
                      ? { ...acc.envelopeMeta, shopping_results: acc.shoppingResults }
                      : acc.envelopeMeta,
                }
              : m,
          ),
        );
      };
      const scheduleBubbleFlush = () => {
        if (pendingFlush) return;
        pendingFlush = true;
        requestAnimationFrame(() => {
          pendingFlush = false;
          flushBubble();
        });
      };
      // Envelope-receipt seed — the original setMessages callback overwrites
      // content with `deltaAccumulated || envelopeFallback || m.content` and
      // stylistMeta with the merged envelope. Mirror that here so the chunk
      // handler can call out via the `onAssistantBubbleUpdate` callback.
      const onAssistantBubbleUpdate = (next: {
        content: string;
        stylistMeta: StyleChatResponseEnvelope | null;
      }) => {
        if (controller.signal.aborted) return;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            return {
              ...m,
              content: next.content || m.content,
              stylistMeta: next.stylistMeta,
            };
          }),
        );
      };

      // Q-D2 — when the user is in refine mode, attach the locked garment
      // ids so `style_chat`'s engine swaps only the unlocked slots. Read
      // from the ref so a toggle that lands mid-render before this send
      // still rides along (matches the `anchorRef` / `currentModeRef` pattern).
      const refineSnapshot = refineModeRef.current;
      const lockedSlotsForRequest =
        refineSnapshot && refineSnapshot.lockedIds.size > 0
          ? Array.from(refineSnapshot.lockedIds)
          : undefined;

      // Q-D2 — override `active_look` with the refine-mode snapshot when
      // refining. Without this, refining an OLDER card after a NEWER
      // outfit was suggested would pair `getLatestActiveLook`'s active_look
      // (= the newer outfit) with `locked_slots` from the OLDER card —
      // the engine would refine the wrong look or ignore the locks
      // entirely. Codex P2 round 1 on Q-D2.
      const refineActiveLookPayload: StyleChatActiveLookInput | undefined = refineSnapshot
        ? {
            garment_ids: refineSnapshot.garmentIds,
            explanation: refineSnapshot.explanation || null,
            source: 'mobile_chat_refine',
            anchor_garment_id: anchorRef.current,
            anchor_locked: Boolean(anchorRef.current),
          }
        : undefined;
      const finalActiveLookPayload = refineActiveLookPayload ?? activeLookPayload;

      const requestBody = buildRequestBody({
        mode: turnMode,
        messagesPayload,
        anchoredGarmentId: anchorRef.current,
        activeLookPayload: finalActiveLookPayload,
        lockedSlots: lockedSlotsForRequest,
      });

      await fetchSSE(
        turnFunctionName,
        requestBody,
        {
          onData: (raw) => {
            handleStreamChunk(raw, acc, {
              onAssistantBubbleUpdate,
              onSuggestionChips: setSuggestionChips,
              scheduleBubbleFlush,
            });
          },
          onDone: () => {
            // Always release the rapid-tap guard, even when aborted —
            // otherwise a stop-then-resend would deadlock at the early
            // return inside sendMessage. Codex P2-7.
            streamingRef.current = false;
            if (controller.signal.aborted) return;
            // Degraded path: server delivered the envelope but no deltas
            // (e.g. tool-only response). Fall back to the envelope text so
            // the bubble shows the assistant's reply rather than staying
            // empty. Codex audit P1-3.
            const finalContent = acc.receivedDeltas ? acc.deltaAccumulated : acc.envelopeFallback;
            // M23 — shopping_chat streams text-only without a
            // stylist_response envelope, so envelopeMeta stays null on
            // that path. Synthesize a minimal envelope so the assistant
            // bubble can still render its mode pill ('Shopping') and so
            // any shopping_results land on a stable persistence shape.
            // For style mode we keep the full server envelope verbatim.
            const finalMeta = finalizeEnvelopeForMode(
              turnMode,
              acc.envelopeMeta,
              finalContent || acc.envelopeFallback,
              acc.shoppingResults,
            );
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: finalContent || m.content,
                      stylistMeta: finalMeta,
                      isStreaming: false,
                    }
                  : m,
              ),
            );
            setIsStreaming(false);
            // Q-D2 — advance refine state with the just-generated outfit
            // so the NEXT refine turn targets the new look (matching web
            // `useRefineMode.pushRefinement` at AIChat.tsx:972-976). If
            // we skipped this, a second "make it dressier" inside the
            // same refine session would still send the original card's
            // `active_look` + lockedIds, undoing or ignoring the look the
            // engine just produced. Codex P2 round 2 on PR #828. Locked
            // ids are filtered to those that survived into the new
            // outfit — items the engine swapped out are unlockable.
            if (refineModeRef.current && finalMeta) {
              const nextIds = (finalMeta.active_look?.garment_ids?.length
                ? finalMeta.active_look.garment_ids
                : finalMeta.outfit_ids ?? []) as string[];
              if (nextIds.length > 0) {
                const nextExplanation =
                  (finalMeta.active_look?.explanation as string | undefined)
                  ?? (finalMeta.outfit_explanation as string | undefined)
                  ?? refineModeRef.current.explanation;
                const survivingLocks = new Set<string>();
                for (const id of refineModeRef.current.lockedIds) {
                  if (nextIds.includes(id)) survivingLocks.add(id);
                }
                setRefineMode({
                  messageId: refineModeRef.current.messageId,
                  garmentIds: nextIds.slice(),
                  explanation: nextExplanation,
                  lockedIds: survivingLocks,
                });
              }
            }
            // Persist the just-completed turn pair so a refresh resumes
            // the same conversation. Skip when we have nothing meaningful
            // to record (degraded zero-text path with no envelope).
            if (finalContent || finalMeta) {
              // G1 — Codex P2 round 1: invalidate `chatHistory` AFTER
              // persistMessages resolves, not in parallel. The previous
              // `void persistMessages(...) ; queryClient.invalidate(...)`
              // pattern raced — if the invalidation refetched while the
              // INSERT was still in flight, the sheet would cache stale
              // thread counts until the next manual refresh. Chain off
              // the persist promise so the refetch always sees the new
              // rows.
              //
              // G1 — Codex P2 round 5: also bookkeep the per-cacheKey
              // pendingPersist counter so the hydration effect can
              // distinguish this in-flight INSERT from a legitimate
              // remote shrink. Increment before await, decrement in
              // finally so a transient INSERT failure doesn't leak the
              // pending count.
              const persistKey = cacheKey(user.id, turnMode);
              pendingPersistRef.current.set(
                persistKey,
                (pendingPersistRef.current.get(persistKey) ?? 0) + 1,
              );
              void persistMessages(user.id, turnMode, [
                { role: 'user', content: trimmed },
                {
                  role: 'assistant',
                  content: finalContent || acc.envelopeFallback,
                  stylistMeta: finalMeta,
                },
              ])
                .then(() => {
                  queryClient.invalidateQueries({
                    queryKey: ['chatHistory', user.id],
                  });
                })
                .finally(() => {
                  const next = (pendingPersistRef.current.get(persistKey) ?? 1) - 1;
                  if (next <= 0) pendingPersistRef.current.delete(persistKey);
                  else pendingPersistRef.current.set(persistKey, next);
                });
            }
            // Refresh the per-mode buffer cache with the just-completed
            // turn pair so a mode toggle away-and-back doesn't re-fetch.
            // We read the post-flush snapshot via messagesRef on the
            // next tick — the setMessages call above commits before
            // this microtask resolves under React 18's auto-batching,
            // but the safer pattern is to defer one tick.
            queueMicrotask(() => {
              if (user?.id) {
                messageCacheRef.current.set(
                  cacheKey(user.id, turnMode),
                  messagesRef.current.filter((m) => !m.isStreaming),
                );
              }
            });
          },
          onError: (err) => {
            // Same release as onDone — required so the user can retry.
            streamingRef.current = false;
            if (controller.signal.aborted) return;
            // Don't burn Sentry quota on the expected paywall sentinel —
            // those are subscription gating, not real failures.
            const isPaywall = err.message === SUBSCRIPTION_SENTINEL;
            if (!isPaywall) {
              Sentry.withScope((s) => {
                s.setTag('mutation', 'useStyleChat');
                // Q-D1 — extra context so we can pinpoint which turn / mode
                // surfaced an error when investigating the silent-failure
                // path. `errorName` distinguishes `EdgeFunctionTimeoutError`
                // / `EdgeFunctionRateLimitError` / `AbortError` / `TypeError`
                // (network) etc; `turnMode` lets us see if shopping vs style
                // routes diverge.
                s.setTag('chatTurnMode', turnMode);
                s.setTag('errorName', err.name || 'Error');
                if (err.message) s.setExtra('errorMessage', err.message);
                Sentry.captureException(err);
              });
            }
            // Empty err.message would have left both the banner suppressed
            // (`error && error !== SUBSCRIPTION_SENTINEL` is `'' && …` →
            // null) AND the inline bubble removed below — net result was
            // pure silence after the user's question. Set a non-empty
            // fallback so the banner always renders. Codex Q-D1.
            const surfacedError = isPaywall
              ? err.message
              : err.message || tr('chat.error.generic');
            setError(surfacedError);
            setIsStreaming(false);
            // Q-D1 — keep the assistant placeholder around, even on error.
            // The previous filter-out path produced "user message → silence"
            // when the stream failed because the inline bubble disappeared
            // alongside the banner suppression above. Now the placeholder
            // stays with an explanatory body so the user always sees that
            // the turn happened and can spot the Retry pill. Paywall path
            // gets a tailored body so the user knows it's a subscription
            // gate rather than a transient failure.
            // Paywall path reuses the existing `chat.error.premium.body`
            // copy so the inline bubble matches the Alert wording exactly
            // (one source of truth for the subscription gate). Codex P2-2
            // round 1 review on Q-D1.
            const fallbackContent = isPaywall
              ? tr('chat.error.premium.body')
              : tr('chat.error.inlineFallback');
            // Q-D1 — also drop any partial `stylistMeta` the placeholder
            // picked up before the stream errored. A `stylist_response`
            // envelope can land before deltas start flowing, so the
            // placeholder's `stylistMeta` may already carry
            // `render_outfit_card`, `outfit_ids`, `active_look`, or
            // `shopping_results`. Without nulling it, `MessageItem` would
            // still render the outfit/shopping cards and the long-press
            // anchor gesture would stay live on a turn the UI itself says
            // failed. Codex P2 round 2 on PR #827.
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: fallbackContent,
                      isStreaming: false,
                      isErrored: true,
                      stylistMeta: null,
                    }
                  : m,
              ),
            );
          },
        },
        controller.signal,
      );
    },
    // session.access_token + user.id are the stable deps — messagesRef and
    // anchorRef are read by ref so we don't churn the callback identity
    // per chunk or per anchor change. cacheKey + queryClient are stable
    // refs from React (queryClient identity is constant across renders
    // by react-query's contract; cacheKey is a useCallback with no deps).
    [session?.access_token, user?.id, isStreaming, cacheKey, queryClient],
  );

  const clearChat = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = null;
    streamingRef.current = false;
    setMessages([]);
    setIsStreaming(false);
    setError(null);
    setSuggestionChips([]);
    setAnchoredGarmentIdState(null);
    setActiveLookClearedAt(null);
    // Q-D2 — clearing the thread also drops refine state; otherwise the
    // hidden `locked_slots` payload would ride into the very next turn
    // (which is starting from a clean slate by the user's explicit intent).
    setRefineMode(null);
    if (!user?.id) return;
    // G1 — clear only the current mode's thread so toggling between
    // Style and Shopping doesn't wipe the inactive thread by surprise.
    // The web's AIChat applies the same per-mode delete semantics.
    const persistedMode = persistedModeFor(currentModeRef.current);
    messageCacheRef.current.delete(cacheKey(user.id, currentModeRef.current));
    const { error: deleteError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', user.id)
      .eq('mode', persistedMode);
    if (deleteError) {
      // History wipe failure shouldn't freeze the UI — the local state is
      // already cleared. Log so we can spot RLS regressions.
      console.warn('[useStyleChat] clearChat delete failed:', deleteError.message);
    }
    // G1 — surface the cleared thread to ChatHistorySheet on the next
    // open. We invalidate even if the DELETE returned an error: the
    // sheet refetch will reconcile against the actual row state.
    queryClient.invalidateQueries({ queryKey: ['chatHistory', user.id] });
  }, [user?.id, cacheKey, queryClient]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    streamingRef.current = false;
    // Persist the partial assistant reply paired with the user's prompt
    // so a refresh keeps both. The user typed something and the assistant
    // gave a partial response — both are worth keeping. We walk
    // bottom-up to find the streaming assistant + the user msg
    // immediately preceding it. Codex P2-8.
    const snapshot = messagesRef.current;
    let assistantIdx = -1;
    for (let i = snapshot.length - 1; i >= 0; i -= 1) {
      if (snapshot[i].role === 'assistant' && snapshot[i].isStreaming) {
        assistantIdx = i;
        break;
      }
    }
    if (assistantIdx >= 0 && user?.id) {
      const assistantMsg = snapshot[assistantIdx];
      // Find the closest preceding user msg.
      let userMsg: ChatMessage | null = null;
      for (let i = assistantIdx - 1; i >= 0; i -= 1) {
        if (snapshot[i].role === 'user') {
          userMsg = snapshot[i];
          break;
        }
      }
      // Only persist when the assistant produced at least some text
      // (or attached an envelope) — empty turns are noise.
      if (userMsg && (assistantMsg.content || assistantMsg.stylistMeta)) {
        void persistMessages(user.id, currentModeRef.current, [
          { role: 'user', content: userMsg.content },
          {
            role: 'assistant',
            content: assistantMsg.content,
            stylistMeta: assistantMsg.stylistMeta ?? null,
          },
        ]);
      }
    }
    setIsStreaming(false);
    setMessages((prev) => prev.map((m) => ({ ...m, isStreaming: false })));
  }, [user?.id]);

  // Cancel any in-flight stream when the consumer screen unmounts so the
  // SSE callbacks don't fire setState against a torn-down tree (RN logs
  // those as warnings). Codex P2 round on PR #738.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      streamingRef.current = false;
    };
  }, []);

  return {
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
  };
}
