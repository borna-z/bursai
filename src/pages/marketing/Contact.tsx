import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Send, Check, Loader2, Instagram } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { motion } from 'framer-motion';
import bursLogo from '@/assets/burs-monogram.png';

export default function Contact() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    hapticLight();
    setStatus('loading');
    await new Promise(r => setTimeout(r, 1000));
    setStatus('success');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Helmet>
        <title>{t('contact.title')} — BURS</title>
        <meta name="description" content={t('contact.subtitle')} />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </Helmet>

      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-xl transition-colors text-foreground cursor-pointer">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <img src={bursLogo} alt="BURS" className="h-6 object-contain opacity-80" />
        </div>
      </header>

      {/* Content */}
      <motion.main
        className="flex-1 max-w-xl mx-auto px-4 py-12 md:py-20 w-full"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="text-center mb-12">
          <div className="w-14 h-14 flex items-center justify-center mx-auto mb-6 bg-secondary">
            <Mail className="w-7 h-7 text-muted-foreground" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight font-display text-foreground">
            {t('contact.title')}
          </h1>
          <p className="text-sm text-muted-foreground font-body">
            {t('contact.subtitle')}
          </p>
        </div>

        <div className="text-center mb-10">
          <a
            href="mailto:hello@burs.me"
            className="text-sm font-medium hover:underline transition-colors text-muted-foreground font-body cursor-pointer"
          >
            hello@burs.me
          </a>
        </div>

        {status === 'success' ? (
          <motion.div
            className="flex items-center justify-center gap-3 p-6 animate-fade-in bg-secondary border border-border"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Check className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium text-foreground font-body">
              {t('contact.success')}
            </span>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 font-body">
            <input
              type="text"
              placeholder={t('contact.name')}
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
              className="w-full h-12 px-4 text-sm outline-none focus:ring-1 transition-all bg-secondary border border-border text-foreground ring-border"
            />
            <input
              type="email"
              placeholder={t('contact.email')}
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              required
              className="w-full h-12 px-4 text-sm outline-none focus:ring-1 transition-all bg-secondary border border-border text-foreground"
            />
            <textarea
              placeholder={t('contact.message')}
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              rows={5}
              required
              className="w-full px-4 py-3 text-sm outline-none focus:ring-1 transition-all resize-none bg-secondary border border-border text-foreground"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full h-12 font-semibold text-sm tracking-wide hover:opacity-90 active:scale-[0.98] transition-all duration-300 inline-flex items-center justify-center gap-2 disabled:opacity-50 bg-foreground text-background cursor-pointer"
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
      </motion.main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-xl mx-auto px-4 py-8 flex flex-col items-center gap-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
            <img src={bursLogo} alt="BURS" className="h-8 object-contain opacity-50" />
            <div className="flex gap-6 text-xs tracking-wide text-muted-foreground">
              <Link to="/privacy" className="hover:text-foreground transition-colors cursor-pointer">{t('footer.privacy')}</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors cursor-pointer">{t('footer.terms')}</Link>
              <span className="font-medium text-foreground">{t('contact.title')}</span>
            </div>
            <a
              href="https://www.instagram.com/burs_style"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="hover:text-foreground transition-colors text-muted-foreground cursor-pointer"
            >
              <Instagram size={16} strokeWidth={1.5} />
            </a>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-2 w-full text-[10px] text-muted-foreground">
            <p>© {new Date().getFullYear()} BURS AB</p>
            <p className="text-center max-w-md">{t('contact.gdpr_note')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
