
-- Step 14: Add username to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Step 14: Allow anyone to view public profiles (username + display_name + avatar only)
CREATE POLICY "Anyone can view public profiles by username"
ON public.profiles FOR SELECT
USING (username IS NOT NULL);

-- Step 16: Outfit reactions
CREATE TABLE public.outfit_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id uuid REFERENCES public.outfits(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  reaction text NOT NULL CHECK (reaction IN ('styled', 'creative', 'sustainable')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(outfit_id, user_id, reaction)
);
ALTER TABLE public.outfit_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reactions on shared outfits"
ON public.outfit_reactions FOR SELECT
USING (EXISTS (SELECT 1 FROM outfits WHERE outfits.id = outfit_reactions.outfit_id AND outfits.share_enabled = true));

CREATE POLICY "Authenticated users can react to shared outfits"
ON public.outfit_reactions FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (SELECT 1 FROM outfits WHERE outfits.id = outfit_reactions.outfit_id AND outfits.share_enabled = true)
);

CREATE POLICY "Users can remove own reactions"
ON public.outfit_reactions FOR DELETE
USING (auth.uid() = user_id);

-- Step 15: Inspiration saves
CREATE TABLE public.inspiration_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  outfit_id uuid REFERENCES public.outfits(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, outfit_id)
);
ALTER TABLE public.inspiration_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saves"
ON public.inspiration_saves FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can save outfits"
ON public.inspiration_saves FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave"
ON public.inspiration_saves FOR DELETE
USING (auth.uid() = user_id);

-- Step 17: Style challenges
CREATE TABLE public.style_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  week_start date NOT NULL,
  week_end date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.style_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view challenges"
ON public.style_challenges FOR SELECT
USING (true);

CREATE POLICY "Admins can manage challenges"
ON public.style_challenges FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

CREATE TABLE public.challenge_participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid REFERENCES public.style_challenges(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  outfit_id uuid REFERENCES public.outfits(id) ON DELETE SET NULL,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);
ALTER TABLE public.challenge_participations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own participations"
ON public.challenge_participations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can join challenges"
ON public.challenge_participations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own participations"
ON public.challenge_participations FOR UPDATE
USING (auth.uid() = user_id);

-- Step 19: Friendships
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  addressee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own friendships"
ON public.friendships FOR SELECT
USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can send friend requests"
ON public.friendships FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Addressee can update friendship status"
ON public.friendships FOR UPDATE
USING (auth.uid() = addressee_id);

CREATE POLICY "Users can delete own friendships"
ON public.friendships FOR DELETE
USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
