import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse, estimateMaxTokens } from "../_shared/burs-ai.ts";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, overloadResponse } from "../_shared/scale-guard.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  if (checkOverload("visual_search")) {
    return overloadResponse(CORS_HEADERS);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await enforceRateLimit(serviceClient, userId, "visual_search");

    const { image_base64, locale = "sv" } = await req.json();
    if (!image_base64) throw new Error("Missing image_base64");

    const { data: garments, error: gErr } = await supabase
      .from("garments")
      .select("id, title, category, subcategory, color_primary, color_secondary, pattern, material, fit, formality")
      .eq("user_id", userId);

    if (gErr) throw gErr;
    if (!garments || garments.length < 3) {
      return new Response(JSON.stringify({ matches: [], gaps: [], description: "Add more garments first." }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const garmentList = garments.map(g => {
      const parts = [`ID:${g.id}`, g.title, `cat:${g.category}`, `color:${g.color_primary}`];
      if (g.material) parts.push(`material:${g.material}`);
      if (g.pattern) parts.push(`pattern:${g.pattern}`);
      if (g.fit) parts.push(`fit:${g.fit}`);
      return parts.join(" | ");
    }).join("\n");

    const LANG_NAMES: Record<string, string> = {
      sv: "svenska", en: "English", no: "norsk", da: "dansk", fi: "suomi",
      de: "Deutsch", fr: "français", es: "español", it: "italiano",
      pt: "português", nl: "Nederlands", pl: "polski", ar: "العربية", fa: "فارسی",
    };
    const langName = LANG_NAMES[locale] || "English";

    const { data: result } = await callBursAI({
      messages: [
        {
          role: "system",
          content: `You are a fashion visual search engine. Analyze the inspiration image and match garments from the user's wardrobe. Respond in ${langName}.

USER'S WARDROBE:
${garmentList}`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this inspiration image. Identify every garment/piece visible and find the closest matches in my wardrobe. For items with no good match, list them as gaps." },
            { type: "image_url", image_url: { url: image_base64 } },
          ],
        },
      ],
      tools: [{
        type: "function",
        function: {
          name: "visual_match",
          description: "Return visual search results matching inspiration to wardrobe",
          parameters: {
            type: "object",
            properties: {
              description: { type: "string", description: "Brief description of the outfit in the image" },
              matches: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    detected_item: { type: "string" },
                    garment_id: { type: "string" },
                    confidence: { type: "number", description: "Match confidence 0-100" },
                    reason: { type: "string" },
                  },
                  required: ["detected_item", "garment_id", "confidence", "reason"],
                  additionalProperties: false,
                },
              },
              gaps: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    detected_item: { type: "string" },
                    suggestion: { type: "string" },
                  },
                  required: ["detected_item", "suggestion"],
                  additionalProperties: false,
                },
              },
            },
            required: ["description", "matches", "gaps"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "visual_match" } },
      complexity: "complex",
      max_tokens: estimateMaxTokens({ inputItems: garments.length, outputItems: 5, perItemTokens: 80, baseTokens: 200 }),
      functionName: "visual_search",
      cacheTtlSeconds: 1800, // 30 minutes
      cacheNamespace: `visual_search_${userId}`,
      // Codex P1 round 2 on PR #659: pass userId so storeCache populates
      // ai_response_cache.user_id for the GDPR cascade delete.
      userId,
    }, serviceClient);

    const garmentIdSet = new Set(garments.map(g => g.id));
    result.matches = (result.matches || []).filter((m: any) => garmentIdSet.has(m.garment_id));

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return rateLimitResponse(e, CORS_HEADERS);
    }
    console.error("visual_search error:", e);
    return bursAIErrorResponse(e, CORS_HEADERS);
  }
});
