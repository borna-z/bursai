export type StylistChatMode =
  | "ACTIVE_LOOK_REFINEMENT"
  | "GARMENT_FIRST_STYLING"
  | "OUTFIT_GENERATION"
  | "WARDROBE_GAP_ANALYSIS"
  | "PURCHASE_PRIORITIZATION"
  | "STYLE_IDENTITY_ANALYSIS"
  | "LOOK_EXPLANATION"
  | "PLANNING";

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

const LOOK_EXPLANATION_RE = /(why does this work|why this works|explain why|explain why this works|break down the look|analyze this look|what makes this work)/i;
const GARMENT_FIRST_RE = /(style around|build around|based on this|with these chinos|with this blazer|style this|style this garment|wear this|around this|anchor on)/i;
const CREATE_LOOK_RE = /(create|build|put together|give me|show me|what should i wear|for dinner|for work|for weekend|for travel|travel look|dinner look|work look|weekend look)/i;
const CONTEXT_DEPENDENT_STYLE_RE = /(style this|style it|make it|change it|swap it|replace it|remove it|drop it|explain this|explain why this works|why this works|what should i change|fix this|improve this)/i;

export function resolveStyleChatIntentFromSignals(params: {
  latestUser: string;
  hasActiveLook: boolean;
  hasAnchor: boolean;
  refinementMode: string;
}): StyleChatIntentKind {
  const latestUser = (params.latestUser || "").trim();
  if (!latestUser) return "create";

  if (LOOK_EXPLANATION_RE.test(latestUser)) {
    return params.hasActiveLook || params.hasAnchor ? "explain" : "clarify";
  }

  if (!params.hasActiveLook && !params.hasAnchor && CONTEXT_DEPENDENT_STYLE_RE.test(latestUser)) {
    return "clarify";
  }

  if (params.hasActiveLook && params.refinementMode !== "new_look") {
    return "refine";
  }

  if (params.refinementMode !== "new_look") {
    return "create";
  }

  if (GARMENT_FIRST_RE.test(latestUser) || params.hasAnchor) {
    return "create";
  }

  if (CREATE_LOOK_RE.test(latestUser)) {
    return "create";
  }

  return "create";
}

export function detectStylistChatModeFromSignals(params: {
  latestUser: string;
  hasActiveLook: boolean;
  hasAnchor: boolean;
  refinementMode: string;
}): StylistChatMode {
  const { latestUser, hasActiveLook, hasAnchor, refinementMode } = params;
  if (!latestUser) return "OUTFIT_GENERATION";

  if (/(what should i buy|what to buy|buy next|top\s*\d+\s*(things|pieces).{0,20}buy|purchase priority|biggest upgrade per purchase|best purchases?|cheap(est)? high-impact|stop buying)/i.test(latestUser)) {
    return "PURCHASE_PRIORITIZATION";
  }
  if (/(what am i missing|style missing|wardrobe gap|gap analysis|underrepresented|overrepresented|closet audit|wardrobe audit|pieces are weak|doing too much work|missing building blocks|upgrade my wardrobe)/i.test(latestUser)) {
    return "WARDROBE_GAP_ANALYSIS";
  }
  if (/(what should i wear this week|build me \d+ .*looks|plan my week|weekly looks|week of outfits|capsule for this week)/i.test(latestUser)) {
    return "PLANNING";
  }
  if (/(what is my style|describe my style|style identity|style direction|more masculine)/i.test(latestUser)) {
    return "STYLE_IDENTITY_ANALYSIS";
  }
  const intent = resolveStyleChatIntentFromSignals({
    latestUser,
    hasActiveLook,
    hasAnchor,
    refinementMode,
  });
  if (intent === "explain") {
    return "LOOK_EXPLANATION";
  }
  if (intent === "refine") {
    return "ACTIVE_LOOK_REFINEMENT";
  }
  if (intent === "create" && (GARMENT_FIRST_RE.test(latestUser) || (hasAnchor && !hasActiveLook))) {
    return "GARMENT_FIRST_STYLING";
  }
  return "OUTFIT_GENERATION";
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
