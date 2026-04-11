/**
 * analytics.ts — Shared helper for fire-and-forget analytics_events inserts.
 *
 * Pattern mirrors ShareOutfit.tsx's inline trackEvent function.
 * All calls are non-blocking (errors are silently swallowed after logging).
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export function trackEvent(eventType: string, metadata: Record<string, unknown> = {}): void {
  supabase
    .from('analytics_events')
    .insert([{ event_type: eventType, metadata: metadata as Record<string, string> }])
    .then(() => {})
    .catch((err) => {
      logger.error('Analytics error:', err);
      console.error('[analytics] trackEvent failed:', err);
    });
}
