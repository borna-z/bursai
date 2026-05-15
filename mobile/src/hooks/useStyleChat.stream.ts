import { fetchSSE } from '../lib/sse';
import { getLocale } from '../lib/i18n';
import {
  isStyleChatResponseEnvelope,
  parseShoppingResultCards,
  type ShoppingResultCard,
  type StyleChatActiveLookInput,
  type StyleChatResponseEnvelope,
} from '../lib/styleChatContract';
import {
  mergeShoppingResults,
  type StyleChatChunk,
  type StyleChatMode,
} from './useStyleChat.helpers';

export type StreamMessagePayload = { role: 'user' | 'assistant'; content: string };

export type StyleChatRequestBody =
  | {
      messages: StreamMessagePayload[];
      locale: string;
    }
  | {
      messages: StreamMessagePayload[];
      locale: string;
      selected_garment_ids?: string[];
      active_look?: StyleChatActiveLookInput;
      /** Q-D2 — garment ids the user has locked in refine mode. `style_chat`
       *  reads this at supabase/functions/style_chat/index.ts:1556-1565 +
       *  injects a system-prompt directive ("LOCKED these garments (do NOT
       *  swap them)…") so the engine regenerates only the unlocked slots.
       *  Omitted when the user isn't refining or has unlocked everything. */
      locked_slots?: string[];
      /** T-B — full wardrobe garment-id list from React Query cache. When
       *  set (length ≥ 5), the server skips its user-wide wardrobe scan
       *  and instead does an indexed `.in("id", …)` SELECT. Omitted when
       *  empty or fewer than 5 garments (server then falls back to the
       *  legacy ORDER BY path). Never set in `shopping` mode. */
      wardrobe_garment_ids?: string[];
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
// T-B — soft client-side cap on the wardrobe-id passthrough. The server
// caps its own SELECT at `.limit(120)` so anything beyond that is wasted
// payload; we clip at 200 to leave a buffer for power users whose top-N
// might shift between turns while still keeping requests light.
const WARDROBE_IDS_MAX = 200;

export function buildRequestBody(args: {
  mode: StyleChatMode;
  messagesPayload: StreamMessagePayload[];
  anchoredGarmentId: string | null;
  activeLookPayload: StyleChatActiveLookInput | undefined;
  /** Q-D2 — locked garment ids from refine mode. Inlined as
   *  `locked_slots` on the request only when non-empty. */
  lockedSlots?: string[];
  /** T-B — wardrobe garment ids (from React Query cache) to scope the
   *  server's wardrobe SELECT. Spread into the body only on the
   *  non-shopping branch and only when non-empty; clipped to the first
   *  {@link WARDROBE_IDS_MAX} entries. */
  wardrobeGarmentIds?: string[];
}): StyleChatRequestBody {
  const {
    mode,
    messagesPayload,
    anchoredGarmentId,
    activeLookPayload,
    lockedSlots,
    wardrobeGarmentIds,
  } = args;
  if (mode === 'shopping') {
    // T-B — shopping mode MUST NOT carry `wardrobe_garment_ids`. The
    // shopping_chat function destructures only { messages, locale } and
    // shipping the field would leak wardrobe state into a chat route
    // that's intentionally wardrobe-agnostic.
    return {
      messages: messagesPayload,
      locale: getLocale() ?? 'en',
    };
  }
  const clippedWardrobeIds =
    wardrobeGarmentIds && wardrobeGarmentIds.length > 0
      ? wardrobeGarmentIds.slice(0, WARDROBE_IDS_MAX)
      : null;
  return {
    messages: messagesPayload,
    locale: getLocale() ?? 'en',
    ...(anchoredGarmentId ? { selected_garment_ids: [anchoredGarmentId] } : {}),
    ...(activeLookPayload ? { active_look: activeLookPayload } : {}),
    ...(lockedSlots && lockedSlots.length > 0 ? { locked_slots: lockedSlots } : {}),
    ...(clippedWardrobeIds ? { wardrobe_garment_ids: clippedWardrobeIds } : {}),
  };
}

// Mutable state owned by sendMessage and threaded into the chunk handler.
// Kept as a plain interface (not a class) because the original code
// accumulates these via closure variables — this preserves the same
// reference semantics when the chunk handler mutates them.
export interface StreamAccumulator {
  envelopeFallback: string;
  deltaAccumulated: string;
  receivedDeltas: boolean;
  envelopeMeta: StyleChatResponseEnvelope | null;
  shoppingResults: ShoppingResultCard[] | null;
}

export function makeAccumulator(): StreamAccumulator {
  return {
    envelopeFallback: '',
    deltaAccumulated: '',
    receivedDeltas: false,
    envelopeMeta: null,
    shoppingResults: null,
  };
}

export type ChunkHandlerCallbacks = {
  onAssistantBubbleUpdate: (next: {
    content: string;
    stylistMeta: StyleChatResponseEnvelope | null;
  }) => void;
  onSuggestionChips: (chips: string[]) => void;
  scheduleBubbleFlush: () => void;
};

// Dispatch a single SSE chunk into the accumulator + callbacks. Mirrors
// the original switch ladder verbatim — the only behavioural difference
// is that `setMessages`-based bubble seeding is delegated to
// onAssistantBubbleUpdate so the caller controls React Query / abort
// signal coupling.
export function handleStreamChunk(
  raw: string,
  acc: StreamAccumulator,
  callbacks: ChunkHandlerCallbacks,
): void {
  let parsed: StyleChatChunk | null = null;
  try {
    parsed = JSON.parse(raw) as StyleChatChunk;
  } catch {
    // Plain-text fragment — append directly.
    acc.receivedDeltas = true;
    acc.deltaAccumulated += raw;
    callbacks.scheduleBubbleFlush();
    return;
  }

  if (parsed && 'type' in parsed && parsed.type === 'stylist_response') {
    if (isStyleChatResponseEnvelope(parsed.payload)) {
      acc.envelopeMeta = parsed.payload;
      acc.envelopeFallback = parsed.payload.assistant_text ?? '';
      // M23 — if the envelope carried shopping_results inline
      // (forward-compat with a server tool emission that fuses
      // the response + cards into one payload), normalize them
      // through the same defensive accessor.
      const inlineCards = parseShoppingResultCards(parsed.payload.shopping_results);
      if (inlineCards) acc.shoppingResults = inlineCards;
      // Surface the envelope on the streaming bubble immediately so
      // the mode pill + active-look badge can render before any
      // deltas land.
      const nextContent = acc.deltaAccumulated || acc.envelopeFallback;
      callbacks.onAssistantBubbleUpdate({
        content: nextContent,
        stylistMeta: mergeShoppingResults(acc.envelopeMeta, acc.shoppingResults),
      });
    }
    return;
  }

  if (parsed && 'type' in parsed && parsed.type === 'suggestions') {
    const chips = Array.isArray(parsed.chips)
      ? parsed.chips.filter((c): c is string => typeof c === 'string')
      : [];
    callbacks.onSuggestionChips(chips);
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
      acc.shoppingResults = cards;
      callbacks.scheduleBubbleFlush();
    }
    return;
  }

  if (parsed && 'choices' in parsed) {
    const piece = parsed.choices?.[0]?.delta?.content ?? '';
    if (!piece) return;
    acc.receivedDeltas = true;
    acc.deltaAccumulated += piece;
    callbacks.scheduleBubbleFlush();
    return;
  }

  if (parsed && 'text' in parsed && typeof parsed.text === 'string') {
    acc.receivedDeltas = true;
    acc.deltaAccumulated += parsed.text;
    callbacks.scheduleBubbleFlush();
  }
  // metadata events: silently ignored — truncation is reflected in
  // the envelope itself.
}

// Re-export fetchSSE through this module so consumers don't need to
// import from `../lib/sse` separately when they're already importing
// the stream helpers.
export { fetchSSE };
