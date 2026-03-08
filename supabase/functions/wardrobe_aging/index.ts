import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse } from "../_shared/burs-ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

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
    const garmentList = garments.map(g => {
      const parts = [g.title, `material:${g.material || "unknown"}`, `condition:${g.condition_score ?? "unknown"}/10`, `worn:${g.wear_count ?? 0}x`, `added:${g.created_at?.split("T")[0] || "unknown"}`];
      return `${g.id}: ${parts.join(" | ")}`;
    }).join("\n");

    const { data: result } = await callBursAI({
      messages: [
        {
          role: "system",
          content: `You are a garment longevity expert. Predict when garments will need replacing based on material durability, wear frequency, and condition. Respond in ${langName}.

GARMENTS:
${garmentList}`,
        },
        { role: "user", content: "Predict the lifespan of my garments. Focus on the 5 items closest to needing replacement." },
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
                    months_remaining: { type: "number", description: "Estimated months until replacement needed" },
                    health_pct: { type: "number", description: "Current health 0-100" },
                    tip: { type: "string", description: "Care tip to extend life" },
                    replacement_reason: { type: "string", description: "What will wear out" },
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
      modelType: "fast",
      cacheTtlSeconds: 3600,
      cacheNamespace: "wardrobe_aging",
    });

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
