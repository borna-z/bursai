-- Add ics_url column to profiles for storing user's calendar URL
ALTER TABLE public.profiles ADD COLUMN ics_url text;

-- Add last_calendar_sync column to track sync status
ALTER TABLE public.profiles ADD COLUMN last_calendar_sync timestamp with time zone;