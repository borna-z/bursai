import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse } from "../_shared/burs-ai.ts";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { checkIdempotency, storeIdempotencyResult } from "../_shared/idempotency.ts";
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, overloadResponse } from "../_shared/scale-guard.ts";

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

  if (checkOverload("seed_wardrobe")) {
    return overloadResponse(CORS_HEADERS);
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
    const { data: { user }, error: userError } = await authClient.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    await enforceRateLimit(supabase, user.id, "seed_wardrobe");

    const body = await req.json();
    const { action, garments, garment_index, confirmation } = body;

    // Action: request_delete_token — issues a one-use 5-minute token
    // that MUST be echoed back in a subsequent `delete_all` call. Decouples
    // the destructive op from a single malicious POST body: the attacker
    // must first receive the server-issued token, then replay it within
    // the window. Token is 32 cryptographically random bytes (256 bits of
    // entropy) via crypto.getRandomValues, hex-encoded.
    if (action === "request_delete_token") {
      const tokenBytes = new Uint8Array(32);
      crypto.getRandomValues(tokenBytes);
      const newToken = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          delete_confirmation_token: newToken,
          delete_confirmation_expires_at: expiresAt,
        })
        .eq("id", user.id);

      if (updateErr) {
        console.error("[seed_wardrobe] failed to store delete token:", updateErr.message);
        return new Response(JSON.stringify({ error: "Could not issue confirmation token" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ confirmation_token: newToken, expires_at: expiresAt }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // Action: delete_all
    if (action === "delete_all") {
      // P11 — destructive-op gate. Require a fresh server-issued confirmation
      // token. Caller must first POST {action:"request_delete_token"} to
      // receive one; it's consumed on first delete_all. Same-tab flow only —
      // any cross-tab or replay attack would have to intercept the token in
      // the short 5-minute window, after which the stored value expires.
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("delete_confirmation_token, delete_confirmation_expires_at")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr) {
        console.error("[seed_wardrobe] profile lookup failed:", profileErr.message);
        return new Response(JSON.stringify({ error: "Could not verify confirmation" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const storedToken = profile?.delete_confirmation_token;
      const expiresAt = profile?.delete_confirmation_expires_at
        ? new Date(profile.delete_confirmation_expires_at)
        : null;

      if (!confirmation || !storedToken || confirmation !== storedToken) {
        return new Response(
          JSON.stringify({
            error: "Confirmation token required. POST {action:\"request_delete_token\"} first.",
          }),
          {
            status: 403,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          },
        );
      }

      if (!expiresAt || expiresAt.getTime() < Date.now()) {
        return new Response(JSON.stringify({ error: "Confirmation token expired" }), {
          status: 403,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // Consume the token so it can't be replayed. Done BEFORE the wipe so
      // that even if the wipe partially fails the token is already burned.
      await supabase
        .from("profiles")
        .update({
          delete_confirmation_token: null,
          delete_confirmation_expires_at: null,
        })
        .eq("id", user.id);

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

        // Atomic delete-with-release per garment (Codex round 13 redesign).
        // Each call is one server-side transaction: releases active
        // reservations AND deletes the garment together. Service-role
        // caller bypasses the in-RPC ownership check for admin tooling.
        // Failures are logged but don't block the overall wipe; the
        // post-launch orphan-reservation cron is the safety net for any
        // garment whose atomic delete returned an error.
        for (const gid of garmentIds) {
          const { error: rpcErr } = await supabase.rpc(
            "delete_garment_with_release_atomic",
            { p_garment_id: gid, p_user_id: user.id },
          );
          if (rpcErr) {
            console.warn("[seed_wardrobe] delete_garment_with_release_atomic non-ok", {
              garment_id: gid,
              error: rpcErr.message,
            });
          }
        }

        // outfit_items / wear_logs cleanup (the atomic RPC only deletes the
        // garment row). outfit_items has no FK cascade on garment_id, and
        // wear_logs filters by user_id independently.
        await supabase.from("outfit_items").delete().in("garment_id", garmentIds);
        await supabase.from("wear_logs").delete().eq("user_id", user.id);

        // Defensive sweep: if any garment survived the atomic RPC (e.g.
        // auth mismatch edge case or transient failure we logged above),
        // wipe via the user-scoped filter so `delete_all` semantics hold.
        // This is a no-op for successfully-atomic-deleted rows.
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
          functionName: "seed_wardrobe",
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
    if (e instanceof RateLimitError) {
      return rateLimitResponse(e, CORS_HEADERS);
    }
    console.error("seed_wardrobe error:", e);
    return bursAIErrorResponse(e, CORS_HEADERS);
  }
});
