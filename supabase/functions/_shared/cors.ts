/**
 * Dynamic CORS origin for Edge Functions.
 *
 * In production, set the ALLOWED_ORIGIN secret in the Supabase dashboard
 * (e.g. "https://burs.me") so responses are locked to your domain.
 * Falls back to '*' for local dev / preview environments.
 */
const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
