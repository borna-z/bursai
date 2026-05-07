-- M30 — Push notifications + Expo send branch.
--
-- Web uses VAPID web push; mobile uses Expo Push (which fans out to APNs/FCM).
-- The existing `push_subscriptions` table stores VAPID `endpoint` / `p256dh` /
-- `auth` keys — those are nullable for Expo rows. Add a `provider` column so
-- the `send_push_notification` edge function can branch on the transport, plus
-- `expo_token` for Expo Push tokens (`ExponentPushToken[…]`).
--
-- Idempotent — the migration is safe to re-run during drift repair.

ALTER TABLE public.push_subscriptions
    ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'web';

ALTER TABLE public.push_subscriptions
    ADD COLUMN IF NOT EXISTS expo_token text;

-- Backfill — defensive. The DEFAULT above already populates the column on
-- existing rows during the ALTER, so this UPDATE is a no-op in practice. Kept
-- to make the intent explicit + survive any future drift where a NULL slips in.
UPDATE public.push_subscriptions
SET provider = 'web'
WHERE provider IS NULL;

-- Composite index for the per-user provider lookup the edge function performs
-- (`SELECT … WHERE user_id = $1` then branches per row's provider). The
-- (user_id, provider) index lets PostgREST filter both predicates from a
-- single index scan if a future caller ever filters by provider directly.
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_provider
    ON public.push_subscriptions(user_id, provider);
