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

    const { data: outfitItems } = await supabase
      .from("outfit_items")
      .select("slot, garment_id, garments:garment_id(title, category, color_primary, material)")
      .eq("outfit_id", outfit_id);

    if (!outfitItems || outfitItems.length === 0) throw new Error("Outfit empty");

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

    const { data: result } = await callBursAI({
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
      cacheTtlSeconds: 1800,
      cacheNamespace: "suggest_accessories",
    }, supabase);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest_accessories error:", e);
    return bursAIErrorResponse(e, corsHeaders);
  }
});
