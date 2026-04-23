-- Wave 4.5-A (P27a): add optional secondary image slot on garments.
--
-- Nullable TEXT column stores the storage object path for a user's second
-- photo of a garment. No default, no CHECK, no constraints — matches the
-- existing pattern from `original_image_path`, `processed_image_path`, and
-- `rendered_image_path`. The Wave 4.5-B post-save flow uploads to
-- `garments/${userId}/${garmentId}_secondary.jpg` and writes the path here.
--
-- The swap-primary action in Wave 4.5-B is a single atomic UPDATE that
-- exchanges the VALUES of `image_path` and `secondary_image_path` — this
-- keeps `image_path` as the universal source of truth so every existing
-- reader (wardrobe card, analyze_garment, render_garment_image, outfit
-- scoring) continues working without code changes.
--
-- IF NOT EXISTS guard makes this idempotent — safe to re-run on any env.

ALTER TABLE "public"."garments"
  ADD COLUMN IF NOT EXISTS "secondary_image_path" "text";
