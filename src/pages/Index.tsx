import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user) {
      navigate('/home', { replace: true });
    } else {
      window.location.replace('https://burs.me');
    }
  }, [user, loading, navigate]);

  return null;
}
