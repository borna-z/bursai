import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  getAuthedClient,
  shouldRunAiSmoke,
} from "./harness";

// Invokes `travel_capsule` end-to-end with a seeded wardrobe that meets the
// 5-garment minimum. Gemini is intercepted by the mock server; the mock's
// "travel|capsule" branch returns an outfits/packing_list payload that the
// function prunes + validates against its own scoring. The smoke assertion
// is intentionally loose — the outfits array may be re-built by the
// validation logic if the mock's payload doesn't score well enough, but the
// response envelope shape (destination, duration_days, outfits[]) is stable.
describe.skipIf(!shouldRunAiSmoke)("smoke: travel capsule (travel_capsule)", () => {
  let admin: SupabaseClient;
  beforeAll(() => {
    admin = createAdminClient();
  });
  let createdUserId: string | null = null;

  afterEach(async () => {
    if (createdUserId) {
      await admin.from("travel_capsules").delete().eq("user_id", createdUserId);
      await admin.from("garments").delete().eq("user_id", createdUserId);
      await deleteTestUser(admin, createdUserId);
      createdUserId = null;
    }
  });

  it("invokes travel_capsule with a 5-garment wardrobe and receives a capsule envelope", async () => {
    const user = await createTestUser(admin);
    createdUserId = user.id;

    const client = await getAuthedClient(user.email, user.password);

    // Seed the minimum 5 garments — mix of categories so the capsule
    // planner can satisfy its coverage requirements (top, bottom, shoes,
    // outerwear).
    const { error: seedErr } = await client.from("garments").insert([
      { user_id: user.id, title: "Linen Shirt", category: "top", color_primary: "white", material: "linen", formality: 2, season_tags: ["spring", "summer"] },
      { user_id: user.id, title: "Cotton Tee", category: "top", color_primary: "navy", material: "cotton", formality: 1, season_tags: ["spring", "summer"] },
      { user_id: user.id, title: "Chinos", category: "bottom", color_primary: "beige", material: "cotton", formality: 3, season_tags: ["spring", "summer", "autumn"] },
      { user_id: user.id, title: "Jeans", category: "bottom", color_primary: "navy", material: "denim", formality: 2, season_tags: ["spring", "summer", "autumn", "winter"] },
      { user_id: user.id, title: "White Sneakers", category: "shoes", color_primary: "white", material: "leather", formality: 2, season_tags: ["spring", "summer", "autumn"] },
      { user_id: user.id, title: "Light Jacket", category: "outerwear", color_primary: "black", material: "cotton", formality: 2, season_tags: ["spring", "autumn"] },
    ]);
    expect(seedErr).toBeNull();

    const { data, error } = await client.functions.invoke("travel_capsule", {
      body: {
        destination: "Lisbon",
        weather: { temperature_min: 16, temperature_max: 24 },
        occasions: ["sightseeing", "dinner"],
        locale: "en",
        outfits_per_day: 1,
        trip_type: "leisure",
        start_date: "2026-06-01",
        end_date: "2026-06-05",
        minimize_items: true,
        luggage_type: "carry_on_personal",
        companions: "solo",
      },
    });

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    // travel_capsule response envelope — see supabase/functions/travel_capsule
    // /index.ts near line 1175. `destination` is not echoed back; only the
    // trip shape + resolved capsule. Keys we can rely on: capsule_items,
    // outfits, packing_list, duration_days, trip_type.
    const envelope = data as {
      duration_days?: number;
      trip_type?: string;
      capsule_items?: unknown[];
      outfits?: unknown[];
      packing_list?: unknown[];
    };
    expect(envelope.duration_days).toBe(5);
    expect(envelope.trip_type).toBe("leisure");
    expect(Array.isArray(envelope.capsule_items)).toBe(true);
    expect(Array.isArray(envelope.outfits)).toBe(true);
    expect(Array.isArray(envelope.packing_list)).toBe(true);
  });
});
