import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  getAuthedClient,
  shouldRunAiSmoke,
} from "./harness";

// Invokes `visual_search`. With fewer than 3 garments the function returns
// an empty-match early-exit body WITHOUT calling Gemini — this is the
// cheapest happy-path invocation that still proves auth, request parsing,
// RLS, and the response envelope are intact. A follow-up test that sends
// >=3 garments + an inspiration image and asserts on mock-intercepted
// matches is scoped to the suggest_accessories / visual_search Wave 2/3
// prompts, not this smoke.
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

  it("invokes visual_search with <3 garments and receives the empty-match early-exit response", async () => {
    const user = await createTestUser(admin);
    createdUserId = user.id;

    const client = await getAuthedClient(user.email, user.password);

    // Exactly 2 garments — below the 3-garment threshold visual_search
    // requires before calling Gemini.
    const { error: seedErr } = await client.from("garments").insert([
      { user_id: user.id, title: "White Crew Tee", category: "top", color_primary: "white", material: "cotton", formality: 2 },
      { user_id: user.id, title: "Straight Jeans", category: "bottom", color_primary: "navy", material: "denim", formality: 2 },
    ]);
    expect(seedErr).toBeNull();

    // Minimal PNG data URL as the inspiration image (bytes don't matter —
    // the function short-circuits before they're read).
    const tinyPngDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

    const { data, error } = await client.functions.invoke("visual_search", {
      body: {
        image_base64: tinyPngDataUrl,
        locale: "en",
      },
    });

    expect(error).toBeNull();
    const body = data as { matches?: unknown[]; gaps?: unknown[]; description?: string };
    expect(body).toBeTruthy();
    expect(Array.isArray(body.matches)).toBe(true);
    expect(Array.isArray(body.gaps)).toBe(true);
    expect(body.matches).toEqual([]);
    expect(body.gaps).toEqual([]);
    expect(body.description).toBe("Add more garments first.");
  });
});
