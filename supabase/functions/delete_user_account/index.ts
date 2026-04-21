import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { checkIdempotency, storeIdempotencyResult } from "../_shared/idempotency.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // Return cached response for duplicate idempotent requests
  const cachedResponse = checkIdempotency(req);
  if (cachedResponse) {
    console.log("[DELETE-USER] Returning cached idempotent response");
    return cachedResponse;
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Create client with user's token to verify identity
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    // Use service role client for admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

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

    // AI response cache — no user_id column; cache_key prefix contains the user
    // UUID for user-scoped namespaces (e.g. "mood_happy_<uuid>_<hash>"). LIKE
    // match on cache_key drops only this user's entries. Global-scoped cache
    // rows (see P13 follow-up) stay — they contain no direct PII but may hold
    // responses derived from user data; P13 will make all caches user-scoped.
    await adminClient
      .from("ai_response_cache")
      .delete()
      .like("cache_key", `%${userId}%`);

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
    await storeIdempotencyResult(req, response);
    return response;
  } catch (error) {
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
