import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function ExitIntentModal() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let triggered = false;
    const handler = (e: MouseEvent) => {
      if (e.clientY < 5 && !triggered) {
        triggered = true;
        const dismissed = sessionStorage.getItem('burs_exit_dismissed');
        if (!dismissed) setShow(true);
      }
    };
    document.addEventListener('mouseleave', handler);
    return () => document.removeEventListener('mouseleave', handler);
  }, []);

  const dismiss = () => {
    setShow(false);
    sessionStorage.setItem('burs_exit_dismissed', '1');
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" onClick={dismiss}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative glass-panel rounded-2xl p-8 md:p-10 max-w-md w-full text-center space-y-5 animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={dismiss} className="absolute top-4 right-4 text-gray-500 hover:text-white" aria-label="Close">
          <X size={20} />
        </button>
        <h3 className="text-xl md:text-2xl font-bold text-white font-space">
          {t('landing.exit_title')}
        </h3>
        <p className="text-sm text-gray-400 leading-relaxed">
          {t('landing.exit_desc')}
        </p>
        <button
          onClick={() => { dismiss(); navigate('/auth'); }}
          className="w-full py-3.5 bg-white text-[#030305] rounded-full font-medium flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
        >
          {t('landing.start_trial')} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
