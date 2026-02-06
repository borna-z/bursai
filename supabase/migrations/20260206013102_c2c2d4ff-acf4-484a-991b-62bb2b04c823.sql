-- Create planned_outfits table for the planning system
CREATE TABLE public.planned_outfits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  outfit_id uuid REFERENCES public.outfits(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'worn', 'skipped')),
  note text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Create calendar_events table for future calendar integration
CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  title text NOT NULL,
  start_time time,
  end_time time,
  provider text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.planned_outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for planned_outfits
CREATE POLICY "Users can view own planned outfits"
ON public.planned_outfits
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own planned outfits"
ON public.planned_outfits
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own planned outfits"
ON public.planned_outfits
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own planned outfits"
ON public.planned_outfits
FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for calendar_events (read-only for now)
CREATE POLICY "Users can view own calendar events"
ON public.calendar_events
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar events"
ON public.calendar_events
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar events"
ON public.calendar_events
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar events"
ON public.calendar_events
FOR DELETE
USING (auth.uid() = user_id);

-- Add index for efficient date range queries
CREATE INDEX idx_planned_outfits_user_date ON public.planned_outfits(user_id, date);
CREATE INDEX idx_calendar_events_user_date ON public.calendar_events(user_id, date);