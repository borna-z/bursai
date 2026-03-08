import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface AnalyzeRequest {
  storagePath?: string;
  base64Image?: string;
  locale?: string;
}

// Map locale to title language instruction
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

// Standardize category to allowed values
function normalizeCategory(cat: string): string {
  const catLower = cat.toLowerCase().trim();
  const categoryMap: Record<string, string> = {
    'top': 'top',
    'överdel': 'top',
    'tröja': 'top',
    'skjorta': 'top',
    't-shirt': 'top',
    'blus': 'top',
    'bottom': 'bottom',
    'underdel': 'bottom',
    'byxa': 'bottom',
    'byxor': 'bottom',
    'jeans': 'bottom',
    'kjol': 'bottom',
    'shoes': 'shoes',
    'skor': 'shoes',
    'sko': 'shoes',
    'outerwear': 'outerwear',
    'ytterkläder': 'outerwear',
    'jacka': 'outerwear',
    'kappa': 'outerwear',
    'accessory': 'accessory',
    'accessoar': 'accessory',
    'väska': 'accessory',
    'dress': 'dress',
    'klänning': 'dress',
  };
  return categoryMap[catLower] || 'top';
}

// Standardize color to Swedish simple words
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

// Standardize season tags
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
      normalized.add('vår');
      normalized.add('sommar');
      normalized.add('höst');
      normalized.add('vinter');
    }
  }
  
  // Default to all seasons if none specified
  if (normalized.size === 0) {
    return ['vår', 'sommar', 'höst', 'vinter'];
  }
  
  return Array.from(normalized);
}

// Normalize formality to 1-5
function normalizeFormality(formality: number): number {
  return Math.max(1, Math.min(5, Math.round(formality)));
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Get authenticated user from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: "Ej auktoriserad" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create client with user's token to verify identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user from JWT - this is the ONLY source of truth for user identity
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error('Auth error:', claimsError);
      return new Response(
        JSON.stringify({ error: "Ej auktoriserad" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const user = { id: claimsData.claims.sub as string };

    const userId = user.id;
    console.log(`Authenticated user: ${userId}`);

    // Get storagePath, base64Image, and locale from request body
    const { storagePath, base64Image, locale } = await req.json() as AnalyzeRequest;
    const titleInstruction = TITLE_LANG_MAP[locale || 'sv'] || TITLE_LANG_MAP['sv'];

    // Validate input - need either storagePath or base64Image
    if (!storagePath && !base64Image) {
      return new Response(
        JSON.stringify({ error: "storagePath eller base64Image krävs" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Validate storagePath starts with AUTHENTICATED user's ID (only if storagePath provided)
    if (storagePath && !storagePath.startsWith(`${userId}/`)) {
      console.error(`Security violation: User ${userId} tried to access path ${storagePath}`);
      return new Response(
        JSON.stringify({ error: "Åtkomst nekad" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate base64Image size (max ~5MB base64 ≈ ~3.75MB image)
    if (base64Image && base64Image.length > 5 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "Bilden är för stor" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Lovable AI API key
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: "AI-tjänsten är inte konfigurerad" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine image URL for AI analysis
    let imageUrl: string;

    if (base64Image) {
      // Use base64 directly as data URL
      const prefix = base64Image.startsWith('data:') ? '' : 'data:image/jpeg;base64,';
      imageUrl = `${prefix}${base64Image}`;
      console.log('Using base64 image for analysis (Live Scan mode)');
    } else {
      // Create Supabase client with service role for storage access
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

      const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
        .from('garments')
        .createSignedUrl(storagePath!, 3600);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error('Failed to create signed URL:', signedUrlError);
        return new Response(
          JSON.stringify({ error: "Kunde inte hämta bilden" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      imageUrl = signedUrlData.signedUrl;
      console.log('Created signed URL for image analysis');
    }

    // Determine model and settings based on scan mode
    const isLiveScan = !!base64Image;
    const aiModel = isLiveScan ? 'google/gemini-2.5-flash-lite' : 'google/gemini-3-flash-preview';
    const aiMaxTokens = isLiveScan ? 300 : 500;
    const aiTimeout = isLiveScan ? 15000 : 30000;

    console.log(`Using model: ${aiModel}, max_tokens: ${aiMaxTokens}, timeout: ${aiTimeout}ms`);

    // Call Lovable AI Gateway with vision-capable model (with timeout)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), aiTimeout);

    let aiResponse;
    try {
      aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: aiModel,
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
                {
                  type: 'text',
                  text: 'Analysera detta klädesplagg och returnera strukturerad JSON.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageUrl
                  }
                }
              ]
            }
          ],
          max_tokens: aiMaxTokens,
          temperature: 0.2,
        }),
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('AI request timed out');
        return new Response(
          JSON.stringify({ error: "AI-analysen tog för lång tid" }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw fetchError;
    }
    clearTimeout(timeout);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "För många förfrågningar, försök igen senare" }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI-krediter slut, kontakta support" }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI-analysen misslyckades" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response');
      return new Response(
        JSON.stringify({ error: "Inget svar från AI" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('AI raw response:', content);

    // Parse the JSON response
    let rawAnalysis: GarmentAnalysis;
    try {
      // Clean potential markdown code blocks
      const cleanedContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      rawAnalysis = JSON.parse(cleanedContent);
      
      // Validate required fields exist
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

    // Normalize and standardize the analysis
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

    console.log('Successfully analyzed and normalized garment:', analysis);

    return new Response(
      JSON.stringify({
        ...analysis,
        ai_provider: 'lovable_ai',
        ai_raw: rawAnalysis,
      }),
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
