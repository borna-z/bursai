import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { locale = "sv" } = await req.json();

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

    const { data: result } = await callBursAI({
      complexity: "standard",
      max_tokens: estimateMaxTokens({ outputItems: 6, perItemTokens: 80, baseTokens: 150 }),
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
      cacheTtlSeconds: 3600,
      cacheNamespace: "smart_shopping",
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("smart_shopping_list error:", e);
    return bursAIErrorResponse(e, corsHeaders);
  }
});
