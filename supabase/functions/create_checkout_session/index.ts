import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { CORS_HEADERS, resolveAppOrigin } from "../_shared/cors.ts";
import { checkIdempotency, storeIdempotencyResult } from "../_shared/idempotency.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

// Inline config to avoid import issues
function getStripeConfig() {
  const rawMode = (Deno.env.get('STRIPE_MODE') || 'test').toLowerCase();
  const mode: 'test' | 'live' = rawMode === 'live' ? 'live' : 'test';
  
  if (mode === 'live') {
    return {
      secretKey: Deno.env.get('STRIPE_SECRET_KEY_LIVE') || '',
      priceIdMonthly: Deno.env.get('STRIPE_PRICE_ID_MONTHLY_LIVE') || '',
      priceIdYearly: Deno.env.get('STRIPE_PRICE_ID_YEARLY_LIVE') || '',
      mode: 'live' as const,
    };
  }
  
  return {
    secretKey: Deno.env.get('STRIPE_SECRET_KEY_TEST') || Deno.env.get('STRIPE_SECRET_KEY') || '',
    priceIdMonthly: Deno.env.get('STRIPE_PRICE_ID_MONTHLY_TEST') || Deno.env.get('STRIPE_PRICE_ID_MONTHLY') || '',
    priceIdYearly: Deno.env.get('STRIPE_PRICE_ID_YEARLY_TEST') || Deno.env.get('STRIPE_PRICE_ID_YEARLY') || '',
    mode: 'test' as const,
  };
}

interface CheckoutRequest {
  plan: 'monthly' | 'yearly';
  locale?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // Return cached response for duplicate idempotent requests
  const cachedResponse = checkIdempotency(req);
  if (cachedResponse) {
    logStep("Returning cached idempotent response");
    return cachedResponse;
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

    // Create anon client to verify user
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      throw new Error(`Authentication error: ${userError?.message || 'No user'}`);
    }
    
    if (!user.email) {
      throw new Error("User email not available");
    }
    
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Service client for DB operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limiting: max 5 attempts per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await serviceClient
      .from('checkout_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo);

    if (!countError && count !== null && count >= 5) {
      logStep("Rate limit exceeded", { userId: user.id, attempts: count });
      return new Response(
        JSON.stringify({ error: "Too many attempts. Please wait a moment before trying again." }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" }, status: 429 }
      );
    }

    // Log checkout attempt
    await serviceClient.from('checkout_attempts').insert({ user_id: user.id });

    // Parse request body
    const body = await req.json() as CheckoutRequest;
    const { plan, locale } = body;
    
    if (!plan || !['monthly', 'yearly'].includes(plan)) {
      throw new Error("Invalid plan. Must be 'monthly' or 'yearly'");
    }

    // Determine price directly from environment-configured Stripe price IDs
    const priceId = plan === 'monthly' ? stripeConfig.priceIdMonthly : stripeConfig.priceIdYearly;
    if (!priceId) {
      throw new Error(`Missing price ID for ${plan} plan`);
    }
    logStep("Selected price", { plan, priceId, locale, mode: stripeConfig.mode });

    // Initialize Stripe
    const stripe = new Stripe(stripeConfig.secretKey, { apiVersion: "2025-08-27.basil" });

    // Check if Stripe customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing Stripe customer", { customerId });
    } else {
      // Create new customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      logStep("Created new Stripe customer", { customerId });
    }

    // Store stripe_customer_id in profiles
    await serviceClient
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id);

    // Upsert into subscriptions table
    await serviceClient
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        stripe_mode: stripeConfig.mode,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    // Get origin for redirect URLs using known BURS origins or configured app URL fallbacks
    const origin = resolveAppOrigin(req.headers.get("origin"));

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      subscription_data: {
        trial_period_days: 30,
      },
      payment_method_collection: 'always',
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/cancel`,
      metadata: {
        supabase_user_id: user.id,
        stripe_mode: stripeConfig.mode,
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    const response = new Response(JSON.stringify({ url: session.url, mode: stripeConfig.mode }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      status: 200,
    });
    await storeIdempotencyResult(req, response);
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
