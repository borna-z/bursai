import { Instagram } from 'lucide-react';
import bursLandingLogo from '@/assets/burs-logo-white.png';
import { useLanguage } from '@/contexts/LanguageContext';

export function LandingFooter() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-white/5 px-6 py-12 reveal-up" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-8">
          <img src={bursLandingLogo} alt="BURS" className="h-5 object-contain" />
          <div className="flex flex-wrap justify-center gap-6 text-xs text-gray-500 tracking-wide">
            <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-white transition-colors">Terms of Use</a>
            <a href="/contact" className="hover:text-white transition-colors">{t('landing.footer_contact')}</a>
          </div>
          <div className="flex items-center gap-5">
            <a href="https://www.instagram.com/burs_style" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="hover:text-white text-gray-500 transition-colors">
              <Instagram size={16} strokeWidth={1.5} />
            </a>
          </div>
        </div>

        {/* PWA Install hint */}
        <div className="glass-panel rounded-xl p-6 mb-8 text-center">
          <h3 className="text-sm font-medium text-white mb-2">{t('landing.download_title')}</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">{t('landing.download_desc')}</p>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] text-gray-600">
          <p>By using BURS you agree to our <a href="/privacy" className="underline hover:text-white transition-colors">Privacy Policy</a>.</p>
          <span className="text-gray-400">© {new Date().getFullYear()} BURS AB</span>
          <span>{t('landing.footer_gdpr')}</span>
        </div>
      </div>
    </footer>
  );
}
