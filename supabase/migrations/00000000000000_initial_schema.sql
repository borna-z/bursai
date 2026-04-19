


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."subscription_plan" AS ENUM (
    'free',
    'premium'
);


ALTER TYPE "public"."subscription_plan" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."analytics_events_backfill"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.event_name IS NULL THEN
    NEW.event_name := NEW.event_type;
  END IF;
  IF NEW.properties IS NULL THEN
    NEW.properties := COALESCE(NEW.metadata, '{}'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."analytics_events_backfill"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_render_job"("p_job_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "user_id" "uuid", "garment_id" "uuid", "client_nonce" "text", "source" "text", "presentation" "text", "prompt_version" "text", "reserve_key" "text", "attempts" integer, "max_attempts" integer, "force" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
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
         v_row.force;
END;
$$;


ALTER FUNCTION "public"."claim_render_job"("p_job_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_jobs"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  DELETE FROM public.job_queue
  WHERE status IN ('completed', 'dead')
    AND updated_at < now() - interval '7 days';
$$;


ALTER FUNCTION "public"."cleanup_old_jobs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_credit_atomic"("p_user_id" "uuid", "p_job_id" "uuid", "p_idempotency_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_existing RECORD;
  v_reserve_tx RECORD;
  v_terminal_tx RECORD;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required for credit ledger mutations';
  END IF;

  SELECT id INTO v_existing
  FROM render_credit_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  PERFORM 1 FROM render_credits WHERE user_id = p_user_id FOR UPDATE;

  SELECT id INTO v_terminal_tx
  FROM render_credit_transactions
  WHERE render_job_id = p_job_id
    AND user_id = p_user_id
    AND kind IN ('consume', 'release')
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_terminal');
  END IF;

  SELECT source INTO v_reserve_tx
  FROM render_credit_transactions
  WHERE render_job_id = p_job_id
    AND kind = 'reserve'
    AND user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_reservation');
  END IF;

  IF v_reserve_tx.source = 'monthly' THEN
    UPDATE render_credits
    SET reserved = GREATEST(0, reserved - 1),
        used_this_period = used_this_period + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND reserved > 0;
  ELSE
    UPDATE render_credits
    SET reserved = GREATEST(0, reserved - 1),
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND reserved > 0;
  END IF;

  INSERT INTO render_credit_transactions (user_id, render_job_id, idempotency_key, kind, amount, source)
  VALUES (p_user_id, p_job_id, p_idempotency_key, 'consume', 1, v_reserve_tx.source);

  RETURN jsonb_build_object('ok', true, 'source', v_reserve_tx.source);
END;
$$;


ALTER FUNCTION "public"."consume_credit_atomic"("p_user_id" "uuid", "p_job_id" "uuid", "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_garment_with_release_atomic"("p_garment_id" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."delete_garment_with_release_atomic"("p_garment_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_trial_gift_atomic"("p_user_id" "uuid", "p_amount" integer, "p_idempotency_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_existing RECORD;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required for credit ledger mutations';
  END IF;

  SELECT id INTO v_existing
  FROM render_credit_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  UPDATE render_credits
  SET trial_gift_remaining = trial_gift_remaining + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO render_credit_transactions (user_id, idempotency_key, kind, amount, source)
  VALUES (p_user_id, p_idempotency_key, 'trial_gift', p_amount, 'trial_gift');

  RETURN jsonb_build_object('ok', true);
END;
$$;


ALTER FUNCTION "public"."grant_trial_gift_atomic"("p_user_id" "uuid", "p_amount" integer, "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  
  insert into public.subscriptions (user_id, plan, status, garments_count)
  values (new.id, 'free', 'active', 0)
  on conflict (user_id) do nothing;
  
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."init_render_credits"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO render_credits (user_id, monthly_allowance)
  VALUES (NEW.id, 0)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."init_render_credits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;


ALTER FUNCTION "public"."is_admin"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recover_stale_render_jobs"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."recover_stale_render_jobs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_credit_atomic"("p_user_id" "uuid", "p_job_id" "uuid", "p_idempotency_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_existing RECORD;
  v_reserve_tx RECORD;
  v_terminal_tx RECORD;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required for credit ledger mutations';
  END IF;

  SELECT id INTO v_existing
  FROM render_credit_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  PERFORM 1 FROM render_credits WHERE user_id = p_user_id FOR UPDATE;

  SELECT id INTO v_terminal_tx
  FROM render_credit_transactions
  WHERE render_job_id = p_job_id
    AND user_id = p_user_id
    AND kind IN ('consume', 'release')
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_terminal');
  END IF;

  SELECT source INTO v_reserve_tx
  FROM render_credit_transactions
  WHERE render_job_id = p_job_id
    AND kind = 'reserve'
    AND user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_reservation');
  END IF;

  IF v_reserve_tx.source = 'trial_gift' THEN
    UPDATE render_credits
    SET reserved = GREATEST(0, reserved - 1),
        trial_gift_remaining = trial_gift_remaining + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF v_reserve_tx.source = 'topup' THEN
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

  INSERT INTO render_credit_transactions (user_id, render_job_id, idempotency_key, kind, amount, source)
  VALUES (p_user_id, p_job_id, p_idempotency_key, 'release', 1, v_reserve_tx.source);

  RETURN jsonb_build_object('ok', true, 'source', v_reserve_tx.source);
END;
$$;


ALTER FUNCTION "public"."release_credit_atomic"("p_user_id" "uuid", "p_job_id" "uuid", "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_credit_atomic"("p_user_id" "uuid", "p_job_id" "uuid", "p_idempotency_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_existing RECORD;
  v_credits RECORD;
  v_source TEXT;
  v_updated INT;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required for credit ledger mutations';
  END IF;

  SELECT id, source INTO v_existing
  FROM render_credit_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'source', v_existing.source,
      'replay', true
    );
  END IF;

  PERFORM reset_period_if_needed(p_user_id);

  SELECT * INTO v_credits
  FROM render_credits
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_credit_row');
  END IF;

  IF v_credits.trial_gift_remaining > 0 THEN
    UPDATE render_credits
    SET trial_gift_remaining = trial_gift_remaining - 1,
        reserved = reserved + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND trial_gift_remaining > 0;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated > 0 THEN
      v_source := 'trial_gift';
    END IF;
  END IF;

  IF v_source IS NULL AND (v_credits.monthly_allowance - v_credits.used_this_period - v_credits.reserved) > 0 THEN
    UPDATE render_credits
    SET reserved = reserved + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND (monthly_allowance - used_this_period - reserved) > 0;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated > 0 THEN
      v_source := 'monthly';
    END IF;
  END IF;

  IF v_source IS NULL AND v_credits.topup_balance > 0 THEN
    UPDATE render_credits
    SET topup_balance = topup_balance - 1,
        reserved = reserved + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND topup_balance > 0;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated > 0 THEN
      v_source := 'topup';
    END IF;
  END IF;

  IF v_source IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient');
  END IF;

  INSERT INTO render_credit_transactions (user_id, render_job_id, idempotency_key, kind, amount, source)
  VALUES (p_user_id, p_job_id, p_idempotency_key, 'reserve', 1, v_source);

  RETURN jsonb_build_object(
    'ok', true,
    'source', v_source,
    'replay', false
  );
END;
$$;


ALTER FUNCTION "public"."reserve_credit_atomic"("p_user_id" "uuid", "p_job_id" "uuid", "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_expired_periods_batch"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE render_credits
  SET used_this_period = 0,
      period_start = NOW(),
      period_end = NOW() + INTERVAL '1 month',
      updated_at = NOW()
  WHERE period_end < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."reset_expired_periods_batch"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_period_if_needed"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE render_credits
  SET
    used_this_period = 0,
    period_start = NOW(),
    period_end = NOW() + INTERVAL '1 month',
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND period_end < NOW();
END;
$$;


ALTER FUNCTION "public"."reset_period_if_needed"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_monthly_allowance_atomic"("p_user_id" "uuid", "p_allowance" integer, "p_idempotency_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_existing RECORD;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required for credit ledger mutations';
  END IF;

  SELECT id INTO v_existing
  FROM render_credit_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  UPDATE render_credits
  SET monthly_allowance = p_allowance,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO render_credit_transactions (user_id, idempotency_key, kind, amount, source)
  VALUES (p_user_id, p_idempotency_key, 'grant', p_allowance, 'admin');

  RETURN jsonb_build_object('ok', true);
END;
$$;


ALTER FUNCTION "public"."set_monthly_allowance_atomic"("p_user_id" "uuid", "p_allowance" integer, "p_idempotency_key" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ai_rate_limits" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "requests_count" integer DEFAULT 0,
    "window_start" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "function_name" "text",
    "called_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_response_cache" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "cache_key" "text" NOT NULL,
    "response" "jsonb",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "model_used" "text",
    "hit_count" integer DEFAULT 0,
    "compressed" boolean DEFAULT false
);


ALTER TABLE "public"."ai_response_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "event_name" "text",
    "properties" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "event_type" "text",
    "metadata" "jsonb"
);


ALTER TABLE "public"."analytics_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_connections" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "access_token" "text",
    "refresh_token" "text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "calendar_id" "text",
    "token_expires_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."calendar_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "date" "date" NOT NULL,
    "start_time" "text",
    "end_time" "text",
    "location" "text",
    "provider" "text",
    "external_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."calendar_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challenge_participations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "challenge_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."challenge_participations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "mode" "text" DEFAULT 'stylist'::"text" NOT NULL
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checkout_attempts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."checkout_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_signals" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "signal_type" "text" NOT NULL,
    "outfit_id" "uuid",
    "garment_id" "uuid",
    "value" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."feedback_signals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friendships" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "friend_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."friendships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."garment_pair_memory" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "garment_id_a" "uuid",
    "garment_id_b" "uuid",
    "score" numeric DEFAULT 0,
    "times_worn_together" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "garment_a_id" "uuid",
    "garment_b_id" "uuid",
    "positive_count" integer DEFAULT 0 NOT NULL,
    "negative_count" integer DEFAULT 0 NOT NULL,
    "last_positive_at" timestamp with time zone,
    "last_negative_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."garment_pair_memory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."garments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "category" "text" NOT NULL,
    "subcategory" "text",
    "color_primary" "text",
    "color_secondary" "text",
    "pattern" "text",
    "material" "text",
    "fit" "text",
    "formality" integer DEFAULT 3,
    "season_tags" "text"[] DEFAULT '{}'::"text"[],
    "image_path" "text",
    "wear_count" integer DEFAULT 0,
    "last_worn_at" timestamp with time zone,
    "imported_via" "text",
    "enrichment_status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "ai_analyzed_at" timestamp with time zone,
    "ai_raw" "jsonb",
    "ai_provider" "text",
    "in_laundry" boolean DEFAULT false,
    "source_url" "text",
    "condition_score" numeric(3,1),
    "condition_notes" "text",
    "purchase_price" numeric(10,2),
    "purchase_currency" "text" DEFAULT 'SEK'::"text",
    "original_image_path" "text",
    "processed_image_path" "text",
    "image_processing_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "image_processing_provider" "text",
    "image_processing_version" "text",
    "image_processing_confidence" numeric(4,3),
    "image_processing_error" "text",
    "image_processed_at" timestamp with time zone,
    "rendered_image_path" "text",
    "render_status" "text" DEFAULT 'none'::"text" NOT NULL,
    "render_provider" "text",
    "render_error" "text",
    "rendered_at" timestamp with time zone,
    "render_presentation_used" "text",
    "silhouette" "text",
    "visual_weight" smallint,
    "texture_intensity" smallint,
    "style_archetype" "text",
    "occasion_tags" "text"[],
    "versatility_score" smallint,
    "fts" "tsvector" GENERATED ALWAYS AS ("to_tsvector"('"simple"'::"regconfig", ((((COALESCE("title", ''::"text") || ' '::"text") || COALESCE("category", ''::"text")) || ' '::"text") || COALESCE("color_primary", ''::"text")))) STORED,
    CONSTRAINT "garments_image_processing_status_check" CHECK (("image_processing_status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'ready'::"text", 'failed'::"text"]))),
    CONSTRAINT "garments_render_presentation_used_check" CHECK ((("render_presentation_used" IS NULL) OR ("render_presentation_used" = ANY (ARRAY['male'::"text", 'female'::"text", 'mixed'::"text"])))),
    CONSTRAINT "garments_render_status_check" CHECK (("render_status" = ANY (ARRAY['none'::"text", 'pending'::"text", 'rendering'::"text", 'ready'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."garments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inspiration_saves" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "image_url" "text",
    "tags" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inspiration_saves" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 3 NOT NULL,
    "user_id" "uuid",
    "result" "jsonb",
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "locked_until" timestamp with time zone
);


ALTER TABLE "public"."job_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" "text",
    "event_name" "text",
    "properties" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."marketing_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_leads" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" "text" NOT NULL,
    "source" "text",
    "utm_medium" "text",
    "utm_content" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."marketing_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outfit_feedback" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "outfit_id" "uuid",
    "rating" integer,
    "feedback" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "selfie_path" "text",
    "fit_score" numeric(3,1),
    "color_match_score" numeric(3,1),
    "overall_score" numeric(3,1),
    "commentary" "text",
    "ai_raw" "jsonb"
);


ALTER TABLE "public"."outfit_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outfit_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "outfit_id" "uuid" NOT NULL,
    "garment_id" "uuid" NOT NULL,
    "slot" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."outfit_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outfit_reactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "outfit_id" "uuid",
    "reaction" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."outfit_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outfits" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "occasion" "text",
    "style_vibe" "text",
    "explanation" "text",
    "weather" "jsonb",
    "confidence_score" numeric,
    "confidence_level" "text",
    "limitation_note" "text",
    "family_label" "text",
    "wardrobe_insights" "text"[],
    "outfit_reasoning" "jsonb",
    "is_saved" boolean DEFAULT false,
    "worn_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "feedback" "text"[],
    "flatlay_image_path" "text",
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "planned_for" "date",
    "rating" numeric(3,1) DEFAULT NULL::numeric,
    "saved" boolean DEFAULT false,
    "share_enabled" boolean DEFAULT false,
    "style_score" "jsonb"
);


ALTER TABLE "public"."outfits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planned_outfits" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "outfit_id" "uuid",
    "date" "date" NOT NULL,
    "occasion" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "note" "text",
    CONSTRAINT "planned_outfits_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'worn'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."planned_outfits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "home_city" "text",
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "avatar_path" "text",
    "body_image_path" "text",
    "height_cm" integer,
    "weight_kg" integer,
    "ics_url" "text",
    "last_calendar_sync" timestamp with time zone,
    "stripe_customer_id" "text",
    "username" "text",
    "is_premium" boolean DEFAULT false,
    "mannequin_presentation" "text" DEFAULT 'mixed'::"text" NOT NULL,
    "last_active_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_mannequin_presentation_check" CHECK (("mannequin_presentation" = ANY (ARRAY['male'::"text", 'female'::"text", 'mixed'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "bio" "text",
    "is_public" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."public_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text",
    "auth" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."render_credit_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "render_job_id" "uuid",
    "idempotency_key" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "amount" integer NOT NULL,
    "source" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "render_credit_transactions_kind_check" CHECK (("kind" = ANY (ARRAY['reserve'::"text", 'consume'::"text", 'release'::"text", 'grant'::"text", 'reset'::"text", 'trial_gift'::"text"]))),
    CONSTRAINT "render_credit_transactions_source_check" CHECK (("source" = ANY (ARRAY['monthly'::"text", 'topup'::"text", 'trial_gift'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."render_credit_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."render_credits" (
    "user_id" "uuid" NOT NULL,
    "monthly_allowance" integer DEFAULT 0 NOT NULL,
    "used_this_period" integer DEFAULT 0 NOT NULL,
    "reserved" integer DEFAULT 0 NOT NULL,
    "topup_balance" integer DEFAULT 0 NOT NULL,
    "trial_gift_remaining" integer DEFAULT 0 NOT NULL,
    "period_start" timestamp with time zone DEFAULT "now"() NOT NULL,
    "period_end" timestamp with time zone DEFAULT ("now"() + '1 mon'::interval) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."render_credits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."render_jobs" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "garment_id" "uuid" NOT NULL,
    "client_nonce" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 3 NOT NULL,
    "source" "text" NOT NULL,
    "presentation" "text" NOT NULL,
    "prompt_version" "text" NOT NULL,
    "reserve_key" "text" NOT NULL,
    "force" boolean DEFAULT false NOT NULL,
    "result_path" "text",
    "error" "text",
    "error_class" "text",
    "locked_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    CONSTRAINT "render_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'succeeded'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."render_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "stripe_event_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "data" "jsonb",
    "processed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stripe_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."style_challenges" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "start_date" "date",
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."style_challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan" "text" DEFAULT 'free'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "garments_count" integer DEFAULT 0,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "current_period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "stripe_mode" "text",
    "price_id" "text"
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."swap_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "outfit_id" "uuid",
    "swapped_out_garment_id" "uuid",
    "swapped_in_garment_id" "uuid",
    "swap_mode" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."swap_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."travel_capsules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "destination" "text" NOT NULL,
    "trip_type" "text" DEFAULT 'mixed'::"text",
    "duration_days" integer NOT NULL,
    "weather_min" integer,
    "weather_max" integer,
    "occasions" "text"[],
    "capsule_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "outfits" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "packing_list" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "packing_tips" "text"[],
    "total_combinations" integer,
    "reasoning" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "start_date" "date",
    "end_date" "date",
    "luggage_type" "text" DEFAULT 'carry_on_personal'::"text",
    "companions" "text" DEFAULT 'solo'::"text",
    "style_preference" "text" DEFAULT 'balanced'::"text",
    "result" "jsonb"
);


ALTER TABLE "public"."travel_capsules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_style_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "dominant_archetype" "text",
    "secondary_archetype" "text",
    "signature_colors" "jsonb" DEFAULT '[]'::"jsonb",
    "formality_center" double precision,
    "uniform_combos" "jsonb" DEFAULT '[]'::"jsonb",
    "texture_preference" "text",
    "fit_preference" "text",
    "total_garments" integer DEFAULT 0,
    "computation_basis" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_style_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_subscriptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan" "text" DEFAULT 'free'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "garments_count" integer DEFAULT 0 NOT NULL,
    "outfits_used_month" integer DEFAULT 0 NOT NULL,
    "period_start" timestamp with time zone DEFAULT "date_trunc"('month'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wear_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "outfit_id" "uuid",
    "garment_id" "uuid",
    "worn_at" timestamp with time zone DEFAULT "now"(),
    "occasion" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "event_title" "text"
);


ALTER TABLE "public"."wear_logs" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ai_rate_limits"
    ADD CONSTRAINT "ai_rate_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_response_cache"
    ADD CONSTRAINT "ai_response_cache_cache_key_key" UNIQUE ("cache_key");



ALTER TABLE ONLY "public"."ai_response_cache"
    ADD CONSTRAINT "ai_response_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_connections"
    ADD CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."challenge_participations"
    ADD CONSTRAINT "challenge_participations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checkout_attempts"
    ADD CONSTRAINT "checkout_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_signals"
    ADD CONSTRAINT "feedback_signals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."garment_pair_memory"
    ADD CONSTRAINT "garment_pair_memory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."garments"
    ADD CONSTRAINT "garments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inspiration_saves"
    ADD CONSTRAINT "inspiration_saves_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_queue"
    ADD CONSTRAINT "job_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_events"
    ADD CONSTRAINT "marketing_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_leads"
    ADD CONSTRAINT "marketing_leads_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."marketing_leads"
    ADD CONSTRAINT "marketing_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outfit_feedback"
    ADD CONSTRAINT "outfit_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outfit_items"
    ADD CONSTRAINT "outfit_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outfit_reactions"
    ADD CONSTRAINT "outfit_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outfits"
    ADD CONSTRAINT "outfits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planned_outfits"
    ADD CONSTRAINT "planned_outfits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."public_profiles"
    ADD CONSTRAINT "public_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."public_profiles"
    ADD CONSTRAINT "public_profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."render_credit_transactions"
    ADD CONSTRAINT "render_credit_transactions_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."render_credit_transactions"
    ADD CONSTRAINT "render_credit_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."render_credits"
    ADD CONSTRAINT "render_credits_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."render_jobs"
    ADD CONSTRAINT "render_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."render_jobs"
    ADD CONSTRAINT "render_jobs_reserve_key_key" UNIQUE ("reserve_key");



ALTER TABLE ONLY "public"."stripe_events"
    ADD CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_events"
    ADD CONSTRAINT "stripe_events_stripe_event_id_key" UNIQUE ("stripe_event_id");



ALTER TABLE ONLY "public"."style_challenges"
    ADD CONSTRAINT "style_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."swap_events"
    ADD CONSTRAINT "swap_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."travel_capsules"
    ADD CONSTRAINT "travel_capsules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_style_profiles"
    ADD CONSTRAINT "user_style_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."wear_logs"
    ADD CONSTRAINT "wear_logs_pkey" PRIMARY KEY ("id");



CREATE INDEX "ai_rate_limits_user_fn_idx" ON "public"."ai_rate_limits" USING "btree" ("user_id", "function_name", "called_at");



CREATE INDEX "calendar_events_user_date_idx" ON "public"."calendar_events" USING "btree" ("user_id", "date");



CREATE INDEX "chat_messages_user_mode_created_idx" ON "public"."chat_messages" USING "btree" ("user_id", "mode", "created_at" DESC);



CREATE INDEX "feedback_signals_user_type_idx" ON "public"."feedback_signals" USING "btree" ("user_id", "signal_type", "created_at" DESC);



CREATE INDEX "garments_fts_idx" ON "public"."garments" USING "gin" ("fts");



CREATE INDEX "garments_occasion_tags_idx" ON "public"."garments" USING "gin" ("occasion_tags") WHERE ("occasion_tags" IS NOT NULL);



CREATE INDEX "garments_style_archetype_idx" ON "public"."garments" USING "btree" ("style_archetype") WHERE ("style_archetype" IS NOT NULL);



CREATE INDEX "garments_user_wear_idx" ON "public"."garments" USING "btree" ("user_id", "wear_count" DESC, "last_worn_at" DESC);



CREATE INDEX "garments_visual_weight_idx" ON "public"."garments" USING "btree" ("visual_weight") WHERE ("visual_weight" IS NOT NULL);



CREATE INDEX "idx_ai_cache_expires" ON "public"."ai_response_cache" USING "btree" ("expires_at");



CREATE INDEX "idx_ai_rate_limits_user_fn_time" ON "public"."ai_rate_limits" USING "btree" ("user_id", "function_name", "called_at" DESC);



CREATE INDEX "idx_ai_response_cache_key_expires" ON "public"."ai_response_cache" USING "btree" ("cache_key", "expires_at");



CREATE INDEX "idx_garments_category" ON "public"."garments" USING "btree" ("category");



CREATE INDEX "idx_garments_color_primary" ON "public"."garments" USING "btree" ("color_primary");



CREATE INDEX "idx_garments_enrichment_status" ON "public"."garments" USING "btree" ("enrichment_status") WHERE ("enrichment_status" = 'in_progress'::"text");



CREATE INDEX "idx_garments_processing_status" ON "public"."garments" USING "btree" ("image_processing_status") WHERE ("image_processing_status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "idx_garments_render_status" ON "public"."garments" USING "btree" ("render_status") WHERE ("render_status" = ANY (ARRAY['pending'::"text", 'rendering'::"text"]));



CREATE INDEX "idx_garments_user_available" ON "public"."garments" USING "btree" ("user_id") WHERE ("in_laundry" = false);



CREATE INDEX "idx_garments_user_created" ON "public"."garments" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_garments_user_last_worn" ON "public"."garments" USING "btree" ("user_id", "last_worn_at" DESC NULLS LAST);



CREATE INDEX "idx_garments_user_source_url" ON "public"."garments" USING "btree" ("user_id", "source_url") WHERE ("source_url" IS NOT NULL);



CREATE INDEX "idx_garments_user_wear_count" ON "public"."garments" USING "btree" ("user_id", "wear_count" DESC NULLS LAST);



CREATE INDEX "idx_job_queue_claim" ON "public"."job_queue" USING "btree" ("job_type", "status", "locked_until", "priority" DESC, "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "idx_job_queue_user_status" ON "public"."job_queue" USING "btree" ("user_id", "status", "created_at" DESC);



CREATE INDEX "idx_outfit_items_garment_id" ON "public"."outfit_items" USING "btree" ("garment_id");



CREATE INDEX "idx_outfit_items_outfit_id" ON "public"."outfit_items" USING "btree" ("outfit_id");



CREATE INDEX "idx_outfits_planned_for" ON "public"."outfits" USING "btree" ("planned_for") WHERE ("planned_for" IS NOT NULL);



CREATE INDEX "idx_outfits_user_generated" ON "public"."outfits" USING "btree" ("user_id", "generated_at" DESC NULLS LAST);



CREATE INDEX "idx_outfits_user_saved" ON "public"."outfits" USING "btree" ("user_id") WHERE ("saved" = true);



CREATE INDEX "idx_pair_memory_user" ON "public"."garment_pair_memory" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_last_active_at" ON "public"."profiles" USING "btree" ("last_active_at" DESC);



CREATE INDEX "idx_profiles_username" ON "public"."profiles" USING "btree" ("username");



CREATE INDEX "idx_render_credit_tx_job" ON "public"."render_credit_transactions" USING "btree" ("render_job_id");



CREATE UNIQUE INDEX "idx_render_credit_tx_terminal_unique" ON "public"."render_credit_transactions" USING "btree" ("render_job_id") WHERE (("kind" = ANY (ARRAY['consume'::"text", 'release'::"text"])) AND ("render_job_id" IS NOT NULL));



CREATE INDEX "idx_render_credit_tx_user" ON "public"."render_credit_transactions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_render_jobs_claim" ON "public"."render_jobs" USING "btree" ("status", "locked_until" NULLS FIRST, "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text"]));



CREATE INDEX "idx_render_jobs_garment" ON "public"."render_jobs" USING "btree" ("garment_id", "created_at" DESC);



CREATE INDEX "idx_render_jobs_user_active" ON "public"."render_jobs" USING "btree" ("user_id", "created_at" DESC) WHERE ("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text"]));



CREATE INDEX "idx_subscriptions_user_id" ON "public"."subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_travel_capsules_user" ON "public"."travel_capsules" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_wear_logs_garment_id" ON "public"."wear_logs" USING "btree" ("garment_id");



CREATE INDEX "idx_wear_logs_user_worn" ON "public"."wear_logs" USING "btree" ("user_id", "worn_at" DESC);



CREATE INDEX "outfits_user_generated_idx" ON "public"."outfits" USING "btree" ("user_id", "generated_at" DESC);



CREATE INDEX "swap_events_swapped_out_idx" ON "public"."swap_events" USING "btree" ("swapped_out_garment_id");



CREATE INDEX "swap_events_user_id_idx" ON "public"."swap_events" USING "btree" ("user_id");



CREATE INDEX "travel_capsules_destination_idx" ON "public"."travel_capsules" USING "btree" ("user_id", "destination");



CREATE INDEX "travel_capsules_user_id_idx" ON "public"."travel_capsules" USING "btree" ("user_id");



CREATE UNIQUE INDEX "user_style_profiles_user_id_idx" ON "public"."user_style_profiles" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "analytics_events_backfill_trigger" BEFORE INSERT ON "public"."analytics_events" FOR EACH ROW EXECUTE FUNCTION "public"."analytics_events_backfill"();



ALTER TABLE ONLY "public"."ai_rate_limits"
    ADD CONSTRAINT "ai_rate_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_connections"
    ADD CONSTRAINT "calendar_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_participations"
    ADD CONSTRAINT "challenge_participations_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."style_challenges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_participations"
    ADD CONSTRAINT "challenge_participations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checkout_attempts"
    ADD CONSTRAINT "checkout_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_signals"
    ADD CONSTRAINT "feedback_signals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_friend_id_fkey" FOREIGN KEY ("friend_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."garment_pair_memory"
    ADD CONSTRAINT "garment_pair_memory_garment_id_a_fkey" FOREIGN KEY ("garment_id_a") REFERENCES "public"."garments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."garment_pair_memory"
    ADD CONSTRAINT "garment_pair_memory_garment_id_b_fkey" FOREIGN KEY ("garment_id_b") REFERENCES "public"."garments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."garment_pair_memory"
    ADD CONSTRAINT "garment_pair_memory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."garments"
    ADD CONSTRAINT "garments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inspiration_saves"
    ADD CONSTRAINT "inspiration_saves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_queue"
    ADD CONSTRAINT "job_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."outfit_feedback"
    ADD CONSTRAINT "outfit_feedback_outfit_id_fkey" FOREIGN KEY ("outfit_id") REFERENCES "public"."outfits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outfit_feedback"
    ADD CONSTRAINT "outfit_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outfit_items"
    ADD CONSTRAINT "outfit_items_garment_id_fkey" FOREIGN KEY ("garment_id") REFERENCES "public"."garments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outfit_items"
    ADD CONSTRAINT "outfit_items_outfit_id_fkey" FOREIGN KEY ("outfit_id") REFERENCES "public"."outfits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outfit_reactions"
    ADD CONSTRAINT "outfit_reactions_outfit_id_fkey" FOREIGN KEY ("outfit_id") REFERENCES "public"."outfits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outfit_reactions"
    ADD CONSTRAINT "outfit_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outfits"
    ADD CONSTRAINT "outfits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planned_outfits"
    ADD CONSTRAINT "planned_outfits_outfit_id_fkey" FOREIGN KEY ("outfit_id") REFERENCES "public"."outfits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planned_outfits"
    ADD CONSTRAINT "planned_outfits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."public_profiles"
    ADD CONSTRAINT "public_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."render_credit_transactions"
    ADD CONSTRAINT "render_credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."render_credits"
    ADD CONSTRAINT "render_credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."render_jobs"
    ADD CONSTRAINT "render_jobs_garment_id_fkey" FOREIGN KEY ("garment_id") REFERENCES "public"."garments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."render_jobs"
    ADD CONSTRAINT "render_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."swap_events"
    ADD CONSTRAINT "swap_events_outfit_id_fkey" FOREIGN KEY ("outfit_id") REFERENCES "public"."outfits"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."swap_events"
    ADD CONSTRAINT "swap_events_swapped_in_garment_id_fkey" FOREIGN KEY ("swapped_in_garment_id") REFERENCES "public"."garments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."swap_events"
    ADD CONSTRAINT "swap_events_swapped_out_garment_id_fkey" FOREIGN KEY ("swapped_out_garment_id") REFERENCES "public"."garments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."swap_events"
    ADD CONSTRAINT "swap_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."travel_capsules"
    ADD CONSTRAINT "travel_capsules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_style_profiles"
    ADD CONSTRAINT "user_style_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wear_logs"
    ADD CONSTRAINT "wear_logs_garment_id_fkey" FOREIGN KEY ("garment_id") REFERENCES "public"."garments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wear_logs"
    ADD CONSTRAINT "wear_logs_outfit_id_fkey" FOREIGN KEY ("outfit_id") REFERENCES "public"."outfits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wear_logs"
    ADD CONSTRAINT "wear_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Service role full access" ON "public"."job_queue" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to style profiles" ON "public"."user_style_profiles" USING (true) WITH CHECK (true);



CREATE POLICY "Users can insert own style profile" ON "public"."user_style_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own swap events" ON "public"."swap_events" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own calendar connections" ON "public"."calendar_connections" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own calendar events" ON "public"."calendar_events" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own chat messages" ON "public"."chat_messages" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own feedback signals" ON "public"."feedback_signals" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own garment pairs" ON "public"."garment_pair_memory" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own garments" ON "public"."garments" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own outfit feedback" ON "public"."outfit_feedback" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own outfit items" ON "public"."outfit_items" USING ((EXISTS ( SELECT 1
   FROM "public"."outfits"
  WHERE (("outfits"."id" = "outfit_items"."outfit_id") AND ("outfits"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage own outfit reactions" ON "public"."outfit_reactions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own outfits" ON "public"."outfits" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own planned outfits" ON "public"."planned_outfits" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own profile" ON "public"."profiles" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can manage own push subscriptions" ON "public"."push_subscriptions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own rate limits" ON "public"."ai_rate_limits" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own roles" ON "public"."user_roles" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own subscription" ON "public"."subscriptions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own user subscriptions" ON "public"."user_subscriptions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own wear logs" ON "public"."wear_logs" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own style profile" ON "public"."user_style_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own swap events" ON "public"."swap_events" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own style profile" ON "public"."user_style_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own jobs" ON "public"."job_queue" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users read own credits" ON "public"."render_credits" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users read own render jobs" ON "public"."render_jobs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users read own transactions" ON "public"."render_credit_transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."ai_rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_response_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "analytics_events_deny_select" ON "public"."analytics_events" FOR SELECT USING (false);



CREATE POLICY "analytics_events_insert_anon" ON "public"."analytics_events" FOR INSERT WITH CHECK (("user_id" IS NULL));



CREATE POLICY "analytics_events_insert_self" ON "public"."analytics_events" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."calendar_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."challenge_participations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "challenge_participations_owner_delete" ON "public"."challenge_participations" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "challenge_participations_owner_insert" ON "public"."challenge_participations" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "challenge_participations_owner_select" ON "public"."challenge_participations" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "challenge_participations_owner_update" ON "public"."challenge_participations" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checkout_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "checkout_attempts_owner_delete" ON "public"."checkout_attempts" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "checkout_attempts_owner_insert" ON "public"."checkout_attempts" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "checkout_attempts_owner_select" ON "public"."checkout_attempts" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "checkout_attempts_owner_update" ON "public"."checkout_attempts" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."feedback_signals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."friendships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "friendships_owner_delete" ON "public"."friendships" FOR DELETE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR (( SELECT "auth"."uid"() AS "uid") = "friend_id")));



CREATE POLICY "friendships_owner_insert" ON "public"."friendships" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR (( SELECT "auth"."uid"() AS "uid") = "friend_id")));



CREATE POLICY "friendships_owner_select" ON "public"."friendships" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR (( SELECT "auth"."uid"() AS "uid") = "friend_id")));



CREATE POLICY "friendships_owner_update" ON "public"."friendships" FOR UPDATE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR (( SELECT "auth"."uid"() AS "uid") = "friend_id"))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR (( SELECT "auth"."uid"() AS "uid") = "friend_id")));



ALTER TABLE "public"."garment_pair_memory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."garments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inspiration_saves" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inspiration_saves_owner_delete" ON "public"."inspiration_saves" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "inspiration_saves_owner_insert" ON "public"."inspiration_saves" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "inspiration_saves_owner_select" ON "public"."inspiration_saves" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "inspiration_saves_owner_update" ON "public"."inspiration_saves" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."job_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outfit_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outfit_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outfit_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outfits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."planned_outfits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_profiles_owner_delete" ON "public"."public_profiles" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "public_profiles_owner_insert" ON "public"."public_profiles" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "public_profiles_owner_select" ON "public"."public_profiles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "public_profiles_owner_update" ON "public"."public_profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "public_profiles_public_select" ON "public"."public_profiles" FOR SELECT USING (("is_public" = true));



ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."render_credit_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."render_credits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."render_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."style_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."swap_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."travel_capsules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_style_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users own their capsules" ON "public"."travel_capsules" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."wear_logs" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."analytics_events_backfill"() TO "anon";
GRANT ALL ON FUNCTION "public"."analytics_events_backfill"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."analytics_events_backfill"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_render_job"("p_job_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_render_job"("p_job_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_jobs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_jobs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_jobs"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_credit_atomic"("p_user_id" "uuid", "p_job_id" "uuid", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_credit_atomic"("p_user_id" "uuid", "p_job_id" "uuid", "p_idempotency_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_garment_with_release_atomic"("p_garment_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_garment_with_release_atomic"("p_garment_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_garment_with_release_atomic"("p_garment_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."grant_trial_gift_atomic"("p_user_id" "uuid", "p_amount" integer, "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."grant_trial_gift_atomic"("p_user_id" "uuid", "p_amount" integer, "p_idempotency_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."init_render_credits"() TO "anon";
GRANT ALL ON FUNCTION "public"."init_render_credits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."init_render_credits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."recover_stale_render_jobs"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recover_stale_render_jobs"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."release_credit_atomic"("p_user_id" "uuid", "p_job_id" "uuid", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."release_credit_atomic"("p_user_id" "uuid", "p_job_id" "uuid", "p_idempotency_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reserve_credit_atomic"("p_user_id" "uuid", "p_job_id" "uuid", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reserve_credit_atomic"("p_user_id" "uuid", "p_job_id" "uuid", "p_idempotency_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reset_expired_periods_batch"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reset_expired_periods_batch"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."reset_period_if_needed"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reset_period_if_needed"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_monthly_allowance_atomic"("p_user_id" "uuid", "p_allowance" integer, "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_monthly_allowance_atomic"("p_user_id" "uuid", "p_allowance" integer, "p_idempotency_key" "text") TO "service_role";



GRANT ALL ON TABLE "public"."ai_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."ai_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."ai_response_cache" TO "anon";
GRANT ALL ON TABLE "public"."ai_response_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_response_cache" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_events" TO "anon";
GRANT ALL ON TABLE "public"."analytics_events" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_events" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_connections" TO "anon";
GRANT ALL ON TABLE "public"."calendar_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_connections" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_events" TO "anon";
GRANT ALL ON TABLE "public"."calendar_events" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_events" TO "service_role";



GRANT ALL ON TABLE "public"."challenge_participations" TO "anon";
GRANT ALL ON TABLE "public"."challenge_participations" TO "authenticated";
GRANT ALL ON TABLE "public"."challenge_participations" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."checkout_attempts" TO "anon";
GRANT ALL ON TABLE "public"."checkout_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."checkout_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_signals" TO "anon";
GRANT ALL ON TABLE "public"."feedback_signals" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_signals" TO "service_role";



GRANT ALL ON TABLE "public"."friendships" TO "anon";
GRANT ALL ON TABLE "public"."friendships" TO "authenticated";
GRANT ALL ON TABLE "public"."friendships" TO "service_role";



GRANT ALL ON TABLE "public"."garment_pair_memory" TO "anon";
GRANT ALL ON TABLE "public"."garment_pair_memory" TO "authenticated";
GRANT ALL ON TABLE "public"."garment_pair_memory" TO "service_role";



GRANT ALL ON TABLE "public"."garments" TO "anon";
GRANT ALL ON TABLE "public"."garments" TO "authenticated";
GRANT ALL ON TABLE "public"."garments" TO "service_role";



GRANT ALL ON TABLE "public"."inspiration_saves" TO "anon";
GRANT ALL ON TABLE "public"."inspiration_saves" TO "authenticated";
GRANT ALL ON TABLE "public"."inspiration_saves" TO "service_role";



GRANT ALL ON TABLE "public"."job_queue" TO "anon";
GRANT ALL ON TABLE "public"."job_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."job_queue" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_events" TO "anon";
GRANT ALL ON TABLE "public"."marketing_events" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_events" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_leads" TO "anon";
GRANT ALL ON TABLE "public"."marketing_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_leads" TO "service_role";



GRANT ALL ON TABLE "public"."outfit_feedback" TO "anon";
GRANT ALL ON TABLE "public"."outfit_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."outfit_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."outfit_items" TO "anon";
GRANT ALL ON TABLE "public"."outfit_items" TO "authenticated";
GRANT ALL ON TABLE "public"."outfit_items" TO "service_role";



GRANT ALL ON TABLE "public"."outfit_reactions" TO "anon";
GRANT ALL ON TABLE "public"."outfit_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."outfit_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."outfits" TO "anon";
GRANT ALL ON TABLE "public"."outfits" TO "authenticated";
GRANT ALL ON TABLE "public"."outfits" TO "service_role";



GRANT ALL ON TABLE "public"."planned_outfits" TO "anon";
GRANT ALL ON TABLE "public"."planned_outfits" TO "authenticated";
GRANT ALL ON TABLE "public"."planned_outfits" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."public_profiles" TO "anon";
GRANT ALL ON TABLE "public"."public_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."public_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."render_credit_transactions" TO "anon";
GRANT ALL ON TABLE "public"."render_credit_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."render_credit_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."render_credits" TO "anon";
GRANT ALL ON TABLE "public"."render_credits" TO "authenticated";
GRANT ALL ON TABLE "public"."render_credits" TO "service_role";



GRANT ALL ON TABLE "public"."render_jobs" TO "anon";
GRANT ALL ON TABLE "public"."render_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."render_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_events" TO "anon";
GRANT ALL ON TABLE "public"."stripe_events" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_events" TO "service_role";



GRANT ALL ON TABLE "public"."style_challenges" TO "anon";
GRANT ALL ON TABLE "public"."style_challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."style_challenges" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."swap_events" TO "anon";
GRANT ALL ON TABLE "public"."swap_events" TO "authenticated";
GRANT ALL ON TABLE "public"."swap_events" TO "service_role";



GRANT ALL ON TABLE "public"."travel_capsules" TO "anon";
GRANT ALL ON TABLE "public"."travel_capsules" TO "authenticated";
GRANT ALL ON TABLE "public"."travel_capsules" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_style_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_style_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_style_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."wear_logs" TO "anon";
GRANT ALL ON TABLE "public"."wear_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."wear_logs" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







