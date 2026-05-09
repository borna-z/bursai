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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { callEdgeFunction } from '../lib/edgeFunctionClient';
import { Sentry, captureMutationError } from '../lib/sentry';
import { t as tr } from '../lib/i18n';

/** Mobile redirect URI — must be present in the edge function's allowlist
 *  AND registered in the Google OAuth Console as an authorized redirect URI.
 *
 *  Google's installed-app OAuth (https://developers.google.com/identity/protocols/oauth2/native-app)
 *  requires iOS custom URI schemes to be the reverse-DNS form of the
 *  app's bundle identifier. The bundle is `me.burs.app` (per
 *  `mobile/app.json` `expo.ios.bundleIdentifier`), so the OAuth scheme
 *  matches: `me.burs.app://…`. The existing `burs://` scheme M12 ships
 *  for password reset / Supabase OAuth login is not a valid Google
 *  installed-app redirect (Google rejects schemes that don't match the
 *  reverse-DNS pattern). Both schemes are registered side-by-side in
 *  `app.json` `expo.scheme` so the M12 deep links keep working.
 *  Codex P1 on PR #772.
 *
 *  Android note: Google deprecated custom-scheme redirects for new
 *  Android OAuth clients. Android calendar connect needs HTTPS App
 *  Links via Universal Links — that work depends on the M43 paid
 *  Apple Developer + `apple-app-site-association` deployment and is
 *  tracked in findings-log. iOS launches first; Android calendar
 *  sync follows when Universal Links land. */
export const CALENDAR_REDIRECT_URI = 'me.burs.app://calendar/callback';

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

/** AsyncStorage key for the in-flight PKCE verifier. The verifier is
 *  generated when the user taps Connect and consumed by the deep-link
 *  handler when Google redirects back. Keyed by user.id so concurrent
 *  signed-in users on the same device don't cross over (defensive — only
 *  one user is auth'd at a time, but RootNavigator's exchange path runs
 *  outside React state). Cleared on success or 10-min TTL expiry. */
const VERIFIER_STORAGE_PREFIX = '@burs/oauth/calendar/verifier:';
const VERIFIER_TTL_MS = 10 * 60 * 1000;
interface StoredVerifier {
  verifier: string;
  createdAt: number;
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

/** Convert standard base64 to base64url (RFC 4648 §5): `+` → `-`, `/` → `_`,
 *  strip trailing `=` padding. The challenge is base64url-encoded per
 *  Google's PKCE spec (RFC 7636 §4.2). */
function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Hex-encode random bytes. RFC 7636 §4.1 says the verifier is "high-entropy
 *  cryptographic-random string using the unreserved characters
 *  [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~", with a minimum length of
 *  43 characters and a maximum length of 128 characters" — hex (0-9 a-f) is
 *  inside that set. We deliberately avoid `btoa(String.fromCharCode(...bytes))`
 *  because `btoa` isn't reliably present on every RN runtime (Hermes
 *  versions before the polyfill landed throw `ReferenceError`); hex is
 *  bulletproof and uses only `Uint8Array.toString(16)`. 32 random bytes →
 *  64 hex chars, well above the 43-char floor. */
function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, '0');
  }
  return s;
}

/** Generate a 32-byte cryptographically random PKCE code verifier and its
 *  SHA-256 challenge. The verifier is the secret that proves to Google
 *  that the same client requesting the auth URL is the one redeeming the
 *  code; the challenge is what we send up-front. */
async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const verifier = bytesToHex(randomBytes);
  const challengeB64 = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  const challenge = toBase64Url(challengeB64);
  return { verifier, challenge };
}

async function storeVerifier(userId: string, verifier: string): Promise<void> {
  const payload: StoredVerifier = { verifier, createdAt: Date.now() };
  await AsyncStorage.setItem(
    `${VERIFIER_STORAGE_PREFIX}${userId}`,
    JSON.stringify(payload),
  );
}

/** Pull the verifier back out for the deep-link exchange and immediately
 *  delete it so a replay of the same callback URL can't re-use the secret.
 *  Returns null when no verifier exists, the row is corrupt, or it's older
 *  than the 10-minute TTL (matches the edge function's `oauth_csrf` window). */
export async function consumeStoredVerifier(userId: string): Promise<string | null> {
  const key = `${VERIFIER_STORAGE_PREFIX}${userId}`;
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  await AsyncStorage.removeItem(key);
  try {
    const parsed = JSON.parse(raw) as StoredVerifier;
    if (
      typeof parsed?.verifier !== 'string' ||
      typeof parsed?.createdAt !== 'number'
    ) {
      return null;
    }
    if (Date.now() - parsed.createdAt > VERIFIER_TTL_MS) return null;
    return parsed.verifier;
  } catch {
    return null;
  }
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

  /** Open Google's OAuth consent screen in the system browser. PKCE verifier
   *  is generated client-side, persisted to AsyncStorage for the deep-link
   *  round-trip, and the SHA-256 challenge is forwarded to the edge function
   *  so Google's installed-app client accepts the request without a secret.
   *  See `CALENDAR_REDIRECT_URI` for the iOS scheme rationale. */
  const connectGoogle = async (): Promise<void> => {
    if (!user) return;
    try {
      const { verifier, challenge } = await generatePkcePair();
      // Persist BEFORE opening the URL so a fast OAuth round-trip can
      // never beat us to AsyncStorage.
      await storeVerifier(user.id, verifier);
      const data = await callEdgeFunction<AuthUrlResponse>('google_calendar_auth', {
        body: {
          action: 'get_auth_url',
          redirect_uri: CALENDAR_REDIRECT_URI,
          code_challenge: challenge,
        },
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
    } catch (err) {
      // PKCE generation, AsyncStorage, edge call, and Linking can all throw.
      // Without telemetry the user-facing alert is identical for a transient
      // network blip vs a malformed edge response — log the underlying error
      // so we can spot recurring failure modes in Sentry.
      Sentry.withScope((s) => {
        s.setTag('mutation', 'useCalendarSync.connectGoogle');
        Sentry.captureException(err);
      });
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
  const data = await callEdgeFunction<SyncResponse>('calendar', {
    body: { action: 'sync_google' },
  });
  if (!data) {
    // 2xx with unparseable JSON — treat as a sync failure so the deep-link
    // handler's onError path can surface it instead of returning an
    // implicit `null` masquerading as a SyncResponse.
    throw new Error('calendar_sync_invalid_response');
  }
  return data;
}

/** Exchange an OAuth `code` + `state` pair from the deep-link callback for
 *  server-side tokens. RootNavigator calls this after parsing the deep link
 *  URL; on success it kicks off `triggerGoogleSync` so the user immediately
 *  sees their events back in the app. The PKCE `code_verifier` is pulled
 *  out of AsyncStorage (where `connectGoogle` stashed it) and forwarded so
 *  Google's installed-app client can verify the exchange without a secret. */
export async function exchangeCalendarCode(
  code: string,
  state: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const verifier = await consumeStoredVerifier(userId);
    if (!verifier) {
      return { ok: false, error: 'pkce_verifier_missing' };
    }
    const data = await callEdgeFunction<{ error?: string; success?: boolean }>(
      'google_calendar_auth',
      {
        body: {
          action: 'exchange_code',
          code,
          redirect_uri: CALENDAR_REDIRECT_URI,
          state,
          code_verifier: verifier,
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
