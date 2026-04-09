import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PageSkeleton } from '@/components/layout/PageSkeleton';

function isPwa(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (user) {
      navigate('/home', { replace: true });
      return;
    }

    let cancelled = false;

    // Double-check with Supabase directly before redirecting away.
    // This prevents a brief auth-context race from sending users to the wrong destination.
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;

      if (session?.user) {
        navigate('/home', { replace: true });
      } else if (isPwa()) {
        navigate('/auth', { replace: true });
      } else {
        window.location.replace('https://burs.me');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user, loading, navigate]);

  return <PageSkeleton />;
}
