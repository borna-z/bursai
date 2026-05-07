-- M30 review fix — add UNIQUE INDEX on push_subscriptions(user_id, endpoint).
--
-- The mobile token-registration upsert in
-- mobile/src/hooks/usePushNotifications.ts uses
--   .upsert({...}, { onConflict: 'user_id,endpoint' })
-- and the pre-existing web VAPID-subscription path expects the same conflict
-- target. PostgREST's `on_conflict` requires a UNIQUE (or PRIMARY KEY)
-- constraint or unique index to exist on those columns; without one, the
-- upsert returns 42P10 and crashes first-launch token registration.
--
-- Defensive dedupe runs before the index creation — any existing rows that
-- collide on (user_id, endpoint) keep the most recent (highest id) and the
-- older duplicates are deleted. Without this step the UNIQUE INDEX creation
-- could fail on legacy data.
--
-- Both statements are idempotent: the DELETE is a no-op when no duplicates
-- exist; the CREATE INDEX uses IF NOT EXISTS so re-running this migration
-- on a fixed-up schema is safe.

-- Defensive dedupe: existing rows with same (user_id, endpoint) keep the most recent
DELETE FROM public.push_subscriptions a
USING public.push_subscriptions b
WHERE a.user_id = b.user_id
  AND a.endpoint = b.endpoint
  AND a.id < b.id;

-- The conflict target the M30 mobile (and pre-existing web) upsert needs
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_key
  ON public.push_subscriptions(user_id, endpoint);
