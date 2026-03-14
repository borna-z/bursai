import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { isMedianApp } from '@/lib/median';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import { asPreferences } from '@/types/preferences';
import Landing from './Landing';
import Home from './Home';

const Index = () => {
  const { user, loading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();

  const isResolving = loading || (user && profileLoading);

  if (isResolving) return <PageSkeleton />;

  if (!user) return isMedianApp() ? <Navigate to="/auth" replace /> : <Landing />;

  const prefs = asPreferences(profile?.preferences);
  const onboardingCompleted = prefs?.onboarding?.completed === true;
  if (!onboardingCompleted) return <Navigate to="/onboarding" replace />;

  return <Home />;
};

export default Index;
