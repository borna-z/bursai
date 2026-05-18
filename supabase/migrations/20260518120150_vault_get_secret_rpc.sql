-- SECURITY DEFINER RPC exposing vault secrets to edge functions via PostgREST.
-- The vault schema is intentionally NOT in supabase/config.toml's exposed schema
-- list — adding it would let any authenticated client read every decrypted
-- secret. Instead this RPC narrows access to service_role only, so edge fns
-- can fetch named secrets via supabase.rpc('get_vault_secret', ...).

CREATE OR REPLACE FUNCTION public.get_vault_secret(secret_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  secret_value text;
BEGIN
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE name = secret_name
  LIMIT 1;
  RETURN secret_value;
END;
$$;

REVOKE ALL ON FUNCTION public.get_vault_secret(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vault_secret(text) TO service_role;

COMMENT ON FUNCTION public.get_vault_secret(text) IS
  'Service-role-only accessor for vault.decrypted_secrets. Edge fns call this via supabase.rpc() because the vault schema is not exposed via PostgREST.';
