-- N15/B4 — Patch handle_new_user so new free-tier users get N2 quota.
--
-- The initial schema's `handle_new_user` trigger inserts
--   subscriptions(plan='free', status='active', garments_count=0)
-- but does NOT set `monthly_token_quota_micros`. After the N2 ceiling
-- shipped (`20260509190001_ai_token_usage.sql`), the data migration in
-- that file backfilled existing rows — but the trigger was never updated.
-- Every NEW free-tier signup since then has had NULL `monthly_token_quota_micros`.
--
-- `supabase/functions/_shared/burs-ai.ts` (readUsageBudget) returns
-- "no enforcement" when the column is NULL, so every new free user has
-- effectively unbounded AI spend — a real Gemini-bill risk for the Sweden
-- launch.
--
-- Also pin `SET search_path = public, auth` to match the hardening
-- already applied to `init_render_credits` (initial schema :2785). The
-- function body uses fully-qualified `public.*` names so it works today,
-- but Supabase rotates role defaults; pinning is defense in depth and
-- matches the project's standing rule for SECURITY DEFINER functions.
--
-- Backfill: bring any free-tier rows whose quota is somehow still NULL
-- back up to the launch default (200000 micros = $0.20 onboarding /
-- $2.00 free per `20260509190001_ai_token_usage.sql` comments).

-- IMPORTANT: this CREATE OR REPLACE must preserve every behaviour added
-- to handle_new_user by prior migrations. As of 2026-05-11 those are:
--   * `20260429120000_trial_pending_for_new_users.sql` — Wave 8 P52: sets
--     `auth.users.raw_user_meta_data ||= { trial_pending: true }` so the
--     `start_trial` gate (which checks the DB flag) mints a 3-day Stripe
--     trial for OAuth signups (Google/Apple cannot pass signup metadata
--     client-side).
-- N15 additions:
--   * `monthly_token_quota_micros = 2000000` on the new subscriptions row
--     so N2 enforcement isn't bypassed.
--   * `SET search_path = public, auth` pinning.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subscriptions (user_id, plan, status, garments_count, monthly_token_quota_micros)
  VALUES (NEW.id, 'free', 'active', 0, 2000000)
  ON CONFLICT (user_id) DO NOTHING;

  -- Preserved from `20260429120000_trial_pending_for_new_users.sql`
  -- (Wave 8 P52 / Codex round 6 P1). The `start_trial` server-side gate
  -- reads this DB flag rather than the JWT, so OAuth signups (which
  -- can't pass signup metadata) need this trigger update to be
  -- eligible for the launch trial. jsonb merge is idempotent — re-runs
  -- don't double-write and existing keys (full_name, avatar_url, etc.)
  -- survive the merge.
  UPDATE auth.users
     SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
                              || jsonb_build_object('trial_pending', true)
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Backfill any orphaned free-tier rows that slipped through between
-- the N2 ship and this fix. The default below matches the free-tier
-- value from `20260509190001_ai_token_usage.sql` — 2_000_000 micros
-- (i.e. $2.00 at 1 micro = $0.000001).
UPDATE public.subscriptions
   SET monthly_token_quota_micros = 2000000
 WHERE plan = 'free'
   AND monthly_token_quota_micros IS NULL;
