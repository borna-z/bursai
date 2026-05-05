// Tests for the deterministic style-summary builder (Wave 8.5 P87).
//
// Coverage targets (from the prompt):
//   1. Empty inputs → low-confidence fallback summary.
//   2. Single negative event does NOT promote a category to avoided_*.
//   3. 3 consistent negative events on a color → avoided_colors confidence ≥ 0.5.
//   4. Mixed signals — net positive minus negative.
//   5. Recency decay — old (180d+) signals weight ~half of fresh signals.
//   6. Legacy signal_type normalization (signal_type='save' → save_outfit).
//   7. Pair memory aggregation — 5 positive + 1 negative + recent → favorite.
//   8. never_suggest_garment populates the hard list.
//   9. Determinism — same inputs → byte-identical output.
//  10. Performance — 200 garments + 500 outfits + 1000 signals under 200ms.
//
// All inputs are plain JS objects matching the structural shapes exported by
// the builder. No supabase-js needed.

import { describe, expect, it } from "vitest";
import {
  buildStyleSummary,
  type FeedbackSignalLike,
  type GarmentLike,
  type OutfitFeedbackLike,
  type OutfitItemLike,
  type OutfitLike,
  type PairMemoryLike,
  type PlannedOutfitLike,
  type StyleSummaryInputs,
  type WearLogLike,
} from "../style-summary-builder";

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

const ANCHOR = "2026-04-01T12:00:00.000Z"; // deterministic "now"
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function isoOffset(daysBack: number, anchorIso: string = ANCHOR): string {
  const ms = Date.parse(anchorIso) - daysBack * ONE_DAY_MS;
  return new Date(ms).toISOString();
}

function emptyInputs(): StyleSummaryInputs {
  return {
    profile: null,
    garments: [],
    outfits: [],
    outfitItems: [],
    wearLogs: [],
    feedbackSignals: [],
    pairMemory: [],
    plannedOutfits: [],
    outfitFeedback: [],
  };
}

function makeGarment(overrides: Partial<GarmentLike> & { id: string }): GarmentLike {
  return {
    id: overrides.id,
    category: "top",
    subcategory: "tshirt",
    color_primary: "black",
    color_secondary: null,
    pattern: "solid",
    material: "cotton",
    fit: "regular",
    formality: 3,
    season_tags: ["all"],
    wear_count: 0,
    last_worn_at: null,
    style_archetype: null,
    occasion_tags: [],
    created_at: ANCHOR,
    ...overrides,
  };
}

function makeOutfit(overrides: Partial<OutfitLike> & { id: string }): OutfitLike {
  return {
    id: overrides.id,
    rating: null,
    feedback: null,
    saved: false,
    worn_at: null,
    occasion: null,
    weather: null,
    created_at: ANCHOR,
    generated_at: ANCHOR,
    ...overrides,
  };
}

function makeOutfitItem(outfitId: string, garmentId: string): OutfitItemLike {
  return { outfit_id: outfitId, garment_id: garmentId, slot: null };
}

function makeWearLog(overrides: Partial<WearLogLike> = {}): WearLogLike {
  return {
    garment_id: null,
    outfit_id: null,
    worn_at: ANCHOR,
    occasion: null,
    created_at: ANCHOR,
    ...overrides,
  };
}

function makeSignal(overrides: Partial<FeedbackSignalLike> & { signal_type: string }): FeedbackSignalLike {
  return {
    signal_type: overrides.signal_type,
    outfit_id: null,
    garment_id: null,
    value: null,
    metadata: null,
    created_at: ANCHOR,
    ...overrides,
  };
}

function makePair(overrides: Partial<PairMemoryLike> = {}): PairMemoryLike {
  return {
    garment_a_id: null,
    garment_b_id: null,
    positive_count: 0,
    negative_count: 0,
    last_positive_at: null,
    last_negative_at: null,
    ...overrides,
  };
}

function makePlanned(overrides: Partial<PlannedOutfitLike> = {}): PlannedOutfitLike {
  return {
    outfit_id: null,
    date: ANCHOR.slice(0, 10),
    status: "planned",
    created_at: ANCHOR,
    ...overrides,
  };
}

function makeOutfitFeedback(overrides: Partial<OutfitFeedbackLike> = {}): OutfitFeedbackLike {
  return {
    outfit_id: null,
    rating: null,
    fit_score: null,
    color_match_score: null,
    overall_score: null,
    created_at: ANCHOR,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. EMPTY INPUTS
// ─────────────────────────────────────────────────────────────────────────────

describe("buildStyleSummary — empty inputs", () => {
  it("returns a low-confidence summary with empty arrays + generic text", () => {
    const out = buildStyleSummary(emptyInputs());

    expect(out.version).toBe(1);
    expect(out.confidence).toBe(0);
    expect(out.summary_text).toBe(
      "Limited signal yet — relying on style profile preferences.",
    );

    // All arrays empty.
    expect(out.summary_json.preferred_colors).toEqual([]);
    expect(out.summary_json.avoided_colors).toEqual([]);
    expect(out.summary_json.preferred_fits).toEqual([]);
    expect(out.summary_json.avoided_fits).toEqual([]);
    expect(out.summary_json.preferred_categories).toEqual([]);
    expect(out.summary_json.underused_categories).toEqual([]);
    expect(out.summary_json.style_archetypes).toEqual([]);
    expect(out.summary_json.favorite_pairings).toEqual([]);
    expect(out.summary_json.avoided_pairings).toEqual([]);
    expect(out.summary_json.avoid_rules).toEqual([]);
    expect(out.summary_json.frequent_occasions).toEqual([]);
    expect(out.summary_json.never_suggest_garments).toEqual([]);
    expect(out.summary_json.weather_preferences).toEqual({});
    expect(out.summary_json.confidence_by_category).toEqual({});

    // Formality center defaults to neutral 50 with no signal.
    expect(out.summary_json.formality_center).toBe(50);
  });

  it("returns the limited-signal text when overall confidence < 0.2", () => {
    // 5 events out of 50-event scale = 0.1 confidence (below 0.2 threshold).
    const garments = [makeGarment({ id: "g1", color_primary: "blue" })];
    const wearLogs = Array.from({ length: 5 }).map(() =>
      makeWearLog({ garment_id: "g1" }),
    );
    const out = buildStyleSummary({
      ...emptyInputs(),
      garments,
      wearLogs,
    });
    expect(out.confidence).toBeLessThan(0.2);
    expect(out.summary_text).toContain("Limited signal");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. SINGLE NEGATIVE EVENT — NO PROMOTION
// ─────────────────────────────────────────────────────────────────────────────

describe("buildStyleSummary — single negative event", () => {
  it("does NOT promote a color into avoided_colors (N=3 floor)", () => {
    const garments = [
      makeGarment({ id: "g1", color_primary: "neon-pink" }),
      // additional garments to push the overall confidence above the
      // limited-signal threshold so we see the structured fields.
      makeGarment({ id: "g2", color_primary: "black" }),
    ];
    const outfits = [makeOutfit({ id: "o1" })];
    const outfitItems = [makeOutfitItem("o1", "g1")];

    // Single negative event on neon-pink. Plus a wave of background positive
    // events on the OTHER garment so confidence is non-trivial.
    const wearLogs = Array.from({ length: 20 }).map(() =>
      makeWearLog({ garment_id: "g2" }),
    );
    const feedbackSignals = [
      makeSignal({ signal_type: "reject_outfit", outfit_id: "o1" }),
    ];

    const out = buildStyleSummary({
      ...emptyInputs(),
      garments,
      outfits,
      outfitItems,
      wearLogs,
      feedbackSignals,
    });

    expect(out.confidence).toBeGreaterThan(0);
    // Single rejection on neon-pink → not in avoided_colors.
    expect(
      out.summary_json.avoided_colors.find((c) => c.value === "neon-pink"),
    ).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. THREE CONSISTENT NEGATIVE EVENTS — PROMOTION + CONFIDENCE ≥ 0.5
// ─────────────────────────────────────────────────────────────────────────────

describe("buildStyleSummary — repeated negative events", () => {
  it("promotes a color to avoided_colors with confidence ≥ 0.5 after 3 events", () => {
    const garments = [
      makeGarment({ id: "g1", color_primary: "olive", fit: "skinny" }),
    ];
    const outfits = [
      makeOutfit({ id: "o1" }),
      makeOutfit({ id: "o2" }),
      makeOutfit({ id: "o3" }),
    ];
    const outfitItems = [
      makeOutfitItem("o1", "g1"),
      makeOutfitItem("o2", "g1"),
      makeOutfitItem("o3", "g1"),
    ];
    const feedbackSignals = [
      makeSignal({ signal_type: "reject_outfit", outfit_id: "o1" }),
      makeSignal({ signal_type: "reject_outfit", outfit_id: "o2" }),
      makeSignal({ signal_type: "reject_outfit", outfit_id: "o3" }),
    ];

    const out = buildStyleSummary({
      ...emptyInputs(),
      garments,
      outfits,
      outfitItems,
      feedbackSignals,
    });

    const olive = out.summary_json.avoided_colors.find(
      (c) => c.value === "olive",
    );
    expect(olive).toBeDefined();
    expect(olive!.confidence).toBeGreaterThanOrEqual(0.5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. MIXED SIGNALS — NET DERIVATION
// ─────────────────────────────────────────────────────────────────────────────

describe("buildStyleSummary — mixed signals", () => {
  it("computes net positive minus negative correctly across save/wear/skip", () => {
    const garments = [makeGarment({ id: "g1", color_primary: "navy" })];
    const outfits = [
      makeOutfit({ id: "o1" }),
      makeOutfit({ id: "o2" }),
      makeOutfit({ id: "o3" }),
      makeOutfit({ id: "o4" }),
      makeOutfit({ id: "o5" }),
      makeOutfit({ id: "o6" }),
    ];
    const outfitItems = [
      makeOutfitItem("o1", "g1"),
      makeOutfitItem("o2", "g1"),
      makeOutfitItem("o3", "g1"),
      makeOutfitItem("o4", "g1"),
      makeOutfitItem("o5", "g1"),
      makeOutfitItem("o6", "g1"),
    ];
    // 5 saves, 1 skip → net positive.
    const feedbackSignals = [
      makeSignal({ signal_type: "save_outfit", outfit_id: "o1" }),
      makeSignal({ signal_type: "save_outfit", outfit_id: "o2" }),
      makeSignal({ signal_type: "save_outfit", outfit_id: "o3" }),
      makeSignal({ signal_type: "save_outfit", outfit_id: "o4" }),
      makeSignal({ signal_type: "save_outfit", outfit_id: "o5" }),
      makeSignal({ signal_type: "skip_outfit", outfit_id: "o6" }),
    ];

    const out = buildStyleSummary({
      ...emptyInputs(),
      garments,
      outfits,
      outfitItems,
      feedbackSignals,
    });

    const navy = out.summary_json.preferred_colors.find(
      (c) => c.value === "navy",
    );
    expect(navy).toBeDefined();
    expect(navy!.confidence).toBeGreaterThan(0);
    expect(
      out.summary_json.avoided_colors.find((c) => c.value === "navy"),
    ).toBeUndefined();
  });

  it("does not promote when positives equal negatives", () => {
    const garments = [makeGarment({ id: "g1", color_primary: "tan" })];
    const outfits = Array.from({ length: 6 }).map((_, i) =>
      makeOutfit({ id: `o${i + 1}` }),
    );
    const outfitItems = outfits.map((o) => makeOutfitItem(o.id, "g1"));

    const feedbackSignals = [
      makeSignal({ signal_type: "save_outfit", outfit_id: "o1" }),
      makeSignal({ signal_type: "save_outfit", outfit_id: "o2" }),
      makeSignal({ signal_type: "save_outfit", outfit_id: "o3" }),
      makeSignal({ signal_type: "skip_outfit", outfit_id: "o4" }),
      makeSignal({ signal_type: "skip_outfit", outfit_id: "o5" }),
      makeSignal({ signal_type: "skip_outfit", outfit_id: "o6" }),
    ];

    const out = buildStyleSummary({
      ...emptyInputs(),
      garments,
      outfits,
      outfitItems,
      feedbackSignals,
    });

    expect(
      out.summary_json.preferred_colors.find((c) => c.value === "tan"),
    ).toBeUndefined();
    expect(
      out.summary_json.avoided_colors.find((c) => c.value === "tan"),
    ).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. RECENCY DECAY — OLD SIGNALS WEIGHT LESS THAN FRESH
// ─────────────────────────────────────────────────────────────────────────────

describe("buildStyleSummary — recency decay", () => {
  it("old signals (180d+) weigh roughly half a fresh signal of equal direction", () => {
    // We test by comparing two universes:
    //   A: 6 saves on the same color, all fresh (0d) → high confidence
    //   B: 6 saves on the same color, all 180d old → much lower confidence
    function buildUniverse(daysBack: number): number {
      const garments = [makeGarment({ id: "g1", color_primary: "merlot" })];
      const outfits = Array.from({ length: 6 }).map((_, i) =>
        makeOutfit({ id: `o${i + 1}` }),
      );
      const outfitItems = outfits.map((o) => makeOutfitItem(o.id, "g1"));
      const ts = isoOffset(daysBack);
      // Use ANCHOR as the time anchor so decay actually fires (otherwise the
      // builder treats the most-recent signal as "now" and decay is zero).
      // We achieve this by also writing one outfit's created_at = ANCHOR.
      const feedbackSignals = outfits.map((o) =>
        makeSignal({
          signal_type: "save_outfit",
          outfit_id: o.id,
          created_at: ts,
        }),
      );
      // Anchor at ANCHOR so decay days are reproducible (we add a wear_log at
      // ANCHOR to fix the time anchor).
      const wearLogs: WearLogLike[] = [
        makeWearLog({ garment_id: "g1", worn_at: ANCHOR }),
      ];
      const out = buildStyleSummary({
        ...emptyInputs(),
        garments,
        outfits,
        outfitItems,
        feedbackSignals,
        wearLogs,
      });
      return (
        out.summary_json.preferred_colors.find((c) => c.value === "merlot")
          ?.confidence ?? 0
      );
    }
    const fresh = buildUniverse(0);
    const old = buildUniverse(180);
    expect(fresh).toBeGreaterThan(old);
    // 180d = 2 half-lives → 1/4 weight, so old confidence < fresh / 1.5.
    expect(old).toBeLessThan(fresh * 0.75);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. LEGACY SIGNAL_TYPE NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

describe("buildStyleSummary — legacy signal_type normalization", () => {
  it("treats signal_type='save' as save_outfit (positive)", () => {
    const garments = [makeGarment({ id: "g1", color_primary: "burgundy" })];
    const outfits = Array.from({ length: 4 }).map((_, i) =>
      makeOutfit({ id: `o${i + 1}` }),
    );
    const outfitItems = outfits.map((o) => makeOutfitItem(o.id, "g1"));
    // Use the legacy name 'save' instead of canonical 'save_outfit'.
    const feedbackSignals = outfits.map((o) =>
      makeSignal({ signal_type: "save", outfit_id: o.id }),
    );

    const out = buildStyleSummary({
      ...emptyInputs(),
      garments,
      outfits,
      outfitItems,
      feedbackSignals,
    });

    // Should normalize to save_outfit and contribute to preferred_colors.
    const burgundy = out.summary_json.preferred_colors.find(
      (c) => c.value === "burgundy",
    );
    expect(burgundy).toBeDefined();
    expect(burgundy!.confidence).toBeGreaterThan(0);
  });

  it("ignores rows with unknown signal_type (returns null from normalizer)", () => {
    const garments = [makeGarment({ id: "g1", color_primary: "rust" })];
    const outfits = Array.from({ length: 4 }).map((_, i) =>
      makeOutfit({ id: `o${i + 1}` }),
    );
    const outfitItems = outfits.map((o) => makeOutfitItem(o.id, "g1"));
    const feedbackSignals = outfits.map((o) =>
      makeSignal({ signal_type: "garment_edit", outfit_id: o.id }), // dead enum
    );

    const out = buildStyleSummary({
      ...emptyInputs(),
      garments,
      outfits,
      outfitItems,
      feedbackSignals,
    });

    expect(
      out.summary_json.preferred_colors.find((c) => c.value === "rust"),
    ).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. PAIR MEMORY AGGREGATION
// ─────────────────────────────────────────────────────────────────────────────

describe("buildStyleSummary — pair memory aggregation", () => {
  it("promotes a pair with positive_count=5 negative_count=1 + recent into favorite_pairings", () => {
    const pairMemory = [
      makePair({
        garment_a_id: "ga",
        garment_b_id: "gb",
        positive_count: 5,
        negative_count: 1,
        last_positive_at: ANCHOR,
        last_negative_at: isoOffset(45),
      }),
    ];

    const out = buildStyleSummary({
      ...emptyInputs(),
      pairMemory,
    });

    expect(out.summary_json.favorite_pairings).toHaveLength(1);
    expect(out.summary_json.favorite_pairings[0].a).toBe("ga");
    expect(out.summary_json.favorite_pairings[0].b).toBe("gb");
    expect(out.summary_json.favorite_pairings[0].weight).toBeGreaterThan(0);
    expect(out.summary_json.avoided_pairings).toHaveLength(0);
  });

  it("promotes negative-dominant pair into avoided_pairings", () => {
    const pairMemory = [
      makePair({
        garment_a_id: "g1",
        garment_b_id: "g2",
        positive_count: 0,
        negative_count: 4,
        last_negative_at: ANCHOR,
      }),
    ];
    const out = buildStyleSummary({
      ...emptyInputs(),
      pairMemory,
    });
    expect(out.summary_json.avoided_pairings).toHaveLength(1);
    expect(out.summary_json.favorite_pairings).toHaveLength(0);
  });

  it("supports legacy garment_id_a / garment_id_b column names", () => {
    const pairMemory = [
      makePair({
        garment_id_a: "ga2",
        garment_id_b: "gb2",
        positive_count: 4,
        negative_count: 0,
        last_positive_at: ANCHOR,
      }),
    ];
    const out = buildStyleSummary({
      ...emptyInputs(),
      pairMemory,
    });
    expect(out.summary_json.favorite_pairings[0].a).toBe("ga2");
    expect(out.summary_json.favorite_pairings[0].b).toBe("gb2");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. NEVER_SUGGEST_GARMENT
// ─────────────────────────────────────────────────────────────────────────────

describe("buildStyleSummary — never_suggest_garment", () => {
  it("populates never_suggest_garments[] with referenced garment IDs", () => {
    const feedbackSignals = [
      makeSignal({
        signal_type: "never_suggest_garment",
        garment_id: "g-banned-1",
      }),
      makeSignal({
        signal_type: "never_suggest_garment",
        garment_id: "g-banned-2",
      }),
      // Dup of g-banned-1: should still appear once.
      makeSignal({
        signal_type: "never_suggest_garment",
        garment_id: "g-banned-1",
      }),
    ];

    const out = buildStyleSummary({
      ...emptyInputs(),
      feedbackSignals,
    });

    expect(out.summary_json.never_suggest_garments).toEqual([
      "g-banned-1",
      "g-banned-2",
    ]);
  });

  it("emits an avoid_rule entry per banned garment with explicit source", () => {
    const garments = [
      makeGarment({ id: "g-banned-1", category: "shoes" }),
    ];
    const feedbackSignals = [
      makeSignal({
        signal_type: "never_suggest_garment",
        garment_id: "g-banned-1",
      }),
    ];
    const out = buildStyleSummary({
      ...emptyInputs(),
      garments,
      feedbackSignals,
    });
    const rule = out.summary_json.avoid_rules.find((r) =>
      r.rule.includes("never suggest")
    );
    expect(rule).toBeDefined();
    expect(rule!.source).toBe("explicit");
    expect(rule!.confidence).toBe(1.0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. DETERMINISM
// ─────────────────────────────────────────────────────────────────────────────

describe("buildStyleSummary — determinism", () => {
  it("produces byte-identical output for the same inputs (same JSON)", () => {
    const inputs: StyleSummaryInputs = {
      profile: {
        preferences: {
          styleProfile: { styleWords: ["minimal", "scandinavian"] },
        },
      },
      garments: [
        makeGarment({ id: "g1", color_primary: "black", fit: "regular" }),
        makeGarment({ id: "g2", color_primary: "white", fit: "regular" }),
        makeGarment({
          id: "g3",
          color_primary: "navy",
          fit: "slim",
          category: "bottom",
        }),
      ],
      outfits: [
        makeOutfit({ id: "o1", saved: true, rating: 5 }),
        makeOutfit({ id: "o2", saved: false, rating: 3 }),
        makeOutfit({ id: "o3", saved: true, rating: 4 }),
      ],
      outfitItems: [
        makeOutfitItem("o1", "g1"),
        makeOutfitItem("o1", "g3"),
        makeOutfitItem("o2", "g2"),
        makeOutfitItem("o2", "g3"),
        makeOutfitItem("o3", "g1"),
      ],
      wearLogs: [
        makeWearLog({ garment_id: "g1", worn_at: isoOffset(2) }),
        makeWearLog({ garment_id: "g3", worn_at: isoOffset(7) }),
      ],
      feedbackSignals: [
        makeSignal({
          signal_type: "save_outfit",
          outfit_id: "o1",
          created_at: isoOffset(1),
        }),
        makeSignal({
          signal_type: "save_outfit",
          outfit_id: "o3",
          created_at: isoOffset(3),
        }),
        makeSignal({
          signal_type: "skip_outfit",
          outfit_id: "o2",
          created_at: isoOffset(4),
        }),
      ],
      pairMemory: [
        makePair({
          garment_a_id: "g1",
          garment_b_id: "g3",
          positive_count: 3,
          negative_count: 0,
          last_positive_at: isoOffset(1),
        }),
      ],
      plannedOutfits: [
        makePlanned({
          outfit_id: "o2",
          status: "skipped",
          created_at: isoOffset(5),
        }),
      ],
      outfitFeedback: [
        makeOutfitFeedback({ outfit_id: "o1", rating: 5, created_at: isoOffset(2) }),
      ],
    };

    const out1 = buildStyleSummary(inputs);
    const out2 = buildStyleSummary(inputs);

    // Stringify with stable key order (JSON.stringify is deterministic across
    // calls when given the same object).
    expect(JSON.stringify(out1)).toBe(JSON.stringify(out2));
    expect(out1.summary_text).toBe(out2.summary_text);
    expect(out1.confidence).toBe(out2.confidence);
  });

  it("output has frozen arrays / objects (caller cannot mutate)", () => {
    const out = buildStyleSummary(emptyInputs());
    expect(Object.isFrozen(out)).toBe(true);
    expect(Object.isFrozen(out.summary_json.preferred_colors)).toBe(true);
    expect(Object.isFrozen(out.summary_json.avoid_rules)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. PERFORMANCE
// ─────────────────────────────────────────────────────────────────────────────

describe("buildStyleSummary — performance", () => {
  it("completes within 200ms for 200 garments + 500 outfits + 1000 signals + 200 pair-memory rows", () => {
    const garments: GarmentLike[] = [];
    for (let i = 0; i < 200; i++) {
      garments.push(
        makeGarment({
          id: `g${i}`,
          category: i % 3 === 0 ? "top" : i % 3 === 1 ? "bottom" : "shoes",
          color_primary: ["black", "white", "navy", "olive", "tan"][i % 5],
          fit: ["regular", "slim", "relaxed", "oversized"][i % 4],
        }),
      );
    }
    const outfits: OutfitLike[] = [];
    const outfitItems: OutfitItemLike[] = [];
    for (let i = 0; i < 500; i++) {
      outfits.push(
        makeOutfit({
          id: `o${i}`,
          saved: i % 4 === 0,
          rating: ((i % 5) + 1),
          occasion: ["work", "casual", "date", "party"][i % 4],
          created_at: isoOffset(i % 90),
        }),
      );
      // Each outfit gets 3 garments.
      outfitItems.push(
        makeOutfitItem(`o${i}`, `g${i % 200}`),
        makeOutfitItem(`o${i}`, `g${(i + 50) % 200}`),
        makeOutfitItem(`o${i}`, `g${(i + 100) % 200}`),
      );
    }
    const feedbackSignals: FeedbackSignalLike[] = [];
    for (let i = 0; i < 1000; i++) {
      feedbackSignals.push(
        makeSignal({
          signal_type: i % 3 === 0
            ? "save_outfit"
            : i % 3 === 1
            ? "wear_outfit"
            : "skip_outfit",
          outfit_id: `o${i % 500}`,
          created_at: isoOffset(i % 60),
        }),
      );
    }
    const pairMemory: PairMemoryLike[] = [];
    for (let i = 0; i < 200; i++) {
      pairMemory.push(
        makePair({
          garment_a_id: `g${i}`,
          garment_b_id: `g${(i + 1) % 200}`,
          positive_count: i % 8,
          negative_count: i % 5,
          last_positive_at: isoOffset(i % 90),
          last_negative_at: isoOffset((i + 30) % 90),
        }),
      );
    }

    const start = performance.now();
    const out = buildStyleSummary({
      ...emptyInputs(),
      garments,
      outfits,
      outfitItems,
      feedbackSignals,
      pairMemory,
    });
    const elapsed = performance.now() - start;

    expect(out.summary_json).toBeDefined();
    expect(out.summary_text.length).toBeLessThanOrEqual(500);
    // Sanity check — not a strict perf gate, but flags catastrophic slowdowns.
    expect(elapsed).toBeLessThan(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EXTRA — META & EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────

describe("buildStyleSummary — summary_text constraints", () => {
  it("never exceeds 500 characters", () => {
    // Build inputs with many archetypes / colors / occasions / weather bands.
    const archetypes = [
      "minimal",
      "scandinavian",
      "edgy",
      "bohemian",
      "preppy",
    ];
    const colors = ["black", "white", "navy", "olive", "tan", "merlot"];
    const fits = ["slim", "skinny", "fitted"];
    const garments: GarmentLike[] = [];
    let gid = 0;
    for (const c of colors) {
      for (const f of fits) {
        garments.push(
          makeGarment({
            id: `g${gid++}`,
            color_primary: c,
            fit: f,
          }),
        );
      }
    }
    const outfits: OutfitLike[] = [];
    const outfitItems: OutfitItemLike[] = [];
    const occasions = ["work", "casual", "date", "party", "travel"];
    let oid = 0;
    for (const occ of occasions) {
      for (let i = 0; i < 5; i++) {
        outfits.push(
          makeOutfit({
            id: `o${oid}`,
            saved: true,
            rating: 5,
            occasion: occ,
            weather: { temp_c: 5 + i * 5 }, // hits all 3 bands
          }),
        );
        outfitItems.push(makeOutfitItem(`o${oid}`, garments[i % garments.length].id));
        oid++;
      }
    }
    const feedbackSignals: FeedbackSignalLike[] = [];
    for (let i = 0; i < 50; i++) {
      feedbackSignals.push(
        makeSignal({
          signal_type: "save_outfit",
          outfit_id: `o${i % outfits.length}`,
        }),
      );
    }
    const out = buildStyleSummary({
      ...emptyInputs(),
      profile: {
        preferences: { styleProfile: { styleWords: archetypes } },
      },
      garments,
      outfits,
      outfitItems,
      feedbackSignals,
    });
    expect(out.summary_text.length).toBeLessThanOrEqual(500);
  });
});

describe("buildStyleSummary — wear_logs treated as wear_outfit (D2)", () => {
  it("3 wear_logs on same color promote to preferred_colors even without feedback_signals rows", () => {
    const garments = [makeGarment({ id: "g1", color_primary: "forest" })];
    const wearLogs = [
      makeWearLog({ garment_id: "g1", worn_at: isoOffset(1) }),
      makeWearLog({ garment_id: "g1", worn_at: isoOffset(2) }),
      makeWearLog({ garment_id: "g1", worn_at: isoOffset(3) }),
    ];
    const out = buildStyleSummary({
      ...emptyInputs(),
      garments,
      wearLogs,
    });
    const forest = out.summary_json.preferred_colors.find(
      (c) => c.value === "forest",
    );
    expect(forest).toBeDefined();
    expect(forest!.confidence).toBeGreaterThan(0);
  });
});

describe("buildStyleSummary — formality_center", () => {
  it("computes mean formality from worn garments and converts 1-5 to 0-100", () => {
    const garments = [
      makeGarment({ id: "g1", formality: 5 }),
      makeGarment({ id: "g2", formality: 5 }),
      makeGarment({ id: "g3", formality: 5 }),
    ];
    const wearLogs = garments.map((g) =>
      makeWearLog({ garment_id: g.id, worn_at: isoOffset(1) }),
    );
    const out = buildStyleSummary({
      ...emptyInputs(),
      garments,
      wearLogs,
    });
    // formality 5 → 100.
    expect(out.summary_json.formality_center).toBe(100);
  });

  it("falls back to profile.workFormality when wear data is sparse", () => {
    const out = buildStyleSummary({
      ...emptyInputs(),
      profile: { preferences: { styleProfile: { workFormality: 75 } } },
    });
    expect(out.summary_json.formality_center).toBe(75);
  });
});

describe("buildStyleSummary — category aliasing", () => {
  it("treats 'tops' and 'top' as the same category", () => {
    const garments = [
      makeGarment({ id: "g1", category: "tops" }),
      makeGarment({ id: "g2", category: "top" }),
      makeGarment({ id: "g3", category: "top" }),
    ];
    const wearLogs = garments.map((g) =>
      makeWearLog({ garment_id: g.id, worn_at: ANCHOR }),
    );
    const out = buildStyleSummary({
      ...emptyInputs(),
      garments,
      wearLogs,
    });
    // Confidence should reflect 3 events (post-aliasing), not split 1+2.
    expect(out.summary_json.confidence_by_category["top"]).toBeGreaterThan(0);
    expect(out.summary_json.confidence_by_category["tops"]).toBeUndefined();
  });
});

describe("buildStyleSummary — explicit avoid rules from feedback_text", () => {
  it("escalates to source='explicit' when feedback_text has avoid tokens + matched feature", () => {
    const garments = [
      makeGarment({ id: "g1", color_primary: "black", fit: "skinny" }),
      makeGarment({ id: "g2", color_primary: "black", fit: "skinny" }),
      makeGarment({ id: "g3", color_primary: "black", fit: "skinny" }),
    ];
    const outfits = Array.from({ length: 3 }).map((_, i) =>
      makeOutfit({ id: `o${i + 1}` }),
    );
    const outfitItems = outfits.map((o, i) => makeOutfitItem(o.id, `g${i + 1}`));
    const feedbackSignals = [
      makeSignal({
        signal_type: "reject_outfit",
        outfit_id: "o1",
        metadata: { feedback_text: "i hate skinny" },
      }),
      makeSignal({ signal_type: "reject_outfit", outfit_id: "o2" }),
      makeSignal({ signal_type: "reject_outfit", outfit_id: "o3" }),
    ];

    const out = buildStyleSummary({
      ...emptyInputs(),
      garments,
      outfits,
      outfitItems,
      feedbackSignals,
    });

    const explicit = out.summary_json.avoid_rules.find(
      (r) => r.source === "explicit",
    );
    expect(explicit).toBeDefined();
    expect(explicit!.rule).toMatch(/skinny/);
  });
});

describe("buildStyleSummary — quick_reaction direction in metadata", () => {
  it("treats quick_reaction with value='dislike' as negative", () => {
    const garments = [makeGarment({ id: "g1", color_primary: "puce" })];
    const outfits = Array.from({ length: 3 }).map((_, i) =>
      makeOutfit({ id: `o${i + 1}` }),
    );
    const outfitItems = outfits.map((o) => makeOutfitItem(o.id, "g1"));
    const feedbackSignals = outfits.map((o) =>
      makeSignal({
        signal_type: "quick_reaction",
        outfit_id: o.id,
        value: "dislike",
      }),
    );

    const out = buildStyleSummary({
      ...emptyInputs(),
      garments,
      outfits,
      outfitItems,
      feedbackSignals,
    });

    const puce = out.summary_json.avoided_colors.find((c) => c.value === "puce");
    expect(puce).toBeDefined();
  });
});
