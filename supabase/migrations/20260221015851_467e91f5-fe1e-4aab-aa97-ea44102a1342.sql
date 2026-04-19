DROP POLICY IF EXISTS "Users can update own outfit items" ON public.outfit_items;
CREATE POLICY "Users can update own outfit items"
  ON public.outfit_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM outfits
    WHERE outfits.id = outfit_items.outfit_id
    AND outfits.user_id = auth.uid()
  ));