export const PRODUCT_READY_RENDER_GATE_PROVIDER = 'skip-product-ready-v1';
const GEMINI_TEXT_MODEL = 'gemini-2.5-flash';
// `GEMINI_TEXT_URL_OVERRIDE` lets smoke-test mocks intercept the gate calls.
// Unset → identical to the original hardcoded Google endpoint below.
// `typeof Deno !== "undefined"` guards the module against non-Deno runtimes
// (Node/vitest unit tests that import this file transitively) where accessing
// `Deno.env` directly would throw `ReferenceError: Deno is not defined`.
const GEMINI_TEXT_API_URL = (typeof Deno !== "undefined" ? Deno.env.get("GEMINI_TEXT_URL_OVERRIDE") : undefined)
  ?? `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent`;

/**
 * Wave 3-B P19: bounded-latency fetch for the two text-gate calls. Text
 * calls are expected to complete in <5s; a 25s ceiling leaves headroom for
 * slow Gemini shards without letting the gate monopolize the caller's
 * overall budget. Unlike gemini-image-client, there's no retry loop here
 * — gate calls are short, the caller (render_garment_image) already does
 * retry orchestration at the prompt level, and a hung gate is better
 * treated as "fail open" (proceed / accept) at the caller than retried.
 */
const TEXT_GATE_TIMEOUT_MS = 25_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export type RenderEligibilityDecision = 'render' | 'skip_product_ready';
export type RenderOutputValidationDecision = 'accept' | 'reject_visible_mannequin' | 'reject_wrong_category' | 'reject_logo_missing';

export interface RenderEligibilityAssessment {
  decision: RenderEligibilityDecision;
  confidence: number | null;
  reason: string;
  signals: {
    singleGarment: boolean | null;
    multipleGarments: boolean | null;
    personOrBodyVisible: boolean | null;
    handsVisible: boolean | null;
    cleanPlainBackground: boolean | null;
    productPhotoFraming: boolean | null;
    alreadyProductReady: boolean | null;
    messyEnvironment: boolean | null;
  };
  raw: Record<string, unknown> | null;
}

export interface RenderOutputValidationAssessment {
  decision: RenderOutputValidationDecision;
  confidence: number | null;
  reason: string;
  signals: {
    garmentOnly: boolean | null;
    mannequinHeadVisible: boolean | null;
    mannequinNeckVisible: boolean | null;
    mannequinTorsoVisible: boolean | null;
    mannequinHipsVisible: boolean | null;
    limbsVisible: boolean | null;
    cleanBackground: boolean | null;
    ghostMannequinStyling: boolean | null;
    /** Wave 3-B F9: Gemini silently strips logos / text; we check for it. */
    logoOrTextPreserved: boolean | null;
    /** Wave 3-B P18: did Gemini render the RIGHT category? (shoe on mannequin = wrong) */
    correctCategory: boolean | null;
  };
  raw: Record<string, unknown> | null;
}

function clampConfidence(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asReason(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export async function assessRenderEligibilityWithGemini(opts: {
  apiKey: string;
  garmentId: string;
  mimeType: string;
  imageBase64: string;
}): Promise<RenderEligibilityAssessment | null> {
  const response = await fetchWithTimeout(GEMINI_TEXT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': opts.apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: [
                'Assess whether this single accepted garment image still needs BURS ghost-mannequin rendering.',
                'Return JSON only.',
                'Decision rules:',
                '- Choose skip_product_ready only when the image itself is already product-ready enough for wardrobe use.',
                '- Product-ready examples: ghost mannequin, shadow mannequin, clean e-commerce cutout, single garment on a plain clean background, no person/body/hands visible.',
                '- Choose render for worn garments, mirror selfies, visible body or hands, messy rooms, garments on beds/floors/chairs, multiple garments, lifestyle/model shots, or whenever uncertain.',
                '- Do not use source/import assumptions. Judge the actual pixels only.',
                '- If uncertain, choose render.',
                'Required schema:',
                '{"decision":"render|skip_product_ready","confidence":0.0,"reason":"short string","signals":{"single_garment":true,"multiple_garments":false,"person_or_body_visible":false,"hands_visible":false,"clean_plain_background":true,"product_photo_framing":true,"already_product_ready":true,"messy_environment":false}}',
              ].join('\n'),
            },
            {
              inlineData: {
                mimeType: opts.mimeType,
                data: opts.imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    }),
  }, TEXT_GATE_TIMEOUT_MS);

  if (!response.ok) {
    throw new Error(`Eligibility gate Gemini API error (${response.status}): ${await response.text()}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part?.text ?? '').join('')?.trim();
  if (!text) {
    throw new Error('Eligibility gate returned no JSON text');
  }

  const parsed = JSON.parse(text) as Record<string, unknown>;
  const signals = parsed.signals && typeof parsed.signals === 'object' && !Array.isArray(parsed.signals)
    ? parsed.signals as Record<string, unknown>
    : {};

  const decision: RenderEligibilityDecision = parsed.decision === 'skip_product_ready'
    ? 'skip_product_ready'
    : 'render';

  const assessment: RenderEligibilityAssessment = {
    decision,
    confidence: clampConfidence(parsed.confidence),
    reason: asReason(
      parsed.reason,
      decision === 'skip_product_ready'
        ? 'Source image already appears product-ready.'
        : 'Source image still needs mannequin rendering.',
    ),
    signals: {
      singleGarment: asBoolean(signals.single_garment),
      multipleGarments: asBoolean(signals.multiple_garments),
      personOrBodyVisible: asBoolean(signals.person_or_body_visible),
      handsVisible: asBoolean(signals.hands_visible),
      cleanPlainBackground: asBoolean(signals.clean_plain_background),
      productPhotoFraming: asBoolean(signals.product_photo_framing),
      alreadyProductReady: asBoolean(signals.already_product_ready),
      messyEnvironment: asBoolean(signals.messy_environment),
    },
    raw: parsed,
  };

  console.log('render_garment_image eligibility gate result', {
    garmentId: opts.garmentId,
    model: GEMINI_TEXT_MODEL,
    decision: assessment.decision,
    confidence: assessment.confidence,
    reason: assessment.reason,
    signals: assessment.signals,
  });

  return assessment;
}

/**
 * Wave 3-B P18 + F9: category-aware output validation.
 *
 * Categories fall into three presentation classes:
 *   - wearable (top/bottom/dress/outerwear) → ghost-mannequin: reject any
 *     visible anatomy under the garment
 *   - shoes → clean product shot: reject mannequin, feet, person
 *   - accessory variants (bag/hat/scarf/gloves/jewelry) → clean product
 *     shot: reject body parts underneath (e.g. hat on a head, ring on a finger)
 *
 * Also adds two new signals:
 *   - logoOrTextPreserved: catches Gemini's "helpful" stripping of branding
 *   - correctCategory: catches "rendered a shoe but put it on a torso"
 *
 * `expectGhostMannequin=false` paths check for product-photo cleanliness
 * instead of mannequin absence — the right frame for non-wearables.
 */
export async function validateRenderedGarmentOutputWithGemini(opts: {
  apiKey: string;
  garmentId: string;
  mimeType: string;
  imageBase64: string;
  /** Wave 3-B P18: category-specific validation strictness */
  category?: string | null;
  /** Wave 3-B P18: optional subcategory for accessory sub-routing */
  subcategory?: string | null;
  /** Wave 3-B F9: if the source had visible branding, validate preservation. */
  expectLogoOrText?: boolean;
}): Promise<RenderOutputValidationAssessment | null> {
  const category = (opts.category ?? '').toLowerCase();
  const subcategory = (opts.subcategory ?? '').toLowerCase();
  const expectLogoOrText = opts.expectLogoOrText === true;

  const GHOST_MANNEQUIN_CATEGORIES = ['top', 'tops', 'bottom', 'bottoms', 'dress', 'dresses', 'outerwear'];
  const expectGhostMannequin = GHOST_MANNEQUIN_CATEGORIES.includes(category);

  // Describe the expected presentation shape so Gemini's JSON decision
  // maps back to the right reject enum.
  let presentationDescription: string;
  let rejectionList: string[];
  if (expectGhostMannequin) {
    presentationDescription = 'ghost / shadow mannequin product imagery — garment shape with NO visible mannequin, body, head, neck, shoulders, torso, hips, arms, hands, legs, or feet underneath.';
    rejectionList = [
      'Reject with decision="reject_visible_mannequin" if ANY body part or mannequin structure is visible.',
      'Reject with decision="reject_wrong_category" if the rendered item is not the expected garment category.',
    ];
  } else if (category === 'shoes') {
    presentationDescription = 'clean product-catalog shoe photograph — single shoe or matched pair against pure white. NO person, NO feet, NO legs, NO mannequin visible.';
    rejectionList = [
      'Reject with decision="reject_visible_mannequin" if ANY foot, leg, or person is visible.',
      'Reject with decision="reject_wrong_category" if the rendered item is not shoes (e.g. it rendered a shirt by mistake).',
    ];
  } else {
    // accessory / bag / hat / jewelry / watch / etc.
    presentationDescription = 'clean product-catalog accessory photograph against pure white — item alone with NO body parts (no head, neck, hands, wrist, fingers) visible underneath or supporting it.';
    rejectionList = [
      'Reject with decision="reject_visible_mannequin" if ANY person, body part, mannequin, or model is visible (including a head under a hat, a wrist under a watch, fingers through a ring).',
      'Reject with decision="reject_wrong_category" if the rendered item is not the expected accessory type.',
    ];
  }

  const logoInstruction = expectLogoOrText
    ? 'The source garment contains a logo, brand name, printed text, or graphic. If the rendered image is missing that branding — respond with decision="reject_logo_missing". Preserved branding that is stylized or re-rendered but clearly present is ACCEPTED.'
    : 'No logo/text preservation check needed (source did not contain branding).';

  const categoryLine = category ? `- Expected category: ${category}${subcategory ? ` (${subcategory})` : ''}` : '- Expected category: any garment';

  const response = await fetchWithTimeout(GEMINI_TEXT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': opts.apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: [
                'Validate whether this rendered product image is acceptable for the BURS wardrobe.',
                'Return JSON only.',
                categoryLine,
                `Accept only true ${presentationDescription}`,
                ...rejectionList,
                logoInstruction,
                'If uncertain on any rejection condition, prefer rejection over acceptance.',
                'Required schema:',
                '{"decision":"accept|reject_visible_mannequin|reject_wrong_category|reject_logo_missing","confidence":0.0,"reason":"short string","signals":{"garment_only":true,"mannequin_head_visible":false,"mannequin_neck_visible":false,"mannequin_torso_visible":false,"mannequin_hips_visible":false,"limbs_visible":false,"clean_background":true,"ghost_mannequin_styling":true,"logo_or_text_preserved":true,"correct_category":true}}',
              ].join('\n'),
            },
            {
              inlineData: {
                mimeType: opts.mimeType,
                data: opts.imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    }),
  }, TEXT_GATE_TIMEOUT_MS);

  if (!response.ok) {
    throw new Error(`Render validation Gemini API error (${response.status}): ${await response.text()}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part?.text ?? '').join('')?.trim();
  if (!text) {
    throw new Error('Render validation returned no JSON text');
  }

  const parsed = JSON.parse(text) as Record<string, unknown>;
  const signals = parsed.signals && typeof parsed.signals === 'object' && !Array.isArray(parsed.signals)
    ? parsed.signals as Record<string, unknown>
    : {};

  const rawDecision = typeof parsed.decision === 'string' ? parsed.decision : '';
  const decision: RenderOutputValidationDecision =
    rawDecision === 'accept'
      ? 'accept'
      : rawDecision === 'reject_wrong_category'
        ? 'reject_wrong_category'
        : rawDecision === 'reject_logo_missing'
          ? 'reject_logo_missing'
          : 'reject_visible_mannequin';

  const assessment: RenderOutputValidationAssessment = {
    decision,
    confidence: clampConfidence(parsed.confidence),
    reason: asReason(
      parsed.reason,
      decision === 'accept'
        ? 'Rendered output meets category-specific acceptance criteria.'
        : decision === 'reject_wrong_category'
          ? 'Rendered item does not match the expected category.'
          : decision === 'reject_logo_missing'
            ? 'Source branding is missing from the render.'
            : 'Rendered output still shows mannequin or body anatomy.',
    ),
    signals: {
      garmentOnly: asBoolean(signals.garment_only),
      mannequinHeadVisible: asBoolean(signals.mannequin_head_visible),
      mannequinNeckVisible: asBoolean(signals.mannequin_neck_visible),
      mannequinTorsoVisible: asBoolean(signals.mannequin_torso_visible),
      mannequinHipsVisible: asBoolean(signals.mannequin_hips_visible),
      limbsVisible: asBoolean(signals.limbs_visible),
      cleanBackground: asBoolean(signals.clean_background),
      ghostMannequinStyling: asBoolean(signals.ghost_mannequin_styling),
      logoOrTextPreserved: asBoolean(signals.logo_or_text_preserved),
      correctCategory: asBoolean(signals.correct_category),
    },
    raw: parsed,
  };

  console.log('render_garment_image output validation result', {
    garmentId: opts.garmentId,
    model: GEMINI_TEXT_MODEL,
    category,
    subcategory: opts.subcategory ?? null,
    expectGhostMannequin,
    expectLogoOrText,
    decision: assessment.decision,
    confidence: assessment.confidence,
    reason: assessment.reason,
    signals: assessment.signals,
  });

  return assessment;
}
