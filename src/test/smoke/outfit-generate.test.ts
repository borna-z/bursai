import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  getAuthedClient,
  shouldRunAiSmoke,
} from "./harness";

// Invokes `generate_outfit` (which proxies to `burs_style_engine` via the
// unified_stylist_engine helper). Seeds a top/bottom/shoes wardrobe so the
// engine has enough candidates to form a complete outfit. Gemini is
// intercepted by the local mock server; a tool_call response with
// chosen_index: 0 lets the engine finalize selection and return an envelope
// the shim can shape.
describe.skipIf(!shouldRunAiSmoke)("smoke: outfit generate (generate_outfit)", () => {
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

  it("invokes generate_outfit with a seeded wardrobe and receives a complete outfit envelope", async () => {
    const user = await createTestUser(admin);
    createdUserId = user.id;

    const client = await getAuthedClient(user.email, user.password);

    const { error: seedErr } = await client.from("garments").insert([
      { user_id: user.id, title: "White Crew Tee", category: "top", color_primary: "white", material: "cotton", formality: 2, season_tags: ["spring", "summer", "autumn"] },
      { user_id: user.id, title: "Straight Jeans", category: "bottom", color_primary: "navy", material: "denim", formality: 2, season_tags: ["spring", "summer", "autumn", "winter"] },
      { user_id: user.id, title: "White Sneakers", category: "shoes", color_primary: "white", material: "leather", formality: 2, season_tags: ["spring", "summer", "autumn"] },
    ]);
    expect(seedErr).toBeNull();

    const { data, error } = await client.functions.invoke("generate_outfit", {
      body: {
        occasion: "vardag",
        weather: { temperature: 18, precipitation: 0, wind_speed: 5 },
        locale: "en",
      },
    });

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    // generate_outfit shim returns { items, explanation, confidence_*, ... }
    // See supabase/functions/generate_outfit/index.ts — the shim maps
    // `selected.garment_ids` into items with slot:"unknown".
    const envelope = data as {
      items?: Array<{ slot: string; garment_id: string }>;
      explanation?: string;
      confidence_score?: number;
      unified_engine?: boolean;
    };
    expect(Array.isArray(envelope.items)).toBe(true);
    expect(envelope.items?.length).toBeGreaterThanOrEqual(2);
    expect(typeof envelope.explanation === "string" || envelope.explanation === null).toBe(true);
    expect(envelope.unified_engine).toBe(true);
  });
});
