/**
 * Wave 8.5 PR B (P88 + P89) — shared loader for `user_style_summaries`.
 *
 * Both `burs_style_engine` and `style_chat` consume the deterministic style
 * summary on every request. This module centralizes the read-or-build pattern
 * so both engines stay in lockstep — same staleness threshold, same lazy
 * materialization, same telemetry, same defensive fallback.
 *
 * Design (per Wave 8.5 D5):
 *
 *   1. SELECT user_style_summaries WHERE user_id = ? LIMIT 1.
 *   2. If row is fresh (no dirty_at + updated_at within 7 days), return it.
 *   3. If row is stale OR missing → build deterministically via PR A's
 *      `buildStyleSummary`, persist, return. First-call cost is amortized:
 *      every subsequent request hits the persisted row (~1ms).
 *   4. If build fails (transient DB error, malformed inputs, etc.) → return
 *      null. Callers must tolerate `null` and fall back to non-summary
 *      scoring; the engine's hard rules (outfit completeness, weather,
 *      etc.) still apply.
 *
 * Per-request memo is the caller's responsibility — the loader doesn't
 * cache across calls. Callers should hold a `Map<userId, summary>` for the
 * duration of a single request.
 */

import {
  buildStyleSummary,
  type StyleSummaryInputs,
  type StyleSummaryOutput,
} from "./style-summary-builder.ts";

/**
 * Persisted shape — mirrors `user_style_summaries` row + the PR A migration
 * shipped in `20260501120000_user_style_summaries_and_memory_ingest.sql`.
 *
 * Note: `dirty_at` is the canonical staleness signal. PR A's
 * `ingest_memory_event` RPC stamps `dirty_at = now()` on every memory
 * write so this loader can detect "memory was updated since the last
 * build" without comparing timestamps.
 */
export interface UserStyleSummaryRow {
  user_id: string;
  summary_json: StyleSummaryOutput["summary_json"];
  summary_text: string;
  confidence: number;
  version: number;
  dirty_at: string | null;
  updated_at: string;
}

/** Loose type for the supabase service-role client passed in. */
// deno-lint-ignore no-explicit-any
type ServiceClient = any;

const STALENESS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Load the user's persisted style summary, lazily rebuilding on cache miss
 * or stale row.
 *
 * @param supabaseAdmin  service-role supabase client (bypasses RLS).
 * @param userId         verified user id.
 * @param loadInputs     async loader for the deterministic builder's inputs.
 *                       Caller owns the queries; the loader doesn't assume
 *                       a particular SELECT shape.
 * @returns the summary row, or `null` if both cache lookup and build fail.
 */
export async function loadOrBuildSummary(
  supabaseAdmin: ServiceClient,
  userId: string,
  loadInputs: () => Promise<StyleSummaryInputs>,
): Promise<UserStyleSummaryRow | null> {
  // Step 1: cache lookup.
  let existing: UserStyleSummaryRow | null = null;
  try {
    const { data, error } = await supabaseAdmin
      .from("user_style_summaries")
      .select(
        "user_id, summary_json, summary_text, confidence, version, dirty_at, updated_at",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("[summary-loader] cache select error", {
        user_id: userId,
        error: typeof error === "object" ? JSON.stringify(error) : String(error),
      });
      // Fall through to build; non-fatal.
    } else if (data) {
      existing = data as UserStyleSummaryRow;
    }
  } catch (err) {
    console.error("[summary-loader] cache select threw", err);
  }

  // Step 2: freshness check.
  if (existing && isFresh(existing)) {
    return existing;
  }

  // Step 3: build.
  const t0 = Date.now();
  try {
    const inputs = await loadInputs();
    const built = buildStyleSummary(inputs);
    const duration_ms = Date.now() - t0;
    console.log(
      "[summary-loader] lazy_build",
      JSON.stringify({
        user_id: userId,
        duration_ms,
        signal_count: inputs.feedbackSignals.length,
        outfit_count: inputs.outfits.length,
        garment_count: inputs.garments.length,
        wear_log_count: inputs.wearLogs.length,
        was_stale: existing != null,
        confidence: built.confidence,
      }),
    );

    const row: UserStyleSummaryRow = {
      user_id: userId,
      summary_json: built.summary_json,
      summary_text: built.summary_text,
      confidence: built.confidence,
      version: built.version,
      dirty_at: null,
      updated_at: new Date().toISOString(),
    };

    // Persist. Failure here is non-fatal — return the in-memory row to the
    // caller so the current request still benefits from the summary;
    // next request will retry the persist.
    try {
      await supabaseAdmin
        .from("user_style_summaries")
        .upsert(row, { onConflict: "user_id" });
    } catch (persistErr) {
      console.error("[summary-loader] persist failed", persistErr);
    }
    return row;
  } catch (buildErr) {
    console.error("[summary-loader] build failed", buildErr);
    // If we have a stale row, return it as a safer fallback than null —
    // partial memory is better than no memory.
    return existing ?? null;
  }
}

function isFresh(row: UserStyleSummaryRow): boolean {
  if (row.dirty_at != null) return false;
  if (!row.updated_at) return false;
  const updatedAt = new Date(row.updated_at).getTime();
  if (!Number.isFinite(updatedAt)) return false;
  return Date.now() - updatedAt < STALENESS_MS;
}

/**
 * Helper to load the standard input bundle for `buildStyleSummary` from
 * supabase. Engines can use this directly OR build their own variant if
 * they need different LIMIT bounds.
 */
export async function loadStandardSummaryInputs(
  supabaseAdmin: ServiceClient,
  userId: string,
): Promise<StyleSummaryInputs> {
  const [
    profileR,
    garmentsR,
    outfitsR,
    outfitItemsR,
    wearLogsR,
    signalsR,
    pairsR,
    plannedR,
    outfitFeedbackR,
  ] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("preferences, height_cm, weight_kg, home_city")
      .eq("id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("garments")
      .select(
        "id, category, subcategory, color_primary, color_secondary, pattern, material, fit, formality, season_tags, wear_count, last_worn_at, style_archetype, occasion_tags, created_at",
      )
      .eq("user_id", userId)
      .limit(2000),
    supabaseAdmin
      .from("outfits")
      .select(
        "id, rating, feedback, saved, worn_at, occasion, weather, created_at, generated_at",
      )
      .eq("user_id", userId)
      .limit(2000),
    supabaseAdmin
      .from("outfit_items")
      .select("outfit_id, garment_id, slot, outfits!inner(user_id)")
      .eq("outfits.user_id", userId)
      .limit(5000),
    supabaseAdmin
      .from("wear_logs")
      .select("garment_id, outfit_id, worn_at, occasion")
      .eq("user_id", userId)
      .limit(5000),
    supabaseAdmin
      .from("feedback_signals")
      .select(
        "signal_type, outfit_id, garment_id, value, rating, metadata, created_at",
      )
      .eq("user_id", userId)
      .limit(2000),
    supabaseAdmin
      .from("garment_pair_memory")
      .select(
        "garment_a_id, garment_b_id, positive_count, negative_count, last_positive_at, last_negative_at",
      )
      .eq("user_id", userId)
      .limit(1000),
    supabaseAdmin
      .from("planned_outfits")
      .select("outfit_id, status, date")
      .eq("user_id", userId)
      .limit(1000),
    supabaseAdmin
      .from("outfit_feedback")
      .select("outfit_id, fit_score, color_match_score, overall_score, created_at")
      .eq("user_id", userId)
      .limit(1000),
  ]);

  return {
    profile: (profileR.data ?? null) as StyleSummaryInputs["profile"],
    garments: (garmentsR.data ?? []) as StyleSummaryInputs["garments"],
    outfits: (outfitsR.data ?? []) as StyleSummaryInputs["outfits"],
    outfitItems: (outfitItemsR.data ?? []) as StyleSummaryInputs["outfitItems"],
    wearLogs: (wearLogsR.data ?? []) as StyleSummaryInputs["wearLogs"],
    feedbackSignals: (signalsR.data ?? []) as StyleSummaryInputs["feedbackSignals"],
    pairMemory: (pairsR.data ?? []) as StyleSummaryInputs["pairMemory"],
    plannedOutfits: (plannedR.data ?? []) as StyleSummaryInputs["plannedOutfits"],
    outfitFeedback: (outfitFeedbackR.data ?? []) as StyleSummaryInputs["outfitFeedback"],
  };
}
