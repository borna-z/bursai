import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse } from "../_shared/burs-ai.ts";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { checkIdempotency, storeIdempotencyResult } from "../_shared/idempotency.ts";

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
  image_prompt_hint?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // Return cached response for duplicate idempotent requests
  const cachedResponse = checkIdempotency(req);
  if (cachedResponse) {
    console.log("[SEED-WARDROBE] Returning cached idempotent response");
    return cachedResponse;
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
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error("Unauthorized");
    const user = { id: claimsData.claims.sub as string };

    const { action, garments, garment_index } = await req.json();

    // Action: delete_all
    if (action === "delete_all") {
      const { data: existing } = await supabase
        .from("garments")
        .select("id, image_path")
        .eq("user_id", user.id);

      if (existing && existing.length > 0) {
        const paths = existing.map(g => g.image_path).filter(Boolean);
        if (paths.length > 0) {
          await supabase.storage.from("garments").remove(paths);
        }
        const garmentIds = existing.map(g => g.id);
        await supabase.from("outfit_items").delete().in("garment_id", garmentIds);
        await supabase.from("wear_logs").delete().eq("user_id", user.id);
        await supabase.from("garments").delete().eq("user_id", user.id);
      }

      await supabase.from("outfits").delete().eq("user_id", user.id);
      await supabase.from("user_subscriptions").update({ garments_count: 0 }).eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true, deleted: existing?.length || 0 }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (action !== "create_batch" || !Array.isArray(garments)) {
      throw new Error("Invalid action or missing garments array");
    }

    const results: Array<{ title: string; success: boolean; error?: string }> = [];
    const baseIndex = garment_index || 0;

    for (let idx = 0; idx < garments.length; idx++) {
      const def = garments[idx] as GarmentDef;
      try {
        const parts = [def.color_primary];
        if (def.color_secondary) parts.push(`with ${def.color_secondary} accents`);
        if (def.material) parts.push(def.material);
        if (def.pattern && def.pattern !== "solid") parts.push(`${def.pattern} pattern`);
        if (def.fit) parts.push(`${def.fit} fit`);

        const hint = def.image_prompt_hint || "flat lay on white background";
        const itemIndex = baseIndex + idx;

        const prompt = `High-end fashion catalog photograph #${itemIndex}: a single ${parts.join(" ")} ${def.title.toLowerCase()}, ${hint}, studio lighting, 8K detail, sharp focus, no person, no model, no mannequin, no text, no watermark, no logo`;

        console.log(`[${itemIndex}] Generating: ${def.title}`);

        const { data: aiResult } = await callBursAI({
          messages: [{ role: "user", content: prompt }],
          modelType: "image-gen",
          extraBody: { modalities: ["image", "text"] },
        });

        const imageData = aiResult?.images?.[0]?.image_url?.url
          || aiResult?.__raw?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!imageData || !imageData.startsWith("data:image")) {
          results.push({ title: def.title, success: false, error: "No image returned" });
          continue;
        }

        const base64 = imageData.split(",")[1];
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const garmentId = crypto.randomUUID();
        const filePath = `${user.id}/${garmentId}.png`;

        const { error: uploadErr } = await supabase.storage
          .from("garments")
          .upload(filePath, bytes, { contentType: "image/png", upsert: true });

        if (uploadErr) {
          results.push({ title: def.title, success: false, error: uploadErr.message });
          continue;
        }

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
        console.log(`✅ [${itemIndex}] ${def.title}`);

      } catch (itemErr) {
        results.push({
          title: def.title,
          success: false,
          error: itemErr instanceof Error ? itemErr.message : "Unknown",
        });
      }
    }

    const response = new Response(JSON.stringify({ results }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
    await storeIdempotencyResult(req, response);
    return response;
  } catch (e) {
    console.error("seed_wardrobe error:", e);
    return bursAIErrorResponse(e, CORS_HEADERS);
  }
});
