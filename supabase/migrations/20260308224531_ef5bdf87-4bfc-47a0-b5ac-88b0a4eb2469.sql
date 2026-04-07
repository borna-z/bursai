
CREATE TABLE public.ai_response_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  response jsonb NOT NULL,
  model_used text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL
);

CREATE INDEX idx_ai_cache_key ON public.ai_response_cache (cache_key);
CREATE INDEX idx_ai_cache_expires ON public.ai_response_cache (expires_at);

ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

-- Only service role can access cache (edge functions use service role)
CREATE POLICY "Deny all client access to ai_response_cache" ON public.ai_response_cache
  FOR ALL USING (false);
