import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  enqueueRenderJob,
  isRenderEnqueueRetryable,
  RenderEnqueueError,
} from '@/lib/garmentIntelligence';
import { supabase } from '@/integrations/supabase/client';
import { hapticMedium } from '@/lib/haptics';

interface RenderFailedBannerProps {
  garmentId: string;
  renderStatus?: string | null;
  renderError?: string | null;
  className?: string;
}

/**
 * Wave 3-B F22: user-facing surface for render_status='failed'.
 *
 * Before this, a failed render silently flipped the view back to the
 * original photo with no explanation — users thought the feature was
 * broken or were left wondering if their "regenerate" tap did anything.
 *
 * The banner:
 *   1. Shows a low-key, non-destructive explanation (the original photo
 *      is still their garment — nothing is lost).
 *   2. Offers a "Try again" button that enqueues a fresh render job with
 *      a new clientNonce so the server doesn't idempotency-short-circuit
 *      back to the same failure.
 *   3. Flips the garment's render_status to 'pending' immediately (optimistic)
 *      so the pending overlay takes over and the banner disappears without
 *      a polling round-trip.
 *
 * Gated on render_status==='failed' — the parent can render it unconditionally
 * and it'll no-op for ready/pending/skipped/none garments.
 */
export function RenderFailedBanner({
  garmentId,
  renderStatus,
  renderError,
  className,
}: RenderFailedBannerProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [isRetrying, setIsRetrying] = useState(false);

  if (renderStatus !== 'failed') return null;

  const handleRetry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    hapticMedium();
    try {
      // Optimistic: flip the garment to 'pending' so the shimmer overlay
      // replaces this banner immediately. The enqueue call below reasserts
      // 'pending' anyway — we just don't want the user to wait for the
      // round-trip to see visual feedback.
      await supabase
        .from('garments')
        .update({ render_status: 'pending', render_error: null } as Record<string, unknown>)
        .eq('id', garmentId);
      queryClient.invalidateQueries({ queryKey: ['garment', garmentId] });
      queryClient.invalidateQueries({ queryKey: ['garments'] });

      // force: true — this is an explicit user-requested retry after a
      // known failure. Bypasses the product-ready eligibility gate and
      // the "already ready/rendering/skipped" early-return.
      // Fresh clientNonce: a new logical intent, not a transport retry of
      // the prior failed render (the prior one terminated and its credit
      // was released already).
      await enqueueRenderJob(garmentId, 'retry', { force: true });

      toast.success(t('render.retry_started'));
    } catch (error) {
      // Codex P1 round 2 on PR #661. The error handling here is tricky
      // because `enqueueRenderJob` can throw AFTER the server has already
      // accepted the request:
      //
      //   * Transport failure (fetch rejected before reading the response
      //     body → status=0) — server may have INSERTed render_jobs and
      //     reserved a credit but the client never saw the 200.
      //   * 5xx on the edge function — same: `enqueue_render_job`'s Codex-
      //     hardened flow sometimes completes reserve+insert before a late
      //     error surfaces.
      //
      // If we unconditionally flip the garment back to 'failed' in those
      // cases, the banner reappears, the user clicks "Try again", a FRESH
      // clientNonce is generated, a SECOND reserve_key + render_jobs row
      // lands, and the same intent produces two credit reservations —
      // exactly the double-charge scenario the reserve_key + replay flag
      // exist to prevent.
      //
      // `isRenderEnqueueRetryable` already encodes the classification for
      // the other call sites in garmentIntelligence.ts:
      //   * status === 0 / undefined (transport abort) → retryable → ambiguous
      //   * status >= 500 → retryable → ambiguous
      //   * other (4xx business denials) → definitive rejection → revert safe
      //
      // For ambiguous errors we LEAVE the optimistic `render_status='pending'`
      // flip in place: the shimmer overlay takes over the UI, and the worker's
      // next claim (or stale-claim recovery) writes the authoritative terminal
      // state. If the job genuinely did NOT land server-side, it's covered by
      // the process_render_jobs stuck-render terminalization path (round-16
      // TOCTOU heal). User never sees 'failed' during an ambiguous case, so
      // they never click Try Again a second time.
      const isAmbiguousEnqueueError =
        error instanceof RenderEnqueueError && isRenderEnqueueRetryable(error.status);

      if (!isAmbiguousEnqueueError) {
        // Definitive rejection (e.g. 402 insufficient_credits, 403, 429,
        // 400 validation) OR a non-enqueue error (optimistic UPDATE itself
        // failed, unexpected JS throw). Safe to revert — the server did not
        // create a render job.
        await supabase
          .from('garments')
          .update({ render_status: 'failed' } as Record<string, unknown>)
          .eq('id', garmentId);
        queryClient.invalidateQueries({ queryKey: ['garment', garmentId] });
      } else {
        // Ambiguous: keep the optimistic 'pending'. Just invalidate so the
        // shimmer overlay renders; worker state write wins.
        queryClient.invalidateQueries({ queryKey: ['garment', garmentId] });
      }

      if (isAmbiguousEnqueueError) {
        // Soft toast — we sent the request; the server may or may not have
        // accepted. The UI now shows the pending shimmer so the user knows
        // something is happening. If it turns out the server didn't queue
        // anything, the banner reappears when the worker terminalizes.
        toast(t('render.retry_started'));
      } else {
        // Surface specific server error message for business denials
        // (402 trial-locked / insufficient credits etc.) so users understand
        // the next action. Fall back to generic copy for unknown errors.
        const message = error instanceof RenderEnqueueError && error.message
          ? error.message
          : t('render.retry_failed');
        toast.error(message);
      }

      console.error('RenderFailedBanner retry failed', {
        garmentId,
        ambiguous: isAmbiguousEnqueueError,
        error,
      });
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border border-border/50 bg-background/60 p-3.5 ${className ?? ''}`}
      role="alert"
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-[13px] font-body font-medium text-foreground">{t('render.failed_title')}</p>
        <p className="text-[11px] font-body text-muted-foreground/70">{t('render.failed_hint')}</p>
        {renderError ? (
          <p className="text-[10px] font-body text-muted-foreground/50 pt-0.5 line-clamp-2" title={renderError}>
            {renderError}
          </p>
        ) : null}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full text-[11px] flex-shrink-0"
        onClick={handleRetry}
        disabled={isRetrying}
      >
        {isRetrying ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        ) : (
          <>
            <RotateCcw className="mr-1 h-3 w-3" aria-hidden="true" />
            {t('render.retry')}
          </>
        )}
      </Button>
    </div>
  );
}
