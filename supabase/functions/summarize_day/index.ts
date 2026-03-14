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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { events, weather, locale = "en" } = await req.json();

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
      ? `${weather.temperature}°C, ${weather.precipitation === "none" ? "clear" : weather.precipitation}`
      : "";

    const eventsText = events
      .map((e: { title: string; start_time?: string; end_time?: string }) =>
        `${e.start_time || "?"}-${e.end_time || "?"}: ${e.title}`
      )
      .join("\n");

    const isMultiEvent = events.length >= 2;

    const systemPrompt = `You are a style-conscious day planner. Analyze the calendar events and provide a brief summary with outfit tips. Respond in ${localeName}.`;

    const eventsCacheKey = events.map((e: any) => e.title).sort().join(",").slice(0, 40);

    // Build transitions schema for tool
    const transitionItemSchema: any = {
      type: "object",
      properties: {
        time_range: { type: "string" },
        occasion: { type: "string" },
        formality: { type: "number" },
        label: { type: "string" },
        style_tip: { type: "string" },
        transition_tip: { type: "string" },
      },
      required: ["time_range", "occasion", "formality", "label", "style_tip"],
      additionalProperties: false,
    };

    try {
      const { data: result } = await callBursAI({
        complexity: "trivial",
        max_tokens: estimateMaxTokens({ inputItems: events.length, perItemTokens: 80, baseTokens: 200 }),
        functionName: "summarize_day",
        cacheTtlSeconds: 3600,
        cacheNamespace: `summarize_day_${eventsCacheKey}`,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Events:\n${eventsText}${weatherContext ? `\nWeather: ${weatherContext}` : ""}${isMultiEvent ? `\nNote: ${events.length} events — analyze if outfit changes needed.` : ""}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "day_summary",
            description: "Return day summary with outfit priorities and hints",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "2-3 sentence summary of the day's theme and outfit direction" },
                priorities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      occasion: { type: "string" },
                      formality: { type: "number" },
                      time: { type: "string" },
                    },
                    required: ["title", "occasion", "formality", "time"],
                    additionalProperties: false,
                  },
                },
                outfit_hints: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      occasion: { type: "string" },
                      style: { type: "string" },
                      note: { type: "string" },
                    },
                    required: ["occasion", "style", "note"],
                    additionalProperties: false,
                  },
                },
                transitions: isMultiEvent ? {
                  type: "object",
                  properties: {
                    needs_change: { type: "boolean" },
                    blocks: { type: "array", items: transitionItemSchema },
                    versatile_pieces: { type: "array", items: { type: "string" } },
                  },
                  required: ["needs_change", "blocks", "versatile_pieces"],
                  additionalProperties: false,
                } : { type: "null" },
              },
              required: ["summary", "priorities", "outfit_hints"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "day_summary" } },
      }, serviceClient);

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
