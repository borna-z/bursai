-- Add description column to calendar_events for richer event data
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS description text;
