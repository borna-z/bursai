export const PRODUCT_READY_RENDER_GATE_PROVIDER = 'skip-product-ready-v1';
const GEMINI_TEXT_MODEL = 'gemini-2.5-flash';
// `GEMINI_TEXT_URL_OVERRIDE` lets smoke-test mocks intercept the gate calls.
// Unset → identical to the original hardcoded Google endpoint below.
// `typeof Deno !== "undefined"` guards the module against non-Deno runtimes
// (Node/vitest unit tests that import this file transitively) where accessing
// `Deno.env` directly would throw `ReferenceError: Deno is not defined`.
const GEMINI_TEXT_API_URL = (typeof Deno !== "undefined" ? Deno.env.get("GEMINI_TEXT_URL_OVERRIDE") : undefined)
  ?? `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent`;

export type RenderEligibilityDecision = 'render' | 'skip_product_ready';
export type RenderOutputValidationDecision = 'accept' | 'reject_visible_mannequin';

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
  const response = await fetch(GEMINI_TEXT_API_URL, {
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
  });

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

export async function validateRenderedGarmentOutputWithGemini(opts: {
  apiKey: string;
  garmentId: string;
  mimeType: string;
  imageBase64: string;
}): Promise<RenderOutputValidationAssessment | null> {
  const response = await fetch(GEMINI_TEXT_API_URL, {
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
                'Validate whether this rendered garment image is acceptable for the BURS ghost mannequin pipeline.',
                'Return JSON only.',
                'Accept only true garment-only ghost/shadow mannequin product imagery.',
                'Allowed: garment silhouette, subtle internal shaping, clean product background.',
                'Reject if ANY visible anatomy or mannequin structure remains, including head shape, neck block, shoulder block, torso form, hip/pelvis block, arms, hands, legs, or feet.',
                'Reject if the image still reads like a visible mannequin/body under the garment instead of a garment-only ghost mannequin render.',
                'If uncertain, reject_visible_mannequin.',
                'Required schema:',
                '{"decision":"accept|reject_visible_mannequin","confidence":0.0,"reason":"short string","signals":{"garment_only":true,"mannequin_head_visible":false,"mannequin_neck_visible":false,"mannequin_torso_visible":false,"mannequin_hips_visible":false,"limbs_visible":false,"clean_background":true,"ghost_mannequin_styling":true}}',
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
  });

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

  const decision: RenderOutputValidationDecision = parsed.decision === 'accept'
    ? 'accept'
    : 'reject_visible_mannequin';

  const assessment: RenderOutputValidationAssessment = {
    decision,
    confidence: clampConfidence(parsed.confidence),
    reason: asReason(
      parsed.reason,
      decision === 'accept'
        ? 'Rendered output appears garment-only and ghost-mannequin compliant.'
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
    },
    raw: parsed,
  };

  console.log('render_garment_image output validation result', {
    garmentId: opts.garmentId,
    model: GEMINI_TEXT_MODEL,
    decision: assessment.decision,
    confidence: assessment.confidence,
    reason: assessment.reason,
    signals: assessment.signals,
  });

  return assessment;
}
