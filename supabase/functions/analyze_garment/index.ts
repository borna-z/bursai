import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, BursAIError } from "../_shared/burs-ai.ts";

import { allowedOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface AnalyzeRequest {
  storagePath?: string;
  base64Image?: string;
  locale?: string;
}

const TITLE_LANG_MAP: Record<string, string> = {
  sv: 'kort beskrivande titel på svenska (max 30 tecken)',
  en: 'short descriptive title in English (max 30 characters)',
  no: 'kort beskrivende tittel på norsk (maks 30 tegn)',
  da: 'kort beskrivende titel på dansk (maks 30 tegn)',
  fi: 'lyhyt kuvaava otsikko suomeksi (enintään 30 merkkiä)',
  de: 'kurzer beschreibender Titel auf Deutsch (max 30 Zeichen)',
  fr: 'titre descriptif court en français (max 30 caractères)',
  es: 'título descriptivo corto en español (máx. 30 caracteres)',
  pt: 'título descritivo curto em português (máx. 30 caracteres)',
  it: 'titolo descrittivo breve in italiano (max 30 caratteri)',
  nl: 'korte beschrijvende titel in het Nederlands (max 30 tekens)',
  ar: 'عنوان وصفي قصير بالعربية (بحد أقصى 30 حرفًا)',
  fa: 'عنوان توصیفی کوتاه به فارسی (حداکثر ۳۰ نویسه)',
  ja: '日本語の短い説明タイトル（最大30文字）',
};

interface GarmentAnalysis {
  title: string;
  category: string;
  subcategory: string;
  color_primary: string;
  color_secondary?: string | null;
  pattern?: string | null;
  material?: string | null;
  fit?: string | null;
  season_tags: string[];
  formality: number;
}

function normalizeCategory(cat: string): string {
  const catLower = cat.toLowerCase().trim();
  const categoryMap: Record<string, string> = {
    'top': 'top', 'överdel': 'top', 'tröja': 'top', 'skjorta': 'top',
    't-shirt': 'top', 'blus': 'top',
    'bottom': 'bottom', 'underdel': 'bottom', 'byxa': 'bottom',
    'byxor': 'bottom', 'jeans': 'bottom', 'kjol': 'bottom',
    'shoes': 'shoes', 'skor': 'shoes', 'sko': 'shoes',
    'outerwear': 'outerwear', 'ytterkläder': 'outerwear',
    'jacka': 'outerwear', 'kappa': 'outerwear',
    'accessory': 'accessory', 'accessoar': 'accessory', 'väska': 'accessory',
    'dress': 'dress', 'klänning': 'dress',
  };
  return categoryMap[catLower] || 'top';
}

function normalizeColor(color: string): string {
  const colorLower = color.toLowerCase().trim();
  const colorMap: Record<string, string> = {
    'black': 'svart', 'svart': 'svart',
    'white': 'vit', 'vit': 'vit', 'vitt': 'vit',
    'gray': 'grå', 'grey': 'grå', 'grå': 'grå', 'grått': 'grå',
    'blue': 'blå', 'blå': 'blå', 'blått': 'blå',
    'navy': 'marinblå', 'marinblå': 'marinblå', 'marin': 'marinblå', 'navy blue': 'marinblå',
    'beige': 'beige', 'cream': 'beige', 'kräm': 'beige',
    'brown': 'brun', 'brun': 'brun', 'brunt': 'brun',
    'green': 'grön', 'grön': 'grön', 'grönt': 'grön',
    'red': 'röd', 'röd': 'röd', 'rött': 'röd',
    'pink': 'rosa', 'rosa': 'rosa',
    'purple': 'lila', 'lila': 'lila', 'violet': 'lila',
    'yellow': 'gul', 'gul': 'gul', 'gult': 'gul',
    'orange': 'orange',
  };
  return colorMap[colorLower] || colorLower;
}

function normalizeSeasonTags(tags: string[]): string[] {
  const normalized: Set<string> = new Set();
  for (const tag of tags) {
    const tagLower = tag.toLowerCase().trim();
    if (tagLower.includes('sommar') || tagLower === 'summer') {
      normalized.add('sommar');
    } else if (tagLower.includes('vinter') || tagLower === 'winter') {
      normalized.add('vinter');
    } else if (tagLower.includes('vår') || tagLower.includes('höst') ||
               tagLower === 'spring' || tagLower === 'fall' || tagLower === 'autumn') {
      normalized.add('vår');
      normalized.add('höst');
    } else if (tagLower.includes('året') || tagLower.includes('all') || tagLower.includes('year')) {
      normalized.add('vår'); normalized.add('sommar');
      normalized.add('höst'); normalized.add('vinter');
    }
  }
  if (normalized.size === 0) return ['vår', 'sommar', 'höst', 'vinter'];
  return Array.from(normalized);
}

function normalizeFormality(formality: number): number {
  return Math.max(1, Math.min(5, Math.round(formality)));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: "Ej auktoriserad" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Ej auktoriserad" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const userId = claimsData.claims.sub as string;

    const { storagePath, base64Image, locale } = await req.json() as AnalyzeRequest;
    const titleInstruction = TITLE_LANG_MAP[locale || 'sv'] || TITLE_LANG_MAP['sv'];

    if (!storagePath && !base64Image) {
      return new Response(
        JSON.stringify({ error: "storagePath eller base64Image krävs" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (storagePath && !storagePath.startsWith(`${userId}/`)) {
      return new Response(
        JSON.stringify({ error: "Åtkomst nekad" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (base64Image && base64Image.length > 5 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "Bilden är för stor" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isLiveScan = !!base64Image;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Resolve image URL
    let resolvedImageUrl: string;
    if (base64Image) {
      resolvedImageUrl = base64Image;
    } else {
      const { data: signedData, error: signedError } = await serviceClient.storage
        .from('garments')
        .createSignedUrl(storagePath!, 300);
      if (signedError || !signedData?.signedUrl) {
        return new Response(
          JSON.stringify({ error: "Kunde inte hämta bilden" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      resolvedImageUrl = signedData.signedUrl;
    }

    let content: string;
    try {
      const { data } = await callBursAI({
        complexity: isLiveScan ? "standard" : "complex",
        max_tokens: isLiveScan ? 300 : 500,
        timeout: isLiveScan ? 15000 : 30000,
        functionName: "analyze_garment",
        messages: [
          {
            role: 'system',
            content: `Du är en modeexpert som analyserar klädesplagg från bilder.
Svara ENDAST med valid JSON enligt detta schema:
{
"title": "${titleInstruction}",
"category": "EXAKT en av: top, bottom, shoes, outerwear, accessory, dress",
"subcategory": "specifik typ på svenska, t.ex. t-shirt, jeans, sneakers, jacka",
"color_primary": "EXAKT en av: svart, vit, grå, blå, marinblå, beige, brun, grön, röd, rosa, lila, gul, orange",
"color_secondary": "samma färgval som ovan, eller null om ej tillämpligt",
"pattern": "en av: enfärgad, randig, rutig, prickig, blommig, mönstrad, null",
"material": "en av: bomull, polyester, lin, denim, läder, ull, siden, syntet, null",
"fit": "en av: slim, regular, loose, oversized, null",
"season_tags": ["lista med: vår, sommar, höst, vinter"],
"formality": 3
}
Formalitet: 1=mycket casual, 5=mycket formellt.
Svara ENDAST med JSON, ingen förklarande text.`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analysera detta klädesplagg och returnera strukturerad JSON.' },
              { type: 'image_url', image_url: { url: resolvedImageUrl } }
            ]
          }
        ],
      }, serviceClient);

      content = typeof data === 'string' ? data : JSON.stringify(data);
    } catch (aiErr) {
      if (aiErr instanceof BursAIError) {
        if (aiErr.status === 429) {
          return new Response(
            JSON.stringify({ error: "För många förfrågningar, försök igen senare" }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (aiErr.status === 402) {
          return new Response(
            JSON.stringify({ error: "AI-krediter slut, kontakta support" }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      if (aiErr instanceof Error && aiErr.message.includes('timed out')) {
        return new Response(
          JSON.stringify({ error: "AI-analysen tog för lång tid" }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error('AI analysis error:', aiErr);
      return new Response(
        JSON.stringify({ error: "AI-analysen misslyckades" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!content) {
      return new Response(
        JSON.stringify({ error: "Inget svar från AI" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let rawAnalysis: GarmentAnalysis;
    try {
      const cleanedContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      rawAnalysis = JSON.parse(cleanedContent);
      if (!rawAnalysis.title || !rawAnalysis.category || !rawAnalysis.color_primary) {
        throw new Error('Missing required fields');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, content);
      return new Response(
        JSON.stringify({ error: "Kunde inte tolka AI-svaret" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analysis: GarmentAnalysis = {
      title: rawAnalysis.title.substring(0, 50),
      category: normalizeCategory(rawAnalysis.category),
      subcategory: rawAnalysis.subcategory?.toLowerCase() || '',
      color_primary: normalizeColor(rawAnalysis.color_primary),
      color_secondary: rawAnalysis.color_secondary ? normalizeColor(rawAnalysis.color_secondary) : null,
      pattern: rawAnalysis.pattern?.toLowerCase() || null,
      material: rawAnalysis.material?.toLowerCase() || null,
      fit: rawAnalysis.fit?.toLowerCase() || null,
      season_tags: normalizeSeasonTags(rawAnalysis.season_tags || []),
      formality: normalizeFormality(rawAnalysis.formality || 3),
    };

    return new Response(
      JSON.stringify({ ...analysis, ai_provider: 'lovable_ai', ai_raw: rawAnalysis }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: "Ett oväntat fel uppstod" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
