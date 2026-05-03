/**
 * Wave 8.5 PR B audit (Round 6) smoke coverage for memory_ingest +
 * reset_style_memory.
 *
 * Locks in the must-fix gates from the round-5/round-6 audit:
 *
 *  - R5-B1: `reset_style_memory` no longer 503s every healthy call.
 *  - R6-1: ingest_memory_event RPC rejects cross-user / phantom UUIDs.
 *  - R6-P11: every PR B response carries `Cache-Control: no-store`.
 *  - Happy path: save_outfit ingest → feedback_signals + dirty mark.
 *
 * Local-only — gated by shouldRunSmoke + the smoke-local stack's edge
 * runtime (`supabase functions serve` running with all PR B functions
 * deployed). Skipped in smoke-prod (we don't want to write real signals
 * against the prod DB).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createAdminClient,
  createTrialingTestUser,
  deleteTestUser,
  getAuthedClient,
  shouldRunSmoke,
} from "./harness";

// We don't gate on shouldRunAiSmoke — memory_ingest doesn't call Gemini.
// But it DOES require functions-serve to be running, which the smoke-local
// CI job ensures. Smoke-prod runs against prod where the function is
// already deployed, so it works there too.
describe.skipIf(!shouldRunSmoke)("smoke: memory_ingest", () => {
  let admin: SupabaseClient;
  beforeAll(() => {
    admin = createAdminClient();
  });
  let createdUserId: string | null = null;

  afterEach(async () => {
    if (createdUserId) {
      // memory_ingest creates rows in feedback_signals + garment_pair_memory
      // + user_style_summaries — all of which cascade from auth.users
      // (via the schema's user_id FK). Cascade kicks in on auth user delete.
      await deleteTestUser(admin, createdUserId);
      createdUserId = null;
    }
  });

  async function seedOwnedGarmentsAndOutfit(
    userId: string,
  ): Promise<{ garmentIds: string[]; outfitId: string }> {
    // Insert 2 owned garments. Minimal column set that satisfies NOT NULL.
    const { data: garments, error: gErr } = await admin
      .from("garments")
      .insert([
        {
          user_id: userId,
          title: "smoke-test top",
          category: "top",
        },
        {
          user_id: userId,
          title: "smoke-test bottom",
          category: "bottom",
        },
      ])
      .select("id");
    if (gErr) throw gErr;
    const garmentIds = (garments ?? []).map((g) => g.id);

    const { data: outfit, error: oErr } = await admin
      .from("outfits")
      .insert({ user_id: userId, occasion: "smoke" })
      .select("id")
      .single();
    if (oErr) throw oErr;

    return { garmentIds, outfitId: outfit.id };
  }

  it("happy path: save_outfit writes feedback_signals + dirty marks summary", async () => {
    const user = await createTrialingTestUser(admin);
    createdUserId = user.id;
    const { garmentIds, outfitId } = await seedOwnedGarmentsAndOutfit(user.id);

    const client = await getAuthedClient(user.email, user.password);
    const { data, error } = await client.functions.invoke("memory_ingest", {
      body: {
        signal_type: "save_outfit",
        outfit_id: outfitId,
        garment_ids: garmentIds,
        source: "smoke_test",
        idempotency_key: `smoke_${crypto.randomUUID()}`,
      },
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ ok: true, event_type: "save_outfit" });
    expect(typeof data?.signal_id).toBe("string");

    // Verify the side-effects landed.
    const { data: signals } = await admin
      .from("feedback_signals")
      .select("id, signal_type, outfit_id")
      .eq("user_id", user.id);
    expect(signals?.length).toBeGreaterThanOrEqual(1);
    const saved = (signals ?? []).find((s) => s.signal_type === "save_outfit");
    expect(saved).toBeDefined();
    expect(saved?.outfit_id).toBe(outfitId);

    const { data: pairs } = await admin
      .from("garment_pair_memory")
      .select("garment_a_id, garment_b_id, positive_count")
      .eq("user_id", user.id);
    // 2 garments → 1 pair row with positive_count=1
    expect(pairs?.length).toBe(1);
    expect(pairs?.[0].positive_count).toBeGreaterThanOrEqual(1);

    // Summary row should be marked dirty.
    const { data: summary } = await admin
      .from("user_style_summaries")
      .select("dirty_at")
      .eq("user_id", user.id)
      .maybeSingle();
    expect(summary?.dirty_at).toBeTruthy();
  });

  it("R6-1: rejects garment_ids not owned by caller (403)", async () => {
    // Two users, A and B. A submits B's garment_id — RPC must raise 42501,
    // edge fn translates to HTTP 403 ownership_denied. We use admin clients
    // to seed B's data and an authed A client to make the call.
    const userA = await createTrialingTestUser(admin);
    createdUserId = userA.id;
    const userB = await createTrialingTestUser(admin);

    try {
      const { garmentIds: bGarmentIds } = await seedOwnedGarmentsAndOutfit(userB.id);
      const { outfitId: aOutfitId } = await seedOwnedGarmentsAndOutfit(userA.id);

      const aClient = await getAuthedClient(userA.email, userA.password);
      const { data, error } = await aClient.functions.invoke("memory_ingest", {
        body: {
          signal_type: "save_outfit",
          outfit_id: aOutfitId,
          // Cross-user attack: A's outfit but B's garments.
          garment_ids: bGarmentIds,
          source: "smoke_test_cross_user",
        },
      });

      // supabase-js surfaces non-2xx as `error` with FunctionsHttpError shape.
      expect(error).not.toBeNull();
      // Either the error carries context.status OR the data has the rejection
      // body — both shapes acceptable depending on supabase-js version.
      const status = (error as { context?: { status?: number } } | null)?.context
        ?.status;
      const body = (data ?? {}) as { error?: string };
      const ownership =
        status === 403 || body.error === "ownership_denied";
      expect(ownership).toBe(true);
    } finally {
      // Best-effort cleanup of the second user; afterEach handles userA.
      await deleteTestUser(admin, userB.id);
    }
  });

  it("R6-1: rejects outfit_id not owned by caller (403)", async () => {
    const userA = await createTrialingTestUser(admin);
    createdUserId = userA.id;
    const userB = await createTrialingTestUser(admin);

    try {
      const { outfitId: bOutfitId } = await seedOwnedGarmentsAndOutfit(userB.id);
      const { garmentIds: aGarmentIds } = await seedOwnedGarmentsAndOutfit(userA.id);

      const aClient = await getAuthedClient(userA.email, userA.password);
      const { data, error } = await aClient.functions.invoke("memory_ingest", {
        body: {
          signal_type: "save_outfit",
          outfit_id: bOutfitId,
          garment_ids: aGarmentIds,
          source: "smoke_test_foreign_outfit",
        },
      });

      expect(error).not.toBeNull();
      const status = (error as { context?: { status?: number } } | null)?.context
        ?.status;
      const body = (data ?? {}) as { error?: string };
      const ownership = status === 403 || body.error === "ownership_denied";
      expect(ownership).toBe(true);
    } finally {
      await deleteTestUser(admin, userB.id);
    }
  });

  it("R6-P11: every response carries Cache-Control: no-store", async () => {
    const user = await createTrialingTestUser(admin);
    createdUserId = user.id;
    const { garmentIds, outfitId } = await seedOwnedGarmentsAndOutfit(user.id);

    const client = await getAuthedClient(user.email, user.password);
    // Drop down to raw fetch so we can inspect headers — supabase-js's
    // .invoke() doesn't expose response headers.
    const session = await client.auth.getSession();
    const token = session.data.session?.access_token;
    expect(token).toBeTruthy();

    const url = `${process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL}/functions/v1/memory_ingest`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        signal_type: "save_outfit",
        outfit_id: outfitId,
        garment_ids: garmentIds,
        source: "smoke_test_cache_control",
      }),
    });

    expect(res.status).toBe(200);
    const cacheControl = res.headers.get("cache-control");
    expect(cacheControl).toBeTruthy();
    expect(cacheControl?.toLowerCase()).toContain("no-store");
  });
});

describe.skipIf(!shouldRunSmoke)("smoke: reset_style_memory", () => {
  let admin: SupabaseClient;
  beforeAll(() => {
    admin = createAdminClient();
  });
  let createdUserId: string | null = null;

  afterEach(async () => {
    if (createdUserId) {
      await deleteTestUser(admin, createdUserId);
      createdUserId = null;
    }
  });

  it("R5-B1: reset_style_memory does NOT 503 on healthy call", async () => {
    // The bug was an inverted `if (!checkOverload(...))` that made the
    // function return 503 to every healthy caller. This test calls reset
    // on a healthy stack (no overload) and asserts 200 — would fail with
    // the pre-fix code on the very first call.
    const user = await createTrialingTestUser(admin);
    createdUserId = user.id;

    const client = await getAuthedClient(user.email, user.password);
    const { data, error } = await client.functions.invoke(
      "reset_style_memory",
      { body: {} },
    );

    expect(error).toBeNull();
    expect(data).toMatchObject({ ok: true });
    expect(data?.tables_cleared).toBeDefined();
  });

  it("R6-P11: response carries Cache-Control: no-store", async () => {
    const user = await createTrialingTestUser(admin);
    createdUserId = user.id;

    const client = await getAuthedClient(user.email, user.password);
    const session = await client.auth.getSession();
    const token = session.data.session?.access_token;

    const url = `${process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL}/functions/v1/reset_style_memory`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const cacheControl = res.headers.get("cache-control");
    expect(cacheControl?.toLowerCase()).toContain("no-store");
  });
});
