-- One-time cleanup: reset legacy garments stuck in render_status='pending'
-- without a corresponding render_jobs row. Codex round 12 Bug 1.
--
-- Pre-P5, `startGarmentRenderInBackground` flipped garment.render_status to
-- 'pending' before calling render_garment_image synchronously. If that call
-- failed (network/server error) the garment stayed at 'pending' — the pre-P5
-- `resumePendingGarmentRenders` ran on app open and re-triggered.
--
-- P5 replaced the in-memory queue with render_jobs + worker. The round-9 +
-- round-11 fixes ensure that new garments can't get stuck at 'pending'
-- without a render_jobs row (enqueue-failure catch resets to 'none'; queue
-- worker processes any render_jobs row to terminal state). But any garments
-- already at 'pending' when this migration runs are LEGACY state from before
-- P5 shipped — no render_jobs row exists for them, and under P5
-- `resumePendingGarmentRenders` is a no-op (the queue owns durability for
-- enqueued jobs, but these were never enqueued into the queue).
--
-- Reset to 'none' so the UI shows the Studio photo button again and the user
-- can retry from the UI. 'none' is correct (not 'failed'): no render was
-- attempted, so 'failed' would be misleading in the wardrobe card state.
--
-- Production scope at authoring time (`khvkwojtlkcvxjxztduj`): 3 rows, all
-- with rendered_image_path=NULL (no prior render lost by the reset). See
-- render-jobs-verification.md round-12 section.

-- Guard in case render_jobs doesn't exist yet in replay scenarios. The
-- round-7 P5 migration (20260417180000) creates render_jobs before this
-- migration runs under normal chain ordering, but preview-branch replay
-- failures (documented from round 1 onward) can leave the table missing.
-- We degrade gracefully: if render_jobs isn't there, reset every pending
-- garment (there can't be a render_jobs row for it by definition).
DO $$
DECLARE
  v_count INT;
  v_has_render_jobs BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'render_jobs'
  ) INTO v_has_render_jobs;

  IF v_has_render_jobs THEN
    UPDATE garments
    SET render_status = 'none',
        render_error = 'Pre-P5 legacy pending state reset — retry to render',
        updated_at = NOW()
    WHERE render_status = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM render_jobs rj WHERE rj.garment_id = garments.id
      );
  ELSE
    UPDATE garments
    SET render_status = 'none',
        render_error = 'Pre-P5 legacy pending state reset — retry to render',
        updated_at = NOW()
    WHERE render_status = 'pending';
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Reset % legacy pending garments to "none" state', v_count;
END $$;
