-- Phase 5.1: Database Indexes & RLS Verification
-- Adds missing indexes based on actual query patterns in the application.
--
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
-- When applying via `supabase db push` (which wraps migrations in a
-- transaction), remove the CONCURRENTLY keyword or apply manually via
-- the SQL editor. The IF NOT EXISTS guards make this migration safe to
-- re-run.

-- =============================================================
-- GARMENTS TABLE INDEXES
-- =============================================================

-- Composite index for the primary garment listing query (user_id + created_at DESC).
-- Covers: useGarments paginated listing sorted by created_at (the default sort).
CREATE INDEX IF NOT EXISTS idx_garments_user_created
  ON public.garments (user_id, created_at DESC);

-- Single-column index on category for filter queries.
-- Covers: useGarments .eq('category', ...) and useSimilarGarments.
CREATE INDEX IF NOT EXISTS idx_garments_category
  ON public.garments (category);

-- Single-column index on color_primary for filter queries.
-- Covers: useGarments .eq('color_primary', ...).
CREATE INDEX IF NOT EXISTS idx_garments_color_primary
  ON public.garments (color_primary);

-- Composite index for sorting by last_worn_at.
-- Covers: useGarments sort option 'last_worn_at'.
CREATE INDEX IF NOT EXISTS idx_garments_user_last_worn
  ON public.garments (user_id, last_worn_at DESC NULLS LAST);

-- Composite index for sorting by wear_count.
-- Covers: useGarments sort option 'wear_count'.
CREATE INDEX IF NOT EXISTS idx_garments_user_wear_count
  ON public.garments (user_id, wear_count DESC NULLS LAST);

-- Partial index for garments still being image-processed (polling refetch).
CREATE INDEX IF NOT EXISTS idx_garments_processing_status
  ON public.garments (image_processing_status)
  WHERE image_processing_status IN ('pending', 'processing');

-- Partial index for garments still being rendered (polling refetch).
CREATE INDEX IF NOT EXISTS idx_garments_render_status
  ON public.garments (render_status)
  WHERE render_status IN ('pending', 'rendering');

-- Partial index for enrichment in progress (garmentIntelligence).
CREATE INDEX IF NOT EXISTS idx_garments_enrichment_status
  ON public.garments (enrichment_status)
  WHERE enrichment_status = 'in_progress';

-- =============================================================
-- OUTFIT_ITEMS TABLE INDEXES
-- =============================================================

-- Index on outfit_id for efficient JOIN when loading outfit with its items.
CREATE INDEX IF NOT EXISTS idx_outfit_items_outfit_id
  ON public.outfit_items (outfit_id);

-- Index on garment_id for reverse lookups (which outfits contain a garment).
CREATE INDEX IF NOT EXISTS idx_outfit_items_garment_id
  ON public.outfit_items (garment_id);

-- =============================================================
-- OUTFITS TABLE INDEXES
-- =============================================================

-- Composite index for the primary outfit listing query.
CREATE INDEX IF NOT EXISTS idx_outfits_user_generated
  ON public.outfits (user_id, generated_at DESC NULLS LAST);

-- Partial index for saved-only outfit queries.
CREATE INDEX IF NOT EXISTS idx_outfits_user_saved
  ON public.outfits (user_id)
  WHERE saved = true;

-- =============================================================
-- WEAR_LOGS TABLE INDEXES
-- =============================================================

-- Index on garment_id for outfit history lookups.
CREATE INDEX IF NOT EXISTS idx_wear_logs_garment_id
  ON public.wear_logs (garment_id);

-- Composite index for user wear-history queries.
CREATE INDEX IF NOT EXISTS idx_wear_logs_user_worn
  ON public.wear_logs (user_id, worn_at DESC);

-- =============================================================
-- RLS VERIFICATION
-- =============================================================
-- The following tables already have RLS enabled (verified in migrations):
--   user_subscriptions, wear_logs, stripe_events, checkout_attempts,
--   analytics_events, subscriptions, user_roles, planned_outfits,
--   calendar_events, marketing_leads, marketing_events, chat_messages,
--   outfit_feedback, outfit_reactions, inspiration_saves, style_challenges,
--   challenge_participations, friendships, push_subscriptions,
--   ai_response_cache, ai_rate_limits, garment_pair_memory, feedback_signals
--
-- The core tables (garments, outfits, outfit_items, profiles) were created
-- before the migration history in this repo (likely via the Supabase
-- dashboard). Ensure RLS is enabled on these with:
ALTER TABLE public.garments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outfit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- These are idempotent -- safe to run even if RLS is already enabled.

-- =============================================================
-- GARMENT COUNT TRIGGER NOTE
-- =============================================================
-- The update_garments_count() trigger (from migration 20260124175058)
-- fires on INSERT and DELETE of garments rows. The application uses
-- hard deletes (there is no is_deleted column), so the trigger is
-- correct as-is. No changes needed.
