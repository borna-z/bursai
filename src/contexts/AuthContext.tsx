import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
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

  // Wave 8 P52 — track which (userId, accessToken) pairs we've already
  // fired start_trial for in this tab. supabase-js fires SIGNED_IN multiple
  // times per session (token refresh, rehydrate-from-storage, focus
  // re-validate). Keying on the access-token prefix means a fresh sign-in
  // (with a new token) re-fires once even within the same browser tab,
  // catching the case where the user signs out and back in. The edge
  // function itself is idempotent across three layers, so this guard is a
  // bandwidth optimization, not a correctness gate.
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
        // Fire-and-forget: we don't block the UI on a Stripe API call, and
        // the edge function is idempotent (DB pre-check + DB-backed
        // request_idempotency + Stripe-side keys). Re-firing on every reload
        // is a no-op after the first success. SIGNED_IN handles BOTH email-
        // confirmed signups AND OAuth signups uniformly — both events fire
        // SIGNED_IN on first session creation. Failure path: the next
        // SIGNED_IN re-fires; meanwhile the user is on the default
        // plan='free' row from handle_new_user (still works, just at 0.5x
        // rate multiplier until start_trial lands).
        //
        // The edge function never trusts client-supplied userId — it derives
        // userId from the verified JWT — so an in-flight invoke that completes
        // after sign-out can only ever write for the JWT's owner. No risk of
        // cross-user contamination.
        if (event === 'SIGNED_IN' && session?.user?.id && session.access_token) {
          const triggerKey = `${session.user.id}:${session.access_token.slice(0, 16)}`;
          if (!triggeredTrialKeys.current.has(triggerKey)) {
            triggeredTrialKeys.current.add(triggerKey);
            void supabase.functions
              .invoke('start_trial', { body: {} })
              .catch((err) => {
                logger.warn('[AuthContext] start_trial invoke failed', err);
              });
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
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    const redirectUrl = buildAppUrl('/auth');
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: displayName ? { display_name: displayName } : undefined
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
