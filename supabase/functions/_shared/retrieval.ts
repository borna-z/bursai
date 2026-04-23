/**
 * BURS Retrieval — Shared pre-filter + coverage utilities for AI retrieval quality.
 *
 * Consumed by: mood_outfit, wardrobe_gap_analysis (Wave 4-B).
 * Extends to future callers that need to pre-filter / structurally summarize a
 * wardrobe before an AI call (replaces "send all 250 garments" with "send the
 * 40 most relevant").
 *
 * Exports:
 * - MOOD_MAP             — natural-language mood hints (consumed by prompt)
 * - MOOD_SCORING         — structured signals per mood (consumed by pre-filter)
 * - rankGarmentsForMood  — top-N pre-filter for mood_outfit
 * - computeWardrobeCoverage — structured wardrobe summary (category, color, formality, season)
 * - stratifiedSample     — representative sample across categories, wear, recency
 * - formalityLabel       — numeric formality (1-5) → English label
 * - colorFamily          — color name → family bucket
 * - intentToCacheKey     — stable hash of a wardrobe_gap_analysis intent payload
 */

// ── Retrieval garment shape ────────────────────────────────────────────
// Structural type (not a re-export of outfit-scoring.ts GarmentRow) so callers
// can pass any garment row as long as it has the fields we actually read.
// Using `unknown` on optional fields keeps runtime defensive without forcing
// callers to widen their own types.
export interface RetrievalGarment {
  id: string;
  title?: string | null;
  category?: string | null;
  subcategory?: string | null;
  color_primary?: string | null;
  color_secondary?: string | null;
  material?: string | null;
  pattern?: string | null;
  formality?: number | null;
  season_tags?: string[] | null;
  fit?: string | null;
  wear_count?: number | null;
  last_worn_at?: string | null;
  created_at?: string | null;
  enrichment_status?: string | null;
  ai_raw?: {
    style_archetype?: string | null;
    occasion_tags?: string[] | null;
    versatility_score?: number | null;
    layering_role?: string | null;
  } | null;
}

export interface RetrievalWeather {
  temperature?: number | null;
  precipitation?: string | null;
}

// ── Mood prompt hints (natural language) ───────────────────────────────
// The AI sees these strings as direction. Pre-P20 these lived inline in
// mood_outfit/index.ts; extracted so wardrobe_gap_analysis can reuse the
// vibe-matching signal for intent-driven shopping recommendations.
export const MOOD_MAP: Record<
  string,
  { formality: string; colors: string; materials: string; vibe: string }
> = {
  cozy: { formality: "casual, low", colors: "warm earth tones, cream, beige, soft browns", materials: "knit, fleece, cashmere, cotton", vibe: "soft, comfortable, enveloping" },
  confident: { formality: "smart-casual to formal", colors: "strong, saturated - black, red, navy, white", materials: "structured fabrics, leather, tailored wool", vibe: "powerful, sharp, put-together" },
  creative: { formality: "relaxed, expressive", colors: "unexpected combos, bold accents, patterns", materials: "mixed textures, statement pieces", vibe: "artistic, unique, eye-catching" },
  invisible: { formality: "neutral, blending", colors: "muted neutrals, grey, navy, black, white", materials: "standard, unremarkable", vibe: "understated, minimal, no-attention" },
  romantic: { formality: "soft elegant", colors: "pastels, blush, soft white, dusty rose", materials: "silk, lace, flowing fabrics", vibe: "gentle, feminine, dreamy" },
  energetic: { formality: "casual, sporty-chic", colors: "bright, vibrant - yellow, orange, electric blue", materials: "lightweight, breathable", vibe: "active, upbeat, fun" },
  grounded: { formality: "casual, relaxed", colors: "olive, khaki, tan, warm brown, sage", materials: "cotton, linen, canvas, suede", vibe: "earthy, authentic, natural" },
  sharp: { formality: "formal, tailored", colors: "black, charcoal, cream, gold accents", materials: "tailored wool, crisp cotton, structured fabrics", vibe: "precise, polished, intentional" },
  soft: { formality: "casual-elegant, low contrast", colors: "powder blue, lavender, light grey, off-white", materials: "cashmere, soft knit, silk blend", vibe: "muted, gentle, calming" },
  bold: { formality: "statement, high-impact", colors: "red, deep black, white, high contrast", materials: "leather, structured fabrics, bold textures", vibe: "maximum, unapologetic, attention-commanding" },
  editorial: { formality: "avant-garde, fashion-forward", colors: "navy, gold, deep teal, monochrome", materials: "architectural fabrics, unusual cuts, layering", vibe: "magazine-ready, conceptual, curated" },
  playful: { formality: "casual, fun", colors: "pink, orange, purple, unexpected color combos", materials: "mixed prints, playful textures", vibe: "fun, spontaneous, joyful" },
};

// ── Structured scoring signals (internal to pre-filter) ────────────────
export type FormalityBand = "low" | "mid" | "high";
export type ColorFamily = "neutral" | "warm" | "cool" | "earth" | "pastel" | "bold" | "monochrome";

interface MoodScoring {
  formalityBand: FormalityBand;
  colorFamilies: ColorFamily[];
  occasionKeywords: string[];
  styleArchetypes: string[];
}

const MOOD_SCORING: Record<string, MoodScoring> = {
  cozy:      { formalityBand: "low",  colorFamilies: ["warm", "earth", "neutral"],     occasionKeywords: ["weekend", "loungewear", "casual", "home"], styleArchetypes: ["casual", "soft", "minimal"] },
  confident: { formalityBand: "high", colorFamilies: ["bold", "monochrome", "neutral"], occasionKeywords: ["work", "event", "formal", "meeting"],     styleArchetypes: ["tailored", "classic", "statement"] },
  creative:  { formalityBand: "mid",  colorFamilies: ["bold", "warm", "earth"],        occasionKeywords: ["creative", "date", "going_out", "art"],    styleArchetypes: ["artistic", "eclectic", "avant-garde"] },
  invisible: { formalityBand: "mid",  colorFamilies: ["neutral", "monochrome"],        occasionKeywords: ["casual", "work", "errand"],                styleArchetypes: ["minimal", "classic"] },
  romantic:  { formalityBand: "mid",  colorFamilies: ["pastel", "warm"],               occasionKeywords: ["date", "evening", "dinner"],               styleArchetypes: ["feminine", "soft", "classic"] },
  energetic: { formalityBand: "low",  colorFamilies: ["bold", "warm"],                 occasionKeywords: ["active", "weekend", "sporty"],             styleArchetypes: ["sporty", "casual"] },
  grounded:  { formalityBand: "low",  colorFamilies: ["earth", "neutral"],             occasionKeywords: ["outdoor", "weekend", "travel"],            styleArchetypes: ["casual", "classic"] },
  sharp:     { formalityBand: "high", colorFamilies: ["monochrome", "neutral"],        occasionKeywords: ["work", "formal", "meeting"],               styleArchetypes: ["tailored", "classic"] },
  soft:      { formalityBand: "mid",  colorFamilies: ["pastel", "neutral"],            occasionKeywords: ["casual", "weekend", "brunch"],             styleArchetypes: ["soft", "minimal"] },
  bold:      { formalityBand: "high", colorFamilies: ["bold", "monochrome"],           occasionKeywords: ["event", "going_out", "party"],             styleArchetypes: ["statement", "tailored"] },
  editorial: { formalityBand: "high", colorFamilies: ["monochrome", "bold"],           occasionKeywords: ["event", "creative", "art"],                styleArchetypes: ["artistic", "avant-garde", "statement"] },
  playful:   { formalityBand: "low",  colorFamilies: ["bold", "warm", "pastel"],       occasionKeywords: ["casual", "weekend", "fun", "date"],        styleArchetypes: ["casual", "eclectic"] },
};

const COLOR_FAMILY_KEYWORDS: Record<ColorFamily, string[]> = {
  neutral:    ["white", "cream", "ecru", "beige", "tan", "taupe", "ivory", "off-white", "sand", "stone"],
  warm:       ["red", "orange", "yellow", "amber", "rust", "terracotta", "gold", "coral"],
  cool:       ["blue", "navy", "teal", "turquoise", "indigo", "slate"],
  earth:      ["brown", "olive", "khaki", "sage", "moss", "chocolate", "camel", "mushroom"],
  pastel:     ["lavender", "mint", "blush", "powder", "pale", "dusty", "rose", "peach", "lilac"],
  bold:       ["emerald", "magenta", "purple", "electric", "scarlet", "fuchsia", "crimson"],
  monochrome: ["black", "white", "grey", "gray", "charcoal", "silver"],
};

export function colorFamily(color: string | null | undefined): ColorFamily[] {
  const lc = (color || "").toLowerCase();
  if (!lc) return [];
  const families: ColorFamily[] = [];
  for (const family of Object.keys(COLOR_FAMILY_KEYWORDS) as ColorFamily[]) {
    if (COLOR_FAMILY_KEYWORDS[family].some((k) => lc.includes(k))) {
      families.push(family);
    }
  }
  return families;
}

// Formality band mapping: 1 → low, 2-3 → mid, 4-5 → high.
// Null/undefined treated as mid (the canonical "default" formality = 3).
export function formalityToBand(n: number | null | undefined): FormalityBand {
  if (typeof n !== "number" || !Number.isFinite(n)) return "mid";
  if (n <= 2) return "low";
  if (n >= 4) return "high";
  return "mid";
}

// English labels for prompt copy. Replaces the opaque "f3" code.
export function formalityLabel(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "smart-casual";
  if (n <= 1) return "casual";
  if (n <= 2) return "relaxed";
  if (n <= 3) return "smart-casual";
  if (n <= 4) return "business";
  return "formal";
}

// ── Weather compatibility (single-garment, structural) ─────────────────
// Lightweight per-garment scorer. `weatherPracticalityScore` in
// outfit-scoring.ts operates on a full ComboItem[] outfit — we need per-
// garment signal here.
function weatherCompatForGarment(
  garment: RetrievalGarment,
  weather: RetrievalWeather | undefined,
): number {
  if (!weather) return 1;
  const temp = typeof weather.temperature === "number" ? weather.temperature : null;
  const precip = (weather.precipitation || "").toLowerCase();
  const text = `${garment.category || ""} ${garment.subcategory || ""} ${garment.material || ""}`.toLowerCase();
  const isWet = ["rain", "snow", "regn", "sno"].some((t) => precip.includes(t));
  const isCold = temp !== null && temp < 10;
  const isHot = temp !== null && temp > 24;

  // Negative signals
  if (isWet && text.includes("sandal")) return 0.1;
  if (isCold && (text.includes("shorts") || text.includes("sandal") || text.includes("tank"))) return 0.2;
  if (isHot && (text.includes("parka") || text.includes("wool") || text.includes("fleece"))) return 0.2;

  // Positive signals
  if (isCold && ["knit", "wool", "fleece", "cashmere", "cashm", "coat", "jacket"].some((t) => text.includes(t))) return 1.2;
  if (isHot && ["linen", "cotton", "short", "tee", "tank"].some((t) => text.includes(t))) return 1.15;
  if (isWet && ["rain", "trench", "coat", "boot"].some((t) => text.includes(t))) return 1.1;

  return 1;
}

// ── rankGarmentsForMood — top-N pre-filter ─────────────────────────────
export interface RankForMoodOptions {
  limit: number;
  weather?: RetrievalWeather;
}

export function rankGarmentsForMood<T extends RetrievalGarment>(
  mood: string,
  garments: T[],
  opts: RankForMoodOptions,
): T[] {
  const signal = MOOD_SCORING[mood] || MOOD_SCORING.confident;

  const scored = garments.map((g) => {
    const band = formalityToBand(g.formality);
    const formalityScore = band === signal.formalityBand ? 1 : band === "mid" || signal.formalityBand === "mid" ? 0.6 : 0.1;

    const families = colorFamily(g.color_primary);
    const colorScore = families.some((f) => signal.colorFamilies.includes(f)) ? 1 : 0.3;

    const tags = Array.isArray(g.ai_raw?.occasion_tags) ? g.ai_raw!.occasion_tags!.map((t) => (t || "").toLowerCase()) : [];
    const occasionScore = signal.occasionKeywords.some((k) => tags.some((t) => t.includes(k))) ? 1 : 0.5;

    const archetype = (g.ai_raw?.style_archetype || "").toLowerCase();
    const archetypeScore = archetype && signal.styleArchetypes.some((a) => archetype.includes(a)) ? 1 : 0.5;

    const weatherScore = weatherCompatForGarment(g, opts.weather);

    const wearCount = typeof g.wear_count === "number" ? g.wear_count : 0;
    // Decay: 0 wears → 1.0, 5 wears → ~0.67, 20 wears → ~0.33.
    const wearDecay = 1 / (1 + wearCount * 0.1);

    const total =
      formalityScore * 2.5 +
      colorScore * 1.5 +
      occasionScore * 1.0 +
      archetypeScore * 0.75 +
      weatherScore * 1.0 +
      wearDecay * 1.25;

    return { garment: g, score: total };
  });

  scored.sort((a, b) => b.score - a.score);
  const rawLimit = Number.isFinite(opts.limit) ? opts.limit : 0;
  return scored.slice(0, Math.max(0, rawLimit)).map((s) => s.garment);
}

// ── Wardrobe coverage (structured summary for gap analysis) ────────────
export interface WardrobeCoverage {
  total: number;
  by_category: Record<string, number>;
  by_color_family: Record<ColorFamily, number>;
  by_season: Record<string, number>;
  by_formality: { low: number; mid: number; high: number };
  gaps_derived: string[];
}

const CORE_CATEGORIES = ["top", "bottom", "shoes", "outerwear", "dress", "accessory"] as const;

// Codex P2 on PR #664: user data carries both singular and plural / legacy
// variants for category labels (e.g. "tops" vs "top", "shoe" vs "shoes").
// `gaps_derived` only checks canonical keys, so un-normalized raw keys
// leaked false "no top/bottom/shoes" gaps into the AI prompt + fallback
// ranking. Canonicalize at coverage-compute time so downstream consumers
// see a single canonical key per core category.
const CATEGORY_ALIAS_MAP: Record<string, string> = {
  tops: "top",
  bottoms: "bottom",
  shoe: "shoes",
  accessories: "accessory",
  outerwears: "outerwear",
  dresses: "dress",
};

export function canonicalCategory(raw: string | null | undefined): string {
  const lc = (raw || "").toLowerCase();
  if (!lc) return "uncategorized";
  return CATEGORY_ALIAS_MAP[lc] || lc;
}

export function computeWardrobeCoverage<T extends RetrievalGarment>(garments: T[]): WardrobeCoverage {
  const by_category: Record<string, number> = {};
  const by_color_family: Record<ColorFamily, number> = {
    neutral: 0, warm: 0, cool: 0, earth: 0, pastel: 0, bold: 0, monochrome: 0,
  };
  const by_season: Record<string, number> = { spring: 0, summer: 0, fall: 0, winter: 0, all_season: 0 };
  const by_formality = { low: 0, mid: 0, high: 0 };

  for (const g of garments) {
    const cat = canonicalCategory(g.category);
    by_category[cat] = (by_category[cat] || 0) + 1;

    for (const fam of colorFamily(g.color_primary)) {
      by_color_family[fam] += 1;
    }

    const seasons = Array.isArray(g.season_tags) ? g.season_tags : [];
    if (seasons.length === 0) {
      by_season.all_season += 1;
    } else {
      for (const s of seasons) {
        // Normalize common aliases so autumn/fall both land in `fall`.
        const raw = (s || "").toLowerCase();
        const key = raw === "autumn" ? "fall" : raw;
        if (key in by_season) by_season[key] += 1;
      }
    }

    by_formality[formalityToBand(g.formality)] += 1;
  }

  // gaps_derived — rule-based callouts the AI can confirm or refine.
  const gaps_derived: string[] = [];
  const total = garments.length;

  for (const core of CORE_CATEGORIES) {
    if (!by_category[core] && core !== "dress" && core !== "accessory") {
      gaps_derived.push(`no ${core} in wardrobe`);
    }
  }

  if ((by_category.shoes || 0) < 2) gaps_derived.push("fewer than 2 shoes");
  if ((by_category.outerwear || 0) < 1) gaps_derived.push("no outerwear for cold or wet weather");

  if (total > 0) {
    const neutralRatio = by_color_family.neutral / total;
    if (neutralRatio > 0.6) gaps_derived.push("wardrobe is >60% neutral — could use a color anchor");
    const boldRatio = by_color_family.bold / total;
    if (boldRatio === 0 && total >= 10) gaps_derived.push("no bold or statement color pieces");
  }

  if (by_formality.high === 0 && total >= 10) gaps_derived.push("no formal/tailored pieces");
  if (by_formality.low === 0 && total >= 10) gaps_derived.push("no casual pieces");

  if (by_season.winter === 0 && total >= 10) gaps_derived.push("no winter-tagged pieces");
  if (by_season.summer === 0 && total >= 10) gaps_derived.push("no summer-tagged pieces");

  return {
    total,
    by_category,
    by_color_family,
    by_season,
    by_formality,
    gaps_derived,
  };
}

// ── stratifiedSample — representative picks across category × wear × recency ─
// Picks roughly-proportional counts from each category, preferring low
// wear_count and recent garments within each stratum so the AI sees the
// wardrobe's shape, not the 25 newest additions.
export function stratifiedSample<T extends RetrievalGarment>(garments: T[], n: number): T[] {
  if (garments.length <= n) return garments.slice();
  if (n <= 0) return [];

  // Bucket by category
  const buckets: Record<string, T[]> = {};
  for (const g of garments) {
    const cat = (g.category || "uncategorized").toLowerCase();
    if (!buckets[cat]) buckets[cat] = [];
    buckets[cat].push(g);
  }

  // Sort each bucket: prefer low wear_count, then recent created_at.
  for (const cat of Object.keys(buckets)) {
    buckets[cat].sort((a, b) => {
      const wa = typeof a.wear_count === "number" ? a.wear_count : 0;
      const wb = typeof b.wear_count === "number" ? b.wear_count : 0;
      if (wa !== wb) return wa - wb;
      const ra = a.created_at || "";
      const rb = b.created_at || "";
      return ra > rb ? -1 : ra < rb ? 1 : 0;
    });
  }

  // Allocate proportional counts
  const entries = Object.entries(buckets).sort((a, b) => b[1].length - a[1].length);
  const result: T[] = [];
  const total = garments.length;

  for (const [, rows] of entries) {
    const quota = Math.max(1, Math.round((rows.length / total) * n));
    result.push(...rows.slice(0, quota));
    if (result.length >= n) break;
  }

  // Fill remaining slots by genuine round-robin across category buckets,
  // so minority categories aren't starved by the big ones. Codex P2 on
  // PR #664 caught the prior version — an inner nested loop that drained
  // bucket 1 entirely before touching bucket 2, with an unconditional
  // outer `break` that made the `offset` loop cosmetic. Rewritten to
  // step one row per bucket per offset pass. `maxLen` bounds the loop.
  if (result.length < n) {
    const taken = new Set(result.map((g) => g.id));
    const bucketArrays = entries.map(([, rows]) => rows);
    const maxLen = bucketArrays.reduce((m, rows) => Math.max(m, rows.length), 0);
    outer: for (let offset = 0; offset < maxLen; offset += 1) {
      for (const rows of bucketArrays) {
        if (offset >= rows.length) continue;
        const g = rows[offset];
        if (taken.has(g.id)) continue;
        result.push(g);
        taken.add(g.id);
        if (result.length >= n) break outer;
      }
    }
  }

  return result.slice(0, n);
}

// ── Intent → cache key (stable hash) ───────────────────────────────────
// Called by wardrobe_gap_analysis to partition cache between gap-only
// mode and intent-driven shopping mode. Using sortedKeys + simple djb2
// hash — cheap, deterministic, and Deno-safe (no crypto import needed).
export interface WardrobeGapIntent {
  occasion?: string | null;
  formality?: "low" | "mid" | "high" | null;
  season?: "spring" | "summer" | "fall" | "winter" | null;
  budget?: number | null;
  upcoming_events?: Array<{ title?: string; date?: string; description?: string }> | null;
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableSerialize((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

function djb2(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  // Unsigned hex, 8 chars.
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function intentToCacheKey(intent?: WardrobeGapIntent | null): string {
  if (!intent) return "none";
  const serialized = stableSerialize(intent);
  return djb2(serialized);
}

// ── Event description keyword scan ─────────────────────────────────────
// Cheap formality/season hints scraped from upcoming_events[*].description
// BEFORE the AI call. Saves a round-trip when the text obviously implies
// e.g. "black tie" or "summer wedding".
// Codex P2 on PR #664: match on word boundaries, not plain substrings.
// "informal" contains "formal"; "may" appears in most modal-verb sentences;
// etc. Plain `.includes()` over-matches and merges bogus hints into the
// intent before prompting and caching. `\b...\b` fixes the substring
// collision class. Longest keys first so multi-word phrases like
// "black tie" win over their component words when both are present.
const FORMALITY_HINTS_RAW: Array<[string, "low" | "mid" | "high"]> = [
  ["black tie", "high"],
  ["smart casual", "mid"],
  ["smart-casual", "mid"],
  ["business casual", "mid"],
  ["formal", "high"],
  ["wedding", "high"],
  ["gala", "high"],
  ["meeting", "high"],
  ["dinner", "mid"],
  ["casual", "low"],
  ["brunch", "low"],
  ["weekend", "low"],
  ["hike", "low"],
  ["park", "low"],
];
const SEASON_HINTS_RAW: Array<[string, "spring" | "summer" | "fall" | "winter"]> = [
  ["summer", "summer"], ["beach", "summer"], ["july", "summer"], ["august", "summer"],
  ["winter", "winter"], ["ski", "winter"], ["christmas", "winter"], ["january", "winter"],
  ["spring", "spring"], ["april", "spring"],
  ["autumn", "fall"], ["october", "fall"], ["november", "fall"],
];
// Intentionally dropped from hint-matching:
//   "fall" and "may" — too common as verbs ("don't fall", "I may go"). Even
//   with `\b` word boundaries they fire on modal-verb prose and the cost of
//   a wrong season hint is real (it gets merged into intent before the AI
//   call and cache key). `autumn` covers the fall-the-season semantics.

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const FORMALITY_HINT_REGEXES: Array<[RegExp, "low" | "mid" | "high"]> =
  FORMALITY_HINTS_RAW.map(([k, v]) => [new RegExp(`\\b${escapeForRegex(k)}\\b`, "i"), v]);
const SEASON_HINT_REGEXES: Array<[RegExp, "spring" | "summer" | "fall" | "winter"]> =
  SEASON_HINTS_RAW.map(([k, v]) => [new RegExp(`\\b${escapeForRegex(k)}\\b`, "i"), v]);

export function scanEventHints(
  events?: Array<{ title?: string; date?: string; description?: string }> | null,
): { formality?: "low" | "mid" | "high"; season?: "spring" | "summer" | "fall" | "winter" } {
  if (!Array.isArray(events) || events.length === 0) return {};
  const haystack = events
    .map((e) => `${e.title || ""} ${e.description || ""}`)
    .join(" ");
  const hints: { formality?: "low" | "mid" | "high"; season?: "spring" | "summer" | "fall" | "winter" } = {};
  for (const [re, v] of FORMALITY_HINT_REGEXES) {
    if (re.test(haystack)) { hints.formality = v; break; }
  }
  for (const [re, v] of SEASON_HINT_REGEXES) {
    if (re.test(haystack)) { hints.season = v; break; }
  }
  return hints;
}
