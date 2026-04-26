import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { Loader2 } from 'lucide-react';
import { isOnboardingExempt } from '@/components/auth/onboardingExempt';
import { asPreferences } from '@/types/preferences';

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

  // Source of truth: profile.onboarding_step. Once the migration applies,
  // every profile row has the column set (NOT NULL DEFAULT 'not_started')
  // and the legacy fallback below never fires. Cast guards against types.ts
  // being temporarily stale (auto-generated; regen runs post-merge per
  // CLAUDE.md hard rule).
  if (profile && !isOnboardingExempt(location.pathname)) {
    const step =
      (profile as { onboarding_step?: string | null }).onboarding_step ?? null;

    if (step === null) {
      // Deploy-window fallback: the frontend may ship before
      // `npx supabase db push --linked --yes` applies the migration on the
      // backend. During that window the column doesn't exist on the row, so
      // `step` is undefined (zod's `.optional()` honours the missing key).
      // Without this fallback, every authenticated user — including those
      // whose legacy `preferences.onboarding.completed=true` is already set —
      // would be redirected to /onboarding, and the OLD Onboarding.tsx page
      // would `Navigate to "/"` on `preferences?.onboarding?.completed === true`,
      // creating a redirect loop. Trust the legacy flag until the column
      // propagates.
      const prefs = asPreferences(profile.preferences);
      if (prefs?.onboarding?.completed !== true) {
        return <Navigate to="/onboarding" replace />;
      }
    } else if (step !== 'completed') {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return <>{children}</>;
}
