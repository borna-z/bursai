import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { streamBursAI, bursAIErrorResponse } from "../_shared/burs-ai.ts";

import { allowedOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------- i18n ----------

const LANG_CONFIG: Record<string, { name: string; weatherLabel: string; todayLabel: string; tomorrowLabel: string; seasonNames: [string, string, string, string] }> = {
  sv: { name: "svenska", weatherLabel: "Väder just nu", todayLabel: "Idag", tomorrowLabel: "Imorgon", seasonNames: ["vår", "sommar", "höst", "vinter"] },
  en: { name: "English", weatherLabel: "Current weather", todayLabel: "Today", tomorrowLabel: "Tomorrow", seasonNames: ["spring", "summer", "autumn", "winter"] },
  no: { name: "norsk", weatherLabel: "Vær nå", todayLabel: "I dag", tomorrowLabel: "I morgen", seasonNames: ["vår", "sommer", "høst", "vinter"] },
  da: { name: "dansk", weatherLabel: "Vejr nu", todayLabel: "I dag", tomorrowLabel: "I morgen", seasonNames: ["forår", "sommer", "efterår", "vinter"] },
  fi: { name: "suomi", weatherLabel: "Sää nyt", todayLabel: "Tänään", tomorrowLabel: "Huomenna", seasonNames: ["kevät", "kesä", "syksy", "talvi"] },
  de: { name: "Deutsch", weatherLabel: "Wetter aktuell", todayLabel: "Heute", tomorrowLabel: "Morgen", seasonNames: ["Frühling", "Sommer", "Herbst", "Winter"] },
  fr: { name: "français", weatherLabel: "Météo actuelle", todayLabel: "Aujourd'hui", tomorrowLabel: "Demain", seasonNames: ["printemps", "été", "automne", "hiver"] },
  es: { name: "español", weatherLabel: "Clima actual", todayLabel: "Hoy", tomorrowLabel: "Mañana", seasonNames: ["primavera", "verano", "otoño", "invierno"] },
  it: { name: "italiano", weatherLabel: "Meteo attuale", todayLabel: "Oggi", tomorrowLabel: "Domani", seasonNames: ["primavera", "estate", "autunno", "inverno"] },
  pt: { name: "português", weatherLabel: "Clima atual", todayLabel: "Hoje", tomorrowLabel: "Amanhã", seasonNames: ["primavera", "verão", "outono", "inverno"] },
  nl: { name: "Nederlands", weatherLabel: "Weer nu", todayLabel: "Vandaag", tomorrowLabel: "Morgen", seasonNames: ["lente", "zomer", "herfst", "winter"] },
  pl: { name: "polski", weatherLabel: "Pogoda teraz", todayLabel: "Dziś", tomorrowLabel: "Jutro", seasonNames: ["wiosna", "lato", "jesień", "zima"] },
  ar: { name: "العربية", weatherLabel: "الطقس الحالي", todayLabel: "اليوم", tomorrowLabel: "غدًا", seasonNames: ["ربيع", "صيف", "خريف", "شتاء"] },
  fa: { name: "فارسی", weatherLabel: "آب‌و‌هوای فعلی", todayLabel: "امروز", tomorrowLabel: "فردا", seasonNames: ["بهار", "تابستان", "پاییز", "زمستان"] },
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

async function getCalendarContext(supabase: ReturnType<typeof createClient>, userId: string, lang: typeof LANG_CONFIG[string]): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("calendar_events")
    .select("title, date, start_time")
    .eq("user_id", userId)
    .gte("date", today)
    .lte("date", tomorrow)
    .order("date")
    .limit(10);
  if (!data?.length) return "";
  const lines = data.map((e: { title: string; date: string; start_time: string | null }) =>
    `- ${e.date === today ? lang.todayLabel : lang.tomorrowLabel}: ${e.title}${e.start_time ? ` ${e.start_time.slice(0, 5)}` : ""}`
  );
  return `\nCalendar events:\n${lines.join("\n")}`;
}

async function getWardrobeContext(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data: garments } = await supabase
    .from("garments")
    .select("id, title, category, color_primary, formality, season_tags, image_path")
    .eq("user_id", userId)
    .limit(50);
  if (!garments?.length) return "The user has no garments in their wardrobe yet.";

  const summary = Object.entries(
    garments.reduce((acc: Record<string, number>, g: { category: string }) => {
      acc[g.category] = (acc[g.category] || 0) + 1;
      return acc;
    }, {})
  ).map(([cat, count]) => `${count} ${cat}`).join(", ");

  const details = garments.slice(0, 15).map((g: {
    id: string; title: string; category: string; color_primary: string; formality: number | null; season_tags: string[] | null
  }) =>
    `• ${g.title} [ID:${g.id}] (${g.category}, ${g.color_primary}${g.formality ? `, formality ${g.formality}` : ""}${g.season_tags?.length ? `, ${g.season_tags.join("/")}` : ""})`
  ).join("\n");

  return `Wardrobe (${garments.length} garments: ${summary}):\n${details}`;
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

    // Fetch all context in parallel
    const [profileRes, wardrobeCtx, calendarCtx] = await Promise.all([
      supabase.from("profiles").select("display_name, preferences, home_city, height_cm, weight_kg").eq("id", user.id).single(),
      getWardrobeContext(supabase, user.id),
      getCalendarContext(supabase, user.id, lang),
    ]);

    const profile = profileRes.data;

    // Weather (depends on profile.home_city)
    let weatherCtx = "";
    if (profile?.home_city) {
      const coords = await geocodeCity(profile.home_city);
      if (coords) weatherCtx = await fetchWeather(coords.lat, coords.lon, lang);
    }

    // Body context
    const heightCm = profile?.height_cm;
    const weightKg = profile?.weight_kg;
    let bodyContext = "";
    if (heightCm) {
      bodyContext = `\nBody: ${heightCm} cm${weightKg ? `, ${weightKg} kg` : ""}`;
    }

    // Style prefs
    const preferences = profile?.preferences as Record<string, unknown> || {};
    const sp = preferences.styleProfile as Record<string, any> | undefined;
    let styleLines = "";
    if (sp) {
      const parts: string[] = [];
      if (sp.gender) parts.push(`Gender: ${sp.gender}`);
      if (sp.ageRange) parts.push(`Age: ${sp.ageRange}`);
      if (sp.climate) parts.push(`Climate: ${sp.climate}`);
      if (sp.weekdayLife) parts.push(`Weekday: ${sp.weekdayLife}`);
      if (sp.workFormality) parts.push(`Work formality: ${sp.workFormality}`);
      if (sp.weekendLife) parts.push(`Weekend: ${sp.weekendLife}`);
      if (sp.styleWords?.length) parts.push(`Style words: ${sp.styleWords.join(", ")}`);
      if (sp.comfortVsStyle !== undefined) parts.push(`Comfort vs style: ${sp.comfortVsStyle}/100`);
      if (sp.adventurousness) parts.push(`Adventurousness: ${sp.adventurousness}`);
      if (sp.trendFollowing) parts.push(`Trend following: ${sp.trendFollowing}`);
      if (sp.genderNeutral) parts.push("Gender-neutral styling");
      if (sp.fit) parts.push(`Fit: ${sp.fit}`);
      if (sp.layering) parts.push(`Layering: ${sp.layering}`);
      if (sp.topFit) parts.push(`Top fit: ${sp.topFit}`);
      if (sp.bottomLength) parts.push(`Bottom length: ${sp.bottomLength}`);
      if (sp.favoriteColors?.length) parts.push(`Favorite colors: ${sp.favoriteColors.join(", ")}`);
      if (sp.dislikedColors?.length) parts.push(`Avoids: ${sp.dislikedColors.join(", ")}`);
      if (sp.paletteVibe) parts.push(`Palette vibe: ${sp.paletteVibe}`);
      if (sp.patternFeeling) parts.push(`Pattern: ${sp.patternFeeling}`);
      if (sp.shoppingMindset) parts.push(`Shopping: ${sp.shoppingMindset}`);
      if (sp.sustainability) parts.push(`Sustainability: ${sp.sustainability}`);
      if (sp.capsuleWardrobe) parts.push(`Capsule wardrobe: ${sp.capsuleWardrobe}`);
      if (sp.wardrobeFrustrations?.length) parts.push(`Frustrations: ${sp.wardrobeFrustrations.join(", ")}`);
      if (sp.styleIcons) parts.push(`Inspired by: ${sp.styleIcons}`);
      if (sp.hardestOccasions?.length) parts.push(`Hardest to dress for: ${sp.hardestOccasions.join(", ")}`);
      if (sp.fabricFeel) parts.push(`Favorite fabric: ${sp.fabricFeel}`);
      if (sp.signaturePieces) parts.push(`Signature pieces: ${sp.signaturePieces}`);
      if (sp.primaryGoal) parts.push(`Primary goal: ${sp.primaryGoal}`);
      if (sp.morningTime) parts.push(`Morning routine: ${sp.morningTime}`);
      if (sp.freeNote) parts.push(`Personal note: ${sp.freeNote}`);
      styleLines = parts.join(". ");
    } else {
      styleLines = [
        (preferences.favoriteColors as string[])?.length ? `Favorite colors: ${(preferences.favoriteColors as string[]).join(", ")}` : "",
        (preferences.dislikedColors as string[])?.length ? `Dislikes: ${(preferences.dislikedColors as string[]).join(", ")}` : "",
        preferences.fitPreference ? `Fit: ${preferences.fitPreference}` : "",
        preferences.styleVibe ? `Style: ${preferences.styleVibe}` : "",
      ].filter(Boolean).join(". ");
    }

    const currentMonth = new Date().getMonth();
    const seasonIdx = currentMonth >= 2 && currentMonth <= 4 ? 0 : currentMonth >= 5 && currentMonth <= 7 ? 1 : currentMonth >= 8 && currentMonth <= 10 ? 2 : 3;
    const seasonHint = lang.seasonNames[seasonIdx];

    const systemPrompt = `You are BURS Stylist – a personal AI styling assistant with deep expertise in fashion, trends, and color theory. Warm, professional, and specific.

CRITICAL LANGUAGE RULE: You MUST write ALL responses in ${lang.name}. Every single word of your response must be in ${lang.name}. Never respond in any other language.

You have deep understanding of:
- Color theory (complementary colors, analogous matching, tonal)
- Current ${seasonHint} trends ${new Date().getFullYear()}
- Silhouettes, proportions, and how garments interact
- How to build a cohesive wardrobe

${profile?.display_name ? `User: ${profile.display_name}` : ""}${profile?.home_city ? ` (${profile.home_city})` : ""}${bodyContext}
${styleLines ? `\nSTYLE PROFILE:\n${styleLines}` : ""}

${wardrobeCtx}
${calendarCtx}
${weatherCtx}

Your mission:
- Give personal style and outfit advice based on wardrobe, style profile, body, weather, and calendar
- ALWAYS reference the user's style profile when giving advice — adapt to their taste
- When user uploads an image: analyze the outfit (colors, fit, style), compare with wardrobe, suggest specific garment swaps BY NAME
- Adapt fit advice based on body measurements and preferences
- Check today's calendar events and match outfit to occasion
- Warn if outfit doesn't match the weather
- Be specific: e.g. "Swap the white t-shirt for your navy Oxford shirt for tomorrow's meeting"
- Consider seasonal trends and color harmony

Rules:
- ALWAYS respond in ${lang.name}
- Max 4-5 sentences per response
- Ask max ONE question at a time
- Give specific suggestions with garment names from the wardrobe
- Avoid technical jargon

IMPORTANT – Garment display:
- Each garment has a unique ID marked with [ID:xxx].
- When recommending a specific garment, include the tag [[garment:ID]] right after the garment name.
- ALWAYS use these tags when mentioning garments from the wardrobe.

IMPORTANT – Outfit cards:
- When suggesting a COMPLETE outfit (2+ garments together), you MUST use the outfit tag:
  [[outfit:id1,id2,id3|Short explanation why this outfit works]]
- The outfit tag displays a visual card with all garments and a "Try outfit" button.
- Use outfit tags for FULL outfit suggestions. Use garment tags only when mentioning individual garments in running text.
- ALWAYS include a short explanation after | in the outfit tag.
- The explanation after | MUST also be in ${lang.name}.`;

    // Prepare messages - parse any JSON-stringified multimodal content
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
    console.error("style_chat error:", e);
    return bursAIErrorResponse(e, corsHeaders);
  }
});
