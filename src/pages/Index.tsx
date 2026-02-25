import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { BursDrawLogo } from '@/components/ui/BursDrawLogo';
import Landing from './Landing';
import Home from './Home';

const Index = () => {
  const { user, loading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [animDone, setAnimDone] = useState(false);

  const isResolving = loading || (user && profileLoading);
  const showSplash = !animDone || isResolving;

  // After both animation and auth resolve, decide what to show
  const content = (() => {
    if (showSplash) return null;
    if (!user) return <Landing />;
    const prefs = profile?.preferences as Record<string, any> | null;
    const onboardingCompleted = prefs?.onboarding?.completed === true;
    if (!onboardingCompleted) return <Navigate to="/onboarding" replace />;
    return <Home />;
  })();

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="splash"
            className="fixed inset-0 z-50 flex items-center justify-center bg-background"
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <BursDrawLogo onComplete={() => setAnimDone(true)} />
          </motion.div>
        )}
      </AnimatePresence>

      {content}
    </>
  );
};

export default Index;
