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

/**
 * P30: Post-classification override for the "refine words with active look" case.
 *
 * The LLM classifier sometimes returns `intent: "conversation"` on messages
 * like "make it warmer" even when an active look is present — treating them
 * as generic chat instead of the refine flow they clearly signal. That hits
 * users with an active outfit who expect "make it warmer" to regenerate a
 * warmer variant; instead it falls back to the conversational path and the
 * refine UI never fires.
 *
 * Deterministic override: when an active look exists AND the classifier
 * returned `conversation` AND the message contains a refinement keyword,
 * flip the intent to `refine_outfit` and (if the classifier didn't already
 * fill one) infer a `refinement_hint` from the specific keyword that matched.
 *
 * We do NOT override when `hasActiveLook` is false — the classifier prompt
 * already handles that case correctly by routing to conversation +
 * needs_more_context=true (rule at line 77 of the prompt).
 */
// Whole-word keywords OR multi-word phrases. The multi-word phrases
// (`dress it up` / `dress this down`) pair with REFINEMENT_HINT_PATTERNS
// below — without them, the bare word `dress` would over-match ("my dress",
// "a dress") and force non-refinement messages into the refine flow.
const REFINEMENT_WORDS_RE = /\b(warmer|cooler|formal|casual|swap|change|different|elevated|softer|sharper|dressier|dressy)\b|\bdress\s+(it|this|them)\s+(up|down)\b/i;

const REFINEMENT_HINT_PATTERNS: Array<{ pattern: RegExp; hint: RefinementHint }> = [
  { pattern: /\bwarmer\b/i, hint: "warmer" },
  { pattern: /\bcooler\b/i, hint: "cooler" },
  { pattern: /\b(elevated|sharper|more formal|dressier|dress it up|dress this up)\b/i, hint: "more_formal" },
  { pattern: /\b(softer|less formal|more casual|dress it down|dress this down)\b/i, hint: "less_formal" },
  { pattern: /\bshoes?\b/i, hint: "swap_shoes" },
  { pattern: /\b(top|shirt|blouse|sweater)\b/i, hint: "swap_top" },
  { pattern: /\b(bottom|pants|trousers|skirt|jeans)\b/i, hint: "swap_bottom" },
  { pattern: /\b(jacket|coat|blazer|outerwear|cardigan)\b/i, hint: "swap_outerwear" },
  { pattern: /\b(formal|dressy)\b/i, hint: "more_formal" },
  { pattern: /\bcasual\b/i, hint: "less_formal" },
  { pattern: /\b(different|change|swap)\b/i, hint: "different_style" },
];

function inferRefinementHint(message: string): RefinementHint {
  for (const { pattern, hint } of REFINEMENT_HINT_PATTERNS) {
    if (pattern.test(message)) return hint;
  }
  return null;
}

/**
 * Codex P1 round 1: guard against misrouting questions that happen to contain
 * refinement keywords (e.g. "what's the difference between formal and casual
 * dress codes?") into the refine flow. A genuine chat question is identifiable
 * by either an explicit `?` OR an interrogative first word.
 */
const QUESTION_STARTS = new Set([
  "what", "why", "how", "when", "where", "who", "which",
  "is", "are", "was", "were", "do", "does", "did", "can", "could", "would", "should", "may", "might",
  // Contraction stems — the split-on-apostrophe path in `looksLikeQuestion`
  // yields these for "isn't", "don't", "doesn't", "can't", "couldn't",
  // "won't", "wouldn't", "shouldn't", "aren't", "wasn't", "weren't", "didn't".
  "isn", "don", "doesn", "aren", "wasn", "weren", "didn", "couldn", "won", "wouldn", "shouldn",
]);

// Codex P1 round 4: polite modal-phrased refinement requests like
// "Can you make it warmer?" or "Could you swap the shoes?" should still
// trigger the override. They're imperatives dressed up as questions.
// Detection: if the message body contains a refinement verb pattern
// ("make it X", "swap the Y", etc.), treat it as a request regardless of
// trailing "?" or modal starter.
const IMPERATIVE_REFINE_PHRASE_RE = /\b(make|swap|change|try|keep|lose|drop|remove|add)\s+(it|this|them|the|a|an|some|something|my)\b/i;

function looksLikeQuestion(message: string): boolean {
  const trimmed = message.trim();
  // Escape hatch — imperative refinement phrasing overrides the question
  // markers. "Can you make it warmer?" is a request, not a question.
  if (IMPERATIVE_REFINE_PHRASE_RE.test(trimmed)) return false;
  if (trimmed.includes("?")) return true;
  const firstWord = trimmed.toLowerCase().split(/\s+/)[0] ?? "";
  // Codex P2 round 2: split on apostrophe so contractions like "what's",
  // "who's", "isn't", "don't" normalize to their base interrogative
  // ("what", "who", "isn", "don") before the set lookup.
  const beforeApostrophe = firstWord.split(/['\u2019]/)[0] ?? "";
  const cleaned = beforeApostrophe.replace(/[^a-z]/g, "");
  return QUESTION_STARTS.has(cleaned);
}

export function applyActiveLookRefinementOverride(
  result: ClassifierResult,
  input: ClassifierInput,
): ClassifierResult {
  if (!input.hasActiveLook) return result;
  if (result.intent !== "conversation") return result;
  if (!REFINEMENT_WORDS_RE.test(input.userMessage)) return result;
  if (looksLikeQuestion(input.userMessage)) return result;

  return {
    ...result,
    intent: "refine_outfit",
    // Codex P2 round 1: style_chat checks `needs_more_context` BEFORE intent
    // and routes to clarify mode — so the override must also clear that flag,
    // otherwise the forced refine intent never reaches the refine path.
    needs_more_context: false,
    // Codex P2 round 4: preserve/force `clear_active_look: false` — a
    // `conversation` classifier output could have `clear_active_look: true`
    // (e.g. when the user starts a new topic). Forcing refine_outfit while
    // also asking the client to clear the active-look state contradicts the
    // intent and drops the very outfit we're trying to refine.
    clear_active_look: false,
    refinement_hint: result.refinement_hint ?? inferRefinementHint(input.userMessage),
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
    return applyActiveLookRefinementOverride(parseClassifierResponse(raw), input);
  } catch {
    // Codex P2 round 3: apply the override in the transport/exception path
    // too, so a provider hiccup during "make it warmer" on an active look
    // still promotes to refine_outfit + clears needs_more_context — same as
    // the parse-fallback path. Without this, transient Gemini errors would
    // silently route the user into clarify mode.
    return applyActiveLookRefinementOverride(CLASSIFIER_FALLBACK, input);
  }
}
