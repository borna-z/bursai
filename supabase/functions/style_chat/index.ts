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
      { headers: { "User-Agent": "DRAPE-App/1.0" } }
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
    .select("title, category, color_primary, formality, season_tags, image_path")
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
    title: string; category: string; color_primary: string; formality: number | null; season_tags: string[] | null
  }) =>
    `• ${g.title} (${g.category}, ${g.color_primary}${g.formality ? `, formalitet ${g.formality}` : ""}${g.season_tags?.length ? `, ${g.season_tags.join("/")}` : ""})`
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

    // Style prefs
    const preferences = profile?.preferences as Record<string, unknown> || {};
    const styleLines = [
      (preferences.favoriteColors as string[])?.length ? `Favoritfärger: ${(preferences.favoriteColors as string[]).join(", ")}` : "",
      (preferences.dislikedColors as string[])?.length ? `Ogillar: ${(preferences.dislikedColors as string[]).join(", ")}` : "",
      preferences.fitPreference ? `Passform: ${preferences.fitPreference}` : "",
      preferences.styleVibe ? `Stil: ${preferences.styleVibe}` : "",
    ].filter(Boolean).join(". ");

    const systemPrompt = `Du är DRAPE Stylisten – en personlig AI-stylingassistent. Varm, professionell och konkret.

${profile?.display_name ? `Användare: ${profile.display_name}` : ""}${profile?.home_city ? ` (${profile.home_city})` : ""}${bodyContext}
${styleLines ? `Stilpreferenser: ${styleLines}` : ""}

${wardrobeCtx}
${calendarCtx}
${weatherCtx}

Ditt uppdrag:
- Ge personliga stil- och outfitråd baserade på garderoben, kropp, väder och kalender
- När användaren laddar upp en bild: analysera outfiten (färger, passform, stil), jämför med garderoben, föreslå konkreta byten av plagg MED NAMN
- Anpassa råd kring passform baserat på kroppsmått
- Kolla dagens kalenderhändelser och matcha outfit mot tillfälle
- Varna om outfiten inte passar vädret
- Var specifik: "Byt ut den vita t-shirten mot din marinblå Oxford-skjorta för morgondagens möte"

Regler:
- Skriv alltid på svenska
- Max 4-5 meningar per svar
- Ställ max EN fråga i taget
- Ge konkreta förslag med plaggens namn från garderoben
- Undvik tekniskt språk`;

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
