import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI } from "../_shared/burs-ai.ts";

import { allowedOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface DuplicateRequest {
  image_path?: string;
  category?: string;
  color_primary?: string;
  title?: string;
  subcategory?: string;
  material?: string;
  exclude_garment_id?: string; // exclude the garment being checked
}

interface DuplicateMatch {
  garment_id: string;
  title: string;
  image_path: string;
  confidence: number; // 0-1
  match_type: 'attribute' | 'visual' | 'both';
  reasons: string[];
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

    const body = await req.json() as DuplicateRequest;
    const { image_path, category, color_primary, title, subcategory, material, exclude_garment_id } = body;

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Attribute matching — fetch user's existing garments
    let query = serviceClient
      .from('garments')
      .select('id, title, image_path, category, color_primary, color_secondary, subcategory, material, pattern')
      .eq('user_id', userId)
      .limit(200);

    if (exclude_garment_id) {
      query = query.neq('id', exclude_garment_id);
    }

    const { data: existingGarments, error: fetchError } = await query;
    if (fetchError) {
      console.error('Fetch garments error:', fetchError);
      return new Response(
        JSON.stringify({ duplicates: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!existingGarments || existingGarments.length === 0) {
      return new Response(
        JSON.stringify({ duplicates: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Score attribute similarity
    const attributeMatches: { garment: typeof existingGarments[0]; score: number; reasons: string[] }[] = [];

    for (const garment of existingGarments) {
      let score = 0;
      const reasons: string[] = [];

      if (category && garment.category === category) {
        score += 0.25;
        reasons.push('same_category');
      }
      if (color_primary && garment.color_primary === color_primary) {
        score += 0.25;
        reasons.push('same_color');
      }
      if (subcategory && garment.subcategory && garment.subcategory.toLowerCase() === subcategory.toLowerCase()) {
        score += 0.2;
        reasons.push('same_subcategory');
      }
      if (material && garment.material && garment.material.toLowerCase() === material.toLowerCase()) {
        score += 0.15;
        reasons.push('same_material');
      }
      if (title && garment.title) {
        const titleSimilarity = computeTitleSimilarity(title.toLowerCase(), garment.title.toLowerCase());
        if (titleSimilarity > 0.6) {
          score += 0.15;
          reasons.push('similar_title');
        }
      }

      if (score >= 0.5) {
        attributeMatches.push({ garment, score, reasons });
      }
    }

    // Sort by score descending, take top 5
    attributeMatches.sort((a, b) => b.score - a.score);
    const topAttributeMatches = attributeMatches.slice(0, 5);

    // Step 2: If we have an image and attribute matches, use AI for visual comparison
    const duplicates: DuplicateMatch[] = [];

    if (image_path && topAttributeMatches.length > 0) {
      try {
        // Get signed URL for the new image
        const { data: newImageUrl } = await serviceClient.storage
          .from('garments')
          .createSignedUrl(image_path, 600);

        // Get signed URLs for candidate images
        const candidateUrls: { id: string; url: string; title: string; imagePath: string }[] = [];
        for (const match of topAttributeMatches) {
          const { data: url } = await serviceClient.storage
            .from('garments')
            .createSignedUrl(match.garment.image_path, 600);
          if (url?.signedUrl) {
            candidateUrls.push({
              id: match.garment.id,
              url: url.signedUrl,
              title: match.garment.title,
              imagePath: match.garment.image_path,
            });
          }
        }

        if (newImageUrl?.signedUrl && candidateUrls.length > 0) {
          const candidateList = candidateUrls.map((c, i) => `Candidate ${i + 1} (ID: ${c.id}): "${c.title}"`).join('\n');

          const { data: content } = await callBursAI({
            messages: [
              {
                role: 'system',
                content: `You compare garment images to detect duplicates. For each candidate, rate visual similarity to the new garment from 0.0 to 1.0.
Return ONLY valid JSON: { "matches": [{ "id": "garment-id", "similarity": 0.0-1.0 }] }
Consider: same garment photographed differently = 0.8+, very similar style/color = 0.5-0.7, different garment = 0.0-0.3.`
              },
              {
                role: 'user',
                content: [
                  { type: 'text', text: `Compare this new garment image against these candidates:\n${candidateList}\n\nRate visual similarity for each.` },
                  { type: 'image_url', image_url: { url: newImageUrl.signedUrl } },
                  ...candidateUrls.map(c => ({
                    type: 'image_url' as const,
                    image_url: { url: c.url }
                  }))
                ]
              }
            ],
            complexity: "trivial",
            max_tokens: 200,
            extraBody: { temperature: 0.1 },
            timeout: 20000,
          });

          try {
            const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
            const cleaned = contentStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(cleaned);

            if (parsed.matches && Array.isArray(parsed.matches)) {
              for (const aiMatch of parsed.matches) {
                const attrMatch = topAttributeMatches.find(m => m.garment.id === aiMatch.id);
                const candidateUrl = candidateUrls.find(c => c.id === aiMatch.id);

                if (attrMatch && candidateUrl) {
                  const visualSim = Math.min(1, Math.max(0, aiMatch.similarity || 0));
                  const combinedScore = Math.min(1, attrMatch.score * 0.4 + visualSim * 0.6);

                  if (combinedScore >= 0.45) {
                    duplicates.push({
                      garment_id: aiMatch.id,
                      title: attrMatch.garment.title,
                      image_path: candidateUrl.imagePath,
                      confidence: Math.round(combinedScore * 100) / 100,
                      match_type: visualSim >= 0.5 && attrMatch.score >= 0.5 ? 'both' : visualSim >= 0.5 ? 'visual' : 'attribute',
                      reasons: attrMatch.reasons,
                    });
                  }
                }
              }
            }
          } catch (parseErr) {
            console.error('Failed to parse AI duplicate response:', parseErr);
          }
        }
      } catch (aiErr) {
        console.error('AI duplicate detection error:', aiErr);
      }

      // If AI didn't run or failed, use attribute matches as fallback
      if (duplicates.length === 0) {
        for (const match of topAttributeMatches) {
          if (match.score >= 0.6) {
            duplicates.push({
              garment_id: match.garment.id,
              title: match.garment.title,
              image_path: match.garment.image_path,
              confidence: match.score,
              match_type: 'attribute',
              reasons: match.reasons,
            });
          }
        }
      }
    } else {
      // No image — attribute-only
      for (const match of topAttributeMatches) {
        if (match.score >= 0.6) {
          duplicates.push({
            garment_id: match.garment.id,
            title: match.garment.title,
            image_path: match.garment.image_path,
            confidence: match.score,
            match_type: 'attribute',
            reasons: match.reasons,
          });
        }
      }
    }

    // Sort by confidence
    duplicates.sort((a, b) => b.confidence - a.confidence);

    return new Response(
      JSON.stringify({ duplicates: duplicates.slice(0, 3) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ duplicates: [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Simple title similarity using word overlap
function computeTitleSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 1));
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 1));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
}
