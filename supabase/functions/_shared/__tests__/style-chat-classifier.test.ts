import { describe, it, expect } from "https://deno.land/std@0.220.0/testing/bdd.ts";
import {
  mapClassifierToMode,
  CLASSIFIER_FALLBACK,
  type ClassifierResult,
} from "../style-chat-contract.ts";

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
