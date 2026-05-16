/**
 * Render prompt builder — pure prompt assembly + retry-variant strategy.
 *
 * Extracted from `supabase/functions/render_garment_image/index.ts` so the
 * prompt-construction logic is unit-testable without pulling in the
 * function entrypoint or supabase-js. The handler still owns the Gemini
 * call, credit ledger, and garment-state writes.
 *
 * Retry variants (Wave 3-B P17):
 *   - 'primary'   : full-fidelity, all metadata, category-specific framing
 *   - 'tightened' : essentials + doubled-down "garment only" guard, used
 *                   after a mannequin/category reject
 *   - 'minimal'   : reference image is the only steering signal, used when
 *                   richer prompts may be over-constraining Gemini
 */

import { classifyCategory, type CategoryClass } from "./render-category.ts";
import { mannequinPresentationInstruction } from "./mannequin-presentation.ts";
import { validateOutputImage } from "./render-validator.ts";

export type MannequinPresentation = "male" | "female" | "mixed";

export type PromptVariant = "primary" | "tightened" | "minimal";

export const RETRY_VARIANTS: readonly PromptVariant[] = ["primary", "tightened", "minimal"];

export type RenderPromptEnrichment = {
  neckline: string | null;
  sleeveLength: string | null;
  garmentLength: string | null;
  closure: string | null;
  fabricWeight: string | null;
  silhouette: string | null;
  drape: string | null;
  hemDetail: string | null;
  rise: string | null;
  legShape: string | null;
  textOnGarment: string | null;
  logoDescription: string | null;
  graphicDescription: string | null;
  collarStyle: string | null;
  constructionDetails: string | null;
  waistband: string | null;
  colorDescription: string | null;
  shoulderStructure: string | null;
  textureIntensity: string | null;
  visualWeight: string | null;
  occasionTags: string[] | null;
  styleArchetype: string | null;
};

export type GarmentForPrompt = {
  title: string;
  category: string;
  subcategory: string | null;
  color_primary: string;
  color_secondary: string | null;
  material: string | null;
  pattern: string | null;
  fit: string | null;
  formality: number | null;
  ai_raw: unknown;
};

export const NEGATIVE_BRANDING_PATTERNS: readonly RegExp[] = [
  /^none$/i,
  /^no\b/i,
  /^not\b/i,
  /^absent$/i,
  /^n\/?a$/i,
  /^plain$/i,
  /^nothing\b/i,
  /^blank$/i,
  /^empty$/i,
];

export function normalizeMetadataValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized === "null" || normalized === "unknown" || normalized === "n/a") return null;
  return normalized;
}

export function sanitizeEnrichmentValue(value: string | null | undefined): string | null {
  if (!value) return null;
  return value
    .replace(/[\r\n\t]/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export function formalityLabel(score: number): string {
  if (score <= 1) return "very casual";
  if (score <= 2) return "casual";
  if (score <= 3) return "smart casual";
  if (score <= 4) return "semi-formal";
  return "formal";
}

export function extractPromptEnrichment(aiRaw: unknown): RenderPromptEnrichment {
  const raw = aiRaw && typeof aiRaw === "object" && !Array.isArray(aiRaw)
    ? aiRaw as Record<string, unknown>
    : null;
  const enrichment = raw?.enrichment && typeof raw.enrichment === "object" && !Array.isArray(raw.enrichment)
    ? raw.enrichment as Record<string, unknown>
    : null;

  return {
    neckline: normalizeMetadataValue(enrichment?.neckline),
    sleeveLength: normalizeMetadataValue(enrichment?.sleeve_length),
    garmentLength: normalizeMetadataValue(enrichment?.garment_length),
    closure: normalizeMetadataValue(enrichment?.closure),
    fabricWeight: normalizeMetadataValue(enrichment?.fabric_weight),
    silhouette: normalizeMetadataValue(enrichment?.silhouette),
    drape: normalizeMetadataValue(enrichment?.drape),
    hemDetail: normalizeMetadataValue(enrichment?.hem_detail),
    rise: normalizeMetadataValue(enrichment?.rise),
    legShape: normalizeMetadataValue(enrichment?.leg_shape),
    textOnGarment: normalizeMetadataValue(enrichment?.text_on_garment),
    logoDescription: normalizeMetadataValue(enrichment?.logo_description),
    graphicDescription: normalizeMetadataValue(enrichment?.graphic_or_print_description),
    collarStyle: normalizeMetadataValue(enrichment?.collar_style),
    constructionDetails: normalizeMetadataValue(enrichment?.construction_details),
    waistband: normalizeMetadataValue(enrichment?.waistband),
    colorDescription: normalizeMetadataValue(enrichment?.color_description),
    shoulderStructure: normalizeMetadataValue(enrichment?.shoulder_structure),
    textureIntensity: normalizeMetadataValue(enrichment?.texture_intensity),
    visualWeight: normalizeMetadataValue(enrichment?.visual_weight),
    occasionTags: Array.isArray(enrichment?.occasion_tags)
      ? (enrichment?.occasion_tags as unknown[]).filter((t): t is string => typeof t === "string")
      : null,
    styleArchetype: normalizeMetadataValue(enrichment?.style_archetype),
  };
}

export function isPositiveBrandingValue(value: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !NEGATIVE_BRANDING_PATTERNS.some((re) => re.test(trimmed));
}

export function sourceHasBranding(aiRaw: unknown): boolean {
  const enrichment = extractPromptEnrichment(aiRaw);
  return (
    isPositiveBrandingValue(sanitizeEnrichmentValue(enrichment.textOnGarment))
    || isPositiveBrandingValue(sanitizeEnrichmentValue(enrichment.logoDescription))
    || isPositiveBrandingValue(sanitizeEnrichmentValue(enrichment.graphicDescription))
  );
}

export function buildCategoryFraming(
  categoryClass: CategoryClass,
  mannequinPresentation: MannequinPresentation,
): { hardRequirements: string[]; negativeRequirements: string[] } {
  switch (categoryClass) {
    case "ghost_mannequin":
      return {
        hardRequirements: [
          "- Convert the garment into a garment-only ghost mannequin / shadow mannequin product render",
          `- ${mannequinPresentationInstruction(mannequinPresentation)}`,
          "- The final image must show the garment only: no visible mannequin head, no neck, no shoulders, no torso, no hips, no arms, no hands, no legs, no feet",
          "- Internal shaping must be subtle, driven purely by natural garment volume and gravity",
        ],
        negativeRequirements: [
          "- No visible mannequin anatomy silhouette",
          "- No person, body parts, or hands",
        ],
      };
    case "shoes":
      return {
        hardRequirements: [
          "- Photograph the shoe (or pair) at a clean 3/4 angle with the side profile visible",
          "- Shoes rest on the pure white background — no feet, no legs, no person, no mannequin",
          "- Laces, straps, and closures should be naturally settled (not squashed, not knotted tightly)",
        ],
        negativeRequirements: [
          "- NEVER place the shoe on a foot, leg, or person",
          "- No mannequin, no display stand that reads as anatomy",
        ],
      };
    case "bag":
      return {
        hardRequirements: [
          "- Photograph the bag front-on with the handle or strap naturally positioned",
          "- Show the front panel clearly; if the bag has a clear front/back asymmetry, favor the more branded side",
          "- No person, no hand holding it, no shoulder, no torso",
        ],
        negativeRequirements: [
          "- No person or body parts touching or wearing the bag",
          "- No props, no other garments",
        ],
      };
    case "flat_lay":
      return {
        hardRequirements: [
          "- Styled flat-lay: the accessory arranged aesthetically against pure white",
          "- Keep the item unfolded / unrolled enough that its shape is recognizable",
        ],
        negativeRequirements: [
          "- No person, no body parts (no neck, no head, no wrist, no fingers)",
          "- No mannequin, no display form",
        ],
      };
    case "jewelry":
      return {
        hardRequirements: [
          "- Close-up product shot against pure white with soft directional studio lighting",
          "- Frame tight enough to show material and craftsmanship detail; crisp focus",
          "- No body parts (no ring on finger, no necklace on neck, no watch on wrist, no earring on ear)",
        ],
        negativeRequirements: [
          "- No person, skin, or body parts visible",
          "- No fabric/model backdrop — only pure white",
        ],
      };
    case "accessory_generic":
    default:
      return {
        hardRequirements: [
          "- Clean product-catalog shot against pure white",
          "- Show the accessory alone in its natural resting shape",
        ],
        negativeRequirements: [
          "- No person, no body parts, no mannequin",
          "- No other garments or props",
        ],
      };
  }
}

export function buildGarmentRenderPrompt(
  garment: GarmentForPrompt,
  mannequinPresentation: MannequinPresentation,
  variant: PromptVariant = "primary",
  maskedInput = false,
): string {
  const categoryClass = classifyCategory(garment.category, garment.subcategory);
  const enrichment = extractPromptEnrichment(garment.ai_raw);

  const garmentLabel = garment.subcategory ?? garment.category ?? garment.title;
  const leadLine = `Subject: a ${garmentLabel}${garment.color_primary ? ` in ${garment.color_primary}` : ""}${garment.material ? `, ${garment.material}` : ""}.`;

  if (variant === "minimal") {
    const { hardRequirements, negativeRequirements } = buildCategoryFraming(categoryClass, mannequinPresentation);
    return [
      leadLine,
      "Premium studio product photography against a pure white background.",
      maskedInput
        ? "The reference image has been pre-segmented onto a transparent background. Use it as the source of truth and focus on lighting and product framing — do NOT re-remove the background."
        : "Use the reference image as the source of truth.",
      "Hard requirements:",
      "- Produce exactly one photorealistic product image",
      "- FIDELITY FIRST: match the colors, shape, pattern, and material texture of the reference",
      "- Preserve any logos, printed text, or graphics exactly as they appear",
      ...hardRequirements,
      "Negative requirements:",
      "- No watermarks, captions, or external overlays",
      "- No additional garments or props",
      ...negativeRequirements,
      "- Return only the edited image",
    ].join("\n");
  }

  const metadataLines = [
    garment.subcategory ? `- Subcategory: ${garment.subcategory}` : null,
    garment.color_primary ? `- Primary color: ${garment.color_primary}` : null,
    garment.color_secondary ? `- Secondary color: ${garment.color_secondary}` : null,
    garment.pattern && garment.pattern !== "solid" ? `- Pattern or print: ${garment.pattern}` : null,
    garment.material ? `- Material or fabric: ${garment.material}` : null,
    garment.fit ? `- Fit: ${garment.fit}` : null,
    enrichment.silhouette ? `- Silhouette: ${enrichment.silhouette}` : null,
    enrichment.sleeveLength ? `- Sleeve length: ${enrichment.sleeveLength}` : null,
    enrichment.neckline ? `- Collar or neckline: ${enrichment.neckline}` : null,
    enrichment.closure ? `- Closure: ${enrichment.closure}` : null,
    enrichment.fabricWeight ? `- Fabric weight: ${enrichment.fabricWeight}` : null,
    enrichment.garmentLength ? `- Garment length: ${enrichment.garmentLength}` : null,
    enrichment.rise ? `- Rise: ${enrichment.rise}` : null,
    enrichment.legShape ? `- Leg shape: ${enrichment.legShape}` : null,
    enrichment.drape ? `- Drape: ${enrichment.drape}` : null,
    enrichment.hemDetail ? `- Hem detail: ${enrichment.hemDetail}` : null,
    sanitizeEnrichmentValue(enrichment.textOnGarment) ? `- Text on garment (reproduce EXACTLY): ${sanitizeEnrichmentValue(enrichment.textOnGarment)}` : null,
    sanitizeEnrichmentValue(enrichment.logoDescription) ? `- Logo or brand mark (reproduce EXACTLY): ${sanitizeEnrichmentValue(enrichment.logoDescription)}` : null,
    sanitizeEnrichmentValue(enrichment.graphicDescription) ? `- Graphic or print (reproduce EXACTLY): ${sanitizeEnrichmentValue(enrichment.graphicDescription)}` : null,
    enrichment.collarStyle ? `- Collar style: ${enrichment.collarStyle}` : null,
    sanitizeEnrichmentValue(enrichment.constructionDetails) ? `- Construction details: ${sanitizeEnrichmentValue(enrichment.constructionDetails)}` : null,
    enrichment.waistband ? `- Waistband: ${enrichment.waistband}` : null,
    sanitizeEnrichmentValue(enrichment.colorDescription) ? `- Precise color: ${sanitizeEnrichmentValue(enrichment.colorDescription)}` : null,
    enrichment.shoulderStructure ? `- Shoulder structure: ${enrichment.shoulderStructure}` : null,
    enrichment.textureIntensity ? `- Texture intensity: ${enrichment.textureIntensity}` : null,
    enrichment.visualWeight ? `- Visual weight: ${enrichment.visualWeight}` : null,
    enrichment.styleArchetype ? `- Style archetype: ${enrichment.styleArchetype}` : null,
    enrichment.occasionTags && enrichment.occasionTags.length > 0
      ? `- Occasion context: ${enrichment.occasionTags.join(", ")}`
      : null,
    garment.formality != null ? `- Formality: ${formalityLabel(garment.formality)} (${garment.formality}/5)` : null,
  ].filter((value): value is string => Boolean(value));

  const { hardRequirements, negativeRequirements } = buildCategoryFraming(categoryClass, mannequinPresentation);

  const tightenedEmphasis = variant === "tightened"
    ? [
      "CRITICAL CORRECTION FROM PRIOR ATTEMPT:",
      "- No body part, no anatomy, no mannequin form is allowed under the garment — even faintly.",
      "- The rendered item must be the same category as the reference; do NOT invent a different product type.",
      "- Keep the reference image's logos, printed text, and graphics completely intact.",
      "",
    ]
    : [];

  const backgroundRemovalLine = maskedInput
    ? "- The reference image is already on a transparent background. Use it as-is; do NOT re-remove background, body, or anatomy."
    : "- Remove the person, body, skin, hair, hands, mannequin, hanger, props, and original background completely.";

  return [
    leadLine,
    "Create exactly one premium studio e-commerce product photograph.",
    maskedInput
      ? "The reference image has been pre-segmented onto a transparent background. Use it as the source of truth — its silhouette and color are authoritative. Metadata is only a steering hint when it matches the image."
      : "Use the reference image as the source of truth. Metadata is only a steering hint when it matches the image.",
    ...tightenedEmphasis,
    metadataLines.length > 0
      ? ["Confirmed details (use when visible in the reference):", ...metadataLines].join("\n")
      : "No extra metadata is available beyond the reference image.",
    "Hard requirements:",
    "- Show one item only",
    "- FIDELITY IS THE HIGHEST PRIORITY. Reproduce the item EXACTLY as it appears in the reference: color, silhouette, proportion, texture, pattern, construction detail.",
    "- REPRODUCE ALL LOGOS, TEXT, GRAPHICS, AND BRAND MARKS EXACTLY. Same position, same size, same color, same font. Never remove, alter, or re-style garment branding.",
    "- Reconstruct hidden or occluded areas only as needed to complete the item naturally.",
    backgroundRemovalLine,
    "- Center the subject with clean soft catalog lighting on a pure white background.",
    "- Make the result commercially usable and photorealistic.",
    ...hardRequirements,
    "Negative requirements:",
    "- No extra garments, no layering, no duplicate pieces",
    "- No redesign, no embellishment, no color shift, no silhouette change, no invented details",
    "- No external text overlays, watermarks, photographer credits, or post-production labels NOT part of the item itself",
    "- No packaging, accessories, or decorative props that are not part of the item",
    "- Do NOT remove logos, brand names, printed text, or graphics that are part of the item design",
    "- No color shift — match the exact color from the reference photo, not a generic version of that color name",
    "- No simplification — do not smooth out distinctive construction details, stitching, or seams",
    ...negativeRequirements,
    "- Return only the edited image",
  ].join("\n");
}

export type RetryAttemptOutcome =
  | { ok: true; outputBytes: Uint8Array; outputMimeType: string; variant: PromptVariant }
  | { ok: false; errorCode: string; errorMessage: string; validationDecision?: string };

export type GeminiGenerateFn = (args: {
  prompt: string;
  variant: PromptVariant;
  attemptIndex: number;
}) => Promise<
  | { ok: true; outputBytes: Uint8Array; outputMimeType: string }
  | { ok: false; errorCode: string; errorMessage: string; bubble?: boolean }
>;

export type ValidatorFn = (args: {
  outputBytes: Uint8Array;
  outputMimeType: string;
  variant: PromptVariant;
  attemptIndex: number;
}) => Promise<
  | { ok: true }
  | { ok: false; errorCode: string; errorMessage: string; validationDecision?: string }
>;

export type StructuralValidatorFn = (
  bytes: Uint8Array,
) => { ok: true } | { ok: false; errorCode: string; errorMessage: string };

export const defaultStructuralValidator: StructuralValidatorFn = (bytes) => {
  const r = validateOutputImage(bytes);
  if (r.ok) return { ok: true };
  return { ok: false, errorCode: r.code, errorMessage: r.message };
};

export type RetryRejectionInfo = {
  variant: PromptVariant;
  attemptIndex: number;
  stage: "structural";
  errorCode: string;
  errorMessage: string;
  outputBytes: Uint8Array;
};

export async function runRenderRetryChain(args: {
  garment: GarmentForPrompt;
  mannequinPresentation: MannequinPresentation;
  maskedInput: boolean;
  generate: GeminiGenerateFn;
  validateContent: ValidatorFn;
  validateStructural?: StructuralValidatorFn;
  onAttemptRejected?: (info: RetryRejectionInfo) => void;
}): Promise<RetryAttemptOutcome> {
  const structural = args.validateStructural ?? defaultStructuralValidator;
  let lastFailure: RetryAttemptOutcome & { ok: false } | null = null;
  for (let attemptIndex = 0; attemptIndex < RETRY_VARIANTS.length; attemptIndex++) {
    const variant = RETRY_VARIANTS[attemptIndex];
    const prompt = buildGarmentRenderPrompt(args.garment, args.mannequinPresentation, variant, args.maskedInput);

    const gen = await args.generate({ prompt, variant, attemptIndex });
    if (!gen.ok) {
      if (gen.bubble) {
        throw Object.assign(new Error(gen.errorMessage), { code: gen.errorCode });
      }
      lastFailure = { ok: false, errorCode: gen.errorCode, errorMessage: gen.errorMessage };
      continue;
    }

    const struct = structural(gen.outputBytes);
    if (!struct.ok) {
      // Per-attempt structural rejection log — preserves the observability the
      // original retry loop emitted (`bad magic bytes` / `output too small` /
      // `output too large` / `output dims too low`). The handler attaches
      // garmentId via the callback so the chain itself stays context-agnostic.
      args.onAttemptRejected?.({
        variant,
        attemptIndex,
        stage: "structural",
        errorCode: struct.errorCode,
        errorMessage: struct.errorMessage,
        outputBytes: gen.outputBytes,
      });
      lastFailure = { ok: false, errorCode: struct.errorCode, errorMessage: struct.errorMessage };
      continue;
    }

    const content = await args.validateContent({
      outputBytes: gen.outputBytes,
      outputMimeType: gen.outputMimeType,
      variant,
      attemptIndex,
    });
    if (!content.ok) {
      lastFailure = {
        ok: false,
        errorCode: content.errorCode,
        errorMessage: content.errorMessage,
        validationDecision: content.validationDecision,
      };
      continue;
    }

    return { ok: true, outputBytes: gen.outputBytes, outputMimeType: gen.outputMimeType, variant };
  }
  return lastFailure ?? {
    ok: false,
    errorCode: "retry_chain_no_attempts",
    errorMessage: "Retry chain produced no attempts.",
  };
}
