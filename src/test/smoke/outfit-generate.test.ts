import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  getAuthedClient,
  shouldRunSmoke,
} from "./harness";

// Validates the DB shape `generate_outfit` / `burs_style_engine` writes back:
// an `outfits` row + one `outfit_items` row per slot (top, bottom, shoes). The
// edge function calls Gemini behind the mock server; this test guards the
// persistence contract — specifically that `outfit_items.slot` is free-form
// text (no CHECK constraint pinning it to a fixed vocabulary), that the FK to
// outfits enforces ownership transitively via the RLS policy, and that
// retrieval via join by slot returns the expected garments. Drift in any of
// these would break the outfits surface silently.
describe.skipIf(!shouldRunSmoke)("smoke: outfit generation persistence", () => {
  let admin: SupabaseClient;
  beforeAll(() => {
    admin = createAdminClient();
  });
  let createdUserId: string | null = null;

  afterEach(async () => {
    if (createdUserId) {
      // outfit_items cascades from outfits; outfits cascades from auth.users.
      // Delete garments explicitly since the afterEach in garment-add.test.ts
      // does the same (cascade not guaranteed).
      await admin.from("outfits").delete().eq("user_id", createdUserId);
      await admin.from("garments").delete().eq("user_id", createdUserId);
      await deleteTestUser(admin, createdUserId);
      createdUserId = null;
    }
  });

  it("creates an outfit with three slot assignments and retrieves them by join", async () => {
    const user = await createTestUser(admin);
    createdUserId = user.id;

    const client = await getAuthedClient(user.email, user.password);

    const garmentRows = [
      { category: "top", color_primary: "white", title: "Crew Tee" },
      { category: "bottom", color_primary: "navy", title: "Straight Jeans" },
      { category: "shoes", color_primary: "black", title: "White Sneakers" },
    ].map((g) => ({ user_id: user.id, ...g }));

    const { data: garments, error: gErr } = await client
      .from("garments")
      .insert(garmentRows)
      .select("id, category");
    expect(gErr).toBeNull();
    expect(garments).toHaveLength(3);
    const byCategory = new Map(garments!.map((g) => [g.category, g.id]));

    const { data: outfit, error: outErr } = await client
      .from("outfits")
      .insert({
        user_id: user.id,
        occasion: "casual",
        style_vibe: "minimalist",
        explanation: "smoke-test generated outfit",
        confidence_score: 0.85,
        confidence_level: "high",
      })
      .select("id, occasion, confidence_score")
      .single();
    expect(outErr).toBeNull();
    expect(outfit?.occasion).toBe("casual");
    const outfitId = outfit!.id;

    const { error: itemsErr } = await client.from("outfit_items").insert([
      { outfit_id: outfitId, garment_id: byCategory.get("top"), slot: "top" },
      { outfit_id: outfitId, garment_id: byCategory.get("bottom"), slot: "bottom" },
      { outfit_id: outfitId, garment_id: byCategory.get("shoes"), slot: "shoes" },
    ]);
    expect(itemsErr).toBeNull();

    const { data: joined, error: joinErr } = await client
      .from("outfit_items")
      .select("slot, garment_id, garments ( category, title )")
      .eq("outfit_id", outfitId)
      .order("slot", { ascending: true });
    expect(joinErr).toBeNull();
    expect(joined).toHaveLength(3);
    const slots = joined!.map((r) => r.slot).sort();
    expect(slots).toEqual(["bottom", "shoes", "top"]);
    for (const row of joined!) {
      expect(row.garment_id).toBe(byCategory.get(row.slot));
      expect((row.garments as { category: string } | null)?.category).toBe(row.slot);
    }
  });
});
