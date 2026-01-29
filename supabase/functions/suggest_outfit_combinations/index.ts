import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Garment {
  id: string;
  title: string;
  category: string;
  color_primary: string;
  color_secondary?: string;
  material?: string;
  pattern?: string;
  formality?: number;
  season_tags?: string[];
  last_worn_at?: string;
  wear_count?: number;
  image_path: string;
}

interface StylePreferences {
  favorite_colors?: string[];
  disliked_colors?: string[];
  fit_preference?: string;
  style_vibes?: string[];
  gender_neutral?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile with style preferences
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", user.id)
      .single();

    const preferences = (profile?.preferences as StylePreferences) || {};

    // Get unused garments (not worn in 30+ days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

    const { data: garments, error: garmentsError } = await supabase
      .from("garments")
      .select("id, title, category, color_primary, color_secondary, material, pattern, formality, season_tags, last_worn_at, wear_count, image_path")
      .eq("user_id", user.id)
      .or(`last_worn_at.is.null,last_worn_at.lt.${thirtyDaysAgoStr}`)
      .eq("in_laundry", false);

    if (garmentsError) {
      throw garmentsError;
    }

    if (!garments || garments.length < 2) {
      return new Response(JSON.stringify({ 
        suggestions: [],
        message: "Inte tillräckligt med oanvända plagg för att skapa förslag." 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call AI to generate suggestions
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Du är en personlig stylist som hjälper användare att hitta nya outfit-kombinationer från deras garderob.

Din uppgift är att skapa 2-3 kreativa outfit-förslag baserat på oanvända plagg i användarens garderob.

Regler:
1. Varje outfit ska innehålla 2-4 plagg som passar ihop
2. Prioritera plagg som inte använts länge
3. Tänk på färgharmoni och stilmässig balans
4. Om användaren har stilpreferenser, respektera dessa
5. Varje förslag ska ha en kort förklaring på varför kombinationen fungerar

Svara alltid med exakt detta JSON-format:
{
  "suggestions": [
    {
      "title": "Kort beskrivande titel",
      "garment_ids": ["id1", "id2", "id3"],
      "explanation": "Varför denna kombination fungerar (max 2 meningar)",
      "occasion": "Lämpligt tillfälle (t.ex. Vardag, Jobb, Dejt)"
    }
  ]
}`;

    const userPrompt = `Här är användarens oanvända plagg:
${JSON.stringify(garments.map(g => ({
  id: g.id,
  title: g.title,
  category: g.category,
  color: g.color_primary,
  formality: g.formality,
  last_worn: g.last_worn_at || "Aldrig",
})), null, 2)}

${preferences.style_vibes?.length ? `Användarens stilpreferenser: ${preferences.style_vibes.join(", ")}` : ""}
${preferences.favorite_colors?.length ? `Favoritfärger: ${preferences.favorite_colors.join(", ")}` : ""}
${preferences.disliked_colors?.length ? `Undvik dessa färger: ${preferences.disliked_colors.join(", ")}` : ""}

Skapa 2-3 outfit-förslag som kombinerar dessa oanvända plagg på ett snyggt sätt.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "AI-tjänsten är överbelastad. Försök igen senare." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI-krediter slut. Kontakta support." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No AI response content");
    }

    // Parse JSON from response (handle markdown code blocks)
    let parsedSuggestions;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      parsedSuggestions = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI suggestions");
    }

    // Validate and enrich suggestions with garment details
    const enrichedSuggestions = parsedSuggestions.suggestions?.map((suggestion: any) => {
      const validGarmentIds = suggestion.garment_ids.filter((id: string) =>
        garments.some((g) => g.id === id)
      );
      
      const garmentDetails = validGarmentIds.map((id: string) =>
        garments.find((g) => g.id === id)
      ).filter(Boolean);

      return {
        ...suggestion,
        garment_ids: validGarmentIds,
        garments: garmentDetails,
      };
    }).filter((s: any) => s.garment_ids.length >= 2) || [];

    return new Response(JSON.stringify({ 
      suggestions: enrichedSuggestions 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in suggest_outfit_combinations:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
