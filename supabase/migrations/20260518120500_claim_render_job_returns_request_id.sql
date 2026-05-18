-- Sprint PR 7 follow-up (Codex round 2 P2): expose render_jobs.request_id
-- to the worker on every claim.
--
-- The base claim_render_job RETURNS TABLE (defined in
-- 00000000000000_initial_schema.sql:53) does not surface the persisted
-- request_id added by 20260518120400_add_request_id_columns.sql. Without
-- it, the worker on the cron / safety-net path (no inbound x-request-id)
-- and the batch-fill loop (p_job_id := NULL) forward a freshly-minted
-- worker uuid to render_garment_image instead of the request_id the
-- enqueue-time mobile client stamped onto the row. End-to-end correlation
-- breaks for any render that didn't enter via a single low-latency POST.
--
-- Fix: replace the function with one extra column on the OUT shape. The
-- BODY is unchanged — same SECURITY DEFINER guard, same
-- FOR UPDATE SKIP LOCKED claim, same status / locked_until / attempts
-- update. Only the trailing SELECT propagates the existing column.
--
-- Idempotent: CREATE OR REPLACE with the new RETURNS TABLE signature.
-- Postgres requires a DROP first when the OUT columns change shape, so
-- guard with IF EXISTS to keep the migration re-runnable on a partially-
-- applied environment.

DROP FUNCTION IF EXISTS public.claim_render_job(uuid);

CREATE OR REPLACE FUNCTION public.claim_render_job(p_job_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  garment_id uuid,
  client_nonce text,
  source text,
  presentation text,
  prompt_version text,
  reserve_key text,
  attempts integer,
  max_attempts integer,
  force boolean,
  request_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
         v_row.force, v_row.request_id;
END;
$$;

ALTER FUNCTION public.claim_render_job(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.claim_render_job(uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_render_job(uuid) TO service_role;
