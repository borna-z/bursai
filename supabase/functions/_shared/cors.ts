/**
 * Dynamic CORS origin for Edge Functions.
 *
 * In production, set the ALLOWED_ORIGIN secret in the Supabase dashboard
 * (e.g. "https://burs.me") so responses are locked to your domain.
 * Falls back to '*' for local dev / preview environments.
 */
export const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
