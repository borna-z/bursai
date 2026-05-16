// feedbackNormalizer — pure helpers extracted from `usePhotoFeedback`.
//
// `adaptFeedback` maps the deployed `outfit_feedback` row shape into the
// screen-facing `PhotoFeedback` envelope; `deriveSummary` extracts the
// short first-sentence header copy; `isLikelySelfieDetectorMessage` is
// the heuristic that classifies a server error string as a missing-face /
// non-selfie rejection so the screen can present the "we couldn't find a
// face" affordance instead of a generic error. All three are pure and
// React-free so they can be unit-tested without rendering.

export interface PhotoFeedback {
  fit_notes: string;
  color_callouts: string[];
  swap_suggestions: { garment_id?: string; reason: string }[];
  overall_score?: number | null;
  summary?: string | null;
}

export type DeployedOutfitFeedbackRow = {
  fit_score?: number | null;
  color_match_score?: number | null;
  overall_score?: number | null;
  commentary?: string | null;
  ai_raw?: Record<string, unknown> | null;
  error?: string;
};

const SUMMARY_MAX_LEN = 80;

export function deriveSummary(commentary: string | null | undefined): string | null {
  if (typeof commentary !== 'string') return null;
  const trimmed = commentary.trim();
  if (trimmed.length === 0) return null;
  const match = trimmed.match(/^[^.!?]+[.!?]/);
  const candidate = (match ? match[0] : trimmed).trim();
  if (candidate.length === 0) return null;
  if (candidate.length <= SUMMARY_MAX_LEN) return candidate;
  const window = candidate.slice(0, SUMMARY_MAX_LEN);
  const lastSpace = window.lastIndexOf(' ');
  const sliced = lastSpace > 0 ? window.slice(0, lastSpace) : window;
  const finalText = sliced.trim();
  return finalText.length > 0 ? finalText : null;
}

export function adaptFeedback(row: DeployedOutfitFeedbackRow): PhotoFeedback {
  const commentary =
    typeof row.commentary === 'string' && row.commentary.trim().length > 0
      ? row.commentary.trim()
      : '';
  const overall =
    typeof row.overall_score === 'number' && Number.isFinite(row.overall_score)
      ? row.overall_score
      : null;

  const aiRaw = row.ai_raw && typeof row.ai_raw === 'object' ? row.ai_raw : {};
  const colorCallouts: string[] = Array.isArray((aiRaw as Record<string, unknown>).color_callouts)
    ? ((aiRaw as Record<string, unknown>).color_callouts as unknown[])
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map((v) => v.trim())
    : [];
  const swapSuggestions: { garment_id?: string; reason: string }[] = Array.isArray(
    (aiRaw as Record<string, unknown>).swap_suggestions,
  )
    ? ((aiRaw as Record<string, unknown>).swap_suggestions as unknown[])
        .map((v) => {
          if (!v || typeof v !== 'object') return null;
          const obj = v as Record<string, unknown>;
          const reasonRaw = typeof obj.reason === 'string' ? obj.reason.trim() : '';
          if (reasonRaw.length === 0) return null;
          const garmentIdRaw =
            typeof obj.garment_id === 'string' ? obj.garment_id.trim() : '';
          return {
            ...(garmentIdRaw.length > 0 ? { garment_id: garmentIdRaw } : {}),
            reason: reasonRaw,
          };
        })
        .filter((v): v is { garment_id?: string; reason: string } => v !== null)
    : [];

  return {
    fit_notes: commentary,
    color_callouts: colorCallouts,
    swap_suggestions: swapSuggestions,
    overall_score: overall,
    summary: deriveSummary(commentary),
  };
}

// Heuristic: does this server-surfaced error string read like a
// "couldn't detect a person / face in the selfie" rejection? Used by
// the screen to swap a generic banner for a retake-affordance.
export function isLikelySelfieDetectorMessage(message: string | null | undefined): boolean {
  if (typeof message !== 'string') return false;
  const lower = message.toLowerCase();
  if (lower.length === 0) return false;
  const tokens = ['selfie', 'face', 'person', 'no_face', 'detector', 'mirror'];
  return tokens.some((t) => lower.includes(t));
}
