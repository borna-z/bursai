import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  getAuthedClient,
  shouldRunAiSmoke,
} from "./harness";

// Invokes `render_garment_image`. In the local smoke runtime the
// `RENDER_PIPELINE_ENABLED` env var is NOT set, so the function short-
// circuits with `{ ok: true, skipped: true, reason: 'Render pipeline
// disabled' }`. That early exit still exercises auth, JSON parsing, and
// the feature-flag branch, which is the point of this smoke. Future work
// (Wave 3 render prompts) will flip the flag in the CI env and add a
// separate test that drives the full render loop through the mock Gemini
// image endpoint — that needs credit seeding and storage-object fixtures,
// which are scoped to Wave 3 not P0d-iii.
describe.skipIf(!shouldRunAiSmoke)("smoke: render (render_garment_image)", () => {
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

  it("invokes render_garment_image and receives the pipeline-disabled early-exit response", async () => {
    const user = await createTestUser(admin);
    createdUserId = user.id;

    const client = await getAuthedClient(user.email, user.password);

    // The function validates body (garmentId + clientNonce present) BEFORE
    // it checks the feature flag, so the body still needs the required
    // fields. A bogus garmentId would normally 404; the flag-off branch
    // returns 200 before that check.
    const bogusGarmentId = crypto.randomUUID();
    const { data, error } = await client.functions.invoke("render_garment_image", {
      body: {
        garmentId: bogusGarmentId,
        clientNonce: crypto.randomUUID(),
      },
    });

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    const body = data as { ok?: boolean; skipped?: boolean; reason?: string };
    expect(body.ok).toBe(true);
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe("Render pipeline disabled");
  });
});
