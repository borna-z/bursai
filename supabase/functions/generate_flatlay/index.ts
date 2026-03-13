import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse } from "../_shared/burs-ai.ts";

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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { outfit_id } = await req.json();
    if (!outfit_id) throw new Error("Missing outfit_id");

    const { data: outfit, error: outfitErr } = await supabase
      .from("outfits")
      .select(`
        id, occasion, style_vibe,
        outfit_items (
          slot,
          garment:garments (id, title, category, color_primary, material, pattern, image_path)
        )
      `)
      .eq("id", outfit_id)
      .eq("user_id", user.id)
      .single();

    if (outfitErr || !outfit) throw new Error("Outfit not found");

    const items = (outfit as any).outfit_items || [];
    if (items.length === 0) throw new Error("No items in outfit");

    const imageContents: { role: string; content: any }[] = [];
    const garmentDescriptions: string[] = [];

    for (const item of items) {
      const garment = item.garment;
      if (!garment?.image_path) continue;

      const { data: signedData } = await supabase.storage
        .from("garments")
        .createSignedUrl(garment.image_path, 600);

      if (!signedData?.signedUrl) continue;

      const imgResp = await fetch(signedData.signedUrl);
      if (!imgResp.ok) continue;
      const imgBytes = new Uint8Array(await imgResp.arrayBuffer());
      let binary = "";
      for (let i = 0; i < imgBytes.length; i += 8192) {
        const chunk = imgBytes.subarray(i, Math.min(i + 8192, imgBytes.length));
        for (let j = 0; j < chunk.length; j++) binary += String.fromCharCode(chunk[j]);
      }
      const base64 = btoa(binary);
      const mimeType = garment.image_path.endsWith(".png") ? "image/png" : "image/jpeg";

      imageContents.push({
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: "text", text: `This is the ${item.slot}: ${garment.title} (${garment.color_primary} ${garment.category})` },
        ],
      });

      garmentDescriptions.push(
        `${item.slot}: ${garment.title} — ${garment.color_primary} ${garment.material || ""} ${garment.pattern || ""} ${garment.category}`
      );
    }

    const occasion = outfit.occasion || "casual";
    const style = (outfit as any).style_vibe || "";

    const systemPrompt = `You are a premium fashion flat-lay photographer. Create a beautiful, editorial-quality flat-lay arrangement of the provided clothing items. 

Rules:
- Arrange ALL provided garments in a clean, aesthetically pleasing flat-lay composition
- Use a clean white/light background  
- Show the items neatly arranged as if laid out on a bed or table
- Style it like a high-end fashion magazine flat-lay
- No person, no mannequin, no hangers
- Include subtle styling props if appropriate (sunglasses, watch) but keep focus on the clothes
- The arrangement should feel intentional and curated
- Occasion: ${occasion}${style ? `, Style: ${style}` : ""}

Items to arrange:
${garmentDescriptions.join("\n")}

Generate a single flat-lay image arranging these exact garments together.`;

    const messages = [
      ...imageContents,
      { role: "user", content: systemPrompt },
    ];

    console.log(`Generating flat-lay for outfit ${outfit_id} with ${items.length} items`);

    const { data: aiResult } = await callBursAI({
      messages,
      modelType: "image-gen",
      extraBody: { modalities: ["image", "text"] },
    });

    // Extract image from response
    const imageData = aiResult?.images?.[0]?.image_url?.url
      || aiResult?.__raw?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageData || !imageData.startsWith("data:image")) {
      throw new Error("No image returned from AI");
    }

    // Decode and upload
    const base64Image = imageData.split(",")[1];
    const binaryStr = atob(base64Image);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const filePath = `${user.id}/flatlay_${outfit_id}.png`;

    const { error: uploadErr } = await supabase.storage
      .from("garments")
      .upload(filePath, bytes, { contentType: "image/png", upsert: true });

    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

    const { error: updateErr } = await supabase
      .from("outfits")
      .update({ flatlay_image_path: filePath })
      .eq("id", outfit_id);

    if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);

    console.log(`✅ Flat-lay generated for outfit ${outfit_id}`);

    return new Response(
      JSON.stringify({ success: true, flatlay_image_path: filePath }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate_flatlay error:", e);
    return bursAIErrorResponse(e, corsHeaders);
  }
});
