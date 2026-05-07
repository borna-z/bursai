// Theme 7 (post-launch audit) — tests for `readUnifiedStylePrefs`.
//
// Coverage targets the two slot-coverage gaps the helper closes:
//   • V3 mirror with empty `workFormality` (post-backfill skip-semantics)
//     should fall through to the V4 floor/ceiling midpoint, not the
//     neutral-50 default that pre-fix `style-summary-builder.ts` emitted.
//   • V4-native row with no V3 mirror (cold-start race window) should
//     surface V3-vocab keys translated from V4 canonical names instead of
//     leaving the engine flying blind.
//
// Also pins the legacy contracts the helper preserves so a future
// refactor can't silently regress `getStylePrefs` callers:
//   • Wrapped form `{ styleProfile: { … } }` → unwrap to inner record.
//   • Flat form (V3 fields at the top level, used by unit tests) → return
//     as-is.
//   • Empty / null preferences → `{}`.

import { describe, expect, it } from "vitest";
import { isNonEmptyObject, readUnifiedStylePrefs } from "../style-prefs-reader";

describe("readUnifiedStylePrefs — legacy contracts preserved", () => {
  it("null / undefined input → empty object", () => {
    expect(readUnifiedStylePrefs(null)).toEqual({});
    expect(readUnifiedStylePrefs(undefined)).toEqual({});
  });

  it("empty preferences → empty object", () => {
    expect(readUnifiedStylePrefs({})).toEqual({});
  });

  it("wrapped form ({ styleProfile: { … } }) unwraps the V3 mirror", () => {
    const out = readUnifiedStylePrefs({
      styleProfile: { styleWords: ["minimal"], workFormality: 60 },
    });
    expect(out.styleWords).toEqual(["minimal"]);
    expect(out.workFormality).toBe(60);
  });

  it("flat form (V3 fields at top level) — V3 keys pass through", () => {
    // Production callers always pass wrapped, but `outfit-scoring.ts:603`
    // `getStylePrefs` historically tolerated the flat shape so unit tests
    // and synthetic callers keep working. Pin the contract here.
    const out = readUnifiedStylePrefs({
      formalityCeiling: 95,
      formalityFloor: 70,
    });
    expect(out.formalityCeiling).toBe(95);
    expect(out.formalityFloor).toBe(70);
  });

  it("V3 mirror keys win when present and non-empty", () => {
    const out = readUnifiedStylePrefs({
      styleProfile: {
        styleWords: ["scandinavian"],
        favoriteColors: ["beige"],
        fit: "regular",
        paletteVibe: "neutral",
        workFormality: 40,
        comfortVsStyle: 60,
      },
      style_profile_v4_jsonb: {
        archetypes: ["streetwear"],
        favoriteColors: ["red"],
        fitOverall: "oversized",
        paletteVibe: "bright",
        formalityCeiling: 95,
        formalityFloor: 70,
      },
    });
    // V3 values win — V4 fallback only fires for empty/missing slots.
    expect(out.styleWords).toEqual(["scandinavian"]);
    expect(out.favoriteColors).toEqual(["beige"]);
    expect(out.fit).toBe("regular");
    expect(out.paletteVibe).toBe("neutral");
    expect(out.workFormality).toBe(40);
    expect(out.comfortVsStyle).toBe(60);
    // V4 formality bounds pass through regardless (they don't collide with
    // V3 keys and `resolveOccasionSubmode` reads them by V4 name).
    expect(out.formalityCeiling).toBe(95);
    expect(out.formalityFloor).toBe(70);
  });
});

describe("readUnifiedStylePrefs — V4 fallback for empty V3 slots", () => {
  it("workFormality '' (V3 backfill skip-semantics) → V4 floor/ceiling midpoint", () => {
    // The exact production shape: `migrateV4ToV3Compat` writes '' into the
    // V3 mirror because V3 vocab can't represent V4's continuous bounds.
    // Pre-fix the engine type-checked this and defaulted to neutral 50;
    // the helper now derives the real midpoint from V4.
    const out = readUnifiedStylePrefs({
      styleProfile: {
        styleWords: ["minimal"],
        workFormality: "", // ← skip-semantics from migrateV4ToV3Compat:677
        comfortVsStyle: 50,
      },
      style_profile_v4_jsonb: {
        archetypes: ["minimal"],
        formalityCeiling: 80,
        formalityFloor: 60,
      },
    });
    // Midpoint = (60 + 80) / 2 = 70.
    expect(out.workFormality).toBe(70);
  });

  it("workFormality missing entirely → V4 floor/ceiling midpoint", () => {
    const out = readUnifiedStylePrefs({
      styleProfile: { styleWords: ["minimal"] },
      style_profile_v4_jsonb: { formalityCeiling: 95, formalityFloor: 70 },
    });
    expect(out.workFormality).toBe(83); // round((70 + 95) / 2) = 82.5 → 83
  });

  it("workFormality with only one V4 bound present → no fallback", () => {
    // Same incomplete-signal contract `resolveOccasionSubmode` enforces:
    // both bounds required to derive a midpoint.
    const out = readUnifiedStylePrefs({
      styleProfile: { workFormality: "" },
      style_profile_v4_jsonb: { formalityCeiling: 95 },
    });
    expect(out.workFormality).toBeUndefined();
  });

  it("styleWords [] → V4 archetypes fallback", () => {
    const out = readUnifiedStylePrefs({
      styleProfile: { styleWords: [] },
      style_profile_v4_jsonb: { archetypes: ["streetwear", "minimal"] },
    });
    expect(out.styleWords).toEqual(["streetwear", "minimal"]);
  });

  it("V4-native row, no V3 mirror at all → unified V3 view from V4", () => {
    // The cold-start race window: useV3CompatBackfill hasn't written yet
    // and there's no preferences.styleProfile slot. Pre-fix every V3-vocab
    // engine read returned undefined; the helper should surface V4 values
    // under V3 names so the engine has signal immediately.
    const out = readUnifiedStylePrefs({
      style_profile_v4_jsonb: {
        archetypes: ["scandinavian"],
        favoriteColors: ["white", "navy"],
        dislikedColors: ["neon"],
        fitOverall: "regular",
        paletteVibe: "neutrals",
        formalityCeiling: 70,
        formalityFloor: 30,
      },
    });
    expect(out.styleWords).toEqual(["scandinavian"]);
    expect(out.favoriteColors).toEqual(["white", "navy"]);
    expect(out.dislikedColors).toEqual(["neon"]);
    // `fitOverall: 'regular'` translates to V3 `'regular'` (identity).
    expect(out.fit).toBe("regular");
    // `paletteVibe: 'neutrals'` translates to V3 `'neutral'` (mapped).
    expect(out.paletteVibe).toBe("neutral");
    expect(out.workFormality).toBe(50); // (30 + 70) / 2
    expect(out.comfortVsStyle).toBe(50); // 100 - 50
    expect(out.formalityCeiling).toBe(70);
    expect(out.formalityFloor).toBe(30);
  });

  it("V4 fit / paletteVibe vocab translated to V3 for prompt consistency", () => {
    // Mirror of the mobile-side translators in
    // `mobile/src/lib/styleProfileV4.ts:520, 567`. Without translation the
    // V4-native cold-start user would see `Fit: fitted` / `Palette vibe:
    // pastels` in the AI prompt while a backfilled user sees `Fit: slim` /
    // `Palette vibe: muted` — inconsistent vocab to the LLM across the
    // same user's sessions.
    expect(
      readUnifiedStylePrefs({
        style_profile_v4_jsonb: { fitOverall: "fitted" },
      }).fit,
    ).toBe("slim");
    expect(
      readUnifiedStylePrefs({
        style_profile_v4_jsonb: { fitOverall: "relaxed" },
      }).fit,
    ).toBe("loose");
    expect(
      readUnifiedStylePrefs({
        style_profile_v4_jsonb: { fitOverall: "mixed" },
      }).fit,
    ).toBe("regular");
    expect(
      readUnifiedStylePrefs({
        style_profile_v4_jsonb: { fitOverall: "oversized" },
      }).fit,
    ).toBe("oversized");

    expect(
      readUnifiedStylePrefs({
        style_profile_v4_jsonb: { paletteVibe: "neutrals" },
      }).paletteVibe,
    ).toBe("neutral");
    expect(
      readUnifiedStylePrefs({
        style_profile_v4_jsonb: { paletteVibe: "pastels" },
      }).paletteVibe,
    ).toBe("muted");
    expect(
      readUnifiedStylePrefs({
        style_profile_v4_jsonb: { paletteVibe: "earth" },
      }).paletteVibe,
    ).toBe("muted");
    expect(
      readUnifiedStylePrefs({
        style_profile_v4_jsonb: { paletteVibe: "dark" },
      }).paletteVibe,
    ).toBe("monochrome");
    expect(
      readUnifiedStylePrefs({
        style_profile_v4_jsonb: { paletteVibe: "mixed" },
      }).paletteVibe,
    ).toBe("monochrome");
    expect(
      readUnifiedStylePrefs({
        style_profile_v4_jsonb: { paletteVibe: "bold" },
      }).paletteVibe,
    ).toBe("bold");
  });

  it("unknown V4 vocab passes through verbatim (forward-compat)", () => {
    // A future V4 enum extension shouldn't crash the engine. Translators
    // fall through to the input value when no case matches, so prompt
    // builders get the raw string.
    expect(
      readUnifiedStylePrefs({
        style_profile_v4_jsonb: { fitOverall: "slouchy" },
      }).fit,
    ).toBe("slouchy");
    expect(
      readUnifiedStylePrefs({
        style_profile_v4_jsonb: { paletteVibe: "vibrant" },
      }).paletteVibe,
    ).toBe("vibrant");
  });

  it("V3 mirror fit / paletteVibe with empty-string skip → V4 fallback", () => {
    // Mirror of the workFormality skip-semantics test, but for string-
    // shaped slots. Pre-fix `if (!nonEmptyString(out.fit))` would have
    // accepted '' as the V3 value; the reader correctly treats it as
    // missing and falls back to translated V4.
    const out = readUnifiedStylePrefs({
      styleProfile: { fit: "", paletteVibe: "" },
      style_profile_v4_jsonb: {
        fitOverall: "fitted",
        paletteVibe: "earth",
      },
    });
    expect(out.fit).toBe("slim");
    expect(out.paletteVibe).toBe("muted");
  });

  it("non-string entries in V4 archetypes are filtered", () => {
    const out = readUnifiedStylePrefs({
      style_profile_v4_jsonb: {
        archetypes: ["minimal", 42, null, "", "scandinavian"],
      },
    });
    expect(out.styleWords).toEqual(["minimal", "scandinavian"]);
  });

  it("empty V4 archetypes do not overwrite present V3 styleWords", () => {
    const out = readUnifiedStylePrefs({
      styleProfile: { styleWords: ["preppy"] },
      style_profile_v4_jsonb: { archetypes: [] },
    });
    expect(out.styleWords).toEqual(["preppy"]);
  });
});

describe("readUnifiedStylePrefs — defensive type guards", () => {
  it("non-object styleProfile is ignored (treats prefs as flat record)", () => {
    // A historically-malformed jsonb row could carry styleProfile as a
    // string / array / number. Don't crash; fall through to flat-record
    // semantics (same as the legacy `prefs?.styleProfile || prefs` ||) AND
    // strip the spurious `styleProfile` key from the unified output so it
    // doesn't leak the malformed value to engine readers.
    const outArr = readUnifiedStylePrefs({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      styleProfile: ["not", "an", "object"] as any,
      formalityCeiling: 80,
    });
    expect(outArr.formalityCeiling).toBe(80);
    expect(outArr.styleProfile).toBeUndefined();
    const outStr = readUnifiedStylePrefs({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      styleProfile: "garbage" as any,
      formalityCeiling: 80,
    });
    expect(outStr.formalityCeiling).toBe(80);
    expect(outStr.styleProfile).toBeUndefined();
    const outNull = readUnifiedStylePrefs({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      styleProfile: null as any,
      formalityCeiling: 80,
    });
    expect(outNull.formalityCeiling).toBe(80);
    expect(outNull.styleProfile).toBeUndefined();
  });

  it("V3 mirror with NaN formality bound is sanitized (delete-then-set)", () => {
    // A historically-malformed V3 mirror row could carry NaN as a
    // formality bound. The legacy `typeof === 'number'` guard in
    // resolveOccasionSubmode would silently accept NaN and propagate it
    // through midpoint arithmetic. The reader now sanitizes the V3 spread
    // and either pulls a finite V4 value in, or leaves the slot absent.
    const outV4Restored = readUnifiedStylePrefs({
      styleProfile: { formalityCeiling: NaN, formalityFloor: NaN },
      style_profile_v4_jsonb: { formalityCeiling: 80, formalityFloor: 30 },
    });
    expect(outV4Restored.formalityCeiling).toBe(80);
    expect(outV4Restored.formalityFloor).toBe(30);
    const outNoFallback = readUnifiedStylePrefs({
      styleProfile: { formalityCeiling: NaN, formalityFloor: NaN },
    });
    expect(outNoFallback.formalityCeiling).toBeUndefined();
    expect(outNoFallback.formalityFloor).toBeUndefined();
  });

  it("Infinity / -Infinity formality bounds rejected", () => {
    // `typeof Infinity === 'number'` is true; `Number.isFinite` rejects.
    const out = readUnifiedStylePrefs({
      styleProfile: { workFormality: "" },
      style_profile_v4_jsonb: {
        formalityCeiling: Infinity,
        formalityFloor: -Infinity,
      },
    });
    expect(out.workFormality).toBeUndefined();
  });

  it("literal-null style_profile_v4_jsonb behaves like absent key", () => {
    // Distinguish from key-absent: pinning the contract.
    const out = readUnifiedStylePrefs({
      styleProfile: { workFormality: "" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style_profile_v4_jsonb: null as any,
    });
    expect(out.workFormality).toBeUndefined();
  });

  it("partial V4 record (archetypes only, no formality bounds)", () => {
    // V4 row that has some fields and not others — each slot should fall
    // back independently.
    const out = readUnifiedStylePrefs({
      styleProfile: { workFormality: "" },
      style_profile_v4_jsonb: { archetypes: ["minimal"] },
    });
    expect(out.styleWords).toEqual(["minimal"]);
    expect(out.workFormality).toBeUndefined();
    expect(out.formalityCeiling).toBeUndefined();
    expect(out.formalityFloor).toBeUndefined();
  });

  it("style_profile_v4_jsonb is not echoed onto the unified output", () => {
    // The raw V4 record is a private input to the reader; engine
    // consumers shouldn't see it leaking through the V3-vocab view.
    const out = readUnifiedStylePrefs({
      style_profile_v4_jsonb: { archetypes: ["minimal"], formalityCeiling: 80 },
    });
    expect(out.style_profile_v4_jsonb).toBeUndefined();
    // But the translated values it produced are still on the output.
    expect(out.styleWords).toEqual(["minimal"]);
    expect(out.formalityCeiling).toBe(80);
  });
});

describe("readUnifiedStylePrefs — non-object inputs + memoization", () => {
  it("non-object preferences (array / string / number) → empty record", () => {
    // A typescript any-cast or malformed jsonb shape could pass an
    // unexpected type. The reader rejects defensively at the entry rather
    // than silently spreading numeric character keys (string) or array
    // indices.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(readUnifiedStylePrefs([] as any)).toEqual({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(readUnifiedStylePrefs(["styleProfile"] as any)).toEqual({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(readUnifiedStylePrefs("garbage" as any)).toEqual({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(readUnifiedStylePrefs(42 as any)).toEqual({});
  });

  it("repeat calls with the same reference return the cached object", () => {
    // Memoization: readUnifiedStylePrefs is called per-garment in
    // styleAlignmentScore + per-combo in scoreCombo, hundreds of times
    // per request. Caching by reference saves the spread + fallback work.
    // Behavior contract: cache hit returns the EXACT same object (===),
    // so consumers that close over a slot don't observe a stale snapshot
    // when called again.
    const prefs = {
      styleProfile: { styleWords: ["minimal"] },
      style_profile_v4_jsonb: { archetypes: ["minimal"] },
    };
    const first = readUnifiedStylePrefs(prefs);
    const second = readUnifiedStylePrefs(prefs);
    expect(first).toBe(second);
  });

  it("different input references produce independent records", () => {
    // The cache must not collapse two distinct preference objects with
    // the same shape. Two different rows in the DB end up as two
    // different references in the engine.
    const a = readUnifiedStylePrefs({ styleProfile: { fit: "slim" } });
    const b = readUnifiedStylePrefs({ styleProfile: { fit: "loose" } });
    expect(a).not.toBe(b);
    expect(a.fit).toBe("slim");
    expect(b.fit).toBe("loose");
  });
});

describe("isNonEmptyObject — branch-condition helper", () => {
  it("returns true only for plain objects with at least one key", () => {
    expect(isNonEmptyObject({ a: 1 })).toBe(true);
    expect(isNonEmptyObject({})).toBe(false);
    expect(isNonEmptyObject(null)).toBe(false);
    expect(isNonEmptyObject(undefined)).toBe(false);
    expect(isNonEmptyObject([])).toBe(false);
    expect(isNonEmptyObject(["a"])).toBe(false);
    expect(isNonEmptyObject("string")).toBe(false);
    expect(isNonEmptyObject(42)).toBe(false);
    expect(isNonEmptyObject(0)).toBe(false);
  });

  it("non-object style_profile_v4_jsonb is ignored", () => {
    const out = readUnifiedStylePrefs({
      styleProfile: { workFormality: "" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style_profile_v4_jsonb: "garbage" as any,
    });
    // V4 was malformed so no fallback fires — workFormality stays undefined.
    expect(out.workFormality).toBeUndefined();
  });

  it("string-typed V4 formality bound is rejected (legacy DB write)", () => {
    // Same defense the formality submode test pins (line 192-204):
    // typeof gate must reject a string-typed bound so the midpoint
    // derivation never silently treats `'95'` as 95.
    const out = readUnifiedStylePrefs({
      styleProfile: { workFormality: "" },
      style_profile_v4_jsonb: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formalityCeiling: "95" as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formalityFloor: "70" as any,
      },
    });
    expect(out.workFormality).toBeUndefined();
  });

  it("NaN V4 formality bound is rejected (Number.isFinite gate)", () => {
    // `typeof NaN === 'number'` is true, so the bare typeof guard would
    // accept it. `Number.isFinite` correctly rejects.
    const out = readUnifiedStylePrefs({
      styleProfile: { workFormality: "" },
      style_profile_v4_jsonb: { formalityCeiling: NaN, formalityFloor: NaN },
    });
    expect(out.workFormality).toBeUndefined();
  });

  it("out-of-range V4 formality bound is rejected", () => {
    const out = readUnifiedStylePrefs({
      styleProfile: { workFormality: "" },
      style_profile_v4_jsonb: { formalityCeiling: 150, formalityFloor: -10 },
    });
    expect(out.workFormality).toBeUndefined();
  });

  it("unrelated top-level preferences keys are preserved (flat-form pass-through)", () => {
    // `preferences` carries `onboarding`, `language`, `coach_tour_*`, etc.
    // The unified reader returns them verbatim when the prefs object is
    // treated as the flat V3 record (no styleProfile key). Engine readers
    // ignore them — but we don't want the helper to silently strip them
    // from the returned record either.
    const out = readUnifiedStylePrefs({
      language: "sv",
      coach_tour_completed_at: "2026-04-01T00:00:00Z",
    });
    expect(out.language).toBe("sv");
    expect(out.coach_tour_completed_at).toBe("2026-04-01T00:00:00Z");
  });
});
