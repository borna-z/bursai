import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { allowedOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    // 1. Delete expired rows
    const { count: expiredCount } = await supabase
      .from("ai_response_cache")
      .delete({ count: "exact" })
      .lt("expires_at", now);

    // 2. Delete never-reused rows older than 24h
    const { count: unusedCount } = await supabase
      .from("ai_response_cache")
      .delete({ count: "exact" })
      .eq("hit_count", 0)
      .lt("created_at", twentyFourHoursAgo);

    const result = {
      expired_deleted: expiredCount || 0,
      unused_deleted: unusedCount || 0,
      cleaned_at: now,
    };

    console.log("Cache cleanup:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cleanup_ai_cache error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
