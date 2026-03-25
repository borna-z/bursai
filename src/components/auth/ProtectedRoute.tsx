import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { asPreferences } from '@/types/preferences';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  skipOnboardingCheck?: boolean;
}

export function ProtectedRoute({ children, skipOnboardingCheck = false }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const location = useLocation();

  console.log('[ProtectedRoute]', location.pathname, { loading, user: !!user, profileLoading, hasProfile: !!profile });

  if (loading || (user && profileLoading)) {
    console.log('[ProtectedRoute] Showing spinner for', location.pathname);
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    console.log('[ProtectedRoute] No user, redirecting to /auth from', location.pathname);
    return <Navigate to="/auth" replace />;
  }

  // Redirect to onboarding if not completed (unless we're already there)
  if (!skipOnboardingCheck && profile) {
    const prefs = asPreferences(profile.preferences);
    const onboardingCompleted = prefs?.onboarding?.completed === true;
    if (!onboardingCompleted && location.pathname !== '/onboarding') {
      console.log('[ProtectedRoute] Redirecting to onboarding from', location.pathname);
      return <Navigate to="/onboarding" replace />;
    }
  }

  return <>{children}</>;
}
