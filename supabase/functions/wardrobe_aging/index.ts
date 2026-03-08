import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
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
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${resp.status}`);
    }

    const aiData = await resp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let result: any = null;
    if (toolCall?.function?.arguments) {
      try { result = JSON.parse(toolCall.function.arguments); } catch { /* ignore */ }
    }
    if (!result) throw new Error("AI did not return structured result");

    // Validate IDs
    const idSet = new Set(garments.map(g => g.id));
    result.predictions = (result.predictions || []).filter((p: any) => idSet.has(p.garment_id));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("wardrobe_aging error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
