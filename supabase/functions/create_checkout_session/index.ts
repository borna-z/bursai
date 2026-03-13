import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

// Multi-currency price mapping (language → Stripe price IDs)
// Only used in LIVE mode. Test mode uses default SEK prices.
const CURRENCY_PRICES: Record<string, { monthly: string; yearly: string }> = {
  // EUR currencies (€6.99/month, €59.99/year)
  fi: { monthly: 'price_1TAVbGRfXibG26O7tycQijsb', yearly: 'price_1TAVbHRfXibG26O7mDl1Nu95' },
  de: { monthly: 'price_1TAVbGRfXibG26O7tycQijsb', yearly: 'price_1TAVbHRfXibG26O7mDl1Nu95' },
  fr: { monthly: 'price_1TAVbGRfXibG26O7tycQijsb', yearly: 'price_1TAVbHRfXibG26O7mDl1Nu95' },
  es: { monthly: 'price_1TAVbGRfXibG26O7tycQijsb', yearly: 'price_1TAVbHRfXibG26O7mDl1Nu95' },
  it: { monthly: 'price_1TAVbGRfXibG26O7tycQijsb', yearly: 'price_1TAVbHRfXibG26O7mDl1Nu95' },
  pt: { monthly: 'price_1TAVbGRfXibG26O7tycQijsb', yearly: 'price_1TAVbHRfXibG26O7mDl1Nu95' },
  nl: { monthly: 'price_1TAVbGRfXibG26O7tycQijsb', yearly: 'price_1TAVbHRfXibG26O7mDl1Nu95' },
  fa: { monthly: 'price_1TAVbGRfXibG26O7tycQijsb', yearly: 'price_1TAVbHRfXibG26O7mDl1Nu95' },
  // USD ($6.99/month, $59.99/year)
  en: { monthly: 'price_1TAVbIRfXibG26O7j5f2ofxK', yearly: 'price_1TAVbIRfXibG26O7e4CPrhM8' },
  // NOK (79 kr/month, 699 kr/year)
  no: { monthly: 'price_1TAVbJRfXibG26O7fKNigbBC', yearly: 'price_1TAVbKRfXibG26O7N7JKBbp2' },
  // DKK (59 kr/month, 499 kr/year)
  da: { monthly: 'price_1TAVbLRfXibG26O7NgZDiJ96', yearly: 'price_1TAVbMRfXibG26O7c75gExpI' },
  // PLN (29.99 zł/month, 249 zł/year)
  pl: { monthly: 'price_1TAVbORfXibG26O7DpZIjTeP', yearly: 'price_1TAVbORfXibG26O7faEeW7ZL' },
  // AED (25 د.إ/month, 219 د.إ/year)
  ar: { monthly: 'price_1TAVbORfXibG26O7U5nUssVx', yearly: 'price_1TAVbPRfXibG26O7ndrBmQ5R' },
};

interface CheckoutRequest {
  plan: 'monthly' | 'yearly';
  locale?: string;
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

    // Create anon client to verify user
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
        JSON.stringify({ error: "För många försök. Vänta en stund innan du försöker igen." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
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

    // Determine price: use locale-based currency in live mode, fallback to default SEK
    let priceId: string;
    const currencyPrices = locale && stripeConfig.mode === 'live' ? CURRENCY_PRICES[locale] : null;
    if (currencyPrices) {
      priceId = plan === 'monthly' ? currencyPrices.monthly : currencyPrices.yearly;
    } else {
      priceId = plan === 'monthly' ? stripeConfig.priceIdMonthly : stripeConfig.priceIdYearly;
    }
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

    // Get origin for redirect URLs
    const origin = req.headers.get("origin") || "https://id-preview--33b2a235-7025-49d2-9bf2-b33460a200cf.lovable.app";

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

    return new Response(JSON.stringify({ url: session.url, mode: stripeConfig.mode }), {
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
