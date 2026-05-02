-- Wave 8.5 PR B integrity migration — GRANT on _upsert_garment_pair_memory.
GRANT EXECUTE ON FUNCTION public._upsert_garment_pair_memory(uuid, uuid, uuid, integer) TO service_role;
