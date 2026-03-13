import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse, estimateMaxTokens } from "../_shared/burs-ai.ts";

import { allowedOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { locale = "sv" } = await req.json();

    const { data: garments, error: gErr } = await supabase
      .from("garments")
      .select("id, title, category, material, condition_score, wear_count, created_at")
      .eq("user_id", userId);

    if (gErr) throw gErr;
    if (!garments || garments.length < 3) {
      return new Response(JSON.stringify({ predictions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const langName = locale === "sv" ? "svenska" : "English";
    const garmentList = garments.map(g =>
      `${g.id.slice(0, 8)}|${g.title}|${g.material || "?"}|cond:${g.condition_score ?? "?"}|worn:${g.wear_count ?? 0}|added:${g.created_at?.split("T")[0] || "?"}`
    ).join("\n");

    const { data: result } = await callBursAI({
      complexity: "trivial",
      max_tokens: estimateMaxTokens({ inputItems: garments.length, outputItems: 5, perItemTokens: 50, baseTokens: 150 }),
      functionName: "wardrobe_aging",
      cacheTtlSeconds: 3600,
      cacheNamespace: "wardrobe_aging",
      messages: [
        {
          role: "system",
          content: `Garment longevity expert. Predict replacement needs based on material, wear, condition. Respond in ${langName}.\nGARMENTS:\n${garmentList}`,
        },
        { role: "user", content: "Predict lifespan. Focus on 5 items closest to needing replacement." },
      ],
      tools: [{
        type: "function",
        function: {
          name: "aging_predictions",
          description: "Return garment aging predictions",
          parameters: {
            type: "object",
            properties: {
              predictions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    garment_id: { type: "string" },
                    months_remaining: { type: "number" },
                    health_pct: { type: "number" },
                    tip: { type: "string" },
                    replacement_reason: { type: "string" },
                  },
                  required: ["garment_id", "months_remaining", "health_pct", "tip", "replacement_reason"],
                  additionalProperties: false,
                },
              },
            },
            required: ["predictions"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "aging_predictions" } },
    }, serviceClient);

    // Validate IDs
    const idSet = new Set(garments.map(g => g.id));
    result.predictions = (result.predictions || []).filter((p: any) => idSet.has(p.garment_id));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("wardrobe_aging error:", e);
    return bursAIErrorResponse(e, corsHeaders);
  }
});
