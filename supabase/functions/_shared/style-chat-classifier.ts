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
// Codex P2 round 10: the gate must admit every message that the downstream
// `looksLikeRefinementRequest` is prepared to accept — otherwise legitimate
// refinement commands like "remove the jacket" or "add a jacket" are
// rejected upstream and never reach the override. Broadened to include all
// IMPERATIVE_REFINE_VERBS; the downstream matcher keeps "change my password"
// / "swap my email" out of the refine path via its clothing-specific
// phrase regex and adjective-only bare-modifier gate.
const REFINEMENT_WORDS_RE = /\b(warmer|cooler|formal|casual|different|elevated|softer|sharper|dressier|dressy)\b|\b(make|swap|change|try|keep|lose|drop|remove|add|dress)\b/i;

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
// Codex P2 round 9: tightened to clothing-specific objects. The old shape
// `(verb) + (it|this|them|the|a|an|some|something|my)` matched "change my
// password" / "change my account settings" — forcing refine_outfit on
// non-clothing requests whenever an active look existed. The new shape
// requires EITHER an outfit-implying pronoun (it/this/them) OR a
// clothing-specific noun (with optional article/possessive).
const CLOTHING_NOUNS = "outfit|look|shoes?|top|shirt|blouse|sweater|bottom|pants|trousers|skirt|jeans|jacket|coat|blazer|cardigan|outerwear|dress|style|vibe";
const IMPERATIVE_REFINE_PHRASE_RE = new RegExp(
  // (1) verb + outfit-implying pronoun: "make it warmer", "change this"
  `\\b(make|swap|change|try|keep|lose|drop|remove|add)\\s+(it|this|them)\\b` +
  // (2) verb + (article|possessive) + clothing noun: "change my top", "swap the shoes"
  `|\\b(make|swap|change|try|keep|lose|drop|remove|add)\\s+(the|my|a|an|some|something)\\s+(?:${CLOTHING_NOUNS})\\b` +
  // (3) verb + clothing noun (no article): "swap shoes", "change jacket"
  `|\\b(make|swap|change|try|keep|lose|drop|remove|add)\\s+(?:${CLOTHING_NOUNS})\\b` +
  // (4) dress-up/dress-down phrase: "dress it up", "dress this down"
  `|\\bdress\\s+(it|this|them)\\s+(up|down)\\b`,
  "i",
);

// Codex P2 round 5: guard against info-seeking statements like
// "tell me the difference between formal and casual dress codes".
// The old `looksLikeQuestion` (deny-list: has `?` OR interrogative start)
// missed this class — no `?`, starts with `tell` (not in question starts).
// Switched to an allow-list: the override fires only when the message
// either has an explicit imperative refinement verb phrase (e.g. "make
// it warmer") OR is a short bare-modifier message (e.g. "warmer",
// "more formal", "different vibe") that doesn't start with an info-seeking
// verb or interrogative word.
const INFO_SEEKING_STARTS = new Set([
  "tell", "explain", "describe", "define", "list", "show",
  "teach", "help", "give",
]);

// Codex P2 round 6: polite modal requests that open with can/could/would
// are the ONLY case where an imperative verb phrase should override a
// question marker. General questions like "How can I change my style?"
// also contain "change my" but are genuine advice requests, not refinement
// commands. Separating modal-starters from arbitrary interrogatives
// lets us keep the polite-modal override without swallowing wh- questions.
const MODAL_REQUEST_STARTS = new Set(["can", "could", "would"]);

// Codex P2 round 13: polite filler words that can appear between "you"
// and the meaningful verb. Used to skip-past when deciding whether the
// first meaningful word after a modal request is an imperative verb or
// an info-seeking verb. "Can you please explain ..." — "please" is a
// filler; "explain" is the word that determines intent.
const POLITE_FILLERS = new Set([
  "please", "kindly", "just", "maybe", "perhaps", "possibly",
]);

// Codex P1 round 7: direct imperatives with a trailing "?" ("make it warmer?",
// "swap the shoes?") are still commands — the "?" is emphatic punctuation,
// not a question marker. Detection: message starts with an imperative
// refinement verb (make|swap|change|try|keep|lose|drop|remove|add).
const IMPERATIVE_REFINE_VERBS = new Set([
  "make", "swap", "change", "try", "keep", "lose", "drop", "remove", "add",
  // Round 8: "dress it up" / "dress this down" — REFINEMENT_WORDS_RE already
  // only passes the multi-word pattern (not bare "dress"), so this is safe
  // against declarative noun uses ("I want a dress").
  "dress",
]);

// Codex P2 round 8: the bare-modifier short-chip path was too permissive —
// "I need a formal outfit" (5 words, "formal" in REFINEMENT_WORDS_RE,
// no imperative, no question marker) would flip to refine_outfit, hijacking
// a generation-intent statement. Declarative sentence starters ("I need",
// "I want", "I'd like", "looking for") signal intent, not refinement.
const DECLARATIVE_STARTS = new Set([
  "i", "we", "my", "our", "looking", "need", "want", "trying",
  "wish", "hoping", "planning", "searching", "thinking",
]);

// Codex P2 round 9: the bare-modifier path also over-matched — "change my
// password" is 3 words, starts with "change" (in REFINEMENT_WORDS_RE gate),
// and word-count ≤ 3, so it would return true. Split the refinement gate:
// the bare-modifier path now requires a refinement ADJECTIVE (describing
// the desired state), not a bare imperative verb like "swap" or "change"
// that could be about non-clothing targets.
const REFINEMENT_ADJECTIVES_RE = /\b(warmer|cooler|formal|casual|different|elevated|softer|sharper|dressier|dressy)\b/i;

function looksLikeRefinementRequest(message: string): boolean {
  const trimmed = message.trim();

  const firstWord = trimmed.toLowerCase().split(/\s+/)[0] ?? "";
  // Codex P2 round 2: split on apostrophe so contractions like "what's",
  // "who's", "isn't", "don't" normalize to their base interrogative
  // ("what", "who", "isn", "don") before the set lookup.
  const beforeApostrophe = firstWord.split(/['\u2019]/)[0] ?? "";
  const firstCleaned = beforeApostrophe.replace(/[^a-z]/g, "");
  const hasQuestionMark = trimmed.includes("?");

  // (a) Polite modal-request fast-path — "Can you make it warmer?",
  // "Could you swap the shoes?". A modal starter (can/could/would) paired
  // with a refinement imperative phrase is a request, not a question,
  // regardless of a trailing "?". We check this FIRST so modal-phrased
  // imperatives override the question markers that would otherwise fire.
  //
  // Codex P2 round 11: require the 2nd word to be "you" — only assistant-
  // directed modal phrasing ("can YOU...") is a request. "Can I make it
  // warmer?" / "Would this change my style?" are info/impact questions
  // and must stay on the conversational path.
  //
  // Codex P2 round 12: reject info-seeking 3rd word ("Can you EXPLAIN ...",
  // "Could you TELL me ..."). An info verb between "you" and the refinement
  // phrase signals explanation/guidance intent, not a command. This keeps
  // direct imperatives ("Can you make it warmer?") on the refine path.
  //
  // Codex P2 round 13: polite-filler stacking. "Can you please explain how
  // to make it warmer?" bypasses a bare 3rd-word check because words[2] is
  // "please". Scan forward past a fixed set of polite fillers (please,
  // kindly, just, maybe, perhaps) and inspect the FIRST meaningful word
  // after "you" — if THAT word is info-seeking, reject.
  const words = trimmed.toLowerCase().split(/\s+/);
  const secondWord = (words[1] ?? "").replace(/[^a-z]/g, "");
  let scanIdx = 2;
  while (scanIdx < words.length) {
    const w = (words[scanIdx] ?? "").replace(/[^a-z]/g, "");
    if (!POLITE_FILLERS.has(w)) break;
    scanIdx++;
  }
  const firstSignificantAfterModal = (words[scanIdx] ?? "").replace(/[^a-z]/g, "");
  if (
    MODAL_REQUEST_STARTS.has(firstCleaned) &&
    secondWord === "you" &&
    !INFO_SEEKING_STARTS.has(firstSignificantAfterModal) &&
    IMPERATIVE_REFINE_PHRASE_RE.test(trimmed)
  ) {
    return true;
  }

  // (b) Direct-imperative fast-path — "make it warmer?", "swap the shoes?",
  // "please make it warmer?". A message that STARTS with a refinement verb
  // (make/swap/change/etc.), OR with a politeness filler followed by a
  // refinement verb, AND matches the imperative verb-phrase pattern is a
  // command; the "?" is emphatic punctuation.
  //
  // Codex P2 round 14: extended past POLITE_FILLERS so "please make it
  // warmer?" / "kindly change my top?" reach the override. Skip fillers at
  // position 0 onwards, then require the first meaningful word to be an
  // imperative refinement verb.
  let firstMeaningfulIdx = 0;
  while (firstMeaningfulIdx < words.length) {
    const w = (words[firstMeaningfulIdx] ?? "").replace(/[^a-z]/g, "");
    if (!POLITE_FILLERS.has(w)) break;
    firstMeaningfulIdx++;
  }
  const firstMeaningful = (words[firstMeaningfulIdx] ?? "").replace(/[^a-z]/g, "");
  if (IMPERATIVE_REFINE_VERBS.has(firstMeaningful) && IMPERATIVE_REFINE_PHRASE_RE.test(trimmed)) {
    return true;
  }

  // (c) General interrogative guard — wh-questions ("what", "how", "why",
  // "which", etc.), plus messages containing "?". Codex round 6: this
  // MUST run before the general imperative fast-path below, so inputs like
  // "How can I change my style?" don't slip through on the `change my`
  // pattern match.
  //
  // Codex P2 round 14: also check firstMeaningful so a politeness filler
  // doesn't let info-seeking verbs slip past — "please explain how to
  // make it warmer" (no "?") would otherwise hit (d) via the `make it`
  // phrase match.
  if (hasQuestionMark) return false;
  if (QUESTION_STARTS.has(firstCleaned) || QUESTION_STARTS.has(firstMeaningful)) return false;
  if (INFO_SEEKING_STARTS.has(firstCleaned) || INFO_SEEKING_STARTS.has(firstMeaningful)) return false;

  // (d) Explicit imperative verb phrase (no question markers) —
  // "make it warmer", "swap the shoes", "change the top".
  //
  // Codex P2 round 11: declarative-starter guard. A message like
  // "I want to change my style" / "looking to swap my jacket" matches the
  // imperative phrase regex on the "change my ..." / "swap my ..." clause
  // but is a statement, not a command. Rejecting declarative openers here
  // keeps the override focused on true imperatives.
  if (!DECLARATIVE_STARTS.has(firstCleaned) && IMPERATIVE_REFINE_PHRASE_RE.test(trimmed)) {
    return true;
  }

  // (e) Bare modifier / short-chip message path — e.g. "warmer",
  // "more formal", "softer", "different vibe", "cooler please". These are
  // common in chat UIs with quick-reply chips. Guards:
  //   - First word must not be a DECLARATIVE_START ("I need" / "my top" /
  //     "looking for ...") — those signal generation/statement intent.
  //   - Message must contain a REFINEMENT_ADJECTIVE (warmer / cooler /
  //     formal / casual / different / elevated / softer / sharper /
  //     dressier / dressy). Bare refinement verbs ("swap", "change")
  //     without clothing-specific context fall through to conversation
  //     (prevents "change my password" false positives on non-clothing
  //     targets).
  //   - Message must be ≤ 3 words. Longer short-chip-shaped sentences like
  //     "I need a formal outfit" (5 words, statement) would slip through
  //     otherwise. Real refinement chips are 1–3 tokens in practice.
  if (DECLARATIVE_STARTS.has(firstCleaned)) return false;
  if (!REFINEMENT_ADJECTIVES_RE.test(trimmed)) return false;
  const wordCount = trimmed.split(/\s+/).length;
  return wordCount <= 3;
}

export function applyActiveLookRefinementOverride(
  result: ClassifierResult,
  input: ClassifierInput,
): ClassifierResult {
  if (!input.hasActiveLook) return result;
  if (result.intent !== "conversation") return result;
  if (!REFINEMENT_WORDS_RE.test(input.userMessage)) return result;
  if (!looksLikeRefinementRequest(input.userMessage)) return result;

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
