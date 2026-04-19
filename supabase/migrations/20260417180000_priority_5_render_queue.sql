-- ============================================================
-- Priority 5 — Durable render queue
--
-- Replaces the in-memory client-side render kickoff queue in
-- src/lib/garmentIntelligence.ts with a Postgres-backed table
-- plus a pg_cron safety-net worker invocation every 60s.
--
-- Design notes:
-- * render_jobs.id is the canonical `render_job_id` written onto
--   every row in render_credit_transactions (reserve/consume/
--   release). The enqueue edge function pre-generates the UUID
--   client-side so `reserve_credit_atomic` can record it up-front
--   — this is what lets later consume/release calls find the
--   reserve transaction by `render_job_id`.
-- * reserve_key carries P4's colon-prefixed idempotency namespace
--   (`reserve:<baseKey>`) and is UNIQUE at the row level — second
--   enqueue with same clientNonce hits reserve's replay path AND
--   the ON CONFLICT guard on the INSERT, belt-and-suspenders.
-- * attempts + max_attempts drive retry policy per worker run.
--   Credit ledger semantics (Interpretation A): credit is reserved
--   once at enqueue, consumed on final success, released only when
--   attempts reaches max_attempts and row flips to 'failed'.
-- * locked_until provides pessimistic claim window. 5-minute TTL
--   matches the render_garment_image worst-case Gemini latency
--   (~25s) with ~10-20x safety margin for spikes.
-- ============================================================

-- pg_net is the prerequisite for pg_cron to invoke the edge
-- function via HTTP. Available in Supabase; install here so the
-- CREATE EXTENSION on pg_cron's cron.schedule body can reference
-- net.http_post.
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS render_jobs (
  id                UUID PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  garment_id        UUID NOT NULL REFERENCES garments(id) ON DELETE CASCADE,
  client_nonce      TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','in_progress','succeeded','failed')),
  attempts          INT  NOT NULL DEFAULT 0,
  max_attempts      INT  NOT NULL DEFAULT 3,
  source            TEXT NOT NULL,
  presentation      TEXT NOT NULL,
  prompt_version    TEXT NOT NULL,
  reserve_key       TEXT UNIQUE NOT NULL,
  -- Force bypasses render_garment_image's product-ready eligibility gate
  -- AND the "already ready/rendering/skipped" early-return guard. Set by
  -- enqueue_render_job when the user explicitly wants a NEW render on an
  -- already-rendered garment (regenerate button). Forwarded to
  -- render_garment_image by process_render_jobs so internal (worker)
  -- invocations behave identically to pre-P5 direct calls that passed
  -- force:true. Codex round 10 caught that P5 was dropping this flag —
  -- regenerate button was silently broken (worker returned 'skipped'
  -- with no new image). See render-state-machine.md Scenario 7 + I9.
  force             BOOLEAN NOT NULL DEFAULT false,
  result_path       TEXT,
  error             TEXT,
  error_class       TEXT,
  locked_until      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ
);

-- Hot path: worker's claim query scans non-terminal rows ordered
-- by `locked_until NULLS FIRST, created_at` so unlocked oldest
-- first. Partial index keeps it small (terminal rows drop out).
CREATE INDEX IF NOT EXISTS idx_render_jobs_claim
  ON render_jobs (status, locked_until NULLS FIRST, created_at)
  WHERE status IN ('pending','in_progress');

-- Client-side "show all my in-flight renders" and per-garment
-- "is this one done yet?" queries.
CREATE INDEX IF NOT EXISTS idx_render_jobs_garment
  ON render_jobs (garment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_render_jobs_user_active
  ON render_jobs (user_id, created_at DESC)
  WHERE status IN ('pending','in_progress');

-- RLS: users read their own jobs. Writes are service-role only
-- (enqueue_render_job + process_render_jobs + the two RPCs below).
ALTER TABLE render_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own render jobs" ON render_jobs;
CREATE POLICY "Users read own render jobs" ON render_jobs
  FOR SELECT USING (auth.uid() = user_id);

-- ─── RPC: Claim the next pending render job ─────────────────
-- Atomic SELECT ... FOR UPDATE SKIP LOCKED + update so two
-- concurrent worker invocations never both take the same row.
-- Returns NULL if no pending work.
--
-- Optional p_job_id hint lets the client-initiated path from
-- enqueue_render_job claim its own specific row first for the
-- low-latency path. Cron invocations pass NULL and get the
-- oldest unlocked pending job.

CREATE OR REPLACE FUNCTION claim_render_job(p_job_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  garment_id UUID,
  client_nonce TEXT,
  source TEXT,
  presentation TEXT,
  prompt_version TEXT,
  reserve_key TEXT,
  attempts INT,
  max_attempts INT,
  force BOOLEAN
) AS $$
DECLARE
  v_row render_jobs%ROWTYPE;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required for render job claim';
  END IF;

  IF p_job_id IS NOT NULL THEN
    SELECT * INTO v_row FROM render_jobs
    WHERE render_jobs.id = p_job_id
      AND status = 'pending'
      AND (locked_until IS NULL OR locked_until < NOW())
    FOR UPDATE SKIP LOCKED;
  ELSE
    SELECT * INTO v_row FROM render_jobs
    WHERE status = 'pending'
      AND (locked_until IS NULL OR locked_until < NOW())
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
  END IF;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE render_jobs
  SET status = 'in_progress',
      locked_until = NOW() + INTERVAL '5 minutes',
      attempts = render_jobs.attempts + 1,
      started_at = COALESCE(render_jobs.started_at, NOW()),
      updated_at = NOW()
  WHERE render_jobs.id = v_row.id;

  RETURN QUERY
  SELECT v_row.id, v_row.user_id, v_row.garment_id, v_row.client_nonce,
         v_row.source, v_row.presentation, v_row.prompt_version,
         v_row.reserve_key, v_row.attempts + 1, v_row.max_attempts,
         v_row.force;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── RPC: Recover stale in_progress claims ──────────────────
-- Any worker run opens by resetting rows where a previous worker
-- crashed mid-processing (locked_until expired while still
-- in_progress). Reset to pending so claim_render_job can pick
-- them up again. Returns count for telemetry.

CREATE OR REPLACE FUNCTION recover_stale_render_jobs()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required for stale-claim recovery';
  END IF;

  UPDATE render_jobs
  SET status = 'pending',
      locked_until = NULL,
      updated_at = NOW()
  WHERE status = 'in_progress'
    AND locked_until < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── pg_cron schedule: 60s worker invocation ────────────────
-- pg_cron runs as the postgres superuser, which is the only role
-- with SELECT access to vault.decrypted_secrets. This keeps the
-- service-role key AND the functions base URL out of pg_settings
-- (where authenticated users can read them via current_setting('app.*'))
-- and out of any committed SQL. Supabase's vault schema encrypts
-- secrets at rest and decrypts transparently when read as superuser.
--
-- Both the URL and the Authorization header are built at cron-exec
-- time by selecting the current secret value. If either secret isn't
-- inserted (first deploy), the SELECT returns NULL, which propagates
-- through `||` to produce NULL inputs into `net.http_post`; the call
-- raises a not-null violation inside cron execution. That lands in
-- `cron.job_run_details` with status='failed' — LOUD operational
-- signal that the post-deploy vault step was skipped (see previous
-- COALESCE('') note below). The client-initiated path (enqueue's
-- internal POST from the edge function) still works without vault,
-- so app requests aren't blocked — only the 60s safety-net cron is.
--
-- Round-15 fix: the URL used to be hardcoded as
-- 'https://khvkwojtlkcvxjxztduj.supabase.co/...'. Any non-production
-- environment applying this migration would POST to the production
-- project's function endpoint — its own render_jobs queue would
-- never get processed, and it would issue requests against prod
-- auth/credits. Moving the base URL into vault mirrors the
-- service_role_key pattern and keeps every environment self-contained.
--
-- ONE-TIME POST-DEPLOY STEP (run once per environment — production,
-- any preview branch you want the cron to exercise, local dev if you
-- wire up pg_cron locally):
--   After db push applies this migration, run ONCE via Supabase SQL
--   editor (Database → SQL Editor):
--
--     INSERT INTO vault.secrets (name, secret)
--     VALUES
--       ('service_role_key',   '<this environment''s service_role key>'),
--       ('functions_base_url', 'https://<this environment''s project ref>.supabase.co')
--     ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
--
--   Retrieve the service_role key from Supabase dashboard → Settings →
--   API → service_role secret. The base URL is Settings → API →
--   Project URL (no trailing slash; the cron body appends
--   '/functions/v1/process_render_jobs'). Verify with:
--
--     SELECT jobid FROM cron.job WHERE jobname = 'process-render-jobs';
--     SELECT name FROM vault.secrets
--       WHERE name IN ('service_role_key', 'functions_base_url');
--
--   First successful cron run appears in `cron.job_run_details` within
--   60s with status='succeeded' and return_message='200'.

-- Intentional no COALESCE fallback on either secret SELECT:
-- If either vault secret is missing, the subquery returns NULL.
-- `NULL || '/functions/v1/process_render_jobs'` evaluates to NULL for
-- the URL, and `'Bearer ' || NULL` evaluates to NULL for the header.
-- net.http_post raises a not-null violation inside the cron execution.
-- The error lands in cron.job_run_details with status='failed' — LOUD
-- operational signal that one of the one-time
-- `INSERT INTO vault.secrets (...)` steps was skipped. Previous versions
-- used COALESCE(..., '') on the secret, which silently sent an
-- empty-bearer 401 and showed status='succeeded' with return_message='401',
-- making the broken state invisible in standard monitoring.
SELECT cron.schedule(
  'process-render-jobs',
  '*/1 * * * *',  -- every 1 minute (pg_cron's smallest standard interval)
  $$
  SELECT net.http_post(
    url := (
      SELECT decrypted_secret FROM vault.decrypted_secrets
      WHERE name = 'functions_base_url' LIMIT 1
    ) || '/functions/v1/process_render_jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'service_role_key' LIMIT 1
      )
    ),
    body := '{}'::jsonb,
    -- Worst-case worker batch runtime: MAX_JOBS_PER_RUN=5 / JOB_CONCURRENCY=2
    -- = 3 serial batches, each up to ~45s per invokeRender timeout, ~= 135s.
    -- Plus DB round-trips, claim RPC, release RPC, telemetry writes. 180s
    -- gives ~45s headroom. Codex round 8 caught that the prior 50s cutoff
    -- truncated normal-load batches, logged `cron.job_run_details.status='failed'`
    -- after each partial run, and let the next cron tick (+60s) start a
    -- second worker invocation on top of the still-running first one.
    timeout_milliseconds := 180000
  );
  $$
);

-- ─── RPC: Atomic delete-with-release for a garment ──────────────
-- Single-transaction operation: releases active render_jobs reservations
-- AND deletes the garment row. Replaces the two-step release-then-delete
-- design from round 12 (which had two design flaws Codex round 13 caught):
--
--   P1 — Race between two concurrent deletes for the same garment:
--   the ON CONFLICT (idempotency_key) DO NOTHING guard on the release
--   insert can't prevent a double-refund because both callers could
--   refund the balance BEFORE either's insert ran. Caller 2's insert
--   then silently drops on the idempotency conflict, but the balance
--   was already double-credited.
--
--   P2 — Split client-side transaction: client called release RPC, then
--   issued DELETE. If release committed but DELETE failed, active jobs
--   stayed alive and the worker's eventual consume hit already_terminal
--   → free render.
--
-- Fix design (round 13):
--
--   1. One server-side transaction — client calls this RPC, nothing else.
--      Release + delete commit or roll back together.
--   2. PERFORM ... FOR UPDATE on render_credits (user-level serialization
--      lock) + FOR UPDATE on each render_jobs row. Serializes concurrent
--      deletes for the same user so terminal check + refund + insert
--      happen as an indivisible block. Same locking discipline as
--      release_credit_atomic in the P3 ledger migration.
--   3. Post-lock, post-refund idempotency: after writing the release tx,
--      the partial unique index
--      `idx_render_credit_tx_terminal_unique` on
--      `render_credit_transactions(render_job_id) WHERE kind IN
--      ('consume','release')` prevents a second terminal for the same
--      job. The UNIQUE on idempotency_key is a secondary guard.
--
-- Authorization: SECURITY DEFINER; call site must be authenticated user
-- for their own garment (auth.uid() = p_user_id) OR service_role for
-- admin tooling. Granted to `authenticated` + `service_role` — anon
-- and PUBLIC revoked.
--
-- Returns JSONB: { ok: true, released_count: INT, garment_deleted: BOOL,
--                  reason?: TEXT }. Callers log `released_count` for
-- observability and treat ok=true/garment_deleted=false (with
-- reason='garment_not_found') as idempotent success (retry after a
-- successful prior delete hits this).

-- Drop the round-12 two-step RPC cleanly before creating the new one.
DROP FUNCTION IF EXISTS release_reservations_for_garment_delete(UUID);

CREATE OR REPLACE FUNCTION delete_garment_with_release_atomic(
  p_garment_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_job RECORD;
  v_released_count INT := 0;
  v_garment_exists BOOLEAN := FALSE;
  v_reserve_source TEXT;
  v_terminal_exists INT;
  v_release_existing INT;
BEGIN
  -- Authorization: caller must be the garment's owner (via auth.uid()) OR
  -- service_role (admin tooling / seed_wardrobe / post-launch cron). The
  -- p_user_id parameter is REQUIRED because auth.uid() is NULL under the
  -- service_role path, and we still need to scope the lock + refund.
  IF auth.uid() IS DISTINCT FROM p_user_id
     AND (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not authorized: caller must be garment owner or service_role';
  END IF;

  -- Ownership + existence check. Failure here is idempotent success for
  -- the caller (retry after a prior successful delete lands here).
  SELECT EXISTS(
    SELECT 1 FROM garments WHERE id = p_garment_id AND user_id = p_user_id
  ) INTO v_garment_exists;

  IF NOT v_garment_exists THEN
    RETURN jsonb_build_object(
      'ok', true,
      'released_count', 0,
      'garment_deleted', false,
      'reason', 'garment_not_found'
    );
  END IF;

  -- Serialize concurrent ledger mutations for this user. All release_* and
  -- consume_* RPCs hold this lock; nobody else can mutate
  -- render_credits(user_id=p_user_id) OR race our terminal-check until we
  -- commit. Same discipline as release_credit_atomic in P3 catchup.
  PERFORM 1 FROM render_credits WHERE user_id = p_user_id FOR UPDATE;

  -- Lock every non-terminal render_jobs row for this garment. SKIP LOCKED
  -- is NOT used — we want to block (not skip) if the worker is currently
  -- claiming this job. Claim's own FOR UPDATE SKIP LOCKED will see our
  -- lock and skip, so this waits only briefly.
  FOR v_job IN
    SELECT id FROM render_jobs
    WHERE garment_id = p_garment_id
      AND status IN ('pending', 'in_progress')
    FOR UPDATE
  LOOP
    -- Idempotency guard: if a release for this job already exists with
    -- our stable key, skip (retry case — nothing to do).
    SELECT id INTO v_release_existing
    FROM render_credit_transactions
    WHERE idempotency_key = 'release:garment_delete:' || v_job.id::text;
    IF v_release_existing IS NOT NULL THEN
      CONTINUE;
    END IF;

    -- Terminal-uniqueness check (under the render_credits lock). If the
    -- worker consumed OR released between our garment-exists check and
    -- this line, we must skip — no refund on an already-charged job.
    SELECT 1 INTO v_terminal_exists
    FROM render_credit_transactions
    WHERE render_job_id = v_job.id
      AND user_id = p_user_id
      AND kind IN ('consume', 'release')
    LIMIT 1;
    IF v_terminal_exists IS NOT NULL THEN
      CONTINUE;
    END IF;

    -- Find the reserve source.
    SELECT source INTO v_reserve_source
    FROM render_credit_transactions
    WHERE render_job_id = v_job.id
      AND kind = 'reserve'
      AND user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1;
    IF v_reserve_source IS NULL THEN
      -- No reserve exists for this job. Shouldn't happen under normal
      -- enqueue flow. Defensive skip.
      CONTINUE;
    END IF;

    -- Refund source-specifically, mirroring release_credit_atomic.
    IF v_reserve_source = 'trial_gift' THEN
      UPDATE render_credits
      SET reserved = GREATEST(0, reserved - 1),
          trial_gift_remaining = trial_gift_remaining + 1,
          updated_at = NOW()
      WHERE user_id = p_user_id;
    ELSIF v_reserve_source = 'topup' THEN
      UPDATE render_credits
      SET reserved = GREATEST(0, reserved - 1),
          topup_balance = topup_balance + 1,
          updated_at = NOW()
      WHERE user_id = p_user_id;
    ELSE
      UPDATE render_credits
      SET reserved = GREATEST(0, reserved - 1),
          updated_at = NOW()
      WHERE user_id = p_user_id;
    END IF;

    -- Write the release tx. The partial unique index on
    -- render_credit_transactions(render_job_id) WHERE kind IN
    -- ('consume','release') would raise on a concurrent double-terminal,
    -- but we've already serialized via the render_credits FOR UPDATE so
    -- this INSERT always succeeds under correct conditions.
    INSERT INTO render_credit_transactions
      (user_id, render_job_id, idempotency_key, kind, amount, source)
    VALUES
      (p_user_id, v_job.id, 'release:garment_delete:' || v_job.id::text,
       'release', 1, v_reserve_source);

    v_released_count := v_released_count + 1;
  END LOOP;

  -- Delete the garment. CASCADE fires on render_jobs, but the ledger is
  -- already balanced. If the DELETE fails (FK violation, RLS) the entire
  -- function rolls back — releases included — preserving atomicity.
  DELETE FROM garments
  WHERE id = p_garment_id AND user_id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'released_count', v_released_count,
    'garment_deleted', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Lockdown: service-role only on RPCs ────────────────────
-- Defense-in-depth with the role guard inside each function.
REVOKE ALL ON FUNCTION claim_render_job(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION recover_stale_render_jobs() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION claim_render_job(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION recover_stale_render_jobs() TO service_role;

-- delete_garment_with_release_atomic is GRANTABLE to authenticated users.
-- The auth.uid() check inside the function gates access to the caller's
-- own garments; the serialized terminal-check + refund under the
-- render_credits FOR UPDATE lock prevents concurrency abuse.
REVOKE ALL ON FUNCTION delete_garment_with_release_atomic(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION delete_garment_with_release_atomic(UUID, UUID) TO authenticated, service_role;
