// M41 — Notifications inbox hooks.
//
// Backs `mobile/src/screens/NotificationsScreen.tsx`. The feed comes from the
// `notifications` table created in migration `20260509200000_notifications_inbox`.
// Each row represents a single in-app card; mark-as-read flips `read_at`.
//
// Three hooks live here so callers can compose them independently:
//   * `useNotifications`        — list query (most-recent first)
//   * `useMarkNotificationRead` — single-row mark-as-read mutation
//   * `useMarkAllNotificationsRead` — fan-out mutation hitting every unread row
//
// All three follow the project's `useAddGarment.ts` pattern: `useAuth` for
// the user gate, `supabase` for the data access, `captureMutationError` for
// Sentry crumb on the mutation paths, and React Query invalidation keyed off
// `['notifications', user?.id]` so the screen refreshes after writes.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { captureMutationError } from '../lib/sentry';
import { CACHE_KEYS } from './cacheKeys';

// Local row shape. We deliberately don't reach into the auto-generated web
// `Database` types here — mobile reads `Database` for type imports only,
// and the notifications table is brand-new in M41 (its types haven't been
// regenerated yet). Defining the shape locally keeps this hook self-
// sufficient and avoids a CI flake when the regen lags the migration.
export type NotificationKind = 'weather' | 'outfit' | 'wear' | 'plan' | 'saved' | string;

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationKind;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

const DEFAULT_LIMIT = 50;

/**
 * Paginated-ish inbox query. We fetch up to `limit` rows ordered newest-
 * first; the screen renders them in a FlatList. True cursor pagination
 * is overkill at launch — the inbox grows slowly and 50 rows is enough
 * to cover several weeks for a daily-push user.
 */
export function useNotifications(limit: number = DEFAULT_LIMIT) {
  const { user } = useAuth();

  return useQuery({
    queryKey: CACHE_KEYS.notifications(user?.id, limit),
    queryFn: async (): Promise<NotificationRow[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id, type, title, body, data, read_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as unknown as NotificationRow[]);
    },
    enabled: !!user,
    // Surface fresh notifications quickly — the inbox is small and a
    // 30s staleTime balances "looks live" against duplicate hits when
    // the user navigates back to the tab.
    staleTime: 30 * 1000,
  });
}

/**
 * Mark a single notification read. Idempotent at the row level: a second
 * call with an already-read row is a no-op (the UPDATE sets `read_at` to
 * the current `now()` again, but the screen never re-renders for that).
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        // RLS already restricts to own rows, but the explicit user_id
        // filter is belt-and-suspenders and lets the planner short-
        // circuit the row scan.
        .eq('id', id)
        .eq('user_id', user.id)
        .is('read_at', null);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CACHE_KEYS.notificationsAll(user?.id) });
    },
    onError: captureMutationError('useMarkNotificationRead'),
  });
}

/**
 * Mark every unread notification read in one round-trip. Used by the
 * "Mark all read" CTA in the screen header.
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CACHE_KEYS.notificationsAll(user?.id) });
    },
    onError: captureMutationError('useMarkAllNotificationsRead'),
  });
}
