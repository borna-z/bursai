/**
 * Google OAuth Verification — Internal Checklist
 * ------------------------------------------------
 * Ensure the following in Google Cloud Console:
 * - Homepage URL = https://burs.me/welcome
 * - Privacy Policy URL = https://burs.me/privacy
 * - Authorized domain includes: burs.me
 * - Only minimum approved calendar scope requested for primary-calendar event reads:
 *     https://www.googleapis.com/auth/calendar.events.readonly
 *
 * Security hardening (Prompt 3 / Wave 1):
 * - `redirect_uri` is validated against an explicit allowlist before being
 *   sent to Google. Unknown origins are rejected with 400.
 * - The `state` param is a single-use CSRF token (`<user_id>.<nonce>`) backed
 *   by the `public.oauth_csrf` table with a 10-minute TTL. Consumed on
 *   callback to prevent replay.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, overloadResponse } from "../_shared/scale-guard.ts";

const GOOGLE_SCOPES = "https://www.googleapis.com/auth/calendar.events.readonly";

// Hardcoded production, canonical-domain, and local-dev redirect URIs. The
// callback route is mounted at `/calendar/callback` in AnimatedRoutes.tsx.
// Additional origins (Vercel previews, staging projects) can be layered on
// via the `ALLOWED_CALENDAR_REDIRECT_URIS` env var (comma-separated).
const ALLOWED_REDIRECT_URIS = [
  "https://app.burs.me/calendar/callback",
  "https://burs.me/calendar/callback",
  "http://localhost:8080/calendar/callback",
];

function buildAllowedRedirectSet(): Set<string> {
  const envExtras = (Deno.env.get("ALLOWED_CALENDAR_REDIRECT_URIS") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set([...ALLOWED_REDIRECT_URIS, ...envExtras]);
}

// CSRF token lifetime: 10 minutes. Users who idle on the Google consent
// screen longer than this have to restart the flow — acceptable UX.
const CSRF_TTL_MS = 10 * 60 * 1000;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (checkOverload("google_calendar_auth")) {
    return overloadResponse(CORS_HEADERS);
  }

  try {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return jsonResponse({ error: "Google Calendar not configured" }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json();
    const { action, code, redirect_uri, state: clientState } = body ?? {};

    const allowedRedirects = buildAllowedRedirectSet();

    // --- ACTION: get_auth_url ---
    if (action === "get_auth_url") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      // Verify user exists
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        return jsonResponse({ error: "Invalid auth" }, 401);
      }
      const user = userData.user;

      if (typeof redirect_uri !== "string" || !allowedRedirects.has(redirect_uri)) {
        return jsonResponse({ error: "redirect_uri not allowed" }, 400);
      }

      // Issue a single-use CSRF token. We store the token row under the
      // service role (RLS-enabled table, no policies).
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      await enforceRateLimit(adminClient, user.id, "google_calendar_auth");
      const csrfToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + CSRF_TTL_MS).toISOString();

      const { error: insertCsrfError } = await adminClient
        .from("oauth_csrf")
        .insert({ token: csrfToken, user_id: user.id, expires_at: expiresAt });

      if (insertCsrfError) {
        console.error("oauth_csrf insert error:", insertCsrfError);
        return jsonResponse({ error: "Failed to initiate OAuth" }, 500);
      }

      // State format: <user_id>.<csrf_token>. Both halves are verified on
      // callback — the user_id half must match the caller's JWT-derived id,
      // the csrf half must match an un-expired row keyed to the same user.
      const state = `${user.id}.${csrfToken}`;

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirect_uri,
        response_type: "code",
        scope: GOOGLE_SCOPES,
        access_type: "offline",
        prompt: "consent",
        state,
      });

      const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      return jsonResponse({ url }, 200);
    }

    // --- ACTION: exchange_code ---
    if (action === "exchange_code") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        return jsonResponse({ error: "Invalid auth" }, 401);
      }
      const user = userData.user;

      if (typeof redirect_uri !== "string" || !allowedRedirects.has(redirect_uri)) {
        return jsonResponse({ error: "redirect_uri not allowed" }, 400);
      }

      // CSRF verification: state must be `<user_id>.<csrf_token>` where the
      // user_id half equals the caller's JWT user and the csrf half matches
      // an un-expired row bound to the same user. We consume the row on
      // success so a replay of the same state fails the next lookup.
      if (typeof clientState !== "string" || !clientState.includes(".")) {
        return jsonResponse({ error: "Invalid state" }, 401);
      }
      const dotIdx = clientState.indexOf(".");
      const stateUserId = clientState.slice(0, dotIdx);
      const stateCsrf = clientState.slice(dotIdx + 1);
      if (!stateUserId || !stateCsrf || stateUserId !== user.id) {
        return jsonResponse({ error: "Invalid state" }, 401);
      }

      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      await enforceRateLimit(adminClient, user.id, "google_calendar_auth");

      const { data: csrfRow, error: csrfSelectError } = await adminClient
        .from("oauth_csrf")
        .select("token, user_id, expires_at")
        .eq("token", stateCsrf)
        .eq("user_id", user.id)
        .maybeSingle();

      if (csrfSelectError) {
        console.error("oauth_csrf select error:", csrfSelectError);
        return jsonResponse({ error: "Invalid state" }, 401);
      }
      if (!csrfRow) {
        return jsonResponse({ error: "Invalid state" }, 401);
      }
      if (new Date(csrfRow.expires_at).getTime() < Date.now()) {
        // Expired — clean the row out to keep the table small and return 401.
        await adminClient.from("oauth_csrf").delete().eq("token", stateCsrf);
        return jsonResponse({ error: "Invalid state" }, 401);
      }

      // Consume the token BEFORE talking to Google. If the Google exchange
      // fails we lose the nonce but that is safe — the user just restarts.
      const { error: deleteCsrfError } = await adminClient
        .from("oauth_csrf")
        .delete()
        .eq("token", stateCsrf)
        .eq("user_id", user.id);
      if (deleteCsrfError) {
        console.error("oauth_csrf delete error:", deleteCsrfError);
        return jsonResponse({ error: "Invalid state" }, 401);
      }

      // Exchange authorization code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirect_uri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) {
        console.error("Token exchange failed:", tokenData);
        return jsonResponse({ error: "Failed to exchange code" }, 400);
      }

      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

      // Delete existing google connection for this user
      await adminClient.from("calendar_connections").delete().eq("user_id", user.id).eq("provider", "google");

      // Insert new connection
      const { error: insertError } = await adminClient.from("calendar_connections").insert({
        user_id: user.id,
        provider: "google",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: expiresAt,
        calendar_id: "primary",
      });

      if (insertError) {
        console.error("Insert connection error:", insertError);
        return jsonResponse({ error: "Failed to save connection" }, 500);
      }

      return jsonResponse({ success: true }, 200);
    }

    // --- ACTION: disconnect ---
    if (action === "disconnect") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        return jsonResponse({ error: "Invalid auth" }, 401);
      }
      const user = userData.user;

      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      await enforceRateLimit(adminClient, user.id, "google_calendar_auth");

      // Delete connection
      await adminClient.from("calendar_connections").delete().eq("user_id", user.id).eq("provider", "google");

      // Delete google calendar events
      await adminClient.from("calendar_events").delete().eq("user_id", user.id).eq("provider", "google");

      // Update last sync
      await adminClient.from("profiles").update({ last_calendar_sync: null }).eq("id", user.id);

      return jsonResponse({ success: true }, 200);
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return rateLimitResponse(error, CORS_HEADERS);
    }
    console.error("Google calendar auth error:", error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
