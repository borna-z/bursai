-- Wave 8.5 PR B (P88+P90 prep, integrity migration #5 of 7) — GRANTs for
-- the rewritten _upsert_garment_pair_memory.

REVOKE ALL ON FUNCTION public._upsert_garment_pair_memory(uuid, uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public._upsert_garment_pair_memory(uuid, uuid, uuid, integer)
  TO service_role;
