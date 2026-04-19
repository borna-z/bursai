import type { MockRoute } from "./mock-server";

// Stripe mock routes. P0d-ii scaffolding — the array is empty by design.
//
// P0d-iii will populate this when paywall-adjacent flows land (primarily
// render/outfit paths that touch credit reservations, and any test that
// exercises create_checkout_session or the webhook). Fixtures capture
// Stripe test-mode responses (charges, customers, subscriptions) and
// commit under src/test/smoke/fixtures/stripe/<endpoint>.json.
//
// Matching strategy: Stripe's API is RESTful and versioned. Edge functions
// hit `api.stripe.com/v1/<resource>`. Route regex should match on the
// resource path; bodies are form-encoded so dynamic handlers may parse
// the body string to vary response by input if needed.
//
// Example (do not ship until P0d-iii):
//   {
//     method: "POST",
//     pathPattern: /\/v1\/checkout\/sessions/,
//     response: {
//       type: "fixture",
//       filename: "stripe/checkout-session-created.json",
//     },
//   },
export const stripeRoutes: MockRoute[] = [];
