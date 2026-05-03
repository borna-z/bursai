-- Wave 8.5 PR B (P88+P90 prep, integrity migration #2 of 4) — UNIQUE INDEX
-- on garment_pair_memory.
--
-- Required by PR A's _upsert_garment_pair_memory race fix (rewritten to
-- INSERT ... ON CONFLICT in migration #4) and PR B's ingest_memory_event
-- RPC. Partial — legacy null-pair rows excluded.

CREATE UNIQUE INDEX IF NOT EXISTS idx_garment_pair_memory_unique_pair
  ON public.garment_pair_memory (user_id, garment_a_id, garment_b_id)
  WHERE garment_a_id IS NOT NULL AND garment_b_id IS NOT NULL;
