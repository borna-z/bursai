// ─────────────────────────────────────────────
// WEAR-CONTEXT PREPROCESSING (extracted Phase 5d — verbatim port)
//
// Lifted from `supabase/functions/burs_style_engine/index.ts` lines
// 1260–1276. Pure module — no DB reads; the orchestrator continues to load
// `wear_logs`, garments, and `feedback_signals`, and passes the rows in.
//
// Returns the derived-context bundle that the score loop consumes:
//   - wearPatterns      (buildWearPatternProfile)
//   - styleVector       (buildStyleVector)
//   - socialMap         (buildSocialContextMap)
//   - comfortProfile    (buildComfortStyleProfile — REQUIRES feedbackSignals)
//   - personalUniform   (buildPersonalUniform)
//   - transInfo         (seasonal transition info — colocated)
//
// IMPORTANT: `buildComfortStyleProfile` takes `feedbackSignals` as a third
// argument (see `_shared/outfit-scoring-body.ts:92`). Dropping it would
// change `comfortProfile` for users with feedback history. The inlined block
// at `burs_style_engine/index.ts:1267-1269` already passes it through —
// this port keeps the same wiring.
// ─────────────────────────────────────────────

import {
  type ComfortStyleProfile,
  type FeedbackSignal,
  type GarmentRow,
  type PersonalUniform,
  type SeasonTransitionInfo,
  type SocialContextMap,
  type StyleVector,
  type WearLog,
  type WearPatternProfile,
  buildComfortStyleProfile,
  buildPersonalUniform,
  buildSocialContextMap,
  buildStyleVector,
  buildWearPatternProfile,
  getSeasonTransitionInfo,
} from "./outfit-scoring.ts";

export interface WearContext {
  /** Per-garment day-of-week / seasonal / category usage frequencies. */
  wearPatterns: WearPatternProfile | null;
  /** Learned style vector (>=5 logs). */
  styleVector: StyleVector | null;
  /** Recurring event → garment-set map. */
  socialMap: SocialContextMap | null;
  /** Comfort / aspiration signal map (>=5 logs, includes feedback weight). */
  comfortProfile: ComfortStyleProfile | null;
  /** Dominant silhouette formula (>=15 logs). */
  personalUniform: PersonalUniform | null;
  /** Seasonal transition info (always populated — derived from clock). */
  transInfo: SeasonTransitionInfo;
}

/**
 * Build the derived wear-context bundle the score loop consumes.
 *
 * Verbatim port of:
 *   const wearPatterns = wearLogs.length > 0
 *     ? buildWearPatternProfile(wearLogs, garments)
 *     : null;
 *   const styleVector = wearLogs.length >= 5
 *     ? buildStyleVector(wearLogs, garments)
 *     : null;
 *   const comfortProfile = wearLogs.length >= 5
 *     ? buildComfortStyleProfile(wearLogs, garments, feedbackSignals)
 *     : null;
 *   const socialMap = wearLogs.length > 0 ? buildSocialContextMap(wearLogs) : null;
 *   const transInfo = getSeasonTransitionInfo();
 *   const personalUniform = wearLogs.length >= 15 ? buildPersonalUniform(wearLogs, garments) : null;
 *
 * `feedbackSignals` is required — `buildComfortStyleProfile` reads from it
 * to compute aspiration weights. Pass `[]` if there are no signals (matches
 * the legacy path when `feedbackRes.data` was empty).
 */
export function buildWearContext(
  wearLogs: WearLog[],
  garments: GarmentRow[],
  feedbackSignals: FeedbackSignal[],
): WearContext {
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

  return { wearPatterns, styleVector, socialMap, comfortProfile, personalUniform, transInfo };
}
