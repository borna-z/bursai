-- ============================================================
-- Source-control catch-up for the first reserve_credit_replay_flag
-- apply on 2026-04-16 23:36:54 UTC (remote history row
-- 20260416233654). This was the P4 replay-flag migration applied
-- via MCP before the P3 catch-up ran — the P3 catch-up's
-- CREATE OR REPLACE temporarily overwrote this function back to
-- the old `duplicate:true` variant, so 20260416234230 (reapply)
-- was run afterward to restore the replay flag.
--
-- Content is identical to the reapply migration; checked in here
-- for an accurate audit trail of what happened in production.
-- ============================================================

CREATE OR REPLACE FUNCTION reserve_credit_atomic(
  p_user_id UUID,
  p_job_id UUID,
  p_idempotency_key TEXT
)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION reserve_credit_atomic(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_credit_atomic(UUID, UUID, TEXT) TO service_role;
