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

    const { outfit_id } = await req.json();
    if (!outfit_id) throw new Error("Missing outfit_id");

    // Fetch outfit with items and garments
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

    // Get signed URLs for garment images
    const imageContents: { role: string; content: any }[] = [];
    const garmentDescriptions: string[] = [];

    for (const item of items) {
      const garment = item.garment;
      if (!garment?.image_path) continue;

      // Get signed URL
      const { data: signedData } = await supabase.storage
        .from("garments")
        .createSignedUrl(garment.image_path, 600);

      if (!signedData?.signedUrl) continue;

      // Download image and convert to base64
      const imgResp = await fetch(signedData.signedUrl);
      if (!imgResp.ok) continue;
      const imgBytes = new Uint8Array(await imgResp.arrayBuffer());
      const base64 = btoa(String.fromCharCode(...imgBytes));
      const mimeType = garment.image_path.endsWith(".png") ? "image/png" : "image/jpeg";

      imageContents.push({
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
          {
            type: "text",
            text: `This is the ${item.slot}: ${garment.title} (${garment.color_primary} ${garment.category})`,
          },
        ],
      });

      garmentDescriptions.push(
        `${item.slot}: ${garment.title} — ${garment.color_primary} ${garment.material || ""} ${garment.pattern || ""} ${garment.category}`
      );
    }

    // Build the flat-lay generation prompt
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

    // Send all images + prompt to AI
    const messages = [
      ...imageContents,
      {
        role: "user",
        content: systemPrompt,
      },
    ];

    console.log(`Generating flat-lay for outfit ${outfit_id} with ${items.length} items`);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages,
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`AI error: ${aiResponse.status} ${errText}`);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const imageData = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageData || !imageData.startsWith("data:image")) {
      throw new Error("No image returned from AI");
    }

    // Decode and upload
    const base64Image = imageData.split(",")[1];
    const binaryStr = atob(base64Image);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const filePath = `${user.id}/flatlay_${outfit_id}.png`;

    const { error: uploadErr } = await supabase.storage
      .from("garments")
      .upload(filePath, bytes, { contentType: "image/png", upsert: true });

    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

    // Update outfit with flatlay path
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
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
