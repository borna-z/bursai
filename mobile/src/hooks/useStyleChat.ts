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

import { useAuth } from '../contexts/AuthContext';
import { fetchSSE } from '../lib/sse';
import { Sentry } from '../lib/sentry';
import { supabase } from '../lib/supabase';
import { getLocale } from '../lib/i18n';
import {
  isStyleChatResponseEnvelope,
  type PersistedStyleChatMessage,
  type StyleChatActiveLookInput,
  type StyleChatResponseEnvelope,
} from '../lib/styleChatContract';
import { getLatestActiveLook } from '../lib/chatActiveLook';

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
}

type StyleChatChunk =
  | { type: 'stylist_response'; payload: unknown }
  | { type: 'suggestions'; chips?: unknown[] }
  | { type: 'metadata'; truncated?: boolean }
  | { choices?: { delta?: { content?: string } }[] }
  | { text?: string };

const STYLIST_MODE = 'stylist';
const HYDRATION_LIMIT = 100;
const HISTORY_TURNS = 9;

type StoredRow = {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

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
        const text = typeof parsed.content === 'string' ? parsed.content : '';
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
  msgs: { role: 'user' | 'assistant'; content: string; stylistMeta?: StyleChatResponseEnvelope | null }[],
): Promise<void> {
  const rows = msgs.map((m) => {
    const content = m.stylistMeta
      ? JSON.stringify({
          kind: 'stylist_message',
          content: m.content,
          stylistMeta: m.stylistMeta,
        } satisfies PersistedStyleChatMessage)
      : m.content;
    return { user_id: userId, role: m.role, content, mode: STYLIST_MODE };
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

export function useStyleChat(): UseStyleChatResult {
  const { user, session } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState<boolean>(true);
  const [suggestionChips, setSuggestionChips] = useState<string[]>([]);
  const [anchoredGarmentId, setAnchoredGarmentIdState] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Latest messages snapshot — used inside sendMessage to assemble the
  // history payload + active-look without re-binding sendMessage on every
  // append (which would re-render every consumer of the hook on every chunk).
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const anchorRef = useRef<string | null>(null);
  anchorRef.current = anchoredGarmentId;

  // ─── Hydration ─────────────────────────────────────────────────────────
  // Restore the user's prior `stylist`-mode chat on mount. Gated on user.id
  // so a sign-out → sign-in cycle re-hydrates against the correct row set.
  useEffect(() => {
    let cancelled = false;
    const userId = user?.id;
    if (!userId) {
      setMessages([]);
      setIsHydrating(false);
      return () => {
        cancelled = true;
      };
    }
    setIsHydrating(true);
    (async () => {
      const { data, error: hydrateError } = await supabase
        .from('chat_messages')
        .select('role, content, created_at')
        .eq('user_id', userId)
        .eq('mode', STYLIST_MODE)
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
        setMessages([]);
        setIsHydrating(false);
        return;
      }
      const rows = (data ?? []) as StoredRow[];
      setMessages(rows.map((row, idx) => parseStoredMessage(row, idx)));
      setIsHydrating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const setAnchoredGarmentId = useCallback((id: string | null) => {
    setAnchoredGarmentIdState(id);
  }, []);

  const activeLook = useMemo(() => getLatestActiveLook(messages), [messages]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!session?.access_token || !user?.id || !content.trim()) return;
      if (isStreaming) return;

      const trimmed = content.trim();
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };

      const assistantId = `assistant-${Date.now()}`;
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
      // when the look is otherwise being refreshed.
      const latestLook = getLatestActiveLook(messagesRef.current);
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
              ? { ...m, content: deltaAccumulated, stylistMeta: envelopeMeta }
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

      const requestBody = {
        messages: messagesPayload,
        locale: getLocale() ?? 'en',
        ...(anchorRef.current ? { selected_garment_ids: [anchorRef.current] } : {}),
        ...(activeLookPayload ? { active_look: activeLookPayload } : {}),
      };

      await fetchSSE(
        'style_chat',
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
                // Surface the envelope on the streaming bubble immediately so
                // the mode pill + active-look badge can render before any
                // deltas land.
                if (!controller.signal.aborted) {
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantId) return m;
                      const nextContent = deltaAccumulated || envelopeFallback || m.content;
                      return { ...m, content: nextContent, stylistMeta: envelopeMeta };
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
            if (controller.signal.aborted) return;
            // Degraded path: server delivered the envelope but no deltas
            // (e.g. tool-only response). Fall back to the envelope text so
            // the bubble shows the assistant's reply rather than staying
            // empty. Codex audit P1-3.
            const finalContent = receivedDeltas ? deltaAccumulated : envelopeFallback;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: finalContent || m.content,
                      stylistMeta: envelopeMeta,
                      isStreaming: false,
                    }
                  : m,
              ),
            );
            setIsStreaming(false);
            // Persist the just-completed turn pair so a refresh resumes
            // the same conversation. Skip when we have nothing meaningful
            // to record (degraded zero-text path with no envelope).
            if (finalContent || envelopeMeta) {
              void persistMessages(user.id, [
                { role: 'user', content: trimmed },
                {
                  role: 'assistant',
                  content: finalContent || envelopeFallback,
                  stylistMeta: envelopeMeta,
                },
              ]);
            }
          },
          onError: (err) => {
            if (controller.signal.aborted) return;
            // Don't burn Sentry quota on the expected paywall sentinel —
            // those are subscription gating, not real failures.
            if (err.message !== 'subscription_required') {
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
    // per chunk or per anchor change.
    [session?.access_token, user?.id, isStreaming],
  );

  const clearChat = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setIsStreaming(false);
    setError(null);
    setSuggestionChips([]);
    setAnchoredGarmentIdState(null);
    if (!user?.id) return;
    const { error: deleteError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', user.id)
      .eq('mode', STYLIST_MODE);
    if (deleteError) {
      // History wipe failure shouldn't freeze the UI — the local state is
      // already cleared. Log so we can spot RLS regressions.
      console.warn('[useStyleChat] clearChat delete failed:', deleteError.message);
    }
  }, [user?.id]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setMessages((prev) => prev.map((m) => ({ ...m, isStreaming: false })));
  }, []);

  // Cancel any in-flight stream when the consumer screen unmounts so the
  // SSE callbacks don't fire setState against a torn-down tree (RN logs
  // those as warnings). Codex P2 round on PR #738.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
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
  };
}
