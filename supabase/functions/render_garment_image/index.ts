import { serve } from 'https://deno.land/std@0.220.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callBursAI, bursAIErrorResponse } from '../_shared/burs-ai.ts';
import { allowedOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * render_garment_image — Gemini-based canonical garment render pipeline.
 *
 * Takes a garment ID, downloads the best available source image,
 * sends it with a structured prompt to Gemini image-gen, validates
 * the output, and stores the rendered canonical asset.
 *
 * Feature-gated via RENDER_PIPELINE_ENABLED env var.
 */
serve(async (req) => {
  let supabase: ReturnType<typeof createClient> | null = null;
  let garmentIdForFailure: string | null = null;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Feature gate ──
    const enabled = Deno.env.get('RENDER_PIPELINE_ENABLED') === 'true';
    if (!enabled) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: 'Render pipeline disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Auth ──
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

    // ── Input ──
    const { garmentId } = await req.json();
    garmentIdForFailure = garmentId;

    if (!garmentId || typeof garmentId !== 'string') {
      return new Response(JSON.stringify({ error: 'garmentId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Fetch garment ──
    const { data: garment, error: garmentError } = await supabase
      .from('garments')
      .select(
        'id, user_id, title, category, subcategory, color_primary, color_secondary, material, pattern, fit, ' +
        'original_image_path, processed_image_path, image_path, image_processing_status, render_status',
      )
      .eq('id', garmentId)
      .eq('user_id', user.id)
      .single();

    if (garmentError || !garment) {
      return new Response(JSON.stringify({ error: 'Garment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Don't re-render if already ready or currently rendering
    if (garment.render_status === 'ready' || garment.render_status === 'rendering') {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: `Already ${garment.render_status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Resolve best source image ──
    // Prefer background-removed image (cleaner input for Gemini), fall back to original
    const sourceImagePath =
      (garment.image_processing_status === 'ready' && garment.processed_image_path)
        ? garment.processed_image_path
        : garment.original_image_path || garment.image_path;

    if (!sourceImagePath) {
      await supabase.from('garments').update({
        render_status: 'failed',
        render_error: 'No source image available.',
      }).eq('id', garment.id);

      return new Response(
        JSON.stringify({ ok: false, error: 'No source image' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Mark as rendering ──
    await supabase.from('garments').update({
      render_status: 'rendering',
      render_error: null,
    }).eq('id', garment.id);

    // ── Download source image as base64 ──
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('garments')
      .createSignedUrl(sourceImagePath, 900);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw signedUrlError || new Error('Unable to read source garment image.');
    }

    const imageResp = await fetch(signedUrlData.signedUrl);
    if (!imageResp.ok) throw new Error(`Failed to download source image: ${imageResp.status}`);

    const imageBytes = new Uint8Array(await imageResp.arrayBuffer());
    const contentType = imageResp.headers.get('content-type') || 'image/jpeg';

    // Convert to base64 data URL for Gemini inline input
    let base64 = '';
    const chunks: string[] = [];
    for (let i = 0; i < imageBytes.length; i += 8192) {
      const slice = imageBytes.subarray(i, i + 8192);
      const binStr = Array.from(slice, (b) => String.fromCharCode(b)).join('');
      chunks.push(btoa(binStr));
    }
    base64 = chunks.join('');
    const dataUrl = `data:${contentType};base64,${base64}`;

    // ── Build prompt ──
    const parts = [garment.color_primary];
    if (garment.color_secondary) parts.push(`and ${garment.color_secondary}`);
    if (garment.material) parts.push(garment.material);
    if (garment.pattern && garment.pattern !== 'solid') parts.push(garment.pattern);
    if (garment.fit) parts.push(`${garment.fit} fit`);

    const itemName = garment.subcategory
      ? `${garment.subcategory} ${garment.category}`
      : garment.title;

    const prompt = [
      `You are a professional fashion product photographer.`,
      `Recreate this exact garment as a clean product photo.`,
      `The garment is: ${parts.join(' ')} ${itemName}.`,
      `Requirements:`,
      `- Shadow mannequin / ghost mannequin style — show the garment as if worn on an invisible form`,
      `- Pure white background`,
      `- Preserve the EXACT color, print, pattern, and logos from the reference image`,
      `- Preserve the silhouette and proportions`,
      `- No person, no model, no hanger, no flat lay`,
      `- High-end fashion catalog lighting`,
      `- Single garment only, centered`,
    ].join('\n');

    // ── Call Gemini image-gen with reference image ──
    const { data: aiResult } = await callBursAI({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: prompt },
          ],
        },
      ],
      modelType: 'image-gen',
      extraBody: { modalities: ['image', 'text'] },
      models: ['google/gemini-2.5-flash-image'],
      timeout: 60000,
      functionName: 'render_garment_image',
    });

    // ── Extract generated image ──
    const imageData =
      aiResult?.images?.[0]?.image_url?.url ||
      aiResult?.__raw?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageData || !imageData.startsWith('data:image')) {
      await supabase.from('garments').update({
        render_status: 'failed',
        render_provider: 'gemini',
        render_error: 'No image in AI response.',
      }).eq('id', garment.id);

      return new Response(
        JSON.stringify({ ok: true, rendered: false, error: 'No image in AI response' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Decode output ──
    const outputBase64 = imageData.split(',')[1];
    const binaryStr = atob(outputBase64);
    const outputBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) outputBytes[i] = binaryStr.charCodeAt(i);

    // ── Quality gate v1: structural checks ──
    const MIN_SIZE_BYTES = 10240; // 10KB — catches blank/corrupt images
    const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB sanity cap

    if (outputBytes.length < MIN_SIZE_BYTES) {
      await supabase.from('garments').update({
        render_status: 'failed',
        render_provider: 'gemini',
        render_error: `Output too small (${outputBytes.length} bytes). Likely blank or corrupt.`,
      }).eq('id', garment.id);

      return new Response(
        JSON.stringify({ ok: true, rendered: false, error: 'Output too small' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (outputBytes.length > MAX_SIZE_BYTES) {
      await supabase.from('garments').update({
        render_status: 'failed',
        render_provider: 'gemini',
        render_error: `Output too large (${outputBytes.length} bytes).`,
      }).eq('id', garment.id);

      return new Response(
        JSON.stringify({ ok: true, rendered: false, error: 'Output too large' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Upload rendered image ──
    const renderedPath = `${garment.user_id}/${garment.id}/rendered.png`;

    const { error: uploadError } = await supabase.storage
      .from('garments')
      .upload(renderedPath, outputBytes, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // ── Update garment record ──
    await supabase.from('garments').update({
      rendered_image_path: renderedPath,
      render_status: 'ready',
      render_provider: 'gemini',
      render_error: null,
      rendered_at: new Date().toISOString(),
    }).eq('id', garment.id);

    console.log(`Rendered garment ${garment.id} → ${renderedPath}`);

    return new Response(
      JSON.stringify({ ok: true, rendered: true, renderedImagePath: renderedPath }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('render_garment_image error', error);

    if (supabase && garmentIdForFailure) {
      await supabase.from('garments').update({
        render_status: 'failed',
        render_provider: 'gemini',
        render_error: error instanceof Error ? error.message : 'Unknown error',
      }).eq('id', garmentIdForFailure).catch(() => {});
    }

    return bursAIErrorResponse(error, corsHeaders);
  }
});
