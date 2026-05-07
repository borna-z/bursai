-- M30 — Notification preferences on `profiles`.
--
-- Each user gets three opt-in toggles surfaced in SettingsNotificationsScreen:
--   • daily        — daily outfit suggestion push
--   • new_outfit   — "your new outfit is ready" push
--   • reminders    — generic reminders (laundry, planned-outfit nudges, etc.)
--
-- Stored as a single JSONB column (rather than three booleans) so future
-- pref keys append without a schema change. The `send_push_notification`
-- edge function reads this column and short-circuits per-row when the
-- relevant pref is `false`.
--
-- Default opens all three on so first-launch users get the day-1 daily push
-- without explicit consent; SettingsNotificationsScreen lets them opt out.
-- Idempotent.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS notification_prefs jsonb
        NOT NULL DEFAULT '{"daily":true,"new_outfit":true,"reminders":true}'::jsonb;
