// useStyleChat — drives StyleChatScreen via the streaming `style_chat` edge
// function. SSE format the function emits (verified by reading
// supabase/functions/style_chat/index.ts):
//
//   1. `data: {"type":"stylist_response","payload":envelope}\n\n`
//      — full envelope first, contains assistant_text, suggestion_chips,
//        outfit refs. We use the envelope to seed the bubble immediately
//        so the user doesn't see an empty assistant message; the per-chunk
//        deltas below then *replace* (not append) the seed for visual
//        streaming feel.
//   2. zero-or-more `data: {"choices":[{"delta":{"content":"..."}}]}`
//      — OpenAI-style streamed text. Concatenated into accumulated text.
//   3. `data: {"type":"suggestions","chips":[...]}` — ignored client-side
//      for now (chips are static in W4; W4.5 hook will surface them).
//   4. `data: [DONE]\n\n` — close.
//
// Subscription-locked → onError fires with sentinel 'subscription_required'.
// AbortController is exposed via stopStreaming() and clearChat() so the
// screen unmount effect can cancel an in-flight stream cleanly.

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { fetchSSE } from '../lib/sse';
import { Sentry } from '../lib/sentry';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
};

type StyleChatChunk =
  | { type: 'stylist_response'; payload: { assistant_text?: string } }
  | { type: 'suggestions'; chips: unknown[] }
  | { type: 'metadata'; truncated?: boolean }
  | { choices?: { delta?: { content?: string } }[] }
  | { text?: string };

export function useStyleChat() {
  const { session } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Latest messages snapshot — used inside sendMessage to assemble the 10-turn
  // history without re-binding sendMessage on every message append (which would
  // otherwise re-render every consumer of the hook on every chunk).
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const sendMessage = useCallback(
    async (content: string) => {
      if (!session?.access_token || !content.trim()) return;
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
      };

      // Build the messages payload from the PRIOR snapshot (before we append
      // the new turn to state). messagesRef holds the last-rendered state so
      // we get the correct prior history without race risk. Edge contract
      // (supabase/functions/style_chat/index.ts:933-946) requires a `messages`
      // array with role+content, latest user turn last; the body shape is
      // strictly validated and rejects with HTTP 400 otherwise.
      const priorHistory = messagesRef.current
        .filter((m) => !m.isStreaming)
        .slice(-9)
        .map((m) => ({ role: m.role, content: m.content }));
      const messagesPayload = [
        ...priorHistory,
        { role: 'user' as const, content: trimmed },
      ];

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      setError(null);

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

      // rAF-coalesced flush — a 200-token reply arrives as ~200 micro-tasks
      // resolving at sub-frame intervals; firing setMessages per chunk costs
      // 200 renders. We accumulate the rolling content and let a single
      // rAF tick land it on the next frame (~16ms cap, ~60 renders/sec
      // worst case). flushPending() also runs synchronously on done/error
      // so the bubble settles to its final state without a trailing frame
      // gap. Codex audit P2-3 (audit 3).
      let pendingFlush = false;
      const flushBubble = () => {
        if (controller.signal.aborted) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: deltaAccumulated } : m,
          ),
        );
      };
      const scheduleBubbleFlush = () => {
        if (pendingFlush) return;
        pendingFlush = true;
        // RN polyfills requestAnimationFrame; the closure captures the
        // assistantId/controller for this turn so a new turn's flush
        // doesn't poison this one.
        requestAnimationFrame(() => {
          pendingFlush = false;
          flushBubble();
        });
      };

      await fetchSSE(
        'style_chat',
        { messages: messagesPayload, locale: 'en' },
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
              envelopeFallback = parsed.payload?.assistant_text ?? '';
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
            // suggestions / metadata events: ignored — UI uses static chips
            // in W4. W4.5+ surface server-provided chips.
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
                  ? { ...m, content: finalContent || m.content, isStreaming: false }
                  : m,
              ),
            );
            setIsStreaming(false);
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
    // session.access_token is the only stable dep — messagesRef is read by
    // ref so we don't churn the callback identity per chunk.
    [session?.access_token, isStreaming],
  );

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setIsStreaming(false);
    setError(null);
  }, []);

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
    sendMessage,
    clearChat,
    stopStreaming,
  };
}
