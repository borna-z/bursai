import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  callBursAI,
  bursAIErrorResponse,
  estimateMaxTokens,
  filterEnrichedGarments,
  isEnrichmentReady,
} from "../_shared/burs-ai.ts";
import { classifySlot } from "../_shared/burs-slots.ts";
import { canBuildCompleteOutfitPath } from "../_shared/outfit-validation.ts";
import {
  colorFamily,
  formalityLabel,
  formalityToBand,
  type FormalityBand,
  type ColorFamily,
} from "../_shared/retrieval.ts";
import { CORS_HEADERS } from "../_shared/cors.ts";
import {
  enforceRateLimit,
  RateLimitError,
  rateLimitResponse,
  checkOverload,
  overloadResponse,
} from "../_shared/scale-guard.ts";

const RETRIEVAL_LIMIT = 40;
const ENRICHMENT_FILTER_THRESHOLD = 0.7;

type GarmentRow = {
  id: string;
  title: string | null;
  category: string | null;
  subcategory: string | null;
  color_primary: string | null;
  color_secondary: string | null;
  material: string | null;
  pattern: string | null;
  formality: number | null;
  fit: string | null;
  enrichment_status?: string | null;
  ai_raw?: Record<string, unknown> | null;
};

type ReferenceItem = {
  slot: string;
  garment: GarmentRow;
};

function aiRawField(g: GarmentRow, key: string): string | null {
  const raw = g.ai_raw;
  if (!raw || typeof raw !== "object") return null;
  const value = (raw as Record<string, unknown>)[key];
  if (value == null) return null;
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.length > 0).join(",") || null;
  }
  if (typeof value === "string") return value || null;
  if (typeof value === "number") return String(value);
  return null;
}

function describeGarmentForDNA(slot: string, g: GarmentRow): string {
  const parts: string[] = [];
  parts.push(`${slot}:${g.title || "(untitled)"}`);
  parts.push(g.color_primary || "?");
  parts.push(g.material || "?");
  parts.push(formalityLabel(g.formality ?? 3));

  const archetype = aiRawField(g, "style_archetype");
  if (archetype) parts.push(`arch:${archetype}`);

  const occasions = aiRawField(g, "occasion_tags");
  if (occasions) parts.push(`occ:${occasions}`);

  const versatility = aiRawField(g, "versatility_score");
  if (versatility) parts.push(`v:${versatility}`);

  const layering = aiRawField(g, "layering_role");
  if (layering) parts.push(`layer:${layering}`);

  return parts.join("|");
}

function describeCandidateForPrompt(g: GarmentRow, slot: string): string {
  const parts: string[] = [];
  parts.push(g.id);
  parts.push(g.title || "(untitled)");
  parts.push(slot);
  parts.push(g.color_primary || "?");
  parts.push(g.material || "?");
  parts.push(formalityLabel(g.formality ?? 3));

  const archetype = aiRawField(g, "style_archetype");
  if (archetype) parts.push(`arch:${archetype}`);

  const occasions = aiRawField(g, "occasion_tags");
  if (occasions) parts.push(`occ:${occasions}`);

  return parts.join("|");
}

type DNAProfile = {
  categories: Set<string>;
  colors: Set<ColorFamily>;
  formalityBand: FormalityBand | null;
  archetypes: Set<string>;
  occasions: Set<string>;
};

function extractDNAProfile(reference: ReferenceItem[]): DNAProfile {
  const profile: DNAProfile = {
    categories: new Set(),
    colors: new Set(),
    formalityBand: null,
    archetypes: new Set(),
    occasions: new Set(),
  };

  const formalities: number[] = [];
  for (const { slot, garment } of reference) {
    if (slot) profile.categories.add(slot);
    for (const fam of colorFamily(garment.color_primary)) profile.colors.add(fam);
    for (const fam of colorFamily(garment.color_secondary)) profile.colors.add(fam);
    if (typeof garment.formality === "number") formalities.push(garment.formality);

    const archetype = aiRawField(garment, "style_archetype");
    if (archetype) {
      for (const part of archetype.split(",").map((s) => s.trim()).filter(Boolean)) {
        profile.archetypes.add(part.toLowerCase());
      }
    }
    const occasions = aiRawField(garment, "occasion_tags");
    if (occasions) {
      for (const part of occasions.split(",").map((s) => s.trim()).filter(Boolean)) {
        profile.occasions.add(part.toLowerCase());
      }
    }
  }

  if (formalities.length > 0) {
    const avg = formalities.reduce((a, b) => a + b, 0) / formalities.length;
    profile.formalityBand = formalityToBand(Math.round(avg));
  }

  return profile;
}

function scoreCandidate(g: GarmentRow, slot: string, profile: DNAProfile): number {
  let score = 0;

  // Category overlap — reference outfit's slots get 2.0x weight
  if (profile.categories.has(slot)) score += 2.0;

  // Color family overlap — candidate and reference both multi-family; any overlap wins
  const candidateColors = colorFamily(g.color_primary);
  if (candidateColors.some((fam) => profile.colors.has(fam))) score += 1.5;

  // Formality band match — exact match full credit, adjacent band partial.
  // When reference has no formality signal at all (null), skip the gate.
  if (profile.formalityBand !== null) {
    const candidateBand = formalityToBand(g.formality ?? 3);
    if (candidateBand === profile.formalityBand) {
      score += 1.5;
    } else if (candidateBand === "mid" || profile.formalityBand === "mid") {
      score += 0.75;
    }
  }

  // Style archetype overlap
  const candArchetype = (aiRawField(g, "style_archetype") || "").toLowerCase();
  if (candArchetype) {
    for (const a of profile.archetypes) {
      if (candArchetype.includes(a)) {
        score += 1.0;
        break;
      }
    }
  }

  // Occasion tags overlap
  const candOccasions = (aiRawField(g, "occasion_tags") || "").toLowerCase();
  if (candOccasions) {
    for (const occ of profile.occasions) {
      if (candOccasions.includes(occ)) {
        score += 0.75;
        break;
      }
    }
  }

  return score;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  if (checkOverload("clone_outfit_dna")) {
    return overloadResponse(CORS_HEADERS);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user) throw new Error("Unauthorized");
    const user = { id: userData.user.id };

    await enforceRateLimit(serviceClient, user.id, "clone_outfit_dna");

    const { outfit_id, locale = "en" } = await req.json();
    if (!outfit_id) throw new Error("Missing outfit_id");

    const LOCALE_NAMES: Record<string, string> = {
      sv: "Svenska", en: "English", no: "Norsk", da: "Dansk", fi: "Suomi",
      de: "Deutsch", fr: "Français", es: "Español", it: "Italiano",
      pt: "Português", nl: "Nederlands", pl: "Polski",
      ar: "العربية", fa: "فارسی",
    };
    const langName = LOCALE_NAMES[locale] || "English";

    // Parallel DB queries — reference outfit + user's wardrobe.
    // P27: SELECT expanded to include subcategory + ai_raw + enrichment_status
    //      so the DNA extraction can pull style_archetype / occasion_tags /
    //      versatility_score / layering_role, and so we can gate on enrichment.
    const [outfitRes, allGarmentsRes] = await Promise.all([
      serviceClient
        .from("outfits")
        .select("*, outfit_items(slot, garment_id, garments:garment_id(id, title, category, subcategory, color_primary, color_secondary, material, pattern, formality, fit, ai_raw, enrichment_status))")
        .eq("id", outfit_id)
        .eq("user_id", user.id)
        .single(),
      serviceClient
        .from("garments")
        .select("id, title, category, subcategory, color_primary, color_secondary, material, pattern, formality, fit, enrichment_status, ai_raw, in_laundry")
        .eq("user_id", user.id)
        .eq("in_laundry", false),
    ]);

    const outfit = outfitRes.data;
    if (outfitRes.error || !outfit) throw new Error("Outfit not found");

    // P26: resolve real slot via classifySlot — falls back to the stored
    // outfit_items.slot only when classification returns null. Stored slot
    // can be stale after a garment's category/subcategory was re-labeled.
    const referenceItems: ReferenceItem[] = [];
    for (const item of outfit.outfit_items as Array<{ slot?: string | null; garment_id?: string; garments?: GarmentRow }>) {
      const g = item.garments;
      if (!g) continue;
      const slot = classifySlot(g.category, g.subcategory) || item.slot || "unknown";
      referenceItems.push({ slot, garment: g });
    }

    if (referenceItems.length === 0) throw new Error("Reference outfit has no garments");

    const dnaProfile = extractDNAProfile(referenceItems);
    const outfitDNA = referenceItems.map(({ slot, garment }) => describeGarmentForDNA(slot, garment)).join("\n");

    // Candidate wardrobe — exclude reference outfit's own garments.
    const referenceIds = new Set(referenceItems.map((r) => r.garment.id));
    const wardrobe = (allGarmentsRes.data || []).filter((g: GarmentRow) => !referenceIds.has(g.id)) as GarmentRow[];

    // P24: gate on enrichment when the wardrobe is mostly enriched. Below the
    // threshold we send what we have — graceful degrade instead of an empty
    // payload that would force Gemini to hallucinate. Uses isEnrichmentReady
    // so we accept both 'complete' (frontend writers) and 'completed' (job
    // queue) — the canonical P24 dual-spelling handling.
    const enrichedCount = wardrobe.filter((g) => isEnrichmentReady(g.enrichment_status)).length;
    const enrichmentRatio = wardrobe.length > 0 ? enrichedCount / wardrobe.length : 0;
    const gatedWardrobe = enrichmentRatio >= ENRICHMENT_FILTER_THRESHOLD
      ? filterEnrichedGarments(wardrobe)
      : wardrobe;

    // Pre-filter: score candidates against the reference DNA profile and cap
    // at top-40. Stable sort — ties preserve wardrobe order.
    const scoredPool = gatedWardrobe
      .map((g, idx) => {
        const slot = classifySlot(g.category, g.subcategory) || "unknown";
        return { g, slot, score: scoreCandidate(g, slot, dnaProfile), idx };
      })
      .sort((a, b) => (b.score - a.score) || (a.idx - b.idx));
    const initialTop = scoredPool.slice(0, RETRIEVAL_LIMIT);
    const ranked = [...initialTop];

    // Slot-coverage guarantee (mirror of the Codex P1 fix shipped in mood_outfit
    // for PR #664). A wardrobe that skews heavily toward one category (e.g.
    // 35 tops + 3 bottoms + 2 shoes scoring low) can see the top-40 drop every
    // shoe / bottom / dress. Prompt rule #1 then asks for complete outfits from
    // a subset that can't produce one. Greedy-extend the prompt with next-best
    // scored candidates, then with the FULL wardrobe (including non-enriched
    // items) as final fallback, until a complete path exists. Worst case adds
    // a handful of items — max_tokens is dynamic so the budget tracks.
    //
    // Codex P1 on PR #665: the fallback pool MUST be the full `wardrobe`, not
    // `gatedWardrobe`. When the enrichment gate is active and the only candidate
    // for a missing slot happens to be unenriched, gatedWardrobe has already
    // excluded it — the recovery loop would silently iterate over the same
    // gated set already in scoredPool and fail to restore coverage.
    const seen = new Set(ranked.map((r) => r.g.id));
    if (!canBuildCompleteOutfitPath(ranked.map((r) => r.g))) {
      const overflow = scoredPool.slice(RETRIEVAL_LIMIT);
      for (const row of overflow) {
        if (seen.has(row.g.id)) continue;
        ranked.push(row);
        seen.add(row.g.id);
        if (canBuildCompleteOutfitPath(ranked.map((r) => r.g))) break;
      }
      if (!canBuildCompleteOutfitPath(ranked.map((r) => r.g))) {
        for (const g of wardrobe) {
          if (seen.has(g.id)) continue;
          const slot = classifySlot(g.category, g.subcategory) || "unknown";
          ranked.push({ g, slot, score: 0, idx: ranked.length });
          seen.add(g.id);
          if (canBuildCompleteOutfitPath(ranked.map((r) => r.g))) break;
        }
      }
    }

    // Outerwear coverage — Codex P2 on PR #665.
    // `canBuildCompleteOutfitPath` validates the base path (top+bottom+shoes OR
    // dress+shoes) but never requires outerwear. Prompt rule #1 asks for
    // outerwear whenever the reference includes it; if the pre-filter happens
    // to drop every outerwear row, the model must either hallucinate an ID or
    // violate the rule. When the reference has outerwear and the ranked pool
    // has none, greedy-add the best available outerwear — same precedence
    // chain (scoredPool overflow → full wardrobe) so we respect scoring first.
    const referenceHasOuterwear = referenceItems.some((r) => r.slot === "outerwear");
    if (referenceHasOuterwear && !ranked.some((r) => r.slot === "outerwear")) {
      const overflowOuter = scoredPool.slice(RETRIEVAL_LIMIT).find(
        (row) => row.slot === "outerwear" && !seen.has(row.g.id),
      );
      if (overflowOuter) {
        ranked.push(overflowOuter);
        seen.add(overflowOuter.g.id);
      } else {
        for (const g of wardrobe) {
          if (seen.has(g.id)) continue;
          const slot = classifySlot(g.category, g.subcategory) || "unknown";
          if (slot !== "outerwear") continue;
          ranked.push({ g, slot, score: 0, idx: ranked.length });
          seen.add(g.id);
          break;
        }
      }
      // If neither branch finds outerwear, the user genuinely has none in
      // their wardrobe — the model will produce a base outfit without
      // outerwear. Acceptable graceful degrade, same as mood_outfit handles
      // "no warm outerwear" wardrobes.
    }

    const availableGarments = ranked
      .map(({ g, slot }) => describeCandidateForPrompt(g, slot))
      .join("\n");

    const { data: result } = await callBursAI({
      complexity: "standard",
      max_tokens: estimateMaxTokens({
        inputItems: ranked.length,
        outputItems: 3,
        perItemTokens: 120,
        baseTokens: 200,
      }),
      functionName: "clone_outfit_dna",
      cacheTtlSeconds: 1800,
      // P13: user-scope prevents cross-user cache hits. userId also
      // populates ai_response_cache.user_id for the GDPR cascade delete.
      cacheNamespace: `clone_dna_${user.id}`,
      userId: user.id,
      messages: [
        {
          role: "system",
          content: `Fashion DNA analyst. User loves this reference outfit and wants 3 similar variations using DIFFERENT pieces from their wardrobe.

REFERENCE OUTFIT DNA (slot:title|color|material|formality|arch|occ|versatility|layering):
${outfitDNA}

Occasion: ${outfit.occasion}
Style: ${outfit.style_vibe || "casual"}
Reference formality band: ${dnaProfile.formalityBand ?? "mixed"}
Reference color palette: ${Array.from(dnaProfile.colors).join(", ") || "neutral"}
Reference style archetypes: ${Array.from(dnaProfile.archetypes).join(", ") || "n/a"}
Reference occasions: ${Array.from(dnaProfile.occasions).join(", ") || "n/a"}

AVAILABLE (id|title|slot|color|material|formality|arch|occ):
${availableGarments}

Rules:
1. Every variation MUST be a complete outfit — top+bottom+shoes OR dress+shoes. Include outerwear when the reference has it.
2. Preserve the DNA: formality band, color harmony, style archetype. Use DIFFERENT pieces, not the reference's own garments.
3. Return 3 distinct variations with clearly different pieces across them (don't repeat the same top in all three).
4. Pick garments by their full ID.
5. Respond in ${langName}.`,
        },
        { role: "user", content: "Generate 3 similar outfit variations." },
      ],
      tools: [{
        type: "function",
        function: {
          name: "suggest_variations",
          description: "Return 3 outfit variations",
          parameters: {
            type: "object",
            properties: {
              variations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    garment_ids: { type: "array", items: { type: "string" } },
                    explanation: { type: "string" },
                  },
                  required: ["name", "garment_ids", "explanation"],
                  additionalProperties: false,
                },
              },
            },
            required: ["variations"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "suggest_variations" } },
    }, serviceClient);

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return rateLimitResponse(e, CORS_HEADERS);
    }
    console.error("clone_outfit_dna error:", e);
    return bursAIErrorResponse(e, CORS_HEADERS);
  }
});
