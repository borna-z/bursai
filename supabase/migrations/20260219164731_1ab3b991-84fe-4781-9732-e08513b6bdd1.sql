-- Del 1: Lägg till kroppsmått i profiles-tabellen
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS height_cm INTEGER,
  ADD COLUMN IF NOT EXISTS weight_kg INTEGER,
  ADD COLUMN IF NOT EXISTS body_image_path TEXT;

-- Del 2: Skapa chat_messages-tabellen
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Aktivera RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS-policies: Användare ser bara sina egna meddelanden
CREATE POLICY "Users can view own chat messages"
  ON public.chat_messages
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat messages"
  ON public.chat_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat messages"
  ON public.chat_messages
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index för snabb åtkomst
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id_created_at 
  ON public.chat_messages (user_id, created_at);

-- Del 3: Skapa privat bucket för kroppsbilder
INSERT INTO storage.buckets (id, name, public)
VALUES ('body-images', 'body-images', false)
ON CONFLICT (id) DO NOTHING;

-- RLS för body-images bucket
CREATE POLICY "Users can upload own body images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'body-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own body images"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'body-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own body images"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'body-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own body images"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'body-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );