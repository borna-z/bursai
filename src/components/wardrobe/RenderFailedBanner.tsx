import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  enqueueRenderJob,
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
      // Codex P1 rounds 2–6 on PR #661. The banner's single job: decide
      // whether to keep the optimistic 'pending' flip (worker will
      // reconcile) or revert to 'failed' (banner reappears so user can
      // retry).
      //
      // Round 6 punchline: `error.kind` alone isn't enough. `kind='http'`
      // status>=500 is overloaded — enqueue_render_job's TOP-LEVEL catch
      // (around its line 372) returns a generic 500 even when an exception
      // fires AFTER the render_jobs INSERT has already succeeded. In that
      // case the server DID create a row but the client sees 500 →
      // revert → user taps Try Again → fresh clientNonce → second
      // reservation. Double-charge.
      //
      // Fix: stop guessing. For the ambiguous error classes (`transport`
      // and `http:5xx`), query `render_jobs` directly using the nonce to
      // get authoritative server-state. Pattern mirrors
      // `startGarmentRenderInBackground`'s server-state check
      // (garmentIntelligence.ts ~line 521). RLS on `render_jobs` restricts
      // the query to this user's rows; we also filter explicitly on
      // user_id + garment_id + a clientNonce suffix match (reserve_key
      // format is `reserve:<userId>_<garmentId>_<presentation>_<version>_<nonce>`).
      //
      // Default = revert. Only keep 'pending' when we have POSITIVE
      // evidence a row exists. Can't verify (transient DB error,
      // unauthenticated) → revert (safer — worst case is the user sees
      // the banner on an already-queued retry, taps Try Again, and the
      // new reservation is the same-nonce replay so reserve's idempotency
      // catches it).
      let keepPending = false;

      if (
        error instanceof RenderEnqueueError
        && error.clientNonce
        && (error.kind === 'transport' || (error.kind === 'http' && error.status >= 500))
      ) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: existingRow } = await supabase
              .from('render_jobs')
              .select('id')
              .eq('user_id', user.id)
              .eq('garment_id', garmentId)
              .like('reserve_key', `%${error.clientNonce}`)
              .maybeSingle();
            if (existingRow) {
              keepPending = true;
              // Log at warn (not info) because (a) our lint rule allows
              // only warn/error at the client level, and (b) this path is
              // rare enough that it's worth Sentry-visible when it fires.
              console.warn(
                'RenderFailedBanner: render_jobs row exists for ambiguous enqueue failure — keeping pending',
                { garmentId, jobId: existingRow.id, errorKind: error.kind, errorStatus: error.status },
              );
            }
          }
        } catch (verifyErr) {
          // Server-state check itself failed. Fall through to revert —
          // strictly safer than staying at 'pending' for the edge case
          // where the row genuinely doesn't exist.
          console.warn('RenderFailedBanner server-state verify threw, reverting', {
            garmentId,
            error: verifyErr instanceof Error ? verifyErr.message : String(verifyErr),
          });
        }
      }

      if (!keepPending) {
        // Definitive or unverifiable: revert so the banner reappears and
        // the user has a retry affordance.
        await supabase
          .from('garments')
          .update({ render_status: 'failed' } as Record<string, unknown>)
          .eq('id', garmentId);
        queryClient.invalidateQueries({ queryKey: ['garment', garmentId] });

        // Surface specific server error for business denials (402
        // trial-locked / insufficient credits / 429 rate-limit / etc.).
        const message = error instanceof RenderEnqueueError && error.message
          ? error.message
          : t('render.retry_failed');
        toast.error(message);
      } else {
        // Row exists server-side → worker reconciles. Don't touch status.
        queryClient.invalidateQueries({ queryKey: ['garment', garmentId] });
        toast(t('render.retry_started'));
      }

      console.error('RenderFailedBanner retry failed', {
        garmentId,
        keepPending,
        errorKind: error instanceof RenderEnqueueError ? error.kind : null,
        errorStatus: error instanceof RenderEnqueueError ? error.status : null,
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
