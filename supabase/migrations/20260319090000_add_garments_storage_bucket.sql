INSERT INTO storage.buckets (id, name, public)
VALUES ('garments', 'garments', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload own garments'
  ) THEN
    CREATE POLICY "Users can upload own garments"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'garments' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can update own garments'
  ) THEN
    CREATE POLICY "Users can update own garments"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'garments' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can read own garments'
  ) THEN
    CREATE POLICY "Users can read own garments"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'garments' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete own garments'
  ) THEN
    CREATE POLICY "Users can delete own garments"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'garments' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;
