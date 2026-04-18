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

CREATE TABLE render_jobs (
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
CREATE INDEX idx_render_jobs_claim
  ON render_jobs (status, locked_until NULLS FIRST, created_at)
  WHERE status IN ('pending','in_progress');

-- Client-side "show all my in-flight renders" and per-garment
-- "is this one done yet?" queries.
CREATE INDEX idx_render_jobs_garment
  ON render_jobs (garment_id, created_at DESC);

CREATE INDEX idx_render_jobs_user_active
  ON render_jobs (user_id, created_at DESC)
  WHERE status IN ('pending','in_progress');

-- RLS: users read their own jobs. Writes are service-role only
-- (enqueue_render_job + process_render_jobs + the two RPCs below).
ALTER TABLE render_jobs ENABLE ROW LEVEL SECURITY;

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
-- service-role key out of pg_settings (where authenticated users
-- can read it via current_setting('app.*')) and out of any committed
-- SQL. Supabase's vault schema encrypts the secret at rest and
-- decrypts transparently when read as superuser.
--
-- URL is the project's public functions endpoint — safe to commit.
-- The Authorization header is built at cron-exec time by selecting
-- the current secret value. If the secret isn't inserted (first
-- deploy), the SELECT returns NULL, the Authorization becomes
-- 'Bearer ', the HTTP call 401s, and the worker just doesn't run
-- via cron. The client-initiated path (enqueue_render_job's internal
-- POST) still works. Non-fatal but the safety net is dead until the
-- secret is inserted, so post-deploy smoke test is required.
--
-- ONE-TIME POST-DEPLOY STEP:
--   After db push applies this migration, run ONCE via Supabase SQL
--   editor (Database → SQL Editor):
--
--     INSERT INTO vault.secrets (name, secret)
--     VALUES ('service_role_key', '<your SUPABASE_SERVICE_ROLE_KEY value>')
--     ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
--
--   Retrieve the value from Supabase dashboard → Settings → API →
--   service_role secret. Verify with:
--
--     SELECT cron.schedule_in_database('process-render-jobs');  -- row exists
--     SELECT name FROM vault.secrets WHERE name = 'service_role_key';
--
--   First successful cron run appears in `cron.job_run_details` within
--   60s with status='succeeded' and return_message='200'.

-- Intentional no COALESCE fallback on the secret SELECT:
-- If the vault secret is missing, the subquery returns NULL. `'Bearer ' || NULL`
-- evaluates to NULL, and `net.http_post` with a NULL header value raises a
-- not-null violation inside the cron execution. The error lands in
-- cron.job_run_details with status='failed' — LOUD operational signal that
-- the one-time `INSERT INTO vault.secrets ('service_role_key', ...)` step
-- was skipped. Previous versions used COALESCE(..., '') which silently sent
-- an empty-bearer 401 and showed status='succeeded' with return_message='401',
-- making the broken state invisible in standard monitoring.
SELECT cron.schedule(
  'process-render-jobs',
  '*/1 * * * *',  -- every 1 minute (pg_cron's smallest standard interval)
  $$
  SELECT net.http_post(
    url := 'https://khvkwojtlkcvxjxztduj.supabase.co/functions/v1/process_render_jobs',
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

-- ─── RPC: Release active render_jobs for a garment (pre-delete cleanup) ──
-- Called by clients BEFORE they delete a garment, so render_jobs rows that
-- are still non-terminal (pending / in_progress) get their reservations
-- released before CASCADE wipes the job rows and orphans the reserves.
--
-- Codex round 12 Bug 2: without this, `DELETE FROM garments WHERE id=X`
-- cascades render_jobs rows for X, but render_credit_transactions has no
-- FK to render_jobs — the `reserve` txs for those jobs stay in the ledger
-- with no matching job_id. The user's `render_credits.reserved` counter
-- stays elevated forever because no release can ever fire (no job, no
-- worker terminal path). Eventually the reserved count caps out available
-- credits and the user can't enqueue new renders.
--
-- Authorization: SECURITY DEFINER so authenticated users can call this
-- for garments they OWN. Ownership check: auth.uid() must match the
-- garment's user_id, OR caller is service_role (for admin tooling /
-- seed_wardrobe).
--
-- Idempotency: uses a stable 'release:garment_delete:<jobid>' idempotency
-- key. Repeated calls (e.g. delete retry after transient failure) hit
-- ON CONFLICT DO NOTHING and don't double-decrement the reserved counter.
--
-- Returns the count of reservations released. Callers typically log this
-- for observability.

CREATE OR REPLACE FUNCTION release_reservations_for_garment_delete(p_garment_id UUID)
RETURNS INT AS $$
DECLARE
  v_released_count INT := 0;
  v_job RECORD;
  v_reserve_source TEXT;
  v_terminal_exists INT;
  v_owner UUID;
BEGIN
  -- Ownership gate. Service role (e.g. seed_wardrobe) bypasses the
  -- auth.uid() check for admin / cleanup paths.
  SELECT user_id INTO v_owner FROM garments WHERE id = p_garment_id;
  IF v_owner IS NULL THEN
    -- Garment doesn't exist (already deleted / never existed). Nothing to
    -- release. Not an error — caller can proceed with their delete.
    RETURN 0;
  END IF;
  IF v_owner IS DISTINCT FROM auth.uid() AND (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not authorized to release reservations for garment %', p_garment_id;
  END IF;

  FOR v_job IN
    SELECT id, user_id FROM render_jobs
    WHERE garment_id = p_garment_id
      AND status IN ('pending', 'in_progress')
  LOOP
    -- Find the reserve source for this job.
    SELECT source INTO v_reserve_source
    FROM render_credit_transactions
    WHERE render_job_id = v_job.id
      AND kind = 'reserve'
      AND user_id = v_job.user_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_reserve_source IS NULL THEN
      -- No reserve exists for this job. Shouldn't happen under normal
      -- enqueue flow, but defensive — skip to the next job.
      CONTINUE;
    END IF;

    -- Skip if already terminalized (consume or release already written).
    SELECT 1 INTO v_terminal_exists
    FROM render_credit_transactions
    WHERE render_job_id = v_job.id
      AND user_id = v_job.user_id
      AND kind IN ('consume', 'release')
    LIMIT 1;
    IF v_terminal_exists IS NOT NULL THEN
      CONTINUE;
    END IF;

    -- Decrement reserved counter and refund to the original source.
    -- Mirrors release_credit_atomic's source-specific refund logic.
    IF v_reserve_source = 'trial_gift' THEN
      UPDATE render_credits
      SET reserved = GREATEST(0, reserved - 1),
          trial_gift_remaining = trial_gift_remaining + 1,
          updated_at = NOW()
      WHERE user_id = v_job.user_id;
    ELSIF v_reserve_source = 'topup' THEN
      UPDATE render_credits
      SET reserved = GREATEST(0, reserved - 1),
          topup_balance = topup_balance + 1,
          updated_at = NOW()
      WHERE user_id = v_job.user_id;
    ELSE
      -- monthly source
      UPDATE render_credits
      SET reserved = GREATEST(0, reserved - 1),
          updated_at = NOW()
      WHERE user_id = v_job.user_id;
    END IF;

    -- Write the release tx. Idempotent via UNIQUE idempotency_key.
    INSERT INTO render_credit_transactions
      (user_id, render_job_id, idempotency_key, kind, amount, source)
    VALUES
      (v_job.user_id, v_job.id, 'release:garment_delete:' || v_job.id::text, 'release', 1, v_reserve_source)
    ON CONFLICT (idempotency_key) DO NOTHING;

    v_released_count := v_released_count + 1;
  END LOOP;

  RETURN v_released_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Lockdown: service-role only on RPCs ────────────────────
-- Defense-in-depth with the role guard inside each function.
REVOKE ALL ON FUNCTION claim_render_job(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION recover_stale_render_jobs() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION claim_render_job(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION recover_stale_render_jobs() TO service_role;

-- release_reservations_for_garment_delete is intentionally GRANTABLE to
-- authenticated users: the ownership check inside the function (auth.uid()
-- = garment.user_id) prevents abuse. Service role is implied but listed
-- for symmetry.
REVOKE ALL ON FUNCTION release_reservations_for_garment_delete(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION release_reservations_for_garment_delete(UUID) TO authenticated, service_role;
