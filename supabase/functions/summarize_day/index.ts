import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const LOCALE_NAMES: Record<string, string> = {
      sv: "svenska", en: "English", no: "norsk", da: "dansk", fi: "finska",
      de: "Deutsch", fr: "français", es: "español", it: "italiano",
      pt: "português", nl: "Nederlands", ja: "日本語", ko: "한국어", ar: "العربية",
    };
    const localeName = LOCALE_NAMES[locale] || "English";
    const isSv = locale === "sv";

    const weatherContext = weather
      ? (isSv
        ? `Väder:${weather.temperature}°C,${weather.precipitation === "none" ? "uppehåll" : weather.precipitation === "rain" ? "regn" : "snö"}`
        : `Weather:${weather.temperature}°C,${weather.precipitation === "none" ? "clear" : weather.precipitation}`)
      : "";

    const eventsText = events
      .map((e: { title: string; start_time?: string; end_time?: string }) =>
        `${e.start_time || "?"}-${e.end_time || "?"}: ${e.title}`
      )
      .join("\n");

    const isMultiEvent = events.length >= 2;
    const occasionValues = isSv ? "jobb|fest|dejt|träning|vardag" : "work|party|date|workout|casual";

    const systemPrompt = isSv
      ? `Stilmedveten dagplanerare. Analysera kalendern, ge kort sammanfattning.
Svara med JSON: {"summary":"2-3 meningar","priorities":[{"title":"","occasion":"${occasionValues}","formality":1-5,"time":"HH:MM"}],"outfit_hints":[{"occasion":"","style":"","note":""}],"transitions":${isMultiEvent ? '{"needs_change":bool,"blocks":[{"time_range":"","occasion":"","formality":1-5,"label":"","style_tip":"","transition_tip":""}],"versatile_pieces":[]}' : 'null'}}
Max 3 priorities, 2 hints.${isMultiEvent ? ` ${events.length} händelser, analysera klädbyten.` : ""} Svenska.`
      : `Style-conscious day planner. Analyze calendar, give brief summary.
Respond with JSON: {"summary":"2-3 sentences","priorities":[{"title":"","occasion":"${occasionValues}","formality":1-5,"time":"HH:MM"}],"outfit_hints":[{"occasion":"","style":"","note":""}],"transitions":${isMultiEvent ? '{"needs_change":bool,"blocks":[{"time_range":"","occasion":"","formality":1-5,"label":"","style_tip":"","transition_tip":""}],"versatile_pieces":[]}' : 'null'}}
Max 3 priorities, 2 hints.${isMultiEvent ? ` ${events.length} events, analyze outfit changes.` : ""} ${localeName}.`;

    // Build cache key from events to cache same-day requests
    const eventsCacheKey = events.map((e: any) => e.title).sort().join(",");

    try {
      const { data: content } = await callBursAI({
        complexity: "trivial",
        max_tokens: 400,
        functionName: "summarize_day",
        cacheTtlSeconds: 3600,
        cacheNamespace: `summarize_day_${eventsCacheKey.slice(0, 20)}`,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${eventsText}\n${weatherContext}` },
        ],
      }, serviceClient);

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

      if (!result.transitions) result.transitions = null;

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
