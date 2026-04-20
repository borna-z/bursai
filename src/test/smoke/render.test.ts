import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  getAuthedClient,
  shouldRunSmoke,
} from "./harness";

// Validates the DB side-effects the `render_garment_image` edge function walks
// a garment through. The edge function itself calls Gemini image APIs behind
// the mock server (src/test/smoke/mocks/gemini.ts) — what this test guards is
// the schema invariants the pipeline depends on:
//   - `garments.render_status` CHECK constraint accepts the full lifecycle
//     (none → pending → rendering → ready / failed / skipped)
//   - A `render_jobs` row transitions through `pending → in_progress →
//     succeeded` with the same CHECK-enforced vocabulary used by
//     process_render_jobs.
// If either CHECK vocabulary drifts, edge-function writes will 500 and the
// user's render will silently stall — catching that here is the whole point.
describe.skipIf(!shouldRunSmoke)("smoke: render lifecycle", () => {
  let admin: SupabaseClient;
  beforeAll(() => {
    admin = createAdminClient();
  });
  let createdUserId: string | null = null;
  let createdRenderJobId: string | null = null;

  afterEach(async () => {
    if (createdRenderJobId) {
      await admin.from("render_jobs").delete().eq("id", createdRenderJobId);
      createdRenderJobId = null;
    }
    if (createdUserId) {
      await admin.from("garments").delete().eq("user_id", createdUserId);
      await deleteTestUser(admin, createdUserId);
      createdUserId = null;
    }
  });

  it("advances render_status through the full lifecycle and keeps a render_jobs row in sync", async () => {
    const user = await createTestUser(admin);
    createdUserId = user.id;

    const client = await getAuthedClient(user.email, user.password);

    const { data: garment, error: insertError } = await client
      .from("garments")
      .insert({
        user_id: user.id,
        title: "Render Target Tee",
        category: "top",
        color_primary: "black",
        render_status: "none",
      })
      .select("id, render_status")
      .single();
    expect(insertError).toBeNull();
    expect(garment?.render_status).toBe("none");
    const garmentId = garment!.id;

    // Pipeline walk: none → pending → rendering → ready, as per CHECK
    // constraint `garments_render_status_check`. Each hop is a separate
    // update so that a drift in the allowed set surfaces at the exact hop
    // that introduces an invalid value.
    for (const status of ["pending", "rendering", "ready"] as const) {
      const patch: Record<string, unknown> = { render_status: status };
      if (status === "ready") {
        patch.rendered_image_path = `${user.id}/rendered.png`;
        patch.rendered_at = new Date().toISOString();
        patch.render_provider = "gemini_2_5_flash";
      }
      const { error: updError } = await client
        .from("garments")
        .update(patch)
        .eq("id", garmentId);
      expect(updError).toBeNull();
    }

    const { data: afterRender, error: readError } = await client
      .from("garments")
      .select("render_status, rendered_image_path, render_provider")
      .eq("id", garmentId)
      .single();
    expect(readError).toBeNull();
    expect(afterRender?.render_status).toBe("ready");
    expect(afterRender?.rendered_image_path).toBe(`${user.id}/rendered.png`);
    expect(afterRender?.render_provider).toBe("gemini_2_5_flash");

    // render_jobs is the queue table. process_render_jobs walks `pending →
    // in_progress → succeeded` while render_garment_image does the work.
    // Service role needed for render_jobs INSERT (RLS only grants SELECT to
    // owners — enqueue_render_job uses service role).
    const jobId = crypto.randomUUID();
    const { error: jobInsertError } = await admin
      .from("render_jobs")
      .insert({
        id: jobId,
        user_id: user.id,
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

    const { error: progressError } = await admin
      .from("render_jobs")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", jobId);
    expect(progressError).toBeNull();

    const { error: successError } = await admin
      .from("render_jobs")
      .update({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        result_path: `${user.id}/rendered.png`,
      })
      .eq("id", jobId);
    expect(successError).toBeNull();

    // Owner can SELECT their own job via RLS.
    const { data: ownJob, error: ownJobErr } = await client
      .from("render_jobs")
      .select("status, result_path")
      .eq("id", jobId)
      .single();
    expect(ownJobErr).toBeNull();
    expect(ownJob?.status).toBe("succeeded");
    expect(ownJob?.result_path).toBe(`${user.id}/rendered.png`);
  });
});
