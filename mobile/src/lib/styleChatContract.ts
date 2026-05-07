export type StylistChatMode =
  | "ACTIVE_LOOK_REFINEMENT"
  | "GARMENT_FIRST_STYLING"
  | "OUTFIT_GENERATION"
  | "WARDROBE_GAP_ANALYSIS"
  | "PURCHASE_PRIORITIZATION"
  | "STYLE_IDENTITY_ANALYSIS"
  | "LOOK_EXPLANATION"
  | "PLANNING"
  // M23 — 9th mode. Surfaced via the Style ↔ Shopping toggle in
  // StyleChatScreen and routed to the `shopping_chat` edge function
  // instead of `style_chat`. The server emits text-only deltas today
  // (it focuses on what to buy + where, with [[garment:ID]] tags
  // referencing the wardrobe), but the contract reserves a forward-
  // compat `shopping_results` envelope field so future tool-emitted
  // product cards flow through the same UI without a screen rewrite.
  | "SHOPPING";

export type StyleChatCardPolicy = "required" | "preserve_if_exists" | "optional";

export type StyleChatCardState = "new" | "updated" | "preserved" | "unavailable";

export type StyleChatResponseKind = "style_result" | "style_explanation" | "style_repair" | "analysis";

export type StyleChatActiveLookStatus = "new" | "preserved" | "updated" | "replaced" | "unavailable";

export type StyleChatIntentKind = "create" | "refine" | "explain" | "clarify";

export interface StyleChatActiveLookInput {
  garment_ids?: string[];
  explanation?: string | null;
  source?: string | null;
  anchor_garment_id?: string | null;
  anchor_locked?: boolean;
}

export interface StyleChatResolvedActiveLook {
  garment_ids: string[];
  explanation: string | null;
  source: string | null;
  status: StyleChatActiveLookStatus;
  card_state: StyleChatCardState;
  anchor_garment_id: string | null;
  anchor_locked: boolean;
}

// M23 — Shopping result card primitive.
//
// The deployed `shopping_chat` edge function streams plain text deltas
// today (no structured tool output), but the wave reserves a typed
// envelope so a future server-side product-tool emission threads through
// the same persisted message shape without breaking any callers.
//
// Surfaces:
//   • the assistant bubble's `stylistMeta.shopping_results` after the SSE
//     stream closes, when the server has emitted any results;
//   • `ShoppingResultCard` (mobile/src/components/ShoppingResultCard.tsx)
//     renders one card per entry beneath the bubble.
//
// Defensive accessors throughout the parser drop malformed cards rather
// than rejecting the whole message — partial server output should still
// surface text reliably.
export interface ShoppingResultCardPrice {
  amount: number;
  currency: string;
}

export interface ShoppingResultCard {
  id: string;
  title: string;
  image_url: string | null;
  price?: ShoppingResultCardPrice | null;
  merchant?: string | null;
  product_url: string;
  reason?: string | null;
}

export interface StyleChatResponseEnvelope {
  kind: "stylist_response";
  mode: StylistChatMode;
  response_kind: StyleChatResponseKind;
  card_policy: StyleChatCardPolicy;
  card_state: StyleChatCardState;
  assistant_text: string;
  outfit_ids: string[];
  outfit_explanation: string;
  garment_mentions: string[];
  suggestion_chips: string[];
  truncated: boolean;
  active_look_status: StyleChatActiveLookStatus;
  active_look: StyleChatResolvedActiveLook;
  fallback_used: boolean;
  degraded_reason: string | null;
  render_outfit_card: boolean;
  clear_active_look: boolean;
  // Optional, M23. Populated only for shopping-mode assistant messages
  // when the server emits product-card tool output. Style-mode messages
  // leave this absent or null.
  shopping_results?: ShoppingResultCard[] | null;
}

export interface PersistedStyleChatMessage {
  kind: "stylist_message";
  content: string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
  stylistMeta?: StyleChatResponseEnvelope | null;
}

export function isStyleChatResponseEnvelope(value: unknown): value is StyleChatResponseEnvelope {
  return !!value
    && typeof value === "object"
    && (value as { kind?: unknown }).kind === "stylist_response"
    && typeof (value as { assistant_text?: unknown }).assistant_text === "string"
    && Array.isArray((value as { outfit_ids?: unknown }).outfit_ids);
}

// M23 — defensive accessor that normalises a raw `shopping_results`
// payload (or any unknown value) into a typed `ShoppingResultCard[]`.
// Drops malformed entries silently; missing required fields → null
// returned for the whole list when nothing survives. Required fields:
// `id` (string), `title` (string), `product_url` (https-only — M19
// allowlist precedent). Optional fields fall back to null/undefined.
export function parseShoppingResultCards(value: unknown): ShoppingResultCard[] | null {
  if (!Array.isArray(value)) return null;
  const cards: ShoppingResultCard[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : null;
    const title = typeof r.title === "string" && r.title ? r.title : null;
    const productUrl =
      typeof r.product_url === "string" && r.product_url.startsWith("https://")
        ? r.product_url
        : null;
    if (!id || !title || !productUrl) continue;
    const imageUrl =
      typeof r.image_url === "string" && r.image_url.startsWith("https://")
        ? r.image_url
        : null;
    const merchant = typeof r.merchant === "string" && r.merchant ? r.merchant : null;
    const reason = typeof r.reason === "string" && r.reason ? r.reason : null;
    let price: ShoppingResultCardPrice | null = null;
    if (r.price && typeof r.price === "object") {
      const p = r.price as Record<string, unknown>;
      const amount = typeof p.amount === "number" && Number.isFinite(p.amount) ? p.amount : null;
      const currency = typeof p.currency === "string" && p.currency ? p.currency : null;
      if (amount !== null && currency) price = { amount, currency };
    }
    cards.push({
      id,
      title,
      image_url: imageUrl,
      price,
      merchant,
      product_url: productUrl,
      reason,
    });
  }
  return cards.length > 0 ? cards : null;
}

export function collectStyleChatGarmentIds(meta?: StyleChatResponseEnvelope | null): string[] {
  if (!meta) return [];
  return Array.from(new Set([
    ...(meta.active_look?.garment_ids || []),
    ...(meta.outfit_ids || []),
    ...(meta.garment_mentions || []),
  ].filter(Boolean)));
}
