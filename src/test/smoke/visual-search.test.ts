import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  getAuthedClient,
  shouldRunAiSmoke,
} from "./harness";

// Invokes `visual_search` with a wardrobe of exactly 3 garments (the minimum
// threshold the function enforces before calling Gemini). One of the
// seeded garments has `in_laundry: true` — visual_search MUST include
// that garment when building the wardrobe block handed to Gemini, because
// the intent of visual search is to surface everything the user owns as a
// potential match, not just what's currently ready to wear.
//
// The mock Gemini (src/test/smoke/mocks/gemini.ts) echoes every UUID it
// sees in the prompt back as a `matches[].garment_id`. The function then
// filters `matches` to garment_ids that exist in the user's wardrobe. So
// if an `in_laundry = false` filter were ever added to the wardrobe
// fetch, the in_laundry garment's UUID would never reach the prompt,
// never be echoed, and never appear in `result.matches`. Asserting the
// UUID IS in the response matches set locks that invariant in place.
describe.skipIf(!shouldRunAiSmoke)("smoke: visual search (visual_search)", () => {
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

  it("forwards in_laundry garments to Gemini (no in_laundry filter in the wardrobe fetch)", async () => {
    const user = await createTestUser(admin);
    createdUserId = user.id;

    const client = await getAuthedClient(user.email, user.password);

    // 3 garments — meets the function's >=3 threshold. The middle one is
    // explicitly `in_laundry: true`; the other two are left as default
    // (false). A regression adding an `in_laundry = false` filter would
    // silently drop the middle garment.
    const { data: inserted, error: seedErr } = await client
      .from("garments")
      .insert([
        { user_id: user.id, title: "White Crew Tee", category: "top", color_primary: "white", material: "cotton", formality: 2 },
        { user_id: user.id, title: "Straight Jeans", category: "bottom", color_primary: "navy", material: "denim", formality: 2, in_laundry: true },
        { user_id: user.id, title: "Black Loafers", category: "shoes", color_primary: "black", material: "leather", formality: 4 },
      ])
      .select("id, title, in_laundry");
    expect(seedErr).toBeNull();
    expect(inserted).toHaveLength(3);

    const inLaundryGarment = inserted!.find((g) => g.in_laundry === true);
    expect(inLaundryGarment).toBeTruthy();
    const inLaundryId = inLaundryGarment!.id;

    // Minimal PNG data URL as the inspiration image (bytes don't matter —
    // Gemini is mocked, and the mock doesn't decode the image).
    const tinyPngDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

    const { data, error } = await client.functions.invoke("visual_search", {
      body: {
        image_base64: tinyPngDataUrl,
        locale: "en",
      },
    });

    expect(error).toBeNull();
    const body = data as {
      matches?: Array<{ garment_id?: string }>;
      gaps?: unknown[];
      description?: string;
    };
    expect(body).toBeTruthy();
    expect(Array.isArray(body.matches)).toBe(true);
    expect(Array.isArray(body.gaps)).toBe(true);

    // The in_laundry garment MUST appear in the matches — that proves
    // its UUID reached the prompt, i.e. the wardrobe fetch did not
    // filter it out.
    const matchedIds = (body.matches ?? []).map((m) => m.garment_id).filter(Boolean);
    expect(matchedIds).toContain(inLaundryId);
  });
});
