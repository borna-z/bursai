import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function TrialBanner() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <section className="section-full px-6 section-gradient-top section-gradient-bottom" style={{ zIndex: 9, minHeight: '60vh' }}>
      <div className="max-w-3xl mx-auto w-full">
        <div className="relative overflow-hidden rounded-2xl glass-panel p-8 md:p-12 text-center border border-amber-400/20 reveal-scale" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
          <p className="text-[10px] tracking-[0.4em] uppercase text-amber-400 mb-3 font-semibold reveal-down" style={{ '--reveal-delay': '150ms' } as React.CSSProperties}>{t('landing.limited_offer')}</p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3 text-white font-space reveal-up" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
            {t('landing.trial_title')}
          </h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto mb-6 reveal-up" style={{ '--reveal-delay': '300ms' } as React.CSSProperties}>
            {t('landing.trial_desc')}
          </p>
          <button onClick={() => navigate('/auth')} className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white h-12 px-8 rounded-full text-sm font-semibold hover:opacity-90 transition-all hover:scale-105 reveal-scale" style={{ '--reveal-delay': '400ms' } as React.CSSProperties}>
            {t('landing.start_trial')} <ArrowRight size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </section>
  );
}
