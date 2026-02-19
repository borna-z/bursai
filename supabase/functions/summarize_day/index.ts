import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { events, weather, locale = "sv" } = await req.json();

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ summary: null, priorities: [], outfit_hints: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const weatherContext = weather
      ? `Väder: ${weather.temperature}°C, ${weather.precipitation === "none" ? "uppehåll" : weather.precipitation === "rain" ? "regn" : "snö"}.`
      : "";

    const eventsText = events
      .map((e: { title: string; start_time?: string; end_time?: string }) =>
        `${e.start_time || "?"} - ${e.end_time || "?"}: ${e.title}`
      )
      .join("\n");

    const systemPrompt = `Du är en stilmedveten dagplanerare. Analysera användarens kalenderhändelser och ge en kort, insiktsfull sammanfattning av dagen.

Svara ALLTID med giltig JSON i exakt detta format:
{
  "summary": "2-3 meningar som sammanfattar dagens tema och ger klädtips",
  "priorities": [
    { "title": "Händelsenamn", "occasion": "jobb|fest|dejt|träning|vardag", "formality": 1-5, "time": "HH:MM" }
  ],
  "outfit_hints": [
    { "occasion": "jobb|fest|dejt|träning|vardag", "style": "Kort stilbeskrivning", "note": "Praktiskt tips" }
  ]
}

Regler:
- Identifiera dagens övergripande tema (arbetsfokuserad, blandad, social, aktiv)
- Ranka händelser efter hur mycket de påverkar klädseln (viktigast först)
- Max 3 priorities och 2 outfit_hints
- Koppla varje outfit_hint till en occasion-typ
- Om flera aktiviteter kräver olika klädsel, nämn det i sammanfattningen
- Skriv på ${locale === "sv" ? "svenska" : locale === "en" ? "engelska" : locale}
- Var kortfattad men insiktsfull`;

    const userPrompt = `Dagens händelser:\n${eventsText}\n\n${weatherContext}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    
    // Parse JSON from content
    const content = data.choices?.[0]?.message?.content || "";
    let result;
    
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      result = JSON.parse(jsonMatch[0]);
    } else {
      result = { summary: content, priorities: [], outfit_hints: [] };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("summarize_day error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
