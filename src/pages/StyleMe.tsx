import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChatPageSkeleton } from '@/components/ui/skeletons';
import { AppLayout } from '@/components/layout/AppLayout';

export default function StyleMe() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    navigate(`/ai/generate${location.search}`, { replace: true, state: location.state });
  }, [location.search, location.state, navigate]);

  return (
    <AppLayout>
      <ChatPageSkeleton />
    </AppLayout>
  );
}
