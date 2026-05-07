// useRestorePurchases — wraps RevenueCat's restorePurchases() in a React
// Query mutation so PaywallScreen and SettingsAccountScreen share a single
// implementation. Apple 3.1.1 requires the affordance on every paywall
// surface AND somewhere in the user's account; the hook keeps both call
// sites aligned on the three-outcome contract.
//
// Three outcomes (discriminated union, branched in the screens for UX):
//   * 'restored'     → entitlements.active has at least one entitlement
//   * 'no_purchases' → SDK round-trip succeeded, no active entitlements
//                      (legitimate empty state, or stale local 'premium'
//                      that needs a self-heal refetch)
//   * 'unsupported'  → SDK wrapper returned null (web / simulator /
//                      missing API key / module load failure) OR the
//                      sign-out / sign-in-different-user race short-
//                      circuited mid-flight. Caller surfaces the empty-
//                      state alert.
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
import { captureMutationError } from '../lib/sentry';
import { restorePurchases } from '../lib/revenuecat';

export type RestorePurchasesResult =
  | { status: 'restored' }
  | { status: 'no_purchases' }
  | { status: 'unsupported' };

type RestoreContext = { startUserId: string | null };

export function useRestorePurchases() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // Mirror usePurchaseSubscription — a ref that always reflects the live
  // AuthContext user so mutationFn can detect a user change mid-flight
  // without paying re-render churn for an extra useState.
  const currentUserIdRef = useRef<string | null>(user?.id ?? null);
  currentUserIdRef.current = user?.id ?? null;

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
      if (Object.keys(activeEntitlements).length > 0) {
        return { status: 'restored' };
      }
      return { status: 'no_purchases' };
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
