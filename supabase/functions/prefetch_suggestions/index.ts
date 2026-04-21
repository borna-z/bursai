import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, compressPrompt, compactGarment, bursAIErrorResponse, estimateMaxTokens } from "../_shared/burs-ai.ts";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { withConcurrencyLimit, logTelemetry } from "../_shared/scale-guard.ts";
import { logger } from "../_shared/logger.ts";

const log = logger("prefetch_suggestions");

/**
 * Prefetch daily outfit suggestions for active users.
 * Designed to run on a cron schedule (e.g., daily at 06:00).
 * Stores results in ai_response_cache for instant Home page loads.
 *
 * Scale-hardened:
 * - Bounded concurrency (3 parallel AI calls)
 * - Time budget guard (50s max to avoid function timeout)
 * - Paginated user processing (100 users per batch)
 * - Skip users who already have fresh cache
 */

const CONCURRENCY = 3;
const TIME_BUDGET_MS = 50_000; // leave headroom for function timeout
const BATCH_SIZE = 100;

async function processSingleUser(
  userId: string,
  supabaseClient: ReturnType<typeof createClient>,
): Promise<{ status: 'ok' | 'skipped' | 'error'; error?: string }> {
  try {
    const { data: garments } = await supabaseClient
      .from("garments")
      .select("id, title, category, subcategory, color_primary, material, formality, season_tags, in_laundry")
      .eq("user_id", userId)
      .eq("in_laundry", false);

    if (!garments || garments.length < 5) return { status: "skipped" };

    const garmentList = garments.map(g => compactGarment(g)).join("\n");
    const prompt = compressPrompt(`You are a personal stylist. Suggest 2 outfits for today from this wardrobe.
Pick garments by their short ID (first 8 chars).

WARDROBE:
${garmentList}`);

    await callBursAI({
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: "Suggest 2 outfits for today." },
      ],
      tools: [{
        type: "function",
        function: {
          name: "suggest_outfits",
          description: "Return 2 outfit suggestions",
          parameters: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    garment_ids: { type: "array", items: { type: "string" } },
                    explanation: { type: "string" },
                    occasion: { type: "string" },
                  },
                  required: ["title", "garment_ids", "explanation", "occasion"],
                  additionalProperties: false,
                },
              },
            },
            required: ["suggestions"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "suggest_outfits" } },
      complexity: "trivial",
      max_tokens: estimateMaxTokens({ outputItems: 2, perItemTokens: 80, baseTokens: 150 }),
      cacheTtlSeconds: 43200,
      cacheNamespace: `daily_suggestions_${userId}`,
      functionName: "prefetch_suggestions",
    }, supabaseClient);

    return { status: "ok" };
  } catch (e) {
    return { status: "error", error: e instanceof Error ? e.message : String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const runStart = Date.now();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- Single-user trigger mode (from client after 5th garment) ---
    let triggeredUserId: string | null = null;
    try {
      if (req.method === "POST") {
        const body = await req.json();
        if (body?.user_id && body?.trigger === "first_5_garments") {
          triggeredUserId = body.user_id;
        }
      }
    } catch { /* fall through to cron mode */ }

    if (triggeredUserId) {
      // Verify caller's JWT matches body.user_id — prevents one authenticated
      // user from triggering a prefetch against another user's wardrobe/cache.
      const authHeader = req.headers.get("Authorization");
      const token = authHeader?.replace("Bearer ", "").trim() ?? "";
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      if (user.id !== triggeredUserId) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const result = await processSingleUser(triggeredUserId, supabase);
      log.info("Single-user prefetch", { userId: triggeredUserId, result: result.status });
      return new Response(JSON.stringify({ triggered: triggeredUserId, ...result }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Find active users (genuinely active within last 7 days, have 5+ garments)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: activeUsers } = await supabase
      .from("profiles")
      .select("id")
      .gte("last_active_at", sevenDaysAgo)
      .order("last_active_at", { ascending: false })
      .limit(BATCH_SIZE);

    if (!activeUsers || activeUsers.length === 0) {
      return new Response(JSON.stringify({ prefetched: 0, message: "No active users" }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    log.info(`Starting prefetch for ${activeUsers.length} users`);

    let prefetched = 0;
    let skipped = 0;
    let timeBudgetExhausted = false;
    const errors: string[] = [];

    // Process users with bounded concurrency
    await withConcurrencyLimit(activeUsers, CONCURRENCY, async (user) => {
      if (Date.now() - runStart > TIME_BUDGET_MS) {
        timeBudgetExhausted = true;
        return;
      }
      const result = await processSingleUser(user.id, supabase);
      if (result.status === "ok") prefetched++;
      else if (result.status === "skipped") skipped++;
      else errors.push(`${user.id.slice(0, 8)}: ${result.error ?? "failed"}`);
    });

    logTelemetry(supabase, {
      functionName: "prefetch_suggestions",
      model_used: "batch",
      latency_ms: Date.now() - runStart,
      from_cache: false,
      status: errors.length === 0 ? "ok" : "error",
      error_message: errors.length > 0 ? `${errors.length} failures` : undefined,
    });

    log.info("Prefetch complete", {
      prefetched,
      skipped,
      errors: errors.length,
      timeBudgetExhausted,
      durationMs: Date.now() - runStart,
    });

    return new Response(JSON.stringify({
      prefetched,
      skipped,
      total_users: activeUsers.length,
      time_budget_exhausted: timeBudgetExhausted,
      duration_ms: Date.now() - runStart,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    log.exception("prefetch_suggestions error", e);
    return bursAIErrorResponse(e, CORS_HEADERS);
  }
});
