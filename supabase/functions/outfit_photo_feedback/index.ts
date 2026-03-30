import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse } from "../_shared/burs-ai.ts";

import { CORS_HEADERS } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    const { outfit_id, selfie_path } = await req.json();
    if (!outfit_id || !selfie_path) throw new Error("Missing outfit_id or selfie_path");

    const { data: outfitItems, error: itemsErr } = await supabase
      .from("outfit_items")
      .select("slot, garment_id, garments:garment_id(title, color_primary, category, material, image_path)")
      .eq("outfit_id", outfit_id);

    if (itemsErr) throw itemsErr;
    if (!outfitItems || outfitItems.length === 0) throw new Error("Outfit not found or empty");

    const imagePaths = [
      selfie_path,
      ...outfitItems.map((item: any) => item.garments?.image_path).filter(Boolean),
    ];

    const signedUrls: Record<string, string> = {};
    for (const path of imagePaths) {
      const { data } = await supabase.storage.from("garments").createSignedUrl(path, 600);
      if (data?.signedUrl) signedUrls[path] = data.signedUrl;
    }

    const selfieUrl = signedUrls[selfie_path];
    if (!selfieUrl) throw new Error("Could not get selfie URL");

    const garmentDescriptions = outfitItems.map((item: any) => {
      const g = item.garments;
      return `${item.slot}: ${g?.title || "Unknown"} (${g?.color_primary || ""} ${g?.category || ""}, ${g?.material || ""})`;
    }).join("\n");

    const imageContents: any[] = [
      { type: "image_url", image_url: { url: selfieUrl } },
    ];

    for (const item of outfitItems) {
      const g = (item as any).garments;
      if (g?.image_path && signedUrls[g.image_path]) {
        imageContents.push({ type: "image_url", image_url: { url: signedUrls[g.image_path] } });
      }
    }

    const systemPrompt = `You are a premium AI fashion stylist for the BURS wardrobe app. The user has uploaded a mirror selfie wearing an outfit. You also have the individual garment photos from their digital wardrobe.

Compare the selfie to the expected outfit and provide structured feedback.

Garment details:
${garmentDescriptions}

Analyze:
1. FIT: How well do the garments fit on this person? Consider proportions, length, silhouette.
2. COLOR MATCH: Do the colors work together as expected? Does the lighting/real-world view change the palette?
3. OVERALL: Overall impression — does the outfit achieve its intended look?

For each dimension, provide a score from 1.0 to 10.0.
Also provide a short, helpful commentary (2-3 sentences) with actionable styling tips.`;

    const { data: feedback } = await callBursAI({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Here is my mirror selfie followed by the individual garment photos. Please analyze how the outfit looks on me." },
            ...imageContents,
          ],
        },
      ],
      tools: [{
        type: "function",
        function: {
          name: "outfit_photo_feedback",
          description: "Return structured feedback on the outfit selfie",
          parameters: {
            type: "object",
            properties: {
              fit_score: { type: "number", description: "Fit score 1.0-10.0" },
              color_match_score: { type: "number", description: "Color match score 1.0-10.0" },
              overall_score: { type: "number", description: "Overall score 1.0-10.0" },
              commentary: { type: "string", description: "2-3 sentence actionable styling feedback" },
            },
            required: ["fit_score", "color_match_score", "overall_score", "commentary"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "outfit_photo_feedback" } },
      complexity: "complex",
      max_tokens: 300,
      functionName: "outfit_photo_feedback",
    });

    if (!feedback) throw new Error("AI did not return structured feedback");

    const { data: inserted, error: insertErr } = await supabase
      .from("outfit_feedback")
      .insert({
        outfit_id,
        user_id: user.id,
        selfie_path,
        fit_score: feedback.fit_score,
        color_match_score: feedback.color_match_score,
        overall_score: feedback.overall_score,
        commentary: feedback.commentary,
        ai_raw: feedback,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify(inserted), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("outfit_photo_feedback error:", e);
    return bursAIErrorResponse(e, CORS_HEADERS);
  }
});
