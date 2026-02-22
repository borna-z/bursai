import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RESTORE-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Inline config
function getStripeConfig() {
  const rawMode = (Deno.env.get('STRIPE_MODE') || 'test').toLowerCase();
  const mode: 'test' | 'live' = rawMode === 'live' ? 'live' : 'test';
  
  if (mode === 'live') {
    return {
      secretKey: Deno.env.get('STRIPE_SECRET_KEY_LIVE') || '',
      mode: 'live' as const,
    };
  }
  
  return {
    secretKey: Deno.env.get('STRIPE_SECRET_KEY_TEST') || Deno.env.get('STRIPE_SECRET_KEY') || '',
    mode: 'test' as const,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeConfig = getStripeConfig();
    logStep("Stripe mode", { mode: stripeConfig.mode });

    if (!stripeConfig.secretKey) throw new Error("Missing Stripe secret key");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("No authorization header provided");
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      throw new Error(`Authentication error: ${claimsError?.message || 'No user'}`);
    }
    const user = { id: claimsData.claims.sub as string, email: claimsData.claims.email as string };
    
    if (!user.email) {
      throw new Error("User email not available");
    }
    
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeConfig.secretKey, { apiVersion: "2025-08-27.basil" });
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Find Stripe customer by email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Ingen prenumeration hittades",
        plan: 'free',
        status: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Update profile with stripe_customer_id
    await serviceClient
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id);

    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      // No subscription - update to free
      await serviceClient
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          status: null,
          plan: 'free',
          stripe_mode: stripeConfig.mode,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      await serviceClient
        .from('user_subscriptions')
        .update({ plan: 'free', updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      logStep("No active subscription, set to free");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Ingen aktiv prenumeration",
        plan: 'free',
        status: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const subscription = subscriptions.data[0];
    const status = subscription.status;
    const isPremium = ['active', 'trialing'].includes(status);
    const plan = isPremium ? 'premium' : 'free';
    const priceId = subscription.items.data[0]?.price.id || null;
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

    // Update subscriptions table
    await serviceClient
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        status,
        price_id: priceId,
        current_period_end: currentPeriodEnd,
        plan,
        stripe_mode: stripeConfig.mode,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    // Update user_subscriptions for backward compatibility
    await serviceClient
      .from('user_subscriptions')
      .update({ plan: plan as 'free' | 'premium', updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    logStep("Subscription restored", { userId: user.id, plan, status, currentPeriodEnd });

    return new Response(JSON.stringify({ 
      success: true, 
      message: isPremium ? "Premium återställd!" : "Prenumeration hittades men är inte aktiv",
      plan,
      status,
      currentPeriodEnd,
    }), {
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
