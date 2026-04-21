import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { checkIdempotency, storeIdempotencyResult } from "../_shared/idempotency.ts";
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, overloadResponse } from "../_shared/scale-guard.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (checkOverload("delete_user_account")) {
    return overloadResponse(CORS_HEADERS);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Auth FIRST — Codex P1 round 2 on PR #658: idempotency keys must be
    // scoped by (functionName, userId), and the userId comes from the
    // verified JWT. Pre-auth idempotency lookups risked replaying another
    // user's cached payload when keys collided.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Create anon client with user's token to verify identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Idempotency BEFORE rate limit — Codex P1 round 3 on PR #658:
    // delete_user_account's per-minute limit is 1. A legitimate client
    // retry (e.g., network blip during the slow cascade delete) with the
    // same x-idempotency-key would otherwise hit 429 before reaching the
    // dedupe cache, breaking the retry contract. Ordering:
    //   auth -> idempotency (cached/409 short-circuit) -> rate limit -> work
    // Retries of a completed or in-flight request get the cached 200 or
    // a 409 Retry-After, never a 429.
    const idempotencyScope = {
      functionName: "delete_user_account",
      userId,
    };
    const cachedResponse = await checkIdempotency(req, adminClient, idempotencyScope);
    if (cachedResponse) {
      console.log("[DELETE-USER] Returning cached or pending idempotent response", {
        status: cachedResponse.status,
      });
      return cachedResponse;
    }

    await enforceRateLimit(adminClient, userId, "delete_user_account");

    console.log(`Starting account deletion for user: ${userId}`);

    // 1. Get all garment image paths for this user to delete from storage
    const { data: garments, error: garmentsError } = await adminClient
      .from("garments")
      .select("id, image_path")
      .eq("user_id", userId);

    if (garmentsError) {
      console.error("Error fetching garments:", garmentsError);
      throw garmentsError;
    }

    // 2. Delete images from storage bucket
    if (garments && garments.length > 0) {
      const imagePaths = garments.map((g) => g.image_path).filter(Boolean);
      if (imagePaths.length > 0) {
        const { error: storageError } = await adminClient.storage
          .from("garments")
          .remove(imagePaths);

        if (storageError) {
          console.error("Error deleting storage files:", storageError);
          // Continue anyway - storage cleanup is not critical
        } else {
          console.log(`Deleted ${imagePaths.length} files from storage`);
        }
      }
    }

    // 3. Delete database records in correct order (respecting foreign keys)

    // Delete chat_messages
    await adminClient.from("chat_messages").delete().eq("user_id", userId);
    console.log("Deleted chat_messages");

    // Delete calendar data
    await adminClient.from("calendar_events").delete().eq("user_id", userId);
    await adminClient.from("calendar_connections").delete().eq("user_id", userId);
    console.log("Deleted calendar data");

    // Delete planned_outfits
    await adminClient.from("planned_outfits").delete().eq("user_id", userId);
    console.log("Deleted planned_outfits");

    // Delete wear_logs
    const { error: wearLogsError } = await adminClient
      .from("wear_logs")
      .delete()
      .eq("user_id", userId);
    
    if (wearLogsError) {
      console.error("Error deleting wear_logs:", wearLogsError);
      throw wearLogsError;
    }
    console.log("Deleted wear_logs");

    // Delete outfit_items (need to find outfit IDs first)
    const { data: outfits } = await adminClient
      .from("outfits")
      .select("id")
      .eq("user_id", userId);

    if (outfits && outfits.length > 0) {
      const outfitIds = outfits.map((o) => o.id);
      const { error: outfitItemsError } = await adminClient
        .from("outfit_items")
        .delete()
        .in("outfit_id", outfitIds);

      if (outfitItemsError) {
        console.error("Error deleting outfit_items:", outfitItemsError);
        throw outfitItemsError;
      }
      console.log("Deleted outfit_items");
    }

    // Delete outfits
    const { error: outfitsError } = await adminClient
      .from("outfits")
      .delete()
      .eq("user_id", userId);

    if (outfitsError) {
      console.error("Error deleting outfits:", outfitsError);
      throw outfitsError;
    }
    console.log("Deleted outfits");

    // Delete garments
    const { error: garmentsDeleteError } = await adminClient
      .from("garments")
      .delete()
      .eq("user_id", userId);

    if (garmentsDeleteError) {
      console.error("Error deleting garments:", garmentsDeleteError);
      throw garmentsDeleteError;
    }
    console.log("Deleted garments");

    // Delete subscriptions data
    await adminClient.from("subscriptions").delete().eq("user_id", userId);
    await adminClient.from("user_subscriptions").delete().eq("user_id", userId);
    await adminClient.from("checkout_attempts").delete().eq("user_id", userId);
    await adminClient.from("user_roles").delete().eq("user_id", userId);
    console.log("Deleted subscriptions & roles");

    // P8: Orphan-row cleanup across 11 additional tables that were missed by
    // the earlier cascade. Required for GDPR right-to-erasure — these rows
    // previously persisted after account deletion.
    //
    // Silent-delete pattern (no error throw): leaf-only cleanup — if a single
    // table delete fails we still want the remaining cascade + profile + auth
    // user delete to proceed. Storage/garments/profile/auth deletes above throw
    // because they're load-bearing; these rows are soft-orphan cleanup.

    // Render pipeline (transactions FK both credits and jobs — delete leaves first)
    await adminClient.from("render_credit_transactions").delete().eq("user_id", userId);
    await adminClient.from("render_jobs").delete().eq("user_id", userId);
    await adminClient.from("render_credits").delete().eq("user_id", userId);

    // AI / analytics (chat_messages already handled above — not repeated)
    await adminClient.from("feedback_signals").delete().eq("user_id", userId);
    await adminClient.from("garment_pair_memory").delete().eq("user_id", userId);
    await adminClient.from("analytics_events").delete().eq("user_id", userId);
    await adminClient.from("ai_rate_limits").delete().eq("user_id", userId);

    // Feedback / social
    await adminClient.from("outfit_feedback").delete().eq("user_id", userId);

    // Notifications
    await adminClient.from("push_subscriptions").delete().eq("user_id", userId);

    // Travel
    await adminClient.from("travel_capsules").delete().eq("user_id", userId);

    // ai_response_cache — explicit cleanup (Wave 2-C / P13+P14 schema change).
    // The table now has a `user_id` column (migration
    // 20260421180000_ai_response_cache_user_id.sql) with an ON DELETE CASCADE
    // FK to auth.users. The subsequent `auth.admin.deleteUser` call at the
    // bottom of this function will cascade-delete rows automatically, but we
    // also do an explicit delete here for three reasons:
    //   (1) consistency with the rest of this cascade, which uses explicit
    //       per-table deletes for auditability;
    //   (2) safety — if auth.admin.deleteUser fails partway through, the
    //       user's cache rows are already gone;
    //   (3) we clean PRE-MIGRATION rows too. Rows stored before the schema
    //       change have user_id = NULL and won't match this delete either.
    //       Those decay via their normal 30min-12h TTLs (GDPR "without undue
    //       delay" is satisfied inside a day). Net effect: post-migration
    //       rows clean immediately; pre-migration rows clean within a day.
    // Codex P1 on PR #652 correctly flagged the broken `.like("cache_key", ...)`
    // approach that motivated the schema change.
    await adminClient.from("ai_response_cache").delete().eq("user_id", userId);

    console.log("Deleted orphan rows across render/AI/notifications/travel/cache tables");

    // Delete profile
    const { error: profileError } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      console.error("Error deleting profile:", profileError);
      throw profileError;
    }
    console.log("Deleted profile");

    // 4. Delete auth user using admin API
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      console.error("Error deleting auth user:", deleteUserError);
      throw deleteUserError;
    }
    console.log("Deleted auth user");

    const response = new Response(
      JSON.stringify({ success: true, message: "Account deleted successfully" }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
    await storeIdempotencyResult(req, response, adminClient, idempotencyScope);
    return response;
  } catch (error) {
    if (error instanceof RateLimitError) {
      return rateLimitResponse(error, CORS_HEADERS);
    }
    console.error("Account deletion error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to delete account",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
