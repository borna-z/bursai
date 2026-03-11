import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callBursAI, bursAIErrorResponse } from "../_shared/burs-ai.ts";

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
        JSON.stringify({ summary: null, priorities: [], outfit_hints: [], transitions: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOCALE_NAMES: Record<string, string> = {
      sv: "svenska", en: "English", no: "norsk", da: "dansk", fi: "finska",
      de: "Deutsch", fr: "français", es: "español", it: "italiano",
      pt: "português", nl: "Nederlands", ja: "日本語", ko: "한국어", ar: "العربية",
    };
    const localeName = LOCALE_NAMES[locale] || "English";
    const isSv = locale === "sv";

    const weatherContext = weather
      ? (isSv
        ? `Väder: ${weather.temperature}°C, ${weather.precipitation === "none" ? "uppehåll" : weather.precipitation === "rain" ? "regn" : "snö"}.`
        : `Weather: ${weather.temperature}°C, ${weather.precipitation === "none" ? "clear" : weather.precipitation === "rain" ? "rain" : "snow"}.`)
      : "";

    const eventsText = events
      .map((e: { title: string; start_time?: string; end_time?: string }) =>
        `${e.start_time || "?"} - ${e.end_time || "?"}: ${e.title}`
      )
      .join("\n");

    const isMultiEvent = events.length >= 2;
    const occasionValues = isSv ? "jobb|fest|dejt|träning|vardag" : "work|party|date|workout|casual";

    const transitionsSchema = isSv
      ? `"transitions": {
    "needs_change": true/false,
    "blocks": [
      {
        "time_range": "HH:MM–HH:MM",
        "occasion": "${occasionValues}",
        "formality": 1-5,
        "label": "Kort beskrivning, t.ex. 'Morgon: kontor'",
        "style_tip": "Kort klädstyltips för detta block",
        "transition_tip": "Hur man övergår från förra blocket (null för första)"
      }
    ],
    "versatile_pieces": ["Plagg som fungerar över flera block"]
  }`
      : `"transitions": {
    "needs_change": true/false,
    "blocks": [
      {
        "time_range": "HH:MM–HH:MM",
        "occasion": "${occasionValues}",
        "formality": 1-5,
        "label": "Short description, e.g. 'Morning: office'",
        "style_tip": "Short outfit tip for this block",
        "transition_tip": "How to transition from previous block (null for first)"
      }
    ],
    "versatile_pieces": ["Garments that work across multiple blocks"]
  }`;

    const summaryDesc = isSv ? "2-3 meningar som sammanfattar dagens tema och ger klädtips" : "2-3 sentences summarizing the day's theme and clothing tips";
    const styleDesc = isSv ? "Kort stilbeskrivning" : "Short style description";
    const noteDesc = isSv ? "Praktiskt tips" : "Practical tip";

    const multiEventRules = isMultiEvent
      ? (isSv
        ? `
- VIKTIGT: Denna dag har ${events.length} händelser. Analysera om de kräver olika klädstilar.
- Om formalitetsnivån skiljer sig med 2+ poäng mellan händelser, sätt needs_change=true.
- Föreslå "versatile_pieces" — plagg som fungerar i flera sammanhang.
- Ge konkreta "transition_tip" — vad man kan byta/lägga till mellan block.
- Gruppera närliggande händelser med liknande formalitet i samma block.`
        : `
- IMPORTANT: This day has ${events.length} events. Analyze whether they require different outfit styles.
- If formality differs by 2+ points between events, set needs_change=true.
- Suggest "versatile_pieces" — garments that work across contexts.
- Give concrete "transition_tip" — what to swap/add between blocks.
- Group nearby events with similar formality into the same block.`)
      : "";

    const systemPrompt = isSv
      ? `Du är en stilmedveten dagplanerare. Analysera användarens kalenderhändelser och ge en kort, insiktsfull sammanfattning av dagen.

Svara ALLTID med giltig JSON i exakt detta format:
{
  "summary": "${summaryDesc}",
  "priorities": [
    { "title": "Händelsenamn", "occasion": "${occasionValues}", "formality": 1-5, "time": "HH:MM" }
  ],
  "outfit_hints": [
    { "occasion": "${occasionValues}", "style": "${styleDesc}", "note": "${noteDesc}" }
  ],
  ${transitionsSchema}
}

Regler:
- Identifiera dagens övergripande tema
- Ranka händelser efter hur mycket de påverkar klädseln
- Max 3 priorities och 2 outfit_hints
- Koppla varje outfit_hint till en occasion-typ${multiEventRules}
- Skriv på svenska
- Var kortfattad men insiktsfull`
      : `You are a style-conscious day planner. Analyze the user's calendar events and provide a short, insightful summary of the day.

ALWAYS respond with valid JSON in exactly this format:
{
  "summary": "${summaryDesc}",
  "priorities": [
    { "title": "Event name", "occasion": "${occasionValues}", "formality": 1-5, "time": "HH:MM" }
  ],
  "outfit_hints": [
    { "occasion": "${occasionValues}", "style": "${styleDesc}", "note": "${noteDesc}" }
  ],
  ${transitionsSchema}
}

Rules:
- Identify the day's overall theme
- Rank events by how much they affect clothing choices
- Max 3 priorities and 2 outfit_hints
- Link each outfit_hint to an occasion type${multiEventRules}
- Write in ${localeName}
- Be concise but insightful`;

    const userPrompt = `Dagens händelser:\n${eventsText}\n\n${weatherContext}`;

    try {
      const { data: content } = await callBursAI({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        complexity: "trivial",
        max_tokens: 400,
      });

      let result;
      if (typeof content === "string") {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          result = { summary: content, priorities: [], outfit_hints: [], transitions: null };
        }
      } else {
        result = content;
      }

      if (!result.transitions) {
        result.transitions = null;
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (aiErr) {
      console.error("AI failed for summarize_day:", aiErr);
      return new Response(
        JSON.stringify({ summary: null, priorities: [], outfit_hints: [], transitions: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    console.error("summarize_day error:", e);
    return bursAIErrorResponse(e, corsHeaders);
  }
});
