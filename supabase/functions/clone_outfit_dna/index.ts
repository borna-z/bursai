import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse, estimateMaxTokens } from "../_shared/burs-ai.ts";

import { CORS_HEADERS } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user) throw new Error("Unauthorized");
    const user = { id: userData.user.id };

    const { outfit_id } = await req.json();
    if (!outfit_id) throw new Error("Missing outfit_id");

    // Parallel DB queries
    const [outfitRes, allGarmentsRes] = await Promise.all([
      serviceClient
        .from("outfits")
        .select("*, outfit_items(slot, garment_id, garments:garment_id(title, category, color_primary, color_secondary, material, pattern, formality, fit))")
        .eq("id", outfit_id)
        .eq("user_id", user.id)
        .single(),
      serviceClient
        .from("garments")
        .select("id, title, category, color_primary, color_secondary, material, pattern, formality, fit, in_laundry")
        .eq("user_id", user.id)
        .or("in_laundry.is.null,in_laundry.eq.false"),
    ]);

    const outfit = outfitRes.data;
    if (outfitRes.error || !outfit) throw new Error("Outfit not found");

    const outfitDNA = outfit.outfit_items.map((item: any) => {
      const g = item.garments;
      return `${item.slot}:${g?.title}|${g?.color_primary}|${g?.material || "?"}|f${g?.formality || 3}`;
    }).join("\n");

    const availableGarments = (allGarmentsRes.data || [])
      .filter((g: any) => !outfit.outfit_items.some((item: any) => item.garment_id === g.id))
      .map((g: any) => `${g.id}|${g.title}|${g.category}|${g.color_primary}|${g.material || "?"}`)
      .join("\n");

    const { data: result } = await callBursAI({
      complexity: "standard",
      max_tokens: estimateMaxTokens({ outputItems: 3, perItemTokens: 120, baseTokens: 150 }),
      functionName: "clone_outfit_dna",
      cacheTtlSeconds: 1800,
      cacheNamespace: "clone_dna",
      messages: [
        { role: "system", content: `Fashion DNA analyst. User loves this outfit, wants similar variations.
DNA:\n${outfitDNA}\nOccasion:${outfit.occasion} Style:${outfit.style_vibe || "casual"}
AVAILABLE:\n${availableGarments}
Generate 3 variations preserving DNA (color ratios, formality, material harmony) with different pieces.` },
        { role: "user", content: "Generate 3 similar outfit variations." },
      ],
      tools: [{
        type: "function",
        function: {
          name: "suggest_variations",
          description: "Return 3 outfit variations",
          parameters: {
            type: "object",
            properties: {
              variations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    garment_ids: { type: "array", items: { type: "string" } },
                    explanation: { type: "string" },
                  },
                  required: ["name", "garment_ids", "explanation"],
                  additionalProperties: false,
                },
              },
            },
            required: ["variations"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "suggest_variations" } },
    }, serviceClient);

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("clone_outfit_dna error:", e);
    return bursAIErrorResponse(e, CORS_HEADERS);
  }
});
