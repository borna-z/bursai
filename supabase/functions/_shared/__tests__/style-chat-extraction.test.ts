import { describe, it, expect } from "vitest";
import { extractMemoryEvents } from "../style-chat-extraction.ts";

const activeLook = {
  garment_ids: ["gA", "gB", "gC"],
  outfit_id: "oA",
};

describe("extractMemoryEvents — en patterns", () => {
  it("hate_X emits dislike with active_look binding", () => {
    const events = extractMemoryEvents({
      userTurn: "I hate this outfit",
      locale: "en",
      activeLook,
      anchorGarmentId: null,
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      signal_type: "quick_reaction",
      metadata: expect.objectContaining({ value: "dislike" }),
    });
    expect(events[0].confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("don't hate negation suppresses match", () => {
    const events = extractMemoryEvents({
      userTurn: "I don't hate this",
      locale: "en",
      activeLook,
      anchorGarmentId: null,
    });
    expect(events).toHaveLength(0);
  });

  it("never suggest with anchor emits never_suggest_garment", () => {
    const events = extractMemoryEvents({
      userTurn: "never suggest this again",
      locale: "en",
      activeLook: null,
      anchorGarmentId: "gA",
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      signal_type: "never_suggest_garment",
      metadata: expect.objectContaining({ garment_id: "gA" }),
    });
  });

  it("never suggest WITHOUT anchor → no event (binding required)", () => {
    const events = extractMemoryEvents({
      userTurn: "never suggest these",
      locale: "en",
      activeLook: null,
      anchorGarmentId: null,
    });
    expect(events).toHaveLength(0);
  });

  it("more like this emits like_pair over active look", () => {
    const events = extractMemoryEvents({
      userTurn: "more like this please",
      locale: "en",
      activeLook,
      anchorGarmentId: null,
    });
    const likeEv = events.find((e) => e.signal_type === "like_pair");
    expect(likeEv).toBeDefined();
  });

  it("too formal emits formality shift -1", () => {
    const events = extractMemoryEvents({
      userTurn: "this is too formal for me",
      locale: "en",
      activeLook,
      anchorGarmentId: null,
    });
    expect(events).toHaveLength(1);
    expect(events[0].metadata).toMatchObject({ formality_shift: -1 });
  });

  it("too casual emits formality shift +1", () => {
    const events = extractMemoryEvents({
      userTurn: "too casual",
      locale: "en",
      activeLook,
      anchorGarmentId: null,
    });
    expect(events).toHaveLength(1);
    expect(events[0].metadata).toMatchObject({ formality_shift: 1 });
  });

  it("question form (?) reduces confidence below threshold", () => {
    const events = extractMemoryEvents({
      userTurn: "do you hate this outfit?",
      locale: "en",
      activeLook,
      anchorGarmentId: null,
    });
    expect(events).toHaveLength(0);
  });

  it("color dislike does not require active_look", () => {
    const events = extractMemoryEvents({
      userTurn: "I don't like the red one",
      locale: "en",
      activeLook: null,
      anchorGarmentId: null,
    });
    const colorEv = events.find(
      (e) => typeof e.metadata?.color_avoid === "string",
    );
    expect(colorEv).toBeDefined();
    expect(colorEv?.metadata.color_avoid).toBe("red");
  });
});

describe("extractMemoryEvents — sv patterns", () => {
  it("hatar emits dislike", () => {
    const events = extractMemoryEvents({
      userTurn: "jag hatar denna outfit",
      locale: "sv",
      activeLook,
      anchorGarmentId: null,
    });
    expect(events).toHaveLength(1);
    expect(events[0].metadata).toMatchObject({ value: "dislike" });
  });

  it("inte hatar negation suppresses", () => {
    const events = extractMemoryEvents({
      userTurn: "jag inte hatar den",
      locale: "sv",
      activeLook,
      anchorGarmentId: null,
    });
    expect(events).toHaveLength(0);
  });

  it("älskar emits love", () => {
    const events = extractMemoryEvents({
      userTurn: "jag älskar den här",
      locale: "sv",
      activeLook,
      anchorGarmentId: null,
    });
    expect(events).toHaveLength(1);
    expect(events[0].metadata).toMatchObject({ value: "love" });
  });

  it("föreslå aldrig with anchor emits never_suggest_garment", () => {
    const events = extractMemoryEvents({
      userTurn: "föreslå aldrig denna",
      locale: "sv",
      activeLook: null,
      anchorGarmentId: "gZ",
    });
    expect(events).toHaveLength(1);
    expect(events[0].signal_type).toBe("never_suggest_garment");
  });
});

describe("extractMemoryEvents — locale fallback + edge cases", () => {
  it("unsupported locale (de) emits no events but does not throw", () => {
    expect(() =>
      extractMemoryEvents({
        userTurn: "ich hasse das",
        locale: "de",
        activeLook,
        anchorGarmentId: null,
      }),
    ).not.toThrow();
    const events = extractMemoryEvents({
      userTurn: "ich hasse das",
      locale: "de",
      activeLook,
      anchorGarmentId: null,
    });
    expect(events).toEqual([]);
  });

  it("empty user turn → no events", () => {
    const events = extractMemoryEvents({
      userTurn: "",
      locale: "en",
      activeLook,
      anchorGarmentId: null,
    });
    expect(events).toEqual([]);
  });

  it("hate without ANY binding (no activeLook, no anchor) → no event", () => {
    const events = extractMemoryEvents({
      userTurn: "I hate Mondays",
      locale: "en",
      activeLook: null,
      anchorGarmentId: null,
    });
    expect(events).toEqual([]);
  });
});
