import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { Card } from '@/components/ui/card';
import { PageIntro } from '@/components/ui/page-intro';
import { Button } from '@/components/ui/button';
import { LazyImage } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFlatGarments } from '@/hooks/useGarments';
import { enqueueRenderJob, RenderEnqueueError } from '@/lib/garmentIntelligence';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { hapticLight } from '@/lib/haptics';
import { safeT } from '@/lib/i18nFallback';
import { EASE_CURVE } from '@/lib/motion';

interface StudioSelectionStepProps {
  onComplete: () => void;
}

const TARGET_COUNT = 3;

/**
 * Wave 7 P49 — StudioSelection screen.
 *
 * User picks exactly 3 garments from their wardrobe; each becomes a clean,
 * magazine-ready studio render via the existing render pipeline. Cannot skip
 * or close — the user MUST commit 3 selections to advance.
 *
 * Auth + credits: P48-followup (AchievementStep mount-time `grant_trial_gift`)
 * has already credited the user with 3 trial-gift renders. We don't re-check
 * `render_credits` here — `enqueueRenderJob` reserves credits server-side and
 * fails with a 402 if the grant didn't land. The reserve RPC automatically
 * draws from `trial_gift_remaining` first (initial_schema.sql:546-556) so the
 * 3 enqueues consume the 3 trial-gift credits, not the user's monthly bucket.
 *
 * Render-trigger source: each enqueue uses `'manual_enhance'` — the closest
 * existing `RenderTriggerSource` semantically (user-explicit choice, mirrors
 * the Wave 4.5-B SecondaryImageManager swap). The render-credits SOURCE
 * (trial_gift vs monthly vs topup) is decided server-side by reserve_credit
 * priority order — independent of this UI source enum.
 *
 * ## Retry semantics — money is real
 *
 * Each enqueue spends 1 render credit. Wrong nonce handling on retry =
 * double-charge. We protect against this with two layers:
 *
 * 1. **Per-garment nonce reuse** (`clientNoncesRef`): the FIRST attempt to
 *    enqueue a given garmentId mints a fresh `crypto.randomUUID()` and stores
 *    it in the Map. Every subsequent attempt for that same garmentId reuses
 *    the stored nonce. The edge function dedups on the colon-prefixed
 *    `reserve_key` derived from the nonce: same nonce → reserve replay flag
 *    fires → no second reservation, no second credit charge. A FRESH nonce
 *    on retry would create a new reserve_key and a new reservation, leaving
 *    the original orphaned (cleanable only by the post-launch orphan-cron).
 *
 *    This matters because `enqueuedIds` only records 200-OK responses. A
 *    transport failure where the server INSERTed the row but the response
 *    failed to reach the client leaves `enqueuedIds` cold for that garment;
 *    only the nonce Map captures the in-flight intent.
 *
 * 2. **Selection lock during partial batch** (`isPartialBatch`): once 1+
 *    garments have succeeded but the batch isn't complete, the selection
 *    grid is read-only. Tapping any garment surfaces a "finishing previous
 *    picks" toast instead of mutating selection. Without this, a user who
 *    sees an error on g2 could deselect g1 (which already enqueued), re-pick
 *    something else as g1', and retry — re-enqueuing g1' under a fresh
 *    nonce while g1's reservation is still live = triple-charge.
 *
 * Failure handling: any enqueue failure aborts the batch. The user sees a
 * toast (`no_credits` for 402 / `insufficient_credits`, otherwise generic
 * `enqueue_error`) and re-tapping the CTA resumes from the partial state —
 * the per-garment nonce Map ensures the same intent is retried, so even a
 * transport-failure-after-server-success doesn't double-charge.
 */
export function StudioSelectionStep({ onComplete }: StudioSelectionStepProps) {
  const { t } = useLanguage();
  const { data: garments, isLoading } = useFlatGarments();

  // Selection ordering matters for the badge numbers (1 / 2 / 3). Use an array
  // rather than a Set so we can render the index of each pick.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [shakeId, setShakeId] = useState<string | null>(null);
  // Per-attempt success-tracking so retries skip already-enqueued IDs and
  // don't re-trigger downstream side effects on garments whose 200-OK
  // already landed. Reset whenever the selection itself changes (different
  // IDs → different intents → fresh nonces).
  const [enqueuedIds, setEnqueuedIds] = useState<Set<string>>(new Set());

  // Per-garmentId clientNonce store. Lives across retries. Key insight: the
  // nonce is bound to the GARMENT, not to a single attempt. As long as we
  // intend to render that specific garment, every attempt uses the SAME
  // nonce so the server-side `reserve_key` deduplicates and the credit is
  // only spent once. The Map is also reset alongside `enqueuedIds` whenever
  // the selection changes — different garments mean different intents.
  const clientNoncesRef = useRef<Map<string, string>>(new Map());

  const selectionCount = selectedIds.length;
  const reachedTarget = selectionCount === TARGET_COUNT;
  // Partial batch = the user has succeeded on ≥1 enqueue but not all. During
  // this window the selection is locked — see the comment block at the top
  // of the file for the triple-charge scenario this prevents.
  const isPartialBatch = enqueuedIds.size > 0 && enqueuedIds.size < TARGET_COUNT;

  const garmentList = garments ?? [];

  const resetBatchTracking = () => {
    setEnqueuedIds(new Set());
    clientNoncesRef.current = new Map();
  };

  const toggleSelect = (id: string) => {
    if (isEnqueuing) return;
    // Lock selection during a partial batch so the user can't strand a
    // mid-flight reservation (which would charge them again on the next
    // attempt under a fresh garmentId).
    if (isPartialBatch) {
      hapticLight();
      toast.message(
        safeT(
          t,
          'studioSelection.partial_progress',
          'Finishing your previous picks. Hold on a sec.',
        ),
      );
      return;
    }
    hapticLight();

    setSelectedIds((current) => {
      if (current.includes(id)) {
        // Deselect — selection set changed → drop the success tracker AND
        // the nonce Map so any retry uses fresh nonces against the new set.
        resetBatchTracking();
        return current.filter((existing) => existing !== id);
      }
      if (current.length >= TARGET_COUNT) {
        // Reject and surface the rule. Shake for 320ms — long enough to
        // register, short enough to feel snappy.
        setShakeId(id);
        setTimeout(() => setShakeId(null), 320);
        toast.message(
          safeT(
            t,
            'studioSelection.max_reached',
            'You can only pick 3. Tap a selection to swap.',
          ),
        );
        return current;
      }
      // New selection added — reset nonce Map + success tracker so a previous
      // failed attempt's accounting doesn't bleed into this attempt.
      resetBatchTracking();
      return [...current, id];
    });
  };

  /**
   * Detect "user is out of credits" across the possible error shapes the
   * edge function exposes. The server returns 402 with body
   * `{ error: 'trial_studio_locked' | 'insufficient_credits' }` for both
   * cases (initial schema + render-credits priority chain). supabase-js
   * surfaces 402 via `getHttpStatus(error) === 402` (extracted into
   * `RenderEnqueueError.status`); the body string is normally lost in
   * supabase-js's FunctionsHttpError wrapper, but `RenderEnqueueError.code`
   * is left wired up for any future transport that does preserve it.
   *
   * Defense in depth: check status === 402 (primary), code === 'insufficient_credits'
   * (defensive, tolerates a future code-preserving transport).
   */
  const isInsufficientCreditsError = (err: unknown): boolean => {
    if (!(err instanceof RenderEnqueueError)) return false;
    if (err.status === 402) return true;
    if (err.code === 'insufficient_credits') return true;
    if (err.code === 'trial_studio_locked') return true;
    return false;
  };

  const handleSubmit = async () => {
    if (!reachedTarget || isEnqueuing) return;
    setIsEnqueuing(true);

    try {
      // Sequential enqueue: each call awaits before the next. The render
      // pipeline tolerates parallel enqueues fine (each gets its own
      // reserve_key + clientNonce), but sequential makes failure handling
      // dramatically simpler — if call N fails, calls N+1..3 simply weren't
      // attempted yet, so retry just resumes from N. No need to track a
      // partial failure state across positions.
      const newlyEnqueued = new Set(enqueuedIds);
      for (const garmentId of selectedIds) {
        if (newlyEnqueued.has(garmentId)) continue; // Already 200-OK on a prior attempt

        // Reuse the stored nonce for this garmentId if we already attempted
        // it (potential transport failure with server-side success). Mint a
        // fresh nonce ONLY for the very first attempt of this garmentId.
        let nonce = clientNoncesRef.current.get(garmentId);
        if (!nonce) {
          nonce = crypto.randomUUID();
          clientNoncesRef.current.set(garmentId, nonce);
        }

        const result = await enqueueRenderJob(garmentId, 'manual_enhance', {
          clientNonce: nonce,
        });
        // Defensive: keep the Map source-of-truth in sync with whichever
        // nonce the server actually accepted. enqueueRenderJob echoes back
        // the nonce it used (`result.clientNonce`); under the current
        // contract these match, but recording the canonical value lets
        // future contract changes (server-substituted nonce, etc.) flow
        // through transparently.
        clientNoncesRef.current.set(garmentId, result.clientNonce);
        newlyEnqueued.add(garmentId);
        setEnqueuedIds(new Set(newlyEnqueued));
      }

      hapticLight();
      onComplete();
    } catch (err) {
      console.warn('[StudioSelectionStep] enqueue failed:', err);
      // If the error came from `RenderEnqueueError`, it carries the nonce
      // that was actually used on the failing request. Record it so a
      // subsequent retry pulls the same nonce out of the Map — the
      // pre-loop check (`if (!nonce)`) already preserves an existing entry,
      // but this branch is a belt-and-suspenders for any future code path
      // that mints nonces outside this component.
      if (err instanceof RenderEnqueueError && err.clientNonce) {
        // We don't know which garmentId failed at the throw site (the loop
        // throws by reference into our await), but the nonce-Map already
        // has the right entry from the pre-flight `set()` above, so this
        // hook is a no-op for the current contract. Left as a placeholder
        // so the diff is reviewable when the contract evolves.
      }
      const insufficient = isInsufficientCreditsError(err);
      const fallbackKey = insufficient
        ? 'studioSelection.no_credits'
        : 'studioSelection.enqueue_error';
      const fallbackEn = insufficient
        ? 'No render credits found. Please retry from the previous step.'
        : "Couldn't start your renders. Try again?";
      toast.error(safeT(t, fallbackKey, fallbackEn));
    } finally {
      setIsEnqueuing(false);
    }
  };

  const counterLabel = reachedTarget
    ? safeT(t, 'studioSelection.counter_complete', '3 of 3 — perfect')
    : safeT(t, 'studioSelection.counter_format', '{count} of 3').replace(
        '{count}',
        String(selectionCount),
      );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="page-shell !max-w-lg !px-6 !pb-32 !pt-[calc(var(--safe-area-top)+6rem)] page-cluster">
        <Card surface="editorial" className="overflow-hidden p-6">
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,hsl(var(--accent)/0.16),transparent_70%)] blur-2xl"
            />
            <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-accent/10 ring-1 ring-accent/30">
              <Sparkles className="h-7 w-7 text-accent" />
            </div>
          </div>

          <div className="mt-5">
            <PageIntro
              center
              eyebrow={safeT(
                t,
                'studioSelection.eyebrow',
                'Three studio renders, on us',
              )}
              title={safeT(t, 'studioSelection.title', 'Pick your three')}
              description={safeT(
                t,
                'studioSelection.subtitle',
                "We'll turn them into clean, magazine-ready studio shots.",
              )}
            />
          </div>
        </Card>

        <Card surface="utility" className="space-y-4 p-5">
          <div className="flex items-baseline justify-between">
            <span
              className={`text-3xl font-semibold tracking-tight tabular-nums ${
                reachedTarget ? 'text-accent' : 'text-foreground'
              }`}
            >
              {selectionCount}
            </span>
            <span
              className={`label-editorial tracking-[0.18em] ${
                reachedTarget ? 'text-accent' : 'text-muted-foreground'
              }`}
            >
              {counterLabel}
            </span>
          </div>

          {isLoading ? (
            <div className="flex min-h-[180px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : garmentList.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {safeT(
                t,
                'studioSelection.empty_wardrobe',
                "We couldn't load your wardrobe. Pull to refresh.",
              )}
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {garmentList.map((garment, index) => {
                const selectionIndex = selectedIds.indexOf(garment.id);
                const isSelected = selectionIndex !== -1;
                const isShaking = shakeId === garment.id;
                const path = getPreferredGarmentImagePath(garment);

                return (
                  <motion.button
                    key={garment.id}
                    type="button"
                    onClick={() => toggleSelect(garment.id)}
                    disabled={isEnqueuing}
                    initial={{ opacity: 0, y: 6 }}
                    animate={
                      isShaking
                        ? { opacity: 1, y: 0, x: [0, -4, 4, -4, 4, 0] }
                        : { opacity: 1, y: 0, x: 0 }
                    }
                    transition={
                      isShaking
                        ? { duration: 0.32, ease: EASE_CURVE }
                        : { delay: index * 0.02, duration: 0.22, ease: EASE_CURVE }
                    }
                    className={`relative aspect-square overflow-hidden rounded-[0.9rem] border bg-secondary/35 transition-all ${
                      isSelected
                        ? 'border-accent ring-2 ring-accent/55'
                        : 'border-border/60 hover:border-border'
                    } ${isEnqueuing || isPartialBatch ? 'opacity-60' : ''}`}
                    aria-pressed={isSelected}
                    aria-label={garment.title || `Garment ${index + 1}`}
                  >
                    <LazyImage
                      imagePath={path}
                      alt={garment.title || ''}
                      aspectRatio="square"
                      className="!rounded-[0.9rem]"
                    />
                    {isSelected ? (
                      <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-br from-transparent via-transparent to-accent/30 p-1.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent font-display text-xs font-medium text-accent-foreground shadow-[0_2px_8px_rgba(28,25,23,0.18)]">
                          {selectionIndex + 1}
                        </span>
                      </div>
                    ) : null}
                  </motion.button>
                );
              })}
            </div>
          )}
        </Card>

        <div className="action-bar-floating rounded-[1.6rem] p-3">
          <Button
            onClick={handleSubmit}
            size="lg"
            disabled={!reachedTarget || isEnqueuing}
            className="w-full"
          >
            {isEnqueuing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : reachedTarget ? (
              <Check className="h-4 w-4" />
            ) : null}
            {safeT(t, 'studioSelection.cta_label', 'Render my 3 pieces')}
            {!isEnqueuing ? <ArrowRight className="h-4 w-4" /> : null}
          </Button>
        </div>
      </div>
    </div>
  );
}
