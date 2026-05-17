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

import { supabase } from '../lib/supabase';
import { Sentry } from '../lib/sentry';
import { clearSignedUrlCache } from '../hooks/useSignedUrl';
import { clearQueue as clearOfflineQueue } from '../lib/offlineQueue';
import { enqueueStartTrial } from '../lib/trialStart';
import { useV3CompatBackfill } from '../hooks/useV3CompatBackfill';
import { useOfflineQueueReplay } from '../hooks/useOfflineQueueReplay';
import {
  loadOrCreateProfile,
  isFreshSignup,
} from '../auth/hydrateAuthFromStorage';
import { deriveIsOnboarded } from '../auth/deriveOnboardingStatus';
import type {
  AuthContextValue,
  Profile,
  SignResult,
} from '../auth/types';

export type {
  AuthContextValue,
  OnboardingPrefs,
  Profile,
  ProfilePreferences,
  SignResult,
} from '../auth/types';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const triggeredTrialKeys = useRef<Set<string>>(new Set());

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

  useOfflineQueueReplay();

  useEffect(() => {
    let cancelled = false;
    let profileFetchInFlight = false;

    const settleProfile = (u: User) => {
      if (profileFetchInFlight) {
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
      // M46: route through offline-queue-aware helper so a transient
      // Supabase blip during signup doesn't lose the trial silently.
      // `enqueueStartTrial` never throws — it surfaces failures via
      // Sentry / the offline queue, preserving the non-blocking contract.
      setTimeout(() => {
        void enqueueStartTrial(u.id);
      }, 0);
    };

    const { data: subData } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return;
      setSession(nextSession);
      const nextUser = nextSession?.user ?? null;
      setUser(nextUser);

      if (nextUser) {
        Sentry.setUser({ id: nextUser.id });
      } else {
        Sentry.setUser(null);
      }

      if (nextUser) {
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
        queryClient.clear();
        clearSignedUrlCache();
        void clearOfflineQueue();
      }
    });

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        const u = data.session?.user ?? null;
        setUser(u);
        if (u) {
          Sentry.setUser({ id: u.id });
        } else {
          Sentry.setUser(null);
        }
        if (u) {
          setIsLoading(true);
          settleProfile(u);
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
      // N17 / Copilot #4 — defensive optional-chain. If onAuthStateChange
      // returned undefined (Supabase outage at provider mount, mock
      // returning empty data in test), the original unconditional access
      // would throw on cleanup and mask the real error in React's
      // dev-time logs. Optional-chain makes cleanup safe.
      subData?.subscription?.unsubscribe?.();
    };
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
    setUser(null);
    setSession(null);
    setProfile(null);
    queryClient.clear();
    clearSignedUrlCache();
    await clearOfflineQueue();
  }, [queryClient]);

  const isOnboarded = deriveIsOnboarded(profile);

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
