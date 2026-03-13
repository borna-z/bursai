import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Send, Check, Loader2, Instagram } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import bursLogo from '@/assets/burs-monogram.png';

export default function Contact() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    await new Promise(r => setTimeout(r, 1000));
    setStatus('success');
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#030305', color: '#F5F7FA' }}>
      <Helmet>
        <title>{t('contact.title')} — BURS</title>
        <meta name="description" content={t('contact.subtitle')} />
      </Helmet>

      {/* Header */}
      <header className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-xl hover:bg-white/[0.04] transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          <img src={bursLogo} alt="BURS" className="h-6 object-contain opacity-80" />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-xl mx-auto px-4 py-12 md:py-20 w-full">
        <div className="text-center mb-12">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <Mail className="w-7 h-7 text-white/60" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {t('contact.title')}
          </h1>
          <p className="text-sm" style={{ color: '#A9B2C3' }}>{t('contact.subtitle')}</p>
        </div>

        <div className="text-center mb-10">
          <a
            href="mailto:hello@burs.me"
            className="text-sm font-medium hover:underline transition-colors"
            style={{ color: '#A9B2C3' }}
          >
            hello@burs.me
          </a>
        </div>

        {status === 'success' ? (
          <div
            className="flex items-center justify-center gap-3 p-6 rounded-xl animate-fade-in"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <Check className="w-5 h-5 text-white/70" />
            <span className="font-medium text-white/90">{t('contact.success')}</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder={t('contact.name')}
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
              className="w-full h-12 px-4 rounded-xl text-sm text-white placeholder:text-white/30 outline-none focus:ring-1 focus:ring-white/20 transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            />
            <input
              type="email"
              placeholder={t('contact.email')}
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              required
              className="w-full h-12 px-4 rounded-xl text-sm text-white placeholder:text-white/30 outline-none focus:ring-1 focus:ring-white/20 transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            />
            <textarea
              placeholder={t('contact.message')}
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              rows={5}
              required
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/30 outline-none focus:ring-1 focus:ring-white/20 transition-all resize-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full h-12 rounded-full bg-white text-[#030305] font-semibold text-sm tracking-wide hover:scale-[1.02] active:scale-[0.98] transition-transform duration-300 inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {status === 'loading' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {t('contact.send')}
                </>
              )}
            </button>
          </form>
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-xl mx-auto px-4 py-8 flex flex-col items-center gap-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
            <img src={bursLogo} alt="BURS" className="h-8 object-contain opacity-60" />
            <div className="flex gap-6 text-xs tracking-wide" style={{ color: '#555' }}>
              <Link to="/privacy" className="hover:text-white transition-colors">{t('footer.privacy')}</Link>
              <Link to="/terms" className="hover:text-white transition-colors">{t('footer.terms')}</Link>
              <span className="text-white/60 font-medium">{t('contact.title')}</span>
            </div>
            <a
              href="https://www.instagram.com/burs_style"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="hover:text-white transition-colors"
              style={{ color: '#555' }}
            >
              <Instagram size={16} strokeWidth={1.5} />
            </a>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-2 w-full text-[10px]" style={{ color: '#444' }}>
            <p>© {new Date().getFullYear()} BURS AB</p>
            <p className="text-center max-w-md">{t('contact.gdpr_note')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
