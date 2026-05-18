/**
 * synthetic_monitor — happy-path observability worker
 *
 * Runs every 15 minutes via pg_cron (see migration
 * 20260518120000_synthetic_monitor.sql). Exercises the full memory-ingest
 * pipeline end-to-end so a silent-failure regression (Wave 8.5 PR B class)
 * surfaces within 15 min instead of 4 days.
 *
 * Steps (each in its own try/catch — failure is logged + monitor continues
 * to teardown so we don't leak synthetic auth users on transient errors):
 *
 *   1. create_user      → supabaseAdmin.auth.admin.createUser
 *   2. insert_garment   → INSERT INTO garments (user_id, title, category, image_path)
 *   3. ingest_event     → RPC ingest_memory_event (wear_outfit)
 *   4. assert_summary   → wait 30s, SELECT FROM user_style_summaries
 *                         pass if row exists OR dirty_at IS NOT NULL
 *   5. delete_user      → supabaseAdmin.auth.admin.deleteUser
 *
 * On any failure: insert into synthetic_failures (step, error_message,
 * error_class, payload). Always return 200 — cron is happy as long as the
 * HTTP call succeeds; the alert table is the real signal.
 *
 * Auth: shared worker bearer (RENDER_WORKER_BEARER), same pattern as
 * process_render_jobs. See _shared/timing-safe.ts for the constant-time
 * comparison rationale.
 */
import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS_HEADERS } from "../_shared/cors.ts";
import { timingSafeEqual } from "../_shared/timing-safe.ts";
import { logger } from "../_shared/logger.ts";
import { captureError } from "../_shared/observability.ts";

const log = logger("synthetic_monitor");

// 30s wait between ingest_memory_event and the user_style_summaries read.
// The RPC writes synchronously, but the summary builder runs async on dirty_at
// so we accept either: a materialized row, or a pending dirty_at flag.
const ASSERT_WAIT_MS = 30_000;

type FailurePayload = Record<string, unknown>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function classifyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/timeout|timed out|abort/i.test(msg)) return "timeout";
  if (/network|fetch|econn|unreachable|dns/i.test(msg)) return "network";
  if (/permission|denied|unauthor|forbidden|rls/i.test(msg)) return "auth";
  if (/not.?found|missing|does not exist/i.test(msg)) return "not_found";
  return "unknown";
}

async function recordFailure(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  step: string,
  err: unknown,
  payload: FailurePayload,
): Promise<void> {
  const errorMessage = err instanceof Error ? err.message : String(err);
  const errorClass = classifyError(err);
  log.error("synthetic step failed", { step, error: errorMessage, error_class: errorClass });
  captureError("synthetic_monitor_step_failed", err, { step, error_class: errorClass });
  try {
    const { error: insertError } = await supabase.from("synthetic_failures").insert({
      step,
      error_message: errorMessage,
      error_class: errorClass,
      payload,
    });
    // PostgREST errors resolve as { error } rather than throwing, so an RLS/grant
    // drift or missing migration would silently swallow the alert signal.
    if (insertError) {
      log.exception("synthetic_failures insert returned error", insertError, { step });
      captureError("synthetic_monitor_alert_insert_failed", insertError, { step });
    }
  } catch (insertErr) {
    // Last-resort: if we can't even write to synthetic_failures, log loudly.
    // The Supabase Logs query will still catch this via the structured line.
    log.exception("failed to insert synthetic_failures row", insertErr, { step });
    captureError("synthetic_monitor_alert_insert_failed", insertErr, { step });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const RENDER_WORKER_BEARER = Deno.env.get("RENDER_WORKER_BEARER") ?? "";

  if (!RENDER_WORKER_BEARER || RENDER_WORKER_BEARER.length < 32) {
    return jsonResponse({ error: "worker bearer not configured" }, 503);
  }
  if (!SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY.length < 32) {
    return jsonResponse({ error: "service role key not configured" }, 503);
  }
  if (!SUPABASE_URL) {
    return jsonResponse({ error: "supabase url not configured" }, 503);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authHeader = req.headers.get("Authorization") ?? "";
  const expected = `Bearer ${RENDER_WORKER_BEARER}`;
  if (!timingSafeEqual(authHeader, expected)) {
    // Surface bearer drift via the alert table so PR 2's alerting picks it up.
    // Without this row, a vault-vs-env mismatch leaves the monitor silently
    // 401-ing while cron looks healthy.
    await recordFailure(
      supabase,
      "auth",
      new Error("worker bearer mismatch"),
      { has_auth_header: authHeader.length > 0 },
    );
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const runId = crypto.randomUUID();
  const syntheticEmail = `synthetic+${runId}@burs.app`;
  // 32-char random hex — exceeds Supabase's 6-char min and won't collide.
  const syntheticPassword = crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "");

  log.info("synthetic run start", { run_id: runId });

  let userId: string | null = null;
  let garmentId: string | null = null;
  const stepsCompleted: string[] = [];

  // ─── Step 1: create_user ────────────────────────────────────────
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: syntheticEmail,
      password: syntheticPassword,
      email_confirm: true,
      user_metadata: { synthetic: true, run_id: runId },
    });
    if (error) throw error;
    if (!data?.user?.id) throw new Error("auth.admin.createUser returned no user id");
    userId = data.user.id;
    stepsCompleted.push("create_user");
  } catch (err) {
    await recordFailure(supabase, "create_user", err, { run_id: runId, email: syntheticEmail });
    // No user → nothing to clean up. Return 200 so cron stays green.
    return jsonResponse({ ok: false, failed_at: "create_user", run_id: runId });
  }

  // ─── Step 2: insert_garment ────────────────────────────────────
  try {
    const { data, error } = await supabase
      .from("garments")
      .insert({
        user_id: userId,
        title: "synthetic-monitor-garment",
        category: "top",
        image_path: "synthetic/test.jpg",
      })
      .select("id")
      .single();
    if (error) throw error;
    if (!data?.id) throw new Error("garments insert returned no id");
    garmentId = data.id as string;
    stepsCompleted.push("insert_garment");
  } catch (err) {
    await recordFailure(supabase, "insert_garment", err, {
      run_id: runId,
      user_id: userId,
    });
    await cleanupUser(supabase, userId, runId);
    return jsonResponse({ ok: false, failed_at: "insert_garment", run_id: runId });
  }

  // ─── Step 3: ingest_event ──────────────────────────────────────
  // wear_outfit is the canonical signal that triggers a summary rebuild.
  // RPC signature documented in migration 20260501120000_user_style_summaries_and_memory_ingest.sql.
  try {
    const { error } = await supabase.rpc("ingest_memory_event", {
      p_user_id: userId,
      p_event_type: "wear_outfit",
      p_outfit_id: null,
      p_garment_ids: [garmentId],
      p_removed_garment_ids: null,
      p_added_garment_ids: null,
      p_rating: null,
      p_feedback_text: null,
      p_value: null,
      p_metadata: { synthetic: true, run_id: runId },
      p_source: "synthetic_monitor",
    });
    if (error) throw error;
    stepsCompleted.push("ingest_event");
  } catch (err) {
    await recordFailure(supabase, "ingest_event", err, {
      run_id: runId,
      user_id: userId,
      garment_id: garmentId,
    });
    await cleanupUser(supabase, userId, runId);
    return jsonResponse({ ok: false, failed_at: "ingest_event", run_id: runId });
  }

  // ─── Step 4: wait + assert_summary ─────────────────────────────
  await new Promise((resolve) => setTimeout(resolve, ASSERT_WAIT_MS));

  try {
    const { data, error } = await supabase
      .from("user_style_summaries")
      .select("id, dirty_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    // Pass if a row exists at all (the ingest RPC writes the row itself with
    // dirty_at set; the async builder later clears dirty_at and fills
    // summary_json). Either state is healthy from a pipeline-liveness POV.
    const hasRow = data !== null && data !== undefined;
    if (!hasRow) {
      throw new Error("no user_style_summaries row after 30s wait");
    }
    stepsCompleted.push("assert_summary");
  } catch (err) {
    await recordFailure(supabase, "assert_summary", err, {
      run_id: runId,
      user_id: userId,
      garment_id: garmentId,
      waited_ms: ASSERT_WAIT_MS,
    });
    await cleanupUser(supabase, userId, runId);
    return jsonResponse({ ok: false, failed_at: "assert_summary", run_id: runId });
  }

  // ─── Step 5: delete_user (also cascades synthetic garment + summary) ──
  const teardownOk = await cleanupUser(supabase, userId, runId);
  if (teardownOk) stepsCompleted.push("delete_user");

  log.info("synthetic run success", {
    run_id: runId,
    steps_completed: stepsCompleted,
  });

  return jsonResponse({ ok: true, run_id: runId, steps_completed: stepsCompleted });
});

/**
 * Best-effort teardown. We record any failure but never throw — the rest of
 * the run has already succeeded and a dangling synthetic user is a
 * recoverable observability problem, not a P0. Returns true on success.
 */
async function cleanupUser(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string | null,
  runId: string,
): Promise<boolean> {
  if (!userId) return false;
  try {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw error;
    return true;
  } catch (err) {
    await recordFailure(supabase, "delete_user", err, {
      run_id: runId,
      user_id: userId,
    });
    return false;
  }
}
