export type StylistChatMode =
  | "ACTIVE_LOOK_REFINEMENT"
  | "GARMENT_FIRST_STYLING"
  | "OUTFIT_GENERATION"
  | "WARDROBE_GAP_ANALYSIS"
  | "PURCHASE_PRIORITIZATION"
  | "STYLE_IDENTITY_ANALYSIS"
  | "LOOK_EXPLANATION"
  | "PLANNING"
  | "CONVERSATIONAL";

export type StyleChatCardPolicy = "required" | "preserve_if_exists" | "optional";

export type StyleChatCardState = "new" | "updated" | "preserved" | "unavailable";

export type StyleChatResponseKind = "style_result" | "style_explanation" | "style_repair" | "analysis";

export type StyleChatActiveLookStatus = "new" | "preserved" | "updated" | "replaced" | "unavailable";

export type StyleChatIntentKind = "create" | "refine" | "explain" | "clarify";

// ── Intent classifier types (replaces regex-based detection) ──

export type ClassifierIntent = "conversation" | "generate_outfit" | "refine_outfit" | "explain_outfit";

export type RefinementHint =
  | "warmer" | "cooler" | "more_formal" | "less_formal"
  | "swap_shoes" | "swap_top" | "swap_bottom" | "swap_outerwear"
  | "different_style" | "use_less_worn"
  | null;

export interface ClassifierResult {
  intent: ClassifierIntent;
  needs_more_context: boolean;
  refinement_hint: RefinementHint;
  locked_slots: string[] | null;
  clear_active_look: boolean;
}

export const CLASSIFIER_FALLBACK: ClassifierResult = {
  intent: "conversation",
  needs_more_context: true,
  refinement_hint: null,
  locked_slots: null,
  clear_active_look: false,
};

export function mapClassifierToMode(
  result: ClassifierResult,
  hasAnchor: boolean,
): StylistChatMode {
  switch (result.intent) {
    case "conversation":
      return "CONVERSATIONAL";
    case "generate_outfit":
      return hasAnchor ? "GARMENT_FIRST_STYLING" : "OUTFIT_GENERATION";
    case "refine_outfit":
      return "ACTIVE_LOOK_REFINEMENT";
    case "explain_outfit":
      return "LOOK_EXPLANATION";
    default:
      return "CONVERSATIONAL";
  }
}

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
}

export function isStylingMode(mode: StylistChatMode): boolean {
  return mode === "ACTIVE_LOOK_REFINEMENT"
    || mode === "GARMENT_FIRST_STYLING"
    || mode === "OUTFIT_GENERATION"
    || mode === "LOOK_EXPLANATION";
}

export function resolveStyleCardPolicy(params: {
  mode: StylistChatMode;
  hasActiveLook: boolean;
  hasAnchor: boolean;
}): StyleChatCardPolicy {
  const { mode, hasActiveLook, hasAnchor } = params;

  if (mode === "ACTIVE_LOOK_REFINEMENT" || mode === "GARMENT_FIRST_STYLING" || mode === "OUTFIT_GENERATION") {
    return "required";
  }

  if (mode === "LOOK_EXPLANATION") {
    return hasActiveLook || hasAnchor ? "preserve_if_exists" : "optional";
  }

  if (hasActiveLook) {
    return "preserve_if_exists";
  }

  return "optional";
}

export function resolveActiveLookStatus(previousIds: string[], nextIds: string[]): StyleChatActiveLookStatus {
  if (!nextIds.length) return "unavailable";
  if (!previousIds.length) return "new";
  if (previousIds.length === nextIds.length && previousIds.every((id, index) => id === nextIds[index])) {
    return "preserved";
  }
  const overlap = nextIds.filter((id) => previousIds.includes(id)).length;
  return overlap > 0 ? "updated" : "replaced";
}

export function resolveStyleCardState(previousIds: string[], nextIds: string[]): StyleChatCardState {
  if (!nextIds.length) return "unavailable";
  if (!previousIds.length) return "new";
  if (previousIds.length === nextIds.length && previousIds.every((id, index) => id === nextIds[index])) {
    return "preserved";
  }
  return "updated";
}

export function resolveStyleResponseKind(params: {
  mode: StylistChatMode;
  cardState: StyleChatCardState;
  fallbackUsed: boolean;
  degradedReason: string | null;
}): StyleChatResponseKind {
  const { mode, cardState, fallbackUsed, degradedReason } = params;

  if (cardState === "unavailable" && isStylingMode(mode)) {
    return "style_repair";
  }

  if (mode === "LOOK_EXPLANATION") {
    return "style_explanation";
  }

  if (cardState === "unavailable") {
    return "analysis";
  }

  if (fallbackUsed || Boolean(degradedReason)) {
    return "style_repair";
  }

  if (isStylingMode(mode)) {
    return "style_result";
  }

  return "analysis";
}

export function shouldRenderStyleCardFromPolicy(params: {
  cardPolicy: StyleChatCardPolicy;
  cardState: StyleChatCardState;
  outfitIds: string[];
}): boolean {
  if (!params.outfitIds.length) return false;
  if (params.cardState === "unavailable") return false;
  return params.cardPolicy !== "optional" || params.outfitIds.length > 0;
}

export function shouldRenderStyleCard(mode: StylistChatMode, outfitIds: string[], hasActiveLook: boolean): boolean {
  if (mode === "LOOK_EXPLANATION" && !hasActiveLook) {
    return false;
  }
  return shouldRenderStyleCardFromPolicy({
    cardPolicy: resolveStyleCardPolicy({
      mode,
      hasActiveLook,
      hasAnchor: false,
    }),
    cardState: resolveStyleCardState(hasActiveLook ? outfitIds : [], outfitIds),
    outfitIds,
  });
}
