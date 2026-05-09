-- M41 — Notifications inbox table.
--
-- Backs `mobile/src/hooks/useNotifications.ts`. Each row represents a single
-- in-app notification card surfaced in `NotificationsScreen`. The intent is
-- that server-side jobs (push fan-out in `send_push_notification`, render
-- worker completion, outfit-of-the-day cron) write a row in the same
-- transaction that surfaces an Expo push, so opening the app after a push
-- always finds the corresponding inbox card.
--
-- Schema:
--   * id           — uuid PK, gen_random_uuid()
--   * user_id      — owner; cascade-delete on auth.users teardown
--   * type         — short kind string ('weather' | 'outfit' | 'wear' |
--                    'plan' | 'saved'); kept as text rather than an enum so
--                    the mobile UI can safely render unknown future kinds
--                    without a migration coupling
--   * title / body — display strings
--   * data         — jsonb side-channel (deep-link target, outfit_id, etc.)
--                    so we don't add a column for every new kind
--   * read_at      — null = unread; mark-as-read sets it to now()
--   * created_at   — sort key (descending in the inbox)
--
-- RLS:
--   * SELECT/UPDATE: only the owning user (authenticated)
--   * INSERT: service_role only — every write originates from an edge
--     function with the service-role key. Authenticated users cannot
--     forge inbox rows for themselves or anyone else.
--
-- Idempotent: CREATE TABLE / INDEX / POLICY all guarded with IF NOT EXISTS
-- (or DROP-then-CREATE for policies, matching the project's existing
-- pattern in 20260509190001_ai_token_usage.sql).

BEGIN;

CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text NOT NULL,
  title      text NOT NULL,
  body       text,
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Hot path: SELECT WHERE user_id = $1 ORDER BY created_at DESC LIMIT N.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- Secondary: filter unread for the "you have N unread" badge.
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Owning user can read their inbox.
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Owning user can mark their own rows read (UPDATE read_at). The policy
-- gates both the source row (USING) and the post-image (WITH CHECK) on
-- ownership so a user cannot UPDATE someone else's row OR re-assign a
-- row to a different user_id.
--
-- Codex P2 (2026-05-09): RLS alone doesn't restrict WHICH columns the
-- authenticated role can rewrite — without the column-level grants
-- below, a hand-rolled supabase-js call could overwrite `title`,
-- `body`, `type`, or `data` on the user's own rows (rows that are
-- supposed to be authoritative service-role-written content). The
-- column-level GRANT/REVOKE narrows the writable surface to `read_at`
-- only; the RLS policy still enforces row ownership on top.
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Column-level lockdown for the authenticated role: revoke the broad
-- table-level UPDATE that ALTER … ENABLE RLS leaves available, then
-- grant UPDATE on `read_at` only. SELECT stays open (gated by the
-- SELECT policy above) so the client can still read every column of
-- its own rows. INSERT / DELETE remain ungranted; service_role
-- bypasses RLS + grants entirely.
REVOKE UPDATE ON public.notifications FROM authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;

-- No INSERT or DELETE policy for `authenticated` — service-role bypasses
-- RLS so edge functions writing inbox rows are unaffected, and the
-- absence of a public INSERT policy means client code cannot forge rows.

COMMIT;
