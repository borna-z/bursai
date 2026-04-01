export type StylistChatMode =
  | "ACTIVE_LOOK_REFINEMENT"
  | "GARMENT_FIRST_STYLING"
  | "OUTFIT_GENERATION"
  | "WARDROBE_GAP_ANALYSIS"
  | "PURCHASE_PRIORITIZATION"
  | "STYLE_IDENTITY_ANALYSIS"
  | "LOOK_EXPLANATION"
  | "PLANNING";

export type StyleChatActiveLookStatus = "none" | "new" | "preserved" | "updated";

export interface StyleChatActiveLookInput {
  garment_ids?: string[];
  explanation?: string | null;
  source?: string | null;
}

export interface StyleChatResponseEnvelope {
  kind: "stylist_response";
  mode: StylistChatMode;
  assistant_text: string;
  outfit_ids: string[];
  outfit_explanation: string;
  garment_mentions: string[];
  suggestion_chips: string[];
  truncated: boolean;
  active_look_status: StyleChatActiveLookStatus;
  fallback_used: boolean;
  degraded_reason: string | null;
  render_outfit_card: boolean;
}

export interface PersistedStyleChatMessage {
  kind: "stylist_message";
  content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
  stylistMeta?: StyleChatResponseEnvelope | null;
}

export function isStyleChatResponseEnvelope(value: unknown): value is StyleChatResponseEnvelope {
  return !!value
    && typeof value === "object"
    && (value as { kind?: unknown }).kind === "stylist_response"
    && typeof (value as { assistant_text?: unknown }).assistant_text === "string"
    && Array.isArray((value as { outfit_ids?: unknown }).outfit_ids);
}

export function collectStyleChatGarmentIds(meta?: StyleChatResponseEnvelope | null): string[] {
  if (!meta) return [];
  return Array.from(new Set([...(meta.outfit_ids || []), ...(meta.garment_mentions || [])].filter(Boolean)));
}
