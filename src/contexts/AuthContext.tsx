// DEPRECATED — web-only Stripe path, scheduled for deletion post-launch.
// Retained until web app removal. Do NOT add new callers; mobile uses RevenueCat exclusively.
// N10 hygiene marker: this file invokes the start_trial Stripe edge function on first sign-in.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { buildAppUrl } from '@/lib/appUrl';
import { logger } from '@/lib/logger';
import { drainMemoryEventQueue } from '@/lib/memoryEventQueue';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { buildMemoryIdempotencyKey } from '@/lib/memoryEvents';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ data: { user: User | null; session: Session | null }; error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

// Wave 8.5 PR B (P86) — exported so hooks like useRecordMemoryEvent can
// useContext(AuthContext) directly without throwing when no provider is
// in scope (matters for component-isolated tests that don't wrap with
// AuthProvider but still render hooks calling useAuth).
// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

        // Wave 8 P52 — auto-start a 3-day Stripe trial on first SIGNED_IN.
        // Fire-and-forget: we don't block the UI on a Stripe API call. The
        // edge function is idempotent across DB pre-check +
        // request_idempotency + Stripe-side keys, AND server-side gates on
        // a fresh `auth.users.raw_user_meta_data.trial_pending` read (not
        // on JWT claims). So calling for legacy users / returning logins
        // results in cheap short-circuits without burning rate-limit quota
        // (Codex round 7).
        //
        // Codex P1 round 8 on PR #698 — the previous version gated this
        // call on `session.user.user_metadata.trial_pending === true`,
        // i.e. the JWT claim. But `handle_new_user` is an AFTER INSERT
        // trigger that updates raw_user_meta_data after the row is
        // inserted, so the FIRST session JWT issued by Supabase auth can
        // carry pre-trigger metadata (no trial_pending flag yet). The
        // gate then silently skipped fresh OAuth + email-confirm signups
        // on their first SIGNED_IN, leaving them on the free plan until a
        // later token refresh. Eligibility is now decided exclusively
        // server-side from the live DB row, so the client just dedupes
        // and dispatches.
        //
        // The edge function never trusts client-supplied userId — it
        // derives from the verified JWT — so an in-flight invoke that
        // completes after sign-out can only ever write for the JWT's
        // owner. No risk of cross-user contamination.
        if (event === 'SIGNED_IN' && session?.user?.id && session.access_token) {
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
                // the subscriptions row for 5 minutes. Without this
                // invalidation, the UI would keep showing free-tier
                // limits + paywall gating until cache expiry, even
                // though start_trial just upserted plan='premium'.
                // Force a refetch so the UI flips to trialing
                // immediately after the trial mints. (No-op for
                // not_eligible / already_started responses — the cache
                // either has nothing to refresh or refetches the same
                // current state.)
                queryClient.invalidateQueries({ queryKey: ['subscription'] });
              })
              .catch((err) => {
                // Network / transport failures throw and land here. Same
                // rollback so the next SIGNED_IN retries.
                logger.warn('[AuthContext] start_trial invoke threw', err);
                triggeredTrialKeys.current.delete(triggerKey);
              });
          }

          // Wave 8.5 P86 — drain offline memory event queue.
          //
          // Fire-and-forget; each entry calls memory_ingest individually
          // with its own idempotency key (server-side request_idempotency
          // dedups within the 5-minute TTL window). Other-user entries are
          // skipped by the drainer; failed entries stay queued for the
          // next drain.
          //
          // Runs AFTER the start_trial dispatch so the user's subscription
          // gate has the best chance of being trialing before the drained
          // memory_ingest invocations fire (avoids 402 lock-out on every
          // queued entry for users who only just minted a trial).
          void drainMemoryEventQueue(session.user.id, async (userId, input) => {
            const idempotency_key = buildMemoryIdempotencyKey(userId, input);
            const { error } = await invokeEdgeFunction('memory_ingest', {
              body: { ...input, idempotency_key },
              retries: 1,
              timeout: 8000,
            });
            if (error) {
              // Throw so the queue keeps the entry for the next drain.
              throw error;
            }
          });
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

// Wave 8.5 PR B (P86) — non-throwing variant for hooks that may be
// mounted inside isolated component tests that don't wrap with
// AuthProvider. Returns null when no provider is in scope; callers
// should treat null as "unauthenticated" and no-op.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuthOrNull(): AuthContextType | null {
  const context = useContext(AuthContext);
  return context ?? null;
}
