import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { ImagePlus, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { LazyImage } from '@/components/ui/lazy-image';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { invalidateWardrobeQueries } from '@/hooks/useGarments';
import { useStorage } from '@/hooks/useStorage';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { triggerGarmentPostSaveIntelligence } from '@/lib/garmentIntelligence';
import { compressImage } from '@/lib/imageCompression';
import { hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { logger } from '@/lib/logger';
import { DURATION_MEDIUM, EASE_CURVE } from '@/lib/motion';

type Garment = Tables<'garments'>;

interface SecondaryImageManagerProps {
  garment: Garment;
}

export function SecondaryImageManager({ garment }: SecondaryImageManagerProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { uploadGarmentImage, deleteGarmentImage } = useStorage();
  const queryClient = useQueryClient();
  const prefersReduced = useReducedMotion();

  const [isUploading, setIsUploading] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const renderBusy = garment.render_status === 'pending' || garment.render_status === 'rendering';
  // 'pending' is the transient state between our swap UPDATE and the enrichment
  // worker flipping to 'in_progress'. renderBusy already covers that window via
  // render_status='pending', but gating on enrichment 'pending' explicitly is
  // cheap defense-in-depth against future renderBusy refactors.
  const enrichmentBusy =
    garment.enrichment_status === 'pending' ||
    garment.enrichment_status === 'processing' ||
    garment.enrichment_status === 'in_progress';
  const localBusy = isUploading || isSwapping || isDeleting;
  const isBusy = renderBusy || enrichmentBusy || localBusy;

  // Invalidate the full wardrobe query set (not just the single-garment key).
  // Codex P2 round 3 caught that stale cache on ['garments', userId, filters]
  // and ['garments-by-ids'] left wardrobe list cards showing old images after
  // a swap/add/delete. `invalidateWardrobeQueries` is the canonical helper
  // used by `useUpdateGarment` / `useDeleteGarment` for the same reason.
  const invalidate = () => invalidateWardrobeQueries(queryClient, user?.id);

  const showBusyToast = () => toast(t('garment.secondary_busy_toast'));

  const handleAddClick = () => {
    if (isBusy) {
      showBusyToast();
      return;
    }
    hapticLight();
    fileInputRef.current?.click();
  };

  const handleFileChange = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    // Reset input so selecting the same file again still fires onChange.
    ev.target.value = '';
    if (!file || !user) return;

    setIsUploading(true);
    try {
      // Raw-file fallback when compression throws. Codex P1 round 5 caught
      // that `compressImage()` uses `createImageBitmap` + `OffscreenCanvas` —
      // both known to be unavailable or flaky in some Median/WebView
      // environments. Aborting on that error would lock the feature out
      // entirely for affected users. `useAddGarment` already handles this by
      // falling back to the raw File. Mirror that pattern here so the add
      // flow degrades gracefully (larger upload, same functional outcome).
      let uploadFile: File = file;
      try {
        const { file: compressed } = await compressImage(file);
        uploadFile = compressed;
      } catch (compressErr) {
        logger.warn(
          '[SecondaryImageManager] compression failed — uploading raw file',
          compressErr,
        );
      }
      const ext = uploadFile.type === 'image/webp'
        ? 'webp'
        : uploadFile.type === 'image/png'
        ? 'png'
        : 'jpg';
      // Unique path per upload. Codex P1 round 4 caught that a fixed
      // `${user.id}/${garment.id}_secondary.${ext}` path collides after any
      // prior swap has moved the _secondary object into the primary slot
      // (image_path): uploading a replacement then overwrites the CURRENT
      // primary's storage bytes, and a subsequent "Remove" deletes the live
      // primary image. Tagging the upload with a crypto-random suffix
      // guarantees each secondary gets its own distinct storage object, so
      // swap/primary and add/remove flows can never clobber each other.
      // Orphaned objects from replace flows (none today — UI only exposes
      // "Add alternate" when no secondary exists — but future-proof) are
      // cleaned by the post-launch storage-GC cron (see Findings Log).
      const uniqueTag = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      const filePath = `${user.id}/${garment.id}_secondary_${uniqueTag}.${ext}`;
      await uploadGarmentImage(uploadFile, garment.id, { filePath, upsert: false });

      const { error } = await supabase
        .from('garments')
        .update({ secondary_image_path: filePath })
        .eq('id', garment.id)
        .eq('user_id', user.id);
      if (error) throw error;

      hapticSuccess();
      toast.success(t('garment.secondary_add_success'));
      invalidate();
    } catch (err) {
      logger.error('[SecondaryImageManager] add failed', err);
      toast.error(t('common.something_wrong'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSwapConfirm = async () => {
    // Re-check the busy gate at confirm-time. Codex P2 round 5 caught that
    // the busy check only fired when opening the dialog. If render_status
    // or enrichment_status flipped to busy WHILE the dialog was open (e.g.
    // from a background refetch or another tab), the user could still click
    // Confirm and bypass the lockout — potentially double-charging a render
    // credit if enrichment/render was already in-flight. Closing the dialog
    // + toasting keeps UX coherent with the pre-open gate.
    if (isBusy) {
      setSwapDialogOpen(false);
      showBusyToast();
      return;
    }
    if (!user || !garment.secondary_image_path || !garment.image_path) return;
    setSwapDialogOpen(false);
    setIsSwapping(true);

    const previousImagePath = garment.image_path;
    const previousSecondaryPath = garment.secondary_image_path;
    const newPrimary = garment.secondary_image_path;
    const newSecondary = garment.image_path;

    try {
      hapticMedium();

      // Single-statement UPDATE: swap values + clear all enrichment/render
      // derived state so the new primary drives fresh AI outputs. Optimistic
      // concurrency checks BOTH image_path AND secondary_image_path against
      // their pre-read values — Codex P1 (PR #668 round 2) caught that
      // checking only image_path allowed a concurrent-tab change to
      // secondary_image_path to promote a stale/deleted path into the primary
      // slot (e.g. tab A reads garment, tab B adds+swaps secondary, tab A
      // then swaps using its stale secondary value). Matching BOTH columns
      // means any concurrent write in either position fails the OC guard
      // cleanly — zero-row UPDATE, we bail, state stays consistent. RLS
      // still enforces ownership via user_id.
      //
      // `original_image_path` is also swapped to newPrimary. Codex P1 round 3
      // caught that `getPreferredGarmentImagePath` prefers `original_image_path`
      // over `image_path` when no rendered image is ready. Leaving
      // `original_image_path` pointing at the OLD primary meant the wardrobe
      // card + hero showed the old photo all the way through enrichment +
      // render, and permanently if render failed — breaking the whole point
      // of the swap feature. Tracking the raw-upload column along with
      // `image_path` keeps the display consistent immediately post-swap.
      const { data, error } = await supabase
        .from('garments')
        .update({
          image_path: newPrimary,
          original_image_path: newPrimary,
          secondary_image_path: newSecondary,
          enrichment_status: 'pending',
          ai_raw: null,
          ai_analyzed_at: null,
          ai_provider: null,
          silhouette: null,
          visual_weight: null,
          texture_intensity: null,
          style_archetype: null,
          occasion_tags: null,
          versatility_score: null,
          render_status: 'pending',
          rendered_image_path: null,
          rendered_at: null,
          render_error: null,
        })
        .eq('id', garment.id)
        .eq('user_id', user.id)
        .eq('image_path', previousImagePath)
        .eq('secondary_image_path', previousSecondaryPath)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        // Optimistic-concurrency miss: another write mutated image_path between
        // our read and our UPDATE. Rare but possible (second tab, shared account).
        toast.error(t('common.something_wrong'));
        invalidate();
        return;
      }

      // Kick off enrichment, then render — sequenced via the promise chain
      // inside triggerGarmentPostSaveIntelligence. Codex P2 round 4 caught
      // that the earlier "fire enrichment with skipRender:true + fire render
      // separately in parallel" pattern let the render worker read `ai_raw`
      // BEFORE new enrichment data landed (my swap UPDATE cleared ai_raw).
      // Result: render on stale/minimal metadata with no automatic redo.
      // Threading `renderOptions: { force: true }` through
      // triggerGarmentPostSaveIntelligence ties the `force` flag to the
      // internal `startGarmentRenderInBackground` call that fires AFTER
      // enrichment settles (success OR failure — both branches still render
      // so user isn't stuck). Single source of truth for ordering + full
      // failure-mode recovery tree (402 reset / retryable retry with same
      // nonce + server-state check / non-retryable reset).
      triggerGarmentPostSaveIntelligence({
        garmentId: garment.id,
        storagePath: newPrimary,
        source: 'manual_enhance',
        renderOptions: { force: true },
      });

      hapticSuccess();
      toast.success(t('garment.secondary_swap_success'));
      invalidate();
    } catch (err) {
      logger.error('[SecondaryImageManager] swap failed', err);
      toast.error(t('common.something_wrong'));
    } finally {
      setIsSwapping(false);
    }
  };

  const handleDeleteConfirm = async () => {
    // Re-check busy gate at confirm-time — same rationale as handleSwapConfirm.
    if (isBusy) {
      setDeleteDialogOpen(false);
      showBusyToast();
      return;
    }
    if (!user || !garment.secondary_image_path) return;
    setDeleteDialogOpen(false);
    setIsDeleting(true);

    const path = garment.secondary_image_path;
    try {
      hapticMedium();

      // DB-first-then-storage ordering with a guarded predicate on
      // secondary_image_path. Codex P1 (PR #668 round 2) caught the reverse
      // order's race: if a concurrent swap in another tab promoted `path`
      // from secondary to primary between our read and our storage.remove(),
      // the old order would have deleted the now-live hero asset. Clearing
      // the DB pointer first WHERE secondary_image_path = path ensures we
      // only fall through to the storage delete after the DB row has
      // committed to not referencing `path` anywhere. If the OC miss (zero
      // rows matched), the concurrent actor owns the path — we bail without
      // touching storage.
      const { data, error } = await supabase
        .from('garments')
        .update({ secondary_image_path: null })
        .eq('id', garment.id)
        .eq('user_id', user.id)
        .eq('secondary_image_path', path)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error(t('common.something_wrong'));
        invalidate();
        return;
      }

      // DB pointer is cleared. Safe to delete the storage object — no DB
      // row references it (an edge case: another garment in another user
      // happens to point at the same path. Impossible via the upload
      // convention `${userId}/${garmentId}_secondary.*` which namespaces
      // by owner, so skipping that check).
      try {
        await deleteGarmentImage(path);
      } catch (storageErr) {
        logger.warn(
          '[SecondaryImageManager] storage delete failed after DB clear — orphan bucket object, will sweep via storage-GC cron (Findings Log)',
          storageErr,
        );
      }

      toast.success(t('garment.secondary_delete_success'));
      invalidate();
    } catch (err) {
      logger.error('[SecondaryImageManager] delete failed', err);
      toast.error(t('common.something_wrong'));
    } finally {
      setIsDeleting(false);
    }
  };

  const motionProps = prefersReduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.1 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: DURATION_MEDIUM, ease: EASE_CURVE },
      };

  const hasSecondary = Boolean(garment.secondary_image_path);
  const swapBlocked = isBusy;

  return (
    <motion.div {...motionProps} className="mt-3 px-[var(--page-px)]">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {!hasSecondary ? (
        <Button
          variant="outline"
          size="sm"
          type="button"
          aria-disabled={isBusy}
          onClick={handleAddClick}
          className={`h-11 w-full gap-2 rounded-full border-border/40 text-[12px] font-body ${
            isBusy ? 'opacity-60' : ''
          }`}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
          {t('garment.secondary_add')}
        </Button>
      ) : (
        <div className="space-y-3 rounded-[1.25rem] border border-border/40 p-3">
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-foreground/[0.04]">
              <LazyImage
                imagePath={garment.secondary_image_path ?? undefined}
                alt={t('garment.secondary_title')}
                aspectRatio="square"
                className="h-full w-full !rounded-xl"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="label-editorial text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60">
                {t('garment.secondary_title')}
              </p>
              <p className="mt-1 text-[12px] font-body leading-snug text-muted-foreground/80">
                {t('garment.secondary_add_desc')}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              aria-disabled={swapBlocked}
              onClick={() => {
                if (swapBlocked) {
                  showBusyToast();
                  return;
                }
                hapticLight();
                setSwapDialogOpen(true);
              }}
              className={`flex-1 gap-1.5 rounded-full text-[11px] ${
                swapBlocked ? 'opacity-60' : ''
              }`}
            >
              {isSwapping ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {t('garment.secondary_use_primary')}
            </Button>
            <Button
              variant="quiet"
              size="sm"
              type="button"
              aria-disabled={isBusy}
              onClick={() => {
                if (isBusy) {
                  showBusyToast();
                  return;
                }
                hapticLight();
                setDeleteDialogOpen(true);
              }}
              className={`gap-1.5 rounded-full text-[11px] text-muted-foreground ${
                isBusy ? 'opacity-60' : ''
              }`}
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              {t('garment.secondary_remove')}
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('garment.secondary_swap_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('garment.secondary_swap_confirm_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleSwapConfirm}>
              {t('garment.secondary_use_primary')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('garment.secondary_delete_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('garment.secondary_delete_confirm_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
