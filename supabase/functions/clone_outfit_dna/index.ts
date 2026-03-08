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

    // Fetch outfit with items and garments
    const { data: outfit, error: oErr } = await supabase
      .from("outfits")
      .select("*, outfit_items(slot, garment_id, garments:garment_id(title, category, color_primary, color_secondary, material, pattern, formality, fit))")
      .eq("id", outfit_id)
      .eq("user_id", user.id)
      .single();

    if (oErr || !outfit) throw new Error("Outfit not found");

    // Fetch all user garments for variation pool
    const { data: allGarments } = await supabase
      .from("garments")
      .select("id, title, category, color_primary, color_secondary, material, pattern, formality, fit, in_laundry")
      .eq("user_id", user.id)
      .eq("in_laundry", false);

    const outfitDNA = outfit.outfit_items.map((item: any) => {
      const g = item.garments;
      return `${item.slot}: ${g?.title} — ${g?.color_primary}, ${g?.material || "unknown"}, ${g?.pattern || "solid"}, formality ${g?.formality || 3}`;
    }).join("\n");

    const availableGarments = (allGarments || [])
      .filter((g: any) => !outfit.outfit_items.some((item: any) => item.garment_id === g.id))
      .map((g: any) => `[${g.id}] ${g.title} (${g.category}, ${g.color_primary}, ${g.material || "?"})`)
      .join("\n");

    const prompt = `You are a fashion DNA analyst. The user loves this outfit and wants similar-but-different variations.

ORIGINAL OUTFIT DNA:
${outfitDNA}
Occasion: ${outfit.occasion}
Style: ${outfit.style_vibe || "casual"}

AVAILABLE GARMENTS (from user's wardrobe):
${availableGarments}

Generate 3 outfit variations that preserve the DNA (similar color ratios, formality balance, material harmony) but swap in different pieces. Each variation should feel like a cousin of the original.

For each variation, select garment IDs from the available list and explain what makes it similar.`;

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
          { role: "user", content: "Generate 3 similar outfit variations using my available garments." },
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest_variations",
            description: "Return 3 outfit variations",
            parameters: {
              type: "object",
              properties: {
                variations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Short variation name" },
                      garment_ids: { type: "array", items: { type: "string" }, description: "Selected garment UUIDs" },
                      explanation: { type: "string", description: "Why this variation works" },
                    },
                    required: ["name", "garment_ids", "explanation"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["variations"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "suggest_variations" } },
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
    console.error("clone_outfit_dna error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
