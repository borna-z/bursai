import { Instagram } from 'lucide-react';
import bursLandingLogo from '@/assets/burs-logo-white.png';
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
          <a href="/terms" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
          <a href="/contact" className="hover:text-white transition-colors">{t('landing.footer_contact')}</a>
        </div>
        <div className="flex items-center gap-5">
          <a href="https://www.instagram.com/burs_style" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="hover:text-white transition-colors"><Instagram size={16} strokeWidth={1.5} /></a>
        </div>
        <div className="text-center md:text-right space-y-1">
          <span className="block text-gray-400">© {new Date().getFullYear()} BURS AB</span>
          <span className="block text-[10px] text-gray-600">{t('landing.footer_gdpr')}</span>
        </div>
      </div>
    </footer>
  );
}
