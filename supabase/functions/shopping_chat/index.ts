import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------- helpers (same as style_chat) ----------

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

async function getWardrobeContext(supabase: ReturnType<typeof createClient>, userId: string): Promise<{ summary: string; garments: Array<{ id: string; title: string; category: string; color_primary: string; formality: number | null; season_tags: string[] | null }> }> {
  const { data: garments } = await supabase
    .from("garments")
    .select("id, title, category, color_primary, color_secondary, formality, season_tags, material, fit, subcategory")
    .eq("user_id", userId)
    .eq("in_laundry", false)
    .limit(60);
  if (!garments?.length) return { summary: "Användaren har inga plagg i garderoben ännu.", garments: [] };

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
    `• ${g.title} [ID:${g.id}] (${g.category}${g.subcategory ? `/${g.subcategory}` : ""}, ${g.color_primary}${g.color_secondary ? `+${g.color_secondary}` : ""}${g.material ? `, ${g.material}` : ""}${g.fit ? `, ${g.fit}` : ""}${g.formality ? `, formalitet ${g.formality}` : ""}${g.season_tags?.length ? `, ${g.season_tags.join("/")}` : ""})`
  ).join("\n");

  return {
    summary: `Garderob (${garments.length} plagg: ${catSummary}):\n${details}`,
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
      if (coords) weatherCtx = await fetchWeather(coords.lat, coords.lon);
    }

    // Style prefs — use full styleProfile (quiz v3) if available, fallback to legacy
    const preferences = profile?.preferences as Record<string, unknown> || {};
    const sp = preferences.styleProfile as Record<string, any> | undefined;
    let styleLines = "";
    if (sp) {
      const parts: string[] = [];
      if (sp.gender) parts.push(`Kön: ${sp.gender}`);
      if (sp.ageRange) parts.push(`Ålder: ${sp.ageRange}`);
      if (sp.styleWords?.length) parts.push(`Stilord: ${sp.styleWords.join(", ")}`);
      if (sp.favoriteColors?.length) parts.push(`Favoritfärger: ${sp.favoriteColors.join(", ")}`);
      if (sp.dislikedColors?.length) parts.push(`Undviker: ${sp.dislikedColors.join(", ")}`);
      if (sp.paletteVibe) parts.push(`Palettskänsla: ${sp.paletteVibe}`);
      if (sp.patternFeeling) parts.push(`Mönster: ${sp.patternFeeling}`);
      if (sp.fit) parts.push(`Passform: ${sp.fit}`);
      if (sp.shoppingMindset) parts.push(`Shopping: ${sp.shoppingMindset}`);
      if (sp.sustainability) parts.push(`Hållbarhet: ${sp.sustainability}`);
      if (sp.capsuleWardrobe) parts.push(`Kapselgarderob: ${sp.capsuleWardrobe}`);
      if (sp.wardrobeFrustrations?.length) parts.push(`Frustrationer: ${sp.wardrobeFrustrations.join(", ")}`);
      if (sp.primaryGoal) parts.push(`Huvudmål: ${sp.primaryGoal}`);
      if (sp.fabricFeel) parts.push(`Favoritmaterial: ${sp.fabricFeel}`);
      styleLines = parts.join(". ");
    } else {
      styleLines = [
        (preferences.favoriteColors as string[])?.length ? `Favoritfärger: ${(preferences.favoriteColors as string[]).join(", ")}` : "",
        (preferences.dislikedColors as string[])?.length ? `Ogillar: ${(preferences.dislikedColors as string[]).join(", ")}` : "",
        preferences.fitPreference ? `Passform: ${preferences.fitPreference}` : "",
        preferences.styleVibe ? `Stil: ${preferences.styleVibe}` : "",
      ].filter(Boolean).join(". ");
    }

    const systemPrompt = `Du är BURS Shopping-assistenten – en smart shoppingrådgivare som hjälper användaren fatta bra köpbeslut baserat på deras befintliga garderob.

${profile?.display_name ? `Användare: ${profile.display_name}` : ""}${profile?.home_city ? ` (${profile.home_city})` : ""}
${styleLines ? `Stilpreferenser: ${styleLines}` : ""}

${wardrobeResult.summary}
${weatherCtx}

Ditt uppdrag:
1. **Analysera plagg** – När användaren skickar en bild på ett plagg i butiken, identifiera vad det är (typ, färg, material, stil)
2. **Matcha med garderoben** – Visa vilka plagg hemma som passar ihop med det potentiella köpet. Använd ALLTID [[garment:ID]]-taggar så användaren ser bilder
3. **Betygsätt köpet** – Ge ett betyg 1-10 baserat på:
   - Hur väl det kompletterar garderoben (fler matchningar = högre betyg)
   - Om det fyller en lucka eller överlappar med befintliga plagg
   - Stil- och färgharmoni med befintlig garderob
   - Säsongspassning
4. **Varna för dubbletter** – Om användaren redan har liknande plagg, påpeka det tydligt
5. **Föreslå kompletterande köp** – Berätta vad mer som kan köpas för att maximera plaggets användbarhet
6. **Jämföra plagg** – Om användaren visar två alternativ, ge ett tydligt råd om vilket som är bäst

Format för svar:
- Börja med en kort identifiering av plagget
- Lista 2-4 matchande plagg från garderoben med [[garment:ID]]-taggar
- Ge ditt betyg (t.ex. "⭐ Köpbetyg: 8/10")
- Avsluta med en tydlig rekommendation: "Köp den!" / "Skippa" / "Bra men inte nödvändig"

Regler:
- Skriv alltid på svenska
- Max 6-8 meningar per svar
- Ställ max EN fråga i taget
- Ge konkreta förslag med plaggens namn från garderoben
- Undvik tekniskt språk

VIKTIGT – Bildvisning av plagg:
- Varje plagg i garderoben har ett unikt ID markerat med [ID:xxx].
- När du rekommenderar ett specifikt plagg, MÅSTE du inkludera taggen [[garment:ID]] direkt efter plaggnamnet.
- Exempel: "Den matchar perfekt med din marinblå Oxford-skjorta [[garment:abc-123]]."
- Användaren ser då en bild på plagget direkt i chatten.
- Använd ALLTID dessa taggar när du nämner plagg från garderoben.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    console.error("shopping_chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Okänt fel" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
