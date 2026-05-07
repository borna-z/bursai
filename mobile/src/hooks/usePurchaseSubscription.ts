// usePurchaseSubscription — wraps the IAP purchase flow + polls the
// `subscriptions` table for the webhook-driven entitlement update.
//
// Shape mirrors mobile's other mutation hooks (`useAddGarment.ts`):
// `useAuth` for the user, `captureMutationError` on the error side,
// React Query invalidation on success.
//
// Flow:
//   1. Call RevenueCat's `getOfferings()` and pull the requested package.
//   2. Run `purchasePackage()`. If the user dismisses the StoreKit sheet,
//      the SDK returns `userCancelled === true` — we surface a clean
//      `'cancelled'` status without throwing or hitting Sentry.
//   3. On a successful StoreKit purchase, the receipt is forwarded to the
//      RevenueCat webhook (PR B) which upserts the matching `subscriptions`
//      row. The mobile client polls the table every 1s for up to 10s; if
//      the row reflects the new entitlement we resolve `'success'`,
//      otherwise we resolve `'pending'` and let the paywall surface a
//      "we'll see it within a minute" message.
//   4. On any other error (network, StoreKit failure, etc.), throw so
//      `captureMutationError` records it.
//
// Returning a discriminated union (rather than throwing on cancel /
// pending) lets the paywall branch on UX without try/catch noise. Real
// errors still throw and bubble to React Query's `onError`.

import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { captureMutationError, Sentry } from '../lib/sentry';
import { supabase } from '../lib/supabase';
import {
  getOfferings,
  isUserCancelled,
  purchasePackage,
  type PurchasesPackage,
} from '../lib/revenuecat';

export type PackageType = 'monthly' | 'yearly';

export type PurchaseResult =
  | { status: 'success' }
  | { status: 'pending'; message: 'webhook delay' }
  | { status: 'cancelled' };

// 10 seconds at 1s intervals = 10 polls. Generous enough for the typical
// 1–3s webhook latency without dragging out cancellation UX. After the
// window expires we resolve `'pending'` and the paywall surfaces an
// "activating in the background" alert.
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

async function findRevenueCatPackage(
  packageType: PackageType,
): Promise<PurchasesPackage | null> {
  const offering = await getOfferings();
  if (!offering) return null;
  // RevenueCat exposes the standard packages via `monthly` / `annual`
  // accessors on the offering. `availablePackages` is the raw list — we
  // fall back to it for non-standard identifiers (custom packages set up
  // in the dashboard for promo pricing, etc.).
  if (packageType === 'monthly') {
    if (offering.monthly) return offering.monthly;
  } else {
    if (offering.annual) return offering.annual;
  }
  // Fallback: scan available packages for one whose identifier matches.
  const wanted = packageType === 'yearly' ? ['$rc_annual', 'annual', 'yearly'] : ['$rc_monthly', 'monthly'];
  for (const pkg of offering.availablePackages) {
    if (wanted.includes(pkg.identifier)) return pkg;
  }
  return null;
}

async function pollForEntitlement(
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
    // as a typed error so the screen doesn't end up showing "Subscription
    // active" for a session that no longer exists.
    if (getCurrentUserId() !== userId) return false;
    const { data, error } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      // Transient SELECT failures don't abort the poll — keep trying. The
      // outer mutation throws if Supabase is permanently unreachable via
      // the standard error path; here we record a breadcrumb so Sentry
      // shows the upstream error before the (eventual) user-visible
      // pending / generic-error path.
      Sentry.addBreadcrumb({
        category: 'subscription',
        level: 'warning',
        message: 'poll_error',
        data: { code: (error as { code?: string }).code ?? 'unknown' },
      });
      continue;
    }
    if (data && isPremiumActiveRow(data as { plan: string | null; status: string | null })) {
      return true;
    }
  }
  return false;
}

export function usePurchaseSubscription() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // Stable ref so the poll loop can re-check the current user.id without
  // closing over a stale value from `mutationFn`'s opening frame. Updated
  // every render — cheap (a single ref assignment).
  const currentUserIdRef = useRef<string | null>(user?.id ?? null);
  currentUserIdRef.current = user?.id ?? null;
  // AbortController for the in-flight poll. Created on each mutation
  // start, aborted on unmount and on a fresh mutation start (so a user
  // who taps Subscribe twice doesn't end up with two overlapping polls).
  const abortRef = useRef<AbortController | null>(null);

  // Unmount cleanup — abort any in-flight poll so React Query's stale
  // mutation doesn't keep ticking after the screen unmounts. Idempotent.
  useEffect(() => () => abortRef.current?.abort(), []);

  return useMutation<PurchaseResult, unknown, { packageType: PackageType }>({
    mutationFn: async ({ packageType }): Promise<PurchaseResult> => {
      if (!user) throw new Error('Not authenticated');
      // Capture the user id at mutation start. After the StoreKit sheet
      // resolves, we re-check against the current AuthContext value — if
      // the user signed out mid-purchase (rare but observable on long
      // StoreKit sheets), bail with a typed error so the screen surfaces
      // a generic alert rather than activating a subscription for a
      // session that no longer exists.
      const startUserId = user.id;

      // Reset the abort controller for this attempt — abort any prior
      // in-flight poll, then create a fresh signal for the new one.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const pkg = await findRevenueCatPackage(packageType);
      if (!pkg) {
        // No offering / package — surface as a real error so the paywall
        // can show a generic-error toast. Sandbox-key gaps (M44) typically
        // land here on dev builds.
        throw new Error('REVENUECAT_PACKAGE_UNAVAILABLE');
      }

      let purchaseResult: { customerInfo: unknown } | null;
      try {
        purchaseResult = await purchasePackage(pkg);
      } catch (err) {
        // `purchasePackage` already converts the typed-cancel into a null
        // return; anything reaching here is a real failure unless the SDK
        // surfaces userCancelled differently. Belt-and-braces re-check.
        if (isUserCancelled(err)) {
          return { status: 'cancelled' };
        }
        throw err;
      }

      if (!purchaseResult) {
        // User dismissed the StoreKit sheet.
        return { status: 'cancelled' };
      }

      // Sign-out-mid-purchase race — between the StoreKit sheet opening
      // and resolving, the user could have signed out. Treat as a clean
      // cancellation so the paywall doesn't show "Subscription active"
      // for a session that no longer holds the entitlement.
      if (currentUserIdRef.current !== startUserId) {
        return { status: 'cancelled' };
      }

      // Receipt is now forwarded to RevenueCat which fires the webhook.
      // Poll the `subscriptions` row for the entitlement transition.
      const synced = await pollForEntitlement(
        startUserId,
        controller.signal,
        () => currentUserIdRef.current,
      );
      if (synced) return { status: 'success' };
      return { status: 'pending', message: 'webhook delay' };
    },
    onSuccess: (result) => {
      // Refetch the row regardless — `'pending'` still benefits from a
      // background refresh (the webhook may land between our last poll
      // and the next screen mount).
      queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] });
      if (result.status === 'success') {
        // Ensure dependent queries (gating helpers, profile stats) pick
        // up the new entitlement.
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
      }
    },
    onError: (err) => {
      // User-cancelled flows resolve cleanly inside mutationFn — anything
      // that reaches onError is a real failure. Tag it for Sentry.
      captureMutationError('usePurchaseSubscription')(err);
    },
  });
}
