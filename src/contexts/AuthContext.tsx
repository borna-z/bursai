import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { buildAppUrl } from '@/lib/appUrl';
import { logger } from '@/lib/logger';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ data: { user: User | null; session: Session | null }; error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  // Wave 8 P52 — track which (userId, accessToken) pairs we've already
  // fired start_trial for in this tab. supabase-js fires SIGNED_IN multiple
  // times per session (token refresh, rehydrate-from-storage, focus
  // re-validate). Keying on the FULL access token (not a prefix) means a
  // fresh sign-in OR a token refresh (both produce a new JWT) re-fires
  // once, catching the case where the user signs out and back in
  // — including local-only sign-out fallbacks that don't emit SIGNED_OUT.
  // The edge function itself is idempotent across three layers, so this
  // guard is a bandwidth optimization, not a correctness gate.
  //
  // Codex P2 round 2 on PR #698 — earlier version used
  // `access_token.slice(0, 16)` which captured only the JWT header
  // (constant prefix `eyJhbGciOi...`), collapsing the key to
  // `userId + <constant>`. Token-refresh + local-sign-out paths were
  // therefore silently suppressed.
  const triggeredTrialKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        logger.debug('[AuthContext] onAuthStateChange', event, { hasSession: !!session, userId: session?.user?.id?.slice(0, 8) });
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Wave 8 P52 — auto-start a 3-day Stripe trial on first SIGNED_IN
        // for users who explicitly opted in via signUp() (the trial_pending
        // user_metadata flag). Fire-and-forget: we don't block the UI on a
        // Stripe API call. The edge function is idempotent across DB pre-
        // check + DB-backed request_idempotency + Stripe-side keys.
        //
        // Codex P1 rounds 3+5 on PR #698 — earlier versions called
        // start_trial on EVERY SIGNED_IN, then gated server-side via a
        // 24h `subscriptions.created_at` recency check. That had two
        // failure modes: (a) auto-enrolled legacy users on their next
        // login (out of P52's documented "on signup completion" scope);
        // (b) permanently locked out fresh signups whose first call
        // failed transiently OR whose email-confirm took >24h. Switched
        // to an explicit per-signup signal: the signUp() callback below
        // sets `trial_pending: true` in user_metadata, and start_trial
        // server-side clears it after a successful mint. Legacy users
        // never carry the flag → never trigger; OAuth signups don't
        // currently set the flag → handled separately by re-subscribe
        // paths (out of scope for P52).
        //
        // The edge function never trusts client-supplied userId — it
        // derives from the verified JWT — so an in-flight invoke that
        // completes after sign-out can only ever write for the JWT's
        // owner. No risk of cross-user contamination.
        if (event === 'SIGNED_IN' && session?.user?.id && session.access_token) {
          const trialPending = (session.user.user_metadata as { trial_pending?: unknown })?.trial_pending === true;
          if (trialPending) {
            // Use the full access_token (not a prefix) — JWT headers are
            // constant, so a prefix slice collapses to a static value and
            // suppresses every token-refresh / local-sign-out re-fire.
            const triggerKey = `${session.user.id}:${session.access_token}`;
            if (!triggeredTrialKeys.current.has(triggerKey)) {
              // Add to dedup set BEFORE invoke to prevent thundering-herd
              // from back-to-back SIGNED_IN events (token refresh races,
              // multi-tab re-hydrate). On any failure we roll back the
              // entry below so the next SIGNED_IN re-fires.
              triggeredTrialKeys.current.add(triggerKey);
              void supabase.functions
                .invoke('start_trial', { body: {} })
                .then((result) => {
                  // Codex P1 round 1 on PR #698 — supabase-js's
                  // functions.invoke() resolves with `{ data, error }` on
                  // 4xx/5xx HTTP responses INSTEAD of rejecting the promise.
                  // Without this `.then` check, a transient 5xx would be
                  // treated as success and poison the dedup set, leaving
                  // the user on the free row until sign-out / token rotation.
                  if (result?.error) {
                    logger.warn('[AuthContext] start_trial returned error', result.error);
                    triggeredTrialKeys.current.delete(triggerKey);
                    return;
                  }
                  // Codex P2 round 5 on PR #698 — useSubscription caches
                  // user_subscriptions for 5 minutes. Without this
                  // invalidation, the UI would keep showing free-tier
                  // limits + paywall gating until cache expiry, even
                  // though start_trial just upserted plan='premium'.
                  // Force a refetch so the UI flips to trialing
                  // immediately after the trial mints.
                  queryClient.invalidateQueries({ queryKey: ['subscription'] });
                })
                .catch((err) => {
                  // Network / transport failures throw and land here. Same
                  // rollback so the next SIGNED_IN retries.
                  logger.warn('[AuthContext] start_trial invoke threw', err);
                  triggeredTrialKeys.current.delete(triggerKey);
                });
            }
          }
        }

        // Reset the dedup set on sign-out so a subsequent sign-in (including
        // sign-in as a different user on the same tab) is never silently
        // skipped because of a stale stored key. Belt-and-suspenders against
        // supabase-js queueing or replaying SIGNED_IN events with older
        // tokens — addresses code-reviewer P1 finding pre-push.
        if (event === 'SIGNED_OUT') {
          triggeredTrialKeys.current.clear();
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      logger.debug('[AuthContext] getSession resolved', { hasSession: !!session, userId: session?.user?.id?.slice(0, 8) });
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((error) => {
      logger.error('[AuthContext] getSession failed', error);
      setSession(null);
      setUser(null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    const redirectUrl = buildAppUrl('/auth');

    // Wave 8 P52 — set `trial_pending: true` in user_metadata so the
    // onAuthStateChange listener above knows this is a fresh signup
    // (vs. a returning user logging in). start_trial server-side clears
    // the flag after a successful Stripe trial mint.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          ...(displayName ? { display_name: displayName } : {}),
          trial_pending: true,
        },
      }
    });

    return { data, error: error as Error | null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error: error as Error | null };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    // Always clear local state even if the server session was already invalid
    if (error) {
      logger.warn('Sign out server error (clearing local state):', error.message);
      setSession(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  }), [loading, session, signIn, signOut, signUp, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
