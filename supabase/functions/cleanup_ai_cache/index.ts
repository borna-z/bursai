import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { timingSafeEqual } from "../_shared/timing-safe.ts";
import { checkOverload, overloadResponse } from "../_shared/scale-guard.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  // Cron-only endpoint — no per-user rate limit (service role only).
  // Overload guard still applies.
  if (checkOverload("cleanup_ai_cache")) {
    return overloadResponse(CORS_HEADERS);
  }

  try {
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Decoupled inter-function/cron bearer. See
    // supabase/functions/process_render_jobs/index.ts for the rotation
    // procedure and the rationale (SUPABASE_SERVICE_ROLE_KEY is a deploy-
    // time snapshot that drifts when the platform rotates the signing
    // secret). The corresponding cron command MUST send
    //   Authorization: Bearer <vault.decrypted_secrets WHERE name='render_worker_bearer'>
    const RENDER_WORKER_BEARER = Deno.env.get("RENDER_WORKER_BEARER") ?? "";

    // ── Auth: cron-only endpoint — reject anything that isn't the worker bearer.
    // P1 sibling: this function mass-deletes rows from ai_response_cache;
    // without this guard any anon POST could invoke it repeatedly, both
    // burning DB budget and evicting hot cache rows prematurely. Use
    // timing-safe comparison to avoid byte-by-byte key extraction.
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") ?? "";
    if (!RENDER_WORKER_BEARER || RENDER_WORKER_BEARER.length < 32) {
      return new Response(
        JSON.stringify({ error: "worker bearer not configured" }),
        { status: 503, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }
    if (!token || !timingSafeEqual(token, RENDER_WORKER_BEARER)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      SUPABASE_SERVICE_ROLE_KEY,
    );

    const now = new Date().toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    // 1. Delete expired rows
    const { count: expiredCount } = await supabase
      .from("ai_response_cache")
      .delete({ count: "exact" })
      .lt("expires_at", now);

    // 2. Delete never-reused rows older than 24h
    const { count: unusedCount } = await supabase
      .from("ai_response_cache")
      .delete({ count: "exact" })
      .eq("hit_count", 0)
      .lt("created_at", twentyFourHoursAgo);

    const result = {
      expired_deleted: expiredCount || 0,
      unused_deleted: unusedCount || 0,
      cleaned_at: now,
    };

    console.log("Cache cleanup:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cleanup_ai_cache error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
