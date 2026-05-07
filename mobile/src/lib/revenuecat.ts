// RevenueCat SDK wrapper — M31 PR A.
//
// Owns SDK lifecycle (configure on sign-in, logOut on sign-out) plus the
// thin imperative surface the paywall consumes (fetch offerings, run a
// purchase). Receipt validation, entitlement persistence, and the
// `subscriptions` table mirror are all server-side via the
// `revenuecat_webhook` edge function (M31 PR B).
//
// Defensive on three axes:
//   1. Missing API keys (sandbox keys ship in M44) — log a Sentry breadcrumb
//      and skip configuration so dev builds still boot. Subsequent calls to
//      getOfferings / purchasePackage return null / throw a typed error.
//   2. Web + simulator — Purchases doesn't run there. Guard with
//      `Platform.OS === 'web'` and `Device.isDevice` so the SDK isn't even
//      imported as a runtime dependency on those targets.
//   3. Re-entry — `Purchases.configure` is idempotent in the SDK, but we
//      still de-dupe on the resolved appUserID so a repeat sign-in for the
//      same user doesn't re-init. A different user triggers logOut +
//      re-configure (called from App.tsx).

import { Platform } from 'react-native';
import * as Device from 'expo-device';

import { Sentry } from './sentry';

// Type-only import — the actual native module is gated behind the
// `isPurchasesAvailable()` runtime guard below. This keeps the type surface
// rich without forcing the simulator / web path to load native code.
import type {
  PurchasesPackage,
  PurchasesOffering,
  CustomerInfo,
  PurchasesError,
} from 'react-native-purchases';

export type { PurchasesPackage, PurchasesOffering, CustomerInfo };

// Re-export the typed cancel-detection so call sites don't need to import
// the SDK module themselves (Sentry breadcrumb / cancellation handling
// lives in the hook, not here).
export type RevenueCatPurchaseError = PurchasesError;

// Cache of the resolved appUserID we last configured the SDK with. Used to
// short-circuit redundant configure calls and to detect a "different user
// signed in" transition that requires logOut first.
let configuredFor: string | null = null;

// Lazily-resolved Purchases module reference. Populated once on first
// successful configure; null on web / simulator / missing-key paths.
type PurchasesModule = typeof import('react-native-purchases').default;
let purchasesRef: PurchasesModule | null = null;

// Module-level promise queue — serialises configure / reset calls so a
// rapid sign-out → sign-in sequence can't race the underlying logOut +
// configure. Each lifecycle call chains off the previous one's resolution
// (success OR failure — `.catch(() => {})` so a single transient error
// can't poison the whole chain).
let inFlight: Promise<void> | null = null;
function enqueue(task: () => Promise<void>): Promise<void> {
  const next = (inFlight ?? Promise.resolve()).catch(() => undefined).then(task);
  inFlight = next;
  return next;
}

function isPurchasesSupported(): boolean {
  // Web has no IAP surface; expo-doctor + Metro will still resolve the
  // module but every call no-ops or throws. Simulator returns false from
  // Device.isDevice so we treat it identically.
  if (Platform.OS === 'web') return false;
  if (!Device.isDevice) return false;
  return true;
}

function resolveApiKey(): string | null {
  // Platform-specific keys come from `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` /
  // `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`. Expo's Metro bundler inlines
  // `process.env.EXPO_PUBLIC_*` via static text replacement — dynamic
  // property access (`process.env[name]`) does NOT resolve in production
  // bundles, so the reads MUST be at the call site with dot notation.
  // (Mirrors the supabase.ts comment on the same constraint.)
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? null;
  }
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? null;
  }
  // Generic fallback — useful if a single multi-platform key was provided.
  return process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? null;
}

async function loadPurchasesModule(): Promise<PurchasesModule | null> {
  if (purchasesRef) return purchasesRef;
  try {
    // Dynamic import so web / simulator paths never load the native bridge.
    // Metro statically resolves the specifier; the import itself is gated
    // by `isPurchasesSupported()` upstream.
    const mod = await import('react-native-purchases');
    purchasesRef = mod.default;
    return purchasesRef;
  } catch (err) {
    Sentry.addBreadcrumb({
      category: 'revenuecat',
      level: 'warning',
      message: 'purchases_module_load_failed',
      data: { error: err instanceof Error ? err.message : String(err) },
    });
    return null;
  }
}

/**
 * Configure the RevenueCat SDK with the user's stable appUserID (the
 * Supabase user UUID). Idempotent: a repeat call for the same user is a
 * no-op; a call for a different user triggers an implicit logOut first
 * (mirrors how App.tsx's effect should sequence sign-out → re-configure).
 *
 * Safe to call before the API key is provisioned (sandbox keys ship in M44)
 * — logs a Sentry breadcrumb and returns without throwing. The paywall hook
 * surfaces a friendly error if a purchase is then attempted.
 */
export function configureRevenueCat(userId: string): Promise<void> {
  return enqueue(async () => {
    if (!isPurchasesSupported()) {
      Sentry.addBreadcrumb({
        category: 'revenuecat',
        level: 'info',
        message: 'configure_skipped_unsupported_platform',
        data: { platform: Platform.OS, isDevice: Device.isDevice },
      });
      return;
    }

    const apiKey = resolveApiKey();
    if (!apiKey) {
      // Sandbox / production keys are provisioned in M44 (external setup).
      // Until then dev builds boot without IAP — the breadcrumb makes the
      // missing-config visible in Sentry without crashing.
      Sentry.addBreadcrumb({
        category: 'revenuecat',
        level: 'warning',
        message: 'configure_skipped_missing_api_key',
        data: { platform: Platform.OS },
      });
      return;
    }

    if (configuredFor === userId) return;

    const Purchases = await loadPurchasesModule();
    if (!Purchases) return;

    try {
      if (configuredFor && configuredFor !== userId) {
        // Different user signed in on the same device — clear the prior
        // RevenueCat session before re-configuring so entitlements don't
        // bleed across accounts.
        await Purchases.logOut();
      }
      Purchases.configure({ apiKey, appUserID: userId });
      // Set AFTER configure resolves so an outer resetRevenueCat() that
      // races a configure can't observe a half-initialised SDK as
      // "configured" — the synchronous `configuredFor = null` at the top
      // of resetRevenueCat is the symmetric guarantee for the other
      // direction.
      configuredFor = userId;
      Sentry.addBreadcrumb({
        category: 'revenuecat',
        level: 'info',
        message: 'configured',
        data: { userId },
      });
    } catch (err) {
      // Configuration failures are non-fatal — every downstream call will
      // surface its own error path. Capture for visibility.
      Sentry.captureException(err, {
        tags: { feature: 'revenuecat', step: 'configure' },
      });
    }
  });
}

/**
 * Reset the SDK on sign-out. Idempotent — a no-op if we never configured
 * (e.g. a sign-out fired before the configure effect ran).
 */
export function resetRevenueCat(): Promise<void> {
  // Synchronous flip — any concurrent call to getOfferings / purchase /
  // restore that observes `configuredFor === null` short-circuits before
  // it can hit a half-torn-down SDK. The async logOut runs after, in the
  // serialised queue.
  const wasConfigured = configuredFor !== null;
  configuredFor = null;
  return enqueue(async () => {
    if (!isPurchasesSupported()) return;
    if (!wasConfigured) return;
    const Purchases = purchasesRef ?? (await loadPurchasesModule());
    if (!Purchases) return;
    try {
      await Purchases.logOut();
    } catch (err) {
      // logOut throws if no user is configured — swallow, the SDK is
      // already in the desired state.
      Sentry.addBreadcrumb({
        category: 'revenuecat',
        level: 'info',
        message: 'logout_swallowed',
        data: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  });
}

/**
 * Fetch the current offering — the named bundle of packages the dashboard
 * marks as `current` (typically a monthly + yearly pair). Returns null if
 * the SDK isn't configured or the offering is missing.
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  if (!isPurchasesSupported()) return null;
  if (!configuredFor) return null;
  const Purchases = purchasesRef ?? (await loadPurchasesModule());
  if (!Purchases) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (err) {
    Sentry.captureException(err, {
      tags: { feature: 'revenuecat', step: 'get_offerings' },
    });
    return null;
  }
}

/**
 * Per-plan view of the current offering with intro-offer presence flagged.
 * The paywall consumes this so the CTA copy ("Start 3-day free trial" vs.
 * plain "Subscribe") matches the offering RevenueCat actually ships — if
 * the dashboard removes the intro offer for monthly, the screen MUST stop
 * advertising it (Apple 3.1.1 false-advertising path).
 *
 * `introPriceLabel` is the SDK's localised price string for the intro
 * period (e.g. "Free for 3 days") — render verbatim if present rather than
 * paraphrasing, so the copy localises with the user's StoreKit locale.
 */
export type IntroOfferInfo = {
  pkg: PurchasesPackage;
  hasIntroOffer: boolean;
  introPriceLabel: string | null;
};
export type OfferingsWithIntro = {
  monthly: IntroOfferInfo | null;
  annual: IntroOfferInfo | null;
};

function readIntroOffer(pkg: PurchasesPackage): IntroOfferInfo {
  // Defensive read — `product.introPrice` is optional on the SDK's typed
  // surface (Android promo offers, iOS intro offers, etc. populate it
  // differently across versions). Treat any non-null `priceString` as the
  // signal. A free trial reports priceString = "Free" / "Gratis" / etc.
  const introPrice = (pkg.product as { introPrice?: { priceString?: string } | null })
    .introPrice ?? null;
  const introPriceLabel =
    introPrice && typeof introPrice.priceString === 'string'
      ? introPrice.priceString
      : null;
  return {
    pkg,
    hasIntroOffer: introPrice !== null,
    introPriceLabel,
  };
}

export async function getOfferingsWithIntroOffer(): Promise<OfferingsWithIntro | null> {
  const offering = await getOfferings();
  if (!offering) return null;
  return {
    monthly: offering.monthly ? readIntroOffer(offering.monthly) : null,
    annual: offering.annual ? readIntroOffer(offering.annual) : null,
  };
}

/**
 * Run a purchase for the given package. Returns the customer info on
 * success. On user-cancel, returns null (the typed `userCancelled` flag is
 * the only signal we treat as "soft" — every other error throws). The
 * caller (usePurchaseSubscription) is responsible for polling the
 * `subscriptions` table; the webhook (PR B) writes the entitlement.
 */
export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<{ customerInfo: CustomerInfo } | null> {
  if (!isPurchasesSupported()) {
    throw new Error('REVENUECAT_UNSUPPORTED_PLATFORM');
  }
  if (!configuredFor) {
    throw new Error('REVENUECAT_NOT_CONFIGURED');
  }
  const Purchases = purchasesRef ?? (await loadPurchasesModule());
  if (!Purchases) {
    throw new Error('REVENUECAT_MODULE_UNAVAILABLE');
  }
  try {
    const result = await Purchases.purchasePackage(pkg);
    return { customerInfo: result.customerInfo };
  } catch (err) {
    if (isUserCancelled(err)) return null;
    throw err;
  }
}

/**
 * Restore previously-purchased entitlements. Required by App Store
 * guideline 3.1.1 — every paywall must surface a "Restore Purchases"
 * affordance.
 *
 * Return contract:
 *   * `CustomerInfo`  — SDK round-trip succeeded; caller inspects
 *                       `entitlements.active` to distinguish actual
 *                       restore vs. fresh / never-purchased Apple ID.
 *   * `null`          — unsupported environment (web / simulator /
 *                       missing API key / module load failure) OR the
 *                       user dismissed the App Store / Play Store sign-
 *                       in prompt mid-restore (RevenueCat surfaces this
 *                       as a `userCancelled` purchase-error shape). All
 *                       three collapse to the empty-state UX — caller
 *                       surfaces "no purchases" rather than a transport
 *                       error. No Sentry capture for the cancel path
 *                       (matches `purchasePackage`'s precedent).
 *   * `throw`         — real SDK error (network failure, StoreKit
 *                       timeout, auth issue). Caller's mutation hook
 *                       routes this through `captureMutationError` and
 *                       surfaces a transient-error alert. Distinguished
 *                       from the `null` path so a user on a flaky
 *                       network doesn't see the misleading
 *                       "no purchases" empty-state.
 */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!isPurchasesSupported()) return null;
  if (!configuredFor) return null;
  const Purchases = purchasesRef ?? (await loadPurchasesModule());
  if (!Purchases) return null;
  try {
    return await Purchases.restorePurchases();
  } catch (err) {
    // User dismissed the App Store / Play Store prompt mid-restore.
    // Mirror `purchasePackage`'s precedent: collapse to a clean null
    // (caller treats as the empty-state UX) without Sentry capture.
    // Without this branch, every cancelled restore would land in the
    // re-throw below and surface as a "We couldn't reach the App Store"
    // transport-error alert, which is misleading.
    if (isUserCancelled(err)) {
      Sentry.addBreadcrumb({
        category: 'revenuecat',
        level: 'info',
        message: 'restore_user_cancelled',
      });
      return null;
    }
    // Capture for visibility, then re-throw so the caller can distinguish
    // a transient SDK / network failure from the genuinely-unsupported
    // null-return path above.
    Sentry.captureException(err, {
      tags: { feature: 'revenuecat', step: 'restore' },
    });
    throw err;
  }
}

/**
 * Type guard for the SDK's cancellation signal. `userCancelled === true`
 * is the documented "user dismissed the StoreKit sheet" path; we surface
 * it as a clean cancel (no Sentry log) rather than an error.
 */
export function isUserCancelled(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  // SDK error shape: { code, message, userCancelled, underlyingErrorMessage }
  return (err as { userCancelled?: boolean }).userCancelled === true;
}
