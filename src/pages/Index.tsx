import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import Landing from './Landing';
import Home from './Home';

const Index = () => {
  const { user, loading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();

  // Auth is still resolving -- show neutral loading screen (not landing page)
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-2 border-muted border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  // Auth resolved with no user -- show landing page
  if (!user) {
    return <Landing />;
  }

  // User exists, wait for profile
  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-2 border-muted border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  // Check onboarding — if profile is null or onboarding not completed, go to onboarding
  const prefs = profile?.preferences as Record<string, any> | null;
  const onboardingCompleted = prefs?.onboarding?.completed === true;
  if (!onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Home />;
};

export default Index;
