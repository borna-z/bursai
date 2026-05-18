/**
 * Shared constants for the RevenueCat webhook + state machine.
 *
 * Lives in `_shared/` so unit tests and the handler share a single source
 * of truth.
 */

export const PREMIUM_MONTHLY_ALLOWANCE = 100;

export const RC_STRIPE_MODE_MARKER = "revenuecat";

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
