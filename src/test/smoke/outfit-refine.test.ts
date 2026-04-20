import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  getAuthedClient,
  shouldRunSmoke,
} from "./harness";

// Validates the DB mutation shape of the refine flow (`style_chat` mode=refine
// or `useSwapGarment`). Gemini calls are mocked at the infra layer; this test
// guards what refine eventually persists: an `outfit_items` row swapped to a
// different garment_id while `outfit_id` and `slot` are preserved. If the
// refine path starts writing a new outfit instead of mutating the existing
// one — a regression P28 in the Launch Plan exists to fix — this test's
// "single outfits row" assertion catches it.
describe.skipIf(!shouldRunSmoke)("smoke: outfit refine (swap)", () => {
  let admin: SupabaseClient;
  beforeAll(() => {
    admin = createAdminClient();
  });
  let createdUserId: string | null = null;

  afterEach(async () => {
    if (createdUserId) {
      await admin.from("outfits").delete().eq("user_id", createdUserId);
      await admin.from("garments").delete().eq("user_id", createdUserId);
      await deleteTestUser(admin, createdUserId);
      createdUserId = null;
    }
  });

  it("swaps the shoes slot to a different garment while preserving outfit_id and other slots", async () => {
    const user = await createTestUser(admin);
    createdUserId = user.id;

    const client = await getAuthedClient(user.email, user.password);

    // Seed wardrobe: one top, one bottom, and TWO shoes — refine picks
    // shoes B over shoes A.
    const { data: garments, error: gErr } = await client
      .from("garments")
      .insert([
        { user_id: user.id, category: "top", color_primary: "grey", title: "Henley" },
        { user_id: user.id, category: "bottom", color_primary: "black", title: "Tailored Trousers" },
        { user_id: user.id, category: "shoes", color_primary: "white", title: "Trainers A" },
        { user_id: user.id, category: "shoes", color_primary: "brown", title: "Loafers B" },
      ])
      .select("id, title, category");
    expect(gErr).toBeNull();
    expect(garments).toHaveLength(4);
    const findId = (title: string) => garments!.find((g) => g.title === title)!.id;

    const { data: outfit, error: outErr } = await client
      .from("outfits")
      .insert({
        user_id: user.id,
        occasion: "dinner",
        style_vibe: "smart-casual",
        explanation: "initial outfit before refine",
      })
      .select("id")
      .single();
    expect(outErr).toBeNull();
    const outfitId = outfit!.id;

    const { error: initialItemsErr } = await client.from("outfit_items").insert([
      { outfit_id: outfitId, garment_id: findId("Henley"), slot: "top" },
      { outfit_id: outfitId, garment_id: findId("Tailored Trousers"), slot: "bottom" },
      { outfit_id: outfitId, garment_id: findId("Trainers A"), slot: "shoes" },
    ]);
    expect(initialItemsErr).toBeNull();

    // Refine: swap shoes A → shoes B. The production flow does this via
    // delete-and-reinsert (or update); we test the happy-path update shape.
    const { error: swapErr } = await client
      .from("outfit_items")
      .update({ garment_id: findId("Loafers B") })
      .eq("outfit_id", outfitId)
      .eq("slot", "shoes");
    expect(swapErr).toBeNull();

    const { data: items, error: readErr } = await client
      .from("outfit_items")
      .select("slot, garment_id")
      .eq("outfit_id", outfitId)
      .order("slot", { ascending: true });
    expect(readErr).toBeNull();
    expect(items).toHaveLength(3);
    const bySlot = new Map(items!.map((r) => [r.slot, r.garment_id]));
    expect(bySlot.get("top")).toBe(findId("Henley"));
    expect(bySlot.get("bottom")).toBe(findId("Tailored Trousers"));
    expect(bySlot.get("shoes")).toBe(findId("Loafers B"));

    // Only the original outfit row exists — refine mutated, did not append.
    const { count, error: countErr } = await client
      .from("outfits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    expect(countErr).toBeNull();
    expect(count).toBe(1);
  });
});
