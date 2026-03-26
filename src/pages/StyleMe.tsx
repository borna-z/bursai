import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatPageSkeleton } from '@/components/ui/skeletons';
import { AppLayout } from '@/components/layout/AppLayout';

export default function StyleMe() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/ai/generate', { replace: true });
  }, [navigate]);

  return (
    <AppLayout>
      <ChatPageSkeleton />
    </AppLayout>
  );
}
