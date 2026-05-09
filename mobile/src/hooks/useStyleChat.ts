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
import { fetchSSE } from '../lib/sse';
import { Sentry } from '../lib/sentry';
import { supabase } from '../lib/supabase';
import { getLocale } from '../lib/i18n';
import {
  isStyleChatResponseEnvelope,
  parseShoppingResultCards,
  type PersistedStyleChatMessage,
  type ShoppingResultCard,
  type StyleChatActiveLookInput,
  type StyleChatResponseEnvelope,
} from '../lib/styleChatContract';
import { getLatestActiveLook } from '../lib/chatActiveLook';

// M23 — chat-mode toggle. `style` routes to the existing `style_chat`
// edge function (8-mode contract from M14); `shopping` routes to the
// `shopping_chat` edge function (focuses on what to buy + where, returns
// text + reserved `shopping_results` envelope for future product cards).
//
// Mirrors the StyleChatScreen segmented control. Adding a new mode here
// means updating ROUTE_BY_MODE below + the `setMode` typing.
export type StyleChatMode = 'style' | 'shopping';

const ROUTE_BY_MODE: Record<StyleChatMode, string> = {
  style: 'style_chat',
  shopping: 'shopping_chat',
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  stylistMeta?: StyleChatResponseEnvelope | null;
};

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
}

type StyleChatChunk =
  | { type: 'stylist_response'; payload: unknown }
  | { type: 'suggestions'; chips?: unknown[] }
  | { type: 'metadata'; truncated?: boolean }
  // M23 — forward-compat shopping result envelope. `shopping_chat`
  // streams text-only deltas today, so this branch is reserved for the
  // future product-tool emission and never fires in production yet.
  // Keeping the parser hot ensures a server upgrade flows through
  // without a client release.
  | { type: 'shopping_results'; results?: unknown }
  | { choices?: { delta?: { content?: string } }[] }
  | { text?: string };

const STYLIST_MODE = 'stylist';
const SHOPPING_MODE = 'shopping';
// G1 — translate the chat-mode toggle into the column value persisted in
// `chat_messages.mode`. Web's AIChat uses the same two values
// ('stylist' / 'shopping') so mobile + web hydrate against the same row
// set when the user moves between devices. Keeping the function exported
// so ChatHistorySheet can normalize stored rows into the toggle's union.
export function persistedModeFor(mode: StyleChatMode): string {
  return mode === 'shopping' ? SHOPPING_MODE : STYLIST_MODE;
}
const HYDRATION_LIMIT = 100;
const HISTORY_TURNS = 9;

type StoredRow = {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

// Module-level monotonic counter — combined with Date.now() to keep
// generated message ids unique even when sendMessage is called twice in
// the same millisecond (rapid-tap, scripted retry, etc.). Previously the
// id collided which made FlatList drop one of the two bubbles. Codex P2-10.
let messageIdCounter = 0;

// Mirror of web's `parseStoredMessage` (src/pages/AIChat.tsx) for mobile
// strings only. JSON content with `kind: 'stylist_message'` decodes into a
// ChatMessage carrying both the assistant text and the contract envelope;
// anything else (including legacy plain-text rows) treats `content` as the
// raw bubble text.
function parseStoredMessage(row: StoredRow, index: number): ChatMessage {
  const id = `${row.role}-hyd-${index}-${row.created_at}`;
  const timestamp = new Date(row.created_at);
  if (row.content.startsWith('{')) {
    try {
      const parsed = JSON.parse(row.content) as PersistedStyleChatMessage;
      if (parsed?.kind === 'stylist_message') {
        // Web's AIChat persists `content` as either a string OR an
        // OpenAI-style multimodal array (`[{type:'text',text}, {type:'image_url',...}]`).
        // Coercing the array to '' would drop user-typed text on mobile
        // hydration; instead, concatenate every text part. Non-text parts
        // (image attachments) have no mobile-visible representation today
        // — they're silently skipped, which is fine because the bubble
        // still shows what the user wrote. Codex P1-3.
        let text = '';
        if (typeof parsed.content === 'string') {
          text = parsed.content;
        } else if (Array.isArray(parsed.content)) {
          text = parsed.content
            .filter(
              (c): c is { type: 'text'; text: string } =>
                !!c
                && typeof c === 'object'
                && (c as { type?: unknown }).type === 'text'
                && typeof (c as { text?: unknown }).text === 'string',
            )
            .map((c) => c.text)
            .join(' ');
        }
        return {
          id,
          role: row.role,
          content: text,
          timestamp,
          stylistMeta: isStyleChatResponseEnvelope(parsed.stylistMeta)
            ? parsed.stylistMeta
            : null,
        };
      }
    } catch {
      // Fall through — legacy plain-text row.
    }
  }
  return { id, role: row.role, content: row.content, timestamp };
}

// Persist a {user, assistant} pair to `chat_messages`. Assistant turns
// carrying a stylist envelope are encoded as `PersistedStyleChatMessage`
// JSON so a subsequent hydration round-trips the mode pill + active-look
// state. Bare turns serialize their string content directly.
async function persistMessages(
  userId: string,
  mode: StyleChatMode,
  msgs: { role: 'user' | 'assistant'; content: string; stylistMeta?: StyleChatResponseEnvelope | null }[],
): Promise<void> {
  const persistedMode = persistedModeFor(mode);
  const rows = msgs.map((m) => {
    const content = m.stylistMeta
      ? JSON.stringify({
          kind: 'stylist_message',
          content: m.content,
          stylistMeta: m.stylistMeta,
        } satisfies PersistedStyleChatMessage)
      : m.content;
    return { user_id: userId, role: m.role, content, mode: persistedMode };
  });
  const { error } = await supabase.from('chat_messages').insert(rows);
  if (error) {
    // Don't surface persistence failure as a user-visible error — the bubble
    // already rendered. Log to Sentry so we can spot a broken RLS policy.
    Sentry.withScope((s) => {
      s.setTag('mutation', 'useStyleChat.persistMessages');
      Sentry.captureException(error);
    });
  }
}

// M23 — merges any accumulated shopping_results into a candidate envelope
// without mutating either input. Returns the envelope as-is when there
// are no results to attach; returns null when both inputs are empty so
// the bubble's stylistMeta stays a clean null in style-mode degraded
// paths.
function mergeShoppingResults(
  envelope: StyleChatResponseEnvelope | null,
  results: ShoppingResultCard[] | null,
): StyleChatResponseEnvelope | null {
  if (!envelope) return null;
  if (!results || results.length === 0) return envelope;
  return { ...envelope, shopping_results: results };
}

// M23 — Synthesize the assistant message's final envelope for the active
// mode. Style mode returns whatever the server delivered (or null when
// the server stayed silent — same as M14). Shopping mode synthesizes a
// minimal envelope tagged `mode: 'SHOPPING'` so the bubble can render
// the mode pill and any product cards even though the server doesn't
// emit a stylist_response payload today. The synthesized envelope uses
// neutral defaults for every other field — a future backend that DOES
// emit a stylist_response wins (the `envelope` arg is preferred when
// non-null).
function finalizeEnvelopeForMode(
  mode: StyleChatMode,
  envelope: StyleChatResponseEnvelope | null,
  finalText: string,
  results: ShoppingResultCard[] | null,
): StyleChatResponseEnvelope | null {
  if (envelope) return mergeShoppingResults(envelope, results);
  if (mode !== 'shopping') return null;
  // Shopping-mode + no server envelope. Build a minimal one so the
  // bubble can render its 'Shopping' mode pill and ShoppingResultCards
  // (when results land). Every other field is a neutral default.
  const synthetic: StyleChatResponseEnvelope = {
    kind: 'stylist_response',
    mode: 'SHOPPING',
    response_kind: 'style_explanation',
    card_policy: 'optional',
    card_state: 'unavailable',
    assistant_text: finalText,
    outfit_ids: [],
    outfit_explanation: '',
    garment_mentions: [],
    suggestion_chips: [],
    truncated: false,
    active_look_status: 'unavailable',
    active_look: {
      garment_ids: [],
      explanation: null,
      source: null,
      status: 'unavailable',
      card_state: 'unavailable',
      anchor_garment_id: null,
      anchor_locked: false,
    },
    fallback_used: false,
    degraded_reason: null,
    render_outfit_card: false,
    clear_active_look: false,
    shopping_results: results && results.length > 0 ? results : null,
  };
  return synthetic;
}

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
      messageCacheRef.current.set(cacheKey(userId, currentMode), parsed);
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
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      streamingRef.current = false;
      cache.clear();
      setIsStreaming(false);
      setMessages([]);
      setError(null);
      setSuggestionChips([]);
      setActiveLookClearedAt(null);
      setIsHydrating(true);
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
      // for the strict shape.
      const priorHistory = messagesRef.current
        .filter((m) => !m.isStreaming)
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
      const lookSourceMessages =
        clearedAt === null
          ? messagesRef.current
          : messagesRef.current.filter((m) => m.timestamp.getTime() >= clearedAt);
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
      let envelopeFallback = '';
      let deltaAccumulated = '';
      let receivedDeltas = false;
      let envelopeMeta: StyleChatResponseEnvelope | null = null;
      // M23 — accumulator for any product cards emitted by the
      // `shopping_chat` SSE stream. Today the function returns text-only,
      // so this stays null in production and the parser remains hot for
      // a future server upgrade. When populated, the cards land on the
      // assistant message's `stylistMeta.shopping_results` so the screen
      // renders ShoppingResultCards beneath the bubble.
      let shoppingResults: ShoppingResultCard[] | null = null;
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
                  content: deltaAccumulated,
                  stylistMeta: mergeShoppingResults(envelopeMeta, shoppingResults),
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

      // M23 — request body shape diverges by mode:
      //   • style_chat accepts { messages, locale, selected_garment_ids?,
      //     active_look? } (M14 8-mode contract).
      //   • shopping_chat (verified against
      //     supabase/functions/shopping_chat/index.ts) reads only
      //     { messages, locale } — selected_garment_ids and active_look
      //     are no-ops there. Shipping them anyway would still work but
      //     would also bleed style-chat anchor state into the shopping
      //     prompt's prior turns. Strip them so each route gets its
      //     intended payload.
      const requestBody =
        turnMode === 'shopping'
          ? {
              messages: messagesPayload,
              locale: getLocale() ?? 'en',
            }
          : {
              messages: messagesPayload,
              locale: getLocale() ?? 'en',
              ...(anchorRef.current ? { selected_garment_ids: [anchorRef.current] } : {}),
              ...(activeLookPayload ? { active_look: activeLookPayload } : {}),
            };

      await fetchSSE(
        turnFunctionName,
        requestBody,
        {
          onData: (raw) => {
            let parsed: StyleChatChunk | null = null;
            try {
              parsed = JSON.parse(raw) as StyleChatChunk;
            } catch {
              // Plain-text fragment — append directly.
              receivedDeltas = true;
              deltaAccumulated += raw;
              scheduleBubbleFlush();
              return;
            }

            if (parsed && 'type' in parsed && parsed.type === 'stylist_response') {
              if (isStyleChatResponseEnvelope(parsed.payload)) {
                envelopeMeta = parsed.payload;
                envelopeFallback = parsed.payload.assistant_text ?? '';
                // M23 — if the envelope carried shopping_results inline
                // (forward-compat with a server tool emission that fuses
                // the response + cards into one payload), normalize them
                // through the same defensive accessor.
                const inlineCards = parseShoppingResultCards(parsed.payload.shopping_results);
                if (inlineCards) shoppingResults = inlineCards;
                // Surface the envelope on the streaming bubble immediately so
                // the mode pill + active-look badge can render before any
                // deltas land.
                if (!controller.signal.aborted) {
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantId) return m;
                      const nextContent = deltaAccumulated || envelopeFallback || m.content;
                      return {
                        ...m,
                        content: nextContent,
                        stylistMeta: mergeShoppingResults(envelopeMeta, shoppingResults),
                      };
                    }),
                  );
                }
              }
              return;
            }

            if (parsed && 'type' in parsed && parsed.type === 'suggestions') {
              const chips = Array.isArray(parsed.chips)
                ? parsed.chips.filter((c): c is string => typeof c === 'string')
                : [];
              setSuggestionChips(chips);
              return;
            }

            if (parsed && 'type' in parsed && parsed.type === 'shopping_results') {
              // M23 — defensive accessor drops malformed cards rather
              // than rejecting the whole batch. The deployed
              // shopping_chat function does not emit this event today,
              // so this branch only activates when a future server
              // upgrade ships the structured product-card tool.
              const cards = parseShoppingResultCards(parsed.results);
              if (cards) {
                shoppingResults = cards;
                scheduleBubbleFlush();
              }
              return;
            }

            if (parsed && 'choices' in parsed) {
              const piece = parsed.choices?.[0]?.delta?.content ?? '';
              if (!piece) return;
              receivedDeltas = true;
              deltaAccumulated += piece;
              scheduleBubbleFlush();
              return;
            }

            if (parsed && 'text' in parsed && typeof parsed.text === 'string') {
              receivedDeltas = true;
              deltaAccumulated += parsed.text;
              scheduleBubbleFlush();
            }
            // metadata events: silently ignored — truncation is reflected in
            // the envelope itself.
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
            const finalContent = receivedDeltas ? deltaAccumulated : envelopeFallback;
            // M23 — shopping_chat streams text-only without a
            // stylist_response envelope, so envelopeMeta stays null on
            // that path. Synthesize a minimal envelope so the assistant
            // bubble can still render its mode pill ('Shopping') and so
            // any shopping_results land on a stable persistence shape.
            // For style mode we keep the full server envelope verbatim.
            const finalMeta = finalizeEnvelopeForMode(
              turnMode,
              envelopeMeta,
              finalContent || envelopeFallback,
              shoppingResults,
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
            // Persist the just-completed turn pair so a refresh resumes
            // the same conversation. Skip when we have nothing meaningful
            // to record (degraded zero-text path with no envelope).
            if (finalContent || finalMeta) {
              void persistMessages(user.id, turnMode, [
                { role: 'user', content: trimmed },
                {
                  role: 'assistant',
                  content: finalContent || envelopeFallback,
                  stylistMeta: finalMeta,
                },
              ]);
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
            // G1 — refresh the chat history sheet so the new turn
            // bumps the thread's updatedAt + message count next time
            // the user opens the sheet.
            queryClient.invalidateQueries({ queryKey: ['chatHistory', user.id] });
          },
          onError: (err) => {
            // Same release as onDone — required so the user can retry.
            streamingRef.current = false;
            if (controller.signal.aborted) return;
            // Don't burn Sentry quota on the expected paywall sentinel —
            // those are subscription gating, not real failures.
            if (err.message !== SUBSCRIPTION_SENTINEL) {
              Sentry.withScope((s) => {
                s.setTag('mutation', 'useStyleChat');
                Sentry.captureException(err);
              });
            }
            setError(err.message);
            setIsStreaming(false);
            // Drop the empty assistant placeholder on failure; the user
            // message stays so they can retry without retyping.
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
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
  };
}
