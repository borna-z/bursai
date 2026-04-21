-- P11 — Gate seed_wardrobe delete_all behind a server-issued confirmation token.
--
-- The seed_wardrobe edge function now supports a two-step flow:
--   1. Client POSTs {action: "request_delete_token"} and receives a 32-byte
--      hex token with a 5-minute expiry.
--   2. Client then POSTs {action: "delete_all", confirmation: <token>}.
--      The function verifies the token, consumes it (one-use), and proceeds.
--
-- These two columns persist the token between step 1 and step 2. The edge
-- function nulls both columns on successful use so replay fails.
--
-- Idempotent: IF NOT EXISTS guards mean re-applying the migration against
-- an already-patched schema is a no-op.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS delete_confirmation_token TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS delete_confirmation_expires_at TIMESTAMPTZ;

-- Optional cleanup query to keep the column tidy — expired rows are
-- effectively dead weight but have zero correctness impact. The edge
-- function's expiry check handles stale values defensively.
COMMENT ON COLUMN public.profiles.delete_confirmation_token IS
  'One-use confirmation token for seed_wardrobe delete_all. Consumed on successful use; nulled back out. See supabase/functions/seed_wardrobe/index.ts.';
COMMENT ON COLUMN public.profiles.delete_confirmation_expires_at IS
  '5-minute TTL for delete_confirmation_token. Expired tokens are rejected by the seed_wardrobe function.';
