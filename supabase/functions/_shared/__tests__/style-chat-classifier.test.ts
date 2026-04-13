import { describe, it, expect } from "https://deno.land/std@0.220.0/testing/bdd.ts";
import {
  mapClassifierToMode,
  CLASSIFIER_FALLBACK,
  type ClassifierResult,
} from "../style-chat-contract.ts";
import { classifyIntent, buildClassifierPrompt } from "../style-chat-classifier.ts";

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
