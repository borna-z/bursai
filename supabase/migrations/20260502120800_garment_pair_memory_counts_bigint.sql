-- Wave 8.5 PR B audit Round 6 (R6-3) — promote pair-memory counters to bigint.
--
-- `garment_pair_memory.positive_count` and `negative_count` were declared
-- `integer` (4-byte signed, INT_MAX = 2,147,483,647). The
-- `_upsert_garment_pair_memory` helper does `count = count + 1` on every
-- ingest. With the new memory_ingest endpoint sending up to N×(N-1)/2 pair
-- upserts per save_outfit (e.g., 10 pairs for a 5-garment outfit), a single
-- "favorite" pair on an extremely active user could overflow over months —
-- producing `integer out of range` errors that bubble up as RPC failures
-- and break the user's save flow with no recovery path.
--
-- bigint (8-byte signed, ~9.2 × 10^18) gives us headroom for hundreds of
-- millions of years of saves, eliminating the overflow class entirely.
--
-- Single ALTER TABLE statement (multi-column ALTER) — passes the supabase
-- CLI's prepared-statement parser per Round 4 lessons learned.

ALTER TABLE public.garment_pair_memory
  ALTER COLUMN positive_count TYPE bigint USING positive_count::bigint,
  ALTER COLUMN negative_count TYPE bigint USING negative_count::bigint;
