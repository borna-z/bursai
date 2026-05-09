// useChatHistory — summary of the user's chat threads, grouped by mode.
//
// The chat_messages table stores rows tagged with `mode` ('stylist' or
// 'shopping' on mobile, plus legacy `stylist:<thread>` patterns from
// web). For the history sheet today we collapse the rows into one
// thread per mode — same scope as web's per-mode persistence — and
// surface the latest message timestamp + first user-message snippet so
// the sheet rows render without an additional fetch.
//
// React Query refetches whenever the chat surface invalidates the
// 'chatHistory' query key (sendMessage / clearChat both do so via the
// queryClient passed in by the consumer). Pulling that wiring into a
// dedicated hook keeps StyleChatScreen's effects readable.

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { StyleChatMode } from './useStyleChat';

export interface ChatHistoryThreadSummary {
  mode: StyleChatMode;
  preview: string;
  updatedAt: string;
  messageCount: number;
}

interface ChatHistoryRow {
  role: string;
  content: string;
  created_at: string;
  mode: string | null;
}

// Per-mode row cap. Each canonical mode gets its own SELECT so a user
// with 200+ rows in one mode never starves the other mode of a
// fetched row (Codex P2 round 5 on PR #789). Lower than the prior
// global cap because we no longer compete for the same window.
//
// Bumped to 200 in N3.8 (G-012): the prior 100-row cap silently
// truncated long-running conversations — the latest 100 messages are
// usually only a handful of days for an active user, and the history
// sheet preview/messageCount depends on the full window. 200 doubles
// headroom without meaningfully changing the SELECT cost (chat_messages
// is indexed on (user_id, mode, created_at desc)).
const PER_MODE_LIMIT = 200;

// Canonical persisted modes mobile renders in the sheet. Web's legacy
// `stylist:<id>` ad-hoc rows are intentionally not in this list — the
// mobile hydrator selects strictly `.eq('mode', 'stylist')`, so
// surfacing a synthetic legacy row would open an empty thread. A
// future cross-device unification pass owns that migration.
const HISTORY_MODES: { mode: StyleChatMode; column: string }[] = [
  { mode: 'style', column: 'stylist' },
  { mode: 'shopping', column: 'shopping' },
];

function extractPreview(content: string): string {
  // Stylist envelopes are persisted as JSON with kind 'stylist_message';
  // strip the envelope wrapper so the preview is the raw text the user
  // saw on screen rather than a JSON dump.
  if (content.startsWith('{')) {
    try {
      const parsed = JSON.parse(content) as { content?: unknown };
      if (typeof parsed.content === 'string') return parsed.content;
      if (Array.isArray(parsed.content)) {
        const first = parsed.content.find(
          (c): c is { type: 'text'; text: string } =>
            !!c
            && typeof c === 'object'
            && (c as { type?: unknown }).type === 'text'
            && typeof (c as { text?: unknown }).text === 'string',
        );
        if (first) return first.text;
      }
    } catch {
      // Fall through — return raw content.
    }
  }
  return content;
}

export function useChatHistory() {
  const { user } = useAuth();
  return useQuery<ChatHistoryThreadSummary[]>({
    queryKey: ['chatHistory', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];
      // Codex P2 round 5 on PR #789: query each canonical mode
      // independently so a user with 200+ rows in one mode doesn't
      // starve the other mode of a fetched row. The prior global
      // query+limit could omit an active thread entirely. Each
      // SELECT is descending+capped+reversed so the bucketing pass
      // walks the most recent PER_MODE_LIMIT rows oldest→newest and
      // preserves the "first user message in the recent window is
      // the preview" semantic. Run in parallel so the round-trip is
      // a single network wait.
      const perMode = await Promise.all(
        HISTORY_MODES.map(async ({ mode, column }) => {
          const { data, error } = await supabase
            .from('chat_messages')
            .select('role, content, created_at, mode')
            .eq('user_id', user.id)
            .eq('mode', column)
            .order('created_at', { ascending: false })
            .limit(PER_MODE_LIMIT);
          if (error) throw error;
          const rows = ((data ?? []) as ChatHistoryRow[]).slice().reverse();
          if (rows.length === 0) return null;
          let preview = '';
          let updatedAt = rows[0].created_at;
          for (const row of rows) {
            const isUser = row.role === 'user';
            if (!preview && isUser) preview = extractPreview(row.content);
            if (row.created_at > updatedAt) updatedAt = row.created_at;
          }
          return {
            mode,
            preview,
            updatedAt,
            messageCount: rows.length,
          } satisfies ChatHistoryThreadSummary;
        }),
      );
      return perMode.filter((t): t is ChatHistoryThreadSummary => t !== null);
    },
    staleTime: 30_000,
  });
}
