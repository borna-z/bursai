import {
  CLASSIFIER_FALLBACK,
  type ClassifierResult,
  type ClassifierIntent,
  type RefinementHint,
} from "./style-chat-contract.ts";

const VALID_INTENTS: Set<string> = new Set([
  "conversation",
  "generate_outfit",
  "refine_outfit",
  "explain_outfit",
  "PURCHASE_PRIORITIZATION",
  "WARDROBE_GAP_ANALYSIS",
  "PLANNING",
  "STYLE_IDENTITY_ANALYSIS",
]);

const VALID_HINTS: Set<string> = new Set([
  "warmer",
  "cooler",
  "more_formal",
  "less_formal",
  "swap_shoes",
  "swap_top",
  "swap_bottom",
  "swap_outerwear",
  "different_style",
  "use_less_worn",
]);

export interface ClassifierInput {
  userMessage: string;
  hasActiveLook: boolean;
  hasAnchor: boolean;
  garmentCount: number;
  lastMessages: Array<{ role: string; text: string }>;
  lockedSlots: string[];
}

export type CallAIFn = (
  messages: Array<{ role: string; content: string }>,
  complexity: string,
) => Promise<string>;

export function buildClassifierPrompt(input: ClassifierInput): string {
  const contextLines = input.lastMessages
    .map((m) => `${m.role}: ${m.text.slice(0, 150)}`)
    .join("\n");

  return `You are an intent classifier for a personal stylist AI. Classify the user's message.

Context:
- has_active_look: ${input.hasActiveLook}
- has_anchor: ${input.hasAnchor}
- garment_count: ${input.garmentCount}
- locked_slots: ${input.lockedSlots.length > 0 ? input.lockedSlots.join(", ") : "none"}
${contextLines ? `- recent_conversation:\n${contextLines}` : ""}

User message: "${input.userMessage}"

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "intent": "conversation | generate_outfit | refine_outfit | explain_outfit",
  "needs_more_context": true | false,
  "refinement_hint": "warmer | cooler | more_formal | less_formal | swap_shoes | swap_top | swap_bottom | swap_outerwear | different_style | use_less_worn | null",
  "locked_slots": ["slot1", "slot2"] | null,
  "clear_active_look": true | false
}

Rules:
- "conversation" = greeting, fashion question, or completely unclear request with zero styling intent
- "generate_outfit" + needs_more_context=false = user wants an outfit AND has given enough context. Even PARTIAL context is enough — the stylist can infer the rest. Examples: "What should I wear today?", "I need a work outfit", "casual weekend look", "formal evening" — all have enough to start generating.
- "generate_outfit" + needs_more_context=true = user's FIRST message about an occasion with NO formality/context clues at all. Example: "I have a wedding" (first message, no prior context). BUT if the recent conversation already discussed formality, venue, weather, etc., set needs_more_context=false — the context has ALREADY been gathered.
- "refine_outfit" = active look exists AND user wants to modify it (warmer, swap shoes, more casual, etc.)
- "explain_outfit" = user asks about current look's styling logic (why does this work, what shoes go better)
- If has_active_look=false and user says "make it warmer" or similar refinement language, use intent="conversation" + needs_more_context=true (nothing to refine)
- clear_active_look=true ONLY when user starts a completely new outfit context unrelated to current look
- For purchase advice: use intent "PURCHASE_PRIORITIZATION"
- For wardrobe gaps/audits: use intent "WARDROBE_GAP_ANALYSIS"
- For weekly planning: use intent "PLANNING"
- For style identity questions: use intent "STYLE_IDENTITY_ANALYSIS"

CRITICAL — AVOID INFINITE LOOPS:
- Look at recent_conversation. If the assistant has ALREADY asked a clarifying question and the user answered it, DO NOT ask again. Set needs_more_context=false and generate the outfit.
- If the user provides ANY formality word (formal, casual, smart casual, dressy, etc.), that is enough context. Generate.
- If the user says "generate", "show me", "create", "put together", "what should I wear" — that is an explicit request. Set needs_more_context=false.
- needs_more_context=true should ONLY be used on the FIRST vague message. After ONE follow-up answer from the user, ALWAYS set needs_more_context=false.
- Default bias: GENERATE. Only ask if the request is truly the first message AND has zero context clues.`;
}

function parseClassifierResponse(raw: string): ClassifierResult {
  // Extract JSON from markdown code blocks if present
  let jsonText = raw.trim();
  const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return CLASSIFIER_FALLBACK;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return CLASSIFIER_FALLBACK;
  }

  const obj = parsed as Record<string, unknown>;

  // Validate intent
  const intent = obj["intent"];
  if (typeof intent !== "string" || !VALID_INTENTS.has(intent)) {
    return CLASSIFIER_FALLBACK;
  }

  // Validate needs_more_context — handle both boolean and string "true"/"false"
  const rawNmc = obj["needs_more_context"];
  const needsMoreContext =
    typeof rawNmc === "boolean" ? rawNmc
    : rawNmc === "true" ? true
    : rawNmc === "false" ? false
    : false;

  // Validate refinement_hint
  let refinementHint: RefinementHint = null;
  if (
    obj["refinement_hint"] !== null &&
    obj["refinement_hint"] !== undefined &&
    obj["refinement_hint"] !== "null"
  ) {
    if (
      typeof obj["refinement_hint"] === "string" &&
      VALID_HINTS.has(obj["refinement_hint"])
    ) {
      refinementHint = obj["refinement_hint"] as RefinementHint;
    }
  }

  // Validate locked_slots
  let lockedSlots: string[] | null = null;
  if (Array.isArray(obj["locked_slots"])) {
    lockedSlots = obj["locked_slots"].filter(
      (s): s is string => typeof s === "string",
    );
  }

  // Validate clear_active_look — handle both boolean and string "true"/"false"
  const rawCal = obj["clear_active_look"];
  const clearActiveLook =
    typeof rawCal === "boolean" ? rawCal
    : rawCal === "true" ? true
    : rawCal === "false" ? false
    : false;

  return {
    intent: intent as ClassifierIntent,
    needs_more_context: needsMoreContext,
    refinement_hint: refinementHint,
    locked_slots: lockedSlots,
    clear_active_look: clearActiveLook,
  };
}

export async function classifyIntent(
  input: ClassifierInput,
  callAI: CallAIFn,
): Promise<ClassifierResult> {
  try {
    const prompt = buildClassifierPrompt(input);
    const raw = await callAI(
      [
        { role: "system", content: prompt },
        { role: "user", content: input.userMessage },
      ],
      "trivial",
    );
    return parseClassifierResponse(raw);
  } catch {
    return CLASSIFIER_FALLBACK;
  }
}
