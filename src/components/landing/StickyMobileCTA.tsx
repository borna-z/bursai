import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function StickyMobileCTA() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const container = document.querySelector('.dark-landing');
    if (!container) return;
    const onScroll = () => {
      setShow(container.scrollTop > window.innerHeight * 0.8);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  if (!show || dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden animate-slide-in-bottom safe-bottom">
      <div className="glass-panel border-t border-white/10 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/auth')}
          className="flex-1 bg-white text-[#030305] py-3 rounded-full text-sm font-medium flex items-center justify-center gap-2"
        >
          {t('landing.get_started')} <ArrowRight size={16} />
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-2 text-gray-500 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
