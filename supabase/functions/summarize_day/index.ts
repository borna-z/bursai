import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse, estimateMaxTokens } from "../_shared/burs-ai.ts";
import { VOICE_DAY_SUMMARY } from "../_shared/burs-voice.ts";
import { buildDayIntelligence } from "../_shared/day-intelligence.ts";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, overloadResponse } from "../_shared/scale-guard.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // ── Scale guard ──
    if (checkOverload("summarize_day")) {
      return overloadResponse(CORS_HEADERS);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const { events, weather } = await req.json();

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ summary: null, priorities: [], outfit_hints: [], transitions: null, intelligence: null }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await enforceRateLimit(serviceClient, user.id, "summarize_day");

    const intelligence = buildDayIntelligence(events, weather || undefined);

    const weatherContext = weather
      ? `${weather.temperature}°C, ${weather.precipitation === "none" ? "clear" : weather.precipitation}`
      : "";

    const eventsText = events
      .map((e: { title: string; start_time?: string; end_time?: string }) =>
        `${e.start_time || "?"}-${e.end_time || "?"}: ${e.title}`
      )
      .join("\n");

    const isMultiEvent = events.length >= 2;

    const systemPrompt = `${VOICE_DAY_SUMMARY}\n\nAlways respond in English regardless of the language of the calendar event titles. Event titles may be in Swedish, Finnish, or any other language — interpret them but always write your output in English.`;

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
        cacheNamespace: `summarize_day_${user.id}_${eventsCacheKey}`,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Events:\n${eventsText}${weatherContext ? `\nWeather: ${weatherContext}` : ""}${isMultiEvent ? `\nNote: ${events.length} events — analyze if outfit changes needed.` : ""}
Structured day intelligence:
- Dominant occasion: ${intelligence.dominant_occasion}
- Dominant formality: ${intelligence.dominant_formality}/5
- Strategy: ${intelligence.strategy}
- Transition complexity: ${intelligence.transition_complexity}
- Anchor event: ${intelligence.anchor_event?.title || "none"}
- Weather sensitivity: ${intelligence.weather_sensitivity}
- Wardrobe priorities: ${intelligence.wardrobe_priorities.join(", ") || "none"}`,
          },
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
                intelligence: {
                  type: "object",
                  properties: {
                    dominant_occasion: { type: "string" },
                    dominant_formality: { type: "number" },
                    strategy: { type: "string" },
                    transition_summary: { type: "string" },
                    weather_constraints: { type: "array", items: { type: "string" } },
                    wardrobe_priorities: { type: "array", items: { type: "string" } },
                    emphasis: {
                      type: "object",
                      properties: {
                        comfort: { type: "number" },
                        polish: { type: "number" },
                        versatility: { type: "number" },
                        weather_protection: { type: "number" },
                        travel_practicality: { type: "number" },
                      },
                      required: ["comfort", "polish", "versatility", "weather_protection", "travel_practicality"],
                      additionalProperties: false,
                    },
                  },
                  required: ["dominant_occasion", "dominant_formality", "strategy", "transition_summary", "weather_constraints", "wardrobe_priorities", "emphasis"],
                  additionalProperties: false,
                },
              },
              required: ["summary", "priorities", "outfit_hints", "intelligence"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "day_summary" } },
      }, serviceClient);

      if (!result.transitions) result.transitions = null;
      if (!result.intelligence) result.intelligence = intelligence;

      return new Response(JSON.stringify(result), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (aiErr) {
      console.error("AI failed for summarize_day:", aiErr);
      return new Response(
        JSON.stringify({ summary: null, priorities: [], outfit_hints: [], transitions: null, intelligence }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    if (e instanceof RateLimitError) {
      return rateLimitResponse(e, CORS_HEADERS);
    }
    console.error("summarize_day error:", e);
    return bursAIErrorResponse(e, CORS_HEADERS);
  }
});
