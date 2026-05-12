// Shared types for the LiveScan v2 screen.
//
// `FrameScore` is the 0–1 quality score computed per frame by the frame
// processor. `Quality` is the human-readable bucket the UI consumes.
// `ScanSessionId` is a per-capture nonce — generated at snap time, used to
// correlate pipeline events back to a specific filmstrip tile.

export type ScanSessionId = string;

export type Quality =
  | 'searching'
  | 'low_light'
  | 'too_close'
  | 'too_far'
  | 'not_centered'
  | 'ready';

export interface DetectedObject {
  /** Normalized bounding box, all 0–1. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Detector confidence, 0–1. Higher = more confident a foreground object is present. */
  confidence: number;
}

export interface FrameMetrics {
  /** Mean luminance of the largest detected box region (0–1). 0 = black. */
  exposure: number;
  /** Variance-of-Laplacian sharpness, normalized 0–1. */
  sharpness: number;
}

export interface FrameScore {
  /** Weighted total, 0–1. */
  score: number;
  /** Bucketed quality enum derived from sub-scores. */
  quality: Quality;
}

export type PipelineStage =
  | 'compress'
  | 'upload'
  | 'analyze'
  | 'persist';

export type PipelineErrorClass =
  | 'compress_failed'
  | 'upload_failed'
  | 'analyze_rate_limit'
  | 'analyze_auth'
  | 'analyze_subscription'
  | 'analyze_http'
  | 'analyze_unknown'
  | 'multi_garment'
  | 'persist_failed'
  | 'auth_failed'
  | 'render_credits_exhausted'
  | 'unknown';

export interface ScanTileState {
  sessionId: ScanSessionId;
  /** Local file URI of the captured photo, used for retake / retry. */
  photoUri: string;
  /** Where we are in the pipeline. */
  stage: PipelineStage | 'done' | 'failed' | 'queued';
  /** Set when stage === 'failed'. */
  errorClass?: PipelineErrorClass;
  /** Set on success. */
  garmentId?: string;
}
