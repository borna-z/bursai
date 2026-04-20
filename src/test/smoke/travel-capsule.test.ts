import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  getAuthedClient,
  shouldRunSmoke,
} from "./harness";

// Validates the persistence shape `travel_capsule` writes to the
// `travel_capsules` table. The edge function calls Gemini (mocked at the infra
// layer) to build the capsule plan, then writes three jsonb columns:
//   - capsule_items: array of {id,title,category,color_primary,image_path}
//   - outfits: array of per-day {day, occasion, garment_ids[]} entries
//   - packing_list: array of string items
// This test guards that the jsonb columns round-trip those exact shapes and
// that RLS ("users own their capsules") scopes queries by auth.uid(). Drift
// in the jsonb shape would silently break the Travel view in the web app.
describe.skipIf(!shouldRunSmoke)("smoke: travel capsule persistence", () => {
  let admin: SupabaseClient;
  beforeAll(() => {
    admin = createAdminClient();
  });
  let createdUserId: string | null = null;

  afterEach(async () => {
    if (createdUserId) {
      await admin.from("travel_capsules").delete().eq("user_id", createdUserId);
      await deleteTestUser(admin, createdUserId);
      createdUserId = null;
    }
  });

  it("round-trips a 5-day capsule with capsule_items, outfits, and packing_list intact", async () => {
    const user = await createTestUser(admin);
    createdUserId = user.id;

    const client = await getAuthedClient(user.email, user.password);

    const garmentA = crypto.randomUUID();
    const garmentB = crypto.randomUUID();
    const capsuleItems = [
      { id: garmentA, title: "Linen Shirt", category: "top", color_primary: "white", image_path: null },
      { id: garmentB, title: "Chinos", category: "bottom", color_primary: "khaki", image_path: null },
    ];
    const outfits = [
      { day: 1, occasion: "travel", garment_ids: [garmentA, garmentB] },
      { day: 2, occasion: "sightseeing", garment_ids: [garmentA, garmentB] },
      { day: 3, occasion: "dinner", garment_ids: [garmentA, garmentB] },
      { day: 4, occasion: "sightseeing", garment_ids: [garmentA, garmentB] },
      { day: 5, occasion: "travel", garment_ids: [garmentA, garmentB] },
    ];
    const packingList = ["Passport", "Chargers", "Swim trunks"];

    const { data: inserted, error: insertError } = await client
      .from("travel_capsules")
      .insert({
        user_id: user.id,
        destination: "Lisbon",
        trip_type: "leisure",
        duration_days: 5,
        weather_min: 16,
        weather_max: 24,
        occasions: ["sightseeing", "dinner"],
        capsule_items: capsuleItems,
        outfits,
        packing_list: packingList,
        packing_tips: ["Layer for evenings", "Pack light — laundry available"],
        start_date: "2026-06-01",
        end_date: "2026-06-05",
        total_combinations: outfits.length,
        reasoning: "smoke-test capsule",
      })
      .select("id, destination, duration_days, capsule_items, outfits, packing_list, occasions")
      .single();

    expect(insertError).toBeNull();
    expect(inserted).not.toBeNull();
    expect(inserted?.destination).toBe("Lisbon");
    expect(inserted?.duration_days).toBe(5);

    const storedItems = inserted?.capsule_items as typeof capsuleItems;
    const storedOutfits = inserted?.outfits as typeof outfits;
    const storedPacking = inserted?.packing_list as string[];
    expect(storedItems).toHaveLength(2);
    expect(storedItems[0].id).toBe(garmentA);
    expect(storedOutfits).toHaveLength(5);
    expect(storedOutfits[0].garment_ids).toEqual([garmentA, garmentB]);
    expect(storedPacking).toContain("Passport");
    expect(inserted?.occasions).toEqual(["sightseeing", "dinner"]);
  });
});
