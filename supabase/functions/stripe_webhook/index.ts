import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      throw new Error("Missing stripe-signature header");
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logStep("Signature verification failed", { error: message });
      return new Response(JSON.stringify({ error: `Webhook signature verification failed: ${message}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Event verified", { type: event.type, id: event.id });

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout session completed", { sessionId: session.id, customerId: session.customer });

        if (session.mode === "subscription" && session.subscription) {
          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const customerId = session.customer as string;
          
          // Find user by stripe_customer_id
          const { data: profile, error: profileError } = await serviceClient
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single();

          if (profileError || !profile) {
            // Try to find by metadata
            const userId = session.metadata?.supabase_user_id;
            if (!userId) {
              logStep("Could not find user", { customerId });
              break;
            }

            // Update profile with stripe_customer_id
            await serviceClient
              .from('profiles')
              .update({ stripe_customer_id: customerId })
              .eq('id', userId);

            // Update subscriptions table
            await updateSubscription(serviceClient, userId, subscription, customerId);
          } else {
            await updateSubscription(serviceClient, profile.id, subscription, customerId);
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
          await updateSubscription(serviceClient, profile.id, subscription, customerId);
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

          // Also update user_subscriptions for backward compatibility
          await serviceClient
            .from('user_subscriptions')
            .update({ plan: 'free', updated_at: new Date().toISOString() })
            .eq('user_id', profile.id);

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
          await serviceClient
            .from('subscriptions')
            .update({
              status: 'past_due',
              plan: 'free',
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', profile.id);

          // Also update user_subscriptions
          await serviceClient
            .from('user_subscriptions')
            .update({ plan: 'free', updated_at: new Date().toISOString() })
            .eq('user_id', profile.id);

          logStep("Set user to past_due/free", { userId: profile.id });
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// deno-lint-ignore no-explicit-any
async function updateSubscription(
  client: any,
  userId: string,
  subscription: Stripe.Subscription,
  customerId: string
) {
  const status = subscription.status;
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

  logStep("Subscription updated in DB", { userId, plan, status, currentPeriodEnd });
}
