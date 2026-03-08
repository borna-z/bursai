import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { outfit_id, selfie_path } = await req.json();
    if (!outfit_id || !selfie_path) throw new Error("Missing outfit_id or selfie_path");

    // Fetch outfit with garments
    const { data: outfitItems, error: itemsErr } = await supabase
      .from("outfit_items")
      .select("slot, garment_id, garments:garment_id(title, color_primary, category, material, image_path)")
      .eq("outfit_id", outfit_id);

    if (itemsErr) throw itemsErr;
    if (!outfitItems || outfitItems.length === 0) throw new Error("Outfit not found or empty");

    // Get signed URLs for garment images + selfie
    const imagePaths = [
      selfie_path,
      ...outfitItems.map((item: any) => item.garments?.image_path).filter(Boolean),
    ];

    const signedUrls: Record<string, string> = {};
    for (const path of imagePaths) {
      const { data } = await supabase.storage
        .from("garments")
        .createSignedUrl(path, 600);
      if (data?.signedUrl) signedUrls[path] = data.signedUrl;
    }

    const selfieUrl = signedUrls[selfie_path];
    if (!selfieUrl) throw new Error("Could not get selfie URL");

    // Build garment descriptions
    const garmentDescriptions = outfitItems.map((item: any) => {
      const g = item.garments;
      return `${item.slot}: ${g?.title || "Unknown"} (${g?.color_primary || ""} ${g?.category || ""}, ${g?.material || ""})`;
    }).join("\n");

    // Build multimodal prompt
    const imageContents: any[] = [
      {
        type: "image_url",
        image_url: { url: selfieUrl },
      },
    ];

    // Add garment images
    for (const item of outfitItems) {
      const g = (item as any).garments;
      if (g?.image_path && signedUrls[g.image_path]) {
        imageContents.push({
          type: "image_url",
          image_url: { url: signedUrls[g.image_path] },
        });
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

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
        tools: [
          {
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
          },
        ],
        tool_choice: { type: "function", function: { name: "outfit_photo_feedback" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();

    // Extract tool call result
    let feedback: any = null;
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        feedback = JSON.parse(toolCall.function.arguments);
      } catch {
        console.error("Failed to parse tool call arguments");
      }
    }

    if (!feedback) {
      // Fallback: try to extract from content
      throw new Error("AI did not return structured feedback");
    }

    // Store feedback
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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("outfit_photo_feedback error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
