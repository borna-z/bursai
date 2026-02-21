import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import Landing from './Landing';
import Home from './Home';

const Index = () => {
  const { user, loading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();

  // While auth is loading OR user is not logged in, show Landing instantly (no spinner, no redirect)
  if (loading || !user) {
    return <Landing />;
  }

  // Auth resolved with a user — wait for profile before deciding
  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#030305]">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  // Check onboarding
  if (profile) {
    const prefs = profile.preferences as Record<string, any> | null;
    const onboardingCompleted = prefs?.onboarding?.completed === true;
    if (!onboardingCompleted) {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return <Home />;
};

export default Index;
