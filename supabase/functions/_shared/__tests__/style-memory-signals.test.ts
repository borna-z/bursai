import { describe, expect, it } from "vitest";
import {
  CANONICAL_STYLE_MEMORY_SIGNALS,
  isCanonicalStyleMemorySignal,
  normalizeStyleMemorySignal,
  type CanonicalStyleMemorySignal,
} from "../style-memory-signals";

describe("CANONICAL_STYLE_MEMORY_SIGNALS", () => {
  it("exports all 11 canonical names", () => {
    expect(CANONICAL_STYLE_MEMORY_SIGNALS).toHaveLength(11);
  });

  it("matches the type union exactly (order, spelling, no duplicates)", () => {
    const expected: CanonicalStyleMemorySignal[] = [
      "save_outfit",
      "unsave_outfit",
      "rate_outfit",
      "wear_outfit",
      "skip_outfit",
      "reject_outfit",
      "swap_garment",
      "quick_reaction",
      "never_suggest_garment",
      "like_pair",
      "dislike_pair",
    ];
    expect([...CANONICAL_STYLE_MEMORY_SIGNALS]).toEqual(expected);

    // Defense-in-depth: detect future duplicate-add bugs.
    const seen = new Set<string>();
    for (const name of CANONICAL_STYLE_MEMORY_SIGNALS) {
      expect(seen.has(name)).toBe(false);
      seen.add(name);
    }
  });
});

describe("isCanonicalStyleMemorySignal", () => {
  it("returns true for every canonical name", () => {
    for (const name of CANONICAL_STYLE_MEMORY_SIGNALS) {
      expect(isCanonicalStyleMemorySignal(name)).toBe(true);
    }
  });

  it("returns false for known legacy names (writers + readers)", () => {
    const legacy = [
      "save",
      "saved",
      "unsave",
      "rating",
      "wear_confirm",
      "wear",
      "planned_follow_through",
      "swap_choice",
      "swap",
      "ignore",
      "planned_skip",
      "reject",
      "dislike",
      "thumbs_down",
      "like",
      "garment_edit",
    ];
    for (const name of legacy) {
      expect(isCanonicalStyleMemorySignal(name)).toBe(false);
    }
  });

  it("returns false for unknown / empty / non-string", () => {
    expect(isCanonicalStyleMemorySignal("foobar")).toBe(false);
    expect(isCanonicalStyleMemorySignal("")).toBe(false);
    expect(isCanonicalStyleMemorySignal(undefined)).toBe(false);
    expect(isCanonicalStyleMemorySignal(null)).toBe(false);
    expect(isCanonicalStyleMemorySignal(42)).toBe(false);
    expect(isCanonicalStyleMemorySignal({})).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(isCanonicalStyleMemorySignal("Save_Outfit")).toBe(false);
    expect(isCanonicalStyleMemorySignal("SAVE_OUTFIT")).toBe(false);
    expect(isCanonicalStyleMemorySignal("save_Outfit")).toBe(false);
  });
});

describe("normalizeStyleMemorySignal — canonical passthrough", () => {
  it.each(CANONICAL_STYLE_MEMORY_SIGNALS)(
    "passes %s through unchanged",
    (name) => {
      expect(normalizeStyleMemorySignal(name)).toBe(name);
    },
  );
});

describe("normalizeStyleMemorySignal — outfit-save legacy", () => {
  it("maps save → save_outfit (P82 §7a)", () => {
    expect(normalizeStyleMemorySignal("save")).toBe("save_outfit");
  });
  it("maps saved → save_outfit (alias)", () => {
    expect(normalizeStyleMemorySignal("saved")).toBe("save_outfit");
  });
  it("maps unsave → unsave_outfit", () => {
    expect(normalizeStyleMemorySignal("unsave")).toBe("unsave_outfit");
  });
});

describe("normalizeStyleMemorySignal — rating legacy", () => {
  it("maps rating → rate_outfit", () => {
    expect(normalizeStyleMemorySignal("rating")).toBe("rate_outfit");
  });
});

describe("normalizeStyleMemorySignal — wear legacy", () => {
  it("maps wear_confirm → wear_outfit", () => {
    expect(normalizeStyleMemorySignal("wear_confirm")).toBe("wear_outfit");
  });
  it("maps wear → wear_outfit (latent read-side name)", () => {
    expect(normalizeStyleMemorySignal("wear")).toBe("wear_outfit");
  });
  it("maps planned_follow_through → wear_outfit (dead enum, reserved)", () => {
    expect(normalizeStyleMemorySignal("planned_follow_through")).toBe(
      "wear_outfit",
    );
  });
});

describe("normalizeStyleMemorySignal — swap legacy", () => {
  it("maps swap_choice → swap_garment (writer side)", () => {
    expect(normalizeStyleMemorySignal("swap_choice")).toBe("swap_garment");
  });
  it("maps swap → swap_garment (reader side)", () => {
    expect(normalizeStyleMemorySignal("swap")).toBe("swap_garment");
  });
});

describe("normalizeStyleMemorySignal — skip legacy", () => {
  it("maps ignore → skip_outfit (reader side)", () => {
    expect(normalizeStyleMemorySignal("ignore")).toBe("skip_outfit");
  });
  it("maps planned_skip → skip_outfit (dead enum, reserved)", () => {
    expect(normalizeStyleMemorySignal("planned_skip")).toBe("skip_outfit");
  });
});

describe("normalizeStyleMemorySignal — reject legacy (D1 disambiguation)", () => {
  it("maps reject → reject_outfit (outfit-level intent per D1)", () => {
    // The legacy backend at burs_style_engine:995 read `'reject'` and
    // penalized sig.garment_id — a latent bug where outfit-level rejections
    // poisoned individual garments. P88 fixes the read site to penalize
    // outfit_id. New garment-level intent uses `never_suggest_garment`.
    expect(normalizeStyleMemorySignal("reject")).toBe("reject_outfit");
  });
});

describe("normalizeStyleMemorySignal — reaction legacy (lossy collapse)", () => {
  it("maps dislike → quick_reaction (caller enriches metadata.value)", () => {
    expect(normalizeStyleMemorySignal("dislike")).toBe("quick_reaction");
  });
  it("maps thumbs_down → quick_reaction (caller enriches metadata.value)", () => {
    expect(normalizeStyleMemorySignal("thumbs_down")).toBe("quick_reaction");
  });
  it("maps like → quick_reaction (caller enriches metadata.value)", () => {
    expect(normalizeStyleMemorySignal("like")).toBe("quick_reaction");
  });
});

describe("normalizeStyleMemorySignal — null returns", () => {
  it("returns null for dead enum garment_edit", () => {
    // Confirmed never emitted in production by P82 audit. Future writers
    // attempting this name should be dropped at P85's memory_ingest gate
    // with a logged warning.
    expect(normalizeStyleMemorySignal("garment_edit")).toBeNull();
  });

  it("returns null for unknown values", () => {
    expect(normalizeStyleMemorySignal("foobar")).toBeNull();
    expect(normalizeStyleMemorySignal("not_a_real_signal")).toBeNull();
    expect(normalizeStyleMemorySignal("save_outfit_x")).toBeNull();
    expect(normalizeStyleMemorySignal("save_")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeStyleMemorySignal("")).toBeNull();
  });

  it("is case-sensitive — Save returns null", () => {
    expect(normalizeStyleMemorySignal("Save")).toBeNull();
  });
  it("is case-sensitive — SAVE_OUTFIT returns null", () => {
    expect(normalizeStyleMemorySignal("SAVE_OUTFIT")).toBeNull();
  });
  it("is case-sensitive — Swap_Choice returns null", () => {
    expect(normalizeStyleMemorySignal("Swap_Choice")).toBeNull();
  });

  it("returns null for non-string inputs", () => {
    expect(normalizeStyleMemorySignal(undefined)).toBeNull();
    expect(normalizeStyleMemorySignal(null)).toBeNull();
    expect(normalizeStyleMemorySignal(42)).toBeNull();
    expect(normalizeStyleMemorySignal(true)).toBeNull();
    expect(normalizeStyleMemorySignal({})).toBeNull();
    expect(normalizeStyleMemorySignal([])).toBeNull();
  });

  it("returns null for prototype-pollution probes (defensive)", () => {
    // Object-property lookup with hasOwnProperty guard prevents inherited
    // properties (toString, constructor, hasOwnProperty itself) from
    // accidentally returning a hit.
    expect(normalizeStyleMemorySignal("toString")).toBeNull();
    expect(normalizeStyleMemorySignal("constructor")).toBeNull();
    expect(normalizeStyleMemorySignal("hasOwnProperty")).toBeNull();
    expect(normalizeStyleMemorySignal("__proto__")).toBeNull();
  });
});

describe("normalizeStyleMemorySignal — coverage parity", () => {
  it("covers every name listed in P82 audit §7a (no rows lost)", () => {
    // This test guards against future audit-row additions silently
    // bypassing the normalize map. If a P82 §7a row gets added without
    // a corresponding LEGACY_TO_CANONICAL entry, this assertion fails.
    const auditRows = [
      // Canonical (passthrough)
      "save_outfit",
      "unsave_outfit",
      "rate_outfit",
      "wear_outfit",
      "skip_outfit",
      "reject_outfit",
      "swap_garment",
      "quick_reaction",
      "never_suggest_garment",
      "like_pair",
      "dislike_pair",
      // Legacy mapped
      "save",
      "saved",
      "unsave",
      "rating",
      "wear_confirm",
      "wear",
      "planned_follow_through",
      "swap_choice",
      "swap",
      "ignore",
      "planned_skip",
      "reject",
      "dislike",
      "thumbs_down",
      "like",
    ];
    for (const row of auditRows) {
      const result = normalizeStyleMemorySignal(row);
      expect(result).not.toBeNull();
      expect(CANONICAL_STYLE_MEMORY_SIGNALS).toContain(result);
    }
  });
});
