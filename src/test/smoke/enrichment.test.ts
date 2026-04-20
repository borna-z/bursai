import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  getAuthedClient,
  shouldRunSmoke,
} from "./harness";

// Validates the DB-side contract the `analyze_garment` enrichment flow writes
// through. The edge function itself calls Gemini and is mocked at the infra
// layer (src/test/smoke/mocks/gemini.ts) — this test exercises what that
// function eventually persists: a garment row with `ai_raw` jsonb populated,
// `enrichment_status = 'completed'`, and an `ai_analyzed_at` timestamp. If any
// of those columns or shapes drift, an edge-function regression can silently
// stop downstream features that read `ai_raw` (outfit generation, render
// pipeline, shopping chat).
describe.skipIf(!shouldRunSmoke)("smoke: enrichment persistence", () => {
  let admin: SupabaseClient;
  beforeAll(() => {
    admin = createAdminClient();
  });
  let createdUserId: string | null = null;

  afterEach(async () => {
    if (createdUserId) {
      await admin.from("garments").delete().eq("user_id", createdUserId);
      await deleteTestUser(admin, createdUserId);
      createdUserId = null;
    }
  });

  it("stores and retrieves an ai_raw jsonb payload with enrichment metadata", async () => {
    const user = await createTestUser(admin);
    createdUserId = user.id;

    const client = await getAuthedClient(user.email, user.password);

    // Shape matches what analyze_garment (mode='enrich') returns — see
    // supabase/functions/analyze_garment/index.ts buildEnrichMessages().
    const aiRaw = {
      neckline: "crew",
      sleeve_length: "long",
      garment_length: "regular",
      silhouette: "fitted",
      style_archetype: "minimalist",
      style_tags: ["timeless", "essential"],
      occasion_tags: ["work", "weekend"],
      layering_role: "base",
      versatility_score: 8,
      color_description: "deep navy",
      confidence: 0.92,
    };

    const analyzedAt = new Date().toISOString();
    const { data: inserted, error: insertError } = await client
      .from("garments")
      .insert({
        user_id: user.id,
        title: "Navy Tee",
        category: "top",
        color_primary: "navy",
        ai_raw: aiRaw,
        ai_provider: "burs_ai",
        ai_analyzed_at: analyzedAt,
        enrichment_status: "completed",
        style_archetype: "minimalist",
        versatility_score: 8,
      })
      .select("id, ai_raw, ai_provider, ai_analyzed_at, enrichment_status, style_archetype, versatility_score")
      .single();

    expect(insertError).toBeNull();
    expect(inserted).not.toBeNull();
    expect(inserted?.enrichment_status).toBe("completed");
    expect(inserted?.ai_provider).toBe("burs_ai");
    expect(inserted?.ai_analyzed_at).toBeTruthy();
    expect(inserted?.style_archetype).toBe("minimalist");
    expect(inserted?.versatility_score).toBe(8);
    const storedAiRaw = inserted?.ai_raw as Record<string, unknown> | null;
    expect(storedAiRaw).not.toBeNull();
    expect(storedAiRaw?.style_archetype).toBe("minimalist");
    expect(storedAiRaw?.versatility_score).toBe(8);
    expect(Array.isArray(storedAiRaw?.style_tags)).toBe(true);
  });
});
