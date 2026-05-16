// ─────────────────────────────────────────────
// AI PROMPT ASSEMBLY (extracted Phase 5d — verbatim port)
//
// Lifted from `supabase/functions/burs_style_engine/index.ts` lines 197–364.
//
// Public surface:
//   - `TOOL_SELECT` / `TOOL_SUGGEST` — JSON-schema tool declarations used by
//     the generate / suggest modes respectively.
//   - `aiRefine(...)` — builds the system prompt + tool-call payload and
//     invokes an injected `ModelClient`. The fetch to the model provider is
//     performed via the injected client so this module is unit-testable
//     without network.
//
// The prompt strings are byte-for-byte copies of the inlined originals — do
// not edit copy or punctuation without coordinating with a release-week
// regression diff.
// ─────────────────────────────────────────────

import { quoteUserField } from "./prompt-sanitizer.ts";
import {
  type DayContextInput,
  type ScoredCombo,
  type WeatherInput,
  getCurrentSeason,
  getOccasionStyleHints,
} from "./outfit-scoring.ts";

const LOCALE_NAMES: Record<string, string> = {
  sv: "svenska", en: "English", no: "norsk", da: "dansk", fi: "finska",
  de: "Deutsch", fr: "français", es: "español", it: "italiano",
  pt: "português", nl: "Nederlands", ja: "日本語", ko: "한국어",
  ar: "العربية", fa: "فارسی", zh: "中文", pl: "polski",
};

export const TOOL_SELECT = {
  type: "function" as const,
  function: {
    name: "select_outfit",
    description: "Pick the best outfit from pre-scored candidates",
    parameters: {
      type: "object",
      properties: {
        chosen_index: { type: "number", description: "0-based index of the best combo" },
        explanation: { type: "string", description: "2-3 sentence explanation of why this outfit works" },
      },
      required: ["chosen_index", "explanation"],
      additionalProperties: false,
    },
  },
};

export const TOOL_SUGGEST = {
  type: "function" as const,
  function: {
    name: "suggest_outfits",
    description: "Select 2-3 outfits from pre-scored candidates",
    parameters: {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              combo_index: { type: "number" },
              title: { type: "string" },
              explanation: { type: "string" },
              occasion: { type: "string" },
            },
            required: ["combo_index", "title", "explanation", "occasion"],
            additionalProperties: false,
          },
        },
      },
      required: ["suggestions"],
      additionalProperties: false,
    },
  },
};

export interface ModelCallArgs {
  messages: Array<{ role: string; content: string }>;
  tools: any[];
  tool_choice: any;
  complexity: "trivial" | "standard" | "complex";
  max_tokens: number;
  functionName: string;
  cacheTtlSeconds: number;
  cacheNamespace: string;
}

/**
 * Minimal interface around `callBursAI` so the orchestrator can inject the
 * real network client while tests inject a stub. The returned `data` mirrors
 * the inner shape callers expect (tool-call result object); telemetry /
 * caching belong to the production client implementation.
 */
export type ModelClient = (args: ModelCallArgs) => Promise<{ data: any }>;

/**
 * Estimator delegate. The orchestrator injects the real `estimateMaxTokens`
 * exported from `_shared/burs-ai.ts`; tests can pass a no-op. Required so we
 * never silently drift away from the canonical formula.
 */
export type MaxTokensEstimator = (opts: {
  outputItems: number;
  perItemTokens: number;
  baseTokens: number;
}) => number;

export interface AiRefineOptions {
  combos: ScoredCombo[];
  mode: "generate" | "suggest";
  occasion: string;
  style: string | null;
  weather: WeatherInput;
  styleContext: string;
  locale: string;
  isStylistMode?: boolean;
  occasionSubmode?: string | null;
  layeringContext?: { needs_base_layer: boolean } | null;
  dayContext?: DayContextInput | null;
  // Phase 0 — variety. When mobile passes a regenerate_token (UUID minted on
  // the explicit "Try again" tap), it is mixed into the AI cache namespace
  // so identical prompt content misses cache and the model picks a fresh
  // combo. Ambient calls (initial mount / prefetch) leave the field
  // undefined and keep the existing cache hit pattern.
  regenerateToken?: string | null;
  /** Required injected dependency. */
  modelClient: ModelClient;
  /** Required injected estimator (so we don't shadow burs-ai's formula). */
  estimateMaxTokens: MaxTokensEstimator;
}

export interface BuildSystemPromptArgs {
  combos: ScoredCombo[];
  mode: "generate" | "suggest";
  occasion: string;
  style: string | null;
  weather: WeatherInput;
  styleContext: string;
  locale: string;
  isStylistMode?: boolean;
  occasionSubmode?: string | null;
  layeringContext?: { needs_base_layer: boolean } | null;
  dayContext?: DayContextInput | null;
}

/** Build the combo description block used inside the prompt. Verbatim. */
export function buildComboDescriptions(combos: ScoredCombo[]): string {
  return combos.map((combo, idx) => {
    const parts = combo.items.map(i => {
      const role = i.garment.layering_role || 'standalone';
      const roleLabel = ['base', 'mid', 'outer'].includes(role) ? ` (${role}-layer)` : '';
      return `${i.slot}${roleLabel}: ${quoteUserField(i.garment.title, 80)} (${i.garment.color_primary}${i.garment.material ? ", " + i.garment.material : ""})`;
    });
    return `Combo ${idx}: [score: ${combo.totalScore.toFixed(1)}] ${parts.join(" + ")}`;
  }).join("\n");
}

/** Stylist-mode enhancement text. Verbatim. */
export const STYLIST_ENHANCEMENT = `\n\nSTYLIST MODE: You are operating at the highest level. Apply deeper reasoning:
- Consider silhouette balance, proportion, and visual weight
- Evaluate texture interplay between pieces
- Assess color temperature harmony (warm vs cool tones)
- Factor in the overall mood and confidence the outfit projects
- Write the explanation as editorial styling notes — mention WHY specific pieces work together in terms of proportion, texture, and color logic. Be specific, not generic.`;

/** Build the explanation-guidance section. Verbatim. */
export function buildExplanationGuidance(occasionSubmode: string | null | undefined): string {
  return `

EXPLANATION RULES:
- Explain WHY the layering structure works (which piece is the base, mid, or outer layer)
- Explain how this outfit handles the current weather
- State what type of occasion this outfit is best for${occasionSubmode ? ` (specifically: ${occasionSubmode})` : ''}
- If there are wardrobe limitations, mention them honestly
- Explain why these garments work together structurally, not just aesthetically`;
}

/**
 * Build the full system prompt string for the selected mode. Verbatim port
 * of the inlined block at burs_style_engine/index.ts:269-332.
 */
export function buildSystemPrompt(args: BuildSystemPromptArgs): string {
  const {
    combos, mode, occasion, style, weather, styleContext, locale,
    isStylistMode = false,
    occasionSubmode = null,
    layeringContext = null,
    dayContext = null,
  } = args;

  const localeName = LOCALE_NAMES[locale] || "English";
  const comboDescriptions = buildComboDescriptions(combos);

  const styleHints = getOccasionStyleHints(occasion);
  const season = getCurrentSeason();
  const hintsStr = styleHints.length > 0 ? `\nSTYLE DIRECTION: ${styleHints.join(", ")}` : "";
  const seasonStr = `\nSEASON: ${season}`;
  const submodeStr = occasionSubmode ? `\nOCCASION SUB-MODE: ${occasionSubmode}` : "";
  const dayContextStr = dayContext
    ? `\nDAY INTELLIGENCE: strategy=${dayContext.strategy || "unknown"}, transition=${dayContext.transition_complexity || "unknown"}, weather_sensitivity=${dayContext.weather_sensitivity || "unknown"}${dayContext.transition_summary ? `\nDAY TRANSITIONS: ${dayContext.transition_summary}` : ""}${dayContext.wardrobe_priorities?.length ? `\nWARDROBE PRIORITIES: ${dayContext.wardrobe_priorities.join(", ")}` : ""}`
    : "";

  let layeringStr = "";
  if (layeringContext?.needs_base_layer) {
    layeringStr = "\nLAYERING CONTEXT: The top item is a mid-layer (e.g., cardigan, sweater). No explicit base layer is included — this look assumes a simple t-shirt or similar underneath.";
  }

  const stylistEnhancement = isStylistMode ? STYLIST_ENHANCEMENT : "";
  const explanationGuidance = buildExplanationGuidance(occasionSubmode);

  return mode === "generate"
    ? `You are a world-class stylist. Pick the SINGLE best outfit from the pre-scored candidates below. Consider overall aesthetic, color harmony, seasonal appropriateness, and suitability for the occasion.

OCCASION: ${occasion}${submodeStr}${style ? `\nSTYLE: ${style}` : ""}${hintsStr}${seasonStr}${layeringStr}${dayContextStr}
WEATHER: ${weather.temperature !== undefined ? weather.temperature + "°C" : "unknown"}${weather.precipitation ? ", " + weather.precipitation : ""}${weather.wind ? ", wind: " + weather.wind : ""}
${styleContext ? `\nUSER PROFILE: ${styleContext}` : ""}${stylistEnhancement}${explanationGuidance}
OUTFIT VALIDITY: Every chosen look must remain a complete outfit. Valid structures are top + bottom + shoes, or dress + shoes. Never strip a core piece just to make the explanation read better.

Write the explanation in ${localeName}.

CANDIDATES:
${comboDescriptions}`
    : `You are a world-class stylist. Select the 2-3 BEST and most DIVERSE outfits from the candidates below. Each must still fit the requested occasion. Vary the styling angle, silhouette, or mood within that occasion. Never return or imply a partial look.

${styleContext ? `USER PROFILE: ${styleContext}` : ""}${explanationGuidance}
OUTFIT VALIDITY: Every suggestion must remain a complete outfit. Valid structures are top + bottom + shoes, or dress + shoes.

Write all text in ${localeName}.

CANDIDATES:
${comboDescriptions}`;
}

/**
 * Verbatim port of the inlined `aiRefine` at burs_style_engine/index.ts:243.
 * The fetch to the model provider is performed via the injected `modelClient`
 * so this module is unit-testable without network. Errors retain the same
 * shape callers depend on (`{ error, status }`).
 */
export async function aiRefine(opts: AiRefineOptions): Promise<any> {
  const {
    mode, isStylistMode = false, regenerateToken = null,
    modelClient,
    estimateMaxTokens,
  } = opts;

  const systemPrompt = buildSystemPrompt(opts);

  const tool = mode === "generate" ? TOOL_SELECT : TOOL_SUGGEST;
  const toolName = mode === "generate" ? "select_outfit" : "suggest_outfits";

  try {
    const { data } = await modelClient({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: mode === "generate" ? (isStylistMode ? "Pick the best outfit. Write a detailed editorial explanation." : "Pick the best outfit.") : "Select the best 2-3 outfits." },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: toolName } },
      complexity: isStylistMode ? "standard" : "standard",
      max_tokens: mode === "generate" ? (isStylistMode ? 400 : 250) : estimateMaxTokens({ outputItems: 3, perItemTokens: 100, baseTokens: 150 }),
      functionName: "burs_style_engine",
      // Regenerate taps mint a fresh UUID per request, so a regen-scoped
      // cache row would never be re-hit before its TTL expires — writing
      // it just pollutes ai_response_cache. Skip the cache entirely
      // (ttl=0 short-circuits both lookup and store inside callBursAI)
      // and let ambient calls keep their hit pattern under the default
      // namespace.
      cacheTtlSeconds: regenerateToken ? 0 : 300,
      cacheNamespace: "style_engine",
    });
    return { data };
  } catch (e: any) {
    if (e.status === 429) return { error: "rate_limit", status: 429 };
    if (e.status === 402) return { error: "payment", status: 402 };
    console.error("AI gateway error:", e);
    return { error: "ai_error", status: 500 };
  }
}
