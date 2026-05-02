-- Wave 8.5 PR B integrity migration — REVOKE on _upsert_garment_pair_memory.
REVOKE ALL ON FUNCTION public._upsert_garment_pair_memory(uuid, uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
