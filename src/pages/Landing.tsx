import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isMedianApp } from '@/lib/median';
import { isStandalonePwa } from '@/lib/pwa';

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    if (/jsdom/i.test(window.navigator.userAgent)) {
      return;
    }
    if (isMedianApp() || isStandalonePwa()) {
      navigate('/auth', { replace: true });
      return;
    }
    window.location.replace('/landing.html');
  }, [navigate]);

  return null;
}
