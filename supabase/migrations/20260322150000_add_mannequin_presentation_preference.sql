ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mannequin_presentation text NOT NULL DEFAULT 'mixed';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_mannequin_presentation_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_mannequin_presentation_check
      CHECK (mannequin_presentation IN ('male', 'female', 'mixed'));
  END IF;
END $$;

UPDATE public.profiles
SET mannequin_presentation = CASE
  WHEN COALESCE(preferences->'styleProfile'->>'gender', preferences->'style_profile'->>'gender') = 'male' THEN 'male'
  WHEN COALESCE(preferences->'styleProfile'->>'gender', preferences->'style_profile'->>'gender') = 'female' THEN 'female'
  ELSE 'mixed'
END
WHERE mannequin_presentation IS DISTINCT FROM CASE
  WHEN COALESCE(preferences->'styleProfile'->>'gender', preferences->'style_profile'->>'gender') = 'male' THEN 'male'
  WHEN COALESCE(preferences->'styleProfile'->>'gender', preferences->'style_profile'->>'gender') = 'female' THEN 'female'
  ELSE 'mixed'
END;

ALTER TABLE public.garments
  ADD COLUMN IF NOT EXISTS render_presentation_used text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'garments_render_presentation_used_check'
  ) THEN
    ALTER TABLE public.garments
      ADD CONSTRAINT garments_render_presentation_used_check
      CHECK (
        render_presentation_used IS NULL
        OR render_presentation_used IN ('male', 'female', 'mixed')
      );
  END IF;
END $$;
