/**
 * Shared JWT validation helper for Edge Functions.
 *
 * Replaces the ~18-line auth boilerplate that currently lives in 17+
 * functions (start_trial, reset_style_memory, delete_user_account,
 * memory_ingest, etc.). Two variants existed:
 *   - `auth.getUser(token)` with explicit token arg (start_trial style)
 *   - `auth.getUser()` with Authorization header set on the client
 *     (reset_style_memory style)
 * Both work but the explicit-token form is more defensive — `getUser()`
 * without a token relies on the client's pre-set header, which can be
 * lost across createClient option spread bugs. We normalize to the
 * explicit form here.
 *
 * Functions all use `verify_jwt = false` at the platform level (per
 * supabase/functions/CLAUDE.md) and validate the bearer manually so
 * they can return their own 401 envelope shape — keeping that contract.
 *
 * Usage:
 *
 *   const authResult = await authenticate(req, CORS_HEADERS);
 *   if (!authResult.success) return authResult.response;
 *   const { user, userClient, token } = authResult.auth;
 *
 * The `userClient` is an anon client with the user's JWT pre-attached
 * for RLS-respecting reads/writes. Create a separate service-role
 * `adminClient` if you need to bypass RLS (most functions do — e.g.
 * for rate-limit writes or `enforceSubscription` lookups).
 */

import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export interface AuthSuccess {
  /** The verified Supabase user (from `auth.getUser(token)`). */
  user: User;
  /** Raw bearer token, useful if downstream needs to forward it. */
  token: string;
  /** Anon Supabase client scoped to the caller's JWT. Use for
   *  RLS-respecting reads. Returns a fresh client each call so
   *  per-request connections are isolated. */
  userClient: SupabaseClient;
}

export type AuthResult =
  | { success: true; auth: AuthSuccess }
  | { success: false; response: Response };

/**
 * Validate the Authorization bearer JWT on `req` and return either the
 * verified user + bound client, or a ready-to-return 401 response. The
 * 401 envelope matches the historical shapes used across the codebase
 * (`{ error: "Missing authorization header" }` for missing,
 * `{ error: "Unauthorized" }` for invalid).
 *
 * Pass the function's CORS headers so the 401 carries the right
 * `Access-Control-Allow-Origin`. Static `CORS_HEADERS` is fine for
 * functions that haven't migrated to `corsHeadersFor(req)` yet.
 */
export async function authenticate(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return {
      success: false,
      response: jsonResponse(corsHeaders, { error: "Missing authorization header" }, 401),
    };
  }

  // Accept both `Bearer <jwt>` (canonical) and `<jwt>` (forgiving).
  // The case-insensitive replace mirrors the regex form used in
  // reset_style_memory; covers `bearer <jwt>` from buggy clients
  // without re-breaking case-sensitive standards-compliant ones.
  // `\s*` (zero-or-more whitespace) instead of `\s+` so a header value
  // that's just the bare word `Bearer` (no space) gets stripped to ""
  // and the `!token` guard below returns 401 instead of forwarding it
  // to getUser. Request canonicalization can drop trailing whitespace.
  const token = authHeader.replace(/^Bearer\s*/i, "");
  if (!token) {
    return {
      success: false,
      response: jsonResponse(corsHeaders, { error: "Unauthorized" }, 401),
    };
  }

  // `typeof Deno !== "undefined"` guard mirrors burs-ai.ts so this module
  // can be imported by vitest (Node) tests without a ReferenceError when
  // `Deno` isn't on the global. Tests inject env via `vi.stubEnv` or set
  // `globalThis.Deno` explicitly before calling the helper.
  const supabaseUrl = typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_URL") : undefined;
  const supabaseAnonKey = typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_ANON_KEY") : undefined;
  if (!supabaseUrl || !supabaseAnonKey) {
    // Misconfigured deployment — surface as 500, not 401, so the caller
    // (and Sentry) can tell config issues apart from auth failures.
    return {
      success: false,
      response: jsonResponse(
        corsHeaders,
        { error: "Supabase not configured" },
        500,
      ),
    };
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data?.user) {
    return {
      success: false,
      response: jsonResponse(corsHeaders, { error: "Unauthorized" }, 401),
    };
  }

  return {
    success: true,
    auth: { user: data.user, token, userClient },
  };
}

function jsonResponse(
  corsHeaders: Record<string, string>,
  body: unknown,
  status: number,
): Response {
  // `cache-control: no-store` on every helper-emitted response. Auth
  // errors and config errors must never be cached by CDNs / proxies —
  // a stale 401 served to a different user would block them from
  // logging in correctly. Also covers reset_style_memory's
  // Audit R6-P11 requirement that destructive endpoints set no-store
  // on all envelopes including the auth-failure paths.
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
