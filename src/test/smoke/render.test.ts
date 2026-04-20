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
//
// Extra RLS coverage (added per Codex review on PR #640): alongside the
// function-invoke assertion, seed a `render_jobs` row via the admin client
// and prove BOTH that the owner's authed anon client can SELECT it AND
// that a different authed user gets back no row. Without the negative
// assertion a regression that relaxes the render_jobs RLS policy (e.g.
// dropping the `user_id = auth.uid()` USING clause) would slip through.
describe.skipIf(!shouldRunAiSmoke)("smoke: render (render_garment_image)", () => {
  let admin: SupabaseClient;
  beforeAll(() => {
    admin = createAdminClient();
  });
  const createdUserIds: string[] = [];
  let createdRenderJobId: string | null = null;

  afterEach(async () => {
    if (createdRenderJobId) {
      await admin.from("render_jobs").delete().eq("id", createdRenderJobId);
      createdRenderJobId = null;
    }
    for (const id of createdUserIds) {
      await admin.from("garments").delete().eq("user_id", id);
      await deleteTestUser(admin, id);
    }
    createdUserIds.length = 0;
  });

  it("invokes render_garment_image and enforces owner-only RLS on render_jobs", async () => {
    const owner = await createTestUser(admin);
    createdUserIds.push(owner.id);
    const intruder = await createTestUser(admin);
    createdUserIds.push(intruder.id);

    const ownerClient = await getAuthedClient(owner.email, owner.password);

    // 1) Edge function invocation — feature flag off, expect the
    // skipped/disabled response. The function validates body
    // (garmentId + clientNonce present) BEFORE it checks the feature
    // flag, so the body still needs the required fields. A bogus
    // garmentId would normally 404; the flag-off branch returns 200
    // before that check.
    const bogusGarmentId = crypto.randomUUID();
    const { data, error } = await ownerClient.functions.invoke("render_garment_image", {
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

    // 2) RLS contract on render_jobs. Seed a job owned by `owner` via
    // the admin client (service role bypasses RLS), then prove the
    // owner's anon-authed client can SELECT it and the intruder's
    // cannot. Client-side enqueue goes through `enqueue_render_job` +
    // service role, so the RLS SELECT policy is the user-facing safety
    // net — a regression that broadens it to `authenticated` role
    // would expose every user's render history.
    const { data: ownerGarment, error: ownerGarmentErr } = await ownerClient
      .from("garments")
      .insert({
        user_id: owner.id,
        title: "Render Target Tee",
        category: "top",
        color_primary: "black",
        render_status: "none",
      })
      .select("id")
      .single();
    expect(ownerGarmentErr).toBeNull();
    const garmentId = ownerGarment!.id;

    const jobId = crypto.randomUUID();
    const { error: jobInsertError } = await admin
      .from("render_jobs")
      .insert({
        id: jobId,
        user_id: owner.id,
        garment_id: garmentId,
        client_nonce: crypto.randomUUID(),
        status: "pending",
        source: "smoke_test",
        presentation: "mixed",
        prompt_version: "v1",
        reserve_key: `smoke_${jobId}`,
      });
    expect(jobInsertError).toBeNull();
    createdRenderJobId = jobId;

    // Owner: should see the row (positive path).
    const { data: ownerRead, error: ownerReadErr } = await ownerClient
      .from("render_jobs")
      .select("id, status")
      .eq("id", jobId)
      .maybeSingle();
    expect(ownerReadErr).toBeNull();
    expect(ownerRead?.id).toBe(jobId);
    expect(ownerRead?.status).toBe("pending");

    // Intruder: should see NO row (negative path). If RLS is relaxed
    // to `authenticated` instead of `user_id = auth.uid()`, this
    // assertion flips from null → the row and this test fails loudly.
    const intruderClient = await getAuthedClient(intruder.email, intruder.password);
    const { data: intruderRead, error: intruderReadErr } = await intruderClient
      .from("render_jobs")
      .select("id, status")
      .eq("id", jobId)
      .maybeSingle();
    expect(intruderReadErr).toBeNull();
    expect(intruderRead).toBeNull();
  });
});
