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

import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { captureMutationError, Sentry } from '../lib/sentry';
import { supabase } from '../lib/supabase';
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

async function pollForRestoredEntitlement(
  userId: string,
  signal: AbortSignal,
  getCurrentUserId: () => string | null,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < POLL_MAX_MS) {
    if (signal.aborted) return false;
    await delay(POLL_INTERVAL_MS);
    if (signal.aborted) return false;
    // Sign-out mid-poll race — if the user signed out while we were
    // waiting, treat the poll as cancelled. The mutationFn surfaces this
    // as 'unsupported' so the screen doesn't show "restored" for a
    // session that no longer exists.
    if (getCurrentUserId() !== userId) return false;
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
      return true;
    }
  }
  return false;
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
  // start, aborted on unmount and on a fresh mutation start so a rapid
  // re-tap during the 10s poll window doesn't end up with two concurrent
  // polls writing the same cache.
  const abortRef = useRef<AbortController | null>(null);

  // Unmount cleanup — abort any in-flight poll so an orphan poll doesn't
  // keep ticking after the screen unmounts. Idempotent.
  useEffect(() => () => abortRef.current?.abort(), []);

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
      const synced = await pollForRestoredEntitlement(
        startUserId,
        controller.signal,
        () => currentUserIdRef.current,
      );
      if (synced) return { status: 'restored' };
      // RC said yes; webhook hasn't landed within the window. Caller
      // surfaces an "activating" alert (mirrors the purchase 'pending'
      // path) so the user isn't told "restored" while still locked.
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
