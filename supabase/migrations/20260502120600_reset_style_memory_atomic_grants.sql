-- Wave 8.5 PR B (P90, integrity migration #7 of 7) — GRANTs for
-- reset_style_memory_atomic.

REVOKE ALL ON FUNCTION public.reset_style_memory_atomic(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reset_style_memory_atomic(uuid) TO service_role;
