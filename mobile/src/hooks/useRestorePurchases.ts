// useRestorePurchases — wraps RevenueCat's restorePurchases() in a React
// Query mutation so PaywallScreen and SettingsAccountScreen share a single
// implementation. Apple 3.1.1 requires the affordance on every paywall
// surface AND somewhere in the user's account; the hook keeps both call
// sites aligned on the four-outcome contract.
//
// Four outcomes (discriminated union, branched in the screens for UX):
//   * 'restored'         → RevenueCat returned active entitlements AND the
//                          mirrored `subscriptions` row in Supabase
//                          reflects the active entitlement (caller can
//                          fully unlock the UI without a follow-up poll)
//   * 'restored_pending' → RevenueCat returned active entitlements but the
//                          RevenueCat webhook hasn't upserted the
//                          `subscriptions` row yet within the 10s polling
//                          window. Caller surfaces an "Activating in the
//                          background" alert — mirrors the purchase
//                          'pending' UX (paywall.activating.*) so the
//                          user isn't told "restored" while still locked.
//   * 'no_purchases'     → SDK round-trip succeeded, no active
//                          entitlements (legitimate empty state, or stale
//                          local 'premium' that needs a self-heal refetch)
//   * 'unsupported'      → SDK wrapper returned null (web / simulator /
//                          missing API key / module load failure) OR the
//                          sign-out / sign-in-different-user race short-
//                          circuited mid-flight. Caller surfaces the
//                          empty-state alert.
//
// Real SDK / network errors propagate through `onError` (the wrapper
// re-throws after Sentry-capture), so `captureMutationError` tags them
// and the call site shows a transient-failure alert distinct from the
// empty-state.
//
// The hook captures `startUserId` per-mutation and threads it through
// TanStack's `context` so cache invalidations always target the user
// who actually triggered the restore — protects against a sign-out +
// different-user-sign-in race re-keying the closure mid-flight. A
// `currentUserIdRef` updated every render lets `mutationFn` short-
// circuit to 'unsupported' if the active user flips between mutate
// start and SDK resolve, suppressing both invalidation and the success
// alert for a stale tap.

import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { captureMutationError, Sentry } from '../lib/sentry';
import { supabase, supabaseUrl } from '../lib/supabase';
import { restorePurchases } from '../lib/revenuecat';

export type RestorePurchasesResult =
  | { status: 'restored' }
  | { status: 'restored_pending' }
  | { status: 'no_purchases' }
  | { status: 'unsupported' };

type RestoreContext = { startUserId: string | null };

// Mirror usePurchaseSubscription's poll window: 10 seconds at 1s intervals.
// Long enough to absorb typical 1–3s webhook latency without dragging out
// the alert UX; resolves to 'restored_pending' if the row hasn't
// transitioned by then.
const POLL_INTERVAL_MS = 1000;
const POLL_MAX_MS = 10_000;

const PREMIUM_PLAN_VALUES = new Set<string>(['premium', 'monthly', 'yearly']);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPremiumActiveRow(row: {
  plan: string | null;
  status: string | null;
}): boolean {
  if (!row.plan || !row.status) return false;
  if (row.status === 'trialing') return true;
  if (row.status !== 'active') return false;
  return PREMIUM_PLAN_VALUES.has(row.plan);
}

// Tri-state poll result so the caller can distinguish webhook-delay
// (acceptable, surface as 'restored_pending') from a stale-tap race
// (cancellation / sign-out, must NOT show the success-pending alert).
// Codex M33 review B2 — pre-fix the poll returned boolean and treated
// every false as 'restored_pending', which let the success path fire
// for a tap whose user already changed mid-poll.
type PollOutcome = 'synced' | 'timeout' | 'cancelled';

// Server-side reconciliation outcome — the result of calling
// `revenuecat_webhook?action=sync` after the local poll times out.
// Mapped from the edge function's response codes / shapes:
//   'active'     → 200 with state.plan === 'premium' (RC says active)
//   'inactive'   → 200 with state.plan === 'free'    (RC says inactive)
//                  ALSO 404 (rc_subscriber_not_found) — RC has no record
//                  of this app_user_id, so they're definitively not active.
//   'pending'    → 503 (sync_unconfigured) — REST API key not provisioned
//                  yet (M44). Client falls back to existing
//                  'restored_pending' UX with no regression.
//                  ALSO any 5xx / network failure — best-effort sync.
//                  ALSO transient errors thrown out of callEdgeFunction.
type SyncOutcome = 'active' | 'inactive' | 'pending';

type SyncResponseBody = {
  ok?: boolean;
  reason?: string;
  state?: { plan?: string | null; status?: string | null };
};

/**
 * Best-effort server-side reconciliation against RevenueCat. Called when
 * the local `subscriptions` poll times out — the SDK said the user has
 * active entitlements but the webhook hasn't materialised the row.
 *
 * Never throws — every failure mode collapses to 'pending', preserving
 * the pre-sync `restored_pending` UX.
 *
 * Codex review on PR #768 surfaced this gap: relying solely on a future
 * webhook delivery means a misconfigured / down RC webhook leaves the
 * user locked indefinitely. The sync path queries RC's REST API
 * server-side and upserts the row directly.
 */
async function syncSubscriptionWithRevenueCat(
  startAccessToken: string | null,
): Promise<SyncOutcome> {
  // Bypass `callEdgeFunction` and direct-fetch with the captured token.
  // `callEdgeFunction` always reads the CURRENT supabase session on each
  // call — if the user dismissed the paywall and signed out (or a
  // different user signed in) during the 10s poll, the sync would
  // authenticate as the new user and reconcile their row using data
  // intended for the original tapper (Codex round 13 P1 cross-user
  // contamination). Pinning the Authorization header to the token
  // captured at mutate-start means the sync edge function's `getUser()`
  // resolves to the original user; if their token has been revoked
  // (sign-out), RC sync returns 401 → we map to 'pending' and the
  // original user's data simply isn't reconciled (acceptable best-
  // effort behaviour).
  if (!startAccessToken) {
    // No token captured (e.g., session was already null at mutate-
    // start) — skip the sync entirely. The empty-entitlements
    // / poll-timeout caller falls back to its existing UX.
    return 'pending';
  }
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/revenuecat_webhook?action=sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${startAccessToken}`,
        },
        body: '{}',
      },
    );
    // 404 from the edge function = RC has no record of this
    // app_user_id. Definitively not active.
    if (response.status === 404) {
      return 'inactive';
    }
    // 503 (sync_unconfigured) and 5xx (rc_fetch_failed / rc_upstream_5xx
    // / rc_bad_response / db_*) all degrade gracefully to 'pending'.
    // 401 (revoked token) ditto — original user's session ended
    // mid-flight, sync isn't applicable anymore.
    if (!response.ok) {
      Sentry.addBreadcrumb({
        category: 'subscription',
        level: 'warning',
        message: 'restore_sync_fallback',
        data: { status: response.status },
      });
      return 'pending';
    }
    let data: SyncResponseBody | null = null;
    try {
      data = (await response.json()) as SyncResponseBody;
    } catch {
      return 'pending';
    }
    if (data && data.ok === true && data.state) {
      const plan = data.state.plan ?? null;
      const status = data.state.status ?? null;
      if (
        (plan === 'premium' || plan === 'monthly' || plan === 'yearly') &&
        (status === 'active' || status === 'trialing')
      ) {
        return 'active';
      }
      // ok=true with inactive state means RC genuinely says they're not
      // active — surface as no_purchases at the call site.
      return 'inactive';
    }
    // Unexpected ok=false body without a thrown error — treat as pending.
    return 'pending';
  } catch (err) {
    // Network / timeout / DNS / TLS errors — all degrade to 'pending'.
    Sentry.addBreadcrumb({
      category: 'subscription',
      level: 'warning',
      message: 'restore_sync_fallback',
      data: { name: err instanceof Error ? err.name : 'unknown' },
    });
    return 'pending';
  }
}

async function pollForRestoredEntitlement(
  userId: string,
  signal: AbortSignal,
  getCurrentUserId: () => string | null,
): Promise<PollOutcome> {
  const start = Date.now();
  while (Date.now() - start < POLL_MAX_MS) {
    if (signal.aborted) return 'cancelled';
    await delay(POLL_INTERVAL_MS);
    if (signal.aborted) return 'cancelled';
    // Sign-out / sign-in-different-user mid-poll — treat as a stale
    // restore. Caller surfaces 'unsupported' so neither the success
    // alert nor the cache invalidation fires for the new session.
    if (getCurrentUserId() !== userId) return 'cancelled';
    const { data, error } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      // Transient SELECT failures don't abort the poll — keep trying.
      // Permanent supabase outages will throw out of the outer mutation
      // and route through onError. Breadcrumb here for triage richness.
      Sentry.addBreadcrumb({
        category: 'subscription',
        level: 'warning',
        message: 'restore_poll_error',
        data: { code: (error as { code?: string }).code ?? 'unknown' },
      });
      continue;
    }
    if (
      data &&
      isPremiumActiveRow(data as { plan: string | null; status: string | null })
    ) {
      return 'synced';
    }
  }
  return 'timeout';
}

export function useRestorePurchases() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // Mirror usePurchaseSubscription — a ref that always reflects the live
  // AuthContext user so mutationFn can detect a user change mid-flight
  // without paying re-render churn for an extra useState.
  const currentUserIdRef = useRef<string | null>(user?.id ?? null);
  currentUserIdRef.current = user?.id ?? null;
  // AbortController for the in-flight poll — created on each mutation
  // start and aborted only when a fresh mutation starts (so a rapid
  // re-tap during the poll window doesn't run two concurrent polls).
  // Intentionally NOT aborted on unmount: TanStack Query mutations
  // continue past the source component's unmount, and the hook-level
  // `onSuccess` still fires when the poll resolves. Aborting on unmount
  // (Codex round 9 finding) caused the poll to return 'cancelled' →
  // mutation 'unsupported' → no cache invalidation, so a webhook that
  // landed seconds after the user dismissed the paywall left the
  // subscription cache stale until a manual refresh. Letting the poll
  // run to completion preserves the documented background-unlock
  // behaviour.
  const abortRef = useRef<AbortController | null>(null);

  return useMutation<RestorePurchasesResult, unknown, void, RestoreContext>({
    onMutate: async (): Promise<RestoreContext> => {
      // Capture the active user id at mutation start so onSuccess can
      // invalidate the right cache key even if AuthContext flips between
      // here and the SDK round-trip resolving.
      return { startUserId: user?.id ?? null };
    },
    mutationFn: async (): Promise<RestorePurchasesResult> => {
      const startUserId = user?.id;
      if (!startUserId) {
        // Unreachable behind protected-route nav, but if a sign-out
        // raced the tap, surface 'unsupported' so the screen shows a
        // graceful empty-state alert.
        return { status: 'unsupported' };
      }

      // Capture the auth token at mutation start. The mutationFn is
      // allowed to outlive the screen's mount lifetime (round 9: we
      // intentionally don't abort on unmount so background-unlock keeps
      // working), and the supabase client's session can flip from under
      // us if the user signs out mid-mutation. Pinning the access token
      // here means the eventual sync edge-function call authenticates
      // as the user who actually tapped Restore, not whoever's session
      // is current when the call lands. Codex round 13 P1.
      const startSession = await supabase.auth.getSession();
      const startAccessToken = startSession.data.session?.access_token ?? null;

      // Reset the abort controller for this attempt — abort any prior
      // in-flight poll, then create a fresh signal for the new one.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const customerInfo = await restorePurchases();
      // Sign-out / sign-in-different-user race — active user flipped
      // between mutate-start and SDK resolve. Skip both invalidation
      // and the success alert.
      if (currentUserIdRef.current !== startUserId) {
        return { status: 'unsupported' };
      }
      if (customerInfo === null) {
        // Wrapper returned null — web / simulator / missing API key /
        // module load failure. Real SDK / network errors throw and route
        // through onError.
        return { status: 'unsupported' };
      }
      const activeEntitlements = customerInfo.entitlements?.active ?? {};
      if (Object.keys(activeEntitlements).length === 0) {
        // RC says no active entitlements. That is a definitive
        // source-of-truth answer: this Apple ID has no Apple-side
        // purchases to restore. Best-effort sync to reconcile the
        // server-side `subscriptions` row (downgrade a stale
        // 'premium' / 'active' row left by a missed EXPIRATION or
        // TRANSFER webhook) — but DON'T promote a sync transport
        // failure into `'restored_pending'`. That would show the
        // activating-in-the-background UX with the paywall dismiss,
        // which is misleading when there is genuinely nothing to
        // activate (Codex round 10). Stale-row reconciliation
        // continues via the webhook or a subsequent sync tap; UX
        // here stays truthful.
        await syncSubscriptionWithRevenueCat(startAccessToken);
        // Re-check user identity after the sync round-trip — sign-out
        // mid-sync should suppress the empty-state alert per the same
        // race-protection contract used in the timeout path below.
        if (currentUserIdRef.current !== startUserId) {
          return { status: 'unsupported' };
        }
        return { status: 'no_purchases' };
      }

      // RC says the user has active entitlements. The Supabase
      // `subscriptions` row is the actual source of truth that
      // `enforceSubscription` and `useSubscription` gate on, and it's
      // populated server-side by the RevenueCat webhook (M31 PR B). On
      // first restore (esp. after re-install) the webhook may not have
      // upserted the row yet — invalidating + dismissing the paywall
      // immediately would leave the user back in the app still locked
      // with no later refetch tied to the webhook. Poll the row until
      // it reflects the entitlement, mirroring usePurchaseSubscription.
      const pollResult = await pollForRestoredEntitlement(
        startUserId,
        controller.signal,
        () => currentUserIdRef.current,
      );
      if (pollResult === 'synced') return { status: 'restored' };
      if (pollResult === 'cancelled') {
        // User changed (sign-out / sign-in-different-user) or the abort
        // signal fired during the poll. Skip both invalidation and the
        // success alert so a stale restore doesn't surface as "activating"
        // for the new session. Mirrors the pre-poll user-change short-
        // circuit above.
        return { status: 'unsupported' };
      }
      // pollResult === 'timeout' — RC said yes; webhook hasn't landed
      // within the window. Before falling back to the `restored_pending`
      // UX, escalate to the server-side sync path
      // (`revenuecat_webhook?action=sync`) which queries RC's REST API
      // and upserts the `subscriptions` row directly. Closes the failure
      // mode where the webhook never delivers (RC outage, dashboard
      // misconfig, exhausted retries) — see findings-log 2026-05-08
      // Codex round 2 on PR #768.
      //
      // After a successful sync, re-check the AuthContext user — a
      // sign-out-during-sync race must not surface either the success
      // alert or the cache invalidation for the new session.
      const syncOutcome = await syncSubscriptionWithRevenueCat(startAccessToken);
      if (currentUserIdRef.current !== startUserId) {
        return { status: 'unsupported' };
      }
      if (syncOutcome === 'active') {
        return { status: 'restored' };
      }
      if (syncOutcome === 'inactive') {
        // RC's source of truth says no active entitlements. The SDK's
        // earlier `active` reading was stale (cached CustomerInfo);
        // surface as no_purchases so the screen shows the empty-state
        // alert rather than an activating-in-background message that
        // will never resolve.
        return { status: 'no_purchases' };
      }
      // syncOutcome === 'pending' — sync was unavailable (503
      // sync_unconfigured pre-M44) or transient-failed. Fall back to
      // the existing pre-sync UX so nothing regresses.
      return { status: 'restored_pending' };
    },
    onSuccess: (result, _vars, context) => {
      // Skip invalidation entirely for 'unsupported' — the SDK gave us
      // no fresh ground truth (or the user changed mid-flight, in which
      // case re-targeting the new user's cache would be flat-out wrong).
      if (result.status === 'unsupported') return;
      // Use the captured startUserId (NOT user?.id from the closure) —
      // a sign-out + sign-in-as-different-user during the SDK call would
      // re-target the new user's cache key, which is incorrect.
      const userId = context?.startUserId;
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: ['subscription', userId] });
      // Prefix-invalidate so sibling caches keyed by ['subscription', …]
      // (gating helpers, profile-stats bundles) re-derive against the
      // refreshed row. Mirrors usePurchaseSubscription.onSuccess.
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
    onError: captureMutationError('useRestorePurchases'),
  });
}
