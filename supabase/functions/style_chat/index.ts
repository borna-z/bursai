import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

async function fetchWeather(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,wind_speed_10m,weather_code`
    );
    const d = await res.json();
    const c = d?.current;
    if (!c) return "";
    return `Väder just nu: ${c.temperature_2m}°C, vind ${c.wind_speed_10m} km/h, nederbörd ${c.precipitation} mm, väderkod ${c.weather_code}.`;
  } catch { return ""; }
}

async function getCalendarContext(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
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
    `- ${e.date === today ? "Idag" : "Imorgon"}: ${e.title}${e.start_time ? ` kl ${e.start_time.slice(0, 5)}` : ""}`
  );
  return `\nKalenderhändelser:\n${lines.join("\n")}`;
}

async function getWardrobeContext(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data: garments } = await supabase
    .from("garments")
    .select("id, title, category, color_primary, formality, season_tags, image_path")
    .eq("user_id", userId)
    .limit(50);
  if (!garments?.length) return "Användaren har inga plagg i garderoben ännu.";

  const summary = Object.entries(
    garments.reduce((acc: Record<string, number>, g: { category: string }) => {
      acc[g.category] = (acc[g.category] || 0) + 1;
      return acc;
    }, {})
  ).map(([cat, count]) => `${count} ${cat}`).join(", ");

  // Pick up to 15 specific garments for the AI to reference by name
  const details = garments.slice(0, 15).map((g: {
    id: string; title: string; category: string; color_primary: string; formality: number | null; season_tags: string[] | null
  }) =>
    `• ${g.title} [ID:${g.id}] (${g.category}, ${g.color_primary}${g.formality ? `, formalitet ${g.formality}` : ""}${g.season_tags?.length ? `, ${g.season_tags.join("/")}` : ""})`
  ).join("\n");

  return `Garderob (${garments.length} plagg: ${summary}):\n${details}`;
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all context in parallel
    const [profileRes, wardrobeCtx, calendarCtx] = await Promise.all([
      supabase.from("profiles").select("display_name, preferences, home_city, height_cm, weight_kg").eq("id", user.id).single(),
      getWardrobeContext(supabase, user.id),
      getCalendarContext(supabase, user.id),
    ]);

    const profile = profileRes.data;

    // Weather (depends on profile.home_city)
    let weatherCtx = "";
    if (profile?.home_city) {
      const coords = await geocodeCity(profile.home_city);
      if (coords) weatherCtx = await fetchWeather(coords.lat, coords.lon);
    }

    // Body context
    const heightCm = profile?.height_cm;
    const weightKg = profile?.weight_kg;
    let bodyContext = "";
    if (heightCm) {
      let silhouetteHints = "";
      if (heightCm < 165) silhouetteHints = "Korta snitt, högmidjade byxor och monokromt skapar längd.";
      else if (heightCm <= 180) silhouetteHints = "Mellanlånga proportioner – de flesta snitt fungerar.";
      else silhouetteHints = "Lång silhuett – kan bära lagerläggning och horisontella detaljer bra.";
      bodyContext = `\nKroppsmått: ${heightCm} cm${weightKg ? `, ${weightKg} kg` : ""}. Tips: ${silhouetteHints}`;
    }

    // Style prefs — use full styleProfile (quiz v3) if available, fallback to legacy
    const preferences = profile?.preferences as Record<string, unknown> || {};
    const sp = preferences.styleProfile as Record<string, any> | undefined;
    let styleLines = "";
    if (sp) {
      const parts: string[] = [];
      // Identity
      if (sp.gender) parts.push(`Kön: ${sp.gender}`);
      if (sp.ageRange) parts.push(`Ålder: ${sp.ageRange}`);
      if (sp.climate) parts.push(`Klimat: ${sp.climate}`);
      // Lifestyle
      if (sp.weekdayLife) parts.push(`Vardag: ${sp.weekdayLife}`);
      if (sp.workFormality) parts.push(`Jobb-formalitet: ${sp.workFormality}`);
      if (sp.weekendLife) parts.push(`Helg: ${sp.weekendLife}`);
      if (sp.specialOccasionFreq) parts.push(`Speciella tillfällen: ${sp.specialOccasionFreq}`);
      // Style DNA
      if (sp.styleWords?.length) parts.push(`Stilord: ${sp.styleWords.join(", ")}`);
      if (sp.comfortVsStyle !== undefined) parts.push(`Komfort vs stil: ${sp.comfortVsStyle}/100`);
      if (sp.adventurousness) parts.push(`Modemodig: ${sp.adventurousness}`);
      if (sp.trendFollowing) parts.push(`Trender: ${sp.trendFollowing}`);
      if (sp.genderNeutral) parts.push("Könsneutral styling");
      // Fit
      if (sp.fit) parts.push(`Passform: ${sp.fit}`);
      if (sp.layering) parts.push(`Lager: ${sp.layering}`);
      if (sp.topFit) parts.push(`Överdelspassform: ${sp.topFit}`);
      if (sp.bottomLength) parts.push(`Byxlängd: ${sp.bottomLength}`);
      // Colors & patterns
      if (sp.favoriteColors?.length) parts.push(`Favoritfärger: ${sp.favoriteColors.join(", ")}`);
      if (sp.dislikedColors?.length) parts.push(`Undviker: ${sp.dislikedColors.join(", ")}`);
      if (sp.paletteVibe) parts.push(`Palettskänsla: ${sp.paletteVibe}`);
      if (sp.patternFeeling) parts.push(`Mönster: ${sp.patternFeeling}`);
      // Philosophy
      if (sp.shoppingMindset) parts.push(`Shopping: ${sp.shoppingMindset}`);
      if (sp.sustainability) parts.push(`Hållbarhet: ${sp.sustainability}`);
      if (sp.capsuleWardrobe) parts.push(`Kapselgarderob: ${sp.capsuleWardrobe}`);
      if (sp.wardrobeFrustrations?.length) parts.push(`Frustrationer: ${sp.wardrobeFrustrations.join(", ")}`);
      // Inspiration
      if (sp.styleIcons) parts.push(`Inspireras av: ${sp.styleIcons}`);
      if (sp.hardestOccasions?.length) parts.push(`Svårast att klä sig för: ${sp.hardestOccasions.join(", ")}`);
      if (sp.fabricFeel) parts.push(`Favoritmaterial: ${sp.fabricFeel}`);
      if (sp.signaturePieces) parts.push(`Signaturplagg: ${sp.signaturePieces}`);
      // Goals
      if (sp.primaryGoal) parts.push(`Huvudmål: ${sp.primaryGoal}`);
      if (sp.morningTime) parts.push(`Morgonrutin: ${sp.morningTime}`);
      if (sp.freeNote) parts.push(`Personlig anteckning: ${sp.freeNote}`);
      styleLines = parts.join(". ");
    } else {
      styleLines = [
        (preferences.favoriteColors as string[])?.length ? `Favoritfärger: ${(preferences.favoriteColors as string[]).join(", ")}` : "",
        (preferences.dislikedColors as string[])?.length ? `Ogillar: ${(preferences.dislikedColors as string[]).join(", ")}` : "",
        preferences.fitPreference ? `Passform: ${preferences.fitPreference}` : "",
        preferences.styleVibe ? `Stil: ${preferences.styleVibe}` : "",
      ].filter(Boolean).join(". ");
    }

    const currentMonth = new Date().getMonth();
    const seasonHint = currentMonth >= 2 && currentMonth <= 4 ? "vår" :
                       currentMonth >= 5 && currentMonth <= 7 ? "sommar" :
                       currentMonth >= 8 && currentMonth <= 10 ? "höst" : "vinter";

    const systemPrompt = `Du är BURS Stylisten – en personlig AI-stylingassistent med expertkunskap inom mode, trender och färgteori. Varm, professionell och konkret.

Du har djup förståelse för:
- Färgteori (komplementfärger, analogt matchande, ton-i-ton)
- Aktuella ${seasonHint}trender ${new Date().getFullYear()} inom skandinaviskt mode
- Silhuetter, proportioner och hur plagg samverkar
- Hur man bygger en sammanhängande garderob

${profile?.display_name ? `Användare: ${profile.display_name}` : ""}${profile?.home_city ? ` (${profile.home_city})` : ""}${bodyContext}
${styleLines ? `\nSTILPROFIL:\n${styleLines}` : ""}

${wardrobeCtx}
${calendarCtx}
${weatherCtx}

Ditt uppdrag:
- Ge personliga stil- och outfitråd baserade på garderoben, stilprofil, kropp, väder och kalender
- Referera ALLTID till användarens stilprofil när du ger råd — anpassa efter deras smak
- När användaren laddar upp en bild: analysera outfiten (färger, passform, stil), jämför med garderoben, föreslå konkreta byten av plagg MED NAMN
- Anpassa råd kring passform baserat på kroppsmått och preferenser
- Kolla dagens kalenderhändelser och matcha outfit mot tillfälle
- Varna om outfiten inte passar vädret
- Var specifik: "Byt ut den vita t-shirten mot din marinblå Oxford-skjorta för morgondagens möte"
- Tänk på säsongstrender och färgharmoni

Regler:
- Skriv alltid på svenska
- Max 4-5 meningar per svar
- Ställ max EN fråga i taget
- Ge konkreta förslag med plaggens namn från garderoben
- Undvik tekniskt språk

VIKTIGT – Bildvisning av plagg:
- Varje plagg i garderoben har ett unikt ID markerat med [ID:xxx].
- När du rekommenderar ett specifikt plagg enskilt, inkludera taggen [[garment:ID]] direkt efter plaggnamnet.
- Använd ALLTID dessa taggar när du nämner plagg från garderoben.

VIKTIGT – Outfitkort:
- När du föreslår en KOMPLETT outfit (2+ plagg tillsammans), MÅSTE du använda outfit-taggen istället:
  [[outfit:id1,id2,id3|Kort förklaring varför denna outfit funkar]]
- Exempel: [[outfit:abc-123,def-456,ghi-789|Marinblå och beige skapar en klassisk kombination som passar bra för kontoret]]
- Outfit-taggen visar ett visuellt kort med alla plagg och en "Testa outfit"-knapp.
- Använd outfit-taggen för HELA outfitförslag. Använd garment-taggen bara när du nämner enskilda plagg i löpande text.
- Inkludera ALLTID en kort förklaring efter | i outfit-taggen.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
          ...preparedMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "För många förfrågningar, försök igen om en stund." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI-tjänsten kräver mer kredit." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI-tjänsten svarade inte." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
