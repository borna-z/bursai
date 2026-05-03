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

import { useCallback, useRef, useState } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { supabaseUrl } from '../lib/supabase';
import { fetchSSE, getEdgeFunctionUrl } from '../lib/sse';

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

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      setError(null);

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      // Track text written by either the seed envelope (full text) or by
      // streamed deltas. If we get the envelope first we seed the bubble; if
      // deltas arrive we *replace* the bubble's content with the running
      // delta accumulator so we don't double-render the same text.
      let seeded = false;
      let deltaAccumulated = '';

      // Send the message turn the user just typed (already in messagesRef but
      // not yet flushed) — pull the prior turns from the ref to avoid stale
      // closures.
      const history = messagesRef.current
        .slice(-10)
        .filter((m) => m.role !== 'assistant' || !m.isStreaming)
        .map((m) => ({ role: m.role, content: m.content }));

      await fetchSSE(
        getEdgeFunctionUrl(supabaseUrl, 'style_chat'),
        {
          message: trimmed,
          history,
          locale: 'en',
        },
        session.access_token,
        {
          onData: (raw) => {
            let parsed: StyleChatChunk | null = null;
            try {
              parsed = JSON.parse(raw) as StyleChatChunk;
            } catch {
              // Plain-text fragment — append directly.
              deltaAccumulated += raw;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: deltaAccumulated || m.content }
                    : m,
                ),
              );
              return;
            }

            if (parsed && 'type' in parsed && parsed.type === 'stylist_response') {
              const seedText = parsed.payload?.assistant_text ?? '';
              if (seedText && !seeded) {
                seeded = true;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: seedText } : m,
                  ),
                );
              }
              return;
            }

            if (parsed && 'choices' in parsed) {
              const piece = parsed.choices?.[0]?.delta?.content ?? '';
              if (!piece) return;
              deltaAccumulated += piece;
              // Once any delta arrives, switch the bubble to delta mode so we
              // stop showing the seed-text envelope and start showing the
              // progressively-streamed text instead.
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: deltaAccumulated } : m,
                ),
              );
              return;
            }

            if (parsed && 'text' in parsed && typeof parsed.text === 'string') {
              deltaAccumulated += parsed.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: deltaAccumulated } : m,
                ),
              );
            }
            // suggestions / metadata events: ignored — UI uses static chips
            // in W4. W4.5+ surface server-provided chips.
          },
          onDone: () => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, isStreaming: false } : m,
              ),
            );
            setIsStreaming(false);
          },
          onError: (err) => {
            setError(err.message);
            setIsStreaming(false);
            // Drop the empty assistant placeholder on failure; the user
            // message stays so they can retry without retyping.
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          },
        },
        abortRef.current.signal,
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

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    clearChat,
    stopStreaming,
  };
}
