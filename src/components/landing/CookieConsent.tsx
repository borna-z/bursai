import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { isMedianApp } from '@/lib/median';

const STORAGE_KEY = 'burs-cookie-consent';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Not needed inside native app wrapper
    if (isMedianApp()) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) setVisible(true);
  }, []);

  const respond = (choice: 'accepted' | 'declined') => {
    localStorage.setItem(STORAGE_KEY, choice);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[60] p-4 sm:p-6 animate-fade-in" style={{ animationDuration: '400ms' }}>
      <div className="max-w-xl mx-auto glass-panel border border-white/10 rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 text-sm text-gray-300">
        <p className="flex-1 leading-relaxed">
          We use cookies to improve your experience.{' '}
          <Link to="/privacy" className="underline underline-offset-2 text-white hover:opacity-80 transition-opacity">
            Privacy Policy
          </Link>
        </p>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={() => respond('declined')}
            className="px-5 py-2 rounded-full text-sm font-medium border border-white/20 text-gray-300 hover:text-white hover:border-white/40 transition-all"
          >
            Decline
          </button>
          <button
            onClick={() => respond('accepted')}
            className="px-5 py-2 rounded-full text-sm font-medium bg-white text-[#030305] hover:opacity-90 transition-all"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
