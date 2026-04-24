-- Wave 4.9-A (PR: backfill enrichment_status canonical spelling).
-- Two writers persisted different spellings for the same states:
--   frontend: 'complete' + 'in_progress'
--   backend (process_job_queue): 'completed' + 'processing'
--
-- This migration normalizes existing rows to the backend spellings. Frontend writers are updated
-- in the same PR (src/lib/garmentIntelligence.ts, src/pages/GarmentDetail.tsx,
-- src/components/onboarding/QuickUploadStep.tsx).
--
-- The isEnrichmentReady helper (supabase/functions/_shared/burs-ai.ts, shipped in P24/PR #663)
-- continues to accept BOTH spellings indefinitely as defensive programming — bounded cost,
-- future-proofs against writer drift.
--
-- Idempotent: re-running after a successful apply affects zero rows (WHERE clauses empty).

UPDATE public.garments SET enrichment_status = 'completed' WHERE enrichment_status = 'complete';
UPDATE public.garments SET enrichment_status = 'processing' WHERE enrichment_status = 'in_progress';
