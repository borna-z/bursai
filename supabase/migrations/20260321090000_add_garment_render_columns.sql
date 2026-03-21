-- Add render pipeline columns (separate from background-removal processing)
ALTER TABLE public.garments
  ADD COLUMN IF NOT EXISTS rendered_image_path text,
  ADD COLUMN IF NOT EXISTS render_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS render_provider text,
  ADD COLUMN IF NOT EXISTS render_error text,
  ADD COLUMN IF NOT EXISTS rendered_at timestamptz;

-- Constrain render_status to valid states
ALTER TABLE public.garments
  ADD CONSTRAINT garments_render_status_check
  CHECK (render_status IN ('none', 'pending', 'rendering', 'ready', 'failed', 'skipped'));
