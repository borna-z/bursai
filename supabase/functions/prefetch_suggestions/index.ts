import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, compressPrompt, compactGarment, bursAIErrorResponse, estimateMaxTokens } from "../_shared/burs-ai.ts";

import { allowedOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Prefetch daily outfit suggestions for active users.
 * Designed to run on a cron schedule (e.g., daily at 06:00).
 * Stores results in ai_response_cache for instant Home page loads.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find active users (logged in within last 7 days, have 5+ garments)
    const { data: activeUsers } = await supabase
      .from("profiles")
      .select("id")
      .gte("updated_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(50);

    if (!activeUsers || activeUsers.length === 0) {
      return new Response(JSON.stringify({ prefetched: 0, message: "No active users" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let prefetched = 0;
    const errors: string[] = [];

    for (const user of activeUsers) {
      try {
        // Fetch garments
        const { data: garments } = await supabase
          .from("garments")
          .select("id, title, category, subcategory, color_primary, material, formality, season_tags, in_laundry")
          .eq("user_id", user.id)
          .eq("in_laundry", false);

        if (!garments || garments.length < 5) continue;

        // Use compact descriptors for efficiency
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
          cacheTtlSeconds: 43200, // 12 hours
          cacheNamespace: `daily_suggestions_${user.id}`,
        }, supabase);

        prefetched++;
      } catch (e) {
        errors.push(`${user.id}: ${e instanceof Error ? e.message : String(e)}`);
      }

      // Small delay between users to avoid rate limits
      await new Promise(r => setTimeout(r, 500));
    }

    return new Response(JSON.stringify({
      prefetched,
      total_users: activeUsers.length,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("prefetch_suggestions error:", e);
    return bursAIErrorResponse(e, corsHeaders);
  }
});
