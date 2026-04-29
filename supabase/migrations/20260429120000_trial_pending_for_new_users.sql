-- Wave 8 P52 / Codex round 6 P1 — set `trial_pending: true` in
-- raw_user_meta_data for every new auth.users row, so the AuthContext
-- listener + start_trial server-side gate know to auto-mint a 3-day
-- Stripe trial regardless of whether the user signed up via
-- email/password, Google OAuth, or Apple OAuth.
--
-- Why this is a trigger update vs. client-side: OAuth flows go through
-- supabase.auth.signInWithOAuth() which doesn't accept a `data` field
-- that maps to user_metadata. The previous round 5 fix only set the
-- flag in the email/password signUp() callback, leaving Google/Apple
-- signups silently routed to the not_eligible path. A server-side
-- trigger covers ALL signup paths uniformly (current and future).
--
-- Existing users (auth.users rows created BEFORE this migration) do NOT
-- get the flag retroactively — same scope guarantee as Codex round 3
-- intended. Legacy users continue to route through the paywall flow
-- (P54+ + create_checkout_session + restore_subscription).
--
-- Idempotency: jsonb || merge preserves any pre-existing keys (e.g.
-- full_name, avatar_url from OAuth, display_name from email signup).
-- Re-running this migration is safe — CREATE OR REPLACE FUNCTION just
-- swaps the function body.
--
-- The email/password signUp() call in src/contexts/AuthContext.tsx
-- still passes `trial_pending: true` in its data payload (defense in
-- depth + makes the JWT carry the flag without depending on trigger
-- timing). Both writers set the SAME field via jsonb merge — no
-- collision.

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id, plan, status, garments_count)
  values (new.id, 'free', 'active', 0)
  on conflict (user_id) do nothing;

  -- Wave 8 P52 — mark new user as trial-pending for the auto-trial
  -- mint. Update auth.users (the trigger fires AFTER INSERT, so we
  -- need an explicit UPDATE rather than mutating NEW). The function
  -- runs as `postgres` (SECURITY DEFINER), which has the privileges
  -- to update auth.users.
  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('trial_pending', true)
  where id = new.id;

  return new;
end;
$$;
