// DEPRECATED — web-only Stripe path, scheduled for deletion post-launch.
// Retained until web app removal. Do NOT add new callers; mobile uses RevenueCat exclusively.
// N10 hygiene marker: Stripe webhook handler. Subscriptions originated by Stripe (web checkout)
// flow through here; mobile RC purchases land in `revenuecat_webhook` and the two paths
// coexist — see `_shared/rc-event-ordering.ts` for the Stripe-vs-RC arbitration logic.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { setMonthlyAllowance } from "../_shared/render-credits.ts";
import { PREMIUM_MONTHLY_ALLOWANCE } from "../_shared/revenuecat-constants.ts";
import { captureError, makeLogStep } from "../_shared/observability.ts";
import {
  getStripeConfig as getSharedStripeConfig,
  type StripeWebhookConfig,
} from "../_shared/stripe-config.ts";

// N2 — converged on the shared `_shared/observability.ts` `logStep`
// helper. Identical wire format ([STRIPE-WEBHOOK] step - {json}) so
// downstream log-querying tools don't need updating.
const logStep = makeLogStep("STRIPE-WEBHOOK");

/**
 * Webhook-only Stripe config. Reuses the canonical resolver in
 * `_shared/stripe-config.ts` and narrows it to the two fields the
 * webhook actually consumes (`secretKey` + `webhookSecret`); price IDs
 * are checkout-session-only so we don't need them here.
 */
function getWebhookStripeConfig(): StripeWebhookConfig {
  const full = getSharedStripeConfig();
  return {
    secretKey: full.secretKey,
    webhookSecret: full.webhookSecret,
    mode: full.mode,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  console.warn("[deprecated] web-only Stripe edge function called", { fn: "stripe_webhook" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    logStep("Webhook received");

    const stripeConfig = getWebhookStripeConfig();
    logStep("Stripe mode", { mode: stripeConfig.mode });

    if (!stripeConfig.secretKey) throw new Error("Missing Stripe secret key");
    if (!stripeConfig.webhookSecret) throw new Error("Missing webhook secret");

    const stripe = new Stripe(stripeConfig.secretKey, { apiVersion: "2025-08-27.basil" });

    // Get raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      throw new Error("Missing stripe-signature header");
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeConfig.webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logStep("Signature verification failed", { error: message });
      return new Response(JSON.stringify({ error: `Webhook signature verification failed: ${message}` }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Event verified", { type: event.type, id: event.id });

    // Idempotency: atomic insert-or-skip using ON CONFLICT.
    // Prevents race condition where two concurrent requests both pass the
    // select check and proceed to process the same event.
    const { data: inserted, error: insertError } = await serviceClient
      .from('stripe_events')
      .upsert(
        {
          id: event.id,
          event_type: event.type,
          stripe_mode: stripeConfig.mode,
          processed_ok: false,
        },
        { onConflict: 'id', ignoreDuplicates: true }
      )
      .select('id')
      .single();

    // If upsert returned no row, the event already existed — skip processing
    if (insertError || !inserted) {
      logStep("Event already processed (idempotency)", { eventId: event.id });
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        status: 200,
      });
    }

    let processingError: string | null = null;

    try {
      // Handle different event types
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          logStep("Checkout session completed", { sessionId: session.id, customerId: session.customer });

          if (session.mode === "subscription" && session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
            const customerId = session.customer as string;
            
            // Find user by stripe_customer_id or metadata
            let userId = session.metadata?.supabase_user_id;
            
            if (!userId) {
              const { data: profile } = await serviceClient
                .from('profiles')
                .select('id')
                .eq('stripe_customer_id', customerId)
                .single();
              userId = profile?.id;
            }

            if (userId) {
              // Update profile with stripe_customer_id
              await serviceClient
                .from('profiles')
                .update({ stripe_customer_id: customerId })
                .eq('id', userId);

              await updateSubscription(serviceClient, userId, subscription, customerId, stripeConfig.mode, event.id);
            } else {
              logStep("Could not find user", { customerId });
            }
          }
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          logStep("Subscription updated", { subscriptionId: subscription.id, status: subscription.status });

          const customerId = subscription.customer as string;

          const { data: profile } = await serviceClient
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single();

          if (profile) {
            await updateSubscription(serviceClient, profile.id, subscription, customerId, stripeConfig.mode, event.id);
          } else {
            logStep("Could not find user for subscription update", { customerId });
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          logStep("Subscription deleted", { subscriptionId: subscription.id });

          const customerId = subscription.customer as string;
          
          const { data: profile } = await serviceClient
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single();

          if (profile) {
            await serviceClient
              .from('subscriptions')
              .update({
                status: 'canceled',
                plan: 'free',
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', profile.id);

            await serviceClient
              .from('user_subscriptions')
              .update({ plan: 'free', updated_at: new Date().toISOString() })
              .eq('user_id', profile.id);

            // Zero out render credits on cancellation — keyed by event.id so every
            // webhook delivery that moves into "canceled" gets processed independently
            const cancelCreditKey = `stripe_allowance_${event.id}`;
            await setMonthlyAllowance(serviceClient, profile.id, 0, cancelCreditKey);

            logStep("Subscription canceled for user", { userId: profile.id });
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          logStep("Payment failed", { invoiceId: invoice.id, customerId: invoice.customer });

          const customerId = invoice.customer as string;
          
          const { data: profile } = await serviceClient
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single();

          if (profile) {
            // REFUND-SAFE: Set plan to free immediately on payment failure
            await serviceClient
              .from('subscriptions')
              .update({
                status: 'past_due',
                plan: 'free',
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', profile.id);

            await serviceClient
              .from('user_subscriptions')
              .update({ plan: 'free', updated_at: new Date().toISOString() })
              .eq('user_id', profile.id);

            // Zero out render credits on payment failure — keyed by event.id so
            // subsequent recovery events can move the allowance back to 20
            const failCreditKey = `stripe_allowance_${event.id}`;
            await setMonthlyAllowance(serviceClient, profile.id, 0, failCreditKey);

            logStep("Set user to past_due/free", { userId: profile.id });
          }
          break;
        }

        default:
          logStep("Unhandled event type", { type: event.type });
      }
    } catch (err) {
      processingError = err instanceof Error ? err.message : String(err);
      logStep("Processing error", { error: processingError });
      // Mirror to edge_function_errors so alert_check rule 3 can read a real
      // failure rate. The `fn_name` tag is load-bearing — observability.ts
      // uses it to populate `function_name`, which rule 3 filters on with
      // exact match (`function_name = 'stripe_webhook'`).
      captureError("stripe_webhook.processing_failed", err, {
        fn_name: "stripe_webhook",
        event_type: event.type,
        event_id: event.id,
      });
    }

    // Update event log
    await serviceClient
      .from('stripe_events')
      .update({
        processed_at: new Date().toISOString(),
        processed_ok: !processingError,
        error: processingError,
      })
      .eq('id', event.id);

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    captureError("stripe_webhook.unhandled", error, {
      fn_name: "stripe_webhook",
    });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// deno-lint-ignore no-explicit-any
async function updateSubscription(
  client: any,
  userId: string,
  subscription: Stripe.Subscription,
  customerId: string,
  stripeMode: 'test' | 'live',
  eventId: string,
) {
  const status = subscription.status;
  // REFUND-SAFE: Only active/trialing get premium access
  const isPremium = ['active', 'trialing'].includes(status);
  const plan = isPremium ? 'premium' : 'free';
  const priceId = subscription.items.data[0]?.price.id || null;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  // Update subscriptions table
  const { error } = await client
    .from('subscriptions')
    .upsert({
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      status,
      price_id: priceId,
      current_period_end: currentPeriodEnd,
      plan,
      stripe_mode: stripeMode,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) {
    logStep("Error updating subscriptions table", { error: error.message });
  }

  // Also update user_subscriptions for backward compatibility
  await client
    .from('user_subscriptions')
    .update({ plan, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  // Update render credit ledger — PREMIUM_MONTHLY_ALLOWANCE renders for active
  // subscribers, 0 otherwise. Source of truth lives in
  // `_shared/revenuecat-constants.ts` so the Stripe + RevenueCat paths can't
  // drift on the allowance value.
  // Key on event.id (not subscription.id + status) so status transitions like
  // active → past_due → active each trigger their own allowance update instead of
  // being short-circuited as duplicates of the first "active" event.
  const creditAllowance = isPremium ? PREMIUM_MONTHLY_ALLOWANCE : 0;
  const creditIdempotencyKey = `stripe_allowance_${eventId}`;
  const creditResult = await setMonthlyAllowance(client, userId, creditAllowance, creditIdempotencyKey);
  if (!creditResult.ok && !creditResult.duplicate) {
    logStep("Warning: failed to set monthly allowance", { userId, allowance: creditAllowance, reason: creditResult.reason });
  }

  logStep("Subscription updated in DB", { userId, plan, status, currentPeriodEnd, stripeMode, creditAllowance });
}
