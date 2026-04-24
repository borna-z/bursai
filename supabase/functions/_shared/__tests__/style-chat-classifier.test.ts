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
