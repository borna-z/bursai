import { describe, expect, it } from 'vitest';

import {
  buildCategoryFraming,
  buildGarmentRenderPrompt,
  extractPromptEnrichment,
  formalityLabel,
  GarmentForPrompt,
  isPositiveBrandingValue,
  normalizeMetadataValue,
  RETRY_VARIANTS,
  sanitizeEnrichmentValue,
  sourceHasBranding,
} from '../render-prompt-builder';

function baseGarment(overrides: Partial<GarmentForPrompt> = {}): GarmentForPrompt {
  return {
    title: "Blue Oxford Shirt",
    category: "tops",
    subcategory: "oxford shirt",
    color_primary: "blue",
    color_secondary: null,
    material: "cotton",
    pattern: "solid",
    fit: "regular",
    formality: 3,
    ai_raw: { enrichment: { silhouette: "fitted", sleeve_length: "long" } },
    ...overrides,
  };
}

describe('render-prompt-builder', () => {
  it('normalizeMetadataValue strips placeholders', () => {
    expect(normalizeMetadataValue("hello")).toEqual("hello");
    expect(normalizeMetadataValue("  hello  ")).toEqual("hello");
    expect(normalizeMetadataValue("")).toEqual(null);
    expect(normalizeMetadataValue("null")).toEqual(null);
    expect(normalizeMetadataValue("unknown")).toEqual(null);
    expect(normalizeMetadataValue("n/a")).toEqual(null);
    expect(normalizeMetadataValue(123)).toEqual(null);
  });

  it('sanitizeEnrichmentValue strips control + non-ASCII, truncates to 200', () => {
    expect(sanitizeEnrichmentValue(null)).toEqual(null);
    expect(sanitizeEnrichmentValue("hello\nworld")).toEqual("hello world");
    expect(sanitizeEnrichmentValue("helloÿworld")).toEqual("helloworld");
    const long = "a".repeat(300);
    expect(sanitizeEnrichmentValue(long)?.length).toEqual(200);
  });

  it('formalityLabel buckets', () => {
    expect(formalityLabel(0)).toEqual("very casual");
    expect(formalityLabel(1)).toEqual("very casual");
    expect(formalityLabel(2)).toEqual("casual");
    expect(formalityLabel(3)).toEqual("smart casual");
    expect(formalityLabel(4)).toEqual("semi-formal");
    expect(formalityLabel(5)).toEqual("formal");
  });

  it('extractPromptEnrichment reads nested enrichment fields', () => {
    const e = extractPromptEnrichment({
      enrichment: {
        neckline: "crew",
        sleeve_length: "short",
        occasion_tags: ["work", "casual"],
        logo_description: "small embroidered crest",
        style_archetype: "preppy",
      },
    });
    expect(e.neckline).toEqual("crew");
    expect(e.sleeveLength).toEqual("short");
    expect(e.occasionTags).toEqual(["work", "casual"]);
    expect(e.logoDescription).toEqual("small embroidered crest");
    expect(e.styleArchetype).toEqual("preppy");
  });

  it('extractPromptEnrichment handles null/non-object', () => {
    const e = extractPromptEnrichment(null);
    expect(e.neckline).toEqual(null);
    expect(e.occasionTags).toEqual(null);
  });

  it('isPositiveBrandingValue filters negative phrases', () => {
    expect(isPositiveBrandingValue("Nike swoosh")).toEqual(true);
    expect(isPositiveBrandingValue("none")).toEqual(false);
    expect(isPositiveBrandingValue("no logo")).toEqual(false);
    expect(isPositiveBrandingValue("not visible")).toEqual(false);
    expect(isPositiveBrandingValue("plain")).toEqual(false);
    expect(isPositiveBrandingValue("")).toEqual(false);
    expect(isPositiveBrandingValue(null)).toEqual(false);
  });

  it('sourceHasBranding true when logo text is positive', () => {
    expect(
      sourceHasBranding({ enrichment: { logo_description: "Adidas stripes" } }),
    ).toEqual(true);
    expect(
      sourceHasBranding({ enrichment: { logo_description: "no branding" } }),
    ).toEqual(false);
  });

  it('buildCategoryFraming differs by category', () => {
    const ghost = buildCategoryFraming("ghost_mannequin", "female");
    const shoes = buildCategoryFraming("shoes", "female");
    const bag = buildCategoryFraming("bag", "female");
    const jewelry = buildCategoryFraming("jewelry", "female");
    expect(ghost.hardRequirements.some((l) => l.includes("ghost mannequin"))).toBe(true);
    expect(shoes.negativeRequirements.some((l) => l.includes("NEVER place the shoe"))).toBe(true);
    expect(bag.hardRequirements.some((l) => l.includes("bag front-on"))).toBe(true);
    expect(jewelry.hardRequirements.some((l) => l.includes("Close-up product shot"))).toBe(true);
  });

  it('buildGarmentRenderPrompt primary contains lead line + hard reqs', () => {
    const out = buildGarmentRenderPrompt(baseGarment(), "female", "primary");
    expect(out).toContain("Subject: a oxford shirt in blue, cotton.");
    expect(out).toContain("Hard requirements:");
    expect(out).toContain("Negative requirements:");
    expect(out).toContain("Silhouette: fitted");
    expect(out).toContain("Sleeve length: long");
  });

  it('buildGarmentRenderPrompt tightened includes correction emphasis', () => {
    const out = buildGarmentRenderPrompt(baseGarment(), "female", "tightened");
    expect(out).toContain("CRITICAL CORRECTION FROM PRIOR ATTEMPT:");
  });

  it('buildGarmentRenderPrompt minimal omits metadata block', () => {
    const out = buildGarmentRenderPrompt(baseGarment(), "female", "minimal");
    expect(out).toContain("Subject: a oxford shirt");
    expect(out.includes("CRITICAL CORRECTION")).toEqual(false);
    expect(out.includes("Sleeve length")).toEqual(false);
  });

  it('buildGarmentRenderPrompt maskedInput swaps background-removal line', () => {
    const masked = buildGarmentRenderPrompt(baseGarment(), "female", "primary", true);
    const unmasked = buildGarmentRenderPrompt(baseGarment(), "female", "primary", false);
    expect(masked).toContain("pre-segmented onto a transparent background");
    expect(unmasked).toContain("Remove the person, body, skin");
  });

  it('buildGarmentRenderPrompt minimal maskedInput uses pre-segmented line', () => {
    const out = buildGarmentRenderPrompt(baseGarment(), "female", "minimal", true);
    expect(out).toContain("pre-segmented onto a transparent background");
  });

  it('RETRY_VARIANTS order is primary/tightened/minimal', () => {
    expect([...RETRY_VARIANTS]).toEqual(["primary", "tightened", "minimal"]);
  });

  it('buildGarmentRenderPrompt shoes category omits ghost mannequin lines', () => {
    const out = buildGarmentRenderPrompt(
      baseGarment({ category: "shoes", subcategory: "sneakers" }),
      "female",
      "primary",
    );
    expect(out).toContain("Photograph the shoe");
    expect(out.includes("ghost mannequin")).toEqual(false);
  });
});
