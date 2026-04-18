/**
 * Centralised application constants.
 * All magic numbers and tunable thresholds live here — never scatter them inline.
 */

// ── Image processing ─────────────────────────────────────────────────────────
export const IMAGE_MAX_DIMENSION = 1200;
export const IMAGE_QUALITY = 0.82;

/** Fraction of the video frame kept when center-cropping for LiveScan. */
export const FRAME_CROP_RATIO = 0.7;
export const FRAME_MAX_DIM = 480;
export const FRAME_QUALITY = 0.5;

export const GARMENT_IMAGE_PROCESSING_VERSION = 'background-removal-v1';

// ── Confidence thresholds ─────────────────────────────────────────────────────
/** Below this the garment is flagged for manual review after AI analysis. */
export const GARMENT_REVIEW_CONFIDENCE_THRESHOLD = 0.55;

/** Badge thresholds shown on GarmentDetail and humanize helpers. */
export const CONFIDENCE_HIGH = 0.85;
export const CONFIDENCE_MEDIUM = 0.6;

/** LiveScan: above this the capture is accepted automatically. */
export const SCAN_AUTO_ACCEPT_CONFIDENCE = 0.8;
export const SCAN_MEDIUM_CONFIDENCE = 0.5;

// ── Render / enrichment pipeline ─────────────────────────────────────────────
// Priority 5 moved render kickoff to a durable DB-backed queue (render_jobs
// table + process_render_jobs edge fn + pg_cron safety net). The in-memory
// kickoff concurrency / sweep constants below are no longer used.
//
// @deprecated — unused post-P5; kept as named exports to avoid import breakage
// on any lagging code paths. Will be removed in a follow-up cleanup.
export const RENDER_KICKOFF_CONCURRENCY = 3;
export const RENDER_RESUME_SWEEP_LIMIT = 12;
export const RENDER_RESUME_SWEEP_COOLDOWN_MS = 15_000;

/** @deprecated In-memory cap from the pre-P5 queue. Unused post-P5. */
export const RENDER_QUEUE_MAX_SIZE = 200;

export const GARMENT_ENRICHMENT_RETRY_DELAY_MS = 3_000;

// ── Network / timeouts ────────────────────────────────────────────────────────
export const EDGE_FUNCTION_DEFAULT_TIMEOUT_MS = 25_000;
export const EDGE_FUNCTION_MAX_BACKOFF_MS = 8_000;
export const AI_STREAM_TIMEOUT_MS = 45_000;

// ── Swap engine scoring weights ───────────────────────────────────────────────
/** "Safe" mode: colour compatibility first, freshness second, expression third. */
export const SWAP_SAFE_FRESHNESS = 0.30;
export const SWAP_SAFE_COLOR = 0.55;
export const SWAP_SAFE_EXPRESSIVE = 0.15;

/** "Bold" mode: expression first, colour second, freshness last. */
export const SWAP_BOLD_FRESHNESS = 0.20;
export const SWAP_BOLD_COLOR = 0.30;
export const SWAP_BOLD_EXPRESSIVE = 0.50;

/** "Fresh" mode: freshness first, colour second, expression last. */
export const SWAP_FRESH_FRESHNESS = 0.50;
export const SWAP_FRESH_COLOR = 0.30;
export const SWAP_FRESH_EXPRESSIVE = 0.20;

// ── Observability ─────────────────────────────────────────────────────────────
export const SENTRY_TRACES_SAMPLE_RATE = 0.2;
