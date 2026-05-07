// AuthContext — single source of truth for auth + profile state on mobile.
//
// Modeled on src/contexts/AuthContext.tsx (web) but slimmed for RN:
//   • No React Query for profile — exposes profile directly so screens read
//     via useAuth(). useQueryClient is consumed only to clear the cache on
//     sign-out.
//   • Session is persisted automatically (supabase.ts wires AsyncStorage).
//   • start_trial fires once per fresh signup (gated on user.created_at < 60s)
//     via the M9 callEdgeFunction wrapper (pre-flight session refresh +
//     circuit-break + paywall classification).
//
// On SIGNED_IN: load (or auto-create) the profile row.
// On SIGNED_OUT: clear user/session/profile + every per-user cache (React
// Query, signed-URL Map, offline queue).
//
// `isLoading` stays true until BOTH the session AND the profile-load attempt
// have settled, so callers (SplashScreen, AuthScreen post-sign-in routing
// effect) can distinguish "auth resolved + ready to route" from "auth resolved
// but profile still in flight". Without this, `isOnboarded` would briefly
// read `false` during the profile fetch and the user would be routed back to
// Onboarding even when they're already done.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';

import { supabase } from '../lib/supabase';
import {
  callEdgeFunction,
  EdgeFunctionRateLimitError,
} from '../lib/edgeFunctionClient';
import { clearSignedUrlCache } from '../hooks/useSignedUrl';
import {
  registerHandler,
  replay as replayOfflineQueue,
  clearQueue as clearOfflineQueue,
  HaltReplayError,
} from '../lib/offlineQueue';
import {
  isOnlineNow,
  persistGarment,
  type AddGarmentParams,
} from '../lib/garmentSave';
import {
  dispatchMemoryEvent,
  MEMORY_EVENT_ACTION,
  type MemoryIngestPayload,
} from '../lib/memoryIngest';
import { useV3CompatBackfill } from '../hooks/useV3CompatBackfill';

export type OnboardingPrefs = {
  completed?: boolean;
  step?: number;
  language?: string;
  // Open shape — quiz / studio answers persisted in OnboardingScreen are
  // free-form payloads we don't want to type rigidly here.
  [key: string]: unknown;
};

export type ProfilePreferences = {
  onboarding?: OnboardingPrefs;
  [key: string]: unknown;
} | null;

// Mirrors the canonical onboarding_step enum from the web — see
// src/lib/advanceOnboardingStep.ts. We keep the column nullable here because
// older users (pre-Wave-7 migration) may not have it populated; the column
// is the canonical signal post-migration but the legacy
// `preferences.onboarding.completed` flag remains the deploy-window fallback
// (matches web's ProtectedRoute behavior).
export type Profile = {
  id: string;
  display_name: string | null;
  preferences: ProfilePreferences;
  mannequin_presentation: string | null;
  created_at: string;
  onboarding_step?: string | null;
  onboarding_completed_at?: string | null;
  // M31 PR A — needed to mirror web's onboarding-boost bypass in
  // useSubscription. Backend `_shared/scale-guard.ts` grants new signups
  // a 24h boost window where the `subscriptions` row may still read
  // `plan='free', status='active'` (pre-`start_trial`); the frontend has
  // to mirror the same window so gating UI doesn't deny actions the API
  // would allow.
  onboarding_started_at?: string | null;
};

type SignResult = { error: Error | null };

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isOnboarded: boolean;
  signIn: (email: string, password: string) => Promise<SignResult>;
  signUp: (email: string, password: string, displayName: string) => Promise<SignResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PROFILE_COLUMNS =
  'id, display_name, preferences, mannequin_presentation, created_at, onboarding_step, onboarding_completed_at, onboarding_started_at';

// Fresh-signup detection window — start_trial fires only when the user row
// was created within this many ms of the SIGNED_IN event. Prevents trial
// re-fires on every returning login or token refresh. The edge function is
// idempotent (DB pre-check + Stripe-side keys + DB-backed request_idempotency)
// so this is a bandwidth optimisation, not a correctness gate.
const FRESH_SIGNUP_WINDOW_MS = 60_000;

async function callStartTrial(): Promise<void> {
  try {
    await callEdgeFunction('start_trial', { body: {}, retries: 0 });
  } catch {
    // Fire-and-forget — trial failure must never block the auth flow.
  }
}

async function selectProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[AuthContext] profile select failed:', error.message);
    return null;
  }
  return (data as Profile | null) ?? null;
}

async function loadOrCreateProfile(user: User): Promise<Profile | null> {
  const existing = await selectProfile(user.id);
  if (existing) return existing;

  // No profile — auto-create with sensible defaults. Mirrors web's useProfile.
  const displayName =
    (user.user_metadata?.display_name as string | undefined) ??
    user.email?.split('@')[0] ??
    'User';

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      display_name: displayName,
      preferences: { onboarding: { completed: false } },
      mannequin_presentation: 'mixed',
    })
    .select(PROFILE_COLUMNS)
    .single();

  if (insertError) {
    const code = (insertError as { code?: string }).code;
    // FK violation = ghost session (user not in auth.users). Sign out so the
    // app stops looping on a phantom user. Mirrors web's useProfile.
    if (code === '23503') {
      console.warn('[AuthContext] ghost session detected — signing out');
      await supabase.auth.signOut();
      return null;
    }
    // PK conflict = race with a sibling listener (e.g. SIGNED_IN +
    // INITIAL_SESSION emitting concurrently, or a TOKEN_REFRESHED fan-out
    // landing during cold-start). Re-select rather than treat as a hard
    // failure — the winning insert produced a real row we just need to read.
    if (code === '23505') {
      console.warn('[AuthContext] profile insert raced — re-selecting winning row');
      return await selectProfile(user.id);
    }
    console.warn('[AuthContext] profile auto-create failed:', insertError.message);
    return null;
  }

  return created as Profile;
}

function isFreshSignup(user: User | null | undefined, eventAtMs = Date.now()): boolean {
  if (!user?.created_at) return false;
  const createdAtMs = new Date(user.created_at).getTime();
  if (Number.isNaN(createdAtMs)) return false;
  return eventAtMs - createdAtMs < FRESH_SIGNUP_WINDOW_MS;
}

function deriveIsOnboarded(profile: Profile | null): boolean {
  if (!profile) return false;
  // Column-based signal is canonical (web's ProtectedRoute). Legacy
  // preferences flag is the deploy-window fallback for users whose row
  // predates the Wave 7 migration.
  if (profile.onboarding_step === 'completed') return true;
  return Boolean(profile.preferences?.onboarding?.completed);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Pulled from the surrounding QueryClientProvider — used to clear the
  // entire query cache on sign-out so user A's `['outfits', userA, ...]` /
  // `['garments', userA, ...]` / `['planned_outfits', userA, ...]` entries
  // don't sit in memory while user B signs in on the same device.
  // Audit D on PR #718.
  const queryClient = useQueryClient();

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Tracks which userIds we've already fired start_trial for in this app
  // session. supabase-js may emit SIGNED_IN multiple times (token refresh,
  // rehydrate). The edge function is idempotent server-side (DB pre-check +
  // trial_pending metadata + Stripe-side keys), so this is purely a bandwidth
  // optimisation. Keying on userId (rather than the full access_token) keeps
  // the Set's cardinality bounded at 1 per app lifetime — full-token keys
  // grow linearly with refresh count. The Set is also never serialised, so
  // no token leak risk via Sentry / devtools.
  const triggeredTrialKeys = useRef<Set<string>>(new Set());

  // Latest user ref so refreshProfile can read the current user without
  // re-binding identity every render.
  const userRef = useRef<User | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const refreshProfile = useCallback(async () => {
    const u = userRef.current;
    if (!u) {
      setProfile(null);
      return;
    }
    const next = await loadOrCreateProfile(u);
    setProfile(next);
  }, []);

  // M5 — register offline-queue handlers + drive replay from NetInfo.
  // The handler captures `queryClient` so post-replay invalidation refreshes
  // the wardrobe list / count / insights even though replay runs outside any
  // component context. Subscribing to NetInfo here (rather than per-screen)
  // means there's exactly one replay trigger at the app root — multiple
  // listeners would each kick replay, which is idempotent but wasteful.
  useEffect(() => {
    registerHandler<AddGarmentParams>('add-garment-save', async (payload) => {
      await persistGarment(payload);
      queryClient.invalidateQueries({ queryKey: ['garments'] });
      queryClient.invalidateQueries({ queryKey: ['garments-count'] });
      queryClient.invalidateQueries({ queryKey: ['insights_dashboard'] });
    });

    // M10 — Style Memory event handler. Replays a queued payload via
    // dispatchMemoryEvent which uses callEdgeFunction (auto auth refresh +
    // circuit-break). 4xx is swallowed inside dispatchMemoryEvent (already
    // logged); 5xx / transport throws and the queue retries with backoff
    // up to MAX_ATTEMPTS=3 before dropping.
    //
    // Codex P2 round 5 on PR #734: a 429 mid-replay would otherwise burn
    // attempts on every subsequent same-window item — translate it to a
    // HaltReplayError so the queue parks the rest of the snapshot and
    // schedules a deferred replay aligned with the server's retry-after.
    registerHandler<MemoryIngestPayload>(MEMORY_EVENT_ACTION, async (payload) => {
      try {
        await dispatchMemoryEvent(payload);
      } catch (err) {
        if (err instanceof EdgeFunctionRateLimitError) {
          const retryAfterSec = err.retryAfter > 0 ? err.retryAfter : 60;
          throw new HaltReplayError(retryAfterSec * 1000);
        }
        throw err;
      }
    });

    // Kick a replay on mount in case the app cold-started while the queue
    // had survivors from a previous session AND NetInfo's "online" event
    // never fires (because we already landed online). NetInfo's event
    // listener only emits on transitions, not on the steady state.
    //
    // Codex P2 round 1: gate this mount kick on connectivity. A cold-start
    // while offline would otherwise consume one of each item's 3 retry
    // attempts on every launch, dropping items after 3 offline cold-starts
    // even though they never had a real shot at syncing. The NetInfo
    // listener below picks them up the moment we transition to online.
    void (async () => {
      if (await isOnlineNow()) {
        void replayOfflineQueue().catch(() => {});
      }
    })();

    const unsub = NetInfo.addEventListener((state) => {
      const online =
        state.isConnected !== false && state.isInternetReachable !== false;
      if (online) {
        void replayOfflineQueue().catch(() => {});
      }
    });
    return () => {
      unsub();
    };
  }, [queryClient]);

  useEffect(() => {
    let cancelled = false;
    // De-duplicates concurrent profile fetches from racing listeners
    // (SIGNED_IN + getSession on cold start, TOKEN_REFRESHED while a previous
    // load is in flight, etc.). When a fetch is already in flight, later
    // events skip the call and rely on the first one's setProfile to land.
    let profileFetchInFlight = false;

    const settleProfile = (u: User) => {
      if (profileFetchInFlight) {
        // Already loading; the in-flight fetch will flip isLoading=false.
        return;
      }
      profileFetchInFlight = true;
      void loadOrCreateProfile(u)
        .then((p) => {
          if (cancelled) return;
          setProfile(p);
        })
        .finally(() => {
          profileFetchInFlight = false;
          if (!cancelled) setIsLoading(false);
        });
    };

    const maybeFireStartTrial = (u: User) => {
      if (!isFreshSignup(u)) return;
      const key = u.id;
      if (triggeredTrialKeys.current.has(key)) return;
      triggeredTrialKeys.current.add(key);
      // Codex P1 round 2 on PR #733: callEdgeFunction hits
      // supabase.auth.getSession() / refreshSession() on its hot path, and
      // Supabase's docs explicitly warn against calling auth methods inside
      // an onAuthStateChange callback (deadlock). Defer with setTimeout so
      // this synchronous SIGNED_IN listener unwinds before the edge call
      // re-enters auth. The cold-start getSession() path also routes
      // through here so this guard covers both.
      setTimeout(() => {
        void callStartTrial();
      }, 0);
    };

    // 1. Subscribe FIRST so we don't miss the initial SIGNED_IN that getSession
    //    can racily emit alongside.
    const { data: subData } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return;
      setSession(nextSession);
      const nextUser = nextSession?.user ?? null;
      setUser(nextUser);

      if (nextUser) {
        // Keep isLoading true while profile resolves so consumers don't see
        // a stale `isOnboarded=false` for the duration of the fetch.
        setIsLoading(true);
        settleProfile(nextUser);
        if (event === 'SIGNED_IN') {
          maybeFireStartTrial(nextUser);
        }
      } else {
        setProfile(null);
        setIsLoading(false);
      }

      if (event === 'SIGNED_OUT') {
        triggeredTrialKeys.current.clear();
        // Drop every cached query so user A's data doesn't surface during
        // user B's session on the same device. Active queries (none expected
        // mid-sign-out, but defensive) are removed too — `clear()` is the
        // hammer; we trade a refetch on next sign-in for guaranteed isolation.
        queryClient.clear();
        // Drop the module-scope signed-URL cache (`useSignedUrl.ts`). The
        // React Query clear above only invalidates per-queryKey results;
        // the underlying `${bucket}:${path}` Map survives independently and
        // would leak user A's signed URLs (each embeds a JWT in the query
        // string) into user B's renders. Audit-equivalent to the
        // `queryClient.clear()` rationale on PR #718. Wave M2.
        clearSignedUrlCache();
        // Drop any queued mutations so user A's pending offline saves don't
        // replay against user B's session on the same device. Wave M5.
        void clearOfflineQueue();
      }
    });

    // 2. Then check for an existing session (rehydrated from AsyncStorage).
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        const u = data.session?.user ?? null;
        setUser(u);
        if (u) {
          setIsLoading(true);
          settleProfile(u);
          // Cold-start parity with the SIGNED_IN listener branch: a session
          // rehydrated <60s after signup that died before the auth listener
          // could fire still gets the trial mint. The edge function is
          // server-idempotent so a duplicate fire here is a no-op.
          maybeFireStartTrial(u);
        } else {
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[AuthContext] getSession failed:', err);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      subData.subscription.unsubscribe();
    };
    // queryClient is referentially stable across renders (it comes from the
    // QueryClientProvider mounted once at app root), so listing it as a dep
    // doesn't re-fire this effect — but the lint rule needs to see it.
  }, [queryClient]);

  const signIn = useCallback(async (email: string, password: string): Promise<SignResult> => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error: error as Error | null };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName: string): Promise<SignResult> => {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            // Marker the start_trial edge function reads to gate first-trial
            // eligibility (see supabase/functions/start_trial/index.ts).
            trial_pending: true,
          },
        },
      });
      return { error: error as Error | null };
    },
    [],
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn('[AuthContext] signOut server error (clearing local):', error.message);
    }
    // Always clear local state — the auth listener will also fire SIGNED_OUT,
    // but clearing here makes the post-await navigation deterministic.
    setUser(null);
    setSession(null);
    setProfile(null);
    // Drop the query cache eagerly too — listeners can race with the
    // post-await navigation, and the SIGNED_OUT branch above also clears,
    // so this is a "last to win" no-op in the happy path. Audit D.
    queryClient.clear();
    // Same eager-clear rationale for the signed-URL Map: the SIGNED_OUT
    // listener clears it too, but listener ordering vs. post-await nav is
    // racy and the worst case is we render user A's gradient placeholder
    // for one frame instead of leaking their signed URL into user B's session.
    clearSignedUrlCache();
    // Codex P1 round 9 on PR #735: also clear the offline queue here.
    // The SIGNED_OUT listener handles the happy path, but if the supabase
    // auth call fails or the SIGNED_OUT event never fires (e.g. the auth
    // user was just deleted server-side, so the listener's session-state
    // change is a no-op), pending add-garment-save / memory-event items
    // would otherwise sit in AsyncStorage and replay under the next
    // signed-in user.
    //
    // Codex P2 round 12: AWAIT the persisted clear before resolving so
    // an app-kill immediately after the post-signOut nav.reset can't
    // leave queued mutations on disk for the next session. clearQueue
    // swallows its own AsyncStorage errors so this can't reject the
    // outer mutation.
    await clearOfflineQueue();
  }, [queryClient]);

  const isOnboarded = deriveIsOnboarded(profile);

  // M25 audit follow-up — V3-compat mirror backfill for pre-M25 users.
  // Pre-M25 onboarding wrote only `preferences.style_profile_v4_jsonb`; the
  // AI engine consumers read `preferences.styleProfile` (V3 vocab). This
  // hook detects the mismatch on profile load and runs `migrateV4ToV3Compat`
  // once per (app session × user.id) so AI quality recovers without
  // forcing a quiz retake. Idempotent + dedup'd internally; safe to mount
  // unconditionally. Runs only after `isOnboarded`-related profile fields
  // have resolved (the hook itself short-circuits when profile is null).
  useV3CompatBackfill(profile);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      isLoading,
      isOnboarded,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [user, session, profile, isLoading, isOnboarded, signIn, signUp, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
