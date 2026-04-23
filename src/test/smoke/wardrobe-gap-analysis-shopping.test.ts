import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  getAuthedClient,
  shouldRunAiSmoke,
} from "./harness";

// Wave 4-B (P21+P22) smoke: invoke `wardrobe_gap_analysis` with an
// `intent` payload and assert the envelope carries BOTH `gaps` and
// `shopping_recommendations`. The mock Gemini server returns the
// shopping envelope only when the prompt contains shopping-intent
// markers (see `src/test/smoke/mocks/gemini.ts` — `hasShoppingIntent`
// branch). Without intent the function is backward-compatible and
// returns `gaps` only — we assert that path in a second case.
describe.skipIf(!shouldRunAiSmoke)("smoke: wardrobe gap analysis (wardrobe_gap_analysis)", () => {
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

  // Shared seed — 6 garments above the 5-minimum, mix of categories so
  // coverage math produces stable derived gaps and a stratified sample
  // lands IDs in the prompt for pairing_garment_ids echo.
  async function seedWardrobe(client: SupabaseClient, userId: string) {
    const { error } = await client.from("garments").insert([
      { user_id: userId, title: "White Tee", category: "top", color_primary: "white", material: "cotton", formality: 1, season_tags: ["spring", "summer"] },
      { user_id: userId, title: "Navy Shirt", category: "top", color_primary: "navy", material: "cotton", formality: 3, season_tags: ["spring", "autumn"] },
      { user_id: userId, title: "Beige Chinos", category: "bottom", color_primary: "beige", material: "cotton", formality: 3, season_tags: ["spring", "summer", "autumn"] },
      { user_id: userId, title: "Black Jeans", category: "bottom", color_primary: "black", material: "denim", formality: 2, season_tags: ["all_season"] },
      { user_id: userId, title: "White Sneakers", category: "shoes", color_primary: "white", material: "leather", formality: 2, season_tags: ["spring", "summer", "autumn"] },
      { user_id: userId, title: "Wool Coat", category: "outerwear", color_primary: "charcoal", material: "wool", formality: 4, season_tags: ["autumn", "winter"] },
    ]);
    expect(error).toBeNull();
  }

  it("with shopping intent returns both gaps and shopping_recommendations", async () => {
    const user = await createTestUser(admin);
    createdUserId = user.id;

    const client = await getAuthedClient(user.email, user.password);
    await seedWardrobe(client, user.id);

    const { data, error } = await client.functions.invoke("wardrobe_gap_analysis", {
      body: {
        locale: "en",
        intent: {
          occasion: "wedding",
          formality: "high",
          season: "summer",
        },
      },
    });

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    const envelope = data as {
      gaps?: unknown[];
      shopping_recommendations?: unknown[];
      error?: string;
    };
    expect(envelope.error).toBeUndefined();
    expect(Array.isArray(envelope.gaps)).toBe(true);
    expect(envelope.gaps!.length).toBeGreaterThan(0);
    expect(Array.isArray(envelope.shopping_recommendations)).toBe(true);
    expect(envelope.shopping_recommendations!.length).toBeGreaterThan(0);
  });

  it("without intent returns gaps only (backward-compatible)", async () => {
    const user = await createTestUser(admin);
    createdUserId = user.id;

    const client = await getAuthedClient(user.email, user.password);
    await seedWardrobe(client, user.id);

    const { data, error } = await client.functions.invoke("wardrobe_gap_analysis", {
      body: { locale: "en" },
    });

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    const envelope = data as {
      gaps?: unknown[];
      shopping_recommendations?: unknown[];
      error?: string;
    };
    expect(envelope.error).toBeUndefined();
    expect(Array.isArray(envelope.gaps)).toBe(true);
    expect(envelope.gaps!.length).toBeGreaterThan(0);
    // Backward-compat: no shopping_recommendations key (or empty) is both acceptable.
    if (envelope.shopping_recommendations !== undefined) {
      expect(Array.isArray(envelope.shopping_recommendations)).toBe(true);
    }
  });
});
