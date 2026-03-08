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

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { garment_ids } = await req.json();
    if (!Array.isArray(garment_ids) || garment_ids.length === 0) {
      throw new Error("garment_ids array required");
    }

    // Fetch garment details
    const { data: garments, error: fetchErr } = await supabase
      .from("garments")
      .select("id, title, category, color_primary, color_secondary, material, pattern, fit, subcategory")
      .in("id", garment_ids)
      .eq("user_id", user.id);

    if (fetchErr) throw fetchErr;
    if (!garments || garments.length === 0) {
      return new Response(JSON.stringify({ results: [], error: "No garments found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const garment of garments) {
      try {
        // Build a descriptive prompt
        const parts = [garment.color_primary];
        if (garment.color_secondary) parts.push(`and ${garment.color_secondary}`);
        if (garment.material) parts.push(garment.material);
        if (garment.pattern && garment.pattern !== "solid") parts.push(garment.pattern);
        if (garment.fit) parts.push(`${garment.fit} fit`);

        const itemName = garment.subcategory
          ? `${garment.subcategory} ${garment.category}`
          : garment.title;

        const prompt = `Product photo of a single ${parts.join(" ")} ${itemName}, flat lay on pure white background, high-end fashion catalog style, clean minimal, no person, no model, no text, studio lighting`;

        console.log(`Generating image for ${garment.id}: ${prompt}`);

        // Call Gemini image generation
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content: prompt }],
            modalities: ["image", "text"],
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error(`AI error for ${garment.id}: ${aiResponse.status} ${errText}`);
          results.push({ id: garment.id, success: false, error: `AI ${aiResponse.status}` });
          continue;
        }

        const aiData = await aiResponse.json();
        const imageData = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!imageData || !imageData.startsWith("data:image")) {
          results.push({ id: garment.id, success: false, error: "No image in AI response" });
          continue;
        }

        // Decode base64
        const base64 = imageData.split(",")[1];
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        // Upload to storage
        const filePath = `${user.id}/${garment.id}.png`;
        const { error: uploadErr } = await supabase.storage
          .from("garments")
          .upload(filePath, bytes, {
            contentType: "image/png",
            upsert: true,
          });

        if (uploadErr) {
          console.error(`Upload error for ${garment.id}:`, uploadErr);
          results.push({ id: garment.id, success: false, error: uploadErr.message });
          continue;
        }

        // Update garment record
        const { error: updateErr } = await supabase
          .from("garments")
          .update({ image_path: filePath, updated_at: new Date().toISOString() })
          .eq("id", garment.id);

        if (updateErr) {
          console.error(`DB update error for ${garment.id}:`, updateErr);
          results.push({ id: garment.id, success: false, error: updateErr.message });
          continue;
        }

        results.push({ id: garment.id, success: true });
        console.log(`✅ Generated image for ${garment.id}`);
      } catch (itemErr) {
        console.error(`Error processing ${garment.id}:`, itemErr);
        results.push({
          id: garment.id,
          success: false,
          error: itemErr instanceof Error ? itemErr.message : "Unknown error",
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate_garment_images error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
