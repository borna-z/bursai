export const PRODUCT_READY_RENDER_GATE_PROVIDER = 'skip-product-ready-v1';
const GEMINI_TEXT_MODEL = 'gemini-2.5-flash';
const GEMINI_TEXT_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent`;

export type RenderEligibilityDecision = 'render' | 'skip_product_ready';

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
