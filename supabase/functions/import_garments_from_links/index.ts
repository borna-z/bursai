import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { allowedOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ============ TYPES ============
interface ImportRequest {
  userId: string;
  urls: string[];
}

interface ImportResult {
  url: string;
  status: 'ok' | 'failed';
  garment_id?: string;
  title?: string;
  image_path?: string;
  reason?: string;
}

interface ExtractedMetadata {
  title: string | null;
  imageUrl: string | null;
}

// ============ SECURITY: SSRF PROTECTION ============
const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
];

const BLOCKED_IP_PREFIXES = [
  '10.',           // Private Class A
  '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.',
  '172.24.', '172.25.', '172.26.', '172.27.',
  '172.28.', '172.29.', '172.30.', '172.31.',  // Private Class B
  '192.168.',      // Private Class C
  '169.254.',      // Link-local
  '100.64.',       // Carrier-grade NAT
];

function isBlockedUrl(urlString: string): { blocked: boolean; reason?: string } {
  try {
    const url = new URL(urlString);
    
    // Only allow http/https
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { blocked: true, reason: 'Invalid protocol - only http/https allowed' };
    }
    
    const hostname = url.hostname.toLowerCase();
    
    // Block localhost and loopback
    if (BLOCKED_HOSTS.includes(hostname)) {
      return { blocked: true, reason: 'Local address blocked' };
    }
    
    // Block private IP ranges
    for (const prefix of BLOCKED_IP_PREFIXES) {
      if (hostname.startsWith(prefix)) {
        return { blocked: true, reason: 'Private IP address blocked' };
      }
    }
    
    // Block numeric IPs that could be internal
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      const parts = hostname.split('.').map(Number);
      if (parts[0] === 10 || 
          (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
          (parts[0] === 192 && parts[1] === 168) ||
          (parts[0] === 169 && parts[1] === 254) ||
          parts[0] === 127) {
        return { blocked: true, reason: 'Internal IP address blocked' };
      }
    }
    
    return { blocked: false };
  } catch {
    return { blocked: true, reason: 'Invalid URL' };
  }
}

// ============ HTML METADATA EXTRACTION ============
function extractMetadata(html: string, baseUrl: string): ExtractedMetadata {
  let title: string | null = null;
  let imageUrl: string | null = null;
  
  // Try JSON-LD Product first (highest priority)
  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdMatches) {
    try {
      const jsonData = JSON.parse(match[1]);
      const products = Array.isArray(jsonData) ? jsonData : [jsonData];
      
      for (const item of products) {
        if (item['@type'] === 'Product' || item['@type']?.includes('Product')) {
          if (item.name && !title) {
            title = item.name;
          }
          if (item.image) {
            const img = Array.isArray(item.image) ? item.image[0] : item.image;
            if (typeof img === 'string') {
              imageUrl = img;
            } else if (img?.url) {
              imageUrl = img.url;
            }
          }
          if (title && imageUrl) break;
        }
      }
    } catch {
      // Invalid JSON-LD, continue
    }
  }
  
  // Extract og:image if no image found
  if (!imageUrl) {
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (ogImageMatch) {
      imageUrl = ogImageMatch[1];
    }
  }
  
  // Fallback: twitter:image
  if (!imageUrl) {
    const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
                              html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
    if (twitterImageMatch) {
      imageUrl = twitterImageMatch[1];
    }
  }
  
  // Extract og:title if no title found
  if (!title) {
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    if (ogTitleMatch) {
      title = ogTitleMatch[1];
    }
  }
  
  // Fallback: HTML title tag
  if (!title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }
  }
  
  // Resolve relative URLs
  if (imageUrl && !imageUrl.startsWith('http')) {
    try {
      imageUrl = new URL(imageUrl, baseUrl).href;
    } catch {
      imageUrl = null;
    }
  }
  
  // Decode HTML entities in title
  if (title) {
    title = title
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();
  }
  
  return { title, imageUrl };
}

// ============ IMAGE HANDLING ============
function getExtensionFromContentType(contentType: string | null): string {
  if (!contentType) return 'jpg';
  
  const type = contentType.toLowerCase().split(';')[0].trim();
  switch (type) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/avif':
      return 'avif';
    default:
      return 'jpg';
  }
}

async function downloadImage(url: string): Promise<{ data: Uint8Array; contentType: string } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WardrobeBot/1.0)',
        'Accept': 'image/*',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`Image download failed: ${response.status}`);
      return null;
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Verify it's actually an image
    if (!contentType.startsWith('image/')) {
      console.error(`Not an image: ${contentType}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    // Basic size check (max 10MB)
    if (data.length > 10 * 1024 * 1024) {
      console.error('Image too large');
      return null;
    }
    
    return { data, contentType };
  } catch (error) {
    console.error('Image download error:', error);
    return null;
  }
}

// ============ MAIN HANDLER ============
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Saknar auktoriseringsheader' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Client for auth verification
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    // Service client for storage operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error('Auth error:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Ej auktoriserad' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const user = { id: claimsData.claims.sub as string };

    // Parse and validate request
    const body: ImportRequest = await req.json();
    const { urls } = body;

    // Validate urls array
    if (!urls || !Array.isArray(urls)) {
      return new Response(
        JSON.stringify({ error: 'urls måste vara en array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (urls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Inga URLs angivna' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (urls.length > 30) {
      return new Response(
        JSON.stringify({ error: 'Max 30 URLs per request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch existing source_urls for duplicate detection
    const { data: existingGarments } = await supabaseAdmin
      .from('garments')
      .select('source_url')
      .eq('user_id', user.id)
      .not('source_url', 'is', null);
    
    const existingUrls = new Set(existingGarments?.map(g => g.source_url) || []);

    console.log(`Processing ${urls.length} URLs for user ${user.id}`);

    const results: ImportResult[] = [];

    // Process URLs sequentially to avoid timeouts
    for (const url of urls) {
      const trimmedUrl = url.trim();
      
      // Skip empty
      if (!trimmedUrl) {
        continue;
      }
      
      console.log(`Processing: ${trimmedUrl}`);

      // Check for duplicates
      if (existingUrls.has(trimmedUrl)) {
        results.push({
          url: trimmedUrl,
          status: 'failed',
          reason: 'Redan importerad',
        });
        continue;
      }

      // SSRF check
      const ssrfCheck = isBlockedUrl(trimmedUrl);
      if (ssrfCheck.blocked) {
        results.push({
          url: trimmedUrl,
          status: 'failed',
          reason: ssrfCheck.reason || 'Blockerad URL',
        });
        continue;
      }

      try {
        // Fetch the page HTML
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const pageResponse = await fetch(trimmedUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; WardrobeBot/1.0; +https://example.com/bot)',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'sv,en;q=0.9',
          },
        });
        
        clearTimeout(timeoutId);

        if (!pageResponse.ok) {
          results.push({
            url: trimmedUrl,
            status: 'failed',
            reason: `HTTP ${pageResponse.status}`,
          });
          continue;
        }

        const html = await pageResponse.text();
        
        // Extract metadata
        const metadata = extractMetadata(html, trimmedUrl);
        
        if (!metadata.imageUrl) {
          results.push({
            url: trimmedUrl,
            status: 'failed',
            reason: 'Ingen bild hittades',
          });
          continue;
        }

        // SSRF check on image URL
        const imageSSRFCheck = isBlockedUrl(metadata.imageUrl);
        if (imageSSRFCheck.blocked) {
          results.push({
            url: trimmedUrl,
            status: 'failed',
            reason: 'Bild-URL blockerad',
          });
          continue;
        }

        // Download the image
        const imageResult = await downloadImage(metadata.imageUrl);
        
        if (!imageResult) {
          results.push({
            url: trimmedUrl,
            status: 'failed',
            reason: 'Kunde inte ladda ner bilden',
          });
          continue;
        }

        // Generate garment ID and path
        const garmentId = crypto.randomUUID();
        const ext = getExtensionFromContentType(imageResult.contentType);
        const imagePath = `${user.id}/${garmentId}.${ext}`;

        // Upload to storage
        const { error: uploadError } = await supabaseAdmin.storage
          .from('garments')
          .upload(imagePath, imageResult.data, {
            contentType: imageResult.contentType,
            upsert: false,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          results.push({
            url: trimmedUrl,
            status: 'failed',
            reason: 'Kunde inte spara bilden',
          });
          continue;
        }

        // Create garment record with minimal required fields
        const title = metadata.title || 'Importerat plagg';
        
        const { error: insertError } = await supabaseAdmin
          .from('garments')
          .insert({
            id: garmentId,
            user_id: user.id,
            image_path: imagePath,
            title: title.substring(0, 200), // Limit title length
            category: 'top', // Default category, user can edit
            color_primary: 'grå', // Default, user can edit
            source_url: trimmedUrl,
            imported_via: 'link',
          });

        if (insertError) {
          console.error('Insert error:', insertError);
          // Try to clean up uploaded image
          await supabaseAdmin.storage.from('garments').remove([imagePath]);
          
          results.push({
            url: trimmedUrl,
            status: 'failed',
            reason: 'Kunde inte spara plagget',
          });
          continue;
        }

        // Add to existing URLs set to prevent duplicates within same batch
        existingUrls.add(trimmedUrl);

        // Success!
        results.push({
          url: trimmedUrl,
          status: 'ok',
          garment_id: garmentId,
          title,
          image_path: imagePath,
        });

        console.log(`Successfully imported: ${title}`);

      } catch (error: any) {
        console.error(`Error processing ${trimmedUrl}:`, error);
        
        let reason = 'Okänt fel';
        if (error.name === 'AbortError') {
          reason = 'Timeout - sidan svarade inte';
        } else if (error.message) {
          reason = error.message.substring(0, 100);
        }
        
        results.push({
          url: trimmedUrl,
          status: 'failed',
          reason,
        });
      }
    }

    const successCount = results.filter(r => r.status === 'ok').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    console.log(`Import complete: ${successCount} success, ${failedCount} failed`);

    return new Response(
      JSON.stringify({ 
        results,
        summary: {
          total: results.length,
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
      JSON.stringify({ error: error.message || 'Internt serverfel' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
