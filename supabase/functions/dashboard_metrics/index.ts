/**
 * dashboard_metrics — read-only operational health endpoint
 *
 * Sprint PR 6 (2026-05-18). Returns four roll-ups read from views shipped in
 * `20260518120300_observability_views.sql`:
 *
 *   * queue_depth         — render_jobs grouped 5-min × status, last 24 h
 *   * function_health     — request_idempotency split by function, last 24 h
 *   * subscriptions       — subscriptions table grouped by plan × status
 *   * ai_cost_per_day     — ai_call_log roll-up, last 30 d (nullable: the
 *                            view only exists if PR 4's ai_call_log table has
 *                            been merged. On main today it returns null.)
 *
 * Auth: shared worker bearer (`RENDER_WORKER_BEARER`). The launch dashboard is
 * a server-rendered surface owned by the founder; no end-user auth flows
 * through here. Using the worker bearer (instead of service-role key) lets us
 * rotate it independently. Pattern lifted from `process_render_jobs`.
 *
 * Caching: `Cache-Control: max-age=60` so a dashboard refresh storm collapses
 * to one DB hit per minute at the CDN edge.
 */
import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS_HEADERS } from "../_shared/cors.ts";
import { timingSafeEqual } from "../_shared/timing-safe.ts";
import { logger } from "../_shared/logger.ts";

const log = logger("dashboard_metrics");

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  // Auth — same bearer used by the render worker chain.
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RENDER_WORKER_BEARER = Deno.env.get("RENDER_WORKER_BEARER") ?? "";

  if (!RENDER_WORKER_BEARER || RENDER_WORKER_BEARER.length < 32) {
    return jsonResponse({ error: "worker bearer not configured" }, 503);
  }
  if (!SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY.length < 32) {
    return jsonResponse({ error: "service role key not configured" }, 503);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!timingSafeEqual(authHeader, `Bearer ${RENDER_WORKER_BEARER}`)) {
    return jsonResponse({ error: "service role required" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const [queueRes, healthRes, subsRes, aiCostRes] = await Promise.all([
      supabase.from("view_queue_depth_5min").select("*"),
      supabase.from("view_function_health_recent").select("*"),
      supabase.from("view_subscription_distribution").select("*"),
      supabase.from("view_ai_cost_per_day").select("*"),
    ]);

    if (queueRes.error) throw new Error(`view_queue_depth_5min: ${queueRes.error.message}`);
    if (healthRes.error) throw new Error(`view_function_health_recent: ${healthRes.error.message}`);
    if (subsRes.error) throw new Error(`view_subscription_distribution: ${subsRes.error.message}`);
    if (aiCostRes.error) throw new Error(`view_ai_cost_per_day: ${aiCostRes.error.message}`);

    const aiCost = aiCostRes.data;

    return jsonResponse(
      {
        queue_depth: queueRes.data ?? [],
        function_health: healthRes.data ?? [],
        subscriptions: subsRes.data ?? [],
        ai_cost_per_day: aiCost,
      },
      200,
      { "Cache-Control": "max-age=60" },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("dashboard_metrics failed", { error: message });
    return jsonResponse({ error: message }, 500);
  }
});
