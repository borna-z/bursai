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

    // Get user's style vector from their wardrobe
    const { data: garments } = await supabase
      .from("garments")
      .select("category, color_primary, material, formality")
      .eq("user_id", userId);

    if (!garments || garments.length < 5) {
      return new Response(JSON.stringify({ twin_archetype: null, shared_traits: [], inspiration_outfits: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build style vector
    const colorCounts: Record<string, number> = {};
    const materialCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    let formalitySum = 0, formalityCount = 0;

    for (const g of garments) {
      colorCounts[g.color_primary] = (colorCounts[g.color_primary] || 0) + 1;
      if (g.material) materialCounts[g.material] = (materialCounts[g.material] || 0) + 1;
      categoryCounts[g.category] = (categoryCounts[g.category] || 0) + 1;
      if (g.formality) { formalitySum += g.formality; formalityCount++; }
    }

    const topColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
    const topMaterials = Object.entries(materialCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
    const avgFormality = formalityCount > 0 ? Math.round(formalitySum / formalityCount * 10) / 10 : 3;

    // Find shared outfits from other users with similar style vectors
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get shared outfits with their items for inspiration
    const { data: sharedOutfits } = await serviceSupabase
      .from("outfits")
      .select("id, occasion, style_vibe, explanation")
      .eq("share_enabled", true)
      .neq("user_id", userId)
      .order("generated_at", { ascending: false })
      .limit(20);

    // Determine style archetype based on their dominant attributes
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { locale = "sv" } = await req.json();
    const langName = locale === "sv" ? "svenska" : "English";

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
            content: `You are a style analyst. Based on a user's style vector, identify their "style twin" archetype. Respond in ${langName}.

STYLE VECTOR:
- Top colors: ${topColors.join(", ")}
- Top materials: ${topMaterials.join(", ")}
- Average formality: ${avgFormality}/5
- Wardrobe size: ${garments.length} items
- Category spread: ${Object.entries(categoryCounts).map(([k, v]) => `${k}: ${v}`).join(", ")}`,
          },
          { role: "user", content: "What is my style twin archetype and what defines it?" },
        ],
        tools: [{
          type: "function",
          function: {
            name: "style_twin_result",
            description: "Return style twin analysis",
            parameters: {
              type: "object",
              properties: {
                twin_archetype: { type: "string", description: "Creative archetype name e.g. 'The Scandinavian Minimalist'" },
                archetype_description: { type: "string", description: "2-3 sentence description of this style type" },
                shared_traits: {
                  type: "array",
                  items: { type: "string" },
                  description: "4-6 defining style traits",
                },
                style_icons: {
                  type: "array",
                  items: { type: "string" },
                  description: "2-3 real-world style icons with similar taste",
                },
                signature_moves: {
                  type: "array",
                  items: { type: "string" },
                  description: "3-4 signature styling moves to try",
                },
              },
              required: ["twin_archetype", "archetype_description", "shared_traits", "style_icons", "signature_moves"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "style_twin_result" } },
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

    // Add community outfits as inspiration
    result.inspiration_outfits = (sharedOutfits || []).slice(0, 5).map((o: any) => ({
      id: o.id,
      occasion: o.occasion,
      style_vibe: o.style_vibe,
    }));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("style_twin error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
