import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { Loader2 } from 'lucide-react';
import { isOnboardingExempt } from '@/components/auth/onboardingExempt';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Wave 7 P44: source of truth for onboarding completion swaps from the
 * client-side `preferences.onboarding.completed` boolean to the server-known
 * `profile.onboarding_step` enum. Anyone whose step is not 'completed' is
 * redirected to /onboarding unless they're on an exempt path
 * (see `onboardingExempt.ts`).
 *
 * The previous `skipOnboardingCheck` prop is gone — the route gate is
 * pathname-driven, so callers don't need to opt out. `/onboarding` itself
 * is in the exempt list, replacing the prop's only previous use.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const location = useLocation();

  if (loading || (user && profileLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Source of truth: profile.onboarding_step. Once a row exists, the column
  // has NOT NULL DEFAULT 'not_started' so missing-value handling collapses to
  // the same redirect. Cast guards against types.ts being temporarily stale
  // (auto-generated; regen runs post-merge per CLAUDE.md).
  if (profile && !isOnboardingExempt(location.pathname)) {
    const step =
      (profile as { onboarding_step?: string | null }).onboarding_step ?? null;
    if (step !== 'completed') {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return <>{children}</>;
}
