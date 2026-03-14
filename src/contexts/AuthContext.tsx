import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // When user signs in, mark session active in sessionStorage
        if (event === 'SIGNED_IN') {
          sessionStorage.setItem('session_active', 'true');
        }
        if (event === 'SIGNED_OUT') {
          sessionStorage.removeItem('session_active');
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      // If "remember me" was unchecked and this is a new browser session, sign out
      const rememberMe = localStorage.getItem('remember_me');
      const sessionActive = sessionStorage.getItem('session_active');

      if (session && rememberMe === 'false' && !sessionActive) {
        // Session exists but user didn't want to stay logged in and this is a new tab/window session
        supabase.auth.signOut().then(() => {
          setSession(null);
          setUser(null);
          setLoading(false);
        });
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Mark session active for current browser session
      if (session) {
        sessionStorage.setItem('session_active', 'true');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: displayName ? { display_name: displayName } : undefined
      }
    });
    
    return { data, error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    // Always clear local state even if the server session was already invalid
    if (error) {
      console.warn('Sign out server error (clearing local state):', error.message);
      setSession(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
