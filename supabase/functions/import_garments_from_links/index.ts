import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportRequest {
  userId: string;
  urls: string[];
}

interface ImportResult {
  url: string;
  success: boolean;
  title?: string;
  garmentId?: string;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: ImportRequest = await req.json();
    const { urls } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No URLs provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit to 30 URLs
    const urlsToProcess = urls.slice(0, 30);
    const results: ImportResult[] = [];

    console.log(`Processing ${urlsToProcess.length} URLs for user ${user.id}`);

    for (const url of urlsToProcess) {
      try {
        // Validate URL
        new URL(url);

        // TODO: In next prompt, implement actual scraping logic:
        // 1. Fetch the product page
        // 2. Extract product image
        // 3. Download and upload image to storage
        // 4. Use AI to analyze the image
        // 5. Create the garment record

        // For now, return a placeholder error indicating not implemented
        results.push({
          url,
          success: false,
          error: 'Länkimport är inte implementerad ännu. Kommer i nästa uppdatering.',
        });

      } catch (urlError: any) {
        console.error(`Error processing URL ${url}:`, urlError);
        results.push({
          url,
          success: false,
          error: urlError.message || 'Ogiltig URL eller kunde inte behandlas',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    console.log(`Import complete: ${successCount} success, ${failedCount} failed`);

    return new Response(
      JSON.stringify({ 
        results,
        summary: {
          total: urlsToProcess.length,
          success: successCount,
          failed: failedCount,
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
