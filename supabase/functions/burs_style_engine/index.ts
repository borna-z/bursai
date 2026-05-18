import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, estimateMaxTokens } from "../_shared/burs-ai.ts";

import { corsHeadersFor } from "../_shared/cors.ts";
// Wave S-A.2 (2026-05-15): garment-title sanitization happens inside the
// shared prompt-assembly module now (`_shared/outfit-ai-prompts.ts`); the
// orchestrator no longer imports `quoteUserField` directly.
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, recordError, overloadResponse, enforceSubscription, subscriptionLockedResponse } from "../_shared/scale-guard.ts";
import { normalizeSignalText } from "../_shared/style-signals.ts";
import { logger } from "../_shared/logger.ts";
import { getOrCreateRequestId } from "../_shared/request-id.ts";
// Wave 8.5 PR B (P88) — canonical signal normalization + style summary loader.
import { normalizeStyleMemorySignal } from "../_shared/style-memory-signals.ts";
import { loadOrBuildSummary, loadStandardSummaryInputs, type UserStyleSummaryRow } from "../_shared/summary-loader.ts";

import {
  // types
  type GarmentRow,
  type ScoredGarment,
  type WeatherInput,
  type DayContextInput,
  type WearLog,
  type PairMemoryRow,
  type FeedbackSignal,
  // scoring functions
  scoreGarment,
  buildFeedbackPenalties,
  buildPairMemoryMap,
  buildBodyProfile,
  hydrateEnrichment,
  categorizeSlot,
  isCompleteOutfit,
  buildActiveLookSlotMap,
  rankCombosForRefinement,
  buildIncompleteOutfitFailure,
  recordPairOutcome,
  mapDayOccasionToEngine,
  resolveOccasionSubmode,
  getFormalityRange,
  validateLayeringCompleteness,
  getStylePrefs,
  recentSuggestionPenalty,
  RECENT_SUGGESTION_WINDOW,
  isLowVariety,
} from "../_shared/outfit-scoring.ts";

import {
  type DeduplicatedCombo,
  buildCombos,
  buildFallbackCombos,
  filterCombosByPreferredGarment,
  detectWardrobeGapForRequest,
  buildGenerationFailureSignal,
  deriveWardrobeInsightsFromGeneration,
} from "../_shared/outfit-combination.ts";

import {
  computeConfidence,
  computeSwapConfidence,
  generateLimitationNote,
  buildBaseGenerationLimitationNote,
} from "../_shared/outfit-confidence.ts";

import { hashOutfit } from "../_shared/outfit-deduplication.ts";
import { captureError } from "../_shared/observability.ts";

// Phase 5d (2026-05-17): swap scoring, AI prompt assembly, and wear-context
// preprocessing all live in shared modules now. The orchestrator delegates
// and keeps the request handler focused on HTTP/auth/DB orchestration.
import { scoreSwapCandidates, type SwapMode } from "../_shared/outfit-swap.ts";
import { aiRefine } from "../_shared/outfit-ai-prompts.ts";
import { buildWearContext } from "../_shared/wear-context.ts";

const log = logger("burs_style_engine");

function createRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch (err) {
    captureError("burs_style_engine.request_id_uuid_failed", err);
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
// MAIN SERVER
// ─────────────────────────────────────────────

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;
    // Honor inbound `x-request-id` from mobile so the full
    // generate-flow trace correlates with the caller's log line.
    // Falls back to a fresh uuid for cron / internal hops.
    const requestId = getOrCreateRequestId(req) || createRequestId();
    // Shadow the module-level logger with one bound to this request — every
    // `log.info(...)` / `log.warn(...)` / `log.exception(...)` below carries
    // the same `request_id` for end-to-end correlation.
    const log = logger("burs_style_engine", requestId);
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Scale guard: rate limit expensive AI operations ──
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    if (checkOverload("burs_style_engine")) {
      return overloadResponse(corsHeaders);
    }
    await enforceRateLimit(serviceClient, userId, "burs_style_engine");

    // Wave 8 P54 — paywall gate.
    const subCheck = await enforceSubscription(serviceClient, userId);
    if (!subCheck.allowed) {
      return subscriptionLockedResponse(subCheck.reason, corsHeaders);
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
    // Phase 0 — variety. Mobile mints a UUID on each "Try again" tap.
    const regenerateToken: string | null =
      typeof body.regenerate_token === "string" && body.regenerate_token.length > 0
        ? body.regenerate_token
        : null;
    const requestedEditSlots: Set<string> = new Set(
      normalizeIdList(body.requested_edit_slots).map((slot) => normalizeSignalText(slot)),
    );

    log.info("request.start", {
      requestId, userId, stage: "request_received", mode, generatorMode,
      occasion, locale,
      preferCount: preferGarmentIds.size, excludeCount: excludeGarmentIds.size,
      activeLookCount: activeLookGarmentIds.length, lockedCount: lockedGarmentIds.size,
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
        .eq("user_id", userId).eq("in_laundry", false)
        .order("created_at", { ascending: false }).order("id", { ascending: true }),
      supabase.from("profiles").select("preferences, height_cm, weight_kg").eq("id", userId).single(),
      serviceSupabase
        .from("outfit_items")
        .select("outfit_id, garment_id, outfits!inner(user_id, generated_at)")
        .eq("outfits.user_id", userId)
        .order("outfits(generated_at)", { ascending: false }).limit(50),
      // Rated outfits (decay-aware), wear logs (6mo), laundry, pair memory,
      // implicit signals, planned-but-not-worn — all parallel.
      supabase
        .from("outfits")
        .select("id, rating, feedback, weather, generated_at")
        .eq("user_id", userId).not("rating", "is", null)
        .order("generated_at", { ascending: false }).limit(30),
      supabase
        .from("wear_logs")
        .select("garment_id, worn_at, occasion, event_title")
        .eq("user_id", userId)
        .gte("worn_at", new Date(Date.now() - 180 * 86400000).toISOString().split("T")[0])
        .order("worn_at", { ascending: false }).limit(500),
      supabase
        .from("garments")
        .select("id, title, category", { count: "exact", head: false })
        .eq("user_id", userId).eq("in_laundry", true),
      supabase
        .from("garment_pair_memory")
        .select("garment_a_id, garment_b_id, positive_count, negative_count, last_positive_at, last_negative_at")
        .eq("user_id", userId).limit(500),
      supabase
        .from("feedback_signals")
        .select("signal_type, outfit_id, garment_id, value, metadata, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(200),
      supabase
        .from("planned_outfits")
        .select("outfit_id, date")
        .eq("user_id", userId).eq("status", "planned")
        .lt("date", new Date().toISOString().split("T")[0])
        .order("date", { ascending: false }).limit(30),
    ]);

    if (garmentsRawRes.error) throw garmentsRawRes.error;
    // `garments` is reassigned later to drop never_suggest_garment hard-skips.
    // Wave 8.5 P88 — see hardSkipGarmentIds filter further down.
    let garments = (garmentsRawRes.data || []).map(hydrateEnrichment) as GarmentRow[];
    const activeLookSlotMap = buildActiveLookSlotMap(garments, activeLookGarmentIds);

    if (garments.length < 3) {
      return new Response(
        JSON.stringify({ error: "You need at least 3 garments to generate an outfit" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
    // Wave 8.5 PR B (P88) — implicit feedback signal integration.
    // Canonical normalization + D1 outfit/garment disambiguation + N+1 fix.
    // Pre-build outfit_id → Set<garment_id> for reuse in the scoring loop.
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
      if (!canonical) continue;

      if (canonical === 'never_suggest_garment' && rawSig.garment_id) {
        // Garment-level hard skip — drop from candidate pool entirely.
        hardSkipGarmentIds.add(rawSig.garment_id);
        continue;
      }

      // Resolve affected garment set (outfit-level expands via precomputed map).
      let affected: Set<string> | null = null;
      if (rawSig.outfit_id) {
        affected = outfitItemsByOutfitId.get(rawSig.outfit_id) ?? null;
      } else if (rawSig.garment_id) {
        affected = new Set([rawSig.garment_id]);
      }
      if (!affected || affected.size === 0) continue;

      switch (canonical) {
        case 'quick_reaction': {
          if (!rawSig.value) break;
          feedbackSignals.push({ garmentIds: affected, rating: null, feedback: [rawSig.value], weather: null, generatedAt: rawSig.created_at });
          break;
        }
        case 'save_outfit': {
          // IB-5b: Save = mild positive (3.5 rating, vs wore=5).
          feedbackSignals.push({ garmentIds: affected, rating: 3.5, feedback: null, weather: null, generatedAt: rawSig.created_at });
          break;
        }
        case 'reject_outfit': {
          // D1: outfit-level rejection → soft penalty across all garments.
          // Garment-level hard rejection lives ONLY in `never_suggest_garment`.
          feedbackSignals.push({ garmentIds: affected, rating: 2.5, feedback: rawSig.value ? [rawSig.value] : null, weather: null, generatedAt: rawSig.created_at });
          break;
        }
        case 'swap_garment': {
          // Penalize swapped-OUT garments — prefer metadata.removed_garment_ids,
          // else fall back to legacy garment_id field.
          const removed = Array.isArray((rawSig.metadata as any)?.removed_garment_ids)
            ? ((rawSig.metadata as any).removed_garment_ids as unknown[]).filter((x) => typeof x === 'string') as string[]
            : rawSig.garment_id ? [rawSig.garment_id] : [];
          if (removed.length > 0) {
            feedbackSignals.push({ garmentIds: new Set(removed), rating: 2.5, feedback: null, weather: null, generatedAt: rawSig.created_at });
          }
          break;
        }
        case 'skip_outfit': {
          // IB-5a: Ignored / skipped — mild negative for all garments.
          feedbackSignals.push({ garmentIds: affected, rating: 2.5, feedback: null, weather: null, generatedAt: rawSig.created_at });
          break;
        }
        case 'rate_outfit': {
          if (typeof rawSig.value === 'string') {
            const numeric = Number.parseInt(rawSig.value, 10);
            if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 5) {
              feedbackSignals.push({ garmentIds: affected, rating: numeric, feedback: null, weather: null, generatedAt: rawSig.created_at });
            }
          } else if (typeof (rawSig as unknown as { rating?: unknown }).rating === 'number') {
            const numeric = (rawSig as unknown as { rating: number }).rating;
            if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 5) {
              feedbackSignals.push({ garmentIds: affected, rating: numeric, feedback: null, weather: null, generatedAt: rawSig.created_at });
            }
          }
          break;
        }
        case 'wear_outfit':
          // wear_logs already inject these as rating=5 below; skip duplicate.
          break;
        // unsave_outfit, like_pair, dislike_pair: covered by pair_memory.
        default:
          break;
      }
    }

    // IB-5b: "Wore it" = 3x stronger signal than "saved it" (rating=5).
    for (const wearLog of (wearLogsRes.data || []) as WearLog[]) {
      feedbackSignals.push({
        garmentIds: new Set([wearLog.garment_id]),
        rating: 5,
        feedback: ['loved_it'],
        weather: null,
        generatedAt: wearLog.worn_at,
      });
    }

    // IB-5b: Planned-but-not-worn = negative signal. Reuse precomputed map.
    const plannedNotWorn = (plannedNotWornRes.data || []) as { outfit_id: string | null; date: string }[];
    for (const planned of plannedNotWorn) {
      if (!planned.outfit_id) continue;
      const outfitGarments = outfitItemsByOutfitId.get(planned.outfit_id) ?? new Set<string>();
      if (outfitGarments.size > 0) {
        feedbackSignals.push({ garmentIds: outfitGarments, rating: 2, feedback: null, weather: null, generatedAt: planned.date });
      }
    }

    // Wave 8.5 PR B (P88) — load persistent style summary + apply hard-skip
    // filter from canonical `never_suggest_garments` list before scoring.
    // Summary load failure returns null → engine falls back gracefully.
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
      log.exception('summary load failed', err);
    }

    if (hardSkipGarmentIds.size > 0) {
      const beforeCount = garments.length;
      garments = garments.filter((g) => !hardSkipGarmentIds.has(g.id));
      const droppedCount = beforeCount - garments.length;
      if (droppedCount > 0) {
        log.info('hard_skip_applied', {
          user_id: userId,
          dropped: droppedCount,
          remaining: garments.length,
        });
      }
    }

    const penalties = buildFeedbackPenalties(feedbackSignals);

    // Build pair memory from DB
    const pairMemory = buildPairMemoryMap((pairMemoryRes.data || []) as PairMemoryRow[]);

    // Phase 5d (2026-05-17): wear-context preprocessing moved to
    // `_shared/wear-context.ts` — pure transformation over preloaded rows,
    // including the feedback-aware comfort profile build.
    const wearLogs = (wearLogsRes.data || []) as WearLog[];
    const {
      wearPatterns,
      styleVector,
      socialMap,
      comfortProfile,
      personalUniform,
      transInfo,
    } = buildWearContext(wearLogs, garments, feedbackSignals);

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
        requestId, userId, stage: "swap_complete",
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
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── PLAN_WEEK MODE ──
    if (mode === "plan_week") {
      const days: { occasion: string; weather: WeatherInput; date: string; event_title?: string }[] = body.days || [];
      if (days.length === 0) {
        return new Response(JSON.stringify({ error: "No days provided" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          results.push({ date: day.date, occasion: dayOccasion, error: "Could not generate an outfit for this day", items: null, backup: null });
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
        requestId, userId, stage: "plan_week_complete",
        durationMs: Date.now() - requestStartedAt, dayCount: results.length,
      });

      return new Response(JSON.stringify({
        days: results,
        laundry: planLaundryCount > 0 ? {
          count: planLaundryCount,
          items: planLaundryItems.slice(0, 5).map(i => ({ id: i.id, title: i.title, category: i.category })),
          warning: planLaundryCount >= 5 ? "Several items are in the laundry — this may limit variety across the week." : null,
        } : undefined,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── GENERATE / SUGGEST MODE ──

    // Phase 0 — variety. Map garment_id → smallest rank in the user's last
    // RECENT_SUGGESTION_WINDOW shown outfits; `recentSuggestionPenalty`
    // softly down-weights recently-shown garments. Failure = empty map = no
    // penalty (must not break generation).
    const recencyMap = new Map<string, number>();
    try {
      const { data: recentLog } = await serviceSupabase
        .from("style_engine_suggestion_log")
        .select("outfit_hash").eq("user_id", userId)
        .order("generated_at", { ascending: false })
        .limit(RECENT_SUGGESTION_WINDOW);
      for (let i = 0; i < (recentLog?.length ?? 0); i++) {
        const hash = (recentLog![i] as { outfit_hash: string }).outfit_hash || "";
        if (!hash) continue;
        const rank = i + 1;
        for (const id of hash.split("|")) {
          if (!id) continue;
          const existing = recencyMap.get(id);
          if (existing === undefined || existing > rank) recencyMap.set(id, rank);
        }
      }
    } catch (e) {
      log.warn("Failed to load recency map; continuing without variety penalty", {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // Score all garments per slot
    const slotCandidates: Record<string, ScoredGarment[]> = {};
    for (const garment of garments) {
      if (excludeGarmentIds.has(garment.id)) continue;
      const slot = categorizeSlot(garment.category, garment.subcategory);
      if (!slot) continue;
      if (!slotCandidates[slot]) slotCandidates[slot] = [];
      const scored = scoreGarment(garment, occasion, weather, penalties, preferences, wearPatterns, styleVector, comfortProfile, socialMap, effectiveEventTitle, transInfo, personalUniform);
      // Phase 0 — variety. Soft recency adjustment (max ~15% of score).
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
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    // AI refinement (Phase 5d — extracted to _shared/outfit-ai-prompts.ts).
    // Inject callBursAI bound to the service-role client so the module stays
    // pure and the orchestrator owns telemetry + caching.
    const isStylistMode = generatorMode === "stylist" || mode === "stylist";
    const aiMode = mode === "suggest" ? "suggest" : "generate";
    const aiResult = await aiRefine({
      combos: activeCombos, mode: aiMode, occasion, style, weather,
      styleContext, locale, isStylistMode, occasionSubmode,
      layeringContext: { needs_base_layer: bestLayering.needs_base_layer },
      dayContext, regenerateToken,
      modelClient: (args) => callBursAI(args, serviceClient),
      estimateMaxTokens,
    });

    if (aiResult.error) {
      if (aiResult.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests, please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResult.status === 402) {
        return new Response(JSON.stringify({ error: "AI-krediter slut." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Fallback: use best scoring combo without AI explanation
      log.warn("AI refinement failed, using deterministic fallback");
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const fallbackLayering = validateLayeringCompleteness(best.items);
      // Phase 0 — variety. Mirror the AI-path log write so the next
      // generate's recency map sees this outfit (deterministic fallback path).
      const fallbackChosenIds = best.items.map(i => i.garment.id);
      const fallbackLowVariety = isLowVariety(recencyMap, fallbackChosenIds);
      try {
        const bestHash = hashOutfit(fallbackChosenIds);
        await serviceSupabase
          .from("style_engine_suggestion_log")
          .insert({ user_id: userId, outfit_hash: bestHash, occasion });
      } catch (logErr) {
        log.warn("Failed to log fallback style engine suggestion", {
          error: logErr instanceof Error ? logErr.message : String(logErr),
        });
      }
      return new Response(JSON.stringify({
        // Title enrichment — see AI-refinement path comment below.
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
        // Audit P2 — mirror AI-path low_variety on deterministic fallback.
        low_variety: fallbackLowVariety || undefined,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
            log.warn("Refinement guard: chosen outfit was identical to active look, swapped to alt combo", { altIdx });
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

      // Phase 0 — variety. Log chosen outfit's item-set hash for next
      // generate's recency map. `low_variety` flips when >=half the chosen
      // items appeared in the last 3 generates. Insert is best-effort.
      const chosenIds = chosen.items.map((i) => i.garment.id);
      const outfitHash = hashOutfit(chosenIds);
      const lowVariety = isLowVariety(recencyMap, chosenIds);
      try {
        await serviceSupabase
          .from("style_engine_suggestion_log")
          .insert({
            user_id: userId,
            outfit_hash: outfitHash,
            occasion,
          });
      } catch (logErr) {
        log.warn("Failed to log style engine suggestion", {
          error: logErr instanceof Error ? logErr.message : String(logErr),
        });
      }

      log.info("request.complete", {
        requestId, userId, stage: "generate_complete",
        durationMs: Date.now() - requestStartedAt,
        candidateCount, fallbackLevel,
        lockedCount: lockedGarmentIds.size,
        requestedEditSlots: Array.from(requestedEditSlots),
        degraded: Boolean(chosenNote), lowVariety,
        regenerate: Boolean(regenerateToken),
      });
      return new Response(JSON.stringify({
        // Include `title` so mobile's `EngineResponseItem.title` renders
        // the actual piece name rather than a blank label.
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
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Only 422 if we truly have no combos at all
      return new Response(JSON.stringify(buildIncompleteOutfitFailure(weather, occasion, slotCandidates)), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log.info("request.complete", {
      requestId, userId, stage: "suggest_complete",
      durationMs: Date.now() - requestStartedAt,
      candidateCount, suggestionCount: suggestions.length, fallbackLevel,
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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    if (error instanceof RateLimitError) {
      return rateLimitResponse(error, corsHeaders);
    }
    recordError("burs_style_engine");
    log.exception("request.failed", error, {
      stage: "request_failed",
    });
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
