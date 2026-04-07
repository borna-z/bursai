import { useEffect } from 'react';

export default function Landing() {
  useEffect(() => {
    if (/jsdom/i.test(window.navigator.userAgent)) {
      return;
    }
    window.location.replace('/landing.html');
  }, []);

  return null;
}
