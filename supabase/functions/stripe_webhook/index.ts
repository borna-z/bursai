import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { setMonthlyAllowance } from "../_shared/render-credits.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Inline config
function getStripeConfig() {
  const rawMode = (Deno.env.get('STRIPE_MODE') || 'test').toLowerCase();
  const mode: 'test' | 'live' = rawMode === 'live' ? 'live' : 'test';
  
  if (mode === 'live') {
    return {
      secretKey: Deno.env.get('STRIPE_SECRET_KEY_LIVE') || '',
      webhookSecret: Deno.env.get('STRIPE_WEBHOOK_SECRET_LIVE') || '',
      mode: 'live' as const,
    };
  }
  
  return {
    secretKey: Deno.env.get('STRIPE_SECRET_KEY_TEST') || Deno.env.get('STRIPE_SECRET_KEY') || '',
    webhookSecret: Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST') || Deno.env.get('STRIPE_WEBHOOK_SECRET') || '',
    mode: 'test' as const,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    logStep("Webhook received");

    const stripeConfig = getStripeConfig();
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

              await updateSubscription(serviceClient, userId, subscription, customerId, stripeConfig.mode);
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
            await updateSubscription(serviceClient, profile.id, subscription, customerId, stripeConfig.mode);
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

            // Zero out render credits on cancellation
            const cancelCreditKey = `stripe_allowance_${subscription.id}_canceled`;
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

            // Zero out render credits on payment failure
            const failCreditKey = `stripe_allowance_${invoice.id}_past_due`;
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
  stripeMode: 'test' | 'live'
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

  // Update render credit ledger — 20 monthly renders for active subscribers, 0 otherwise
  const creditAllowance = isPremium ? 20 : 0;
  const creditIdempotencyKey = `stripe_allowance_${subscription.id}_${status}`;
  const creditResult = await setMonthlyAllowance(client, userId, creditAllowance, creditIdempotencyKey);
  if (!creditResult.ok && !creditResult.duplicate) {
    logStep("Warning: failed to set monthly allowance", { userId, allowance: creditAllowance, reason: creditResult.reason });
  }

  logStep("Subscription updated in DB", { userId, plan, status, currentPeriodEnd, stripeMode, creditAllowance });
}
