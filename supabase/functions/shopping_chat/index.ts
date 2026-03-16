import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { streamBursAI, bursAIErrorResponse } from "../_shared/burs-ai.ts";
import { VOICE_SHOPPING } from "../_shared/burs-voice.ts";

import { allowedOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------- i18n ----------

const LANG_CONFIG: Record<string, { name: string; weatherLabel: string }> = {
  sv: { name: "svenska", weatherLabel: "Väder just nu" },
  en: { name: "English", weatherLabel: "Current weather" },
  no: { name: "norsk", weatherLabel: "Vær nå" },
  da: { name: "dansk", weatherLabel: "Vejr nu" },
  fi: { name: "suomi", weatherLabel: "Sää nyt" },
  de: { name: "Deutsch", weatherLabel: "Wetter aktuell" },
  fr: { name: "français", weatherLabel: "Météo actuelle" },
  es: { name: "español", weatherLabel: "Clima actual" },
  it: { name: "italiano", weatherLabel: "Meteo attuale" },
  pt: { name: "português", weatherLabel: "Clima atual" },
  nl: { name: "Nederlands", weatherLabel: "Weer nu" },
  pl: { name: "polski", weatherLabel: "Pogoda teraz" },
  ar: { name: "العربية", weatherLabel: "الطقس الحالي" },
  fa: { name: "فارسی", weatherLabel: "آب‌و‌هوای فعلی" },
};

function getLang(locale: string) {
  return LANG_CONFIG[locale] || LANG_CONFIG["en"];
}

// ---------- helpers ----------

async function geocodeCity(city: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
      { headers: { "User-Agent": "BURS-App/1.0" } }
    );
    const data = await res.json();
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch { /* ignore */ }
  return null;
}

async function fetchWeather(lat: number, lon: number, lang: typeof LANG_CONFIG[string]): Promise<string> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,wind_speed_10m,weather_code`
    );
    const d = await res.json();
    const c = d?.current;
    if (!c) return "";
    return `${lang.weatherLabel}: ${c.temperature_2m}°C, wind ${c.wind_speed_10m} km/h, precipitation ${c.precipitation} mm, code ${c.weather_code}.`;
  } catch { return ""; }
}

async function getWardrobeContext(supabase: ReturnType<typeof createClient>, userId: string): Promise<{ summary: string; garments: Array<{ id: string; title: string; category: string; color_primary: string; formality: number | null; season_tags: string[] | null }> }> {
  const { data: garments } = await supabase
    .from("garments")
    .select("id, title, category, color_primary, color_secondary, formality, season_tags, material, fit, subcategory")
    .eq("user_id", userId)
    .eq("in_laundry", false)
    .limit(60);
  if (!garments?.length) return { summary: "The user has no garments in their wardrobe yet.", garments: [] };

  const catSummary = Object.entries(
    garments.reduce((acc: Record<string, number>, g: { category: string }) => {
      acc[g.category] = (acc[g.category] || 0) + 1;
      return acc;
    }, {})
  ).map(([cat, count]) => `${count} ${cat}`).join(", ");

  const details = garments.slice(0, 25).map((g: {
    id: string; title: string; category: string; color_primary: string; color_secondary: string | null;
    formality: number | null; season_tags: string[] | null; material: string | null; fit: string | null; subcategory: string | null
  }) =>
    `• ${g.title} [ID:${g.id}] (${g.category}${g.subcategory ? `/${g.subcategory}` : ""}, ${g.color_primary}${g.color_secondary ? `+${g.color_secondary}` : ""}${g.material ? `, ${g.material}` : ""}${g.fit ? `, ${g.fit}` : ""}${g.formality ? `, formality ${g.formality}` : ""}${g.season_tags?.length ? `, ${g.season_tags.join("/")}` : ""})`
  ).join("\n");

  return {
    summary: `Wardrobe (${garments.length} garments: ${catSummary}):\n${details}`,
    garments: garments as Array<{ id: string; title: string; category: string; color_primary: string; formality: number | null; season_tags: string[] | null }>,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = { id: claimsData.claims.sub as string };

    const { messages, locale: rawLocale } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const locale = (typeof rawLocale === "string" && LANG_CONFIG[rawLocale]) ? rawLocale : "sv";
    const lang = getLang(locale);

    // Fetch context in parallel
    const [profileRes, wardrobeResult] = await Promise.all([
      supabase.from("profiles").select("display_name, preferences, home_city, height_cm, weight_kg").eq("id", user.id).single(),
      getWardrobeContext(supabase, user.id),
    ]);

    const profile = profileRes.data;

    // Weather
    let weatherCtx = "";
    if (profile?.home_city) {
      const coords = await geocodeCity(profile.home_city);
      if (coords) weatherCtx = await fetchWeather(coords.lat, coords.lon, lang);
    }

    // Style prefs
    const preferences = profile?.preferences as Record<string, unknown> || {};
    const sp = preferences.styleProfile as Record<string, any> | undefined;
    let styleLines = "";
    if (sp) {
      const parts: string[] = [];
      if (sp.gender) parts.push(`Gender: ${sp.gender}`);
      if (sp.ageRange) parts.push(`Age: ${sp.ageRange}`);
      if (sp.styleWords?.length) parts.push(`Style words: ${sp.styleWords.join(", ")}`);
      if (sp.favoriteColors?.length) parts.push(`Favorite colors: ${sp.favoriteColors.join(", ")}`);
      if (sp.dislikedColors?.length) parts.push(`Avoids: ${sp.dislikedColors.join(", ")}`);
      if (sp.paletteVibe) parts.push(`Palette vibe: ${sp.paletteVibe}`);
      if (sp.patternFeeling) parts.push(`Pattern: ${sp.patternFeeling}`);
      if (sp.fit) parts.push(`Fit: ${sp.fit}`);
      if (sp.shoppingMindset) parts.push(`Shopping: ${sp.shoppingMindset}`);
      if (sp.sustainability) parts.push(`Sustainability: ${sp.sustainability}`);
      if (sp.capsuleWardrobe) parts.push(`Capsule wardrobe: ${sp.capsuleWardrobe}`);
      if (sp.wardrobeFrustrations?.length) parts.push(`Frustrations: ${sp.wardrobeFrustrations.join(", ")}`);
      if (sp.primaryGoal) parts.push(`Primary goal: ${sp.primaryGoal}`);
      if (sp.fabricFeel) parts.push(`Favorite fabric: ${sp.fabricFeel}`);
      styleLines = parts.join(". ");
    } else {
      styleLines = [
        (preferences.favoriteColors as string[])?.length ? `Favorite colors: ${(preferences.favoriteColors as string[]).join(", ")}` : "",
        (preferences.dislikedColors as string[])?.length ? `Dislikes: ${(preferences.dislikedColors as string[]).join(", ")}` : "",
        preferences.fitPreference ? `Fit: ${preferences.fitPreference}` : "",
        preferences.styleVibe ? `Style: ${preferences.styleVibe}` : "",
      ].filter(Boolean).join(". ");
    }

    const systemPrompt = `${VOICE_SHOPPING}

LANGUAGE: Respond ONLY in ${lang.name}. Every word.

${profile?.display_name ? `Client: ${profile.display_name}` : ""}${profile?.home_city ? ` (${profile.home_city})` : ""}
${styleLines ? `Style profile: ${styleLines}` : ""}

${wardrobeResult.summary}
${weatherCtx}

Your process:
1. Identify the piece: type, color, material, visual weight, silhouette.
2. Map against the wardrobe — show 2-4 matching garments using [[garment:ID]] tags.
3. Rate the purchase (⭐ 1-10) based on wardrobe fit: gap fill vs overlap, color harmony, season relevance.
4. If duplicates exist, name them directly.
5. End with a clear verdict.

Rules:
- Max 6-8 sentences. One question at a time.
- ALWAYS use [[garment:ID]] tags when referencing wardrobe items.
- Each garment has a unique ID marked with [ID:xxx].`;

    // Prepare messages
    const preparedMessages = messages.map((m: { role: string; content: string | unknown[] }) => {
      if (typeof m.content === "string") {
        try {
          const parsed = JSON.parse(m.content);
          if (Array.isArray(parsed)) return { role: m.role, content: parsed };
        } catch { /* keep as string */ }
      }
      return m;
    });

    const response = await streamBursAI({
      messages: [
        { role: "system", content: systemPrompt },
        ...preparedMessages,
      ],
      complexity: "standard",
      max_tokens: 1000,
    });

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("shopping_chat error:", e);
    return bursAIErrorResponse(e, corsHeaders);
  }
});
