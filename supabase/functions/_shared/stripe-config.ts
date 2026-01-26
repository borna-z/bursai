// Stripe environment configuration helper

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  priceIdMonthly: string;
  priceIdYearly: string;
  mode: 'test' | 'live';
}

export function getStripeConfig(): StripeConfig {
  // Normalize mode to avoid accidental mismatches like "Live" vs "live"
  const rawMode = (Deno.env.get('STRIPE_MODE') || 'test').toLowerCase();
  const mode: 'test' | 'live' = rawMode === 'live' ? 'live' : 'test';
  
  if (mode === 'live') {
    return {
      secretKey: Deno.env.get('STRIPE_SECRET_KEY_LIVE') || '',
      webhookSecret: Deno.env.get('STRIPE_WEBHOOK_SECRET_LIVE') || '',
      priceIdMonthly: Deno.env.get('STRIPE_PRICE_ID_MONTHLY_LIVE') || '',
      priceIdYearly: Deno.env.get('STRIPE_PRICE_ID_YEARLY_LIVE') || '',
      mode: 'live',
    };
  }
  
  return {
    secretKey: Deno.env.get('STRIPE_SECRET_KEY_TEST') || Deno.env.get('STRIPE_SECRET_KEY') || '',
    webhookSecret: Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST') || Deno.env.get('STRIPE_WEBHOOK_SECRET') || '',
    priceIdMonthly: Deno.env.get('STRIPE_PRICE_ID_MONTHLY_TEST') || Deno.env.get('STRIPE_PRICE_ID_MONTHLY') || '',
    priceIdYearly: Deno.env.get('STRIPE_PRICE_ID_YEARLY_TEST') || Deno.env.get('STRIPE_PRICE_ID_YEARLY') || '',
    mode: 'test',
  };
}

export function validateStripeConfig(config: StripeConfig): string | null {
  if (!config.secretKey) return 'Missing Stripe secret key';
  if (!config.priceIdMonthly) return 'Missing monthly price ID';
  if (!config.priceIdYearly) return 'Missing yearly price ID';
  return null;
}
