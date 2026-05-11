import { Sentry } from '../lib/sentry';
import { supabase } from '../lib/supabase';
import {
  isStyleChatResponseEnvelope,
  type PersistedStyleChatMessage,
  type ShoppingResultCard,
  type StyleChatResponseEnvelope,
} from '../lib/styleChatContract';

// M23 — chat-mode toggle. `style` routes to the existing `style_chat`
// edge function (8-mode contract from M14); `shopping` routes to the
// `shopping_chat` edge function (focuses on what to buy + where, returns
// text + reserved `shopping_results` envelope for future product cards).
//
// Mirrors the StyleChatScreen segmented control. Adding a new mode here
// means updating ROUTE_BY_MODE below + the `setMode` typing.
export type StyleChatMode = 'style' | 'shopping';

export const ROUTE_BY_MODE: Record<StyleChatMode, string> = {
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
  /** Q-D1 — true when this message is a localized error fallback (the
   *  stream failed before producing real assistant content). Set so the
   *  fallback copy never leaks into the next turn's `priorHistory`
   *  payload to the edge function — Codex P2 round 1 review. */
  isErrored?: boolean;
};

export type StyleChatChunk =
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
export const HYDRATION_LIMIT = 100;
export const HISTORY_TURNS = 9;

export type StoredRow = {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

// Mirror of web's `parseStoredMessage` (src/pages/AIChat.tsx) for mobile
// strings only. JSON content with `kind: 'stylist_message'` decodes into a
// ChatMessage carrying both the assistant text and the contract envelope;
// anything else (including legacy plain-text rows) treats `content` as the
// raw bubble text.
export function parseStoredMessage(row: StoredRow, index: number): ChatMessage {
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
export async function persistMessages(
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
export function mergeShoppingResults(
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
export function finalizeEnvelopeForMode(
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
