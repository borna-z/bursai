import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse, estimateMaxTokens } from "../_shared/burs-ai.ts";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, overloadResponse } from "../_shared/scale-guard.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  if (checkOverload("suggest_accessories")) {
    return overloadResponse(CORS_HEADERS);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    await enforceRateLimit(serviceClient, user.id, "suggest_accessories");

    const { outfit_id } = await req.json();
    if (!outfit_id) throw new Error("Missing outfit_id");

    // Parallel DB queries
    const [outfitItemsRes, accessoriesRes] = await Promise.all([
      serviceClient
        .from("outfit_items")
        .select("slot, garment_id, garments:garment_id(title, category, color_primary, material)")
        .eq("outfit_id", outfit_id),
      serviceClient
        .from("garments")
        .select("id, title, category, subcategory, color_primary, material, pattern")
        .eq("user_id", user.id)
        .eq("category", "accessories")
        .eq("in_laundry", false),
    ]);

    const outfitItems = outfitItemsRes.data;
    if (!outfitItems || outfitItems.length === 0) throw new Error("Outfit empty");

    const accessories = accessoriesRes.data;
    if (!accessories || accessories.length === 0) {
      return new Response(JSON.stringify({ suggestions: [], message: "No accessories in wardrobe" }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const outfitDesc = outfitItems.map((i: any) => {
      const g = i.garments;
      return `${i.slot}:${g?.title}(${g?.color_primary},${g?.material || "?"})`;
    }).join("|");

    const accessoryList = accessories.map((a: any) =>
      `${a.id}|${a.title}|${a.subcategory || a.category}|${a.color_primary}|${a.material || "?"}`
    ).join("\n");

    const { data: result } = await callBursAI({
      complexity: "trivial",
      max_tokens: estimateMaxTokens({ outputItems: Math.min(accessories.length, 3), perItemTokens: 60, baseTokens: 120 }),
      functionName: "suggest_accessories",
      cacheTtlSeconds: 1800,
      cacheNamespace: "suggest_accessories",
      messages: [
        { role: "system", content: `Accessory stylist. Outfit:${outfitDesc}\nACCESSORIES:\n${accessoryList}\nSelect up to 3. Consider color, material, occasion.` },
        { role: "user", content: "Suggest accessories for this outfit." },
      ],
      tools: [{
        type: "function",
        function: {
          name: "suggest_accessories",
          description: "Return accessory suggestions",
          parameters: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    garment_id: { type: "string" },
                    reason: { type: "string" },
                  },
                  required: ["garment_id", "reason"],
                  additionalProperties: false,
                },
              },
            },
            required: ["suggestions"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "suggest_accessories" } },
    }, serviceClient);

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return rateLimitResponse(e, CORS_HEADERS);
    }
    console.error("suggest_accessories error:", e);
    return bursAIErrorResponse(e, CORS_HEADERS);
  }
});
