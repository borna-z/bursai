-- Wave 8.5 PR B integrity migration — GRANT on reset_style_memory_atomic.
GRANT EXECUTE ON FUNCTION public.reset_style_memory_atomic(uuid) TO service_role;
