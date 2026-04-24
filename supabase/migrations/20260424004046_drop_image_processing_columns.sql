-- Wave 4.9-A (PR: drop dead PhotoRoom pipeline columns from garments + clean orphan job_queue rows).
-- P15 (PR #660) unwired the PhotoRoom edge function and its polling gates; these columns became
-- write-only (or unwritten) immediately after. Spec: LAUNCH_PLAN.md W4.9-A.
--
-- Dependencies dropped automatically with the columns:
--   - CHECK constraint garments_image_processing_status_check  (on image_processing_status)
--   - INDEX      idx_garments_processing_status               (on image_processing_status)
--
-- Pre-drop user action (documented in PR body, run from Supabase SQL editor before db push):
--   COPY public.garments TO '/tmp/garments_backup_pre_4_9_a.csv' CSV HEADER;
-- Save the resulting file off-server for 30 days.

ALTER TABLE public.garments
  DROP COLUMN IF EXISTS image_processing_status,
  DROP COLUMN IF EXISTS image_processing_provider,
  DROP COLUMN IF EXISTS image_processing_version,
  DROP COLUMN IF EXISTS image_processing_confidence,
  DROP COLUMN IF EXISTS image_processing_error,
  DROP COLUMN IF EXISTS image_processed_at,
  DROP COLUMN IF EXISTS processed_image_path;

-- P15 Finding F3: orphan job_queue rows whose handler was removed.
-- claimJob already filters by JOB_HANDLERS keys so these rows are frozen forever — delete them outright.
DELETE FROM public.job_queue WHERE job_type = 'image_processing';
