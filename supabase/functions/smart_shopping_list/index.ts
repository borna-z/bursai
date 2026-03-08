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

    // Fetch wardrobe + upcoming events + profile
    const [garmentsRes, eventsRes, profileRes] = await Promise.all([
      supabase.from("garments").select("id, title, category, subcategory, color_primary, material, formality, season_tags, condition_score, wear_count").eq("user_id", userId),
      supabase.from("calendar_events").select("title, date, description").eq("user_id", userId).gte("date", new Date().toISOString().split("T")[0]).order("date").limit(10),
      supabase.from("profiles").select("preferences").eq("id", userId).single(),
    ]);

    if (garmentsRes.error) throw garmentsRes.error;
    const garments = garmentsRes.data || [];
    const events = eventsRes.data || [];
    const preferences = profileRes.data?.preferences as Record<string, any> | null;

    const categories: Record<string, number> = {};
    const colors: Record<string, number> = {};
    garments.forEach((g: any) => {
      categories[g.category] = (categories[g.category] || 0) + 1;
      colors[g.color_primary] = (colors[g.color_primary] || 0) + 1;
    });

    const langName = locale === "sv" ? "svenska" : "English";

    const prompt = `You are a premium wardrobe consultant. Based on the user's wardrobe analysis, style preferences, and upcoming events, create a prioritized smart shopping list. Respond in ${langName}.

WARDROBE SUMMARY (${garments.length} items):
Categories: ${Object.entries(categories).map(([k, v]) => `${k}: ${v}`).join(", ")}
Colors: ${Object.entries(colors).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 8).map(([k, v]) => `${k}: ${v}`).join(", ")}

${preferences?.styleProfile ? `STYLE PROFILE: ${JSON.stringify(preferences.styleProfile)}` : ""}

UPCOMING EVENTS:
${events.length > 0 ? events.map((e: any) => `${e.date}: ${e.title}${e.description ? ` (${e.description})` : ""}`).join("\n") : "No upcoming events"}

Create 4-6 prioritized shopping suggestions.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: "Generate my smart shopping list." },
        ],
        tools: [{
          type: "function",
          function: {
            name: "shopping_list",
            description: "Return prioritized shopping list",
            parameters: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Item name" },
                      category: { type: "string" },
                      reason: { type: "string", description: "Why it's needed" },
                      new_outfits: { type: "number", description: "Estimated new outfits unlocked" },
                      priority: { type: "string", enum: ["high", "medium", "low"] },
                      budget_hint: { type: "string", description: "Budget range suggestion" },
                      style_spec: { type: "string", description: "Specific style/color/material to look for" },
                    },
                    required: ["name", "category", "reason", "new_outfits", "priority", "budget_hint", "style_spec"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["items"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "shopping_list" } },
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

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("smart_shopping_list error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
