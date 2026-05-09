// DEPRECATED — web-only Stripe path, scheduled for deletion post-launch.
// Retained until web app removal. Do NOT add new callers; mobile uses RevenueCat exclusively.
// N10 hygiene marker: Stripe env-mode resolver. Consumed only by stripe_webhook and the
// other web-only Stripe edge functions (create_checkout_session, create_portal_session,
// restore_subscription, start_trial). Safe to delete with the rest of the Stripe surface.
//
// Stripe environment configuration helper.
//
// N2 / code-quality-2026-05-08 §3.2 B3: replaced the implicit string-mode
// flag with a discriminated union (`StripeMode`) so call sites that switch
// on `mode` get exhaustiveness checking from TypeScript instead of relying
// on string-comparison hygiene. The runtime shape is unchanged — `mode`
// is still `'test' | 'live'` — but the type-level guarantees are stronger.

/**
 * Discriminated mode tag. Adding `'sandbox'` or any future mode here
 * makes every `switch (config.mode)` in the codebase a compile error
 * until the new arm is handled — see `assertStripeMode` below for the
 * exhaustiveness helper.
 */
export type StripeMode = "test" | "live";

/**
 * Common shape shared by every consumer (webhook + checkout).
 */
interface StripeConfigBase {
  secretKey: string;
  webhookSecret: string;
  mode: StripeMode;
}

/**
 * Full config — checkout-session + portal-session callers need price IDs
 * in addition to the base. The `mode` discriminant carries through so
 * a call like `if (config.mode === "live") { ... }` narrows the rest of
 * the object correctly.
 */
export type StripeConfig =
  | (StripeConfigBase & { mode: "test"; priceIdMonthly: string; priceIdYearly: string })
  | (StripeConfigBase & { mode: "live"; priceIdMonthly: string; priceIdYearly: string });

/**
 * Webhook-only config — `stripe_webhook` doesn't need price IDs (it
 * dispatches on event type, not on which price the user picked). The
 * narrower type prevents a refactor mistake where webhook code starts
 * relying on price IDs that may be empty in some env configurations.
 */
export type StripeWebhookConfig =
  | (StripeConfigBase & { mode: "test" })
  | (StripeConfigBase & { mode: "live" });

/**
 * Resolve `STRIPE_MODE` to the discriminated tag. Defaults to `'test'`
 * for any unrecognized value (matches pre-N2 behavior). Lowercase-only
 * comparison so `Live`/`LIVE` in env files still work.
 */
export function resolveStripeMode(): StripeMode {
  const raw = (Deno.env.get("STRIPE_MODE") || "test").toLowerCase();
  return raw === "live" ? "live" : "test";
}

export function getStripeConfig(): StripeConfig {
  const mode = resolveStripeMode();

  if (mode === "live") {
    return {
      mode: "live",
      secretKey: Deno.env.get("STRIPE_SECRET_KEY_LIVE") || "",
      webhookSecret: Deno.env.get("STRIPE_WEBHOOK_SECRET_LIVE") || "",
      priceIdMonthly: Deno.env.get("STRIPE_PRICE_ID_MONTHLY_LIVE") || "",
      priceIdYearly: Deno.env.get("STRIPE_PRICE_ID_YEARLY_LIVE") || "",
    };
  }

  return {
    mode: "test",
    secretKey: Deno.env.get("STRIPE_SECRET_KEY_TEST") || Deno.env.get("STRIPE_SECRET_KEY") || "",
    webhookSecret: Deno.env.get("STRIPE_WEBHOOK_SECRET_TEST") || Deno.env.get("STRIPE_WEBHOOK_SECRET") || "",
    priceIdMonthly: Deno.env.get("STRIPE_PRICE_ID_MONTHLY_TEST") || Deno.env.get("STRIPE_PRICE_ID_MONTHLY") || "",
    priceIdYearly: Deno.env.get("STRIPE_PRICE_ID_YEARLY_TEST") || Deno.env.get("STRIPE_PRICE_ID_YEARLY") || "",
  };
}

export function validateStripeConfig(config: StripeConfig): string | null {
  if (!config.secretKey) return "Missing Stripe secret key";
  if (!config.priceIdMonthly) return "Missing monthly price ID";
  if (!config.priceIdYearly) return "Missing yearly price ID";
  return null;
}

/**
 * Compile-time exhaustiveness helper. Call from the default branch of a
 * `switch (config.mode)` to force a build failure when a new mode is
 * added but not handled:
 *
 *   switch (config.mode) {
 *     case "test": ...
 *     case "live": ...
 *     default: assertStripeMode(config.mode); // never
 *   }
 */
export function assertStripeMode(value: never): never {
  throw new Error(`Unhandled Stripe mode: ${String(value)}`);
}
