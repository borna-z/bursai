import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GarmentDef {
  title: string;
  category: string;
  subcategory?: string;
  color_primary: string;
  color_secondary?: string;
  material?: string;
  pattern?: string;
  fit?: string;
  formality?: number;
  season_tags?: string[];
}

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { action, garments } = await req.json();

    // Action: delete_all — remove all garments + storage files for user
    if (action === "delete_all") {
      // Get all garment image paths
      const { data: existing } = await supabase
        .from("garments")
        .select("id, image_path")
        .eq("user_id", user.id);

      if (existing && existing.length > 0) {
        // Delete storage files
        const paths = existing.map(g => g.image_path).filter(Boolean);
        if (paths.length > 0) {
          await supabase.storage.from("garments").remove(paths);
        }

        // Delete outfit_items referencing these garments
        const garmentIds = existing.map(g => g.id);
        await supabase.from("outfit_items").delete().in("garment_id", garmentIds);
        
        // Delete wear_logs
        await supabase.from("wear_logs").delete().eq("user_id", user.id);

        // Delete garments
        await supabase.from("garments").delete().eq("user_id", user.id);
      }

      // Delete outfits too (they reference deleted garments)
      await supabase.from("outfits").delete().eq("user_id", user.id);

      // Reset garment count
      await supabase.from("user_subscriptions").update({ garments_count: 0 }).eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true, deleted: existing?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: create_batch — create garments with AI images
    if (action !== "create_batch" || !Array.isArray(garments)) {
      throw new Error("Invalid action or missing garments array");
    }

    const results: Array<{ title: string; success: boolean; error?: string }> = [];

    for (const def of garments as GarmentDef[]) {
      try {
        // Build image prompt
        const parts = [def.color_primary];
        if (def.color_secondary) parts.push(`with ${def.color_secondary} accents`);
        if (def.material) parts.push(def.material);
        if (def.pattern && def.pattern !== "solid") parts.push(`${def.pattern} pattern`);
        if (def.fit) parts.push(`${def.fit} fit`);

        const prompt = `Product photograph of a single ${parts.join(" ")} ${def.title.toLowerCase()}, flat lay on pure white background, high-end fashion catalog, studio lighting, clean minimal composition, no person, no model, no mannequin, no text, no watermark, sharp detail`;

        console.log(`Generating: ${def.title}`);

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
          console.error(`AI error for ${def.title}: ${aiResponse.status} ${errText}`);
          results.push({ title: def.title, success: false, error: `AI ${aiResponse.status}` });
          // Wait before next to avoid rate limiting
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }

        const aiData = await aiResponse.json();
        const imageData = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!imageData || !imageData.startsWith("data:image")) {
          results.push({ title: def.title, success: false, error: "No image returned" });
          continue;
        }

        // Decode base64
        const base64 = imageData.split(",")[1];
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        // Generate unique ID for the garment
        const garmentId = crypto.randomUUID();
        const filePath = `${user.id}/${garmentId}.png`;

        // Upload to storage
        const { error: uploadErr } = await supabase.storage
          .from("garments")
          .upload(filePath, bytes, { contentType: "image/png", upsert: true });

        if (uploadErr) {
          results.push({ title: def.title, success: false, error: uploadErr.message });
          continue;
        }

        // Insert garment
        const { error: insertErr } = await supabase.from("garments").insert({
          id: garmentId,
          user_id: user.id,
          title: def.title,
          category: def.category,
          subcategory: def.subcategory || null,
          color_primary: def.color_primary,
          color_secondary: def.color_secondary || null,
          material: def.material || null,
          pattern: def.pattern || "solid",
          fit: def.fit || "regular",
          formality: def.formality ?? 3,
          season_tags: def.season_tags || ["spring", "summer", "autumn", "winter"],
          image_path: filePath,
          wear_count: 0,
          in_laundry: false,
        });

        if (insertErr) {
          results.push({ title: def.title, success: false, error: insertErr.message });
          continue;
        }

        results.push({ title: def.title, success: true });
        console.log(`✅ ${def.title}`);

        // Small delay between items to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
      } catch (itemErr) {
        results.push({
          title: def.title,
          success: false,
          error: itemErr instanceof Error ? itemErr.message : "Unknown",
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seed_wardrobe error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
