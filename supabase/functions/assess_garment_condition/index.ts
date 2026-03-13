import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse } from "../_shared/burs-ai.ts";

import { allowedOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const { garment_id } = await req.json();
    if (!garment_id) throw new Error("Missing garment_id");

    const { data: garment, error: gErr } = await supabase
      .from("garments")
      .select("*")
      .eq("id", garment_id)
      .eq("user_id", user.id)
      .single();

    if (gErr || !garment) throw new Error("Garment not found");

    const { data: urlData } = await supabase.storage
      .from("garments")
      .createSignedUrl(garment.image_path, 600);

    if (!urlData?.signedUrl) throw new Error("Could not get image URL");

    const prompt = `You are a fashion garment condition assessor. Analyze this clothing item photo for signs of wear and tear.

Item: ${garment.title} (${garment.category}, ${garment.material || "unknown material"})
Wear count: ${garment.wear_count || 0} times

Evaluate: fabric pilling, color fading, stretching, stains, loose threads, structural integrity.
Consider that some materials age differently (leather improves, cotton pills, synthetics stretch).`;

    const { data: result } = await callBursAI({
      complexity: "complex",
      max_tokens: 200,
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Assess the condition of this garment from the photo." },
            { type: "image_url", image_url: { url: urlData.signedUrl } },
          ],
        },
      ],
      tools: [{
        type: "function",
        function: {
          name: "assess_condition",
          description: "Return garment condition assessment",
          parameters: {
            type: "object",
            properties: {
              condition_score: { type: "number", description: "Condition score 1.0-10.0 (10=like new)" },
              notes: { type: "string", description: "Brief condition notes (1-2 sentences)" },
              should_replace: { type: "boolean", description: "Whether the garment should be considered for replacement" },
            },
            required: ["condition_score", "notes", "should_replace"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "assess_condition" } },
      modelType: "vision",
    });

    await supabase
      .from("garments")
      .update({ condition_score: result.condition_score, condition_notes: result.notes })
      .eq("id", garment_id);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("assess_garment_condition error:", e);
    return bursAIErrorResponse(e, corsHeaders);
  }
});
