import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Send, Check, Loader2, Instagram } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE_CURVE } from '@/lib/motion';
import bursLogo from '@/assets/burs-monogram.png';

export default function Contact() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [formData, setFormData] = useState({ name: '', email: '', subject: 'general', message: '' });
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    hapticLight();
    setStatus('loading');
    await new Promise(r => setTimeout(r, 1000));
    setStatus('success');
  };

  const stagger = (i: number) =>
    prefersReduced ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.08 * i, duration: 0.35, ease: EASE_CURVE } };

  const subjects = [
    { value: 'general', label: t('contact.subject_general') || 'General Inquiry' },
    { value: 'bug', label: t('contact.subject_bug') || 'Bug report' },
    { value: 'feature', label: t('contact.subject_feature') || 'Feature request' },
    { value: 'billing', label: t('contact.subject_billing') || 'Billing' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Helmet>
        <title>{t('contact.title')} — BURS</title>
        <meta name="description" content={t('contact.subtitle')} />
      </Helmet>

      {/* Header */}
      <header className="sticky top-0 z-10 topbar-frost border-b border-border/40">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-1 -ml-1 cursor-pointer" onClick={() => hapticLight()}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <img src={bursLogo} alt="BURS" className="h-5 object-contain opacity-70" />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-xl mx-auto px-4 py-10 w-full">
        <motion.div className="text-center mb-10" {...stagger(0)}>
          <div className="w-14 h-14 flex items-center justify-center mx-auto mb-6 surface-secondary rounded-[1.25rem]">
            <Mail className="w-7 h-7 text-muted-foreground/50" />
          </div>
          <h1 className="font-display italic text-[1.8rem] leading-tight mb-3">
            {t('contact.title')}
          </h1>
          <p className="text-sm text-muted-foreground font-body">
            {t('contact.subtitle')}
          </p>
        </motion.div>

        <motion.div className="text-center mb-8" {...stagger(1)}>
          <a
            href="mailto:hello@burs.me"
            className="text-sm font-body font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            hello@burs.me
          </a>
        </motion.div>

        {status === 'success' ? (
          <motion.div
            className="surface-secondary rounded-[1.25rem] flex items-center justify-center gap-3 p-8"
            initial={prefersReduced ? undefined : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: EASE_CURVE }}
          >
            <Check className="w-5 h-5 text-emerald-500" />
            <span className="font-medium text-foreground font-body">
              {t('contact.success')}
            </span>
          </motion.div>
        ) : (
          <motion.div {...stagger(2)}>
            <form onSubmit={handleSubmit} className="space-y-4 font-body">
              <div className="space-y-1">
                <label className="label-editorial text-muted-foreground/50 text-[10px]">{t('contact.name')}</label>
                <input
                  type="text"
                  placeholder={t('contact.name')}
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full h-12 px-4 text-sm outline-none transition-all rounded-[0.75rem] bg-background border border-border/60 text-foreground focus:border-foreground/40 focus:ring-1 focus:ring-foreground/10"
                />
              </div>
              <div className="space-y-1">
                <label className="label-editorial text-muted-foreground/50 text-[10px]">{t('contact.email')}</label>
                <input
                  type="email"
                  placeholder={t('contact.email')}
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                  className="w-full h-12 px-4 text-sm outline-none transition-all rounded-[0.75rem] bg-background border border-border/60 text-foreground focus:border-foreground/40 focus:ring-1 focus:ring-foreground/10"
                />
              </div>
              <div className="space-y-1">
                <label className="label-editorial text-muted-foreground/50 text-[10px]">{t('contact.subject') || 'Subject'}</label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full h-12 px-4 text-sm outline-none transition-all rounded-[0.75rem] bg-background border border-border/60 text-foreground focus:border-foreground/40 focus:ring-1 focus:ring-foreground/10 cursor-pointer appearance-none"
                >
                  {subjects.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="label-editorial text-muted-foreground/50 text-[10px]">{t('contact.message')}</label>
                <textarea
                  placeholder={t('contact.message')}
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  rows={5}
                  required
                  className="w-full px-4 py-3 text-sm outline-none transition-all resize-none rounded-[0.75rem] bg-background border border-border/60 text-foreground focus:border-foreground/40 focus:ring-1 focus:ring-foreground/10"
                />
              </div>
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full h-12 font-semibold text-sm tracking-wide active:scale-[0.98] transition-all duration-200 inline-flex items-center justify-center gap-2 disabled:opacity-50 bg-foreground text-background cursor-pointer rounded-full"
                onClick={() => hapticLight()}
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
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40">
        <div className="max-w-xl mx-auto px-4 py-8 flex flex-col items-center gap-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
            <img src={bursLogo} alt="BURS" className="h-6 object-contain opacity-40" />
            <div className="flex gap-6 text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-body">
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
          <div className="flex flex-col md:flex-row items-center justify-between gap-2 w-full text-[10px] text-muted-foreground font-body">
            <p>© {new Date().getFullYear()} BURS AB</p>
            <p className="text-center max-w-md">{t('contact.gdpr_note')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
