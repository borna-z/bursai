import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, estimateMaxTokens } from "../_shared/burs-ai.ts";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, recordError, overloadResponse, enforceSubscription, subscriptionLockedResponse } from "../_shared/scale-guard.ts";
import { collectOccasionSignals, hasOccasionSignal, normalizeSignalText } from "../_shared/style-signals.ts";
import { logger } from "../_shared/logger.ts";
// Wave 8.5 PR B (P88) — canonical signal normalization + style summary loader.
import { normalizeStyleMemorySignal } from "../_shared/style-memory-signals.ts";
import { loadOrBuildSummary, loadStandardSummaryInputs, type UserStyleSummaryRow } from "../_shared/summary-loader.ts";

import {
  // types
  type GarmentRow,
  type ScoredGarment,
  type ComboItem,
  type ScoredCombo,
  type WeatherInput,
  type DayContextInput,
  type WearLog,
  type PairMemoryRow,
  type PairMemoryMap,
  type FeedbackSignal,
  type StyleVector,
  type ComfortStyleProfile,
  type BodyProfile,
  type PersonalUniform,
  type WearPatternProfile,
  type SocialContextMap,
  type GarmentReadinessSignals,
  type GarmentPenalty,
  type SeasonTransitionInfo,
  // scoring functions
  scoreGarment,
  getCurrentSeason,
  getSeasonTransitionInfo,
  buildFeedbackPenalties,
  buildPairMemoryMap,
  buildStyleVector,
  buildWearPatternProfile,
  buildComfortStyleProfile,
  buildBodyProfile,
  buildSocialContextMap,
  buildPersonalUniform,
  garmentReadinessSignals,
  hydrateEnrichment,
  categorizeSlot,
  isCompleteOutfit,
  buildActiveLookSlotMap,
  rankCombosForRefinement,
  explainMissingRequiredSlots,
  buildIncompleteOutfitFailure,
  getOutfitGenerationMode,
  getRequiredSlotsForContext,
  recordPairOutcome,
  mapDayOccasionToEngine,
  resolveOccasionSubmode,
  weatherSuitability,
  formalityScore,
  colorHarmonyScore,
  materialCompatibility,
  styleIntentScore,
  occasionTemplateScore,
  weatherPracticalityScore,
  getPairMemoryScore,
  silhouetteBalanceScore,
  textureDepthScore,
  fitProportionScore,
  getOccasionStyleHints,
  getFormalityRange,
  styleAlignmentScore,
  styleVectorScore,
  wearPatternScore,
  comfortStyleScore,
  validateLayeringCompleteness,
  fitFamily,
  clampScore,
  garmentText,
  getHSL,
  isNeutral,
  isWetWeather,
  feelsLikeTemp,
  getStylePrefs,
  feedbackScore,
  decayWeight,
  isSuitableShoeCandidate,
  requiresOuterwear,
  getColorTemperature,
  getMaterialGroup,
  socialContextPenalty,
  recentSuggestionPenalty,
  RECENT_SUGGESTION_WINDOW,
} from "../_shared/outfit-scoring.ts";

import {
  type DeduplicatedCombo,
  type ConfidenceResult,
  type FamilyLabel,
  type QualityViolation,
  type GenerationFailureSignal,
  type WardrobeInsight,
  type ConfidenceLevel,
  buildCombos,
  buildFallbackCombos,
  scoreCombo,
  pickRepresentativeOutfits,
  filterCombosByPreferredGarment,
  qualityGate,
  computeConfidence,
  computeSwapConfidence,
  detectWardrobeGapForRequest,
  generateLimitationNote,
  buildBaseGenerationLimitationNote,
  buildGenerationFailureSignal,
  deriveWardrobeInsightsFromGeneration,
} from "../_shared/outfit-combination.ts";

const log = logger("burs_style_engine");

function createRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `burs-style-engine-${Date.now()}`;
  }
}

function normalizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean),
  ));
}

// ─────────────────────────────────────────────

const LOCALE_NAMES: Record<string, string> = {
  sv: "svenska", en: "English", no: "norsk", da: "dansk", fi: "finska",
  de: "Deutsch", fr: "français", es: "español", it: "italiano",
  pt: "português", nl: "Nederlands", ja: "日本語", ko: "한국어",
  ar: "العربية", fa: "فارسی", zh: "中文", pl: "polski",
};

// ─────────────────────────────────────────────
// STYLE CONTEXT BUILDER
// ─────────────────────────────────────────────

function buildStyleContext(preferences: Record<string, any> | null): string {
  if (!preferences) return "";
  // Theme 7 (post-launch audit): unified V3-vocab view with V4 fallback. The
  // V4-native cold-start race window (no V3 mirror written yet) used to emit
  // an entirely empty style context block — `preferences.styleProfile` was
  // absent, the legacy fallback to `preferences` itself produced undefined
  // for every V3 key. The reader translates V4 canonical fields back into
  // V3 vocab so the engine retains style signal even before the backfill
  // hook lands.
  const sp = getStylePrefs(preferences);
  const lines: string[] = [];
  if (sp.gender) lines.push(`Gender: ${sp.gender}`);
  if (sp.ageRange) lines.push(`Age: ${sp.ageRange}`);
  if (sp.styleWords?.length) lines.push(`Style words: ${sp.styleWords.join(", ")}`);
  if (sp.comfortVsStyle !== undefined) lines.push(`Comfort vs style: ${sp.comfortVsStyle}/100`);
  if (sp.adventurousness) lines.push(`Adventurousness: ${sp.adventurousness}`);
  if (sp.favoriteColors?.length) lines.push(`Favorite colors: ${sp.favoriteColors.join(", ")}`);
  if (sp.dislikedColors?.length) lines.push(`Avoids: ${sp.dislikedColors.join(", ")}`);
  if (sp.paletteVibe) lines.push(`Palette: ${sp.paletteVibe}`);
  if (sp.fit) lines.push(`Fit: ${sp.fit}`);
  if (sp.layering) lines.push(`Layering: ${sp.layering}`);
  if (sp.fabricFeel) lines.push(`Fabrics: ${sp.fabricFeel}`);
  if (sp.primaryGoal) lines.push(`Goal: ${sp.primaryGoal}`);
  return lines.join(". ");
}

function isSameOutfit(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

// ─────────────────────────────────────────────
// AI REFINEMENT
// ─────────────────────────────────────────────

const TOOL_SELECT = {
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

const TOOL_SUGGEST = {
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

async function aiRefine(
  combos: ScoredCombo[],
  mode: "generate" | "suggest",
  occasion: string,
  style: string | null,
  weather: WeatherInput,
  styleContext: string,
  locale: string,
  isStylistMode = false,
  occasionSubmode: string | null = null,
  layeringContext: { needs_base_layer: boolean } | null = null,
  dayContext: DayContextInput | null = null,
  // Service-role client passed through so callBursAI can fire-and-forget
  // telemetry to analytics_events. Required (no default) — a defaulted
  // null would re-introduce the exact silent-telemetry-loss footgun this
  // parameter exists to eliminate: a future caller could omit it and the
  // analytics_events insert would be skipped without a typecheck error.
  serviceClient: any,
  // Phase 0 — variety. When mobile passes a regenerate_token (UUID minted on
  // the explicit "Try again" tap), it is mixed into the AI cache namespace
  // so identical prompt content misses cache and the model picks a fresh
  // combo. Ambient calls (initial mount / prefetch) leave the field
  // undefined and keep the existing cache hit pattern.
  regenerateToken: string | null = null,
): Promise<any> {
  const localeName = LOCALE_NAMES[locale] || "English";

  const comboDescriptions = combos.map((combo, idx) => {
    const parts = combo.items.map(i => {
      const role = i.garment.layering_role || 'standalone';
      const roleLabel = ['base', 'mid', 'outer'].includes(role) ? ` (${role}-layer)` : '';
      return `${i.slot}${roleLabel}: ${i.garment.title} (${i.garment.color_primary}${i.garment.material ? ", " + i.garment.material : ""})`;
    });
    return `Combo ${idx}: [score: ${combo.totalScore.toFixed(1)}] ${parts.join(" + ")}`;
  }).join("\n");

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

  const stylistEnhancement = isStylistMode
    ? `\n\nSTYLIST MODE: You are operating at the highest level. Apply deeper reasoning:
- Consider silhouette balance, proportion, and visual weight
- Evaluate texture interplay between pieces
- Assess color temperature harmony (warm vs cool tones)
- Factor in the overall mood and confidence the outfit projects
- Write the explanation as editorial styling notes — mention WHY specific pieces work together in terms of proportion, texture, and color logic. Be specific, not generic.`
    : "";

  const explanationGuidance = `

EXPLANATION RULES:
- Explain WHY the layering structure works (which piece is the base, mid, or outer layer)
- Explain how this outfit handles the current weather
- State what type of occasion this outfit is best for${occasionSubmode ? ` (specifically: ${occasionSubmode})` : ''}
- If there are wardrobe limitations, mention them honestly
- Explain why these garments work together structurally, not just aesthetically`;

  const systemPrompt = mode === "generate"
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

  const tool = mode === "generate" ? TOOL_SELECT : TOOL_SUGGEST;
  const toolName = mode === "generate" ? "select_outfit" : "suggest_outfits";

  try {
    const { data } = await callBursAI({
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
    }, serviceClient);
    return { data };
  } catch (e: any) {
    if (e.status === 429) return { error: "rate_limit", status: 429 };
    if (e.status === 402) return { error: "payment", status: 402 };
    console.error("AI gateway error:", e);
    return { error: "ai_error", status: 500 };
  }
}

// ─────────────────────────────────────────────
// SWAP MODE
// ─────────────────────────────────────────────

// ── Swap-specific helpers ──

function visualWeight(garment: GarmentRow | null | undefined): number {
  if (!garment) return 5;
  const txt = garmentText(garment);
  let score = 5;

  if (['boot', 'coat', 'puffer', 'chunky', 'wool', 'leather'].some((x) => txt.includes(x))) score += 2;
  if (['sandal', 'linen', 'lightweight', 'tank', 'tee'].some((x) => txt.includes(x))) score -= 1.5;

  const formality = garment.formality ?? 5;
  score += (formality - 5) * 0.15;

  return clampScore(score);
}

function formalityAlignmentScore(
  garment: GarmentRow,
  others: GarmentRow[],
  currentGarment: GarmentRow | null
): number {
  const allFormalities = others
    .map((g) => g.formality)
    .filter((v): v is number => typeof v === 'number');

  const currentFormality = currentGarment?.formality;
  const candidateFormality = garment.formality ?? 5;

  if (allFormalities.length === 0 && typeof currentFormality !== 'number') return 7;

  const target =
    typeof currentFormality === 'number'
      ? currentFormality
      : allFormalities.reduce((sum, v) => sum + v, 0) / allFormalities.length;

  const diff = Math.abs(candidateFormality - target);
  return clampScore(10 - diff * 2);
}

function fitConsistencyScore(
  garment: GarmentRow,
  others: GarmentRow[],
  currentGarment: GarmentRow | null
): number {
  const candidateFit = fitFamily(garment.fit);
  const currentFit = fitFamily(currentGarment?.fit);
  let score = 7;

  if (currentGarment && candidateFit === currentFit) score += 2;
  else if (currentGarment && candidateFit !== currentFit) score -= 1.2;

  const relaxedOthers = others.filter((g) => fitFamily(g.fit) === 'relaxed').length;
  const fittedOthers = others.filter((g) => fitFamily(g.fit) === 'fitted').length;

  if (candidateFit === 'relaxed' && relaxedOthers >= fittedOthers) score += 0.7;
  if (candidateFit === 'fitted' && fittedOthers > relaxedOthers) score += 0.7;

  return clampScore(score);
}

function dnaPreservationScore(
  garment: GarmentRow,
  currentGarment: GarmentRow | null,
  others: GarmentRow[]
): number {
  if (!currentGarment) return 7;

  let score = 7;

  const currentText = garmentText(currentGarment);
  const candidateText = garmentText(garment);

  const currentFit = fitFamily(currentGarment.fit);
  const candidateFit = fitFamily(garment.fit);
  if (currentFit === candidateFit) score += 1.5;

  const currentFormality = currentGarment.formality ?? 5;
  const candidateFormality = garment.formality ?? 5;
  const formalityDiff = Math.abs(candidateFormality - currentFormality);
  score += Math.max(0, 1.8 - formalityDiff * 0.6);

  const currentWeight = visualWeight(currentGarment);
  const candidateWeight = visualWeight(garment);
  const weightDiff = Math.abs(candidateWeight - currentWeight);
  score += Math.max(0, 1.2 - weightDiff * 0.4);

  const sameMaterial =
    currentGarment.material &&
    garment.material &&
    currentGarment.material.toLowerCase() === garment.material.toLowerCase();
  if (sameMaterial) score += 0.8;

  const samePattern =
    (currentGarment.pattern || 'solid').toLowerCase() ===
    (garment.pattern || 'solid').toLowerCase();
  if (samePattern) score += 0.5;

  const othersText = others.map(garmentText).join(' ');
  if (currentText.includes('sneaker') && candidateText.includes('sneaker')) score += 0.7;
  if (currentText.includes('loafer') && candidateText.includes('loafer')) score += 0.7;
  if (currentText.includes('coat') && candidateText.includes('jacket')) score += 0.3;
  if (othersText.includes('tailored') && candidateText.includes('hoodie')) score -= 1.5;

  return clampScore(score);
}

function swapPracticalityScore(
  garment: GarmentRow,
  slot: string,
  weather: WeatherInput
): number {
  const txt = garmentText(garment);
  const temp = weather.temperature;
  const precipitation = String(weather.precipitation || '').toLowerCase();
  const wet = precipitation !== '' && !['none', 'ingen'].includes(precipitation);

  let score = 7;

  if (slot === 'shoes') {
    if (wet && txt.includes('sandals')) score -= 4;
    if (wet && (txt.includes('boot') || txt.includes('sneaker'))) score += 1;
  }

  if (slot === 'outerwear') {
    if (temp !== undefined && temp < 12) score += 1.5;
    if (wet) score += 1.5;
    if (temp !== undefined && temp >= 24) score -= 1.2;
  }

  if (slot === 'top' || slot === 'dress') {
    if (temp !== undefined && temp >= 24 && ['wool', 'heavy knit', 'turtleneck'].some((x) => txt.includes(x))) {
      score -= 2;
    }
  }

  return clampScore(score);
}

type SwapMode = 'safe' | 'bold' | 'fresh';

function expressiveLiftScore(
  garment: GarmentRow,
  currentGarment: GarmentRow | null
): number {
  const txt = garmentText(garment);
  const hsl = getHSL(garment.color_primary);
  const currentHsl = currentGarment ? getHSL(currentGarment.color_primary) : null;

  let score = 5.5;

  if (hsl && !isNeutral(hsl)) score += 1.2;
  if (garment.pattern && !['solid', 'none'].includes(garment.pattern.toLowerCase())) score += 1.2;
  if (['leather', 'boot', 'loafer', 'blazer', 'coat', 'silk', 'satin'].some((x) => txt.includes(x))) score += 0.8;

  if (currentHsl && hsl) {
    const hd = Math.abs(hsl[0] - currentHsl[0]);
    if (hd >= 18) score += 0.5;
  }

  if (currentGarment) {
    const formalityDiff = Math.abs((garment.formality ?? 5) - (currentGarment.formality ?? 5));
    if (formalityDiff <= 2) score += 0.6;
    else if (formalityDiff > 3.5) score -= 1.0;
  }

  return clampScore(score);
}

function controlledNoveltyScore(
  garment: GarmentRow,
  currentGarment: GarmentRow | null,
  colorHarmony: number,
  formalityAlignment: number,
  dnaPreservation: number
): number {
  if (!currentGarment) return 6.5;

  let score = 6;

  const currentColor = String(currentGarment.color_primary || '').toLowerCase();
  const candidateColor = String(garment.color_primary || '').toLowerCase();
  const currentMaterial = String(currentGarment.material || '').toLowerCase();
  const candidateMaterial = String(garment.material || '').toLowerCase();

  if (candidateColor && candidateColor !== currentColor) score += 1.0;
  if (candidateMaterial && candidateMaterial !== currentMaterial) score += 0.8;
  if (fitFamily(garment.fit) !== fitFamily(currentGarment.fit)) score += 0.6;

  if (candidateColor === currentColor && candidateMaterial === currentMaterial) score -= 1.4;

  if (colorHarmony < 5 || formalityAlignment < 5 || dnaPreservation < 4.5) score -= 2.2;

  return clampScore(score);
}

function scoreSwapCandidates(
  slot: string,
  currentGarmentId: string,
  otherItems: { slot: string; garment: GarmentRow }[],
  allGarments: GarmentRow[],
  occasion: string,
  weather: WeatherInput,
  penalties: Map<string, GarmentPenalty>,
  prefs: Record<string, any> | null,
  swapMode: SwapMode = 'safe',
  pairMemory: PairMemoryMap | null = null
): (ScoredGarment & { swap_reason?: string })[] {
  const currentGarment = allGarments.find((g) => g.id === currentGarmentId) || null;

  const slotGarments = allGarments.filter((g) => {
    const gSlot = categorizeSlot(g.category, g.subcategory);
    return gSlot === slot && g.id !== currentGarmentId;
  });

  const otherGarments = otherItems.map((i) => i.garment).filter(Boolean);
  const otherColors = otherGarments
    .map((g) => getHSL(g.color_primary))
    .filter(Boolean) as [number, number, number][];

  return slotGarments
    .map((garment) => {
      const base = scoreGarment(garment, occasion, weather, penalties, prefs);

      const gColor = getHSL(garment.color_primary);
      const colorHarmony =
        gColor && otherColors.length > 0 ? colorHarmonyScore([...otherColors, gColor]) : 7;

      const materialCompat = materialCompatibility([
        ...otherGarments.map((g) => g.material),
        garment.material,
      ]);

      const formalityAlignment = formalityAlignmentScore(
        garment,
        otherGarments,
        currentGarment
      );

      const fitConsistency = fitConsistencyScore(
        garment,
        otherGarments,
        currentGarment
      );

      const dnaPreservation = dnaPreservationScore(
        garment,
        currentGarment,
        otherGarments
      );

      const practicality = swapPracticalityScore(garment, slot, weather);
      const expressiveLift = expressiveLiftScore(garment, currentGarment);
      const freshness = controlledNoveltyScore(
        garment,
        currentGarment,
        colorHarmony,
        formalityAlignment,
        dnaPreservation
      );

      // Pair memory: score candidate against all other garments in the outfit
      const swapPairIds = [garment.id, ...otherItems.map(i => i.garment.id)];
      const pairMem = getPairMemoryScore(swapPairIds, pairMemory);

      let totalScore = 0;

      if (swapMode === 'safe') {
        totalScore =
          base.score * 0.24 +
          dnaPreservation * 0.30 +
          colorHarmony * 0.11 +
          materialCompat * 0.07 +
          formalityAlignment * 0.09 +
          fitConsistency * 0.06 +
          practicality * 0.05 +
          pairMem.boost * 0.08 -
          pairMem.penalty * 0.10;
      } else if (swapMode === 'bold') {
        totalScore =
          base.score * 0.20 +
          dnaPreservation * 0.15 +
          colorHarmony * 0.11 +
          materialCompat * 0.05 +
          formalityAlignment * 0.09 +
          fitConsistency * 0.04 +
          practicality * 0.05 +
          expressiveLift * 0.17 +
          freshness * 0.05 +
          pairMem.boost * 0.06 -
          pairMem.penalty * 0.08;
      } else {
        totalScore =
          base.score * 0.21 +
          dnaPreservation * 0.16 +
          colorHarmony * 0.11 +
          materialCompat * 0.06 +
          formalityAlignment * 0.08 +
          fitConsistency * 0.05 +
          practicality * 0.05 +
          expressiveLift * 0.06 +
          freshness * 0.13 +
          pairMem.boost * 0.06 -
          pairMem.penalty * 0.08;
      }

      if (formalityAlignment < 4.5) totalScore -= 1.5;
      if (colorHarmony < 4.5) totalScore -= 1.2;
      if (swapMode === 'safe' && dnaPreservation < 4.5) totalScore -= 2;

      // Explicit wear_recency bonus
      const daysSinceWorn = garment.last_worn_at
        ? (Date.now() - new Date(garment.last_worn_at).getTime()) / (1000 * 60 * 60 * 24)
        : 999;
      const wearRecencyBonus = daysSinceWorn >= 14 ? 5 : 0;

      // Explicit rejection penalty
      const rejectionPenalty = penalties.get(garment.id)?.rejected === true ? 20 : 0;

      const finalScore = Math.max(0, totalScore + wearRecencyBonus - rejectionPenalty);

      // Generate swap reason
      const swap_reason = buildSwapReason(garment, currentGarment, {
        colorHarmony, materialCompat, formalityAlignment, fitConsistency,
        dnaPreservation, practicality, expressiveLift, freshness, swapMode,
      });

      return {
        garment,
        score: finalScore,
        breakdown: {
          overall: finalScore,
          item_strength: base.score,
          dna_preservation: dnaPreservation,
          color_harmony: colorHarmony,
          material_compatibility: materialCompat,
          formality_alignment: formalityAlignment,
          fit_consistency: fitConsistency,
          practicality,
          expressive_lift: expressiveLift,
          freshness,
          pair_memory_boost: pairMem.boost,
          pair_memory_penalty: pairMem.penalty,
          swap_mode: swapMode === 'safe' ? 1 : swapMode === 'bold' ? 2 : 3,
          wear_recency: wearRecencyBonus,
          rejection_penalty: -rejectionPenalty,
        },
        swap_reason,
      } as ScoredGarment & { swap_reason?: string };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

/** Build a concise, stylist-grade swap reason */
function buildSwapReason(
  candidate: GarmentRow,
  current: GarmentRow | null,
  scores: {
    colorHarmony: number;
    materialCompat: number;
    formalityAlignment: number;
    fitConsistency: number;
    dnaPreservation: number;
    practicality: number;
    expressiveLift: number;
    freshness: number;
    swapMode: SwapMode;
  }
): string {
  const reasons: string[] = [];

  // Pick the top 1-2 strongest signals
  if (scores.colorHarmony >= 8) reasons.push('strong color harmony with the rest');
  if (scores.dnaPreservation >= 8.5 && scores.swapMode === 'safe') reasons.push('preserves the outfit\'s DNA');
  if (scores.expressiveLift >= 8 && scores.swapMode === 'bold') reasons.push('adds visual contrast');
  if (scores.freshness >= 8 && scores.swapMode === 'fresh') reasons.push('brings something new');
  if (scores.practicality >= 9) reasons.push('ideal for this weather');
  if (scores.formalityAlignment >= 9) reasons.push('perfect formality match');
  if (scores.materialCompat >= 9) reasons.push('great material pairing');
  if (scores.fitConsistency >= 9) reasons.push('balanced silhouette');

  // If no strong signal, use relative comparison
  if (reasons.length === 0 && current) {
    const candidateColor = (candidate.color_primary || '').toLowerCase();
    const currentColor = (current.color_primary || '').toLowerCase();
    if (candidateColor !== currentColor) reasons.push(`shifts the palette with ${candidateColor}`);
    if (fitFamily(candidate.fit) !== fitFamily(current.fit)) reasons.push('changes the silhouette');
    if (candidate.wear_count === 0) reasons.push('unworn — time to debut');
  }

  if (reasons.length === 0) reasons.push('solid alternative');

  return reasons.slice(0, 2).join(', ');
}

// ─────────────────────────────────────────────
// MAIN SERVER
// ─────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;
    const requestId = createRequestId();
    const requestStartedAt = Date.now();

    const body = await req.json();
    const mode: string = body.mode || "generate"; // "generate" | "suggest" | "swap" | "record_pair"
    const generatorMode: string = body.generator_mode || (mode === "stylist" ? "stylist" : "standard");

    // ── RECORD PAIR OUTCOME (lightweight, early return) ──
    if (mode === "record_pair") {
      const garmentIds: string[] = body.garment_ids || [];
      const positive: boolean = body.positive !== false;
      if (garmentIds.length >= 2) {
        const svc = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await recordPairOutcome(svc, userId, garmentIds, positive);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // ── Scale guard: rate limit expensive AI operations ──
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    if (checkOverload("burs_style_engine")) {
      return overloadResponse(CORS_HEADERS);
    }
    await enforceRateLimit(serviceClient, userId, "burs_style_engine");

    // Wave 8 P54 — paywall gate.
    const subCheck = await enforceSubscription(serviceClient, userId);
    if (!subCheck.allowed) {
      return subscriptionLockedResponse(subCheck.reason, CORS_HEADERS);
    }

    const dayContext: DayContextInput | null = body.day_context && typeof body.day_context === "object"
      ? body.day_context as DayContextInput
      : null;
    const mappedDominantOccasion = mapDayOccasionToEngine(dayContext?.dominant_occasion);
    const isGenericOccasion = ["vardag", "everyday", "casual"].includes(normalizeSignalText(body.occasion || ""));
    const occasion: string = (isGenericOccasion && mappedDominantOccasion) ? mappedDominantOccasion : (body.occasion || "vardag");
    const style: string | null = body.style || null;

    // Normalize weather — accept both `temp` and `temperature`
    const rawWeather = body.weather || {};
    const weather: WeatherInput = {
      temperature: typeof rawWeather.temperature === 'number'
        ? rawWeather.temperature
        : typeof rawWeather.temp === 'number'
          ? rawWeather.temp
          : undefined,
      precipitation: typeof rawWeather.precipitation === 'string' ? rawWeather.precipitation : 'none',
      wind: typeof rawWeather.wind === 'string' ? rawWeather.wind : 'low',
    };

    const locale: string = body.locale || "sv";
    const eventTitle: string | null = body.event_title || null; // Social context
    const eventTitleFromDayContext = dayContext?.anchor_event?.title || dayContext?.first_important_event?.title || null;
    const effectiveEventTitle: string | null = eventTitle || eventTitleFromDayContext;
    const preferGarmentIds: Set<string> = new Set(normalizeIdList(body.prefer_garment_ids));
    const excludeGarmentIds: Set<string> = new Set(normalizeIdList(body.exclude_garment_ids));
    const activeLookGarmentIds = normalizeIdList(body.active_look_garment_ids);
    const lockedGarmentIds: Set<string> = new Set(normalizeIdList(body.locked_garment_ids));
    // Phase 0 — variety. Mobile mints a UUID on the explicit "Try again" tap
    // and sends it as regenerate_token; the field is omitted on initial mount
    // / prefetch so those calls still hit the AI response cache.
    const regenerateToken: string | null =
      typeof body.regenerate_token === "string" && body.regenerate_token.length > 0
        ? body.regenerate_token
        : null;
    const requestedEditSlots: Set<string> = new Set(
      normalizeIdList(body.requested_edit_slots).map((slot) => normalizeSignalText(slot)),
    );

    log.info("request.start", {
      requestId,
      userId,
      stage: "request_received",
      mode,
      generatorMode,
      occasion,
      locale,
      preferCount: preferGarmentIds.size,
      excludeCount: excludeGarmentIds.size,
      activeLookCount: activeLookGarmentIds.length,
      lockedCount: lockedGarmentIds.size,
      requestedEditSlots: Array.from(requestedEditSlots),
    });

    // For swap mode
    const swapSlot: string | null = body.swap_slot || null;
    const currentGarmentId: string | null = body.current_garment_id || null;
    const otherItemsRaw: { slot: string; garment_id: string }[] | null = body.other_items || null;
    const swapMode: SwapMode =
      body.swap_mode === 'bold' || body.swap_mode === 'fresh' ? body.swap_mode : 'safe';

    // Fetch data in parallel
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [garmentsRawRes, profileRes, recentOutfitsRes, feedbackRes, wearLogsRes, laundryCountRes, pairMemoryRes, feedbackSignalsRes, plannedNotWornRes] = await Promise.all([
      supabase
        .from("garments")
        .select("id, title, category, subcategory, color_primary, color_secondary, pattern, material, fit, formality, season_tags, wear_count, last_worn_at, image_path, created_at, enrichment_status, ai_raw")
        .eq("user_id", userId)
        .eq("in_laundry", false)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true }),
      supabase.from("profiles").select("preferences, height_cm, weight_kg").eq("id", userId).single(),
      serviceSupabase
        .from("outfit_items")
        .select("outfit_id, garment_id, outfits!inner(user_id, generated_at)")
        .eq("outfits.user_id", userId)
        .order("outfits(generated_at)", { ascending: false })
        .limit(50),
      // Fetch outfits with ratings/feedback for learning (include generated_at for decay)
      supabase
        .from("outfits")
        .select("id, rating, feedback, weather, generated_at")
        .eq("user_id", userId)
        .not("rating", "is", null)
        .order("generated_at", { ascending: false })
        .limit(30),
      // Fetch wear logs for pattern analysis + social context (last 6 months)
      supabase
        .from("wear_logs")
        .select("garment_id, worn_at, occasion, event_title")
        .eq("user_id", userId)
        .gte("worn_at", new Date(Date.now() - 180 * 86400000).toISOString().split("T")[0])
        .order("worn_at", { ascending: false })
        .limit(500),
      // Count garments currently in laundry (Step 14: Laundry Cycle)
      supabase
        .from("garments")
        .select("id, title, category", { count: "exact", head: false })
        .eq("user_id", userId)
        .eq("in_laundry", true),
      // Fetch pair memory for learned pairing preferences
      supabase
        .from("garment_pair_memory")
        .select("garment_a_id, garment_b_id, positive_count, negative_count, last_positive_at, last_negative_at")
        .eq("user_id", userId)
        .limit(500),
      // Fetch implicit feedback signals (Task 15)
      supabase
        .from("feedback_signals")
        .select("signal_type, outfit_id, garment_id, value, metadata, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200),
      // IB-5b: Planned-but-not-worn outfits (negative signal)
      supabase
        .from("planned_outfits")
        .select("outfit_id, date")
        .eq("user_id", userId)
        .eq("status", "planned")
        .lt("date", new Date().toISOString().split("T")[0])
        .order("date", { ascending: false })
        .limit(30),
    ]);

    if (garmentsRawRes.error) throw garmentsRawRes.error;
    // `garments` is reassigned later to drop never_suggest_garment hard-skips.
    // Wave 8.5 P88 — see hardSkipGarmentIds filter further down.
    let garments = (garmentsRawRes.data || []).map(hydrateEnrichment) as GarmentRow[];
    const activeLookSlotMap = buildActiveLookSlotMap(garments, activeLookGarmentIds);

    if (garments.length < 3) {
      return new Response(
        JSON.stringify({ error: "You need at least 3 garments to generate an outfit" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Step 14: Laundry cycle info
    const laundryItems = (laundryCountRes.data || []) as { id: string; title: string; category: string }[];
    const laundryCount = laundryItems.length;

    const preferences = (profileRes.data?.preferences as Record<string, any>) || null;
    const bodyProfile = buildBodyProfile(profileRes.data);

    // Build feedback penalties from historical ratings
    const feedbackSignals: FeedbackSignal[] = [];
    if (feedbackRes.data?.length) {
      const ratedOutfitIds = feedbackRes.data.map(o => o.id);
      // Fetch items for rated outfits
      const { data: ratedItems } = await serviceSupabase
        .from("outfit_items")
        .select("outfit_id, garment_id")
        .in("outfit_id", ratedOutfitIds);

      const itemsByOutfit = new Map<string, Set<string>>();
      for (const item of ratedItems || []) {
        if (!itemsByOutfit.has(item.outfit_id)) itemsByOutfit.set(item.outfit_id, new Set());
        itemsByOutfit.get(item.outfit_id)!.add(item.garment_id);
      }

      for (const outfit of feedbackRes.data) {
        feedbackSignals.push({
          garmentIds: itemsByOutfit.get(outfit.id) || new Set(),
          rating: outfit.rating,
          feedback: outfit.feedback,
          weather: outfit.weather as WeatherInput | null,
          generatedAt: (outfit as any).generated_at || null,
        });
      }
    }
    // ──────────────────────────────────────────────────────────────────
    // Wave 8.5 PR B (P88) — implicit feedback signal integration.
    //
    // Three audit-driven changes vs the legacy block:
    //
    //   1. Canonical normalization. Signals are normalized through
    //      `normalizeStyleMemorySignal` so legacy names ('save', 'swap',
    //      'reject', 'dislike', 'thumbs_down', 'ignore', 'wear_confirm',
    //      etc.) and canonical names emit identical scoring contributions
    //      during the rollout window. Audit P88 P1 #3.
    //
    //   2. D1 disambiguation. `reject_outfit` is OUTFIT-LEVEL — penalize
    //      every garment in that outfit (mild negative). Garment-level
    //      hard rejection now lives ONLY in `never_suggest_garment`,
    //      which is applied as a hard-skip filter on the candidate pool
    //      before scoring (see further down).
    //
    //   3. N+1 fix. Build the outfit_id → Set<garment_id> map ONCE before
    //      iterating signals, instead of an inner-loop scan per signal.
    //      Audit P88 P1 #1.
    //
    // ──────────────────────────────────────────────────────────────────

    // Step 2.x precompute: outfit_id → Set<garment_id>. The same map is
    // also re-used by the re-scoring pass below, replacing the duplicate
    // build at lines 1080-1084 of the legacy code.
    const outfitItemsByOutfitId = new Map<string, Set<string>>();
    for (const item of recentOutfitsRes.data || []) {
      let bucket = outfitItemsByOutfitId.get(item.outfit_id);
      if (!bucket) {
        bucket = new Set<string>();
        outfitItemsByOutfitId.set(item.outfit_id, bucket);
      }
      bucket.add(item.garment_id);
    }

    const implicitSignals = (feedbackSignalsRes.data || []) as {
      signal_type: string; outfit_id: string | null; garment_id: string | null;
      value: string | null; metadata: Record<string, any> | null; created_at: string;
    }[];

    // Garments to hard-skip from candidate scoring. Populated below from
    // canonical `never_suggest_garment` signals; filter applied to
    // `garments` after this loop.
    const hardSkipGarmentIds = new Set<string>();

    for (const rawSig of implicitSignals) {
      const canonical = normalizeStyleMemorySignal(rawSig.signal_type);
      if (!canonical) continue; // unknown / dead enum — skip

      if (canonical === 'never_suggest_garment' && rawSig.garment_id) {
        // Garment-level hard skip — drops the garment from candidate pool
        // entirely. No scoring contribution; the absence is the signal.
        hardSkipGarmentIds.add(rawSig.garment_id);
        continue;
      }

      // Resolve the affected garment set. Outfit-level signals expand to
      // the outfit's garments (via the precomputed map); garment-level
      // signals use the single `garment_id`.
      let affected: Set<string> | null = null;
      if (rawSig.outfit_id) {
        affected = outfitItemsByOutfitId.get(rawSig.outfit_id) ?? null;
      } else if (rawSig.garment_id) {
        affected = new Set([rawSig.garment_id]);
      }
      if (!affected || affected.size === 0) continue;

      switch (canonical) {
        case 'quick_reaction': {
          if (!rawSig.value) break; // value required for polarity
          feedbackSignals.push({
            garmentIds: affected,
            rating: null,
            feedback: [rawSig.value],
            weather: null,
            generatedAt: rawSig.created_at,
          });
          break;
        }
        case 'save_outfit': {
          // IB-5b: Save = mild positive (1x weight, 3.5 rating vs wore=5).
          feedbackSignals.push({
            garmentIds: affected,
            rating: 3.5,
            feedback: null,
            weather: null,
            generatedAt: rawSig.created_at,
          });
          break;
        }
        case 'reject_outfit': {
          // D1: outfit-level rejection — soft penalty across every garment
          // in the outfit. Single-garment garment_id-only rejections are
          // intentionally dropped (those should be `never_suggest_garment`).
          feedbackSignals.push({
            garmentIds: affected,
            rating: 2.5, // mild-to-moderate negative — affects combo score
            feedback: rawSig.value ? [rawSig.value] : null,
            weather: null,
            generatedAt: rawSig.created_at,
          });
          break;
        }
        case 'swap_garment': {
          // The swapped-OUT garment is a mild negative; penalize the
          // garment(s) in `removed_garment_ids` if metadata carries them,
          // else fall back to the legacy `garment_id` field.
          const removed = Array.isArray((rawSig.metadata as any)?.removed_garment_ids)
            ? ((rawSig.metadata as any).removed_garment_ids as unknown[]).filter((x) => typeof x === 'string') as string[]
            : rawSig.garment_id
              ? [rawSig.garment_id]
              : [];
          if (removed.length > 0) {
            feedbackSignals.push({
              garmentIds: new Set(removed),
              rating: 2.5,
              feedback: null,
              weather: null,
              generatedAt: rawSig.created_at,
            });
          }
          break;
        }
        case 'skip_outfit': {
          // IB-5a: Ignored / skipped — mild negative for all garments.
          feedbackSignals.push({
            garmentIds: affected,
            rating: 2.5,
            feedback: null,
            weather: null,
            generatedAt: rawSig.created_at,
          });
          break;
        }
        case 'rate_outfit': {
          if (typeof rawSig.value === 'string') {
            const numeric = Number.parseInt(rawSig.value, 10);
            if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 5) {
              feedbackSignals.push({
                garmentIds: affected,
                rating: numeric,
                feedback: null,
                weather: null,
                generatedAt: rawSig.created_at,
              });
            }
          } else if (typeof (rawSig as unknown as { rating?: unknown }).rating === 'number') {
            const numeric = (rawSig as unknown as { rating: number }).rating;
            if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 5) {
              feedbackSignals.push({
                garmentIds: affected,
                rating: numeric,
                feedback: null,
                weather: null,
                generatedAt: rawSig.created_at,
              });
            }
          }
          break;
        }
        case 'wear_outfit': {
          // wear_logs already inject these as rating=5 below; skip the
          // signal-channel duplicate to avoid double-counting.
          break;
        }
        // unsave_outfit, like_pair, dislike_pair: covered by pair_memory.
        default:
          break;
      }
    }

    // IB-5b: "Wore it" = 3x stronger signal than "saved it"
    // Inject wear logs as strong positive signals
    for (const wearLog of (wearLogsRes.data || []) as WearLog[]) {
      feedbackSignals.push({
        garmentIds: new Set([wearLog.garment_id]),
        rating: 5, // max positive (3x the weight of save's 3.5 after decay)
        feedback: ['loved_it'],
        weather: null,
        generatedAt: wearLog.worn_at,
      });
    }

    // IB-5b: Planned-but-not-worn = negative signal
    const plannedNotWorn = (plannedNotWornRes.data || []) as { outfit_id: string | null; date: string }[];
    for (const planned of plannedNotWorn) {
      if (!planned.outfit_id) continue;
      // Wave 8.5 P88 audit fix: reuse the precomputed outfitItemsByOutfitId
      // map instead of an inner-loop scan (was N+1 — see legacy block).
      const outfitGarments = outfitItemsByOutfitId.get(planned.outfit_id) ?? new Set<string>();
      if (outfitGarments.size > 0) {
        feedbackSignals.push({
          garmentIds: outfitGarments,
          rating: 2, // negative: planned but skipped
          feedback: null,
          weather: null,
          generatedAt: planned.date,
        });
      }
    }

    // Wave 8.5 PR B (P88) — load persistent style summary + hard-skip filter.
    //
    // The summary is loaded lazily via `loadOrBuildSummary`: cache hit on a
    // fresh row, or deterministic build on miss/stale. Build cost is logged
    // for observability (see `[summary-loader] lazy_build` in Supabase logs).
    // Failure returns `null` — engine falls back to non-summary scoring,
    // which is correct (hard rules still apply).
    //
    // Hard-skip: `summary.summary_json.never_suggest_garments` carries the
    // canonical garment-level exclusion list. Combined with this request's
    // `hardSkipGarmentIds` (from raw signals processed above), we drop the
    // candidates from `garments` BEFORE scoring. The set keys are garment
    // ids, so the filter is O(N).
    let summary: UserStyleSummaryRow | null = null;
    try {
      summary = await loadOrBuildSummary(serviceSupabase, userId, () =>
        loadStandardSummaryInputs(serviceSupabase, userId),
      );
      if (summary?.summary_json?.never_suggest_garments) {
        for (const id of summary.summary_json.never_suggest_garments) {
          if (typeof id === 'string') hardSkipGarmentIds.add(id);
        }
      }
    } catch (err) {
      console.error('[burs_style_engine] summary load failed', err);
    }

    if (hardSkipGarmentIds.size > 0) {
      const beforeCount = garments.length;
      garments = garments.filter((g) => !hardSkipGarmentIds.has(g.id));
      const droppedCount = beforeCount - garments.length;
      if (droppedCount > 0) {
        console.log(
          '[burs_style_engine] hard_skip_applied',
          JSON.stringify({
            user_id: userId,
            dropped: droppedCount,
            remaining: garments.length,
          }),
        );
      }
    }

    const penalties = buildFeedbackPenalties(feedbackSignals);

    // Build pair memory from DB
    const pairMemory = buildPairMemoryMap((pairMemoryRes.data || []) as PairMemoryRow[]);

    // Build wear pattern profile and style vector from historical wear logs
    const wearLogs = (wearLogsRes.data || []) as WearLog[];
    const wearPatterns = wearLogs.length > 0
      ? buildWearPatternProfile(wearLogs, garments)
      : null;
    const styleVector = wearLogs.length >= 5
      ? buildStyleVector(wearLogs, garments)
      : null;
    const comfortProfile = wearLogs.length >= 5
      ? buildComfortStyleProfile(wearLogs, garments, feedbackSignals)
      : null;
    // Build social context map for recurring event awareness
    const socialMap = wearLogs.length > 0 ? buildSocialContextMap(wearLogs) : null;
    // Seasonal transition info
    const transInfo = getSeasonTransitionInfo();
    // IB-5c: Personal uniform detection
    const personalUniform = wearLogs.length >= 15 ? buildPersonalUniform(wearLogs, garments) : null;

    // Build recent outfit sets for anti-repetition.
    // Wave 8.5 P88 audit fix: reuse the precomputed outfitItemsByOutfitId
    // map (was duplicated work — see legacy block above).
    const recentOutfitSets: Set<string>[] = [];
    for (const [, ids] of Array.from(outfitItemsByOutfitId.entries()).slice(0, 10)) {
      recentOutfitSets.push(ids);
    }

    // ── SWAP MODE ──
    if (mode === "swap" && swapSlot && currentGarmentId) {
      const garmentMap = new Map(garments.map(g => [g.id, g]));
      const otherItems = (otherItemsRaw || [])
        .map(i => ({ slot: i.slot, garment: garmentMap.get(i.garment_id)! }))
        .filter(i => i.garment);

      const candidates = scoreSwapCandidates(
        swapSlot, currentGarmentId, otherItems, garments, occasion, weather, penalties, preferences, swapMode, pairMemory
      );

      const swapConf = computeSwapConfidence(candidates, swapSlot, weather);
      log.info("request.complete", {
        requestId,
        userId,
        stage: "swap_complete",
        durationMs: Date.now() - requestStartedAt,
        candidateCount: candidates.length,
        requestedEditSlots: Array.from(requestedEditSlots),
      });

      return new Response(JSON.stringify({
        candidates: candidates.slice(0, 10).map(c => ({
          garment: c.garment,
          score: c.score,
          breakdown: c.breakdown,
          swap_reason: (c as any).swap_reason || null,
        })),
        confidence_score: swapConf.confidence_score,
        confidence_level: swapConf.confidence_level,
        limitation_note: swapConf.limitation_note,
      }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }

    // ── PLAN_WEEK MODE ──
    if (mode === "plan_week") {
      const days: { occasion: string; weather: WeatherInput; date: string; event_title?: string }[] = body.days || [];
      if (days.length === 0) {
        return new Response(JSON.stringify({ error: "No days provided" }), {
          status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // Hero slots: repetition penalty is heavy for tops, dresses, outerwear. Light for shoes, accessories.
      const HERO_SLOTS = new Set(["top", "bottom", "dress", "outerwear"]);
      const usedHeroGarments = new Map<string, number>(); // garment_id → last used day index
      const usedGarmentSets: Set<string>[] = []; // for anti-repetition across days
      const results: any[] = [];

      // Track formality targets per day to ensure variation
      const formalityTargets: number[] = [];

      for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
        const day = days[dayIdx];
        const dayWeather: WeatherInput = {
          temperature: typeof day.weather?.temperature === 'number' ? day.weather.temperature : weather.temperature,
          precipitation: day.weather?.precipitation || 'none',
          wind: day.weather?.wind || 'low',
        };
        const dayOccasion = day.occasion || "vardag";
        const dayEventTitle = day.event_title || effectiveEventTitle;

        // Score all garments for this day
        const daySlotCandidates: Record<string, ScoredGarment[]> = {};
        for (const garment of garments) {
          const slot = categorizeSlot(garment.category, garment.subcategory);
          if (!slot) continue;
          if (!daySlotCandidates[slot]) daySlotCandidates[slot] = [];

          const scored = scoreGarment(garment, dayOccasion, dayWeather, penalties, preferences, wearPatterns, styleVector, comfortProfile, socialMap, dayEventTitle, transInfo, personalUniform);

          // Inter-day repetition penalty for hero garments
          if (HERO_SLOTS.has(slot) && usedHeroGarments.has(garment.id)) {
            const lastUsedDay = usedHeroGarments.get(garment.id)!;
            const dayGap = dayIdx - lastUsedDay;
            if (dayGap <= 1) scored.score -= 4;       // consecutive day: heavy penalty
            else if (dayGap <= 2) scored.score -= 2;   // 2 days apart: moderate
            else if (dayGap <= 3) scored.score -= 0.5; // 3 days: light
          }

          // Formality variation: if previous days cluster around similar formality, push away
          if (formalityTargets.length >= 2) {
            const recentFormalities = formalityTargets.slice(-2);
            const avgRecent = recentFormalities.reduce((a, b) => a + b, 0) / recentFormalities.length;
            const gFormality = garment.formality ?? 3;
            const [fMin, fMax] = getFormalityRange(dayOccasion);
            // If garment diverges from recent average while staying in range → boost
            if (Math.abs(gFormality - avgRecent) >= 1.5 && gFormality >= fMin && gFormality <= fMax) {
              scored.score += 0.8;
            }
          }

          daySlotCandidates[slot].push(scored);
        }

        // Sort each slot by score
        for (const slot of Object.keys(daySlotCandidates)) {
          daySlotCandidates[slot].sort((a, b) => b.score - a.score);
        }

        // Include previous days' outfits in anti-repetition sets
        const allRecentSets = [...recentOutfitSets, ...usedGarmentSets];

        // Build combos for this day
        const dayCombos = buildCombos(daySlotCandidates, allRecentSets, dayOccasion, style, dayWeather, preferences, 5, bodyProfile, pairMemory);

        if (dayCombos.length === 0) {
          // No valid combos for this day
          results.push({
            date: day.date,
            occasion: dayOccasion,
            error: "Could not generate an outfit for this day",
            items: null,
            backup: null,
          });
          continue;
        }

        // Best combo = primary, second = backup
        const bestCombo = dayCombos[0];
        const backupCombo = dayCombos.length > 1 ? dayCombos[1] : null;

        // Track used hero garments
        const usedThisDay = new Set<string>();
        for (const item of bestCombo.items) {
          usedThisDay.add(item.garment.id);
          if (HERO_SLOTS.has(item.slot)) {
            usedHeroGarments.set(item.garment.id, dayIdx);
          }
        }
        usedGarmentSets.push(usedThisDay);

        // Track formality for variation
        const dayFormalities = bestCombo.items
          .map(i => i.garment.formality)
          .filter((v): v is number => typeof v === 'number');
        if (dayFormalities.length > 0) {
          formalityTargets.push(dayFormalities.reduce((a, b) => a + b, 0) / dayFormalities.length);
        }

        const confidence = computeConfidence(bestCombo, dayCombos.length, daySlotCandidates, dayWeather, dayOccasion);
        const dc = bestCombo as DeduplicatedCombo;

        results.push({
          date: day.date,
          occasion: dayOccasion,
          items: bestCombo.items.map(i => ({ slot: i.slot, garment_id: i.garment.id })),
          explanation: "",
          style_score: bestCombo.breakdown,
          confidence_score: confidence.confidence_score,
          confidence_level: confidence.confidence_level,
          family_label: dc.family_label || 'classic',
          backup: backupCombo ? {
            items: backupCombo.items.map(i => ({ slot: i.slot, garment_id: i.garment.id })),
            style_score: backupCombo.breakdown,
            family_label: (backupCombo as DeduplicatedCombo).family_label || 'classic',
          } : null,
        });
      }

      // Laundry info
      const planLaundryItems = (laundryCountRes.data || []) as { id: string; title: string; category: string }[];
      const planLaundryCount = planLaundryItems.length;

      log.info("request.complete", {
        requestId,
        userId,
        stage: "plan_week_complete",
        durationMs: Date.now() - requestStartedAt,
        dayCount: results.length,
      });

      return new Response(JSON.stringify({
        days: results,
        laundry: planLaundryCount > 0 ? {
          count: planLaundryCount,
          items: planLaundryItems.slice(0, 5).map(i => ({ id: i.id, title: i.title, category: i.category })),
          warning: planLaundryCount >= 5 ? "Several items are in the laundry — this may limit variety across the week." : null,
        } : undefined,
      }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }

    // ── GENERATE / SUGGEST MODE ──

    // Phase 0 — variety. Load the user's last RECENT_SUGGESTION_WINDOW
    // *shown* outfits (not just saved ones). The recency map maps each
    // garment_id to the smallest rank it appears at in those entries (rank
    // 1 = most recent). `recentSuggestionPenalty` then softly down-weights
    // garments shown in the last few generates, so a repeated tap on
    // "Generate" rotates the wardrobe instead of returning the same look.
    // A failure here must not break generation — empty map = no penalty,
    // same behavior as today.
    const recencyMap = new Map<string, number>();
    try {
      const { data: recentLog } = await serviceSupabase
        .from("style_engine_suggestion_log")
        .select("outfit_hash")
        .eq("user_id", userId)
        .order("generated_at", { ascending: false })
        .limit(RECENT_SUGGESTION_WINDOW);
      if (recentLog) {
        for (let i = 0; i < recentLog.length; i++) {
          const hash = (recentLog[i] as { outfit_hash: string }).outfit_hash || "";
          if (!hash) continue;
          const rank = i + 1;
          for (const id of hash.split("|")) {
            if (!id) continue;
            const existing = recencyMap.get(id);
            if (existing === undefined || existing > rank) {
              recencyMap.set(id, rank);
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to load recency map; continuing without variety penalty", e);
    }

    // Score all garments per slot
    const slotCandidates: Record<string, ScoredGarment[]> = {};
    for (const garment of garments) {
      if (excludeGarmentIds.has(garment.id)) continue;
      const slot = categorizeSlot(garment.category, garment.subcategory);
      if (!slot) continue;
      if (!slotCandidates[slot]) slotCandidates[slot] = [];
      const scored = scoreGarment(garment, occasion, weather, penalties, preferences, wearPatterns, styleVector, comfortProfile, socialMap, effectiveEventTitle, transInfo, personalUniform);
      // Phase 0 — variety. Soft adjustment based on how recently this
      // garment was shown to the user. Magnitude is small (max ~15% of a
      // typical score) so it rotates the wardrobe without overriding a
      // clearly-better candidate.
      scored.score += recentSuggestionPenalty(garment.id, recencyMap);
      // Boost preferred (unused) garments
      if (preferGarmentIds.size > 0 && preferGarmentIds.has(garment.id)) {
        scored.score += 2.5;
      }
      slotCandidates[slot].push(scored);
    }

    // Sort each slot by score
    for (const slot of Object.keys(slotCandidates)) {
      slotCandidates[slot].sort((a, b) => b.score - a.score);
    }

    // Build combos
    const combos = buildCombos(slotCandidates, recentOutfitSets, occasion, style, weather, preferences, 10, bodyProfile, pairMemory);

    let activeCombos = combos;
    let fallbackLevel = 1;

    if (activeCombos.length === 0) {
      const fallback = buildFallbackCombos(slotCandidates, recentOutfitSets, occasion, style, weather, preferences, 5, bodyProfile, pairMemory);
      activeCombos = fallback.combos;
      fallbackLevel = fallback.fallbackLevel;
    }

    if (preferGarmentIds.size > 0) {
      let preferredCombos = filterCombosByPreferredGarment(activeCombos, preferGarmentIds);

      if (preferredCombos.length === 0) {
        const preferredFallback = buildFallbackCombos(slotCandidates, recentOutfitSets, occasion, style, weather, preferences, 5, bodyProfile, pairMemory);
        preferredCombos = filterCombosByPreferredGarment(preferredFallback.combos, preferGarmentIds);
        if (preferredCombos.length > 0) {
          fallbackLevel = preferredFallback.fallbackLevel;
        }
      }

      activeCombos = preferredCombos;
    }

    if (activeLookSlotMap.size > 0) {
      activeCombos = rankCombosForRefinement(activeCombos, {
        activeLookSlotMap,
        lockedGarmentIds,
        requestedEditSlots,
      });
    }

    if (activeCombos.length === 0) {
      if (preferGarmentIds.size > 0) {
        const preferredGarmentFailure = "Could not create a complete outfit around the selected garment. Try another piece or adjust the occasion.";
        return new Response(
          JSON.stringify({
            error: preferredGarmentFailure,
            limitation_note: preferredGarmentFailure,
          }),
          { status: 422, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
      // Truly nothing — only reaches here if user has < 2 garments
      const gaps = detectWardrobeGapForRequest(slotCandidates, weather, occasion);
      const failure = buildIncompleteOutfitFailure(weather, occasion, slotCandidates);
      const note = [failure.limitation_note, ...gaps.slice(0, 2)].filter(Boolean).join('; ') || null;
      return new Response(
        JSON.stringify({
          error: failure.error,
          limitation_note: note,
          missing_slots: failure.missing_slots,
          available_slots: failure.available_slots,
        }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Confidence scoring + wardrobe gap detection
    const bestCombo = activeCombos[0];
    const candidateCount = activeCombos.length;
    const gaps = detectWardrobeGapForRequest(slotCandidates, weather, occasion);

    // Layering validation on best combo
    const bestLayering = validateLayeringCompleteness(bestCombo.items);

    // Occasion sub-mode resolution
    const occasionSubmode = resolveOccasionSubmode(occasion, preferences, styleVector);

    // Gap-aware confidence
    const confidence = computeConfidence(bestCombo, candidateCount, slotCandidates, weather, occasion, gaps, bestLayering.needs_base_layer);
    const limitationNote = buildBaseGenerationLimitationNote(bestCombo, weather, gaps, confidence);

    // Build generation failure signal for insight derivation
    const failureSignal = buildGenerationFailureSignal(occasion, weather, gaps, confidence, slotCandidates);
    const wardrobeInsights = deriveWardrobeInsightsFromGeneration([failureSignal]);

    const styleContext = buildStyleContext(preferences);

    // AI refinement — stylist mode gets richer prompting
    const isStylistMode = generatorMode === "stylist" || mode === "stylist";
    const aiMode = mode === "suggest" ? "suggest" : "generate";
    const aiResult = await aiRefine(
      activeCombos, aiMode, occasion, style, weather, styleContext, locale, isStylistMode,
      occasionSubmode, { needs_base_layer: bestLayering.needs_base_layer }, dayContext,
      serviceClient, regenerateToken,
    );

    if (aiResult.error) {
      if (aiResult.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests, please try again." }), {
          status: 429, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      if (aiResult.status === 402) {
        return new Response(JSON.stringify({ error: "AI-krediter slut." }), {
          status: 402, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      // Fallback: use best scoring combo without AI explanation
      console.warn("AI refinement failed, using deterministic fallback");
      const best = activeCombos[0];
      if (aiMode === "suggest") {
        const suggestions = activeCombos.slice(0, 3).map((c, i) => {
          const dc = c as DeduplicatedCombo;
          return {
            title: `Outfit ${i + 1}`,
            garment_ids: c.items.map(item => item.garment.id),
            garments: c.items.map(item => item.garment),
            explanation: "",
            occasion,
            family_label: dc.family_label || 'classic',
            variation_reason: dc.variation_reason || '',
          };
        });
        return new Response(JSON.stringify({ suggestions }), {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const fallbackLayering = validateLayeringCompleteness(best.items);
      // Phase 0 — variety. Mirror the AI-path log write so the next
      // generate's recency map sees this outfit too. Without it, a
      // user hitting the deterministic fallback (AI 5xx) would see the
      // same `activeCombos[0]` returned again on the next tap. Best-effort.
      try {
        const bestHash = best.items.map(i => i.garment.id).sort().join("|");
        await serviceSupabase
          .from("style_engine_suggestion_log")
          .insert({ user_id: userId, outfit_hash: bestHash, occasion });
      } catch (logErr) {
        console.warn("Failed to log fallback style engine suggestion", logErr);
      }
      return new Response(JSON.stringify({
        // Title enrichment matches the AI-refinement path below — keep
        // mobile's `EngineResponseItem.title` populated even on the
        // deterministic fallback.
        items: best.items.map(i => ({
          slot: i.slot,
          garment_id: i.garment.id,
          title: i.garment.title || i.garment.category || i.garment.id,
        })),
        explanation: "",
        style_score: best.breakdown,
        layer_order: fallbackLayering.layer_order,
        needs_base_layer: fallbackLayering.needs_base_layer,
        occasion_submode: occasionSubmode,
      }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }

    // ── FORMAT RESPONSE ──

    if (aiMode === "generate") {
      let chosenIdx = Math.min(aiResult.data.chosen_index || 0, activeCombos.length - 1);
      // Validate chosen combo is complete; fall back to first complete one
      let chosen = activeCombos[chosenIdx];
      {
        const { complete } = isCompleteOutfit(chosen.items, weather, 'strict_visible');
        if (!complete) {
          const fallbackIdx = activeCombos.findIndex(c => isCompleteOutfit(c.items, weather, 'strict_visible').complete);
          if (fallbackIdx >= 0) {
            chosenIdx = fallbackIdx;
            chosen = activeCombos[chosenIdx];
          }
        }
      }

      // Refinement guard: if the chosen outfit is identical to the active look, force a swap
      if (activeLookGarmentIds.length >= 2) {
        const chosenIds = chosen.items.map(i => i.garment.id);
        if (isSameOutfit(chosenIds, activeLookGarmentIds)) {
          const altIdx = activeCombos.findIndex((c, idx) => {
            if (idx === chosenIdx) return false;
            const { complete } = isCompleteOutfit(c.items, weather, 'strict_visible');
            return complete && !isSameOutfit(c.items.map(i => i.garment.id), activeLookGarmentIds);
          });
          if (altIdx >= 0) {
            chosenIdx = altIdx;
            chosen = activeCombos[altIdx];
            console.warn("Refinement guard: chosen outfit was identical to active look, swapped to alt combo", altIdx);
          }
        }
      }

      // Build refinement delta when active look is present
      let refinementDelta: { kept: string[]; swapped: { from: string; to: string }[] } | undefined;
      if (activeLookGarmentIds.length >= 2) {
        const chosenIds = new Set(chosen.items.map(i => i.garment.id));
        const prevSet = new Set(activeLookGarmentIds);
        const garmentMap = new Map(garments.map(g => [g.id, g.title || g.category || g.id]));
        const kept = activeLookGarmentIds.filter(id => chosenIds.has(id)).map(id => garmentMap.get(id) || id);
        const removed = activeLookGarmentIds.filter(id => !chosenIds.has(id));
        const added = chosen.items.filter(i => !prevSet.has(i.garment.id));
        const swapped = removed.map((rid, idx) => ({
          from: garmentMap.get(rid) || rid,
          to: idx < added.length ? (added[idx].garment.title || added[idx].garment.category || added[idx].garment.id) : "new piece",
        }));
        if (kept.length > 0 || swapped.length > 0) {
          refinementDelta = { kept, swapped };
        }
      }

      const dc = chosen as DeduplicatedCombo;
      const chosenLayering = validateLayeringCompleteness(chosen.items);
      const chosenConf = computeConfidence(chosen, candidateCount, slotCandidates, weather, occasion, gaps, chosenLayering.needs_base_layer);
      const chosenNote = buildBaseGenerationLimitationNote(chosen, weather, gaps, chosenConf);

      // Phase 0 — variety. Log the chosen outfit's item-set hash so the next
      // generate can dedup against it. Hash is sorted garment ids joined
      // with `|` so the same set is identical regardless of insertion order.
      // `low_variety` flips when at least half of the chosen items appeared
      // in the user's last 3 generates — a signal to the mobile UI that the
      // wardrobe is too thin to rotate further. The insert is best-effort:
      // a logging failure must not turn a successful generate into a 500.
      const chosenIds = chosen.items.map((i) => i.garment.id);
      const outfitHash = [...chosenIds].sort().join("|");
      let lowVariety = false;
      if (recencyMap.size > 0 && chosenIds.length > 0) {
        const recentRepeatCount = chosenIds.filter((id) => {
          const rank = recencyMap.get(id);
          return rank !== undefined && rank <= 3;
        }).length;
        lowVariety = recentRepeatCount >= Math.ceil(chosenIds.length / 2);
      }
      try {
        await serviceSupabase
          .from("style_engine_suggestion_log")
          .insert({
            user_id: userId,
            outfit_hash: outfitHash,
            occasion,
          });
      } catch (logErr) {
        console.warn("Failed to log style engine suggestion", logErr);
      }

      log.info("request.complete", {
        requestId,
        userId,
        stage: "generate_complete",
        durationMs: Date.now() - requestStartedAt,
        candidateCount,
        fallbackLevel,
        lockedCount: lockedGarmentIds.size,
        requestedEditSlots: Array.from(requestedEditSlots),
        degraded: Boolean(chosenNote),
        lowVariety,
        regenerate: Boolean(regenerateToken),
      });
      return new Response(JSON.stringify({
        // Include `title` so mobile's `EngineResponseItem.title` (and
        // `adaptItems` which defaults to '') renders the actual piece name
        // rather than a blank label. Mirrors the title field already
        // surfaced in `laundry.items` and `refinementDelta.swapped`.
        items: chosen.items.map(i => ({
          slot: i.slot,
          garment_id: i.garment.id,
          title: i.garment.title || i.garment.category || i.garment.id,
        })),
        explanation: aiResult.data.explanation || "",
        style_score: chosen.breakdown,
        family_label: dc.family_label || 'classic',
        confidence_score: chosenConf.confidence_score,
        confidence_level: chosenConf.confidence_level,
        limitation_note: chosenNote,
        layer_order: chosenLayering.layer_order,
        needs_base_layer: chosenLayering.needs_base_layer,
        occasion_submode: occasionSubmode,
        laundry: laundryCount > 0 ? { count: laundryCount, items: laundryItems.slice(0, 5).map(i => ({ id: i.id, title: i.title, category: i.category })) } : undefined,
        wardrobe_insights: wardrobeInsights.length > 0 ? wardrobeInsights : undefined,
        refinement_delta: refinementDelta,
        low_variety: lowVariety || undefined,
      }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }

    // Suggest mode
    const suggestions = (aiResult.data.suggestions || []).flatMap((s: any) => {
      const idx = Math.min(s.combo_index || 0, activeCombos.length - 1);
      const combo = activeCombos[idx];
      const { complete } = isCompleteOutfit(combo.items, weather, 'strict_visible');
      if (!complete) return [];
      const dc = combo as DeduplicatedCombo;
      const sConf = computeConfidence(combo, candidateCount, slotCandidates, weather, occasion);
      const sNote = generateLimitationNote(gaps, sConf);
      return [{
        title: s.title,
        garment_ids: combo.items.map((i: any) => i.garment.id),
        garments: combo.items.map((i: any) => i.garment),
        explanation: s.explanation,
        occasion: s.occasion,
        family_label: dc.family_label || 'classic',
        variation_reason: dc.variation_reason || '',
        confidence_score: sConf.confidence_score,
        confidence_level: sConf.confidence_level,
        limitation_note: sNote,
      }];
    });

    if (!suggestions.length) {
      // Fallback: return top 3 combos directly rather than 422
      const fallbackSuggestions = activeCombos.slice(0, 3).map((c, i) => {
        const dc = c as DeduplicatedCombo;
        const sConf = computeConfidence(c, candidateCount, slotCandidates, weather, occasion);
        return {
          title: `Outfit ${i + 1}`,
          garment_ids: c.items.map(item => item.garment.id),
          garments: c.items.map(item => item.garment),
          explanation: "",
          occasion,
          family_label: dc.family_label || 'classic',
          variation_reason: dc.variation_reason || '',
          confidence_score: sConf.confidence_score,
          confidence_level: sConf.confidence_level,
          limitation_note: null,
        };
      });
      if (fallbackSuggestions.length > 0) {
        return new Response(JSON.stringify({
          suggestions: fallbackSuggestions,
          confidence_score: confidence.confidence_score,
          confidence_level: confidence.confidence_level,
          limitation_note: limitationNote,
          wardrobe_insights: wardrobeInsights.length > 0 ? wardrobeInsights : undefined,
        }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
      }
      // Only 422 if we truly have no combos at all
      return new Response(JSON.stringify(buildIncompleteOutfitFailure(weather, occasion, slotCandidates)), {
        status: 422,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    log.info("request.complete", {
      requestId,
      userId,
      stage: "suggest_complete",
      durationMs: Date.now() - requestStartedAt,
      candidateCount,
      suggestionCount: suggestions.length,
      fallbackLevel,
      lockedCount: lockedGarmentIds.size,
      requestedEditSlots: Array.from(requestedEditSlots),
      degraded: Boolean(limitationNote),
    });

    return new Response(JSON.stringify({
      suggestions,
      confidence_score: confidence.confidence_score,
      confidence_level: confidence.confidence_level,
      limitation_note: limitationNote,
      wardrobe_insights: wardrobeInsights.length > 0 ? wardrobeInsights : undefined,
    }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });

  } catch (error) {
    if (error instanceof RateLimitError) {
      return rateLimitResponse(error, CORS_HEADERS);
    }
    recordError("burs_style_engine");
    log.exception("request.failed", error, {
      stage: "request_failed",
    });
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }
});
