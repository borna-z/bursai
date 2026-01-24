import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzeRequest {
  userId: string;
  storagePath: string;
}

interface GarmentAnalysis {
  title: string;
  category: string;
  subcategory: string;
  color_primary: string;
  color_secondary?: string;
  pattern?: string;
  material?: string;
  fit?: string;
  season_tags: string[];
  formality: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, storagePath } = await req.json() as AnalyzeRequest;

    // Validate input
    if (!userId || !storagePath) {
      return new Response(
        JSON.stringify({ error: "userId och storagePath krävs" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Security: Validate storagePath starts with userId
    if (!storagePath.startsWith(`${userId}/`)) {
      console.error(`Security violation: storagePath ${storagePath} does not start with userId ${userId}`);
      return new Response(
        JSON.stringify({ error: "Åtkomst nekad" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: "AI-tjänsten är inte konfigurerad" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for storage access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create signed URL for the image
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('garments')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Failed to create signed URL:', signedUrlError);
      return new Response(
        JSON.stringify({ error: "Kunde inte hämta bilden" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Created signed URL for image analysis');

    // Call OpenAI Vision API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Du är en modeexpert som analyserar klädesplagg från bilder. 
Svara ENDAST med valid JSON enligt detta schema:
{
  "title": "kort beskrivande titel på svenska",
  "category": "en av: top, bottom, shoes, outerwear, accessory, dress",
  "subcategory": "specifik typ, t.ex. t-shirt, jeans, sneakers, jacka, etc.",
  "color_primary": "huvudfärg på svenska",
  "color_secondary": "sekundär färg om finns, annars null",
  "pattern": "mönster om finns (t.ex. randig, rutig, blommig), annars null",
  "material": "material om identifierbart (t.ex. bomull, denim, läder), annars null",
  "fit": "passform om synlig (loose, regular, slim), annars null",
  "season_tags": ["lista av säsonger: vår, sommar, höst, vinter"],
  "formality": "siffra 1-5 där 1=mycket casual, 5=mycket formellt"
}
Var noggrann och konsekvent. Svara ENDAST med JSON, ingen annan text.`
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
                  url: signedUrlData.signedUrl,
                  detail: 'low'
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI-analysen misslyckades" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in OpenAI response');
      return new Response(
        JSON.stringify({ error: "Inget svar från AI" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('OpenAI raw response:', content);

    // Parse the JSON response
    let analysis: GarmentAnalysis;
    try {
      // Clean potential markdown code blocks
      const cleanedContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      analysis = JSON.parse(cleanedContent);
      
      // Validate required fields
      if (!analysis.title || !analysis.category || !analysis.subcategory || 
          !analysis.color_primary || !Array.isArray(analysis.season_tags) || 
          typeof analysis.formality !== 'number') {
        throw new Error('Missing required fields');
      }

      // Ensure formality is in range
      analysis.formality = Math.max(1, Math.min(5, Math.round(analysis.formality)));

    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError, content);
      return new Response(
        JSON.stringify({ error: "Kunde inte tolka AI-svaret" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully analyzed garment:', analysis);

    return new Response(
      JSON.stringify(analysis),
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
