import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse, estimateMaxTokens } from "../_shared/burs-ai.ts";
import { VOICE_DAY_SUMMARY } from "../_shared/burs-voice.ts";
import { buildDayIntelligence } from "../_shared/day-intelligence.ts";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, overloadResponse, enforceSubscription, subscriptionLockedResponse } from "../_shared/scale-guard.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // ── Scale guard ──
    if (checkOverload("summarize_day")) {
      return overloadResponse(CORS_HEADERS);
    }

    // ── Auth: require valid user JWT (P1) ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const { events, weather, locale } = await req.json();

    // Validate locale tag (BCP-47 style: `en`, `sv`, `pt-BR`). Anything else
    // falls back to `en`. The regex bounds what lands in the cache namespace,
    // so a malformed value can't poison the cache key.
    const userLocale = typeof locale === "string" && /^[a-z]{2}(-[A-Z]{2})?$/.test(locale)
      ? locale
      : "en";
    const LOCALE_NAMES: Record<string, string> = {
      en: "English", sv: "Swedish", no: "Norwegian", da: "Danish", fi: "Finnish",
      de: "German", fr: "French", es: "Spanish", pt: "Portuguese", it: "Italian",
      nl: "Dutch", pl: "Polish", ar: "Arabic", fa: "Persian", ja: "Japanese",
    };
    const localeName = LOCALE_NAMES[userLocale.split("-")[0]] ?? "English";

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ summary: null, priorities: [], outfit_hints: [], transitions: null, intelligence: null }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Wave 8 P54 — paywall gate. summarize_day lacks enforceRateLimit
    // (zero-input early-return guards against abuse), so the gate goes
    // immediately after service client construction.
    const subCheck = await enforceSubscription(serviceClient, user.id);
    if (!subCheck.allowed) {
      return subscriptionLockedResponse(subCheck.reason, CORS_HEADERS);
    }

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

    const systemPrompt = `${VOICE_DAY_SUMMARY}\n\nRespond in ${localeName}. Event titles may be in any language — interpret them but always write your output in ${localeName}.`;

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
        // P14: user-scope — previously `summarize_day_${eventsCacheKey}` was
        // keyed only by a 40-char slice of event titles, so two users with
        // identical calendar content (e.g. "Standup" + "Lunch") would
        // cross-leak each other's personalised day summary. userId also
        // populates ai_response_cache.user_id for the GDPR cascade delete.
        cacheNamespace: `summarize_day_${user.id}_${userLocale}_${eventsCacheKey}`,
        userId: user.id,
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
