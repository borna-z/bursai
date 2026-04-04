import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { logger } from "../_shared/logger.ts";
import {
  buildInsightsDashboard,
  type GarmentInsightRow,
  type OutfitInsightRow,
  type PlannedOutfitInsightRow,
  type WearLogInsightRow,
} from "../_shared/insights-dashboard.ts";

const log = logger("insights_dashboard");

function isoDateDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=300",
    },
  });
}

function ensureNoQueryError(error: unknown, label: string) {
  if (!error) return;
  throw new Error(`${label} query failed: ${error instanceof Error ? error.message : String(error)}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Missing Supabase environment configuration");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing authorization" }, 401);
    }

    const token = authHeader.slice("Bearer ".length);
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userId = userData.user.id;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const date30 = isoDateDaysAgo(30);
    const date90 = isoDateDaysAgo(90);
    const date180 = isoDateDaysAgo(180);

    const [
      garmentsRes,
      wear30Res,
      wear90Res,
      wear180Res,
      wear500Res,
      wearOutfitRes,
      outfitsRes,
      planned90Res,
    ] = await Promise.all([
      supabase
        .from("garments")
        .select("id, title, image_path, category, subcategory, color_primary, color_secondary, material, fit, formality, season_tags, wear_count, last_worn_at, created_at, purchase_price, purchase_currency")
        .eq("user_id", userId),
      supabase
        .from("wear_logs")
        .select("garment_id, outfit_id, worn_at, occasion, event_title")
        .eq("user_id", userId)
        .gte("worn_at", date30),
      supabase
        .from("wear_logs")
        .select("garment_id, outfit_id, worn_at, occasion, event_title")
        .eq("user_id", userId)
        .gte("worn_at", date90),
      supabase
        .from("wear_logs")
        .select("garment_id, outfit_id, worn_at, occasion, event_title")
        .eq("user_id", userId)
        .gte("worn_at", date180),
      supabase
        .from("wear_logs")
        .select("garment_id, outfit_id, worn_at, occasion, event_title")
        .eq("user_id", userId)
        .order("worn_at", { ascending: false })
        .limit(500),
      supabase
        .from("wear_logs")
        .select("outfit_id, worn_at")
        .eq("user_id", userId)
        .not("outfit_id", "is", null),
      supabase
        .from("outfits")
        .select("id, occasion, worn_at, generated_at, saved")
        .eq("user_id", userId),
      supabase
        .from("planned_outfits")
        .select("date, status, outfit_id")
        .eq("user_id", userId)
        .gte("date", date90),
    ]);

    ensureNoQueryError(garmentsRes.error, "garments");
    ensureNoQueryError(wear30Res.error, "wear_logs_last_30_days");
    ensureNoQueryError(wear90Res.error, "wear_logs_last_90_days");
    ensureNoQueryError(wear180Res.error, "wear_logs_last_180_days");
    ensureNoQueryError(wear500Res.error, "wear_logs_recent_500");
    ensureNoQueryError(wearOutfitRes.error, "wear_logs_for_outfit_history");
    ensureNoQueryError(outfitsRes.error, "outfits");
    ensureNoQueryError(planned90Res.error, "planned_outfits_last_90_days");

    const payload = buildInsightsDashboard({
      generated_at: new Date().toISOString(),
      garments: (garmentsRes.data || []) as GarmentInsightRow[],
      wear_logs_last_30_days: (wear30Res.data || []) as WearLogInsightRow[],
      wear_logs_last_90_days: (wear90Res.data || []) as WearLogInsightRow[],
      wear_logs_last_180_days: (wear180Res.data || []) as WearLogInsightRow[],
      wear_logs_recent_500: (wear500Res.data || []) as WearLogInsightRow[],
      wear_logs_for_outfit_history: (wearOutfitRes.data || []) as Array<Pick<WearLogInsightRow, "outfit_id" | "worn_at">>,
      outfits: (outfitsRes.data || []) as OutfitInsightRow[],
      planned_outfits_last_90_days: (planned90Res.data || []) as PlannedOutfitInsightRow[],
    });
    const overview = payload.overview as {
      total_garments?: number;
      total_saved_outfits?: number;
    };

    log.info("Generated insights dashboard", {
      userId,
      garments: overview.total_garments,
      savedOutfits: overview.total_saved_outfits,
    });

    return jsonResponse(payload);
  } catch (error) {
    log.exception("Failed to generate insights dashboard", error);
    return jsonResponse({ error: "Failed to generate insights dashboard" }, 500);
  }
});
