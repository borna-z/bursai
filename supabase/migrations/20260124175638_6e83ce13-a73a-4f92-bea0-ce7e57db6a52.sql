-- Add share_enabled column to outfits
ALTER TABLE public.outfits 
ADD COLUMN share_enabled BOOLEAN DEFAULT false;

-- Create policy for public read access to shared outfits (no auth required)
CREATE POLICY "Anyone can view shared outfits"
ON public.outfits
FOR SELECT
USING (share_enabled = true);

-- Allow public read of outfit_items for shared outfits
CREATE POLICY "Anyone can view outfit items of shared outfits"
ON public.outfit_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM outfits 
    WHERE outfits.id = outfit_items.outfit_id 
    AND outfits.share_enabled = true
  )
);

-- Allow public read of garments for shared outfit items
CREATE POLICY "Anyone can view garments in shared outfits"
ON public.garments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM outfit_items
    JOIN outfits ON outfits.id = outfit_items.outfit_id
    WHERE outfit_items.garment_id = garments.id
    AND outfits.share_enabled = true
  )
);