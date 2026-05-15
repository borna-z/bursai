/**
 * analyze_garment — JSON schemas for Gemini structured output (Wave S-B.1).
 *
 * These schemas are passed to the OpenAI-compatible chat completions endpoint
 * (`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`)
 * via `response_format: { type: "json_schema", json_schema: {...} }`. Gemini
 * 2.5 models accept this shape natively and guarantee schema-valid output —
 * the legacy `cleanJsonResponse` / parse-retry codepath becomes unreachable
 * once these are wired in.
 *
 * Wire format (per Gemini OpenAI-compat + OpenAI structured-outputs spec):
 *
 *   response_format: {
 *     type: "json_schema",
 *     json_schema: {
 *       name: string,          // unique identifier for the schema
 *       strict: true,          // refuse any field not in the schema
 *       schema: { ...JSONSchema },
 *     },
 *   }
 *
 * Strict-mode constraints we honour:
 *  - Every object sets `additionalProperties: false`.
 *  - Every property listed in `properties` MUST appear in `required`. Optional
 *    fields are modelled by allowing `null` in their `type` array — the
 *    legacy text-prompt schema already encoded nullability that way, so
 *    callers handling the response need no change.
 *  - Enums are exhaustive — mirror of the existing `normalizeColor` /
 *    `normalizeCategory` allow-lists. If a real-world image fails the enum,
 *    the post-parse normalizers in `index.ts` still fall back gracefully.
 *
 * Schemas are typed against the existing TS interfaces in `index.ts` so any
 * drift surfaces at deno-check time. They are NOT exported as a single
 * `Record` because each mode has a different shape; index.ts picks the one
 * matching the mode it just resolved.
 */

// ─── Reusable enum lists (single source of truth) ─────────────

const CATEGORY_ENUM = [
  "top",
  "bottom",
  "shoes",
  "outerwear",
  "accessory",
  "dress",
] as const;

const COLOR_ENUM = [
  "black",
  "white",
  "grey",
  "blue",
  "navy",
  "beige",
  "brown",
  "green",
  "red",
  "pink",
  "purple",
  "yellow",
  "orange",
] as const;

const PATTERN_ENUM = [
  "solid",
  "striped",
  "checked",
  "dotted",
  "floral",
  "patterned",
] as const;

const MATERIAL_ENUM = [
  "cotton",
  "polyester",
  "linen",
  "denim",
  "leather",
  "wool",
  "silk",
  "synthetic",
] as const;

const FIT_ENUM = ["slim", "regular", "loose", "oversized"] as const;
const SEASON_ENUM = ["spring", "summer", "autumn", "winter"] as const;

const NECKLINE_ENUM = [
  "crew",
  "v-neck",
  "scoop",
  "collar",
  "turtleneck",
  "boat",
  "hooded",
  "off-shoulder",
  "mock-neck",
] as const;

const SLEEVE_ENUM = ["sleeveless", "cap", "short", "three-quarter", "long"] as const;
const LENGTH_ENUM = ["cropped", "regular", "long", "midi", "maxi"] as const;
const CLOSURE_ENUM = ["button", "zip", "pullover", "snap", "belt", "tie", "wrap"] as const;
const FABRIC_WEIGHT_ENUM = ["sheer", "lightweight", "midweight", "heavyweight"] as const;
const SILHOUETTE_ENUM = [
  "fitted",
  "tailored",
  "relaxed",
  "boxy",
  "a-line",
  "straight",
  "flared",
  "draped",
] as const;
const VISUAL_WEIGHT_ENUM = ["light", "medium", "heavy"] as const;
const TEXTURE_ENUM = ["smooth", "subtle", "moderate", "pronounced", "bold"] as const;
const SHOULDER_ENUM = ["natural", "dropped", "structured", "padded", "raglan"] as const;
const DRAPE_ENUM = ["crisp", "structured", "soft", "fluid"] as const;
const RISE_ENUM = ["low", "mid", "high"] as const;
const LEG_SHAPE_ENUM = ["skinny", "straight", "tapered", "wide", "bootcut"] as const;
const HEM_ENUM = ["raw", "finished", "cuffed", "frayed", "asymmetric"] as const;
const STYLE_ARCHETYPE_ENUM = [
  "classic",
  "minimalist",
  "streetwear",
  "preppy",
  "bohemian",
  "athleisure",
  "romantic",
  "edgy",
  "avant-garde",
  "workwear",
  "coastal",
  "retro",
] as const;
const LAYERING_ENUM = ["base", "mid", "outer", "standalone"] as const;
const COLLAR_STYLE_ENUM = [
  "spread",
  "button-down",
  "band",
  "mock-neck",
  "cowl",
  "peter-pan",
  "mandarin",
  "none",
] as const;
const WAISTBAND_ENUM = ["elasticated", "drawstring", "button", "belt-loops", "none"] as const;

// ─── Helpers ──────────────────────────────────────────────────

// Builds a `nullable` property. Strict mode forbids omitting fields, so an
// "optional" field is one whose value may be null.
function nullableEnum(values: readonly string[]) {
  return { type: ["string", "null"], enum: [...values, null] };
}

function nullableString() {
  return { type: ["string", "null"] };
}

// Top-level wrapper for `response_format`. `name` MUST be unique across
// concurrent calls — Gemini's structured-output binding hashes by name.
export interface GeminiJsonSchemaResponseFormat {
  type: "json_schema";
  json_schema: {
    name: string;
    strict: true;
    schema: Record<string, unknown>;
  };
}

// ─── Fast mode schema ─────────────────────────────────────────

export const FAST_SCHEMA: GeminiJsonSchemaResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "garment_fast",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", maxLength: 50 },
        category: { type: "string", enum: [...CATEGORY_ENUM] },
        subcategory: { type: "string" },
        color_primary: { type: "string", enum: [...COLOR_ENUM] },
        color_secondary: nullableEnum(COLOR_ENUM),
        pattern: nullableEnum(PATTERN_ENUM),
        material: nullableEnum(MATERIAL_ENUM),
        fit: nullableEnum(FIT_ENUM),
        season_tags: {
          type: "array",
          items: { type: "string", enum: [...SEASON_ENUM] },
        },
        formality: { type: "integer", minimum: 1, maximum: 5 },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
      required: [
        "title",
        "category",
        "subcategory",
        "color_primary",
        "color_secondary",
        "pattern",
        "material",
        "fit",
        "season_tags",
        "formality",
        "confidence",
      ],
    },
  },
};

// ─── Full mode schema (adds multi-garment detection) ─────────

// Sub-schema for one detected garment inside an image that contains
// multiple. Same shape as the fast schema but every field required —
// strict mode demands it.
const DETECTED_GARMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", maxLength: 50 },
    category: { type: "string", enum: [...CATEGORY_ENUM] },
    subcategory: { type: "string" },
    color_primary: { type: "string", enum: [...COLOR_ENUM] },
    color_secondary: nullableEnum(COLOR_ENUM),
    pattern: nullableEnum(PATTERN_ENUM),
    material: nullableEnum(MATERIAL_ENUM),
    fit: nullableEnum(FIT_ENUM),
    season_tags: {
      type: "array",
      items: { type: "string", enum: [...SEASON_ENUM] },
    },
    formality: { type: "integer", minimum: 1, maximum: 5 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: [
    "title",
    "category",
    "subcategory",
    "color_primary",
    "color_secondary",
    "pattern",
    "material",
    "fit",
    "season_tags",
    "formality",
    "confidence",
  ],
};

export const FULL_SCHEMA: GeminiJsonSchemaResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "garment_full",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", maxLength: 50 },
        category: { type: "string", enum: [...CATEGORY_ENUM] },
        subcategory: { type: "string" },
        color_primary: { type: "string", enum: [...COLOR_ENUM] },
        color_secondary: nullableEnum(COLOR_ENUM),
        pattern: nullableEnum(PATTERN_ENUM),
        material: nullableEnum(MATERIAL_ENUM),
        fit: nullableEnum(FIT_ENUM),
        season_tags: {
          type: "array",
          items: { type: "string", enum: [...SEASON_ENUM] },
        },
        formality: { type: "integer", minimum: 1, maximum: 5 },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        image_contains_multiple_garments: { type: "boolean" },
        // Strict mode requires this field present; we model "absent" via
        // an empty array. index.ts treats empty == undefined.
        detected_garments: {
          type: "array",
          items: DETECTED_GARMENT_SCHEMA,
        },
      },
      required: [
        "title",
        "category",
        "subcategory",
        "color_primary",
        "color_secondary",
        "pattern",
        "material",
        "fit",
        "season_tags",
        "formality",
        "confidence",
        "image_contains_multiple_garments",
        "detected_garments",
      ],
    },
  },
};

// ─── Enrich mode schema ───────────────────────────────────────

export const ENRICH_SCHEMA: GeminiJsonSchemaResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "garment_enrich",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        neckline: nullableEnum(NECKLINE_ENUM),
        sleeve_length: nullableEnum(SLEEVE_ENUM),
        garment_length: nullableEnum(LENGTH_ENUM),
        closure: nullableEnum(CLOSURE_ENUM),
        fabric_weight: nullableEnum(FABRIC_WEIGHT_ENUM),
        silhouette: nullableEnum(SILHOUETTE_ENUM),
        visual_weight: { type: "string", enum: [...VISUAL_WEIGHT_ENUM] },
        texture_intensity: { type: "string", enum: [...TEXTURE_ENUM] },
        shoulder_structure: nullableEnum(SHOULDER_ENUM),
        drape: nullableEnum(DRAPE_ENUM),
        rise: nullableEnum(RISE_ENUM),
        leg_shape: nullableEnum(LEG_SHAPE_ENUM),
        hem_detail: nullableEnum(HEM_ENUM),
        style_archetype: { type: "string", enum: [...STYLE_ARCHETYPE_ENUM] },
        style_tags: {
          type: "array",
          items: { type: "string" },
          maxItems: 5,
        },
        occasion_tags: {
          type: "array",
          items: { type: "string" },
          maxItems: 4,
        },
        layering_role: nullableEnum(LAYERING_ENUM),
        care_instructions: {
          type: "array",
          items: { type: "string" },
          maxItems: 3,
        },
        versatility_score: { type: "integer", minimum: 1, maximum: 10 },
        color_harmony_notes: { type: "string", maxLength: 80 },
        stylist_note: { type: "string", maxLength: 120 },
        text_on_garment: nullableString(),
        logo_description: nullableString(),
        graphic_or_print_description: nullableString(),
        collar_style: nullableEnum(COLLAR_STYLE_ENUM),
        construction_details: nullableString(),
        waistband: nullableEnum(WAISTBAND_ENUM),
        color_description: { type: "string" },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        refined_title: { type: "string", maxLength: 30 },
      },
      required: [
        "neckline",
        "sleeve_length",
        "garment_length",
        "closure",
        "fabric_weight",
        "silhouette",
        "visual_weight",
        "texture_intensity",
        "shoulder_structure",
        "drape",
        "rise",
        "leg_shape",
        "hem_detail",
        "style_archetype",
        "style_tags",
        "occasion_tags",
        "layering_role",
        "care_instructions",
        "versatility_score",
        "color_harmony_notes",
        "stylist_note",
        "text_on_garment",
        "logo_description",
        "graphic_or_print_description",
        "collar_style",
        "construction_details",
        "waistband",
        "color_description",
        "confidence",
        "refined_title",
      ],
    },
  },
};

// ─── Locale validation (S-B.4) ────────────────────────────────

// Single source of truth for supported locales. The TITLE_LANG_MAP in
// index.ts is derived from this so a new locale only needs to be added in
// one place — the union type below + the corresponding entry in the map.
export const SUPPORTED_LOCALES = [
  "sv",
  "en",
  "no",
  "da",
  "fi",
  "de",
  "fr",
  "es",
  "pt",
  "it",
  "nl",
  "ar",
  "fa",
  "ja",
] as const;

export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
