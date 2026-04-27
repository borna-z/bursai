import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, Camera, Check, ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Card } from '@/components/ui/card';
import { PageIntro } from '@/components/ui/page-intro';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAnalyzeGarment } from '@/hooks/useAnalyzeGarment';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStorage } from '@/hooks/useStorage';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import {
  buildGarmentIntelligenceFields,
  standardizeGarmentAiRaw,
  triggerGarmentPostSaveIntelligence,
} from '@/lib/garmentIntelligence';
import { compressImage } from '@/lib/imageCompression';
import { incrementOnboardingGarmentCount } from '@/lib/incrementOnboardingGarmentCount';
import { hapticLight } from '@/lib/haptics';
import { safeT } from '@/lib/i18nFallback';
import { EASE_CURVE } from '@/lib/motion';
import { logger } from '@/lib/logger';

interface BatchCaptureStepProps {
  onComplete: () => void;
}

interface CaptureItem {
  id: string;
  preview: string;
  status: 'uploading' | 'analyzing' | 'done' | 'error';
}

// P47 spec: 20 minimum to advance, 30 recommended for the optional "Done"
// bypass. Cap at 50 to align with the spec wording (the upper bound prevents
// pathological bulk uploads that would hammer analyze_garment's per-minute
// rate limit and waste the user's onboarding boost window).
const MIN_GARMENTS = 20;
const RECOMMENDED_GARMENTS = 30;
const MAX_GARMENTS = 50;

export function BatchCaptureStep({ onComplete }: BatchCaptureStepProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { uploadGarmentImage } = useStorage();
  const { analyzeGarment } = useAnalyzeGarment();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  // Server count is the persisted source of truth (survives reloads). After
  // each successful per-file pipeline, `incrementOnboardingGarmentCount`
  // invalidates the `['profile', userId]` cache key (Cluster B side effect)
  // so this value re-fetches automatically and the canonical count drives
  // the UI. `optimisticBumps` only covers the brief window between the
  // user pressing "Add photos" and the RPC settling, so the counter never
  // visibly stalls at the start of an upload.
  const serverCount = (profile as { onboarding_garment_count?: number | null } | null)
    ?.onboarding_garment_count ?? 0;
  const [optimisticBumps, setOptimisticBumps] = useState(0);
  const [items, setItems] = useState<CaptureItem[]>([]);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Server count + in-flight optimistic bumps. The bump is +1 for the brief
  // window each in-flight upload spends between "garment row saved" and
  // "RPC settled (success or failure)" — both branches decrement it. On
  // success, the cache invalidation triggers a refetch so `serverCount`
  // becomes canonical. On failure, we explicitly refetch profile so the
  // counter snaps back to the canonical value (no phantom bumps stick
  // around if the counter RPC failed).
  const totalCount = serverCount + optimisticBumps;
  const reachedMin = totalCount >= MIN_GARMENTS;
  const reachedRecommended = totalCount >= RECOMMENDED_GARMENTS;
  // Progress bar capped visually at 30; counter keeps incrementing past it.
  const progressValue = Math.min(100, (totalCount / RECOMMENDED_GARMENTS) * 100);

  const remainingSlots = useMemo(
    () => Math.max(0, MAX_GARMENTS - totalCount - items.filter((i) => i.status !== 'done' && i.status !== 'error').length),
    [items, totalCount],
  );

  const removeItem = (id: string) => {
    setItems((current) => {
      const item = current.find((entry) => entry.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return current.filter((entry) => entry.id !== id);
    });
  };

  const processFile = async (rawFile: File): Promise<boolean> => {
    if (!user) return false;
    const itemId = crypto.randomUUID();
    const previewUrl = URL.createObjectURL(rawFile);
    setItems((current) => [...current, { id: itemId, preview: previewUrl, status: 'uploading' }]);

    try {
      // Match useAddGarment's pattern — compression failures fall back to the
      // raw file so the flow degrades gracefully on Median/WebView builds
      // where createImageBitmap or OffscreenCanvas are unavailable.
      let file: File | Blob = rawFile;
      try {
        const compressed = await compressImage(rawFile);
        file = compressed.file;
      } catch {
        file = rawFile;
      }

      const garmentId = crypto.randomUUID();
      const path = await uploadGarmentImage(file, garmentId);

      setItems((current) =>
        current.map((entry) => (entry.id === itemId ? { ...entry, status: 'analyzing' } : entry)),
      );

      const { data: analysis, error: analysisError } = await analyzeGarment(path, 'fast');
      if (analysisError) {
        logger.error('BatchCapture analysis error (continuing with fallback fields):', analysisError);
      }

      const fallbackTitle =
        rawFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim() || 'New garment';

      const intelligenceFields = buildGarmentIntelligenceFields({
        storagePath: path,
        enableRender: true,
      });

      const { error: insertError } = await supabase.from('garments').insert({
        id: garmentId,
        user_id: user.id,
        image_path: path,
        title: analysis?.title || fallbackTitle,
        category: analysis?.category || 'top',
        subcategory: analysis?.subcategory || null,
        color_primary: analysis?.color_primary || 'black',
        color_secondary: analysis?.color_secondary || null,
        pattern: analysis?.pattern || null,
        material: analysis?.material || null,
        fit: analysis?.fit || null,
        season_tags: analysis?.season_tags || null,
        formality: analysis?.formality || 3,
        ai_analyzed_at: analysis ? new Date().toISOString() : null,
        ai_provider: analysis?.ai_provider || null,
        ai_raw: standardizeGarmentAiRaw({
          aiRaw: analysis?.ai_raw || null,
          analysisConfidence: analysis?.confidence,
          source: 'batch_capture',
        }),
        imported_via: 'batch_capture',
        ...intelligenceFields,
      });

      if (insertError) throw insertError;

      // Background enrichment + render. Fire-and-forget — render queues to
      // process_render_jobs so the user doesn't wait for it before the next
      // capture. P49 (StudioSelection) re-renders the chosen 3 anyway.
      triggerGarmentPostSaveIntelligence({
        garmentId,
        storagePath: path,
        source: 'batch_add',
      });

      // Best-effort dedup signal so two near-identical photos don't both
      // count toward the user's batch. Non-blocking.
      if (analysis) {
        invokeEdgeFunction('detect_duplicate_garment', {
          body: {
            image_path: path,
            category: analysis.category,
            color_primary: analysis.color_primary,
            title: analysis.title,
            subcategory: analysis.subcategory,
            material: analysis.material,
            exclude_garment_id: garmentId,
          },
        }).catch((err) => {
          logger.error('BatchCapture duplicate detection error (non-blocking):', err);
        });
      }

      // Garment row committed. Now reflect it in the counter immediately so
      // the user gets instant feedback while the RPC + cache invalidation
      // are in flight. The bump is paired with the decrement below — both
      // success and failure paths decrement, so optimisticBumps never sticks
      // beyond the lifetime of an in-flight RPC.
      setOptimisticBumps((current) => current + 1);
      setItems((current) =>
        current.map((entry) => (entry.id === itemId ? { ...entry, status: 'done' } : entry)),
      );
      hapticLight();

      // Bump the server-side onboarding counter ONLY after the garment row
      // committed. The garment is saved either way — only the counter is
      // affected by RPC failure.
      try {
        // Pass queryClient so the wrapper invalidates ['profile', userId]
        // on success — without it, useProfile's 10-min staleTime keeps
        // serverCount stale and the counter visibly oscillates
        // serverCount → +1 → serverCount only minutes later. (Code-reviewer
        // P1 round 1 on the integrated audit-fix diff.)
        await incrementOnboardingGarmentCount(user.id, queryClient);
        // Success: cache invalidation (Cluster B side effect of
        // incrementOnboardingGarmentCount) refreshes `serverCount` to
        // the canonical value. Back off our optimistic guess so the two
        // don't double-count once the refetch resolves.
        setOptimisticBumps((current) => Math.max(0, current - 1));
      } catch (countErr) {
        logger.warn('BatchCapture: count increment failed (garment saved, count may drift):', countErr);
        // Failure: the garment is still saved, but the counter RPC didn't
        // run. Drop the optimistic bump and refetch the profile so the
        // counter snaps back to the canonical (lower) value rather than
        // showing a stale +1 that would otherwise persist for the rest of
        // the session. Toast the user so they understand the count
        // reverted but their photo is safe.
        setOptimisticBumps((current) => Math.max(0, current - 1));
        void queryClient.refetchQueries({ queryKey: ['profile', user.id] });
        toast.error(
          safeT(
            t,
            'batchCapture.count_update_failed',
            "Couldn't update progress counter. Your photo is saved.",
          ),
        );
      }

      return true;
    } catch (err) {
      logger.error('BatchCapture: per-file pipeline failed:', err);
      setItems((current) =>
        current.map((entry) => (entry.id === itemId ? { ...entry, status: 'error' } : entry)),
      );
      return false;
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !user) return;
    const list = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, remainingSlots);

    // Sequential processing: prevents the per-isolate Gemini rate limit from
    // tripping when a user picks 20 files at once, and keeps the counter
    // monotonically increasing in the UI.
    for (const file of list) {
      await processFile(file);
    }

    if (inputRef.current) inputRef.current.value = '';
  };

  const handleAdvance = async () => {
    if (!reachedMin || isAdvancing) return;
    setIsAdvancing(true);
    try {
      hapticLight();
      onComplete();
    } finally {
      setIsAdvancing(false);
    }
  };

  const isProcessing = items.some((i) => i.status === 'uploading' || i.status === 'analyzing');
  const canAddMore = remainingSlots > 0 && !isProcessing;

  const counterLabel = reachedMin
    ? safeT(t, 'batchCapture.recommended_helper', 'of 30 recommended')
    : safeT(t, 'batchCapture.min_helper', 'of 20 minimum');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="page-shell !max-w-lg !px-6 !pb-32 !pt-[calc(var(--safe-area-top)+6rem)] page-cluster">
        <Card surface="editorial" className="p-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-background/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <Camera className="h-7 w-7 text-foreground/72" />
          </div>
          <div className="mt-5">
            <PageIntro
              center
              eyebrow={safeT(t, 'batchCapture.eyebrow', 'Build your wardrobe')}
              title={safeT(t, 'batchCapture.title', 'Add 20 pieces to begin.')}
              description={safeT(
                t,
                'batchCapture.subtitle',
                'The more we see, the better we style. Aim for 30 to unlock a richer wardrobe map.',
              )}
            />
          </div>
        </Card>

        <Card surface="utility" className="space-y-4 p-5">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">{totalCount}</span>
              <span className="label-editorial tracking-[0.18em] text-muted-foreground">
                {counterLabel}
              </span>
            </div>
            <Progress value={progressValue} aria-label={safeT(t, 'batchCapture.progress_label', 'Wardrobe progress')} />
          </div>

          {items.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {items.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.22, ease: EASE_CURVE }}
                  className="relative aspect-square overflow-hidden rounded-[0.9rem] border border-border/60 bg-secondary/35"
                >
                  <img src={item.preview} alt="" className="h-full w-full object-cover" />
                  <div
                    className={
                      item.status === 'done'
                        ? 'absolute inset-0 flex items-center justify-center bg-emerald-500/20'
                        : item.status === 'error'
                          ? 'absolute inset-0 flex items-center justify-center bg-red-500/25'
                          : 'absolute inset-0 flex items-center justify-center bg-black/30'
                    }
                  >
                    {item.status === 'uploading' || item.status === 'analyzing' ? (
                      <Loader2 className="h-5 w-5 animate-spin text-white/85" />
                    ) : null}
                    {item.status === 'done' ? <Check className="h-5 w-5 text-emerald-400" /> : null}
                    {item.status === 'error' ? <X className="h-5 w-5 text-red-400" /> : null}
                  </div>
                  {item.status === 'error' ? (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/65"
                      aria-label="Remove failed capture"
                    >
                      <X className="h-3 w-3 text-white/85" />
                    </button>
                  ) : null}
                </motion.div>
              ))}
            </div>
          ) : null}
        </Card>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />

        <div className="action-bar-floating rounded-[1.6rem] p-3">
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => inputRef.current?.click()}
              size="lg"
              variant={reachedMin ? 'outline' : 'default'}
              disabled={!canAddMore}
              className="w-full"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              {safeT(t, 'batchCapture.add_photos_cta', 'Add photos')}
            </Button>

            {reachedRecommended ? (
              <Button onClick={handleAdvance} size="lg" disabled={isAdvancing || isProcessing} className="w-full">
                {safeT(t, 'batchCapture.done_cta', "I'm done")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleAdvance}
                size="lg"
                disabled={!reachedMin || isAdvancing || isProcessing}
                className="w-full"
              >
                {safeT(t, 'batchCapture.continue_cta', 'Continue')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
