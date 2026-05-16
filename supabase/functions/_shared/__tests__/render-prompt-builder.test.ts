import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.220.0/assert/mod.ts";

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
} from "../render-prompt-builder.ts";

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

Deno.test("normalizeMetadataValue strips placeholders", () => {
  assertEquals(normalizeMetadataValue("hello"), "hello");
  assertEquals(normalizeMetadataValue("  hello  "), "hello");
  assertEquals(normalizeMetadataValue(""), null);
  assertEquals(normalizeMetadataValue("null"), null);
  assertEquals(normalizeMetadataValue("unknown"), null);
  assertEquals(normalizeMetadataValue("n/a"), null);
  assertEquals(normalizeMetadataValue(123), null);
});

Deno.test("sanitizeEnrichmentValue strips control + non-ASCII, truncates to 200", () => {
  assertEquals(sanitizeEnrichmentValue(null), null);
  assertEquals(sanitizeEnrichmentValue("hello\nworld"), "hello world");
  assertEquals(sanitizeEnrichmentValue("helloÿworld"), "helloworld");
  const long = "a".repeat(300);
  assertEquals(sanitizeEnrichmentValue(long)?.length, 200);
});

Deno.test("formalityLabel buckets", () => {
  assertEquals(formalityLabel(0), "very casual");
  assertEquals(formalityLabel(1), "very casual");
  assertEquals(formalityLabel(2), "casual");
  assertEquals(formalityLabel(3), "smart casual");
  assertEquals(formalityLabel(4), "semi-formal");
  assertEquals(formalityLabel(5), "formal");
});

Deno.test("extractPromptEnrichment reads nested enrichment fields", () => {
  const e = extractPromptEnrichment({
    enrichment: {
      neckline: "crew",
      sleeve_length: "short",
      occasion_tags: ["work", "casual"],
      logo_description: "small embroidered crest",
      style_archetype: "preppy",
    },
  });
  assertEquals(e.neckline, "crew");
  assertEquals(e.sleeveLength, "short");
  assertEquals(e.occasionTags, ["work", "casual"]);
  assertEquals(e.logoDescription, "small embroidered crest");
  assertEquals(e.styleArchetype, "preppy");
});

Deno.test("extractPromptEnrichment handles null/non-object", () => {
  const e = extractPromptEnrichment(null);
  assertEquals(e.neckline, null);
  assertEquals(e.occasionTags, null);
});

Deno.test("isPositiveBrandingValue filters negative phrases", () => {
  assertEquals(isPositiveBrandingValue("Nike swoosh"), true);
  assertEquals(isPositiveBrandingValue("none"), false);
  assertEquals(isPositiveBrandingValue("no logo"), false);
  assertEquals(isPositiveBrandingValue("not visible"), false);
  assertEquals(isPositiveBrandingValue("plain"), false);
  assertEquals(isPositiveBrandingValue(""), false);
  assertEquals(isPositiveBrandingValue(null), false);
});

Deno.test("sourceHasBranding true when logo text is positive", () => {
  assertEquals(
    sourceHasBranding({ enrichment: { logo_description: "Adidas stripes" } }),
    true,
  );
  assertEquals(
    sourceHasBranding({ enrichment: { logo_description: "no branding" } }),
    false,
  );
});

Deno.test("buildCategoryFraming differs by category", () => {
  const ghost = buildCategoryFraming("ghost_mannequin", "female");
  const shoes = buildCategoryFraming("shoes", "female");
  const bag = buildCategoryFraming("bag", "female");
  const jewelry = buildCategoryFraming("jewelry", "female");
  assert(ghost.hardRequirements.some((l) => l.includes("ghost mannequin")));
  assert(shoes.negativeRequirements.some((l) => l.includes("NEVER place the shoe")));
  assert(bag.hardRequirements.some((l) => l.includes("bag front-on")));
  assert(jewelry.hardRequirements.some((l) => l.includes("Close-up product shot")));
});

Deno.test("buildGarmentRenderPrompt primary contains lead line + hard reqs", () => {
  const out = buildGarmentRenderPrompt(baseGarment(), "female", "primary");
  assertStringIncludes(out, "Subject: a oxford shirt in blue, cotton.");
  assertStringIncludes(out, "Hard requirements:");
  assertStringIncludes(out, "Negative requirements:");
  assertStringIncludes(out, "Silhouette: fitted");
  assertStringIncludes(out, "Sleeve length: long");
});

Deno.test("buildGarmentRenderPrompt tightened includes correction emphasis", () => {
  const out = buildGarmentRenderPrompt(baseGarment(), "female", "tightened");
  assertStringIncludes(out, "CRITICAL CORRECTION FROM PRIOR ATTEMPT:");
});

Deno.test("buildGarmentRenderPrompt minimal omits metadata block", () => {
  const out = buildGarmentRenderPrompt(baseGarment(), "female", "minimal");
  assertStringIncludes(out, "Subject: a oxford shirt");
  assertEquals(out.includes("CRITICAL CORRECTION"), false);
  assertEquals(out.includes("Sleeve length"), false);
});

Deno.test("buildGarmentRenderPrompt maskedInput swaps background-removal line", () => {
  const masked = buildGarmentRenderPrompt(baseGarment(), "female", "primary", true);
  const unmasked = buildGarmentRenderPrompt(baseGarment(), "female", "primary", false);
  assertStringIncludes(masked, "pre-segmented onto a transparent background");
  assertStringIncludes(unmasked, "Remove the person, body, skin");
});

Deno.test("buildGarmentRenderPrompt minimal maskedInput uses pre-segmented line", () => {
  const out = buildGarmentRenderPrompt(baseGarment(), "female", "minimal", true);
  assertStringIncludes(out, "pre-segmented onto a transparent background");
});

Deno.test("RETRY_VARIANTS order is primary/tightened/minimal", () => {
  assertEquals([...RETRY_VARIANTS], ["primary", "tightened", "minimal"]);
});

Deno.test("buildGarmentRenderPrompt shoes category omits ghost mannequin lines", () => {
  const out = buildGarmentRenderPrompt(
    baseGarment({ category: "shoes", subcategory: "sneakers" }),
    "female",
    "primary",
  );
  assertStringIncludes(out, "Photograph the shoe");
  assertEquals(out.includes("ghost mannequin"), false);
});
