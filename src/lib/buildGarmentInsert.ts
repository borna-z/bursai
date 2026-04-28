import type { Json, TablesInsert } from '@/integrations/supabase/types';
import {
  buildGarmentIntelligenceFields,
  standardizeGarmentAiRaw,
} from '@/lib/garmentIntelligence';
import type { GarmentIntakeCandidate } from '@/lib/reviewCandidate';

function pick<T>(override: T | undefined, fallback: T): T {
  return override !== undefined ? override : fallback;
}

export interface BuildGarmentInsertOptions {
  /** Override the `imported_via` value written to the garment row. Default
   * is `candidate.source`. BatchCaptureStep passes `'batch_capture'` here
   * so the analytics taxonomy stays distinct from generic `'batch_add'`
   * (Wave 7.9 audit P2 #7). */
  importedVia?: string;
}

export function buildGarmentInsert(
  candidate: GarmentIntakeCandidate,
  storagePath?: string,
  options: BuildGarmentInsertOptions = {},
): TablesInsert<'garments'> {
  const enableStudioQuality = candidate.enableStudioQuality ?? true;
  const garmentId = candidate.existingGarmentId ?? crypto.randomUUID();
  const isPng = candidate.blob.type === 'image/png';
  const ext = isPng ? 'png' : 'jpg';
  const resolvedStoragePath = storagePath ?? `${candidate.userId}/${garmentId}.${ext}`;
  const overrides = candidate.fieldOverrides ?? {};
  // Wave 7.9 audit P2 #7 — `candidate.analysis` is nullable. Treating it as
  // a partial here means every read uses optional chaining; missing fields
  // fall through to either the override or a category-safe default. The
  // `ai_analyzed_at` / `ai_raw` columns also degrade cleanly (null vs
  // populated). Pre-P2-#7 callers (LiveScan, AddGarment) always pass a
  // populated analysis so they take the same code path with no behavior
  // change — only BatchCaptureStep exercises the null branch.
  const analysis = candidate.analysis;

  const payload: TablesInsert<'garments'> = {
    id: garmentId,
    user_id: candidate.userId,
    image_path: resolvedStoragePath,
    title: pick(overrides.title, analysis?.title ?? 'New garment'),
    category: pick(overrides.category, analysis?.category ?? 'top'),
    subcategory: pick(overrides.subcategory, analysis?.subcategory ?? null),
    color_primary: pick(overrides.color_primary, analysis?.color_primary ?? 'black'),
    color_secondary: pick(overrides.color_secondary, analysis?.color_secondary ?? null),
    pattern: pick(overrides.pattern, analysis?.pattern ?? null),
    material: pick(overrides.material, analysis?.material ?? null),
    fit: pick(overrides.fit, analysis?.fit ?? null),
    season_tags: pick(overrides.season_tags, analysis?.season_tags ?? []),
    formality: pick(overrides.formality, analysis?.formality ?? 3),
    ai_analyzed_at: analysis ? new Date().toISOString() : null,
    // When analysis was attempted (object exists, even if `ai_provider` is
    // missing), preserve the legacy 'unknown' default so consumers reading
    // analytics by provider don't see the row as "no AI ran." When analysis
    // is null (Wave 7.9 P2 #7 — analyze step skipped or failed entirely),
    // emit null so downstream filters can distinguish.
    ai_provider: analysis ? (analysis.ai_provider || 'unknown') : null,
    ai_raw: standardizeGarmentAiRaw({
      aiRaw: (analysis?.ai_raw ?? null) as Json,
      analysisConfidence: candidate.confidence ?? analysis?.confidence,
      source: candidate.source,
    }),
    imported_via: options.importedVia ?? candidate.source,
    ...buildGarmentIntelligenceFields({
      storagePath: resolvedStoragePath,
      enableRender: enableStudioQuality,
    }),
  };

  if (overrides.in_laundry !== undefined) {
    payload.in_laundry = overrides.in_laundry;
  }

  return payload;
}
