import { serve } from 'https://deno.land/std@0.220.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS } from '../_shared/cors.ts';

serve(async (req) => {
  let supabase: ReturnType<typeof createClient> | null = null;
  let garmentIdForFailure: string | null = null;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
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
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    supabase = createClient(supabaseUrl, serviceKey);
    const { garmentId } = await req.json();
    garmentIdForFailure = garmentId;

    if (!garmentId || typeof garmentId !== 'string') {
      return new Response(JSON.stringify({ error: 'garmentId is required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const { data: garment, error: garmentError } = await supabase
      .from('garments')
      .select('id, user_id, original_image_path, image_path')
      .eq('id', garmentId)
      .eq('user_id', user.id)
      .single();

    if (garmentError || !garment) {
      return new Response(JSON.stringify({ error: 'Garment not found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const originalImagePath = garment.original_image_path || garment.image_path;
    if (!originalImagePath) {
      await supabase.from('garments').update({
        image_processing_status: 'failed',
        image_processing_provider: 'disabled',
        image_processing_error: 'Missing original garment image.',
      }).eq('id', garment.id);

      return new Response(JSON.stringify({ ok: false, error: 'Missing original image' }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('garments').update({
      processed_image_path: null,
      image_processing_status: 'ready',
      image_processing_provider: 'disabled',
      image_processing_confidence: null,
      image_processing_error: null,
      image_processed_at: new Date().toISOString(),
    }).eq('id', garment.id);

    return new Response(JSON.stringify({ ok: true, skipped: true, originalImagePath }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
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
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
