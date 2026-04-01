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
  if (hasActiveLook && /(why does this work|why this works|explain why|break down the look|analyze this look|what makes this better)/i.test(latestUser)) {
    return "LOOK_EXPLANATION";
  }
  if (hasActiveLook && refinementMode !== "new_look") {
    return "ACTIVE_LOOK_REFINEMENT";
  }
  if (/(style around|build around|based on this|with these chinos|with this blazer|style this|wear this|around this|anchor on)/i.test(latestUser) || (hasAnchor && !hasActiveLook)) {
    return "GARMENT_FIRST_STYLING";
  }
  if (/(what is my style|describe my style|style identity|style direction|more masculine|more minimal)/i.test(latestUser)) {
    return "STYLE_IDENTITY_ANALYSIS";
  }
  if (/(why does this work|why this works|explain why|break down the look|analyze this look|what makes this better)/i.test(latestUser)) {
    return "LOOK_EXPLANATION";
  }
  return "OUTFIT_GENERATION";
}

export function resolveActiveLookStatus(previousIds: string[], nextIds: string[]): StyleChatActiveLookStatus {
  if (!nextIds.length) return "none";
  if (!previousIds.length) return "new";
  if (previousIds.length === nextIds.length && previousIds.every((id, index) => id === nextIds[index])) {
    return "preserved";
  }
  return "updated";
}

export function shouldRenderStyleCard(mode: StylistChatMode, outfitIds: string[], hasActiveLook: boolean): boolean {
  if (!outfitIds.length) return false;
  if (mode === "OUTFIT_GENERATION" || mode === "GARMENT_FIRST_STYLING" || mode === "ACTIVE_LOOK_REFINEMENT") {
    return true;
  }
  if (mode === "LOOK_EXPLANATION" && hasActiveLook) {
    return true;
  }
  return false;
}
