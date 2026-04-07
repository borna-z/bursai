import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS_HEADERS } from "../_shared/cors.ts";
import { invokeUnifiedStylistEngine } from "../_shared/unified_stylist_engine.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const unified = await invokeUnifiedStylistEngine({
      authToken: token,
      request: {
        mode: "generate",
        generator_mode: body.mode === "stylist" ? "stylist" : "standard",
        occasion: body.occasion,
        style: body.style,
        weather: body.weather,
        locale: body.locale,
        event_title: body.event_title,
        day_context: body.day_context,
        prefer_garment_ids: body.prefer_garment_ids,
        exclude_garment_ids: body.exclude_garment_ids,
        explanation_mode: "short",
      },
    });

    const selected = unified.outfits[0];
    if (!selected) {
      return new Response(JSON.stringify({ error: "No complete outfit available" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      items: selected.garment_ids.map((garment_id) => ({ slot: "unknown", garment_id })),
      explanation: selected.rationale,
      confidence_score: selected.confidence,
      confidence_level: selected.confidence_level,
      family_label: selected.family_label,
      limitation_note: selected.limitations[0] || null,
      wardrobe_insights: selected.wardrobe_gaps,
      unified_engine: true,
    }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate_outfit unified shim error:", e);
    const message = e instanceof Error ? e.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
