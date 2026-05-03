// AuthContext — single source of truth for auth + profile state on mobile.
//
// Modeled on src/contexts/AuthContext.tsx (web) but slimmed for RN:
//   • No React Query — exposes profile directly so screens read via useAuth().
//   • Session is persisted automatically (supabase.ts wires AsyncStorage).
//   • start_trial fires once per fresh signup (gated on user.created_at < 60s)
//     via plain fetch — no edgeFunctionClient port yet.
//
// On SIGNED_IN: load (or auto-create) the profile row.
// On SIGNED_OUT: clear user/session/profile.

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

import { supabase, supabaseUrl } from '../lib/supabase';

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

export type Profile = {
  id: string;
  display_name: string | null;
  preferences: ProfilePreferences;
  mannequin_presentation: string | null;
  created_at: string;
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

// Fresh-signup detection window — start_trial fires only when the user row
// was created within this many ms of the SIGNED_IN event. Prevents trial
// re-fires on every returning login or token refresh. The edge function is
// idempotent (DB pre-check + Stripe-side keys + DB-backed request_idempotency)
// so this is a bandwidth optimisation, not a correctness gate.
const FRESH_SIGNUP_WINDOW_MS = 60_000;

async function callStartTrial(accessToken: string): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/functions/v1/start_trial`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
  } catch {
    // Fire-and-forget — trial failure must never block the auth flow.
  }
}

async function loadOrCreateProfile(user: User): Promise<Profile | null> {
  // maybeSingle so a missing row returns null instead of an error.
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, preferences, mannequin_presentation, created_at')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.warn('[AuthContext] profile select failed:', error.message);
    return null;
  }

  if (data) return data as Profile;

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
    .select('id, display_name, preferences, mannequin_presentation, created_at')
    .single();

  if (insertError) {
    // FK violation = ghost session (user not in auth.users). Sign out so the
    // app stops looping on a phantom user. Mirrors web's useProfile.
    if ((insertError as { code?: string }).code === '23503') {
      console.warn('[AuthContext] ghost session detected — signing out');
      await supabase.auth.signOut();
      return null;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Tracks which (userId, accessToken) pairs we've already fired start_trial
  // for in this app session. supabase-js may emit SIGNED_IN multiple times
  // (token refresh, rehydrate). The full access_token (not a prefix) keys
  // each unique JWT so a re-sign-in or token refresh re-fires; the edge
  // function dedupes server-side anyway. Mirrors web pattern.
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

  useEffect(() => {
    let cancelled = false;

    // 1. Subscribe FIRST so we don't miss the initial SIGNED_IN that getSession
    //    can racily emit alongside.
    const { data: subData } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return;
      setSession(nextSession);
      const nextUser = nextSession?.user ?? null;
      setUser(nextUser);
      setIsLoading(false);

      if (event === 'SIGNED_IN' && nextUser && nextSession?.access_token) {
        // Hydrate / auto-create profile.
        void loadOrCreateProfile(nextUser).then((p) => {
          if (!cancelled) setProfile(p);
        });

        // Fresh-signup trial mint — fire-and-forget.
        if (isFreshSignup(nextUser)) {
          const key = `${nextUser.id}:${nextSession.access_token}`;
          if (!triggeredTrialKeys.current.has(key)) {
            triggeredTrialKeys.current.add(key);
            void callStartTrial(nextSession.access_token);
          }
        }
      }

      if (event === 'TOKEN_REFRESHED' && nextUser && !profile) {
        // Recover profile if a token refresh happened without our cache yet.
        void loadOrCreateProfile(nextUser).then((p) => {
          if (!cancelled) setProfile(p);
        });
      }

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        triggeredTrialKeys.current.clear();
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
          void loadOrCreateProfile(u).then((p) => {
            if (!cancelled) setProfile(p);
          });
          // Cold-start parity with the SIGNED_IN listener branch: if the
          // rehydrated session belongs to a user created <60s ago, fire the
          // trial mint. Covers the case where the user signed up on a
          // previous launch that died before the auth listener could fire.
          // The edge function is idempotent across DB pre-check + Stripe-side
          // keys, so a duplicate fire here is a no-op on the server.
          if (data.session?.access_token && isFreshSignup(u)) {
            const key = `${u.id}:${data.session.access_token}`;
            if (!triggeredTrialKeys.current.has(key)) {
              triggeredTrialKeys.current.add(key);
              void callStartTrial(data.session.access_token);
            }
          }
        }
        setIsLoading(false);
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
    // We intentionally do not depend on `profile` — re-subscribing on every
    // profile change would tear down the auth listener. The TOKEN_REFRESHED
    // branch reads `profile` via closure, so a stale-closure miss just means
    // we don't re-hydrate on a refresh that happens with no profile cached
    // yet — recoverable on the next event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  }, []);

  const isOnboarded = Boolean(profile?.preferences?.onboarding?.completed);

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
