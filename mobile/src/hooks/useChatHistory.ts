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

const CHAT_HISTORY_LIMIT = 200;

function normalizeMode(rawMode: string | null): StyleChatMode | null {
  if (!rawMode) return 'style';
  if (rawMode === 'shopping') return 'shopping';
  // Web persists legacy threads under `stylist` and ad-hoc subkeys like
  // `stylist:<id>`. Collapse anything stylist-shaped into the 'style'
  // bucket so a cross-device user sees a single Style thread instead of
  // a row per legacy session id.
  if (rawMode === 'stylist' || rawMode.startsWith('stylist')) return 'style';
  return null;
}

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
      // Order descending and cap at CHAT_HISTORY_LIMIT so a user with
      // 200+ chat rows sees the latest activity per mode rather than
      // the oldest. The original ascending+limit query (Codex P2 round
      // 1 on PR #789) could mask a recently-active mode entirely if
      // all 200 oldest rows were from the other mode. After the SELECT
      // we reverse the rows so the bucketing pass walks oldest→newest
      // within the recent window, preserving the "first user message
      // is the preview" semantic (now interpreted as the first user
      // message in the recent window — sufficient for a thread snippet).
      const { data, error } = await supabase
        .from('chat_messages')
        .select('role, content, created_at, mode')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(CHAT_HISTORY_LIMIT);
      if (error) throw error;
      const rows = ((data ?? []) as ChatHistoryRow[]).slice().reverse();
      const buckets = new Map<StyleChatMode, ChatHistoryThreadSummary>();
      for (const row of rows) {
        const mode = normalizeMode(row.mode);
        if (!mode) continue;
        const existing = buckets.get(mode);
        const isUser = row.role === 'user';
        if (!existing) {
          buckets.set(mode, {
            mode,
            preview: isUser ? extractPreview(row.content) : '',
            updatedAt: row.created_at,
            messageCount: 1,
          });
          continue;
        }
        existing.messageCount += 1;
        // Prefer the FIRST user message as the preview line — same shape
        // as a generic chat-list affordance. Skip subsequent updates
        // once a preview is set.
        if (!existing.preview && isUser) {
          existing.preview = extractPreview(row.content);
        }
        // Track the latest activity stamp regardless of role.
        if (row.created_at > existing.updatedAt) {
          existing.updatedAt = row.created_at;
        }
      }
      return Array.from(buckets.values());
    },
    staleTime: 30_000,
  });
}
