import { describe, it, expect } from "vitest";
import {
  mapClassifierToMode,
  CLASSIFIER_FALLBACK,
  type ClassifierResult,
} from "../style-chat-contract.ts";
import { classifyIntent, buildClassifierPrompt, applyActiveLookRefinementOverride } from "../style-chat-classifier.ts";

describe("ClassifierResult", () => {
  it("maps generate_outfit without anchor to OUTFIT_GENERATION", () => {
    const result: ClassifierResult = {
      intent: "generate_outfit",
      needs_more_context: false,
      refinement_hint: null,
      locked_slots: null,
      clear_active_look: false,
    };
    expect(mapClassifierToMode(result, false)).toBe("OUTFIT_GENERATION");
  });

  it("maps generate_outfit with anchor to GARMENT_FIRST_STYLING", () => {
    const result: ClassifierResult = {
      intent: "generate_outfit",
      needs_more_context: false,
      refinement_hint: null,
      locked_slots: null,
      clear_active_look: false,
    };
    expect(mapClassifierToMode(result, true)).toBe("GARMENT_FIRST_STYLING");
  });

  it("maps refine_outfit to ACTIVE_LOOK_REFINEMENT", () => {
    const result: ClassifierResult = {
      intent: "refine_outfit",
      needs_more_context: false,
      refinement_hint: "warmer",
      locked_slots: ["top"],
      clear_active_look: false,
    };
    expect(mapClassifierToMode(result, false)).toBe("ACTIVE_LOOK_REFINEMENT");
  });

  it("maps explain_outfit to LOOK_EXPLANATION", () => {
    const result: ClassifierResult = {
      intent: "explain_outfit",
      needs_more_context: false,
      refinement_hint: null,
      locked_slots: null,
      clear_active_look: false,
    };
    expect(mapClassifierToMode(result, false)).toBe("LOOK_EXPLANATION");
  });

  it("maps conversation to CONVERSATIONAL", () => {
    const result: ClassifierResult = {
      intent: "conversation",
      needs_more_context: false,
      refinement_hint: null,
      locked_slots: null,
      clear_active_look: false,
    };
    expect(mapClassifierToMode(result, false)).toBe("CONVERSATIONAL");
  });

  it("CLASSIFIER_FALLBACK defaults to conversation with needs_more_context", () => {
    expect(CLASSIFIER_FALLBACK.intent).toBe("conversation");
    expect(CLASSIFIER_FALLBACK.needs_more_context).toBe(true);
    expect(CLASSIFIER_FALLBACK.clear_active_look).toBe(false);
  });
});

describe("buildClassifierPrompt", () => {
  it("includes user message in the prompt", () => {
    const prompt = buildClassifierPrompt({
      userMessage: "Make it warmer",
      hasActiveLook: true,
      hasAnchor: false,
      garmentCount: 12,
      lastMessages: [],
      lockedSlots: [],
    });
    expect(prompt).toContain("Make it warmer");
    expect(prompt).toContain("has_active_look: true");
  });

  it("includes locked slots when provided", () => {
    const prompt = buildClassifierPrompt({
      userMessage: "swap the shoes",
      hasActiveLook: true,
      hasAnchor: false,
      garmentCount: 8,
      lastMessages: [],
      lockedSlots: ["top", "bottom"],
    });
    expect(prompt).toContain("locked_slots: top, bottom");
  });
});

describe("classifyIntent", () => {
  it("returns CLASSIFIER_FALLBACK when AI response is not valid JSON", async () => {
    const mockCallAI = async () => "this is not json";
    const result = await classifyIntent({
      userMessage: "hello",
      hasActiveLook: false,
      hasAnchor: false,
      garmentCount: 5,
      lastMessages: [],
      lockedSlots: [],
    }, mockCallAI);
    expect(result.intent).toBe("conversation");
    expect(result.needs_more_context).toBe(true);
  });

  it("parses valid classifier JSON response", async () => {
    const mockCallAI = async () => JSON.stringify({
      intent: "refine_outfit",
      needs_more_context: false,
      refinement_hint: "warmer",
      locked_slots: ["top"],
      clear_active_look: false,
    });
    const result = await classifyIntent({
      userMessage: "make it warmer",
      hasActiveLook: true,
      hasAnchor: false,
      garmentCount: 10,
      lastMessages: [],
      lockedSlots: [],
    }, mockCallAI);
    expect(result.intent).toBe("refine_outfit");
    expect(result.refinement_hint).toBe("warmer");
    expect(result.locked_slots).toEqual(["top"]);
  });

  it("returns fallback when intent is not a valid enum value", async () => {
    const mockCallAI = async () => JSON.stringify({
      intent: "invalid_intent",
      needs_more_context: false,
      refinement_hint: null,
      locked_slots: null,
      clear_active_look: false,
    });
    const result = await classifyIntent({
      userMessage: "something weird",
      hasActiveLook: false,
      hasAnchor: false,
      garmentCount: 5,
      lastMessages: [],
      lockedSlots: [],
    }, mockCallAI);
    expect(result.intent).toBe("conversation");
    expect(result.needs_more_context).toBe(true);
  });
});

describe("applyActiveLookRefinementOverride (P30)", () => {
  const CONVERSATION_RESULT: ClassifierResult = {
    intent: "conversation",
    needs_more_context: false,
    refinement_hint: null,
    locked_slots: null,
    clear_active_look: false,
  };

  const makeInput = (userMessage: string, hasActiveLook = true) => ({
    userMessage,
    hasActiveLook,
    hasAnchor: false,
    garmentCount: 5,
    lastMessages: [],
    lockedSlots: [],
  });

  it("flips conversation → refine_outfit when active look + 'warmer'", () => {
    const out = applyActiveLookRefinementOverride(CONVERSATION_RESULT, makeInput("make it warmer"));
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("warmer");
  });

  it("flips conversation → refine_outfit when active look + 'swap the shoes'", () => {
    const out = applyActiveLookRefinementOverride(CONVERSATION_RESULT, makeInput("swap the shoes"));
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("swap_shoes");
  });

  it("flips conversation → refine_outfit when active look + 'make it more formal'", () => {
    const out = applyActiveLookRefinementOverride(CONVERSATION_RESULT, makeInput("make it more formal"));
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("more_formal");
  });

  it("does NOT override when hasActiveLook=false", () => {
    const out = applyActiveLookRefinementOverride(CONVERSATION_RESULT, makeInput("make it warmer", false));
    expect(out.intent).toBe("conversation");
    expect(out.refinement_hint).toBeNull();
  });

  it("does NOT override when message has no refinement keyword", () => {
    const out = applyActiveLookRefinementOverride(CONVERSATION_RESULT, makeInput("tell me a joke"));
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override when classifier already returned refine_outfit (passthrough)", () => {
    const already: ClassifierResult = {
      intent: "refine_outfit",
      needs_more_context: false,
      refinement_hint: "cooler",
      locked_slots: null,
      clear_active_look: false,
    };
    const out = applyActiveLookRefinementOverride(already, makeInput("make it cooler"));
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("cooler");
  });

  it("preserves classifier-provided refinement_hint when already non-null", () => {
    const hinted: ClassifierResult = {
      ...CONVERSATION_RESULT,
      refinement_hint: "different_style",
    };
    const out = applyActiveLookRefinementOverride(hinted, makeInput("make it warmer"));
    expect(out.intent).toBe("refine_outfit");
    // The classifier's hint wins — we only infer when hint is null.
    expect(out.refinement_hint).toBe("different_style");
  });

  it("preserves locked_slots; clears needs_more_context + clear_active_look (Codex P2 rounds 1+4)", () => {
    // Codex P2 round 1 — needs_more_context must be cleared when forcing
    // refine (otherwise style_chat routes to clarify mode before intent).
    // Codex P2 round 4 — clear_active_look must also flip to false:
    // refine_outfit + clear_active_look=true would contradict each other
    // (the client would clear the outfit we're trying to refine).
    // locked_slots passes through untouched.
    const input: ClassifierResult = {
      intent: "conversation",
      needs_more_context: true,
      refinement_hint: null,
      locked_slots: ["top"],
      clear_active_look: true,
    };
    const out = applyActiveLookRefinementOverride(input, makeInput("make it warmer"));
    expect(out.needs_more_context).toBe(false);
    expect(out.clear_active_look).toBe(false);
    expect(out.locked_slots).toEqual(["top"]);
  });

  it("does NOT override when input is already a non-conversation intent (e.g. generate_outfit)", () => {
    const gen: ClassifierResult = {
      intent: "generate_outfit",
      needs_more_context: false,
      refinement_hint: null,
      locked_slots: null,
      clear_active_look: false,
    };
    const out = applyActiveLookRefinementOverride(gen, makeInput("make it warmer"));
    expect(out.intent).toBe("generate_outfit");
  });

  // Codex P1 round 1 — guard against misrouting questions that contain refinement words.
  it("does NOT override a question ending in '?' (e.g. 'difference between formal and casual?')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("what's the difference between formal and casual dress codes?"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override a question starting with interrogative word (no '?')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("what is the difference between formal and casual"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override a 'how do I' question", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("how do I swap shoes on an outfit"),
    );
    expect(out.intent).toBe("conversation");
  });

  // Codex P2 round 2 — contractions in the interrogative starter.
  it("does NOT override 'what's the difference between formal and casual' (contraction, no '?')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("what's the difference between formal and casual"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'who's more formal' (contraction)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("who's more formal than who"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'isn't this too casual' (negative contraction)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("isn't this too casual"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("DOES override imperative 'swap the shoes' (no question marker)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("swap the shoes"),
    );
    expect(out.intent).toBe("refine_outfit");
  });

  // Codex P2 round 1 — override must clear needs_more_context so the forced
  // refine intent actually reaches the refine path in style_chat.
  it("clears needs_more_context=true when forcing refine_outfit (Codex P2)", () => {
    const resultWithNmc: ClassifierResult = {
      intent: "conversation",
      needs_more_context: true,
      refinement_hint: null,
      locked_slots: null,
      clear_active_look: false,
    };
    const out = applyActiveLookRefinementOverride(resultWithNmc, makeInput("make it warmer"));
    expect(out.intent).toBe("refine_outfit");
    expect(out.needs_more_context).toBe(false);
  });

  it("clears needs_more_context on CLASSIFIER_FALLBACK shape when user has active look + refine word", () => {
    // CLASSIFIER_FALLBACK = { intent: "conversation", needs_more_context: true, ... }
    // This is the shape returned when the AI response fails to parse — we still
    // want the refine override to kick in and clear the clarify flag.
    const out = applyActiveLookRefinementOverride(CLASSIFIER_FALLBACK, makeInput("make it warmer"));
    expect(out.intent).toBe("refine_outfit");
    expect(out.needs_more_context).toBe(false);
    expect(out.refinement_hint).toBe("warmer");
  });

  // Codex P2 round 3 — `dressier` + `dress it up/down` phrases were in the
  // hint patterns but unreachable because the gate regex rejected them first.
  it("DOES override 'dress it up' (multi-word refinement phrase)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("dress it up a bit"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("more_formal");
  });

  it("DOES override 'dress this down' (multi-word refinement phrase)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("dress this down for coffee"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("less_formal");
  });

  it("DOES override 'make it dressier'", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("make it dressier"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("more_formal");
  });

  it("does NOT over-match bare 'dress' as a noun ('I want a dress' should stay conversation)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("I want a dress for the weekend"),
    );
    expect(out.intent).toBe("conversation");
  });

  // Codex P1 round 4 — polite modal refinement requests must still override.
  it("DOES override 'Can you make it warmer?' (polite modal request + '?')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Can you make it warmer?"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("warmer");
  });

  it("DOES override 'Could you swap the shoes?' (polite modal request + '?')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Could you swap the shoes?"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("swap_shoes");
  });

  it("DOES override 'Would you change it to something cooler?' (modal + ?)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Would you change it to something cooler?"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("cooler");
  });

  it("still does NOT override info-seeking modal 'Can you explain why this works?' (no imperative verb phrase)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Can you explain why this works"),
    );
    // No "make it" / "swap the" / etc., starts with "Can" → stays a question.
    expect(out.intent).toBe("conversation");
  });

  // Codex P2 round 4 — "dressy" was mapped in hint patterns but missing from gate.
  it("DOES override 'make it dressy' (dressy keyword now in gate)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("make it dressy"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("more_formal");
  });

  // Codex P2 round 5 — info-seeking statement path.
  it("does NOT override 'tell me the difference between formal and casual' (info-seeking)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("tell me the difference between formal and casual dress codes"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'explain formal vs casual style' (info-seeking)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("explain formal vs casual style"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'describe what softer means' (info-seeking)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("describe what softer means"),
    );
    expect(out.intent).toBe("conversation");
  });

  // Long statement without imperative verb phrase — let classifier's
  // original conversation intent stand (don't over-force).
  it("does NOT override long descriptive statement 'I think this outfit should be warmer and more casual for the occasion'", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("I think this outfit should be warmer and more casual for the occasion"),
    );
    expect(out.intent).toBe("conversation");
  });

  // Bare-modifier short chip messages still override.
  it("DOES override 'different vibe' (2-word bare-modifier chip)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("different vibe"),
    );
    expect(out.intent).toBe("refine_outfit");
  });

  it("DOES override 'cooler' (single-word bare modifier)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("cooler"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("cooler");
  });

  // Codex P2 round 6 — wh-questions containing imperative verbs ("How can I
  // change my style?") must stay as conversation. The imperative fast-path
  // must NOT bypass the interrogative guard when the message doesn't open
  // with a modal request.
  it("does NOT override 'How can I change my style?' (wh-question with imperative verb)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("How can I change my style?"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'How do I make this warmer?' (wh-question with make it-style phrase)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("How do I make this warmer?"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'Why would I swap the shoes?' (wh-question, even with 'would')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Why would I swap the shoes"),
    );
    expect(out.intent).toBe("conversation");
  });

  // Polite modal requests still override (verify round 4 behavior preserved).
  it("still DOES override 'Would you change my top?' (modal starter + imperative)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Would you change my top?"),
    );
    expect(out.intent).toBe("refine_outfit");
  });

  // Codex P1 round 7 — direct imperatives with trailing "?" are emphatic
  // commands, not questions. Must still override.
  it("DOES override 'make it warmer?' (direct imperative + trailing '?')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("make it warmer?"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("warmer");
  });

  it("DOES override 'swap the shoes?' (direct imperative + trailing '?')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("swap the shoes?"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("swap_shoes");
  });

  it("DOES override 'change the top?' (direct imperative + trailing '?')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("change the top?"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("swap_top");
  });

  // Codex P2 round 8 — declarative statements with refinement keywords
  // must NOT be force-flipped to refine_outfit.
  it("does NOT override 'I need a formal outfit' (declarative 'I need' + formal)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("I need a formal outfit"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'I want something warmer' (declarative 'I want')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("I want something warmer"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'looking for a casual vibe' (declarative 'looking for')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("looking for a casual vibe"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'my top is too formal' (declarative 'my')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("my top is too formal"),
    );
    expect(out.intent).toBe("conversation");
  });

  // Longer casual descriptive message (>3 words) now also skips the bare-modifier path.
  it("does NOT override 'this coat is a bit casual for me' (descriptive, 7 words)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("this coat is a bit casual for me"),
    );
    expect(out.intent).toBe("conversation");
  });

  // Very short 3-word refinement still overrides.
  it("DOES override 'cooler please thanks' (3-word casual chip)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("cooler please thanks"),
    );
    expect(out.intent).toBe("refine_outfit");
  });

  // Codex P2 round 9 — non-clothing imperative objects must NOT be
  // misrouted as refinement (`change my password`, `change my account
  // settings`, `swap my email`).
  it("does NOT override 'change my password' (non-clothing 'my' object)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("change my password"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'can you change my password?' (non-clothing polite modal)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("can you change my password?"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'change my account settings' (non-clothing + 3 words)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("change my account settings"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'swap my email' (non-clothing + short)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("swap my email"),
    );
    expect(out.intent).toBe("conversation");
  });

  // Clothing-specific imperatives still override correctly.
  it("DOES override 'change my top' (clothing 'my' + clothing noun)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("change my top"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("swap_top");
  });

  it("DOES override 'swap shoes' (verb + clothing noun, no article)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("swap shoes"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("swap_shoes");
  });

  it("DOES override 'change the outfit' (verb + article + outfit)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("change the outfit"),
    );
    expect(out.intent).toBe("refine_outfit");
  });

  // Codex P2 round 10 — upstream gate was narrower than downstream matcher,
  // so these never reached looksLikeRefinementRequest.
  it("DOES override 'remove the jacket' (gate now admits 'remove')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("remove the jacket"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("swap_outerwear");
  });

  it("DOES override 'add a jacket' (gate now admits 'add')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("add a jacket"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("swap_outerwear");
  });

  it("DOES override 'try the shoes' (gate now admits 'try')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("try the shoes"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("swap_shoes");
  });

  it("DOES override 'keep the top' (gate now admits 'keep')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("keep the top"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("swap_top");
  });

  it("DOES override 'drop the blazer' (gate now admits 'drop')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("drop the blazer"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("swap_outerwear");
  });

  it("DOES override 'lose the blazer' (gate now admits 'lose')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("lose the blazer"),
    );
    expect(out.intent).toBe("refine_outfit");
  });

  // Round-9 negatives still hold with the broader gate (downstream filters kick in).
  it("still does NOT override 'remove the comment' (non-clothing object)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("remove the comment"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("still does NOT override 'add a comment' (non-clothing object)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("add a comment"),
    );
    expect(out.intent).toBe("conversation");
  });

  // Codex P2 round 11 #1 — modal fast-path requires 2nd word = "you".
  // "Can I ..." / "Would this ..." are info/impact questions, not requests.
  it("does NOT override 'Can I make it warmer?' (modal starter but 'I', not 'you')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Can I make it warmer?"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'Would this change my style?' (modal + 'this')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Would this change my style?"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'Could this be warmer?' (modal + 'this')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Could this be warmer?"),
    );
    expect(out.intent).toBe("conversation");
  });

  // Positive: modal + 'you' still overrides (round 4 behavior preserved).
  it("still DOES override 'Can you make it warmer?' (modal + 'you')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Can you make it warmer?"),
    );
    expect(out.intent).toBe("refine_outfit");
  });

  // Codex P2 round 11 #2 — phrase-path guard against declarative openers.
  // "I want to change my style" / "looking to swap my jacket" are statements,
  // not commands.
  it("does NOT override 'I want to change my style' (declarative 'I want')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("I want to change my style"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'looking to swap my jacket' (declarative 'looking')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("looking to swap my jacket"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'my outfit needs to change the jacket' (declarative 'my')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("my outfit needs to change the jacket"),
    );
    expect(out.intent).toBe("conversation");
  });

  // Positive: imperative phrase with NON-declarative opener still overrides.
  it("still DOES override 'please change my top' (non-declarative opener 'please')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("please change my top"),
    );
    expect(out.intent).toBe("refine_outfit");
  });

  // Codex P2 round 12 — modal + info-seeking 3rd word = explanatory question.
  it("does NOT override 'Can you explain how to make it warmer?' (info-seeking 3rd word)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Can you explain how to make it warmer?"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'Could you tell me how to swap the shoes?' (info-seeking 3rd word)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Could you tell me how to swap the shoes?"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'Would you describe the change my top would need?' (info-seeking 3rd word 'describe')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Would you describe the change my top would need"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'Can you help me make it warmer?' (info-seeking 3rd word 'help')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Can you help me make it warmer?"),
    );
    expect(out.intent).toBe("conversation");
  });

  // Positive: direct modal + imperative 3rd word still overrides.
  it("still DOES override 'Can you make it warmer?' (direct imperative 3rd word 'make')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Can you make it warmer?"),
    );
    expect(out.intent).toBe("refine_outfit");
  });

  it("still DOES override 'Would you please make it warmer?' (polite modifier, not info-seeking)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Would you please make it warmer?"),
    );
    expect(out.intent).toBe("refine_outfit");
  });

  // Codex P2 round 13 — polite filler stacking. Modal fast-path skips past
  // please/kindly/just before checking for info-seeking verbs.
  it("does NOT override 'Can you please explain how to make it warmer?' (filler + info verb)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Can you please explain how to make it warmer?"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'Can you kindly help me change the jacket?' (filler + help)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Can you kindly help me change the jacket?"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'Would you just please explain formality?' (stacked fillers + explain)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Would you just please explain formality"),
    );
    expect(out.intent).toBe("conversation");
  });

  // Positive: fillers BEFORE imperative verb still allow override.
  it("DOES override 'Can you just make it warmer?' (filler + imperative)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Can you just make it warmer?"),
    );
    expect(out.intent).toBe("refine_outfit");
  });

  it("DOES override 'Could you maybe swap the shoes?' (filler 'maybe' + imperative)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Could you maybe swap the shoes?"),
    );
    expect(out.intent).toBe("refine_outfit");
  });

  // Codex P2 round 14 — polite-prefixed direct imperatives with "?".
  it("DOES override 'please make it warmer?' (politeness + imperative + '?')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("please make it warmer?"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("warmer");
  });

  it("DOES override 'please swap the shoes?' (politeness + imperative + '?')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("please swap the shoes?"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("swap_shoes");
  });

  it("DOES override 'kindly change my top?' (kindly + imperative)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("kindly change my top?"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("swap_top");
  });

  // Codex P2 round 14 (secondary) — polite filler must NOT let info-seeking
  // verbs slip past the (c) interrogative/info guard.
  it("does NOT override 'please explain how to make it warmer' (politeness + info verb, no '?')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("please explain how to make it warmer"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'please tell me how to swap the shoes' (politeness + info verb)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("please tell me how to swap the shoes"),
    );
    expect(out.intent).toBe("conversation");
  });

  // Codex P2 round 15 — bare-modifier path requires token-level whitelist.
  // Short adjective-bearing messages mixed with non-refinement content words
  // must stay conversation.
  it("does NOT override 'different question' (adjective + 'question' noun)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("different question"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'formal vs casual' (adjectives + 'vs')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("formal vs casual"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'formal question' (adjective + 'question')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("formal question"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'warmer weather' (adjective + unrelated noun)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("warmer weather"),
    );
    expect(out.intent).toBe("conversation");
  });

  // Positive regressions — composition with benign fillers still works.
  it("DOES override 'a bit warmer' (filler + adjective)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("a bit warmer"),
    );
    expect(out.intent).toBe("refine_outfit");
  });

  it("DOES override 'slightly more formal' (3-word filler stack + adjective)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("slightly more formal"),
    );
    expect(out.intent).toBe("refine_outfit");
  });

  it("DOES override 'a different vibe' (article + adjective + outfit noun)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("a different vibe"),
    );
    expect(out.intent).toBe("refine_outfit");
  });

  it("DOES override 'way more casual' (intensifier + adjective)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("way more casual"),
    );
    expect(out.intent).toBe("refine_outfit");
  });

  // Codex P2 round 16 — advisory verbs (suggest/recommend/advise/propose)
  // are guidance requests, not refinement commands. Modal fast-path must
  // reject them even when a later imperative phrase matches.
  it("does NOT override 'Can you suggest how to make it warmer?' (modal + suggest)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Can you suggest how to make it warmer?"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'Could you recommend how to swap the shoes?' (modal + recommend)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Could you recommend how to swap the shoes?"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'Would you advise on making it warmer?' (modal + advise)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Would you advise on making it warmer"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'Can you please suggest how to swap the shoes?' (filler + suggest)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Can you please suggest how to swap the shoes?"),
    );
    expect(out.intent).toBe("conversation");
  });

  // Info-seeking non-modal openers also covered.
  it("does NOT override 'suggest how to make it warmer' (advisory verb as opener)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("suggest how to make it warmer"),
    );
    expect(out.intent).toBe("conversation");
  });

  // Codex P2 round 17 — pronoun branch narrowed to require a refinement
  // adjective after "it/this/them". Non-outfit "verb + pronoun" phrases
  // stay conversation.
  it("does NOT override 'Can you remove this comment?' (pronoun, no refinement adj)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Can you remove this comment?"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'add this to my shopping list' (pronoun, no refinement adj)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("add this to my shopping list"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'change this file' (pronoun, no refinement adj)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("change this file"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'remove it from the list' (pronoun, no refinement adj)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("remove it from the list"),
    );
    expect(out.intent).toBe("conversation");
  });

  // Positive regressions — pronoun + refinement adj still overrides.
  it("still DOES override 'make it warmer' (pronoun + adj)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("make it warmer"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("warmer");
  });

  it("DOES override 'make it much cooler' (pronoun + intensifier + adj)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("make it much cooler"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("cooler");
  });

  it("DOES override 'change it to something dressier' (pronoun + phrase + adj)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("change it to something dressier"),
    );
    expect(out.intent).toBe("refine_outfit");
  });

  // Demonstrative + clothing still overrides via branch (2).
  it("DOES override 'change this jacket' (demonstrative + clothing noun)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("change this jacket"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("swap_outerwear");
  });

  it("DOES override 'swap that top' (demonstrative + clothing noun)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("swap that top"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("swap_top");
  });

  // Codex P1 round 18 — negated-formality hints must map to opposite direction.
  // "less casual" = MORE formal; "less dressy" = LESS formal.
  it("maps 'make it less casual' to more_formal hint", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("make it less casual"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("more_formal");
  });

  it("maps 'make it less dressy' to less_formal hint", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("make it less dressy"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("less_formal");
  });

  it("maps 'make it less formal' to less_formal hint", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("make it less formal"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("less_formal");
  });

  it("maps 'make it less elevated' to less_formal hint", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("make it less elevated"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("less_formal");
  });

  it("maps 'not as casual' to more_formal hint", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      // "not as casual" is 3 words + "a bit" = 5 tokens → falls through the
      // short-chip word-count check. Use a shorter imperative phrasing.
      makeInput("make it not as casual"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("more_formal");
  });

  it("maps 'not as dressy' to less_formal hint", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("make it not as dressy"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("less_formal");
  });

  // Regressions: positive/non-negated directions still map correctly.
  it("still maps 'make it more formal' to more_formal hint", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("make it more formal"),
    );
    expect(out.refinement_hint).toBe("more_formal");
  });

  it("still maps bare 'casual' chip to less_formal hint", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("casual"),
    );
    expect(out.refinement_hint).toBe("less_formal");
  });

  // Codex P2 round 19 #1 — "style" and "vibe" no longer in CLOTHING_NOUNS.
  // Style-identity questions stay conversational.
  it("does NOT override 'change my style' (style is no longer a clothing noun)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("change my style"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'Would you change my style?' (identity question)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("Would you change my style?"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'change my style preferences' (identity)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("change my style preferences"),
    );
    expect(out.intent).toBe("conversation");
  });

  it("does NOT override 'change my vibe' (generic identity)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("change my vibe"),
    );
    expect(out.intent).toBe("conversation");
  });

  // Bare-chip paths still recognize style/vibe as fillers — "different vibe"
  // works via the short-chip whitelist because these words are in
  // BENIGN_CHIP_FILLERS, not CLOTHING_NOUNS.
  it("still DOES override 'different vibe' (vibe in BENIGN_CHIP_FILLERS)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("different vibe"),
    );
    expect(out.intent).toBe("refine_outfit");
  });

  it("still DOES override 'different style' (style in BENIGN_CHIP_FILLERS)", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("different style"),
    );
    expect(out.intent).toBe("refine_outfit");
  });

  // Codex P2 round 19 #2 — "not as casual" / "not as dressy" as bare chips
  // now pass the token whitelist because "not" and "as" are added as fillers.
  it("DOES override bare 'not as casual' (negated chip) and maps to more_formal", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("not as casual"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("more_formal");
  });

  it("DOES override bare 'not as dressy' (negated chip) and maps to less_formal", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("not as dressy"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("less_formal");
  });

  it("DOES override bare 'not so formal' (negated chip with 'so')", () => {
    const out = applyActiveLookRefinementOverride(
      CONVERSATION_RESULT,
      makeInput("not so formal"),
    );
    expect(out.intent).toBe("refine_outfit");
    expect(out.refinement_hint).toBe("less_formal");
  });
});

describe("classifyIntent exception path (Codex P2 round 3)", () => {
  const throwingCallAI = async () => {
    throw new Error("transient provider failure");
  };

  it("applies override on exception: active look + refine word forces refine_outfit + clears needs_more_context", async () => {
    const out = await classifyIntent({
      userMessage: "make it warmer",
      hasActiveLook: true,
      hasAnchor: false,
      garmentCount: 5,
      lastMessages: [],
      lockedSlots: [],
    }, throwingCallAI);
    expect(out.intent).toBe("refine_outfit");
    expect(out.needs_more_context).toBe(false);
    expect(out.refinement_hint).toBe("warmer");
  });

  it("falls back to CLASSIFIER_FALLBACK unchanged when exception + no active look", async () => {
    const out = await classifyIntent({
      userMessage: "make it warmer",
      hasActiveLook: false,
      hasAnchor: false,
      garmentCount: 5,
      lastMessages: [],
      lockedSlots: [],
    }, throwingCallAI);
    expect(out.intent).toBe("conversation");
    expect(out.needs_more_context).toBe(true);
  });

  it("falls back to CLASSIFIER_FALLBACK unchanged when exception + active look + non-refine question", async () => {
    const out = await classifyIntent({
      userMessage: "what's the weather like",
      hasActiveLook: true,
      hasAnchor: false,
      garmentCount: 5,
      lastMessages: [],
      lockedSlots: [],
    }, throwingCallAI);
    expect(out.intent).toBe("conversation");
    expect(out.needs_more_context).toBe(true);
  });
});
