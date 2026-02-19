import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, saveProfile } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user profile + garment summary for context
    const [profileRes, garmentsRes] = await Promise.all([
      supabase.from("profiles").select("display_name, preferences, home_city, height_cm, weight_kg").eq("id", user.id).single(),
      supabase.from("garments").select("category, color_primary, formality, season_tags").eq("user_id", user.id).limit(50),
    ]);

    const profile = profileRes.data;
    const garments = garmentsRes.data || [];

    // Build garment summary
    const garmentSummary = garments.length > 0
      ? `Användaren har ${garments.length} plagg i garderoben: ${
          Object.entries(
            garments.reduce((acc: Record<string, number>, g) => {
              acc[g.category] = (acc[g.category] || 0) + 1;
              return acc;
            }, {})
          ).map(([cat, count]) => `${count} ${cat}`).join(", ")
        }.`
      : "Användaren har ännu inga plagg i garderoben.";

    const preferences = profile?.preferences as Record<string, unknown> || {};
    const learnedContext = Object.keys(preferences)
      .filter(k => k.startsWith("ai_learned_"))
      .map(k => `${k.replace("ai_learned_", "")}: ${preferences[k]}`)
      .join(", ");

    // Body measurements context
    const heightCm = profile?.height_cm;
    const weightKg = profile?.weight_kg;

    // Build body proportions guidance when we have at least height
    let bodyContext = "";
    if (heightCm) {
      const bmi = weightKg ? (weightKg / ((heightCm / 100) ** 2)).toFixed(1) : null;

      let silhouetteHints = "";
      if (heightCm < 165) {
        silhouetteHints = "Korta snitt, högmjörtade byxor och monokromt skapar längd. Undvik oversize och horisontella mönster.";
      } else if (heightCm >= 165 && heightCm <= 180) {
        silhouetteHints = "Mellanlång proportioner – de flesta snitt fungerar. Balanserade proportioner är nyckeln.";
      } else {
        silhouetteHints = "Lång silhuett – kan bära lagerläggning och horisontella detaljer bra. Längre jackor och wide-leg byxor fungerar utmärkt.";
      }

      bodyContext = `\nAnvändarens kroppsmått:
- Längd: ${heightCm} cm
${weightKg ? `- Vikt: ${weightKg} kg` : ""}
${bmi ? `- BMI: ${bmi}` : ""}
Passformtips baserat på längd: ${silhouetteHints}`;
    }

    // Style preferences from profile
    const favColors = preferences?.favoriteColors as string[] | undefined;
    const dislikedColors = preferences?.dislikedColors as string[] | undefined;
    const fitPref = preferences?.fitPreference as string | undefined;
    const styleVibe = preferences?.styleVibe as string | undefined;

    const stylePrefsContext = [
      favColors?.length ? `Favoritfärger: ${favColors.join(", ")}` : "",
      dislikedColors?.length ? `Ogillar färger: ${dislikedColors.join(", ")}` : "",
      fitPref ? `Passformpreferens: ${fitPref}` : "",
      styleVibe ? `Stilkänsla: ${styleVibe}` : "",
    ].filter(Boolean).join("\n");

    const systemPrompt = `Du är DRAPE Stylisten – en personlig AI-stylingassistent i appen DRAPE. Du kommunicerar på svenska med en varm, professionell och personlig ton.

Ditt uppdrag:
- Ge personliga stil- och outfitråd baserade på användarens garderob, mått och preferenser
- Ställ frågor om ålder, yrke, livsstil och tillfällen (jobb, fest, träning, vardag) om du inte vet
- Anpassa råd kring passform och proportioner utifrån användarens längd och vikt när det finns
- Var konkret, kortfattad och inspirerande

${profile?.display_name ? `Användarens namn: ${profile.display_name}` : ""}
${profile?.home_city ? `Stad: ${profile.home_city}` : ""}
${bodyContext}
${stylePrefsContext ? `\nStilpreferenser:\n${stylePrefsContext}` : ""}
${garmentSummary}
${learnedContext ? `Tidigare känd info: ${learnedContext}` : ""}

Viktiga regler:
- Skriv alltid på svenska
- Håll svaren kortfattade (max 3-4 meningar)
- Ställ BARA ÉN fråga i taget om du vill veta mer
- Använd kroppsmåtten aktivt när du ger råd om snitt, passform och proportioner
- Ge konkreta förslag baserat på garderoben när möjligt
- Undvik tekniskt språk

Om användaren inte har angett mått, kan du bjuda in dem att göra det i Inställningar för mer personliga råd.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "För många förfrågningar, försök igen om en stund." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI-tjänsten kräver mer kredit." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI-tjänsten svarade inte." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream response back to client
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("style_chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Okänt fel" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
