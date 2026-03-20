import { serve } from 'https://deno.land/std@0.220.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { allowedOrigin } from '../_shared/cors.ts';
import { garmentImageProvider, isEligibleGarment } from '../_shared/garment-image-processing/provider.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function guessExtension(contentType: string | undefined): string {
  if (!contentType) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  return 'png';
}

serve(async (req) => {
  let supabase: ReturnType<typeof createClient> | null = null;
  let garmentIdForFailure: string | null = null;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    supabase = createClient(supabaseUrl, serviceKey);
    const { garmentId } = await req.json();
    garmentIdForFailure = garmentId;

    if (!garmentId || typeof garmentId !== 'string') {
      return new Response(JSON.stringify({ error: 'garmentId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: garment, error: garmentError } = await supabase
      .from('garments')
      .select('id, user_id, title, category, subcategory, original_image_path, image_path, image_processing_status')
      .eq('id', garmentId)
      .eq('user_id', user.id)
      .single();

    if (garmentError || !garment) {
      return new Response(JSON.stringify({ error: 'Garment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const originalImagePath = garment.original_image_path || garment.image_path;
    if (!originalImagePath) {
      await supabase.from('garments').update({
        image_processing_status: 'failed',
        image_processing_provider: garmentImageProvider.name,
        image_processing_error: 'Missing original garment image.',
      }).eq('id', garment.id);

      return new Response(JSON.stringify({ ok: false, error: 'Missing original image' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isEligibleGarment(garment.category, garment.subcategory)) {
      await supabase.from('garments').update({
        image_processing_status: 'failed',
        image_processing_provider: 'skip',
        image_processing_error: 'Unsupported garment type for garment restructure v1.',
      }).eq('id', garment.id);

      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('garments').update({
      image_processing_status: 'processing',
      image_processing_provider: garmentImageProvider.name,
      image_processing_error: null,
    }).eq('id', garment.id);

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('garments')
      .createSignedUrl(originalImagePath, 900);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw signedUrlError || new Error('Unable to read original garment image.');
    }

    const result = await garmentImageProvider.process({
      garmentId: garment.id,
      userId: garment.user_id,
      originalImageUrl: signedUrlData.signedUrl,
      originalImagePath,
      category: garment.category,
      subcategory: garment.subcategory,
      title: garment.title,
    });

    if (!result.success || !result.outputBytes) {
      await supabase.from('garments').update({
        image_processing_status: 'failed',
        image_processing_provider: result.provider,
        image_processing_confidence: result.confidence,
        image_processing_error: result.error || 'Garment image processing failed.',
      }).eq('id', garment.id);

      return new Response(JSON.stringify({ ok: true, processed: false, error: result.error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ext = guessExtension(result.outputContentType);
    const processedPath = `${garment.user_id}/${garment.id}/processed.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('garments')
      .upload(processedPath, result.outputBytes, {
        contentType: result.outputContentType || 'image/png',
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    await supabase.from('garments').update({
      processed_image_path: processedPath,
      image_processing_status: 'ready',
      image_processing_provider: result.provider,
      image_processing_version: 'garment-restructure-v1',
      image_processing_confidence: result.confidence,
      image_processing_error: null,
      image_processed_at: new Date().toISOString(),
    }).eq('id', garment.id);

    return new Response(JSON.stringify({ ok: true, processed: true, processedImagePath: processedPath }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('process_garment_image error', error);
    if (supabase && garmentIdForFailure) {
      await supabase.from('garments').update({
        image_processing_status: 'failed',
        image_processing_error: error instanceof Error ? error.message : 'Unknown error',
      }).eq('id', garmentIdForFailure);
    }
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
