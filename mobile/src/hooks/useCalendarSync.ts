// Mobile Google Calendar sync hook (M36). Mirrors the relevant slice of web's
// `src/hooks/useCalendarSync.ts` but trimmed for mobile: Google-only (no ICS),
// `Linking` for the OAuth open (no `window.location.href`), `Alert` for
// surfaces (no toast), no `localStorage` (cache state lives in React Query).
//
// Flow:
//   1. `connectGoogle()` → calls `google_calendar_auth({ action: 'get_auth_url',
//      redirect_uri: 'burs://calendar/callback' })` → opens the returned URL
//      in the system browser via `Linking.openURL`.
//   2. User completes Google OAuth in Safari/Chrome. Google redirects to
//      `burs://calendar/callback?code=…&state=…`, which RootNavigator's
//      deep-link handler routes to `handleCalendarOAuthDeepLink` (separate
//      file) — that helper calls `exchange_code` then triggers `sync_google`.
//   3. The hook re-reads `calendar_connections` once the user returns to the
//      app, so the connected state lights up immediately.
//
// The token exchange and storage stay server-side — mobile never sees the
// access/refresh tokens. The only surface here is connection state +
// disconnect + a thin `useCalendarEvents(date)` for HomeScreen / M15 wiring.

import { Alert, Linking } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { callEdgeFunction } from '../lib/edgeFunctionClient';
import { captureMutationError } from '../lib/sentry';
import { t as tr } from '../lib/i18n';

/** Mobile redirect URI — must be present in the edge function's allowlist
 *  AND registered in the Google OAuth Console as an authorized redirect URI.
 *  Uses the same scheme (`burs:`) M12 ships for password reset and OAuth
 *  login callbacks, so RootNavigator's existing `Linking.addEventListener`
 *  can dispatch on path. */
export const CALENDAR_REDIRECT_URI = 'burs://calendar/callback';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  provider: string | null;
}

interface CalendarConnectionRow {
  id: string;
  provider: string;
  token_expires_at: string | null;
  created_at: string | null;
}

interface AuthUrlResponse {
  url?: string;
  error?: string;
}

interface DisconnectResponse {
  error?: string;
}

interface SyncResponse {
  synced?: number;
  reconnect?: boolean;
  error?: string;
  syncWindowDays?: number;
  success?: boolean;
}

/** Connection-state + connect/disconnect actions. Status lives in
 *  `calendar_connections` keyed on `(user_id, provider='google')`; the row's
 *  presence is the single source of truth. */
export function useCalendarSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const connectionQ = useQuery({
    queryKey: ['calendar-connection', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('calendar_connections')
        .select('id, provider, token_expires_at, created_at')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as CalendarConnectionRow | null;
    },
    enabled: !!user,
    staleTime: 30 * 1000,
  });

  const isConnected = !!connectionQ.data;

  /** Open Google's OAuth consent screen in the system browser. The auth URL
   *  is generated server-side so the client_id / scopes / redirect URI stay
   *  authoritative there. We bail with an Alert on edge function errors so
   *  the user gets actionable feedback instead of a silent no-op. */
  const connectGoogle = async (): Promise<void> => {
    if (!user) return;
    try {
      const data = await callEdgeFunction<AuthUrlResponse>('google_calendar_auth', {
        body: { action: 'get_auth_url', redirect_uri: CALENDAR_REDIRECT_URI },
      });
      if (data?.error || !data?.url) {
        Alert.alert(
          tr('settings.calendar.error.title'),
          data?.error ?? tr('settings.calendar.error.body'),
        );
        return;
      }
      const can = await Linking.canOpenURL(data.url);
      if (!can) {
        Alert.alert(tr('settings.calendar.error.title'), tr('settings.calendar.error.body'));
        return;
      }
      await Linking.openURL(data.url);
    } catch {
      Alert.alert(tr('settings.calendar.error.title'), tr('settings.calendar.error.body'));
    }
  };

  const disconnectGoogle = useMutation({
    mutationFn: async () => {
      const data = await callEdgeFunction<DisconnectResponse>('google_calendar_auth', {
        body: { action: 'disconnect' },
      });
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connection', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
    onError: captureMutationError('useCalendarSync.disconnectGoogle'),
  });

  return {
    isConnected,
    isLoadingConnection: connectionQ.isLoading,
    connectGoogle,
    disconnectGoogle: disconnectGoogle.mutateAsync,
    isDisconnecting: disconnectGoogle.isPending,
    /** Force-refresh the connection state — used by RootNavigator's
     *  deep-link handler after a successful exchange so the Settings row
     *  flips to "Connected" without waiting for a manual reload. */
    refetchConnection: connectionQ.refetch,
  };
}

/** Read calendar_events for a single ISO date (yyyy-mm-dd). Used by
 *  `useSmartDayRecommendation` to feed the day-intelligence engine real
 *  events when the user has connected a calendar. */
export function useCalendarEvents(date: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['calendar-events', date, user?.id],
    queryFn: async () => {
      if (!user || !date) return [];
      const { data, error } = await supabase
        .from('calendar_events')
        .select('id, title, date, start_time, end_time, location, provider')
        .eq('user_id', user.id)
        .eq('date', date)
        .order('start_time', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as CalendarEvent[];
    },
    enabled: !!user && !!date,
    staleTime: 5 * 60 * 1000,
  });
}

/** Trigger an on-demand sync. Called by the OAuth deep-link handler after
 *  `exchange_code` lands so the first batch of events shows up without the
 *  user having to wait for the cron-scheduled background sync. */
export async function triggerGoogleSync(): Promise<SyncResponse> {
  return callEdgeFunction<SyncResponse>('calendar', {
    body: { action: 'sync_google' },
  });
}

/** Exchange an OAuth `code` + `state` pair from the deep-link callback for
 *  server-side tokens. RootNavigator calls this after parsing the deep link
 *  URL; on success it kicks off `triggerGoogleSync` so the user immediately
 *  sees their events back in the app. */
export async function exchangeCalendarCode(
  code: string,
  state: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const data = await callEdgeFunction<{ error?: string; success?: boolean }>(
      'google_calendar_auth',
      {
        body: {
          action: 'exchange_code',
          code,
          redirect_uri: CALENDAR_REDIRECT_URI,
          state,
        },
      },
    );
    if (data?.error) return { ok: false, error: data.error };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'exchange_failed',
    };
  }
}
