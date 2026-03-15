import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
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
  mode?: 'fast' | 'full' | 'enrich';
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
  confidence?: number;
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
    'black': 'black', 'white': 'white', 'grey': 'grey', 'gray': 'grey',
    'blue': 'blue', 'navy': 'navy', 'beige': 'beige', 'cream': 'beige',
    'brown': 'brown', 'green': 'green', 'red': 'red', 'pink': 'pink',
    'purple': 'purple', 'yellow': 'yellow', 'orange': 'orange',
    'svart': 'black', 'vit': 'white', 'vitt': 'white',
    'grå': 'grey', 'grått': 'grey',
    'blå': 'blue', 'blått': 'blue',
    'marinblå': 'navy', 'marin': 'navy',
    'kräm': 'beige',
    'brun': 'brown', 'brunt': 'brown',
    'grön': 'green', 'grönt': 'green',
    'röd': 'red', 'rött': 'red',
    'rosa': 'pink',
    'lila': 'purple', 'violet': 'purple',
    'gul': 'yellow', 'gult': 'yellow',
  };
  return colorMap[colorLower] || colorLower;
}

function normalizeSeasonTags(tags: string[]): string[] {
  const normalized: Set<string> = new Set();
  for (const tag of tags) {
    const tagLower = tag.toLowerCase().trim();
    if (tagLower.includes('summer') || tagLower.includes('sommar')) {
      normalized.add('summer');
    } else if (tagLower.includes('winter') || tagLower.includes('vinter')) {
      normalized.add('winter');
    } else if (tagLower.includes('spring') || tagLower.includes('vår') ||
               tagLower.includes('autumn') || tagLower.includes('fall') || tagLower.includes('höst')) {
      normalized.add('spring');
      normalized.add('autumn');
    } else if (tagLower.includes('all') || tagLower.includes('year') || tagLower.includes('året')) {
      normalized.add('spring'); normalized.add('summer');
      normalized.add('autumn'); normalized.add('winter');
    }
  }
  if (normalized.size === 0) return ['spring', 'summer', 'autumn', 'winter'];
  return Array.from(normalized);
}

function normalizeFormality(formality: number): number {
  return Math.max(1, Math.min(5, Math.round(formality)));
}

// ─── Fast mode: minimal prompt, trivial complexity, 200 tokens ───
function buildFastMessages(imageUrl: string, titleInstruction: string) {
  return [
    {
      role: 'system',
      content: `Fashion garment analyzer. Return ONLY valid JSON: {"title":"${titleInstruction}","category":"top|bottom|shoes|outerwear|accessory|dress","subcategory":"string","color_primary":"black|white|grey|blue|navy|beige|brown|green|red|pink|purple|yellow|orange","color_secondary":"color|null","pattern":"solid|striped|checked|dotted|floral|patterned|null","material":"cotton|polyester|linen|denim|leather|wool|silk|synthetic|null","fit":"slim|regular|loose|oversized|null","season_tags":["spring","summer","autumn","winter"],"formality":3,"confidence":0.9}`
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Analyze this garment. JSON only.' },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    }
  ];
}

// ─── Full mode: detailed prompt ───
function buildFullMessages(imageUrl: string, titleInstruction: string) {
  return [
    {
      role: 'system',
      content: `You are a fashion expert analyzing garments from images.
Respond ONLY with valid JSON matching this schema:
{
"title": "${titleInstruction}",
"category": "EXACTLY one of: top, bottom, shoes, outerwear, accessory, dress",
"subcategory": "specific type in English, e.g. t-shirt, jeans, sneakers, jacket",
"color_primary": "EXACTLY one of: black, white, grey, blue, navy, beige, brown, green, red, pink, purple, yellow, orange",
"color_secondary": "same color choices as above, or null if not applicable",
"pattern": "one of: solid, striped, checked, dotted, floral, patterned, null",
"material": "one of: cotton, polyester, linen, denim, leather, wool, silk, synthetic, null",
"fit": "one of: slim, regular, loose, oversized, null",
"season_tags": ["list from: spring, summer, autumn, winter"],
"formality": 3
}
Formality: 1=very casual, 5=very formal.
Respond ONLY with JSON, no explanatory text.`
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Analyze this garment and return structured JSON.' },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    }
  ];
}

// ─── Enrich mode: deeper metadata from stored image ───
function buildEnrichMessages(imageUrl: string) {
  return [
    {
      role: 'system',
      content: `You are a fashion expert. Analyze this garment image for additional details beyond basic category/color. Return ONLY valid JSON:
{
"neckline": "crew|v-neck|scoop|collar|turtleneck|boat|hooded|null",
"sleeve_length": "sleeveless|short|three-quarter|long|null",
"garment_length": "cropped|regular|long|midi|maxi|null",
"closure": "button|zip|pullover|snap|belt|tie|null",
"fabric_weight": "lightweight|midweight|heavyweight|null",
"style_tags": ["up to 5 style descriptors, e.g. casual, classic, streetwear, preppy, athleisure"],
"occasion_tags": ["up to 3 occasions, e.g. work, weekend, evening, sport, date"],
"layering_role": "base|mid|outer|standalone|null",
"refined_title": "improved concise garment title (max 30 chars)"
}
JSON only, no explanation.`
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Provide additional garment details. JSON only.' },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    }
  ];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
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
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const userId = claimsData.claims.sub as string;

    const { storagePath, base64Image, locale, mode = 'full' } = await req.json() as AnalyzeRequest;
    const titleInstruction = TITLE_LANG_MAP[locale || 'en'] || TITLE_LANG_MAP['en'];

    if (!storagePath && !base64Image) {
      return new Response(
        JSON.stringify({ error: "storagePath or base64Image is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (storagePath && !storagePath.startsWith(`${userId}/`)) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (base64Image && base64Image.length > 5 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "Image is too large" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
          JSON.stringify({ error: "Could not fetch image" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      resolvedImageUrl = signedData.signedUrl;
    }

    // ─── Enrich mode: return enrichment data only ───
    if (mode === 'enrich') {
      try {
        const { data } = await callBursAI({
          complexity: "standard",
          max_tokens: 300,
          timeout: 20000,
          functionName: "analyze_garment_enrich",
          messages: buildEnrichMessages(resolvedImageUrl),
          extraBody: { temperature: 0.1 },
        }, serviceClient);

        const content = typeof data === 'string' ? data : JSON.stringify(data);
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const enrichment = JSON.parse(cleaned);

        return new Response(
          JSON.stringify({ enrichment, ai_provider: 'lovable_ai' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        console.error('Enrichment error:', err);
        return new Response(
          JSON.stringify({ error: "Enrichment failed" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ─── Fast or Full mode ───
    const isFast = mode === 'fast';
    const messages = isFast
      ? buildFastMessages(resolvedImageUrl, titleInstruction)
      : buildFullMessages(resolvedImageUrl, titleInstruction);

    let content: string;
    try {
      const { data } = await callBursAI({
        complexity: isFast ? "trivial" : "standard",
        max_tokens: isFast ? 200 : 500,
        timeout: isFast ? 10000 : 30000,
        functionName: "analyze_garment",
        messages,
        extraBody: isFast ? { temperature: 0 } : undefined,
      }, serviceClient);

      content = typeof data === 'string' ? data : JSON.stringify(data);
    } catch (aiErr) {
      if (aiErr instanceof BursAIError) {
        if (aiErr.status === 429) {
          return new Response(
            JSON.stringify({ error: "Too many requests, try again later" }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (aiErr.status === 402) {
          return new Response(
            JSON.stringify({ error: "AI credits exhausted, contact support" }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      if (aiErr instanceof Error && aiErr.message.includes('timed out')) {
        return new Response(
          JSON.stringify({ error: "AI analysis timed out" }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error('AI analysis error:', aiErr);
      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
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
        JSON.stringify({ error: "Could not parse AI response" }),
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
      confidence: typeof rawAnalysis.confidence === 'number' ? Math.max(0, Math.min(1, rawAnalysis.confidence)) : undefined,
    };

    return new Response(
      JSON.stringify({ ...analysis, ai_provider: 'lovable_ai', ai_raw: rawAnalysis }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
