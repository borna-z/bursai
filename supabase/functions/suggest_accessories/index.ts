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

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { outfit_id } = await req.json();
    if (!outfit_id) throw new Error("Missing outfit_id");

    // Fetch outfit items
    const { data: outfitItems } = await supabase
      .from("outfit_items")
      .select("slot, garment_id, garments:garment_id(title, category, color_primary, material)")
      .eq("outfit_id", outfit_id);

    if (!outfitItems || outfitItems.length === 0) throw new Error("Outfit empty");

    // Find which slots are non-accessory
    const mainSlots = new Set(outfitItems.filter((i: any) => i.garments?.category !== "accessories").map((i: any) => i.slot));
    
    // Get user's accessories
    const { data: accessories } = await supabase
      .from("garments")
      .select("id, title, category, subcategory, color_primary, material, pattern")
      .eq("user_id", user.id)
      .eq("category", "accessories")
      .eq("in_laundry", false);

    if (!accessories || accessories.length === 0) {
      return new Response(JSON.stringify({ suggestions: [], message: "No accessories in wardrobe" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const outfitDesc = outfitItems.map((i: any) => {
      const g = i.garments;
      return `${i.slot}: ${g?.title} (${g?.color_primary}, ${g?.material || "?"})`;
    }).join("\n");

    const accessoryList = accessories.map((a: any) =>
      `[${a.id}] ${a.title} (${a.subcategory || a.category}, ${a.color_primary}, ${a.material || "?"})`
    ).join("\n");

    const prompt = `You are a premium fashion accessory stylist. Given an outfit, suggest the best accessories to complete the look.

OUTFIT:
${outfitDesc}

AVAILABLE ACCESSORIES:
${accessoryList}

Select up to 3 accessories that elevate this outfit. Consider color harmony, material compatibility, and occasion appropriateness.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: "Suggest accessories for this outfit." },
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest_accessories",
            description: "Return accessory suggestions",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      garment_id: { type: "string" },
                      reason: { type: "string", description: "Why this accessory works" },
                    },
                    required: ["garment_id", "reason"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["suggestions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "suggest_accessories" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResponse.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let result: any = null;
    if (toolCall?.function?.arguments) {
      try { result = JSON.parse(toolCall.function.arguments); } catch { /* ignore */ }
    }
    if (!result) throw new Error("AI did not return structured result");

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest_accessories error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
