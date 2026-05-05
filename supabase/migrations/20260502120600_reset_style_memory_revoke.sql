-- Wave 8.5 PR B integrity migration — REVOKE on reset_style_memory_atomic.
REVOKE ALL ON FUNCTION public.reset_style_memory_atomic(uuid) FROM PUBLIC;
