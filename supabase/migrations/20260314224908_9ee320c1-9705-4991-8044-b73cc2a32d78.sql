
-- Drop the existing unique constraint on (user_id, date)
ALTER TABLE public.planned_outfits DROP CONSTRAINT IF EXISTS planned_outfits_user_id_date_key;

-- Add new composite unique constraint on (user_id, date, outfit_id)
ALTER TABLE public.planned_outfits ADD CONSTRAINT planned_outfits_user_date_outfit_unique UNIQUE (user_id, date, outfit_id);
