import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PageSkeleton } from '@/components/layout/PageSkeleton';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (user) {
      navigate('/home', { replace: true });
      return;
    }

    // Double-check with Supabase directly before redirecting away
    // This prevents race condition where session isn't in context yet
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate('/home', { replace: true });
      } else {
        setChecked(true);
      }
    });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (checked) {
      window.location.replace('https://burs.me');
    }
  }, [checked]);

  return <PageSkeleton />;
}
