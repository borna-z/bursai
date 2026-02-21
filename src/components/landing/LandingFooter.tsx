import { Instagram, Twitter } from 'lucide-react';
import bursLandingLogo from '@/assets/burs-landing-logo-white.png';
import { useLanguage } from '@/contexts/LanguageContext';

export function LandingFooter() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-white/5 px-6 py-10 reveal-up" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-gray-500 tracking-wide">
        <div className="flex items-center gap-2">
          <img src={bursLandingLogo} alt="BURS" className="h-5 object-contain" />
        </div>
        <div className="flex gap-6">
          <a href="/privacy" className="hover:text-white transition-colors">{t('landing.footer_privacy')}</a>
          <a href="/terms" className="hover:text-white transition-colors">{t('landing.footer_terms')}</a>
          <a href="/contact" className="hover:text-white transition-colors">{t('landing.footer_contact')}</a>
        </div>
        <div className="flex items-center gap-5">
          <a href="#" aria-label="Instagram" className="hover:text-white transition-colors"><Instagram size={16} strokeWidth={1.5} /></a>
          <a href="#" aria-label="Twitter" className="hover:text-white transition-colors"><Twitter size={16} strokeWidth={1.5} /></a>
        </div>
        <div className="text-center md:text-right space-y-1">
          <span className="block text-gray-400">© {new Date().getFullYear()} BURS AB</span>
          <span className="block text-[10px] text-gray-600">{t('landing.footer_gdpr')}</span>
        </div>
      </div>
    </footer>
  );
}
