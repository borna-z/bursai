// Theme 7 (post-launch audit) — unified V3-vocab view of profile.preferences.
//
// Why this exists
// ---------------
// The AI engine reads style preferences in V3 vocab (`styleWords`,
// `workFormality`, `fit`, `paletteVibe`, …). M25 dual-write puts the V3
// mirror at `preferences.styleProfile` alongside the canonical V4 record at
// `preferences.style_profile_v4_jsonb`. Two concrete slot-coverage gaps
// surface from that arrangement and motivated this helper:
//
//   1.  `migrateV4ToV3Compat` (mobile/src/lib/styleProfileV4.ts:677) writes
//       `workFormality: ''` into the V3 mirror for every backfilled pre-M25
//       user. V3 vocab can't represent V4's continuous floor/ceiling pair,
//       so the backfill encodes the slot as the empty string and relies on
//       downstream `if (sp.workFormality)` guards to skip cleanly. Engine
//       readers in `style-summary-builder.ts` and `outfit-scoring.ts`
//       type-check the slot and silently default to the neutral 50, which
//       collapses to "casual" via `formalityWordFor`. Result: every pre-M25
//       backfilled user is reported as "casual" regardless of their actual
//       V4 floor/ceiling — even though the right number is sitting in the
//       same row at `preferences.style_profile_v4_jsonb.formality{Floor,
//       Ceiling}`.
//
//   2.  A V4-native user whose V3 backfill hasn't landed yet (cold-start
//       race window: first session post-M25 upgrade, between the auth
//       resolve and the `useV3CompatBackfill` write) has no V3 mirror at
//       all. The legacy `getStylePrefs` falls back to the raw `preferences`
//       object, where V3-vocab field reads (`sp.styleWords`, `sp.fit`)
//       return undefined because V4 names them differently (`archetypes`,
//       `fitOverall`). Engine emits zero style-axis signal until the
//       backfill writes — every outfit / chat / score request in that
//       window flies blind.
//
// What this helper does
// ---------------------
// Build a unified V3-vocab record from `preferences`:
//
//   • Start from the V3 mirror at `preferences.styleProfile` if present,
//     otherwise from `preferences` itself (legacy flat-form contract from
//     `outfit-scoring.ts:603` `getStylePrefs` — preserved so unit tests
//     and any caller passing styleProfile directly keep working).
//   • For every V3-vocab slot the mirror leaves empty / missing, fall back
//     to the V4 canonical field at `preferences.style_profile_v4_jsonb`
//     with name translation (`archetypes` → `styleWords`, `fitOverall` →
//     `fit`, `formalityFloor` + `formalityCeiling` midpoint → `workFormality`
//     / `comfortVsStyle`).
//   • Pass `formalityCeiling` / `formalityFloor` through to the output so
//     `resolveOccasionSubmode` (which reads them by V4 name) finds them on
//     the unified record without re-reaching into preferences.
//
// Non-goals
// ---------
//   • Do not translate V4 paletteVibe vocab to V3 vocab. V4 vibes
//     (`muted`, `bright`, `tonal`, …) and V3 vibes overlap in the strings
//     downstream substring-matchers care about (`'neutral'`, `'tonal'`),
//     so passing V4 through verbatim works for the engine reads.
//   • Do not change `migrateV4ToV3Compat` on the mobile side. The empty-
//     string skip-semantics there are intentional for V3-only consumers
//     and matched byte-for-byte against the web. Fixing on the server
//     side via this helper is non-invasive and self-contained.

export function readUnifiedStylePrefs(
  preferences: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const prefs = (preferences ?? {}) as Record<string, unknown>;

  // V3 mirror at preferences.styleProfile when present; otherwise treat
  // the prefs object itself as the V3 record (legacy flat-form contract
  // from `outfit-scoring.ts:getStylePrefs` — used by unit tests and any
  // caller passing the V3 mirror directly).
  const v3Mirror = isObject(prefs.styleProfile)
    ? (prefs.styleProfile as Record<string, unknown>)
    : null;
  const v3 = v3Mirror ?? prefs;

  // V4 canonical only ever lives at preferences.style_profile_v4_jsonb.
  const v4 = isObject(prefs.style_profile_v4_jsonb)
    ? (prefs.style_profile_v4_jsonb as Record<string, unknown>)
    : null;

  const out: Record<string, unknown> = { ...v3 };

  // If we fell back to flat-form (v3 = prefs) AND the prefs row carries a
  // non-object `styleProfile` key (a malformed historical jsonb write —
  // e.g. styleProfile: null / "garbage" / array), don't leak that key into
  // the unified record. Engine readers ignore an unknown styleProfile key
  // either way, but a clean output is easier to reason about.
  if (v3Mirror === null && "styleProfile" in out) {
    delete out.styleProfile;
  }
  // Same scrub for `style_profile_v4_jsonb` — pass-through of the raw V4
  // record on the unified output would be confusing and isn't read by
  // any engine consumer.
  if ("style_profile_v4_jsonb" in out) {
    delete out.style_profile_v4_jsonb;
  }

  // styleWords (V3 vocab) ← archetypes (V4 canonical).
  if (!nonEmptyStringArray(out.styleWords)) {
    const v4Archetypes = stringArray(v4?.archetypes);
    if (v4Archetypes.length > 0) out.styleWords = v4Archetypes;
  }

  // favoriteColors / dislikedColors — same name in both schemas.
  if (!nonEmptyStringArray(out.favoriteColors)) {
    const v4Fav = stringArray(v4?.favoriteColors);
    if (v4Fav.length > 0) out.favoriteColors = v4Fav;
  }
  if (!nonEmptyStringArray(out.dislikedColors)) {
    const v4Dis = stringArray(v4?.dislikedColors);
    if (v4Dis.length > 0) out.dislikedColors = v4Dis;
  }

  // fit (V3 vocab) ← fitOverall (V4 canonical).
  if (!nonEmptyString(out.fit)) {
    const v4Fit = v4?.fitOverall;
    if (typeof v4Fit === "string" && v4Fit.length > 0) out.fit = v4Fit;
  }

  // paletteVibe — V3 mirror has translated value, V4 has raw V4 vocab.
  // Engine readers do `String(sp.paletteVibe || '').toLowerCase().includes(
  // 'neutral'|'tonal')`. V4 vibes that overlap on those substrings ('neutral',
  // 'tonal') hit the same scoring branches as V3; V4 vibes that don't (e.g.
  // 'bright', 'muted') simply skip those branches — which is the right
  // outcome since the user explicitly prefers a non-neutral palette. Pass
  // V4 through verbatim without translation.
  if (!nonEmptyString(out.paletteVibe)) {
    const v4Palette = v4?.paletteVibe;
    if (typeof v4Palette === "string" && v4Palette.length > 0) {
      out.paletteVibe = v4Palette;
    }
  }

  // workFormality (V3, 0-100, "how formally does this user dress")
  //   ← midpoint of V4 formalityFloor / formalityCeiling.
  // The V3 backfill writes '' here for pre-M25 users (skip-semantics);
  // restore the number from V4 so downstream readers (formality_center
  // fallback, formalityWordFor) get the right signal. If neither V3 nor
  // V4 yields a usable number, drop the slot entirely so the unified
  // record carries only valid typed values for number-shaped slots.
  if (!isFiniteNumberInRange(out.workFormality, 0, 100)) {
    delete out.workFormality;
    const ceil = isFiniteNumberInRange(v4?.formalityCeiling, 0, 100)
      ? (v4!.formalityCeiling as number)
      : null;
    const floor = isFiniteNumberInRange(v4?.formalityFloor, 0, 100)
      ? (v4!.formalityFloor as number)
      : null;
    if (ceil !== null && floor !== null) {
      out.workFormality = Math.round((ceil + floor) / 2);
    }
  }

  // comfortVsStyle (V3, 0-100, inverse of formality midpoint).
  // The V3 backfill DOES populate this from V4 (line 685 of styleProfileV4.ts),
  // so this fallback only fires for V4-native rows with no V3 mirror.
  if (!isFiniteNumberInRange(out.comfortVsStyle, 0, 100)) {
    delete out.comfortVsStyle;
    const ceil = isFiniteNumberInRange(v4?.formalityCeiling, 0, 100)
      ? (v4!.formalityCeiling as number)
      : null;
    const floor = isFiniteNumberInRange(v4?.formalityFloor, 0, 100)
      ? (v4!.formalityFloor as number)
      : null;
    if (ceil !== null && floor !== null) {
      out.comfortVsStyle = Math.max(
        0,
        Math.min(100, Math.round(100 - (ceil + floor) / 2)),
      );
    }
  }

  // Pass V4 formalityCeiling / formalityFloor through so downstream code
  // that reads them directly (`resolveOccasionSubmode` in outfit-scoring.ts)
  // finds them on the unified record. The V3 mirror already carries these
  // because they ride along in `v4OnlyFields` (mobile/src/lib/styleProfileV4.ts
  // lines 656–670 destructure-rest), but a V4-native user with no mirror
  // would otherwise lose them.
  //
  // Sanitization: a malformed historical jsonb row could carry NaN /
  // Infinity / out-of-range / string-typed bounds on the V3 mirror.
  // The legacy `typeof === 'number'` guard in `resolveOccasionSubmode`
  // accepts NaN, which then propagates silently through the midpoint
  // arithmetic. Delete-then-set ensures the output carries only finite
  // in-range numbers (or no key at all).
  if (!isFiniteNumberInRange(out.formalityCeiling, 0, 100)) {
    delete out.formalityCeiling;
    if (isFiniteNumberInRange(v4?.formalityCeiling, 0, 100)) {
      out.formalityCeiling = v4!.formalityCeiling;
    }
  }
  if (!isFiniteNumberInRange(out.formalityFloor, 0, 100)) {
    delete out.formalityFloor;
    if (isFiniteNumberInRange(v4?.formalityFloor, 0, 100)) {
      out.formalityFloor = v4!.formalityFloor;
    }
  }

  return out;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

// Exported branch-condition helper for prompt builders that need to decide
// between the unified V3-vocab path and the legacy v2 fallback. Returns
// true only when the input is a plain object with at least one own key —
// a stub `{}` (e.g. partial migration leftover) returns false so the v2
// fallback still fires for very-old users that have only top-level v2
// keys (`fitPreference`, `styleVibe`).
export function isNonEmptyObject(v: unknown): v is Record<string, unknown> {
  return isObject(v) && Object.keys(v as Record<string, unknown>).length > 0;
}

function stringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0);
}

function nonEmptyStringArray(v: unknown): boolean {
  return Array.isArray(v) && v.some((x) => typeof x === "string" && x.length > 0);
}

function nonEmptyString(v: unknown): boolean {
  return typeof v === "string" && v.length > 0;
}

// `Number.isFinite` rejects NaN / Infinity (unlike `typeof === 'number'`).
// Defensive against legacy DB writes where a malformed jsonb row carries
// a non-finite value — the type guard would accept it and the arithmetic
// downstream would propagate NaN silently.
function isFiniteNumberInRange(v: unknown, lo: number, hi: number): boolean {
  return typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
}
