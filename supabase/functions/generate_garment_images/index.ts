import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse, AIQuotaExceededError } from "../_shared/burs-ai.ts";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, overloadResponse, enforceSubscription, subscriptionLockedResponse } from "../_shared/scale-guard.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // ── Scale guard ──
    if (checkOverload("generate_garment_images")) {
      return overloadResponse(CORS_HEADERS);
    }

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

    // Rate limit — image generation is very expensive
    await enforceRateLimit(supabase, user.id, "generate_garment_images");

    // Wave 8 P54 — paywall gate.
    const subCheck = await enforceSubscription(supabase, user.id);
    if (!subCheck.allowed) {
      return subscriptionLockedResponse(subCheck.reason, CORS_HEADERS);
    }

    const { garment_ids } = await req.json();
    if (!Array.isArray(garment_ids) || garment_ids.length === 0) {
      throw new Error("garment_ids array required");
    }

    const { data: garments, error: fetchErr } = await supabase
      .from("garments")
      .select("id, title, category, color_primary, color_secondary, material, pattern, fit, subcategory")
      .in("id", garment_ids)
      .eq("user_id", user.id);

    if (fetchErr) throw fetchErr;
    if (!garments || garments.length === 0) {
      return new Response(JSON.stringify({ results: [], error: "No garments found" }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const garment of garments) {
      try {
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

        // Codex P1 round 3 on PR #816 — pass `userId` + the service
        // client so callBursAI's N2 monthly cost ceiling check runs and
        // ai_token_usage gets the per-user attribution. Surfacing this
        // CTA from mobile would otherwise let a subscribed user keep
        // burning the expensive image model up to the per-hour rate
        // limit while bypassing the monthly quota/accounting.
        //
        // Codex P1 round 5 on PR #816 — drop the `models:` override.
        // The previous pin was `google/gemini-2.5-flash-image`, an
        // OpenRouter-style provider-prefixed id; callBursAI hits
        // Google's OpenAI-compat endpoint directly (`GEMINI_URL`),
        // which only accepts bare `gemini-*` ids. The prefixed id
        // returned a 404 / model-not-found, which is the failure
        // class that surfaced as "No image in AI response" in the
        // existing code path. Match `generate_flatlay`: rely on the
        // shared `image-gen` MODEL_CHAINS entry.
        const { data: aiResult } = await callBursAI({
          messages: [{ role: "user", content: prompt }],
          modelType: "image-gen",
          extraBody: { modalities: ["image", "text"] },
          functionName: "generate_garment_images",
          userId: user.id,
        }, supabase);

        const imageData = aiResult?.images?.[0]?.image_url?.url
          || aiResult?.__raw?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!imageData || !imageData.startsWith("data:image")) {
          results.push({ id: garment.id, success: false, error: "No image in AI response" });
          continue;
        }

        const base64 = imageData.split(",")[1];
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

        const filePath = `${user.id}/${garment.id}.png`;
        const { error: uploadErr } = await supabase.storage
          .from("garments")
          .upload(filePath, bytes, { contentType: "image/png", upsert: true });

        if (uploadErr) {
          results.push({ id: garment.id, success: false, error: uploadErr.message });
          continue;
        }

        const { error: updateErr } = await supabase
          .from("garments")
          .update({ image_path: filePath, updated_at: new Date().toISOString() })
          .eq("id", garment.id);

        if (updateErr) {
          results.push({ id: garment.id, success: false, error: updateErr.message });
          continue;
        }

        results.push({ id: garment.id, success: true });
        console.log(`✅ Generated image for ${garment.id}`);
      } catch (itemErr) {
        // Codex P2 round 4 on PR #816 — let quota-class failures escape
        // the per-item loop. AIQuotaExceededError signals the N2 monthly
        // ceiling is hit; swallowing it into `success: false` returns 200
        // and the mobile hook's 402 paywall route never fires. Outer
        // catch maps it back to a 402 response so the
        // EdgeFunctionSubscriptionLockedError branch in
        // edgeFunctionClient surfaces SUBSCRIPTION_SENTINEL upstream.
        if (itemErr instanceof AIQuotaExceededError) {
          throw itemErr;
        }
        results.push({
          id: garment.id,
          success: false,
          error: itemErr instanceof Error ? itemErr.message : "Unknown error",
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return rateLimitResponse(e, CORS_HEADERS);
    }
    if (e instanceof AIQuotaExceededError) {
      // Match `subscriptionLockedResponse` body shape so the mobile
      // wrapper's existing 402 handler flips it to
      // EdgeFunctionSubscriptionLockedError without a special-case branch.
      return new Response(
        JSON.stringify({ error: "subscription_required", reason: "quota_exceeded" }),
        { status: 402, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }
    console.error("generate_garment_images error:", e);
    return bursAIErrorResponse(e, CORS_HEADERS);
  }
});
