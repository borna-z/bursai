import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { Loader2 } from 'lucide-react';
import Home from './Home';

const Index = () => {
  const { user, loading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();

  if (loading || (user && profileLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/welcome" replace />;
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
